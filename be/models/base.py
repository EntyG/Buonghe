from enum import Enum
from typing import List, Optional, Union
from pydantic import BaseModel, Field


class Mode(str, Enum):
    """Cluster mode enum"""
    MOMENT = "moment"
    VIDEO = "video"
    VIDEO_AVG = "video_avg"
    TEMPORAL = "temporal"

class Image(BaseModel):
    """Image model representing a single image"""
    id: str = Field(..., description="Unique identifier for the image")
    path: str = Field(..., description="Path to the image")
    name: Optional[str] = Field(None, description="Name of the image")
    time_in_seconds: Optional[float] = Field(0.0, description="Time in seconds within the video")
    score: Optional[float] = Field(0.0, description="Score of the image")

class Cluster(BaseModel):
    """Cluster model representing a group of related images"""
    mode: Optional[Mode] = Field(None, description="Cluster mode")
    image_list: List[Image] = Field(..., description="List of images in this cluster")
    cluster_name: Optional[str] = Field(None, description="Name of the cluster")
    url: Optional[str] = Field(None, description="Video URL if applicable")

class Filters(BaseModel):
    """Filter options for search queries"""
    ocr: Optional[List[str]] = Field(default=[], description="List of OCR text")
    subtitle: Optional[List[str]] = Field(default=[], description="List of subtitle text")
    description: Optional[List[str]] = Field(default=[], description="List of description text")

class TemporalEvent(BaseModel):
    """Temporal event for temporal search"""
    text: Optional[str] = Field(None, description="Text description of the event")
    image: Optional[str] = Field(None, description="Image base64 string of the event")
    filters: Optional[Filters] = Field(None, description="Filters for the event")


class GeneralResponse(BaseModel):
    """Standard response model for most endpoints"""
    status: str = Field(..., description="Status of the operation (success if successful, error description if failed)")
    mode: Optional[Mode] = Field(None, description="Cluster mode used")
    results: Optional[List[Cluster]] = Field(None, description="Search results")
    state_id: Optional[str] = Field(None, description="State ID using UUIDv4 format")
    translated_texts: List[str] = Field([], description="Translated text")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "success",
                "state_id": "0x12321ca2fed",
                "mode": "video",
                "results": [
                    {
                        "cluster_name": "L01_V013",
                        "url": "https://youtube.com/xyaz",
                        "image_list": [
                            {
                                "id": "L01_V013/001234",
                                "path": "L01/",
                                "name": "L01_V013/001234",
                                "time_in_seconds": 25.0
                            }
                        ]
                    }
                ]
            }
        }


class Related(BaseModel):
    """Response model for related images"""
    status: str = Field(..., description="Status of the operation")
    mode: Optional[str] = Field(None, description="Mode used for the search")
    results: Optional[List[Cluster]] = Field(None, description="Related images results")
    display_name: Optional[str] = Field(None, description="Display name for the results") 