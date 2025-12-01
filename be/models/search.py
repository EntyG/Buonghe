import os
from typing import List, Optional
from pydantic import BaseModel, Field
from models.base import Mode, TemporalEvent

DEFAULT_MILVUS_COLLECTION = os.getenv("DEFAULT_MILVUS_COLLECTION")

class SearchText(BaseModel):
    """Model for text-based search requests"""
    text: str = Field(..., description="Search text query")
    mode: Mode = Field(Mode.MOMENT, description="Cluster mode")
    collection: Optional[str] = Field(DEFAULT_MILVUS_COLLECTION, description="Collection name")
    state_id: Optional[str] = Field(None, description="The state id of a previous search. If state_id is specified, the search will continue from the state_id.")
    top_k: Optional[int] = Field(1024, description="Number of results to return")
    translate_mode: Optional[bool] = Field(True, description="Whether to translate the text query to English")


class SearchTemporal(BaseModel):
    """Model for temporal search requests"""
    collection: Optional[str] = Field(DEFAULT_MILVUS_COLLECTION, description="Collection name")
    now: Optional[TemporalEvent] = Field(None, description="Current event to search for")
    before: Optional[TemporalEvent] = Field(None, description="Event that should occur before")
    after: Optional[TemporalEvent] = Field(None, description="Event that should occur after")
    time_interval: Optional[int] = Field(60, description="Time interval in seconds between the events")
    translate_mode: Optional[bool] = Field(True, description="Whether to translate the text query to English")


class SearchFeedback(BaseModel):
    """Model for relevance feedback requests"""
    collection: Optional[str] = Field(DEFAULT_MILVUS_COLLECTION, description="Collection name")
    positive: List[str] = Field(default=[], description="List of image ids that are positive")
    negative: List[str] = Field(default=[], description="List of image ids that are negative")
    state_id: str = Field(..., description="The state id of a previous search")
    mode: Mode = Field(..., description="Cluster mode")
    positive_weight: float = Field(0.75, description="Weight for positive feedback")
    negative_weight: float = Field(-0.15, description="Weight for negative feedback")