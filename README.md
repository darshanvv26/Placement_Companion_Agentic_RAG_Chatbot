# MSIS Placement Chatbot 🎓🤖

A premium, Gemini-style AI assistant for MSIS (Manipal School of Information Science) students to navigate their placement journey. Built with FastAPI, LangGraph, ChromaDB, and React.

## ✨ Features

- **Gemini-inspired UI**: Sleek, modern, and dark-themed interface with glassmorphism and smooth animations.
- **Agentic RAG**: Uses a multi-step Agentic RAG flow (Planner -> Retriever -> Executor -> Critic) for high-quality, grounded answers.
- **Dual Modes**:
  - **Fast Mode**: Quick, direct answers for simple queries.
  - **Agentic Mode**: Thorough research and validation for complex placement questions.
- **Authentication**: Personalized user experience with Signup and Login functionality.
- **Streaming Responses**: Real-time token streaming for a responsive chat feel.
- **Sidebar Integration**: Manage multiple chats and navigate easily.

## 🛠️ Technology Stack

- **Backend**: FastAPI, LangChain, LangGraph, Ollama (Llama 3), ChromaDB.
- **Frontend**: React (Vite), Tailwind CSS (for layout logic), Lucide React (icons).
- **Data Source**: Custom MSIS placement documents processed into high-quality chunks.

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js & npm
- [Ollama](https://ollama.com/) (running Llama 3)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/MSIS-Placement-Chatbot.git
   cd MSIS-Placement-Chatbot
   ```

2. **Backend Setup**:
   ```bash
   # Create a virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt

   # Start the FastAPI server
   python api.py
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 📖 Usage

1. Open your browser to `http://localhost:5173`.
2. Create an account or login.
3. Choose your mode (Fast or Agentic).
4. Ask anything about MSIS placements (e.g., "What are the common interview questions for Google?", "How do I prepare for a data science role?").

## 📄 Documentation

- `rag_agent.py`: Contains the LangGraph workflow and RAG logic.
- `api.py`: FastAPI backend with authentication and chat specialized endpoints.
- `frontend/`: React source code for the premium UI experience.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---
Built with ❤️ by Darshan
