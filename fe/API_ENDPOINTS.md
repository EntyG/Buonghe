# API Endpoints Documentation

This document describes all API endpoints required by the frontend application, now featuring Miku as your AI assistant.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_BASE_URL` | `http://14.225.217.119:8082` | Retrieval Backend URL |
| `REACT_APP_BASE_IMAGE_URL` | `http://14.225.217.119:8081` | Image Server URL |
| `REACT_APP_HONEY_BE_URL` | `http://localhost:3001` | Honey Backend (Miku AI + TTS) |

---

## 1. Retrieval Backend (BASE_URL)

### 1.1 Text Search
**Endpoint:** `POST /search/text`

**Request:**
```json
{
  "text": "a man walking in the rain",
  "mode": "moment",
  "collection": "clip_production_1024",
  "top_k": 256,
  "state_id": "optional_previous_state_id"
}
```

**Response:**
```json
{
  "status": "success",
  "state_id": "unique_state_id",
  "mode": "moment",
  "results": [
    {
      "cluster_name": "Scene 1",
      "url": null,
      "image_list": [
        {
          "id": "L01_V001/001234",
          "path": "/L01_V001/",
          "score": 0.95,
          "time_in_seconds": 1234,
          "name": "Frame 1234"
        }
      ]
    }
  ]
}
```

---

### 1.2 Visual Search (Image Search)
**Endpoint:** `POST /search/visual`

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | File | Yes | Image file to search |
| `mode` | string | Yes | Clustering mode: `moment` |
| `collection` | string | Yes | Model collection: `clip_production_1024` |
| `state_id` | string | No | Previous search state for continuation |

**Response:** Same as Text Search

---

### 1.3 Temporal Search
**Endpoint:** `POST /search/visual/temporal`

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `req` | JSON string | Yes | Request configuration |
| `before_image` | File | No | Image for "before" scene |
| `now_image` | File | No | Image for "now" scene |
| `after_image` | File | No | Image for "after" scene |

**`req` JSON structure:**
```json
{
  "collection": "clip_production_1024",
  "state_id": "optional_state_id",
  "before": { "text": "scene description before" },
  "now": { "text": "main event description" },
  "after": { "text": "scene description after" }
}
```

**Response:** Same as Text Search (results grouped as scenes with 3 frames each)


---

### 1.5 Rephrase Suggestions
**Endpoint:** `POST /chat/rephrase/suggestion`

**Request:**
```json
{
  "text": "original query text",
  "message_ref": "unique_message_reference"
}
```

**Response:**
```json
{
  "status": "success",
  "message_ref": "unique_message_reference",
  "variants": [
    "rephrased query 1",
    "rephrased query 2",
    "rephrased query 3"
  ]
}
```

---

## 2. Honey Backend (HONEY_BE_URL) - miku AI

### 2.1 Smart Chat (Query Classification + Response)
**Endpoint:** `POST /api/speech/chat/smart`

**Request:**
```json
{
  "message": "user's message or search query",
  "sessionId": "conversation_session_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userMessage": "user's original message",
    "isSearchQuery": true,
    "searchType": "TEXT | TEMPORAL | FILTER | IMAGE | NONE",
    "searchQuery": "optimized query for retrieval backend",
    "temporalQuery": {
      "before": "scene before",
      "now": "main event",
      "after": "scene after"
    },
    "filterQuery": {
      "ocr": ["game over", "text on screen"],
      "genre": ["horror", "comedy"]
    },
    "intent": "SEARCH | CHAT",
    "mikuResponse": {
      "text": "miku's response text",
      "mood": "happy | thinking | excited | sad"
    },
    "audio": {
      "url": "https://audio-url/voice.mp3",
      "duration": 3.5
    },
    "avatar": {
      "mood": "happy",
      "expression": "smile",
      "lipSync": [
        { "time": 0.0, "value": 0.5, "phoneme": "a" },
        { "time": 0.1, "value": 0.8, "phoneme": "i" }
      ],
      "gestures": ["wave"],
      "duration": 3.5
    },
    "sessionId": "session_id",
    "useFallbackAudio": false
  }
}
```

---

## 3. Retrieval Backend - Filter Search

### 3.1 Filter Search (Metadata-based)
**Endpoint:** `POST /search/filter`

**Description:** Search with metadata filters (OCR text on screen, genre categories) optionally combined with visual description.

**Request:**
```json
{
  "mode": "moment",
  "filters": {
    "ocr": ["game over"],
    "genre": ["horror", "comedy"]
  },
  "text": "person walking",
  "top_k": 256,
  "collection": "clip_production_1024",
  "state_id": "optional_previous_state_id"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | Yes | Clustering mode: `moment` |
| `filters.ocr` | string[] | No | Text visible on screen (OCR detection) |
| `filters.genre` | string[] | No | Video genre categories (horror, comedy, action, drama, etc.) |
| `text` | string | No | Optional visual description to combine with filters |
| `top_k` | number | Yes | Max results to return |
| `collection` | string | No | Model collection |
| `state_id` | string | No | Previous search state for continuation |

**Response:** Same as Text Search

---

## 4. Image Server (BASE_IMAGE_URL)

### 4.1 Get Frame Image
**URL Pattern:** `{BASE_IMAGE_URL}/{path}{id}.webp`

**Example:** `http://14.225.217.119:8081/L01_V001/001234.webp`

---

## Data Types

### ClusterMode
```typescript
type ClusterMode = "timeline" | "location" | "moment" | "video";
```
**Note:** Currently fixed to `"moment"` in the frontend.

### SearchType (from miku classification)
```typescript
type SearchType = "TEXT" | "TEMPORAL" | "FILTER" | "IMAGE" | "NONE";
```

### TemporalQuery
```typescript
interface TemporalQuery {
  before: string | null;  // Scene description before the main event
  now: string | null;     // Main event being searched
  after: string | null;   // Scene description after the main event
}
```

### FilterQuery
```typescript
interface FilterQuery {
  ocr: string[];    // Text visible on screen (OCR detection)
  genre: string[];  // Video genre categories (horror, comedy, action, etc.)
}
```

### ImageItem
```typescript
interface ImageItem {
  id: string;           // Image identifier (e.g., "L01_V001/001234")
  path: string;         // Path prefix for image URL
  score?: number;       // Relevance score (0-1)
  time_in_seconds?: number;  // Timestamp in video
  name?: string;        // Display name
  videoId?: string;     // Video identifier
  videoName?: string;   // Video display name
  frameNumber?: number; // Frame number in video
  temporalPosition?: 'before' | 'now' | 'after';  // For temporal search
}
```

### ClusterResult
```typescript
interface ClusterResult {
  cluster_name: string;  // Cluster/scene name
  url: string | null;    // Optional cluster URL
  image_list: ImageItem[];  // Frames in this cluster
}
```

### SearchResponse
```typescript
interface SearchResponse {
  status: string;        // "success" | "error"
  state_id: string;      // State ID for follow-up searches
  mode: ClusterMode;     // Clustering mode used
  results: ClusterResult[];  // Search results
}
```
