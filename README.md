Here is a comprehensive and polished version of your documentation in English. I have organized it to look professional for a GitHub README, added details about the Chrome Extension installation (since it's a manual process), and refined the language.

***

# 🎵 Buonghe - Intelligent Virtual Assistant for Movie Retrieval

> **Experience a new way to search for anime moments with Hatsune Miku.**

**Buonghe** is a multimodal video retrieval application featuring **Hatsune Miku** as your interactive AI assistant. Powered by **Google Gemini** and advanced retrieval algorithms, it allows users to find specific video frames using natural language or images, all while interacting with a fully animated Live2D avatar.

## 🏗️ Project Structure

The project is divided into four main components:

```bash
Buonghe/
├── fe/                      # Frontend: React (TypeScript) & Live2D integration
├── be/                      # Retrieval Backend: Python (FastAPI) for vector search
├── honey-be/                # AI Backend: Node.js (Gemini LLM + ElevenLabs TTS)
├── vuighe-seeker-extension/ # Chrome Extension: Enables auto-seeking on streaming sites
└── README.md
```

## 🌟 Key Features

*   **🤖 Interactive Miku AI:** A Live2D avatar that listens, responds, and reacts to your search results with lip-sync and emotional expressions.
*   **🧠 Smart Query Classification:** Automatically distinguishes between general conversation, text search, visual search, temporal queries (before/after), and metadata filtering.
*   **🔍 Multimodal Video Retrieval:**
    *   **Text-to-Video:** Find scenes by describing them (e.g., "Luffy fighting Kaido").
    *   **Image-to-Video:** Upload a screenshot to find the exact source episode and timestamp.
*   **⏱️ Deep Linking (Auto-Seek):** Opens external streaming sites (Vuighe) and automatically jumps to the exact second of the result using a custom Chrome Extension.
*   **🗣️ Natural Voice:** High-quality Text-to-Speech powered by ElevenLabs.

## 🚀 Quick Start

### Prerequisites
*   **Node.js**: v18 or higher
*   **Python**: v3.10 or higher
*   **Google Chrome** (or Chromium-based browser)
*   **API Keys**:
    *   [Google Gemini API Key](https://makersuite.google.com/app/apikey)
    *   [ElevenLabs API Key](https://elevenlabs.io/app/developers/api-keys)

---

### 1. Retrieval Backend (`AnimeSearchEngine`)
This service handles the vector database and search logic.

```bash
cd AnimeSearchEngine
# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.template .env
# Edit .env with your database credentials

# Run the server (Port 8082)
python server.py
```

### 2. AI Backend (`honey-be`)
This service handles LLM processing, query intent classification, and TTS.

```bash
cd honey-be
npm install

# Configure environment
cp .env.example .env
# ⚠️ Add your GEMINI_API_KEY and ELEVENLABS_API_KEY in .env

# Run the server (Port 3001)
npm start
```

### 3. Chrome Extension (`vuighe-seeker-extension`)
**Crucial Step:** This extension is required to enable the "Deep Link" feature that auto-plays videos at the correct timestamp on the external streaming site.

1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** (toggle in the top-right corner).
3.  Click **Load unpacked**.
4.  Select the `vuighe-seeker-extension` folder from this project.
5.  Ensure the extension is active.

### 4. Frontend (`fe`)
The main user interface.

```bash
cd fe
npm install

# Configure environment
cp .env.example .env

# Run the application
npm start
```

## 📡 API Reference

### 🐝 Honey-BE (AI Backend)
**Base URL:** `http://localhost:3001`

| Method | Endpoint                   | Description                                                                                                       |
| :----- | :------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/speech/chat/smart`   | **Core Endpoint.** Sends user input to Gemini. Returns intent (Search vs. Chat), Miku's text response, and audio. |
| `POST` | `/api/speech/react/visual` | Generates Miku's reaction based on visual search results.                                                         |

### 🔍 ANIMESEARCHENGINE (Retrieval Backend)
**Base URL:** `http://localhost:8000`

| Method | Endpoint        | Description                                                                                       |
| :----- | :-------------- | :------------------------------------------------------------------------------------------------ |
| `POST` | `/api/text`     | Retrieves video frames based on text descriptions.                                                |
| `POST` | `/api/visual`   | Retrieves video frames based on input images.                                                     |
| `POST` | `/api/temporal` | Performs temporal search (e.g., "a woman stretch the bow and fire the arrow but then it missed"). |
| `POST` | `/api/rephrase` | Generates search suggestions or rephrases complex queries.                                        |

## 🧩 How It Works

1.  **User Input:** The user speaks or types a query in the Frontend.
2.  **Intent Analysis:** `honey-be` uses Gemini to determine if the user wants to *chat* or *find a movie*.
3.  **Search Execution:** If a search is detected, the query is routed to `AnimeSearchEngine` to query the vector index.
4.  **Result Presentation:** Results are displayed in the UI. Miku verbally comments on the results.
5.  **Playback:** When a user clicks a result, the browser opens the streaming site. The `vuighe-seeker-extension` detects the `#autoseek` hash in the URL and automatically controls the video player to jump to the correct timestamp.