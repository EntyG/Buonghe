"""
Data ingestion functionality for Elasticsearch video metadata.
"""

import json
import os
import logging
import string
from typing import Dict, Any, List, Optional, Iterator
from dataclasses import dataclass
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from tqdm import tqdm
from .client import get_elasticsearch_client
from .config import ElasticsearchConfig


@dataclass
class VideoMetadata:
    """Data class for video metadata."""
    id: str
    url: str
    date: str
    time_in_seconds: float
    objects: Dict[str, int]
    ocr: List[str]
    subtitle: str
    fps: int = 25


class DataProcessor:
    """Processes raw data for Elasticsearch ingestion."""

    @staticmethod
    def standardize_date(date_str: str) -> str:
        """Convert date format to YYYY-MM-DD HH:mm:ss."""
        if len(date_str) >= 8:
            # Assuming format is DD/MM/YYYY or similar
            return f'{date_str[-4:]}-{date_str[-7:-5]}-{date_str[:2]} 00:00:00'
        return date_str

    @staticmethod
    def calculate_time_seconds(frame_id: str, fps: int) -> float:
        """Calculate time in seconds from frame ID."""
        try:
            frame_num = int(frame_id[-6:])
            return (frame_num * 1000) / fps
        except (ValueError, IndexError):
            return 0.0

    @staticmethod
    def clean_text(text: str) -> str:
        """Clean and normalize text content."""
        # Remove punctuation and normalize
        text = text.translate(str.maketrans('', '', string.punctuation))
        return text.strip().lower()

    @staticmethod
    def process_subtitle_timing(
        frame_id: str,
        fps: int,
        subtitles: List[Dict[str, Any]]
    ) -> str:
        """Find matching subtitle for frame timing."""
        if not subtitles:
            return ""

        frame_time = float(frame_id[-6:]) / fps

        # Sort subtitles by start time
        subtitles.sort(key=lambda x: x.get("start", 0))

        # Find matching subtitle
        for subtitle in subtitles:
            start = subtitle.get("start", 0)
            duration = subtitle.get("duration", 0)

            if start <= frame_time <= start + duration:
                text = subtitle.get("corrected_text", "")
                if not text.strip():
                    text = subtitle.get("text", "")
                return DataProcessor.clean_text(text)

        return ""


