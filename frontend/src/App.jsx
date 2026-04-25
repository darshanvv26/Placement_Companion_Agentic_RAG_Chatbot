import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import Auth from './components/Auth';
import Settings from './components/Settings';
import { Send, Zap, Brain, Plus, MessageSquare, Settings as SettingsIcon, LogOut, Menu, ChevronDown, PlusCircle, Wrench, Trash2, FileText, User } from 'lucide-react';

// If we are in production, use the environment variable VITE_API_URL.
// For example, VITE_API_URL=https://my-backend-app.us-east-1.awsapprunner.com
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const MAX_SESSIONS = 10;

// Generate a unique session ID
function genSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Derive a title from the first user message
function deriveTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New Chat';
  const title = first.content.slice(0, 40);
  return title.length < first.content.length ? title + '…' : title;
}

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');

  // Chat state
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(() => genSessionId());
  const [sessions, setSessions] = useState([]); // list from backend [{session_id, title, messages, updated_at}]

  const [input, setInput] = useState('');
  const [mode, setMode] = useState('fast');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const chatWindowRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [currentDocType, setCurrentDocType] = useState('resume'); // 'resume' or 'jd'

  // ─── Theme ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'adaptive') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.setAttribute('data-theme', systemTheme);
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── Load Sessions on Login ───────────────────────────────────────────────
  const fetchSessions = useCallback(async (username) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }, []);

  useEffect(() => {
    if (user) fetchSessions(user);
  }, [user, fetchSessions]);

  // ─── Auto-save session with debounce ──────────────────────────────────────
  const persistSession = useCallback(async (currentMessages, currentSessionId, username) => {
    if (!username || currentMessages.length === 0) return;
    const title = deriveTitle(currentMessages);
    try {
      await fetch(`${API_BASE}/sessions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          session_id: currentSessionId,
          session_title: title,
          messages: currentMessages,
        }),
      });
      // Refresh sidebar
      await fetchSessions(username);
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  }, [fetchSessions]);

  // Debounced save after messages change
  useEffect(() => {
    if (!user || messages.length === 0) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistSession(messages, sessionId, user);
    }, 1500); // save 1.5s after last message
    return () => clearTimeout(saveTimeoutRef.current);
  }, [messages, sessionId, user, persistSession]);

  // ─── Send Message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const aiMessageId = Date.now();
    setMessages(prev => [...prev, { role: 'ai', content: '', id: aiMessageId }]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages,
          mode: mode,
          username: user
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.token) {
                fullContent += data.token;
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMessageId ? { ...msg, content: fullContent } : msg
                ));
              }
            } catch (e) {
              console.error('Error parsing SSE:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId ? { ...msg, content: 'Error: Connection to backend failed.' } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── New Chat ─────────────────────────────────────────────────────────────
  const startNewChat = () => {
    setMessages([]);
    setSessionId(genSessionId());
  };

  // ─── Load Session from Sidebar ────────────────────────────────────────────
  const loadSession = (session) => {
    setMessages(session.messages || []);
    setSessionId(session.session_id);
  };

  // ─── Delete Session ───────────────────────────────────────────────────────
  const deleteSession = async (e, session) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/sessions/${user}/${session.session_id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.session_id !== session.session_id));
      // If currently viewing deleted session, start fresh
      if (session.session_id === sessionId) startNewChat();
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  // ─── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setUser(null);
    setMessages([]);
    setSessions([]);
    setSessionId(genSessionId());
  };

  // ─── Document Upload ─────────────────────────────────────────────────────
  const triggerUpload = (type) => {
    setCurrentDocType(type);
    setShowUploadMenu(false);
    fileInputRef.current.click();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;

    const validTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PDF, Image, Word (DOCX), or PPT (PPTX).');
      return;
    }

    setIsLoading(true);
    const aiMessageId = Date.now();
    const typeLabel = currentDocType === 'resume' ? 'Resume' : 'Job Description';
    const waitMsg = currentDocType === 'resume'
      ? '⏳ Analyzing your profile and matching with companies...'
      : '⏳ Analyzing the JD and preparing your roadmap...';

    setMessages(prev => [...prev,
    { role: 'user', content: `📎 *Uploaded ${typeLabel}: ${file.name}*` },
    { role: 'ai', content: waitMsg, id: aiMessageId }
    ]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/resume/upload?username=${user}&doc_type=${currentDocType}`, {
        method: 'POST',
        body: formData,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.token) {
                fullContent += data.token;
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMessageId ? { ...msg, content: fullContent } : msg
                ));
              }
            } catch (e) {
              console.error('Error parsing SSE:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId ? { ...msg, content: `❌ Failed to analyze ${currentDocType}.` } : msg
      ));
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  // ─── Auth Screen ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="auth-container">
        <Auth
          mode={authMode}
          onToggle={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          onAuthSuccess={setUser}
        />
      </div>
    );
  }

  return (
    <div className="main-layout">
      {showSidebar && (
        <aside className="sidebar">
          <button className="new-chat-btn" onClick={startNewChat}>
            <Plus size={20} />
            New chat
          </button>

          <div className="sidebar-section">
            <p className="section-title">Recent</p>
            <div className="recent-list">
              {sessions.length === 0 && (
                <div className="no-sessions">No saved chats yet</div>
              )}
              {sessions.map((session) => (
                <div
                  key={session.session_id}
                  className={`recent-item ${session.session_id === sessionId ? 'active' : ''}`}
                  onClick={() => loadSession(session)}
                  title={session.title}
                >
                  <MessageSquare size={15} className="recent-icon" />
                  <span className="recent-title">{session.title}</span>
                  <button
                    className="delete-session-btn"
                    onClick={(e) => deleteSession(e, session)}
                    title="Delete this chat"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <div className="sidebar-item" onClick={() => setIsSettingsOpen(true)}>
              <SettingsIcon size={18} />
              <span>Settings</span>
            </div>
            <div className="sidebar-item" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Sign out</span>
            </div>
          </div>
        </aside>
      )}

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        user={user}
        onLogout={handleLogout}
      />

      <main className="app-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="icon-btn" onClick={() => setShowSidebar(!showSidebar)}>
              <Menu size={20} />
            </button>
            <div className="title">MSIS Placement Chatbot</div>
          </div>
          <div className="user-profile">
            <div className="user-avatar">{user[0].toUpperCase()}</div>
          </div>
        </header>

        {messages.length === 0 ? (
          <div className="home-view">
            <h1 className="greeting-text">Hi {user}</h1>
            <p className="subtitle-text">Where should we start?</p>
          </div>
        ) : (
          <div className="chat-window" ref={chatWindowRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className="message-wrapper">
                <div className={`avatar ${msg.role === 'user' ? 'user-avatar' : 'ai-avatar'}`}>
                  {msg.role === 'user' ? user[0].toUpperCase() : 'AI'}
                </div>
                <div className="message-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-wrapper">
                <div className="avatar ai-avatar">AI</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="input-container">
          <div className="input-box-wrapper">
            <div className="input-box">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx"
              />

              <div style={{ position: 'relative' }}>
                {showUploadMenu && (
                  <div className="upload-menu">
                    <div className="upload-menu-item" onClick={() => triggerUpload('resume')}>
                      <div className="upload-menu-item-icon"><User size={18} /></div>
                      <span>Analyze Resume</span>
                    </div>
                    <div className="upload-menu-item" onClick={() => triggerUpload('jd')}>
                      <div className="upload-menu-item-icon"><FileText size={18} /></div>
                      <span>Analyze Company JD</span>
                    </div>
                  </div>
                )}
                <button
                  className="icon-btn"
                  onClick={() => setShowUploadMenu(!showUploadMenu)}
                  title="Upload Resume or JD"
                >
                  <PlusCircle size={20} />
                </button>
              </div>

              <button className="icon-btn" title="Advanced Tools (Coming Soon)">
                <Wrench size={20} />
              </button>

              <input
                className="chat-input"
                placeholder="Ask anything about placements..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading}
              />

              <div className="mode-pill-enhanced" onClick={() => setMode(mode === 'fast' ? 'agentic' : 'fast')}>
                {mode === 'fast' ? <Zap size={14} /> : <Brain size={14} />}
                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                  {mode === 'fast' ? 'Fast' : 'Agentic'}
                </span>
                <ChevronDown size={14} />
              </div>

              <button
                className={`action-btn ${input.trim() ? 'send-btn' : ''}`}
                onClick={handleSend}
                disabled={isLoading}
                style={{ marginLeft: '8px' }}
              >
                <div style={{ padding: '8px', background: input.trim() ? 'var(--primary-gradient)' : 'transparent', borderRadius: '50%', color: input.trim() ? 'white' : 'var(--text-muted)' }}>
                  <Send size={18} />
                </div>
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
              Placement bot can make mistakes, so double-check it
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
