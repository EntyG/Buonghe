"""
Elasticsearch integration package for video metadata search and indexing.
"""

from .client import ElasticsearchClient
from .index import IndexManager
from .search import SearchEngine, QueryBuilder
from .ingest import DataIngestor

__version__ = "1.0.0"
__all__ = [
    "ElasticsearchClient",
    "IndexManager",
    "SearchEngine",
    "QueryBuilder",
    "DataIngestor"
]