import os
import uuid
import json
import secrets
import asyncio
import aiohttp
import logging
import copy
from dataclasses import dataclass
from helpers.fusion import RRFFusion
from typing import List, Optional, Dict, Any
from models.base import GeneralResponse, Related, Cluster, Image, Mode, Filters
from models.search import SearchText, SearchTemporal, SearchFeedback
from helpers.redis_client import redis_client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KEYFRAMES_DIR = os.getenv("KEYFRAMES_DIR")
VIDEO_BASE_URL = os.getenv("VIDEO_BASE_URL")
ELASTIC_INDEX_NAME = os.getenv("DEFAULT_ELASTIC_INDEX_NAME")
DEFAULT_MILVUS_COLLECTION = os.getenv("DEFAULT_MILVUS_COLLECTION")
# Safely initialize ensemble collections with fallback
_ensemble_collections_env = os.getenv("ENSEMBLE_COLLECTIONS", "")
ENSEMBLE_COLLECTIONS = [c.strip() for c in _ensemble_collections_env.split(",") if c.strip()] if _ensemble_collections_env else []

@dataclass
class SearchConfig:
    """Configuration for search operations"""
    timeout: int = 30
    max_retries: int = 3
    cache_expire: int = 3600
    default_top_k: int = 1024
    batch_size: int = 100


class SearchServiceError(Exception):
    """Base exception for SearchService"""
    pass


class APIRequestError(SearchServiceError):
    """Raised when API requests fail"""
    pass


class CacheError(SearchServiceError):
    """Raised when cache operations fail"""
    pass


class APIClient:
    """HTTP client for API requests with connection pooling (async when available)"""
    
    def __init__(self, timeout: int = 30):
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=self.timeout)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def post(self, url: str, json_data: dict) -> dict:
        """Make async POST request with proper error handling"""
        if not self.session:
            raise APIRequestError("Session not initialized. Use as context manager.")
        try:
            async with self.session.post(url, json=json_data) as response:
                response.raise_for_status()
                return await response.json()
        except aiohttp.ClientError as e:
            logger.error(f"API request failed: {url} - {e}")
            raise APIRequestError(f"Request to {url} failed: {e}")
        except aiohttp.ClientResponseError as e:
            logger.error(f"HTTP error {e.status} for {url}: {e.message}")
            raise APIRequestError(f"HTTP {e.status} error for {url}: {e.message}")
        except Exception as e:
            logger.error(f"Unexpected error in API request: {url} - {e}")
            raise APIRequestError(f"Unexpected error: {e}")

