from typing import List, Optional
from pydantic import BaseModel, Field

from models.base import Mode, Filters


class ChatFilter(BaseModel):
    """Model for chat filter requests"""
    mode: Optional[Mode] = Field(None, description="Cluster mode")
    text: Optional[str] = Field(
        None, 
        description="If this field is specified. Start a new search on the entire dataset"
    )
    state_id: Optional[str] = Field(None, description="State ID from previous search")
    filters: Filters = Field(..., description="Filter criteria")
    top_k: Optional[int] = Field(1024, description="Number of results to return")


class ChatRephraseSuggestionRequest(BaseModel):
    """Model for rephrase suggestion requests"""
    text: str = Field(..., description="Text to rephrase")
    message_ref: str = Field(..., description="Reference to the original message")


class ChatRephraseSuggestionResponse(BaseModel):
    """Model for rephrase suggestion responses"""
    status: str = Field(..., description="Status of the operation")
    variants: List[str] = Field(..., description="List of rephrased variants")
    message_ref: str = Field(..., description="Reference to the original message")


class ChatRephraseSearch(BaseModel):
    """Model for rephrase search requests"""
    mode: Optional[Mode] = Field(None, description="Cluster mode")
    text: str = Field(..., description="Text to search with")


class ChatImagineRequest(BaseModel):
    """Model for imagine functionality requests"""
    fast: bool = Field(..., description="Whether to use fast generation")
    prompt: str = Field(..., description="Prompt for image generation")
    message_ref: str = Field(..., description="Reference to the message")


class ChatImagineResponse(BaseModel):
    """Model for imagine functionality responses"""
    status: str = Field(..., description="Status of the operation")
    image_urls: List[str] = Field(..., description="List of generated image URLs")
    message_ref: str = Field(..., description="Reference to the message") 