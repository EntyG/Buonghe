import os
import json
import redis
from typing import Optional, Any
from redis.exceptions import RedisError
import logging

logger = logging.getLogger(__name__)

class RedisClient:
    """Redis client for caching search results and other data"""
    
    def __init__(self, redis_url: str | None = None):
        """Initialize Redis client"""
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self._client = None
        self._connect()
    
    def _connect(self):
        """Connect to Redis server"""
        try:
            self._client = redis.from_url(self.redis_url, decode_responses=True, socket_connect_timeout=5)
            # Test connection
            self._client.ping()
            logger.info("Successfully connected to Redis")
        except RedisError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._client = None
    
    def set(self, key: str, value: Any, expire: int = 3600) -> bool:
        """Set a value in Redis with optional expiration"""
        if not self._client:
            logger.warning("Redis client not available")
            return False
        
        try:
            # Serialize value to JSON if it's not a string
            if not isinstance(value, str):
                value = json.dumps(value, default=str)
            
            result = self._client.set(key, value, ex=expire)
            return bool(result)
        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"Error setting Redis key {key}: {e}")
            return False
    
    def get(self, key: str) -> Optional[Any]:
        """Get a value from Redis"""
        if not self._client:
            logger.warning("Redis client not available")
            return None
        
        try:
            value = self._client.get(key)
            if value is None:
                return None
            
            # Try to deserialize JSON
            try:
                return json.loads(str(value))
            except json.JSONDecodeError:
                return str(value)
        except RedisError as e:
            logger.error(f"Error getting Redis key {key}: {e}")
            return None
    
    def delete(self, key: str) -> bool:
        """Delete a key from Redis"""
        if not self._client:
            logger.warning("Redis client not available")
            return False
        
        try:
            result = self._client.delete(key)
            return bool(result)
        except RedisError as e:
            logger.error(f"Error deleting Redis key {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if a key exists in Redis"""
        if not self._client:
            return False
        
        try:
            result = self._client.exists(key)
            return bool(result)
        except RedisError as e:
            logger.error(f"Error checking Redis key {key}: {e}")
            return False
    
    def set_expiry(self, key: str, seconds: int) -> bool:
        """Set expiry for an existing key"""
        if not self._client:
            return False
        
        try:
            result = self._client.expire(key, seconds)
            return bool(result)
        except RedisError as e:
            logger.error(f"Error setting expiry for Redis key {key}: {e}")
            return False

# Create global Redis client instance
redis_client = RedisClient() 