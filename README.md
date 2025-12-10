# Buonghe - Intelligent Virtual Assistant for Movie Retrieval

A video retrieval application featuring Hatsune Miku as your anime-style AI assistant, powered by Google Gemini.

## 🏗️ Project Structure

```
Buonghe/
├── fe/          # React Frontend (TypeScript)
├── be/          # Python Retrieval Backend (FastAPI)
├── honey-be/    # Node.js AI Backend (Gemini LLM + Elevenlabs TTS)
└── README.md    # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))
- Elevenlabs API Key ([Get one here](https://elevenlabs.io/app/developers/api-keys))

### 1. Frontend (React)
```bash
cd fe
npm install
cp .env.example .env  # Edit with your settings
npm start
```

### 2. AI Backend (honey-be)
```bash
cd honey-be
npm install
cp .env.example .env  # Add your GEMINI_API_KEY and ELEVENLABS_API_KEY
npm start
```

### 3. Retrieval Backend (be)
```bash
cd be
pip install -r requirements.txt
cp .env.template .env  # Configure your settings
python server.py
```

## 🎭 Features

- **Miku AI Assistant**: Hatsune Miku as your virtual assistant powered by Gemini
- **Smart Query Classification**: Automatically classifies queries (TEXT, TEMPORAL, FILTER, IMAGE)
- **Video Search**: Find relevant video frames using text or image queries
- **Live2D Miku Avatar**: Animated character with lip-sync, animations and expressions

## 📡 API Endpoints

### honey-be (AI Backend) - Port 3001
| Endpoint | Description |
|----------|-------------|
| `POST /api/speech/chat/smart` | Smart chat with query classification and Miku response |
| `POST /api/speech/tts` | Text-to-speech |
| `POST /api/speech/react/visual` | Reaction to visual search results |

### be (Retrieval Backend) - Port 8082
| Endpoint | Description |
|----------|-------------|
| `POST /search/text` | Text-based video search |
| `POST /search/visual` | Image-based search |
| `POST /search/visual/temporal` | Temporal search (before/now/after) |
| `POST /search/filter` | Metadata filter search (OCR, genre, etc.) |
| `POST /chat/rephrase/suggestion`| Rephase query|

## 🔑 Environment Variables

See `.env.example` files in each sub-project for required configuration.