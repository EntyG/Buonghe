"""
Configuration management for Elasticsearch indices and mappings.
"""

import json
import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Union


logger = logging.getLogger(__name__)


class ConfigurationError(Exception):
    """Custom exception for configuration-related errors."""
    pass


class ElasticsearchConfig:
    """
    Manages Elasticsearch index configurations and mappings.

    This class provides methods to create, load, and save Elasticsearch
    configurations with sensible defaults for video metadata use cases.
    """

    # Default field mappings for video metadata
    DEFAULT_METADATA_MAPPING = {
        "properties": {
            "id": {"type": "keyword"},
            "url": {"type": "text"},
            "date": {
                "type": "date",
                "format": "yyyy-MM-dd HH:mm:ss"
            },
            "time_in_seconds": {"type": "float"},
            "objects": {"type": "object"},
            "ocr": {"type": "text"},
            "subtitle": {"type": "text"}
        }
    }

    # Default index settings
    DEFAULT_METADATA_SETTINGS = {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "index": {
            "max_result_window": 800000
        }
    }

    # COCO dataset object classes (commonly used for object detection)
    DEFAULT_OBJECT_CLASSES = {
        "person": 0, "bicycle": 0, "car": 0, "motorcycle": 0, "airplane": 0,
        "bus": 0, "train": 0, "truck": 0, "boat": 0, "traffic light": 0,
        "fire hydrant": 0, "stop sign": 0, "parking meter": 0, "bench": 0,
        "bird": 0, "cat": 0, "dog": 0, "horse": 0, "sheep": 0, "cow": 0,
        "elephant": 0, "bear": 0, "zebra": 0, "giraffe": 0, "backpack": 0,
        "umbrella": 0, "handbag": 0, "tie": 0, "suitcase": 0, "frisbee": 0,
        "skis": 0, "snowboard": 0, "sports ball": 0, "kite": 0,
        "baseball bat": 0, "baseball glove": 0, "skateboard": 0,
        "surfboard": 0, "tennis racket": 0, "bottle": 0, "wine glass": 0,
        "cup": 0, "fork": 0, "knife": 0, "spoon": 0, "bowl": 0,
        "banana": 0, "apple": 0, "sandwich": 0, "orange": 0, "broccoli": 0,
        "carrot": 0, "hot dog": 0, "pizza": 0, "donut": 0, "cake": 0,
        "chair": 0, "couch": 0, "potted plant": 0, "bed": 0,
        "dining table": 0, "toilet": 0, "tv": 0, "laptop": 0, "mouse": 0,
        "remote": 0, "keyboard": 0, "cell phone": 0, "microwave": 0,
        "oven": 0, "toaster": 0, "sink": 0, "refrigerator": 0, "book": 0,
        "clock": 0, "vase": 0, "scissors": 0, "teddy bear": 0,
        "hair drier": 0, "toothbrush": 0
    }

    @classmethod
    def get_default_metadata_mapping(cls) -> Dict[str, Any]:
        """
        Get default mapping for video metadata index.

        Returns:
            Dictionary containing the default field mappings
        """
        return cls.DEFAULT_METADATA_MAPPING.copy()

    @classmethod
    def get_default_metadata_settings(cls) -> Dict[str, Any]:
        """
        Get default settings for video metadata index.

        Returns:
            Dictionary containing the default index settings
        """
        return cls.DEFAULT_METADATA_SETTINGS.copy()

    @classmethod
    def get_default_object_classes(cls) -> Dict[str, int]:
        """
        Get default object detection classes from COCO dataset.

        Returns:
            Dictionary mapping object class names to default counts (0)
        """
        return cls.DEFAULT_OBJECT_CLASSES.copy()

    @classmethod
    def load_config_from_file(cls, filepath: Union[str, Path]) -> Dict[str, Any]:
        """
        Load index configuration from JSON file.

        Args:
            filepath: Path to configuration file

        Returns:
            Configuration dictionary

        Raises:
            ConfigurationError: If file doesn't exist or contains invalid JSON
        """
        filepath = Path(filepath)

        if not filepath.exists():
            raise ConfigurationError(f"Configuration file not found: {filepath}")

        if not filepath.is_file():
            raise ConfigurationError(f"Path is not a file: {filepath}")

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                config = json.load(f)

            cls._validate_config_structure(config)
            logger.info(f"Successfully loaded configuration from {filepath}")
            return config

        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Invalid JSON in configuration file {filepath}: {e}")
        except Exception as e:
            raise ConfigurationError(f"Error reading configuration file {filepath}: {e}")

    @classmethod
    def save_config_to_file(cls, config: Dict[str, Any], filepath: Union[str, Path]) -> None:
        """
        Save configuration to JSON file.

        Args:
            config: Configuration dictionary
            filepath: Output file path

        Raises:
            ConfigurationError: If unable to save configuration
        """
        filepath = Path(filepath)

        try:
            # Validate configuration structure
            cls._validate_config_structure(config)

            # Ensure parent directory exists
            filepath.parent.mkdir(parents=True, exist_ok=True)

            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)

            logger.info(f"Successfully saved configuration to {filepath}")

        except Exception as e:
            raise ConfigurationError(f"Error saving configuration to {filepath}: {e}")

    @classmethod
    def create_index_config(
        cls,
        index_name: str,
        mappings: Optional[Dict[str, Any]] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create complete index configuration.

        Args:
            index_name: Name of the index
            mappings: Custom mappings (uses default if None)
            settings: Custom settings (uses default if None)

        Returns:
            Complete index configuration dictionary

        Raises:
            ConfigurationError: If index_name is invalid
        """
        if not index_name or not isinstance(index_name, str):
            raise ConfigurationError("Index name must be a non-empty string")

        config = {
            "name": index_name,
            "mappings": mappings or cls.get_default_metadata_mapping(),
            "settings": settings or cls.get_default_metadata_settings()
        }

        # Validate the created configuration
        cls._validate_config_structure(config)

        return config

    @classmethod
    def merge_configs(cls, base_config: Dict[str, Any], override_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge two configuration dictionaries.

        Args:
            base_config: Base configuration
            override_config: Configuration to merge (takes precedence)

        Returns:
            Merged configuration dictionary
        """
        merged = base_config.copy()

        for key, value in override_config.items():
            if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                merged[key] = cls.merge_configs(merged[key], value)
            else:
                merged[key] = value

        return merged

    @classmethod
    def _validate_config_structure(cls, config: Dict[str, Any]) -> None:
        """
        Validate configuration structure.

        Args:
            config: Configuration dictionary to validate

        Raises:
            ConfigurationError: If configuration structure is invalid
        """
        if not isinstance(config, dict):
            raise ConfigurationError("Configuration must be a dictionary")

        # Check for required keys in full index configuration
        if "name" in config:
            required_keys = ["name", "mappings", "settings"]
            missing_keys = [key for key in required_keys if key not in config]
            if missing_keys:
                raise ConfigurationError(f"Missing required configuration keys: {missing_keys}")

            # Validate mappings structure
            if "properties" not in config.get("mappings", {}):
                raise ConfigurationError("Mappings must contain 'properties' field")


# Convenience functions for backward compatibility
get_default_metadata_mapping = ElasticsearchConfig.get_default_metadata_mapping
get_default_metadata_settings = ElasticsearchConfig.get_default_metadata_settings
get_default_object_classes = ElasticsearchConfig.get_default_object_classes