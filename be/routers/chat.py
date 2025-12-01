import os
import aiohttp
import json
from typing import Any, Dict, List
import uuid
from fastapi import APIRouter, HTTPException, Query
from services.search_service import search_service


from models.base import GeneralResponse, Mode
from models.chat import (
    ChatFilter,
    ChatRephraseSuggestionRequest,
    ChatRephraseSuggestionResponse,
    ChatRephraseSearch
)

router = APIRouter(prefix="/chat", tags=["chat"])

URL = os.getenv("BASE_AI_URL")
MODEL_ID = os.getenv("CHAT_MODEL_ID")

@router.post("/filter", response_model=GeneralResponse)
async def filter_chat(request: ChatFilter):
    """
    Apply filters to search results or start a new filtered search.
    
    Can filter by OCR text, subtitles, image IDs, or use combined filters.
    If text is provided, starts a new search on the entire dataset.
    """
    try:
        state_id = request.state_id
        cached_result = search_service.get_cached_result(state_id)
        current_result_dict = {}
        if cached_result:
            current_result_dict = cached_result["results"]

        result_dict = await search_service.apply_filters(current_result_dict, request.filters, request.top_k)

        clusters = search_service.process_results(result_dict, request.mode)

        new_state_id = search_service._generate_state_id()
        cached_results = {
            "temporal": cached_result["temporal"] if cached_result else False,
            "results": result_dict
        }
        search_service.cache_result(new_state_id, cached_results)

        return GeneralResponse(
            status="success",
            mode=request.mode,
            state_id=new_state_id,
            results=clusters
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/restore", response_model=GeneralResponse)
async def restore_chat(
    mode: Mode = Query(...),
    state_id: str = Query(...)
):
    """
    Restore a previous search state.
    
    Retrieves the results and configuration from a previous search session.
    """
    try:    
        cached_result = search_service.get_cached_result(state_id)
        if cached_result:
            result_dict = cached_result["results"]
            clusters = search_service.process_results(result_dict, mode, cached_result["temporal"])
            return GeneralResponse(
                status="success",
                mode=mode,
                state_id=state_id,
                results=clusters
            )
        return GeneralResponse(
            status="success",
            mode=mode,
            state_id=state_id,
            results=[]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rephrase/suggestion", response_model=ChatRephraseSuggestionResponse)
async def rephrase_suggestion(request: ChatRephraseSuggestionRequest):
    """
    Generate alternative rephrasings of the provided text.

    Produces three optimized variations of the search query that 
    enhance clarity, structure, or retrieval performance 
    while preserving the original meaning.
    """

    SYSTEM_PROMPT = """
You are an assistant that refines search queries without changing their intent.

Generate **3 improved versions** of the input query that 
increase clarity, readability, or retrieval accuracy — but 
must not alter the original intent.
"""
    variants = []
    
    try:
        endpoint = URL + "/chat/completions"
        payload = {
            "model": MODEL_ID,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": request.text}
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "variants_response",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "variants": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        },
                        "required": ["variants"]
                    },
                    "strict": True
                }
            }
        }

        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(endpoint, json=payload) as response:
                response.raise_for_status()
                json_response = await response.json()
                variants = json.loads(
                    json_response["choices"][0]["message"]["content"]
                )["variants"]

    except Exception:
        pass

    return ChatRephraseSuggestionResponse(
        status="success",
        variants=variants,
        message_ref=request.message_ref
    )


@router.post("/rephrase/search", response_model=GeneralResponse)
async def rephrase_search(request: ChatRephraseSearch):
    """
    Perform a search with rephrased text.
    
    Takes the rephrased text and performs a new search operation.
    """
    try:
        # TODO: Implement actual rephrased search logic
        # This should work similarly to the text search but with preprocessing
        
        return GeneralResponse(
            status="success",
            mode=request.mode,
            state_id="rephrased_search_state_id",
            results=[]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))