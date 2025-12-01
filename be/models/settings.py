from typing import List, Optional
from pydantic import BaseModel, Field

from .base import Mode


class SettingsChangeCluster(BaseModel):
    """Model for changing cluster settings"""
    state_id: str = Field(..., description="The state id of a previous search")
    mode: Mode = Field(..., description="New cluster mode")
    
    class Config:
        json_schema_extra = {
            "example": {
                "state_id": "0x12321ca2fed",
                "mode": "video"
            }
        }


class MetadataQuery(BaseModel):
    """Model for metadata queries"""
    image_ids: List[str] = Field(..., description="List of image IDs to query metadata for")
    fields: Optional[List[str]] = Field(
        default=[], 
        description="Select fields, if fields is empty select all"
    ) 