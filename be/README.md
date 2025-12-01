# AI-Powered Image and Video Search API

A FastAPI-based backend service for intelligent image and video search with advanced filtering, temporal search, and conversational AI capabilities.

## Features

- 🔍 **Text-based Semantic Search**: Search images and videos using natural language descriptions
- 🖼️ **Visual Similarity Search**: Find similar images using uploaded images or URLs
- ⏰ **Temporal Search**: Search for sequences of events with before/now/after relationships
- 🎯 **Relevance Feedback**: Improve search results with positive/negative feedback
- 💬 **Chat Interface**: Conversational search with rephrase suggestions and filtering
- 🎨 **AI Image Generation**: Generate images from text prompts
- 📊 **Metadata Queries**: Retrieve detailed metadata for images and videos
- ⚙️ **Flexible Clustering**: Switch between different clustering modes (moment, video, video_avg)

## Project Structure

```
.
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── openapi.json           # OpenAPI specification
├── models/                # Pydantic data models
│   ├── __init__.py
│   ├── base.py           # Base models and enums
│   ├── search.py         # Search-related models
│   ├── chat.py           # Chat and conversation models
│   └── settings.py       # Settings and metadata models
├── routers/              # FastAPI route handlers
│   ├── __init__.py
│   ├── search.py         # Search endpoints
│   ├── chat.py           # Chat endpoints
│   ├── settings.py       # Settings endpoints
│   └── metadata.py       # Metadata endpoints
├── services/             # Business logic services
│   ├── __init__.py
│   └── search_service.py # Search service implementation
└── helpers/              # Utility functions
    ├── __init__.py
    └── embedding.py      # Embedding utilities
```

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd new-backend
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**:
   ```bash
   python main.py
   ```
   
   Or using uvicorn directly:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Access the API**:
   - API Docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc
   - OpenAPI Spec: http://localhost:8000/openapi.json

## API Endpoints

### Search Operations

#### Text Search
```http
POST /search/text
```
Semantic search using text queries with support for clustering modes and state continuity.

**Example Request**:
```json
{
  "mode": "moment",
  "text": "A man in white shirt",
  "state_id": "1c2d3e4f5a6b7c8d9e"
}
```

#### Visual Search
```http
POST /search/visual
```
Upload images or provide URLs for visual similarity search with optional text combination.

**Form Data**:
- `mode`: Clustering mode (moment/video/video_avg)
- `text`: Optional text to combine with images
- `urls`: Array of image URLs
- `files`: Uploaded image files

#### Related Images
```http
GET /search/related?mode=timeline&image_id=L01_V013/001234
```
Find related images using timeline or similarity mode.

#### Relevance Feedback
```http
POST /search/feedback
```
Improve search results by providing positive and negative examples.

**Example Request**:
```json
{
  "mode": "moment",
  "state_id": "0x12321ca2fed",
  "positive": ["L01_V013/001234", "L01_V013/001235"],
  "negative": ["L01_V013/001236"]
}
```

#### Temporal Search
```http
POST /search/temporal
```
Search for sequences of events with temporal relationships.

```http
POST /search/visual/temporal
```
Temporal search combining images and text descriptions.

### Chat Operations

#### Filter
```http
POST /chat/filter
```
Apply filters to search results or start new filtered searches.

#### Restore State
```http
GET /chat/restore?mode=moment&state_id=abc123
```
Restore a previous search state.

#### Rephrase Suggestions
```http
POST /chat/rephrase/suggestion
```
Generate alternative phrasings for search queries.

#### Rephrase Search
```http
POST /chat/rephrase/search
```
Perform search with rephrased text.

#### AI Image Generation
```http
POST /chat/imagine
```
Generate images from text prompts with fast/quality modes.

### Settings & Metadata

#### Change Clustering Mode
```http
POST /settings/change-cluster
```
Switch clustering mode for existing search results.

#### Get Metadata
```http
POST /metadata
```
Retrieve metadata for specified images with optional field filtering.

## Data Models

### Core Enums
- **Mode**: `moment` | `video` | `video_avg`

### Response Models
- **GeneralResponse**: Standard response with status, results, and state_id
- **Related**: Response for related image queries
- **ChatImagineResponse**: Response for AI image generation
- **ChatRephraseSuggestionResponse**: Response for rephrase suggestions

### Request Models
- **SearchText**: Text search requests
- **SearchTemporal**: Temporal search with before/now/after events
- **SearchFeedback**: Relevance feedback with positive/negative examples
- **ChatFilter**: Filter requests with various criteria
- **MetadataQuery**: Metadata requests with field selection

## Configuration

The API supports various configuration options:

### Clustering Modes
- **moment**: Single image clustering
- **video**: Group by video_id, sorted by max score
- **video_avg**: Group by video_id, sorted by average score

### Filter Types
- **OCR**: Filter by detected text in images
- **Subtitle**: Filter by subtitle text
- **IDs**: Filter by specific image IDs
- **All**: Combined filter for multiple criteria

## Development

### Adding New Endpoints
1. Define request/response models in appropriate `models/*.py` file
2. Implement business logic in `services/*.py`
3. Create route handlers in `routers/*.py`
4. Register router in `main.py`

### Testing
```bash
# Run tests
python -m pytest tests/

# Test specific endpoint
curl -X POST "http://localhost:8000/search/text" \
     -H "Content-Type: application/json" \
     -d '{"mode": "moment", "text": "test query"}'
```

## Production Deployment

### Environment Variables
```bash
# Set in production
CORS_ORIGINS=https://yourdomain.com
DEBUG=false
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url
```

### Docker Deployment
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.