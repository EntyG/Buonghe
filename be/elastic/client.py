"""
Elasticsearch client connection management.
"""

import os
import logging
import urllib3
from typing import Optional, Dict, Any, Union
from elasticsearch import Elasticsearch
from dotenv import load_dotenv


class ConnectionError(Exception):
    """Custom exception for Elasticsearch connection errors."""
    pass


class ElasticsearchClient:
    """Manages Elasticsearch connection with configurable settings."""

    # Default configuration values
    DEFAULT_HOST = 'localhost'
    DEFAULT_PORT = '9200'
    DEFAULT_USERNAME = 'elastic'
    DEFAULT_PASSWORD = 'changeme'
    DEFAULT_TIMEOUT = 30
    DEFAULT_MAX_RETRIES = 3
    DEFAULT_USE_SSL = True
    DEFAULT_VERIFY_CERTS = False

    def __init__(self, env_file: Optional[str] = None):
        """
        Initialize Elasticsearch client.

        Args:
            env_file: Path to environment file. Defaults to '.env'

        Raises:
            ConnectionError: If required configuration is missing
        """
        self._load_environment(env_file)
        self.logger = logging.getLogger(__name__)
        self._client: Optional[Elasticsearch] = None
        self._config = self._build_config()

    def _load_environment(self, env_file: Optional[str]) -> None:
        """Load environment variables from file."""
        try:
            if env_file:
                load_dotenv(env_file)
            else:
                load_dotenv()
        except Exception as e:
            self.logger.warning(f"Failed to load environment file: {e}")

    def _build_config(self) -> Dict[str, Union[str, int, bool]]:
        """Build configuration from environment variables with defaults."""
        return {
            'host': os.getenv('ELASTIC_HOST', self.DEFAULT_HOST),
            'port': os.getenv('ELASTIC_PORT', self.DEFAULT_PORT),
            'ca_cert': os.getenv('ELASTIC_CA_CERT'),
            'username': os.getenv('ELASTIC_USERNAME', self.DEFAULT_USERNAME),
            'password': os.getenv('ELASTIC_PASSWORD', self.DEFAULT_PASSWORD),
            'timeout': int(os.getenv('ELASTIC_TIMEOUT', str(self.DEFAULT_TIMEOUT))),
            'max_retries': int(os.getenv('ELASTIC_MAX_RETRIES', str(self.DEFAULT_MAX_RETRIES))),
            'use_ssl': os.getenv('ELASTIC_USE_SSL', str(self.DEFAULT_USE_SSL)).lower() == 'true',
            'verify_certs': os.getenv('ELASTIC_VERIFY_CERTS', str(self.DEFAULT_VERIFY_CERTS)).lower() == 'true'
        }

    def _validate_config(self) -> None:
        """Validate required configuration parameters."""
        required_fields = ['host', 'port', 'username', 'password']
        missing_fields = [field for field in required_fields if not self._config.get(field)]

        if missing_fields:
            raise ConnectionError(f"Missing required Elasticsearch configuration: {', '.join(missing_fields)}")

    def _build_elasticsearch_url(self) -> str:
        """Build Elasticsearch URL from configuration."""
        protocol = "https" if self._config['use_ssl'] else "http"
        return f"{protocol}://{self._config['host']}:{self._config['port']}"

    def _build_connection_params(self, elasticsearch_url: str) -> Dict[str, Any]:
        """Build connection parameters for Elasticsearch client."""
        connection_params = {
            'hosts': [elasticsearch_url],
            'basic_auth': (self._config['username'], self._config['password']),
            'request_timeout': self._config['timeout'],
            'retry_on_timeout': True,
            'max_retries': self._config['max_retries']
        }

        # SSL configuration
        if self._config['use_ssl']:
            connection_params['verify_certs'] = self._config['verify_certs']

            # Add CA certificate if provided
            if self._config.get('ca_cert'):
                connection_params['ca_certs'] = self._config['ca_cert']

            # Disable SSL warnings for development
            if not self._config['verify_certs']:
                urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
                self.logger.warning("SSL certificate verification is disabled")

        return connection_params

    def _test_connection(self) -> bool:
        """Test the Elasticsearch connection."""
        try:
            info_result = self._client.info()
            self.logger.info(f"Elasticsearch cluster info: {info_result.get('cluster_name', 'unknown')}")
            return True
        except Exception as e:
            self.logger.error(f"Connection test failed: {e}")
            return False

    def connect(self) -> Optional[Elasticsearch]:
        """
        Create and return Elasticsearch connection.

        Returns:
            Elasticsearch client instance or None if connection fails

        Raises:
            ConnectionError: If configuration is invalid
        """
        try:
            self._validate_config()
            elasticsearch_url = self._build_elasticsearch_url()
            connection_params = self._build_connection_params(elasticsearch_url)

            # Log connection attempt (mask sensitive info)
            safe_params = {k: (v if k not in ['basic_auth'] else (v[0], '***'))
                          for k, v in connection_params.items()}
            self.logger.info(f"Connecting to Elasticsearch: {safe_params}")

            self._client = Elasticsearch(**connection_params)

            if self._test_connection():
                self.logger.info("Successfully connected to Elasticsearch")
                return self._client
            else:
                self._client = None
                return None

        except ConnectionError:
            # Re-raise configuration errors
            raise
        except Exception as e:
            self.logger.error(f"Elasticsearch connection error: {e}")
            return None

    def get_client(self) -> Optional[Elasticsearch]:
        """
        Get the current client instance or create a new connection.

        Returns:
            Elasticsearch client instance or None if connection fails
        """
        if self._client is None:
            return self.connect()
        return self._client

    def is_connected(self) -> bool:
        """
        Check if the client is currently connected.

        Returns:
            True if connected, False otherwise
        """
        if self._client is None:
            return False

        try:
            self._client.ping()
            return True
        except Exception:
            return False

    def close(self) -> None:
        """Close the Elasticsearch connection."""
        if self._client:
            try:
                self._client.close()
                self.logger.info("Elasticsearch connection closed")
            except Exception as e:
                self.logger.warning(f"Error closing connection: {e}")
            finally:
                self._client = None

    def __enter__(self):
        """Context manager entry."""
        client = self.connect()
        if not client:
            raise ConnectionError("Failed to establish Elasticsearch connection")
        return client

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


# Global client instance for convenience (thread-safe singleton pattern)
_global_client: Optional[ElasticsearchClient] = None


def get_elasticsearch_client() -> Optional[Elasticsearch]:
    """
    Get a global Elasticsearch client instance.

    Returns:
        Elasticsearch client instance or None if connection fails
    """
    global _global_client
    if _global_client is None:
        _global_client = ElasticsearchClient()
    return _global_client.get_client()


def reset_global_client() -> None:
    """Reset the global client instance (useful for testing)."""
    global _global_client
    if _global_client:
        _global_client.close()
    _global_client = None