import aiohttp
import logging
from helpers.redis_client import redis_client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SubmitService:
    def __init__(self):
        pass