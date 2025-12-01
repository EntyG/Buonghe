import uvicorn
from dotenv import load_dotenv


load_dotenv()

from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from routers import search, chat, settings, metadata

# Create FastAPI application
app = FastAPI(
    title="AI-Powered Image and Video Search API",
    version="0.1.0",
    description="Visionary - An enhanced system for intelligent image and video search with advanced filtering, temporal search, and conversational AI capabilities"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(settings.router)
app.include_router(metadata.router)


@app.get("/")
async def root():
    """Root endpoint providing API information"""
    return {
        "message": "AI-powered Image and Video Search API - Visionary",
        "version": "0.1.0",
        "endpoints": {
            "search": "/search/* - Various search operations",
            "chat": "/chat/* - Chat and conversation features",
            "settings": "/settings/* - Configuration management",
            "metadata": "/metadata - Image metadata queries",
            "docs": "/docs - Interactive API documentation",
            "openapi": "/openapi.json - OpenAPI specification"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "API is running"}

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8082,
        workers=1,
        reload=True
    )