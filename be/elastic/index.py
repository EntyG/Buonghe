"""
Elasticsearch index management operations.
"""

import logging
from typing import Dict, Any, Optional, List, Union
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import NotFoundError, RequestError, ConnectionError as ESConnectionError
from .client import get_elasticsearch_client
from .config import ElasticsearchConfig, ConfigurationError


logger = logging.getLogger(__name__)


class IndexError(Exception):
    """Custom exception for index-related errors."""
    pass


class IndexManager:
    """
    Manages Elasticsearch index operations.

    This class provides high-level methods for creating, deleting, and managing
    Elasticsearch indices with proper error handling and logging.
    """

    def __init__(self, client: Optional[Elasticsearch] = None):
        """
        Initialize IndexManager.

        Args:
            client: Elasticsearch client instance. Uses global client if None.

        Raises:
            IndexError: If unable to establish Elasticsearch connection
        """
        self.client = client or get_elasticsearch_client()
        self.logger = logging.getLogger(__name__)

        if not self.client:
            raise IndexError("Failed to establish Elasticsearch connection")

    def create_index(
        self,
        index_name: str,
        mappings: Optional[Dict[str, Any]] = None,
        settings: Optional[Dict[str, Any]] = None,
        recreate: bool = False
    ) -> bool:
        """
        Create an Elasticsearch index.

        Args:
            index_name: Name of the index to create
            mappings: Index mappings (uses default if None)
            settings: Index settings (uses default if None)
            recreate: Whether to delete existing index before creating

        Returns:
            True if successful, False otherwise

        Raises:
            IndexError: If index_name is invalid
        """
        if not self._validate_index_name(index_name):
            raise IndexError(f"Invalid index name: {index_name}")

        try:
            # Check if index exists and handle accordingly
            if self.index_exists(index_name):
                if recreate:
                    self.logger.info(f"Deleting existing index '{index_name}'")
                    if not self.delete_index(index_name):
                        return False
                else:
                    self.logger.warning(f"Index '{index_name}' already exists")
                    return False

            # Use default configurations if not provided
            if mappings is None:
                mappings = ElasticsearchConfig.get_default_metadata_mapping()
            if settings is None:
                settings = ElasticsearchConfig.get_default_metadata_settings()

            # Validate configurations
            self._validate_mappings(mappings)
            self._validate_settings(settings)

            # Create the index
            response = self.client.indices.create(
                index=index_name,
                mappings=mappings,
                settings=settings
            )

            if response.get('acknowledged'):
                self.logger.info(f"Successfully created index '{index_name}'")
                return True
            else:
                self.logger.error(f"Failed to create index '{index_name}': not acknowledged")
                return False

        except RequestError as e:
            self.logger.error(f"Request error creating index '{index_name}': {e}")
            return False
        except ESConnectionError as e:
            self.logger.error(f"Connection error creating index '{index_name}': {e}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error creating index '{index_name}': {e}")
            return False

    def delete_index(self, index_name: str) -> bool:
        """
        Delete an Elasticsearch index.

        Args:
            index_name: Name of the index to delete

        Returns:
            True if successful, False otherwise

        Raises:
            IndexError: If index_name is invalid
        """
        if not self._validate_index_name(index_name):
            raise IndexError(f"Invalid index name: {index_name}")

        try:
            if not self.index_exists(index_name):
                self.logger.warning(f"Index '{index_name}' does not exist")
                return False

            response = self.client.indices.delete(index=index_name)

            if response.get('acknowledged'):
                self.logger.info(f"Successfully deleted index '{index_name}'")
                return True
            else:
                self.logger.error(f"Failed to delete index '{index_name}': not acknowledged")
                return False

        except NotFoundError:
            self.logger.warning(f"Index '{index_name}' not found during deletion")
            return False
        except RequestError as e:
            self.logger.error(f"Request error deleting index '{index_name}': {e}")
            return False
        except ESConnectionError as e:
            self.logger.error(f"Connection error deleting index '{index_name}': {e}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error deleting index '{index_name}': {e}")
            return False

    def index_exists(self, index_name: str) -> bool:
        """
        Check if an index exists.

        Args:
            index_name: Name of the index to check

        Returns:
            True if index exists, False otherwise

        Raises:
            IndexError: If index_name is invalid
        """
        if not self._validate_index_name(index_name):
            raise IndexError(f"Invalid index name: {index_name}")

        try:
            return self.client.indices.exists(index=index_name)
        except ESConnectionError as e:
            self.logger.error(f"Connection error checking index '{index_name}': {e}")
            return False
        except Exception as e:
            self.logger.error(f"Error checking if index '{index_name}' exists: {e}")
            return False

    def get_index_info(self, index_name: str) -> Optional[Dict[str, Any]]:
        """
        Get information about an index.

        Args:
            index_name: Name of the index

        Returns:
            Index information dictionary or None if error

        Raises:
            IndexError: If index_name is invalid
        """
        if not self._validate_index_name(index_name):
            raise IndexError(f"Invalid index name: {index_name}")

        try:
            if not self.index_exists(index_name):
                self.logger.warning(f"Index '{index_name}' does not exist")
                return None

            return self.client.indices.get(index=index_name)

        except NotFoundError:
            self.logger.warning(f"Index '{index_name}' not found")
            return None
        except RequestError as e:
            self.logger.error(f"Request error getting info for index '{index_name}': {e}")
            return None
        except ESConnectionError as e:
            self.logger.error(f"Connection error getting info for index '{index_name}': {e}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error getting info for index '{index_name}': {e}")
            return None

    def get_index_mapping(self, index_name: str) -> Optional[Dict[str, Any]]:
        """
        Get mapping for an index.

        Args:
            index_name: Name of the index

        Returns:
            Index mapping dictionary or None if error

        Raises:
            IndexError: If index_name is invalid
        """
        if not self._validate_index_name(index_name):
            raise IndexError(f"Invalid index name: {index_name}")

        try:
            if not self.index_exists(index_name):
                self.logger.warning(f"Index '{index_name}' does not exist")
                return None

            return self.client.indices.get_mapping(index=index_name)

        except NotFoundError:
            self.logger.warning(f"Index '{index_name}' not found")
            return None
        except RequestError as e:
            self.logger.error(f"Request error getting mapping for index '{index_name}': {e}")
            return None
        except ESConnectionError as e:
            self.logger.error(f"Connection error getting mapping for index '{index_name}': {e}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error getting mapping for index '{index_name}': {e}")
            return None

    def update_index_settings(
        self,
        index_name: str,
        settings: Dict[str, Any]
    ) -> bool:
        """
        Update settings for an existing index.

        Args:
            index_name: Name of the index
            settings: New settings to apply

        Returns:
            True if successful, False otherwise

        Raises:
            IndexError: If index_name is invalid or settings are invalid
        """
        if not self._validate_index_name(index_name):
            raise IndexError(f"Invalid index name: {index_name}")

        if not settings or not isinstance(settings, dict):
            raise IndexError("Settings must be a non-empty dictionary")

        try:
            if not self.index_exists(index_name):
                self.logger.warning(f"Index '{index_name}' does not exist")
                return False

            response = self.client.indices.put_settings(
                index=index_name,
                settings=settings
            )

            if response.get('acknowledged'):
                self.logger.info(f"Successfully updated settings for index '{index_name}'")
                return True
            else:
                self.logger.error(f"Failed to update settings for index '{index_name}': not acknowledged")
                return False

        except RequestError as e:
            self.logger.error(f"Request error updating settings for index '{index_name}': {e}")
            return False
        except ESConnectionError as e:
            self.logger.error(f"Connection error updating settings for index '{index_name}': {e}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error updating settings for index '{index_name}': {e}")
            return False

    def refresh_index(self, index_name: str) -> bool:
        """
        Refresh an index to make recent changes searchable.

        Args:
            index_name: Name of the index to refresh

        Returns:
            True if successful, False otherwise

        Raises:
            IndexError: If index_name is invalid
        """
        if not self._validate_index_name(index_name):
            raise IndexError(f"Invalid index name: {index_name}")

        try:
            if not self.index_exists(index_name):
                self.logger.warning(f"Index '{index_name}' does not exist")
                return False

            self.client.indices.refresh(index=index_name)
            self.logger.debug(f"Refreshed index '{index_name}'")
            return True

        except NotFoundError:
            self.logger.warning(f"Index '{index_name}' not found during refresh")
            return False
        except RequestError as e:
            self.logger.error(f"Request error refreshing index '{index_name}': {e}")
            return False
        except ESConnectionError as e:
            self.logger.error(f"Connection error refreshing index '{index_name}': {e}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error refreshing index '{index_name}': {e}")
            return False

    def list_indices(self, pattern: Optional[str] = None) -> List[str]:
        """
        List all indices matching a pattern.

        Args:
            pattern: Optional pattern to match indices (e.g., "video_*")

        Returns:
            List of index names
        """
        try:
            if pattern:
                indices = self.client.indices.get(index=pattern)
            else:
                indices = self.client.indices.get(index="*")

            return list(indices.keys())

        except Exception as e:
            self.logger.error(f"Error listing indices: {e}")
            return []

    def get_index_stats(self, index_name: str) -> Optional[Dict[str, Any]]:
        """
        Get statistics for an index.

        Args:
            index_name: Name of the index

        Returns:
            Index statistics dictionary or None if error
        """
        if not self._validate_index_name(index_name):
            raise IndexError(f"Invalid index name: {index_name}")

        try:
            if not self.index_exists(index_name):
                self.logger.warning(f"Index '{index_name}' does not exist")
                return None

            return self.client.indices.stats(index=index_name)

        except Exception as e:
            self.logger.error(f"Error getting stats for index '{index_name}': {e}")
            return None

    def _validate_index_name(self, index_name: str) -> bool:
        """
        Validate index name according to Elasticsearch rules.

        Args:
            index_name: Name to validate

        Returns:
            True if valid, False otherwise
        """
        if not index_name or not isinstance(index_name, str):
            return False

        # Basic validation - Elasticsearch has specific rules
        if len(index_name) > 255:
            return False

        # Cannot start with -, _, or +
        if index_name.startswith(('-', '_', '+')):
            return False

        # Cannot contain certain characters
        invalid_chars = ['\\', '/', '*', '?', '"', '<', '>', '|', ' ', ',', '#']
        if any(char in index_name for char in invalid_chars):
            return False

        # Cannot be . or ..
        if index_name in ['.', '..']:
            return False

        return True

    def _validate_mappings(self, mappings: Dict[str, Any]) -> None:
        """
        Validate mappings structure.

        Args:
            mappings: Mappings to validate

        Raises:
            IndexError: If mappings are invalid
        """
        if not isinstance(mappings, dict):
            raise IndexError("Mappings must be a dictionary")

        if "properties" not in mappings:
            raise IndexError("Mappings must contain 'properties' field")

    def _validate_settings(self, settings: Dict[str, Any]) -> None:
        """
        Validate settings structure.

        Args:
            settings: Settings to validate

        Raises:
            IndexError: If settings are invalid
        """
        if not isinstance(settings, dict):
            raise IndexError("Settings must be a dictionary")