class DataIngestor:
    """Handles bulk data ingestion into Elasticsearch."""

    def __init__(self, client: Optional[Elasticsearch] = None):
        """
        Initialize DataIngestor.

        Args:
            client: Elasticsearch client instance. Uses global client if None.
        """
        self.client = client or get_elasticsearch_client()
        self.logger = logging.getLogger(__name__)
        self.processor = DataProcessor()

        if not self.client:
            raise ConnectionError("Failed to establish Elasticsearch connection")

    def ingest_video_metadata(
        self,
        index_name: str,
        metadata_path: str,
        batch_size: int = 1000,
        start_id: int = 0
    ) -> bool:
        """
        Ingest video metadata from file structure.

        Args:
            index_name: Target Elasticsearch index
            metadata_path: Path to metadata directory
            batch_size: Number of documents per batch
            start_id: Starting document ID

        Returns:
            True if successful, False otherwise
        """
        try:
            current_id = start_id

            for batch in self._generate_metadata_batches(metadata_path, batch_size, current_id):
                if batch:
                    success = self._bulk_insert(index_name, batch)
                    if not success:
                        return False
                    current_id += len(batch)

            self.logger.info(f"Successfully ingested metadata into index '{index_name}'")
            return True

        except Exception as e:
            self.logger.error(f"Metadata ingestion failed: {e}")
            return False

    def ingest_documents(
        self,
        index_name: str,
        documents: List[VideoMetadata],
        batch_size: int = 1000
    ) -> bool:
        """
        Ingest a list of VideoMetadata documents.

        Args:
            index_name: Target Elasticsearch index
            documents: List of VideoMetadata objects
            batch_size: Number of documents per batch

        Returns:
            True if successful, False otherwise
        """
        try:
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                elastic_docs = self._convert_to_elastic_format(index_name, batch, i)

                success = self._bulk_insert_raw(elastic_docs)
                if not success:
                    return False

            self.logger.info(f"Successfully ingested {len(documents)} documents")
            return True

        except Exception as e:
            self.logger.error(f"Document ingestion failed: {e}")
            return False

    def _generate_metadata_batches(
        self,
        metadata_path: str,
        batch_size: int,
        start_id: int
    ) -> Iterator[List[VideoMetadata]]:
        """Generate batches of metadata from file structure."""
        batch = []
        current_id = start_id

        if not os.path.exists(metadata_path):
            self.logger.error(f"Metadata path does not exist: {metadata_path}")
            return

        # Process metadata files
        for filename in os.listdir(metadata_path):
            if not filename.endswith('.json'):
                continue

            filepath = os.path.join(metadata_path, filename)
            video_metadata = self._process_video_file(filepath, current_id)

            if video_metadata:
                batch.extend(video_metadata)
                current_id += len(video_metadata)

                if len(batch) >= batch_size:
                    yield batch
                    batch = []

        if batch:
            yield batch

    def _process_video_file(self, filepath: str, start_id: int) -> List[VideoMetadata]:
        """Process a single video metadata file."""
        try:
            with open(filepath, 'r') as f:
                video_data = json.load(f)

            video_id = os.path.splitext(os.path.basename(filepath))[0]
            fps = video_data.get('fps', 25)
            url = video_data.get('watch_url', '')
            publish_date = video_data.get('publish_date', '')

            # Load subtitles if available
            subtitle_file = filepath.replace('metadata', 'subtitle')
            subtitles = []
            if os.path.exists(subtitle_file):
                with open(subtitle_file, 'r') as f:
                    subtitle_data = json.load(f)
                    subtitles = subtitle_data.get('sub', [])

            # Process frames
            metadata_list = []
            frame_dir = os.path.join(
                os.path.dirname(filepath).replace('metadata', 'frames'),
                video_id
            )

            if os.path.exists(frame_dir):
                for frame_file in sorted(os.listdir(frame_dir)):
                    if frame_file.endswith('.json'):
                        frame_metadata = self._process_frame(
                            frame_dir, frame_file, video_id, fps, url,
                            publish_date, subtitles
                        )
                        if frame_metadata:
                            metadata_list.append(frame_metadata)

            return metadata_list

        except Exception as e:
            self.logger.error(f"Error processing video file {filepath}: {e}")
            return []

    def _process_frame(
        self,
        frame_dir: str,
        frame_file: str,
        video_id: str,
        fps: int,
        url: str,
        publish_date: str,
        subtitles: List[Dict[str, Any]]
    ) -> Optional[VideoMetadata]:
        """Process a single frame's metadata."""
        try:
            frame_id = os.path.splitext(frame_file)[0]

            # Load OCR data
            ocr_file = os.path.join(frame_dir.replace('frames', 'ocr'), f"{frame_id}.json")
            ocr_data = []
            if os.path.exists(ocr_file):
                with open(ocr_file, 'r') as f:
                    ocr_data = [text.lower() for text in json.load(f)]

            # Load object detection data
            objects_file = os.path.join(frame_dir.replace('frames', 'objects'), f"{frame_id}.json")
            objects_data = ElasticsearchConfig.get_default_object_classes()
            if os.path.exists(objects_file):
                with open(objects_file, 'r') as f:
                    objects_data.update(json.load(f))

            # Process subtitle timing
            subtitle_text = self.processor.process_subtitle_timing(frame_id, fps, subtitles)

            return VideoMetadata(
                id=f"{video_id}/{frame_id}",
                url=url,
                date=self.processor.standardize_date(publish_date),
                time_in_seconds=self.processor.calculate_time_seconds(frame_id, fps),
                objects=objects_data,
                ocr=ocr_data,
                subtitle=subtitle_text,
                fps=fps
            )

        except Exception as e:
            self.logger.error(f"Error processing frame {frame_file}: {e}")
            return None

    def _convert_to_elastic_format(
        self,
        index_name: str,
        documents: List[VideoMetadata],
        start_id: int
    ) -> List[Dict[str, Any]]:
        """Convert VideoMetadata objects to Elasticsearch format."""
        elastic_docs = []

        for i, doc in enumerate(documents):
            elastic_docs.append({
                '_index': index_name,
                '_id': start_id + i,
                '_source': {
                    'id': doc.id,
                    'url': doc.url,
                    'date': doc.date,
                    'time_in_seconds': doc.time_in_seconds,
                    'objects': doc.objects,
                    'ocr': doc.ocr,
                    'subtitle': doc.subtitle
                }
            })

        return elastic_docs

    def _bulk_insert(self, index_name: str, documents: List[VideoMetadata]) -> bool:
        """Bulk insert VideoMetadata documents."""
        try:
            elastic_docs = self._convert_to_elastic_format(index_name, documents, 0)
            return self._bulk_insert_raw(elastic_docs)
        except Exception as e:
            self.logger.error(f"Bulk insert failed: {e}")
            return False

    def _bulk_insert_raw(self, documents: List[Dict[str, Any]]) -> bool:
        """Bulk insert raw Elasticsearch documents."""
        try:
            success_count, failed_docs = bulk(self.client, documents)

            if failed_docs:
                self.logger.warning(f"Failed to insert {len(failed_docs)} documents")
                for doc in failed_docs[:5]:  # Log first 5 failures
                    self.logger.error(f"Failed doc: {doc}")

            self.logger.info(f"Successfully inserted {success_count} documents")
            return len(failed_docs) == 0

        except Exception as e:
            self.logger.error(f"Bulk insert operation failed: {e}")
            return False