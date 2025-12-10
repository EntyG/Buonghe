
# 🎀 Honey Backend - Miku Virtual Assistant

Backend server for **Miku**, an anime-style virtual assistant powered by Google Gemini (LLM) and ElevenLabs (TTS).

## 🌸 Meet Miku

> *Miku is an interactive anime-style virtual assistant designed for conversational AI and video search. She reacts to user queries with personality-driven responses, mood changes, and animated expressions.*

## 🔄 Pipeline Flow

```
User message (text/voice/image)
  ↓
Google Gemini (LLM) - Classifies query, generates Miku's response, mood, and search type
  ↓
ElevenLabs (TTS) - Synthesizes Japanese voice for Miku's response
  ↓
Avatar Animation Data - Lip sync, mood, gestures, body movement
  ↓
Frontend - Plays audio and animates Live2D Miku avatar
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd honey-be
npm install
```

### 2. Configure Environment

Create a `.env` file in the `honey-be` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Groq API (STT + LLM)
GROQ_API_KEY=your_groq_api_key_here

# Typecast.ai API (TTS - Miu Kobayashi voice)
TYPECAST_API_KEY=your_typecast_api_key_here
TYPECAST_ACTOR_ID=miu_kobayashi_actor_id

# CORS
FRONTEND_URL=http://localhost:5173
```

### 3. Find Miu Kobayashi Voice ID

```bash
# Option 1: Use the discovery script
npm run find-voices

# Option 2: Start server and call the API
npm run dev
# Then open: http://localhost:3001/api/speech/voices/miu
```

This will output something like:
```
🎀 FOUND MIU KOBAYASHI! 🎀
   Voice ID:   tc_xxxxxxxxxxxx
   Name:       Miu Kobayashi
   Emotions:   normal, happy, sad, angry

📝 Add this to your .env file:
   TYPECAST_ACTOR_ID=tc_xxxxxxxxxxxx
```

### 4. Run the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```


## 📡 API Endpoints

| Endpoint                              | Description                                                                                   |
|----------------------------------------|-----------------------------------------------------------------------------------------------|
| `POST /api/speech/chat/smart`          | Smart chat: Classifies query, returns Miku response, and search/temporal/filter/image queries |                                        |
| `POST /api/speech/tts`                 | Text-to-speech (Japanese, ElevenLabs voice, returns audio URL and lip sync)                   |
| `POST /api/speech/react/visual`        | Miku's reaction to visual search results (hardcoded, TTS, avatar animation)                   |
| `DELETE /api/speech/audio/:filename`   | Delete generated audio file after playback                                                    |
| `GET /api/health`                      | Health check for backend and API keys                                                         |

All endpoints return structured data for frontend use, including Miku's response, mood, audio, and avatar animation data.
The main endpoint for search classification and Miku response is `/api/speech/chat/smart`.
TTS uses ElevenLabs and returns a temporary audio file URL.
Visual search reactions and audio cleanup are supported.

## 😊 miku's Moods

miku expresses different moods based on the conversation:

| Mood | Trigger | Avatar Expression |
|------|---------|-------------------|
| `happy` | Good meal choices, positive interactions | Smiling, gentle sway |
| `excited` | Achievements, trying healthy foods | Bouncing, wide smile |
| `concerned` | Unhealthy choices | Worried look, lean forward |
| `pouty` | Ignoring advice | Puffed cheeks, slight turn away |
| `encouraging` | Motivating the user | Nodding, warm expression |
| `thinking` | Giving advice | Head tilt, thoughtful look |
| `surprised` | Unexpected news | Wide eyes, jump back |

## 🎭 Avatar Animation Data

### Expression
```json
{
  "type": "excited",
  "intensity": 1.0
}
```

### Lip Sync (Live2D/VRM Compatible)
```json
{
  "visemes": [
    { "time": 0, "duration": 100, "viseme": "AA", "value": 0.9 },
    { "time": 100, "duration": 80, "viseme": "E", "value": 0.6 }
  ],
  "mouthShapes": {
    "AA": { "mouth_open": 0.9, "mouth_form": 0.5 },
    "a": { "mouth_open": 0.8, "mouth_form": 0.5 }
  }
}
```

### Gestures
```json
[
  { "type": "bounce", "time": 0, "duration": 500 },
  { "type": "nod", "time": 200, "duration": 400 }
]
```

**Available Gestures:**
- `wave` - Greeting
- `nod` - Agreement
- `head_shake` - Disagreement
- `head_tilt` - Curiosity/thinking
- `bounce` - Excitement
- `puff_cheeks` - Pouting
- `clap` - Celebration
- `emphasis` - Exclamation

### Body Movement
```json
{
  "bounce": true,
  "sway": true,
  "intensity": 0.6
}
```


## 🔑 Environment Variables

See `.env.example` for required configuration:
- `GEMINI_API_KEY` (Google Gemini)
- `ELEVENLABS_API_KEY` (ElevenLabs TTS)
- `PORT` (default: 3001)
- `FRONTEND_URL` (CORS)


## 📁 Project Structure

```
honey-be/
├── src/
│   ├── index.js                 # Main server
│   ├── routes/
│   │   └── speech.js            # REST API routes
│   ├── services/
│   │   └── MikuService.js       # Gemini LLM + ElevenLabs TTS
├── public/audio/                # Generated audio cache
├── temp/                        # Temporary processing files
├── package.json
├── env.example
└── README.md
```


## 🛠 Tech Stack

- **Runtime**: Node.js + Express
- **LLM**: Google Gemini
- **TTS**: ElevenLabs (Japanese voice)
- **Avatar**: Live2D compatible data
