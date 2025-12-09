# Buonghe - Video Retrieval with Megumin AI Assistant

A video retrieval application with an anime-style AI assistant (Megumin) powered by Google Gemini.

## 🏗️ Project Structure

```
Buonghe/
├── fe/          # React Frontend (TypeScript)
├── be/          # Python Retrieval Backend (FastAPI)
├── honey-be/    # Node.js AI Backend (Gemini LLM + TTS)
└── README.md    # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))

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
cp env.example .env  # Add your GEMINI_API_KEY
node src/index.js
```

### 3. Retrieval Backend (be)
```bash
cd be
pip install -r requirements.txt
cp .env.template .env  # Configure your settings
python server.py
```

## 🎭 Features

- **Megumin AI Assistant**: Anime-style virtual assistant powered by Gemini
- **Smart Query Classification**: Automatically classifies queries (TEXT, TEMPORAL, FILTER, IMAGE)
- **Video Search**: Find relevant video frames using text or image queries
- **Live2D Avatar**: Animated character with lip-sync and expressions

## 📡 API Endpoints

### honey-be (AI Backend) - Port 3001
| Endpoint | Description |
|----------|-------------|
| `POST /api/speech/chat/smart` | Smart chat with query classification |
| `POST /api/speech/chat` | Basic chat |
| `POST /api/speech/tts` | Text-to-speech |

### be (Retrieval Backend) - Port 8082
| Endpoint | Description |
|----------|-------------|
| `POST /clusters/text` | Text-based video search |
| `POST /clusters/visual` | Image-based search |
| `POST /clusters/temporal` | Temporal search |

## 🔑 Environment Variables

See `.env.example` files in each sub-project for required configuration.

## 📄 License

MIT
