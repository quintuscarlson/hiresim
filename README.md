# HireSim

HireSim is an AI-powered mock interview platform that simulates realistic technical interviews through voice, video, and typed interactions. The system provides real-time conversation, live transcription, and automated post-interview feedback.

Live Demo: https://hiresim.xyz  
GitHub: https://github.com/quintuscarlson/hiresim  

---

## Features

- Voice interview mode with real-time transcription
- Video interview mode with camera integration and dynamic UI
- Typed interview mode for structured responses
- AI-generated interview questions
- Automated scoring and debrief with feedback
- Live transcript system with auto-updating UI

---

## Tech Stack

Frontend:
- React (Vite)
- Tailwind CSS
- WebSockets

Backend:
- Node.js
- Express
- WebSockets

AI:
- Groq LLM (response generation and scoring)

Deployment:
- Vercel (frontend)
- Railway (backend)

---

## How It Works

1. User selects an interview type (voice, video, or typed)
2. A session is created via the backend API
3. The AI interviewer generates and asks questions dynamically
4. User responses are captured (voice, video, or text)
5. Responses are processed and added to a live transcript
6. After completion, the system evaluates performance
7. A debrief is generated with a score and explanation

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/quintuscarlson/hiresim.git
cd hiresim
