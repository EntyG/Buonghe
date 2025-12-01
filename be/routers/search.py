import os
import base64
from typing import List, Optional
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Query

from models.base import GeneralResponse, Related, Mode, TemporalEvent
from models.search import (
    SearchText, 
    SearchTemporal, 
    SearchFeedback
)
from services.search_service import search_service

DEFAULT_MILVUS_COLLECTION = os.getenv("DEFAULT_MILVUS_COLLECTION")

router = APIRouter(prefix="/search", tags=["search"])

@router.post("/text", response_model=GeneralResponse)
async def text_search(request: SearchText):
    """
    Semantic search using text query.
    
    Supports both moment and video clustering modes.
    Can continue from a previous search using state_id.
    """
    try:
        return await search_service.text_search(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/visual", response_model=GeneralResponse)
async def visual_search(
    collection: str = Form(default=DEFAULT_MILVUS_COLLECTION),
    mode: Mode = Form(...),
    text: Optional[str] = Form(default=None),
    files: List[UploadFile] = File(default=[])
):
    """
    Visual similarity search using uploaded images or image URLs.
    
    Can combine with text for multimodal search.
    Supports multiple files and URLs.
    """
    base64_images = []
    if files:
        # convert files to based and add to base64_image
        for file in files:
            if file.filename:
                try:
                    contents = await file.read()
                    base64_images.append(base64.b64encode(contents).decode("utf-8"))
                except Exception as e:
                    pass

    return await search_service.visual_search(
        collection=collection,
        mode=mode,
        text=text,
        base64_images=base64_images
    )


@router.get("/related", response_model=Related)
async def related_search(
    mode: str = Query(..., regex="^(timeline|similar)$"),
    image_id: str = Query(...),
    collection: str = Query(default=DEFAULT_MILVUS_COLLECTION, description="Collection name (use 'ensemble' for multi-collection search)")
):
    """
    Find related images using timeline or similarity mode.
    
    Timeline mode: finds images from the same temporal sequence
    Similar mode: finds visually similar images with ensemble support
    
    For similar mode:
    - Use collection="ensemble" for multi-collection search with fusion
    - Use specific collection name for single collection search
    """
    try:
        return await search_service.related_search(mode, image_id, collection)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback", response_model=GeneralResponse)
async def relevance_feedback(request: SearchFeedback):
    """
    Provide relevance feedback to improve search results.
    
    Uses positive and negative examples to refine the search.
    Requires a state_id from a previous search.
    """
    try:
        return await search_service.relevance_feedback(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/visual/temporal", response_model=GeneralResponse)
async def temporal_visual_search(
    req: str = Form(...),
    now_image: Optional[UploadFile] = File(None),
    before_image: Optional[UploadFile] = File(None),
    after_image: Optional[UploadFile] = File(None)
):
    """
    Temporal search combining images and text descriptions.
    
    Accepts up to 3 images (now, before, after) along with text descriptions.
    The req parameter should be a JSON string of SearchTemporal.
    """
    try:
        # Parse the JSON request
        try:
            temporal_request = SearchTemporal.model_validate_json(req)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON in req parameter: {str(e)}")
        
        if now_image:
            now_image = await now_image.read()
            now_image = base64.b64encode(now_image).decode("utf-8")
            if temporal_request.now:
                temporal_request.now.image = now_image
            else:
                temporal_request.now = TemporalEvent(image=now_image)
        if before_image:
            before_image = await before_image.read()
            before_image = base64.b64encode(before_image).decode("utf-8")
            if temporal_request.before:
                temporal_request.before.image = before_image
            else:
                temporal_request.before = TemporalEvent(image=before_image)
        if after_image:
            after_image = await after_image.read()
            after_image = base64.b64encode(after_image).decode("utf-8") 
            if temporal_request.after:
                temporal_request.after.image = after_image
            else:
                temporal_request.after = TemporalEvent(image=after_image)

        return await search_service.visual_temporal_search(temporal_request)        
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 