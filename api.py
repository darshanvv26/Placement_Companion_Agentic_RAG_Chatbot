import os
import asyncio
import json
import hashlib
import uuid 
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Request, HTTPException, Depends, status, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_agent import app as agent_app, HumanMessage, AIMessage, AGENT_MODE as agentic_mode, analyze_document

USER_DATA_FILE = "users.json"
SESSIONS_DATA_FILE = "chat_sessions.json"

if not os.path.exists(USER_DATA_FILE):
    with open(USER_DATA_FILE, "w") as f:
        json.dump({}, f)

if not os.path.exists(SESSIONS_DATA_FILE):
    with open(SESSIONS_DATA_FILE, "w") as f:
        json.dump({}, f)

def get_users():
    with open(USER_DATA_FILE, "r") as f:
        return json.load(f)

def save_users(users):
    with open(USER_DATA_FILE, "w") as f:
        json.dump(users, f)

def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

def get_all_sessions():
    """Load all sessions from file."""
    with open(SESSIONS_DATA_FILE, "r") as f:
        return json.load(f)

def save_all_sessions(sessions):
    """Save all sessions to file."""
    with open(SESSIONS_DATA_FILE, "w") as f:
        json.dump(sessions, f)

app = FastAPI()

# Enable CORS for React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    mode: Optional[str] = None # "fast" or "agentic"
    username: Optional[str] = None

class UserAuth(BaseModel):
    username: str
    password: str

class SaveSessionRequest(BaseModel):
    username: str
    session_id: str
    session_title: str
    messages: List[ChatMessage]

class LoadSessionsRequest(BaseModel):
    username: str

@app.post("/signup")
async def signup(auth: UserAuth):
    users = get_users()
    if auth.username in users:
        raise HTTPException(status_code=400, detail="Username already exists")
    users[auth.username] = hash_password(auth.password)
    save_users(users)
    return {"message": "User created successfully"}

@app.post("/login")
async def login(auth: UserAuth):
    users = get_users()
    if auth.username not in users or users[auth.username] != hash_password(auth.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": auth.username, "message": "Login successful"}

@app.post("/sessions/load")
async def load_sessions(req: LoadSessionsRequest):
    """Load all sessions for a user (last 10)."""
    all_sessions = get_all_sessions()
    user_sessions = all_sessions.get(req.username, [])
    # Return last 10 sessions, newest first
    return {"sessions": user_sessions[-10:][::-1]}

@app.post("/sessions/save")
async def save_session(req: SaveSessionRequest):
    """Save or update a chat session for a user. Keeps last 10 sessions."""
    all_sessions = get_all_sessions()
    user_sessions = all_sessions.get(req.username, [])

    # Find existing session by ID (update) or create new
    existing_idx = next((i for i, s in enumerate(user_sessions) if s["session_id"] == req.session_id), None)

    session_data = {
        "session_id": req.session_id,
        "title": req.session_title,
        "messages": [m.dict() for m in req.messages],
        "updated_at": datetime.utcnow().isoformat()
    }

    if existing_idx is not None:
        user_sessions[existing_idx] = session_data
    else:
        user_sessions.append(session_data)

    # Keep only last 10 sessions
    if len(user_sessions) > 10:
        user_sessions = user_sessions[-10:]

    all_sessions[req.username] = user_sessions
    save_all_sessions(all_sessions)
    return {"ok": True, "session_id": req.session_id}

@app.delete("/sessions/{username}/{session_id}")
async def delete_session(username: str, session_id: str):
    """Delete a specific session."""
    all_sessions = get_all_sessions()
    user_sessions = all_sessions.get(username, [])
    user_sessions = [s for s in user_sessions if s["session_id"] != session_id]
    all_sessions[username] = user_sessions
    save_all_sessions(all_sessions)
    return {"ok": True}

@app.post("/resume/upload")
async def upload_resume(username: str, doc_type: str = "resume", file: UploadFile = File(...)):
    """Uploads and analyzes a document (resume/jd) via Gemini multimodal call."""
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
        
    ext = file.filename.split('.')[-1].lower()
    if ext not in ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'pptx']:
        raise HTTPException(status_code=400, detail="Only PDF, Image, DOCX, and PPTX files are supported")
        
    mime_map = {
        'pdf': 'application/pdf',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
    mime_type = mime_map.get(ext, 'application/octet-stream')
    
    file_bytes = await file.read()
    
    # Capture the current running loop for streaming
    loop = asyncio.get_running_loop()
    token_queue = asyncio.Queue()

    def streamer_callback(token: str):
        loop.call_soon_threadsafe(token_queue.put_nowait, token)

    async def event_generator():
        # Start document analysis in a thread
        task = asyncio.create_task(asyncio.to_thread(analyze_document, file_bytes, mime_type, doc_type, streamer_callback))
        
        while not task.done() or not token_queue.empty():
            try:
                token = await asyncio.wait_for(token_queue.get(), timeout=0.1)
                yield f"data: {json.dumps({'token': token})}\n\n"
            except asyncio.TimeoutError:
                continue
        
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # Map history to LangChain messages
    formatted_history = []
    for msg in request.history:
        if msg.role == "user":
            formatted_history.append(HumanMessage(content=msg.content))
        else:
            formatted_history.append(AIMessage(content=msg.content))

    # Determine mode
    import rag_agent
    current_mode = request.mode or os.getenv("AGENT_MODE", "fast")
    
    # Capture the current running loop to use in the callback
    loop = asyncio.get_running_loop()
    token_queue = asyncio.Queue()

    def streamer_callback(token: str):
        # This is called inside the sync LangGraph loop (inside a thread)
        # Use call_soon_threadsafe to interact with the async queue from a thread
        loop.call_soon_threadsafe(token_queue.put_nowait, token)

    initial_state = {
        "query": request.message,
        "original_query": request.message,
        "chat_history": formatted_history,
        "context_chunks": [],
        "current_answer": "",
        "critique": "",
        "iterations": 0,
        "streamer": streamer_callback
    }

    async def event_generator():
        # Start the graph in a separate thread because it's synchronous
        # We need to import the modified AGENT_MODE correctly
        import rag_agent
        rag_agent.AGENT_MODE = current_mode
        
        task = asyncio.create_task(asyncio.to_thread(agent_app.invoke, initial_state))
        
        while not task.done() or not token_queue.empty():
            try:
                # Wait for a token with a timeout to check if task is done
                token = await asyncio.wait_for(token_queue.get(), timeout=0.1)
                yield f"data: {json.dumps({'token': token})}\n\n"
            except asyncio.TimeoutError:
                continue
        
        # After completion, signal end
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
