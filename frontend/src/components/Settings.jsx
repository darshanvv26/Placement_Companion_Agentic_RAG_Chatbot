import React from 'react';
import { X, Sun, Moon, Monitor, User, LogOut, Check } from 'lucide-react';

const Settings = ({ isOpen, onClose, theme, setTheme, user, setUser, onLogout }) => {
    if (!isOpen) return null;

    const themes = [
        { id: 'light', name: 'Light', icon: <Sun size={20} /> },
        { id: 'dark', name: 'Dark', icon: <Moon size={20} /> },
        { id: 'adaptive', name: 'Adaptive', icon: <Monitor size={20} /> },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
                <div className="settings-header">
                    <h2 className="title">Settings</h2>
                    <button className="icon-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="settings-section">
                    <label className="settings-label">Appearance</label>
                    <div className="theme-options">
                        {themes.map(t => (
                            <div
                                key={t.id}
                                className={`theme-card ${theme === t.id ? 'active' : ''}`}
                                onClick={() => setTheme(t.id)}
                            >
                                {t.icon}
                                <span>{t.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="settings-section">
                    <label className="settings-label">Profile</label>
                    <div className="profile-item active">
                        <div className="avatar user-avatar" style={{ width: '40px', height: '40px' }}>
                            {user[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600' }}>{user}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Session</div>
                        </div>
                        <Check size={20} className="send-btn" />
                    </div>

                    <button className="sidebar-item" onClick={onLogout} style={{ width: '100%', marginTop: '1rem', background: 'transparent', border: 'none' }}>
                        <LogOut size={18} />
                        <span>Sign out of all profiles</span>
                    </button>
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    MSIS Placement Chatbot v1.0
                </div>
            </div>
        </div>
    );
};

export default Settings;
