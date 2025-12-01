from typing import Any, Dict
from fastapi import APIRouter, HTTPException

from models.settings import MetadataQuery

router = APIRouter(tags=["metadata"])


@router.post("/metadata")
async def get_metadata(request: MetadataQuery) -> Dict[str, Any]:
    """
    Get metadata for specified images.
    
    Returns metadata fields for the requested image IDs.
    If no fields are specified, returns all available metadata.
    """
    try:
        # TODO: Implement actual metadata retrieval logic
        # Query the database/storage for metadata of the specified image IDs
        # Filter by requested fields if specified
        
        # Mock response structure
        metadata_response = {}
        
        for image_id in request.image_ids:
            # Mock metadata for each image
            image_metadata = {
                "id": image_id,
                "path": f"/path/to/{image_id}",
                "name": image_id,
                "time_in_seconds": 42.0,
                "video_id": image_id.split("/")[0] if "/" in image_id else None,
                "frame_number": 123,
                "width": 1920,
                "height": 1080,
                "format": "jpg",
                "size_bytes": 245760,
                "created_at": "2023-01-01T00:00:00Z",
                "ocr_text": ["Sample OCR text", "Another OCR result"],
                "subtitle_text": ["Sample subtitle", "Another subtitle"],
                "tags": ["tag1", "tag2", "tag3"],
                "embedding_vector": None  # Usually not returned due to size
            }
            
            # Filter by requested fields if specified
            if request.fields:
                filtered_metadata = {
                    field: image_metadata.get(field) 
                    for field in request.fields 
                    if field in image_metadata
                }
                metadata_response[image_id] = filtered_metadata
            else:
                metadata_response[image_id] = image_metadata
        
        return metadata_response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 