class SearchService:
    """Service class handling search operations"""
    
    def __init__(self, db_url: str, config: Optional[SearchConfig] = None):
        if not db_url:
            raise ValueError("Database URL is required")
            
        self.db_url = db_url
        self.config = config or SearchConfig()
        self.milvus_endpoint = f"{self.db_url}/api/milvus/search"
        self.elastic_endpoint = f"{self.db_url}/api/elastic/search"
        self.related_timeline_endpoint = f"{self.db_url}/api/elastic/search/related_timelines"
        self.translation_endpoint = os.getenv("TRANSLATION_ENDPOINT")
        self.translation_model_id = os.getenv("TRANSLATION_MODEL_ID")
        self.fusion = RRFFusion()
    
    def cache_result(self, state_id: str, results: Any, expire: int = 3600):
        """Cache search result using state_id as key"""
        try:
            return redis_client.set(f"search_{state_id}", results, expire)
        except Exception as e:
            logger.error(f"Error caching result for state_id {state_id}: {e}")
            return False
        
    def get_cached_result(self, state_id: str):
        """Retrieve cached search result using state_id as key"""
        try:
            result = redis_client.get(f"search_{state_id}")
            return result
        except Exception as e:
            logger.error(f"Error retrieving cached result for state_id {state_id}: {e}")
            return None

    def delete_cached_result(self, state_id: str) -> bool:
        """Delete cached search result using state_id as key"""
        try:
            return redis_client.delete(f"search_{state_id}")
        except Exception as e:
            logger.error(f"Error deleting cached result: {e}")
            raise CacheError(f"Failed to delete cached result: {e}")
            
    async def _translate_text(self, text: str) -> str:
        """Translate text to English asynchronously"""
        assert self.translation_endpoint is not None, "Translate endpoint is not set"
        try:
            payload = {
                "messages": [
                    {"role": "user", "content": f"Translate the query into English: \"{text}\""}
                ],
                "model": self.translation_model_id,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "translate",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                            "translated_text": {
                                "type": "string",
                                "description": "The output text in English. No other text should be included."
                            }
                            },
                            "required": ["translated_text"]
                        }
                    }
                }
            }
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.config.timeout)) as session:
                async with session.post(self.translation_endpoint, json=payload) as response:
                    response.raise_for_status()
                    content_str = (await response.json())["choices"][0]["message"]["content"]
                    content_json = json.loads(content_str)
                    return content_json["translated_text"]
        except Exception as e:
            logger.error(f"Error translating text: {e}")
            return text

    async def _format_milvus_result(self, results: List[Any]) -> Dict[str, Any]:
        """Format Milvus results"""
        result_dict = {}
        for result in results:
            _, video_id, frame_id = result[0].split("/")
            result_dict[result[0]] = {
                "score": result[1],
                "url": result[2],
                "path": KEYFRAMES_DIR,
                "video_id": video_id,
                "frame_id": frame_id,
                "time_in_seconds": result[3]
            }
        return result_dict

    async def _text_search(self, request: SearchText) -> Dict[str, Dict[str, Any]]:
        """Perform semantic text search with optimized parallel processing"""

        result_dict = {}   

        if not request.text.strip():
            raise ValueError("Query cannot be empty")

        # Prepare payloads
        milvus_payload = {
            "request_id": "milvus_" + str(uuid.uuid4()),
            "collection_name": request.collection,
            "top_k": request.top_k,
            "query_data": {"text": [request.text]}
        }
        milvus_results = []

        try:
            # Get Milvus results first
            async with APIClient(timeout=self.config.timeout) as client:
                milvus_response = await client.post(self.milvus_endpoint, milvus_payload)
                milvus_results = milvus_response.get("result", {}).get("results", [])

            result_dict = await self._format_milvus_result(milvus_results)            
        except APIRequestError:
            # Re-raise API errors - they're already logged
            raise
        except Exception as e:
            logger.error(f"Unexpected error in text search: {e}", exc_info=True)
            return result_dict

        return result_dict
    
    async def text_search(self, request: SearchText) -> GeneralResponse:
        """Perform semantic text search with optimized parallel processing"""
        if not request.text.strip():
            raise ValueError("Query cannot be empty")

        state_id = request.state_id or self._generate_state_id()
        
        # Check cache first
        cached_results = self.get_cached_result(state_id)
        if cached_results:
            clusters = self.process_results(cached_results["results"], request.mode)
            translated_texts = cached_results["translated_texts"]
            return GeneralResponse(
                status="success",
                mode=request.mode,
                state_id=state_id,
                results=clusters,
                translated_texts=translated_texts
            )

        translated_texts = []

        if request.translate_mode:
            request.text = await self._translate_text(request.text)
            translated_texts.append(request.text)

        result_dict = {}

        if request.collection == "ensemble":
            result_dict = await self._ensemble_text_search(request)
        else:
            result_dict = await self._text_search(request)

        cached_results = {
            "temporal": False,
            "results": result_dict,

        }
        new_state_id = self._generate_state_id()
        self.cache_result(new_state_id, cached_results, expire=self.config.cache_expire)
            
        # Process results into clusters
        clusters = self.process_results(result_dict, request.mode)

        return GeneralResponse(
            status="success",
            mode=request.mode,
            state_id=new_state_id,
            results=clusters,
            translated_texts=translated_texts
        )

    async def _ensemble_text_search(self, request: SearchText) -> Dict[str, Dict[str, Any]]:
        """Perform ensemble text search with parallel processing"""
        if not ENSEMBLE_COLLECTIONS:
            logger.warning("No ensemble collections configured, falling back to default collection")
            return await self._text_search(request)
        
        async def search_collection(collection: str) -> Dict[str, Dict[str, Any]]:
            request_copy = copy.deepcopy(request)
            request_copy.collection = collection
            return await self._text_search(request_copy)
        
        # Run all collection searches in parallel
        results = await asyncio.gather(*[search_collection(c) for c in ENSEMBLE_COLLECTIONS])
        return self.fusion.fuse(results)

    def _create_temporal_clusters(self, result_dict: Dict[str, Dict[str, Any]]) -> List[Cluster]:
        """Create temporal clusters from validated results"""
        clusters = []

        for id, result in result_dict.items():
            _, video_id, frame_id = id.split("/")
            image_list = [
                Image(
                    id=result["now"]["id"],
                    path=KEYFRAMES_DIR,
                    name=result["now"]["id"],
                    time_in_seconds=result["now"]["time_in_seconds"],
                    score=result["score"]
                )
            ]

            if result["before"]:
                image_list.append(Image(
                    id=result["before"]["id"],
                    path=KEYFRAMES_DIR,
                    name=result["before"]["id"],
                    time_in_seconds=result["before"]["time_in_seconds"],
                    score=result["score"]
                ))

            if result["after"]:
                image_list.append(Image(
                    id=result["after"]["id"],
                    path=KEYFRAMES_DIR,
                    name=result["after"]["id"],
                    time_in_seconds=result["after"]["time_in_seconds"],
                    score=result["score"]
                ))

            clusters.append(Cluster(
                mode=Mode.VIDEO,
                cluster_name=id,
                image_list=image_list,
                url= result["now"]["url"]
            ))

        return clusters
    
    def process_results(self, result_dict: Dict[str, Dict[str, Any]], mode: Mode, temporal: bool = False) -> List[Cluster]:
        """Process search results into clusters"""
        if not result_dict:
            return []
        
        if temporal:
            return self._create_temporal_clusters(result_dict)

        if mode == Mode.MOMENT:
            return self._create_moment_clusters(result_dict)
        else:
            return self._create_video_clusters(result_dict, mode)
    
    def _create_moment_clusters(self, result_dict: Dict[str, Dict[str, Any]]) -> List[Cluster]:
        """Create moment clusters from validated results"""
        clusters = []

        for id, metadata in result_dict.items():
            image = Image(
                id=id,
                path=metadata["path"],
                name=id,
                time_in_seconds=metadata["time_in_seconds"],
                score=metadata["score"]
            )
            
            cluster = Cluster(
                mode=Mode.MOMENT,
                cluster_name=metadata["video_id"],
                url=metadata["url"],
                image_list=[image]
            )
            
            clusters.append(cluster)
        
        return clusters
    
    def _create_video_clusters(self, result_dict: Dict[str, Dict[str, Any]], mode: Mode) -> List[Cluster]:
        """Create video clusters from validated results"""
        video_groups = {}
        
        for id, metadata in result_dict.items():
            video_id = metadata["video_id"]
            time_in_seconds = metadata["time_in_seconds"]
            score = metadata["score"]

            if video_id not in video_groups:
                video_groups[video_id] = {
                    "images": [],
                    "url": metadata["url"]
                }
            
            image = Image(
                id=id,
                path=metadata["path"],
                name=id,
                time_in_seconds=time_in_seconds,
                score=score
            )
            
            video_groups[video_id]["images"].append(image)
        
        # Create clusters
        if mode == Mode.VIDEO:
            return [
                Cluster(
                    mode=mode,
                    cluster_name=video_id,
                    image_list=data["images"],
                    url=data["url"]
                )
                for video_id, data in video_groups.items()
            ]
        
        video_scores = {}
        for video_id, data in video_groups.items():
            video_scores[video_id] = {
                "score": sum(img.score for img in data["images"]) / len(data["images"]),
                "images": data["images"],
                "url": data["url"]
            }
        
        # Sort videos by average score (descending)
        sorted_videos = sorted(
            video_scores.items(), 
            key=lambda x: x[1]["score"], 
            reverse=True
        )

        return [
            Cluster(
                mode=mode,
                cluster_name=video_id,
                image_list=data["images"],
                url=data["url"]
            )
            for video_id, data in sorted_videos
        ]
        
    async def _visual_search(self, collection: str, text: str = None, base64_images: List[str] = []) -> Dict[str, Dict[str, Any]]:
        """Perform visual similarity search with optimized processing"""

        result_dict = {}

        if not text and not base64_images:
            logger.warning("No text or image provided for visual search")
            return []
        
        milvus_payload = {
            "request_id": "milvus_" + str(uuid.uuid4()),
            "collection_name": collection,
            "top_k": self.config.default_top_k,
            "query_data": {}
        }
        if text:
            milvus_payload["query_data"]["text"] = [text]

        if len(base64_images) > 0:
            milvus_payload["query_data"]["b64_image"] = base64_images

        milvus_results = []
        
        try:
            # Get Milvus results first
            async with APIClient(timeout=self.config.timeout) as client:
                milvus_response = await client.post(self.milvus_endpoint, milvus_payload)
                milvus_results = milvus_response.get("result", {}).get("results", [])

            result_dict = await self._format_milvus_result(milvus_results)

        except APIRequestError:
            # Re-raise API errors - they're already logged
            raise
        except Exception as e:
            logger.error(f"Unexpected error in visual search: {e}", exc_info=True)
            return result_dict

        return result_dict

    async def _ensemble_visual_search(self, collection: str, text: str = None, base64_images: List[str] = []) -> Dict[str, Dict[str, Any]]:
        """Perform ensemble visual search with parallel processing"""
        if not ENSEMBLE_COLLECTIONS:
            logger.warning("No ensemble collections configured, falling back to default collection")
            return await self._visual_search(collection or DEFAULT_MILVUS_COLLECTION, text, base64_images)
        
        # Run all collection searches in parallel
        results = await asyncio.gather(*[
            self._visual_search(c, text, base64_images) for c in ENSEMBLE_COLLECTIONS
        ])
        return self.fusion.fuse(results)
    
    async def visual_search(self, collection: str, mode: Mode, text: str = None, base64_images: List[str] = []) -> GeneralResponse:
        """Perform visual similarity search with optimized processing"""
        
        if collection == "ensemble":
            result_dict = await self._ensemble_visual_search(collection, text, base64_images)
        else:
            result_dict = await self._visual_search(collection, text, base64_images)

        cached_results = {
            "temporal": False,
            "results": result_dict
        }
        new_state_id = self._generate_state_id()
        self.cache_result(new_state_id, cached_results, expire=self.config.cache_expire)

        clusters = self.process_results(result_dict, mode)

        return GeneralResponse(
            status="success",
            mode=mode,
            state_id=new_state_id,
            results=clusters
        )
    
    async def related_search(self, mode: str, image_id: str, collection: str = DEFAULT_MILVUS_COLLECTION,
                           positive_feedback: List[str] = None, negative_feedback: List[str] = None,
                           positive_weight: float = 0.75, negative_weight: float = -0.15) -> Related:
        """Find related images with optimized processing and ensemble/relevance feedback support"""
        if not image_id:
            raise ValueError("Image ID is required")
        
        if mode not in ["timeline", "similar"]:
            raise ValueError(f"Invalid mode: {mode}. Must be 'timeline' or 'similar'")

        request_id = f"{mode}-{str(uuid.uuid4())}"
        clusters = []

        try:
            if mode == "timeline":
                clusters = await self._timeline_search(request_id, image_id)
            else:  # mode == "similar"
                clusters = await self._similar_search(
                    request_id, image_id, collection, 
                    positive_feedback, negative_feedback, positive_weight, negative_weight
                )

        except APIRequestError as e:
            logger.error(f"Related search ({mode}) failed: {e}")
            # Return empty results instead of failing completely
            clusters = []
        except Exception as e:
            logger.error(f"Unexpected error in related search ({mode}): {e}")
            clusters = []
            
        return Related(
            status="success",
            mode=mode,
            results=clusters,
            display_name=f"Related to {image_id} ({mode})"
        )

    async def _timeline_search(self, request_id: str, image_id: str) -> List[Cluster]:
        """Handle timeline-based related search"""
        payload = {
            "request_id": request_id,
            "index_name": ELASTIC_INDEX_NAME,
            "frame_id": image_id,
            "time_difference": 60
        }

        async with APIClient(timeout=self.config.timeout) as client:
            response = await client.post(self.related_timeline_endpoint, payload)
            elastic_results = response.get("result", {}).get("results", [])

        if not elastic_results:
            logger.warning(f"No timeline results found for image_id: {image_id}")
            return []
        
        clusters = []
        for result in elastic_results:
            _, video_id, frame_id = result["id"].split("/")
            
            image = Image(
                id=result["id"],
                path=KEYFRAMES_DIR,
                name=result["id"],
                time_in_seconds=result["time_in_seconds"],
                score=1.0
            )
            
            cluster = Cluster(
                mode=Mode.MOMENT,
                cluster_name=video_id,
                image_list=[image],
                url=result["url"]
            )
            clusters.append(cluster)

        return clusters

    async def _similar_search(self, request_id: str, image_id: str, collection: str = DEFAULT_MILVUS_COLLECTION, 
                             positive_feedback: List[str] = None, negative_feedback: List[str] = None,
                             positive_weight: float = 0.75, negative_weight: float = -0.15) -> List[Cluster]:
        """Handle similarity-based related search with ensemble and relevance feedback support"""

        if collection == "ensemble":
            result_dict = await self._ensemble_similar_search(request_id, image_id)
        else:
            result_dict = await self._single_similar_search(request_id, image_id, collection)

        if not result_dict:
            logger.warning(f"No similar results found for image_id: {image_id}")
            return []

        clusters = self.process_results(result_dict, Mode.MOMENT)
        return clusters

    async def _single_similar_search(self, request_id: str, image_id: str, collection: str) -> Dict[str, Dict[str, Any]]:
        """Handle single collection similarity search with relevance feedback"""

        # Prepare query data with relevance feedback
        query_data = {
            "ids": [image_id],
            "weights": [1.0]
        }

        milvus_payload = {
            "request_id": request_id,
            "collection_name": collection,
            "query_data": query_data,
            "top_k": self.config.default_top_k
        }

        # Get Milvus results
        async with APIClient(timeout=self.config.timeout) as client:
            milvus_response = await client.post(self.milvus_endpoint, milvus_payload)
            milvus_results = milvus_response.get("result", {}).get("results", [])

        if not milvus_results:
            return {}

        return await self._format_milvus_result(milvus_results)

    async def _ensemble_similar_search(self, request_id: str, image_id: str) -> Dict[str, Dict[str, Any]]:
        """Perform ensemble similar search across multiple collections with parallel processing"""
        if not ENSEMBLE_COLLECTIONS:
            logger.warning("No ensemble collections configured")
            return {}
        
        async def search_collection(collection: str) -> Dict[str, Dict[str, Any]]:
            collection_request_id = f"{request_id}_{collection}"
            return await self._single_similar_search(collection_request_id, image_id, collection)
        
        # Run all collection searches in parallel
        results = await asyncio.gather(*[search_collection(c) for c in ENSEMBLE_COLLECTIONS])
        return self.fusion.fuse(results)
    
    async def _single_relevance_feedback(self, request: SearchFeedback, collection: str) -> Dict[str, Dict[str, Any]]:
        """Apply relevance feedback to improve search results for a single collection"""

        positive = request.positive 
        negative = request.negative 

        positive_weights = [request.positive_weight] * len(positive)
        negative_weights = [request.negative_weight] * len(negative)

        ids = positive + negative
        weights = positive_weights + negative_weights

        # Prepare payloads
        milvus_payload = {
            "request_id": "milvus_" + request.state_id + "_" + collection,
            "collection_name": collection,
            "query_data": {
                "ids": ids,
                "weights": weights
            },
            "top_k": self.config.default_top_k
        }

        milvus_results = []

        try:
            # Get Milvus results
            async with APIClient(timeout=self.config.timeout) as client:
                milvus_response = await client.post(self.milvus_endpoint, milvus_payload)
                milvus_results = milvus_response.get("result", {}).get("results", [])

            if not milvus_results:
                logger.warning(f"No results from relevance feedback Milvus search for collection {collection}")
                return {}
        except APIRequestError:
            # Re-raise API errors - they're already logged
            raise
        except Exception as e:
            logger.error(f"Unexpected error in relevance feedback for collection {collection}: {e}", exc_info=True)
            return {}

        return await self._format_milvus_result(milvus_results)

    async def _ensemble_relevance_feedback(self, request: SearchFeedback) -> Dict[str, Dict[str, Any]]:
        """Perform ensemble relevance feedback across multiple collections with parallel processing"""
        if not ENSEMBLE_COLLECTIONS:
            logger.warning("No ensemble collections configured")
            return {}
        
        # Run all collection searches in parallel
        results = await asyncio.gather(*[
            self._single_relevance_feedback(request, c) for c in ENSEMBLE_COLLECTIONS
        ])
        return self.fusion.fuse(results)

    async def relevance_feedback(self, request: SearchFeedback) -> GeneralResponse:
        """Apply relevance feedback to improve search results with optimized processing"""

        if request.collection == "ensemble":
            result_dict = await self._ensemble_relevance_feedback(request)
        else:
            result_dict = await self._single_relevance_feedback(request, request.collection)

        if not result_dict:
            logger.warning("No results from relevance feedback search")
            return GeneralResponse(
                status="success",
                mode=request.mode,
                state_id=request.state_id,
                results=[]
            )

        cached_results = {
            "temporal": False,
            "results": result_dict
        }
        
        # Cache updated results
        new_state_id = self._generate_state_id()
        self.cache_result(new_state_id, cached_results, expire=self.config.cache_expire)

        # Process results into clusters
        clusters = self.process_results(result_dict, request.mode)

        return GeneralResponse(
            status="success",
            mode=request.mode,
            state_id=new_state_id,
            results=clusters
        )
    
    async def visual_temporal_search(self, request: SearchTemporal) -> GeneralResponse:
        """Perform temporal sequence search with parallel processing"""

        if not request.now:
            raise ValueError("Now event is required")
        
        state_id = self._generate_state_id()

        cached_results = self.get_cached_result(state_id)

        if cached_results:
            clusters = self.process_results(cached_results["results"], Mode.VIDEO, True)
            translated_texts = cached_results["translated_texts"]
            return GeneralResponse(
                status="success",
                mode=Mode.VIDEO,
                state_id=state_id,
                results=clusters,
                translated_texts=translated_texts
            )

        translated_texts = []
        if request.translate_mode:
            if request.now and request.now.text:
                request.now.text = await self._translate_text(request.now.text)
                translated_texts.append(request.now.text)
            if request.before and request.before.text:
                request.before.text = await self._translate_text(request.before.text)
                translated_texts.append(request.before.text)
            if request.after and request.after.text:
                request.after.text = await self._translate_text(request.after.text)
                translated_texts.append(request.after.text)

        # Prepare search tasks for parallel execution
        async def search_now():
            result = await self._visual_search(
                request.collection, 
                request.now.text, 
                [] if not request.now.image else [request.now.image]
            )
            if request.now.filters:
                result = await self.apply_filters(result, request.now.filters)
            return result

        async def search_before():
            if not request.before:
                return {}
            result = await self._visual_search(
                request.collection, 
                request.before.text, 
                [] if not request.before.image else [request.before.image]
            )
            if request.before.filters:
                result = await self.apply_filters(result, request.before.filters)
            return result

        async def search_after():
            if not request.after:
                return {}
            result = await self._visual_search(
                request.collection, 
                request.after.text, 
                [] if not request.after.image else [request.after.image]
            )
            if request.after.filters:
                result = await self.apply_filters(result, request.after.filters)
            return result

        # Execute searches in parallel where possible
        search_tasks = [search_now()]
        task_index = 1
        
        if request.before:
            search_tasks.append(search_before())
            before_idx = task_index
            task_index += 1
        else:
            before_idx = None
            
        if request.after:
            search_tasks.append(search_after())
            after_idx = task_index
        else:
            after_idx = None
        
        results = await asyncio.gather(*search_tasks)
        now_result_dict = results[0]
        before_result_dict = results[before_idx] if before_idx is not None else {}
        after_result_dict = results[after_idx] if after_idx is not None else {}
        
        final_result_dict = {}
        for idx, (now_id, now_result) in enumerate(now_result_dict.items()):
            _, video_id, frame_id = now_id.split("/")
            
            selected_before = None
            selected_before_id = None
            max_before_score = 0
            for before_id, before_result in before_result_dict.items():
                _, before_video_id, before_frame_id = before_id.split("/")
                if before_video_id == video_id and (0<= now_result["time_in_seconds"] - before_result["time_in_seconds"] <= request.time_interval):
                    if before_result["score"] > max_before_score:
                        selected_before = before_result
                        selected_before_id = before_id
                        max_before_score = before_result["score"]

            selected_after = None
            selected_after_id = None
            max_after_score = 0
            for after_id, after_result in after_result_dict.items():
                _, after_video_id, after_frame_id = after_id.split("/")
                if after_video_id == video_id and (0 <= after_result["time_in_seconds"] - now_result["time_in_seconds"] <= request.time_interval):
                    if after_result["score"] > max_after_score:
                        selected_after = after_result
                        selected_after_id = after_id
                        max_after_score = after_result["score"]
            

            final_result_dict[now_id] = {
                "now": {
                    "id": now_id,
                    "time_in_seconds": now_result["time_in_seconds"],
                    "score": now_result["score"],
                    "url": now_result["url"]
                },
                "before": None,
                "after": None,
            }
            if selected_before:
                final_result_dict[now_id]["before"] = {
                    "id": selected_before_id,
                    "time_in_seconds": selected_before["time_in_seconds"],
                    "score": selected_before["score"],
                    "url": selected_before["url"]
                }
            
            if selected_after:
                final_result_dict[now_id]["after"] = {
                    "id": selected_after_id,
                    "time_in_seconds": selected_after["time_in_seconds"],
                    "score": selected_after["score"],
                    "url": selected_after["url"]
                }

            # Calculate combined score safely
            combined_score = now_result["score"]
            if selected_before:
                combined_score += selected_before["score"]
            if selected_after:
                combined_score += selected_after["score"]
            final_result_dict[now_id]["score"] = combined_score
            
        sorted_result_dict = dict(sorted(final_result_dict.items(), key=lambda x: x[1]["score"], reverse=True))

        cached_results = {
            "temporal": True,
            "results": sorted_result_dict,
            "translated_texts": translated_texts
        }

        clusters = self.process_results(sorted_result_dict, Mode.VIDEO, True)

        new_state_id = self._generate_state_id()
        self.cache_result(new_state_id, cached_results, expire=self.config.cache_expire)

        # Create response
        result = GeneralResponse(
            mode=Mode.VIDEO,
            status="success",
            state_id=new_state_id,
            results=clusters,
            translated_texts=translated_texts
        )
        
        return result

    async def apply_filters(self, current_result_dict: Dict[str, Any], filters: Filters, top_k: int = 1024) -> Dict[str, Any]:
        """
        Apply filters to search results or start a new filtered search.
        
        Can filter by OCR text, subtitles, image IDs, or use combined filters.
        If text is provided, starts a new search on the entire dataset.
        """
        result_dict = {}

        payload = {
            "request_id": "filter_" + str(uuid.uuid4()),
            "index_name": ELASTIC_INDEX_NAME,
        }
        size = top_k
        ids = []

        if len(current_result_dict) > 0:
            ids = list(current_result_dict.keys())
            size = len(ids)

        if filters.ocr:
            payload["ocr_text"] = filters.ocr

        if filters.subtitle:
            payload["transcription_text"] = filters.subtitle

        if filters.description:
            payload["description_text"] = filters.description

        payload["size"] = size
        payload["_from"] = 0

        if len(ids) > 0:
            payload["query_data"] = {
                "ids": ids
            }
                    
        try:
            # Use async APIClient instead of synchronous requests
            async with APIClient(timeout=self.config.timeout) as client:
                response = await client.post(self.elastic_endpoint, payload)
                elastic_results = response.get("result", {}).get("results", [])
                
            logger.info(f"Applied filters successfully, found {len(elastic_results)} results")
            
        except APIRequestError as e:
            logger.error(f"API request failed in apply_filters: {e}")
            return result_dict
        except Exception as e:
            logger.error(f"Unexpected error in apply_filters: {e}")
            return result_dict

        result_dict = {}
        for result in elastic_results:
            id = result["id"]
            _, video_id, frame_id = id.split("/")
            score = result["_score"]
            result_dict[id] = {
                "video_id": video_id,
                "frame_id": frame_id,
                "path": KEYFRAMES_DIR,
                "url": result["url"],
                "time_in_seconds": result["time_in_seconds"],
                "score": score + current_result_dict.get(id, {}).get("score", 0)
            }

        return result_dict
    
    async def change_clustering_mode(self, state_id: str, new_mode: Mode) -> tuple[str, List[Cluster]]:
        """
        Change clustering mode for cached search results.
        
        Args:
            state_id: The current state ID containing cached results
            new_mode: The new clustering mode to apply
            
        Returns:
            tuple[str, List[Cluster]]: (new_state_id, processed_clusters)
            
        Raises:
            ValueError: If state_id is invalid or no cached results found
            TypeError: If new_mode is not a valid Mode enum
        """
        # Validate inputs
        if not state_id or not isinstance(state_id, str):
            raise ValueError("state_id must be a non-empty string")
        
        # Get cached results with better error handling
        cached_results = self.get_cached_result(state_id)
        if cached_results is None:
            raise ValueError(f"No cached results found for state_id: {state_id}")

        is_temporal = cached_results["temporal"]

        # Process results with new clustering mode
        clusters = self.process_results(cached_results["results"], new_mode, is_temporal)

        # Generate new state ID and cache results efficiently
        new_state_id = self._generate_state_id()
        self.cache_result(new_state_id, cached_results, expire=self.config.cache_expire)
        
        return new_state_id, clusters
    
    def _generate_state_id(self) -> str:
        """Generate a unique state ID"""
        return f"0x{secrets.token_hex(6)}"
    

# Create service instance with optimized configuration
search_service = SearchService(
    db_url=os.getenv("DB_URL", "http://localhost:8000"),
    config=SearchConfig(
        timeout=int(os.getenv("API_TIMEOUT", "30")),
        cache_expire=int(os.getenv("CACHE_EXPIRE", "3600")),
        default_top_k=int(os.getenv("DEFAULT_TOP_K", "1024"))
    )
)