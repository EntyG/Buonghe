import argparse
import glob
import json
import os
import re
import ssl
import string
import time
import unicodedata
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import RequestError
from elasticsearch.helpers import streaming_bulk
from loguru import logger

load_dotenv()

# Elasticsearch configuration
ES_HOST = os.getenv("ELASTIC_HOST", "localhost")
ES_PORT = int(os.getenv("ELASTIC_PORT", "9200"))
ES_USER = os.getenv("ELASTIC_USERNAME", "")
ES_PASSWORD = os.getenv("ELASTIC_PASSWORD", "")
ES_USE_SSL = os.getenv("ELASTIC_USE_SSL", "false").lower() == "true"
ES_VERIFY_CERTS = os.getenv("ELASTIC_VERIFY_CERTS", "false").lower() == "true"
ES_CA_CERTS = os.getenv("ELASTIC_CA_CERTS", "")

index_name = os.getenv("DEFAULT_ELASTIC_INDEX_NAME")

# Configuration
BATCH_SIZE = int(os.getenv("BATCH_SIZE", 32))  # Number of files per batch
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "8"))  # Number of parallel workers
TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))  # Request timeout in seconds
DEFAULT_FPS = int(os.getenv("DEFAULT_FPS", "25"))

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

VIDEO_BASE_URL = os.getenv("VIDEO_BASE_URL")
if not VIDEO_BASE_URL:
    logger.error("VIDEO_BASE_URL environment variable is not set!")
    raise ValueError("VIDEO_BASE_URL must be set in environment variables")

metadata_dir = str(Path.home() / "storage" / "aic2025" / "new-merged-metadata")

# Directory to write request payloads for debugging (created lazily when --save-json is used)
PAYLOADS_DIR = Path(__file__).parent / "payloads"

# File to save document IDs
DOCUMENT_IDS_FILE = Path(__file__).parent / "logs" / f"inserted_document_ids_{timestamp}.txt"

# Error logging setup
def setup_error_logging():
    """Setup error logging to file and console."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    error_log_file = log_dir / f"elastic_insert_errors_{timestamp}.log"

    # Configure loguru
    logger.remove()  # Remove default handler
    logger.add(
        error_log_file,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        level="INFO",
        rotation="1 day",
        retention="7 days"
    )
    logger.add(
        lambda msg: print(msg, end=""),  # Console output
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO"
    )

    return error_log_file

def setup_elasticsearch_client():
    """Setup Elasticsearch client with proper configuration."""
    try:
        # Build connection configuration
        scheme = "https" if ES_USE_SSL else "http"
        es_config = {
            'hosts': [f"{scheme}://{ES_HOST}:{ES_PORT}"],
            'request_timeout': TIMEOUT,
            'max_retries': 3,
            'retry_on_timeout': True
        }

        # Add authentication if provided
        if ES_USER and ES_PASSWORD:
            es_config['basic_auth'] = (ES_USER, ES_PASSWORD)

        # Add SSL configuration if needed
        if ES_USE_SSL:
            es_config['use_ssl'] = True
            es_config['verify_certs'] = ES_VERIFY_CERTS

            if ES_CA_CERTS:
                es_config['ca_certs'] = ES_CA_CERTS

            if not ES_VERIFY_CERTS:
                es_config['ssl_context'] = ssl.create_default_context()
                es_config['ssl_context'].check_hostname = False
                es_config['ssl_context'].verify_mode = ssl.CERT_NONE

        # Create Elasticsearch client
        logger.info(f"Attempting to connect to Elasticsearch with config: {es_config}")
        es_client = Elasticsearch(**es_config)

        # Test connection
        try:
            cluster_info = es_client.info()
            logger.info(f"Successfully connected to Elasticsearch at {ES_HOST}:{ES_PORT}")
            logger.info(f"Cluster info: {cluster_info['cluster_name']}")
            logger.info(f"Using index name: {index_name}")
        except Exception as ping_error:
            logger.error(f"Connection test failed: {ping_error}")
            raise ConnectionError(f"Could not connect to Elasticsearch: {ping_error}")

        return es_client

    except Exception as e:
        logger.error(f"Failed to setup Elasticsearch client: {e}")
        raise

def log_error(error_type: str, file_path: str, error_message: str, additional_info: dict[str, Any] | None = None):
    """Log error details to file."""
    error_data = {
        "timestamp": datetime.now().isoformat(),
        "error_type": error_type,
        "file_path": file_path,
        "error_message": error_message,
        "additional_info": additional_info or {}
    }

    logger.error(f"INSERT ERROR: {json.dumps(error_data, indent=2)}")


def preserve_unicode_text(text: str) -> str:
    """Clean and normalize text while preserving Vietnamese Unicode characters."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    punctuation = string.punctuation + '""''""' + '，。！？；：'
    text = text.translate(str.maketrans('', '', punctuation))
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def index_exists(es: Elasticsearch, index_name: str) -> bool:
    """Check if an index exists."""
    return es.indices.exists(index=index_name)


def create_index(
    es: Elasticsearch,
    index_name: str,
    mappings: dict[str, Any] | None = None,
    settings: dict[str, Any] | None = None,
    recreate: bool = False,
) -> bool:
    """Create an index with the given name, mappings, and settings."""
    if not index_name or not isinstance(index_name, str):
        raise ValueError("index_name must be a non-empty string")
    try:
        exists = index_exists(es, index_name)
        if exists:
            if recreate:
                es.indices.delete(index=index_name, ignore_unavailable=True)
            else:
                return False

        mappings = mappings or {
            "properties": {
                "id": {"type": "keyword"},
                "url": {"type": "text"},
                "time_in_seconds": {"type": "float"},
                "ocr": {"type": "text"},
                "transcription": {"type": "text"},
                "description": {"type": "text"},
                "fps": {"type": "integer"},
            }
        }

        settings = settings or {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "index": {"max_result_window": 800000},
        }

        resp = es.indices.create(index=index_name, mappings=mappings, settings=settings)
        return bool(resp.get("acknowledged"))
    except RequestError:
        return False
    except Exception:
        return False



def normalize_text_for_indexing(text: str) -> str:
    """Normalize text for indexing while preserving Vietnamese Unicode characters."""
    if not text:
        return ""
    return preserve_unicode_text(text)


def load_file_data(file_path: str) -> tuple[bool, dict[str, Any] | None]:
    """Load data from a single JSON file."""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
            frame_id = file_path.replace(metadata_dir, "").replace(".json", "")
            _, video_id, frame_number = frame_id.split("/")
            fps = data.get("fps", DEFAULT_FPS)
            unique_ocr = list(set(data.get("ocr", [])))
            normalized_ocr = [normalize_text_for_indexing(text) if isinstance(text, str) else text for text in unique_ocr]
            return True, {
                "fps": fps,
                "frame_id": frame_id,
                "video_id": video_id,
                "frame_number": int(frame_number),
                "ocr": normalized_ocr,
                "transcription": [normalize_text_for_indexing(text) if isinstance(text, str) else text for text in data.get("transcription", [])] if isinstance(data.get("transcription", []), list) else normalize_text_for_indexing(str(data.get("transcription", ""))),
                "description": data.get("description", ""),
            }
    except FileNotFoundError as e:
        log_error("FILE_NOT_FOUND", file_path, str(e))
        return False, None
    except json.JSONDecodeError as e:
        log_error("JSON_DECODE_ERROR", file_path, str(e))
        return False, None
    except KeyError as e:
        log_error("MISSING_KEY", file_path, f"Missing required key: {e}")
        return False, None
    except Exception as e:
        log_error("UNKNOWN_ERROR", file_path, str(e))
        return False, None

        return True, segments
    except FileNotFoundError as e:
        log_error("FILE_NOT_FOUND", file_path, str(e))
        return False, []
    except json.JSONDecodeError as e:
        log_error("JSON_DECODE_ERROR", file_path, str(e))
        return False, []
    except KeyError as e:
        log_error("MISSING_KEY", file_path, f"Missing required key: {e}")
        return False, []
    except Exception as e:
        log_error("UNKNOWN_ERROR", file_path, str(e))
        return False, []

def save_document_ids(doc_ids: list[str]):
    """Save document IDs to a text file."""
    try:
        with open(DOCUMENT_IDS_FILE, 'a') as f:
            for doc_id in doc_ids:
                f.write(f"{doc_id}\n")
        logger.info(f"Saved {len(doc_ids)} document IDs to {DOCUMENT_IDS_FILE}")
    except Exception as e:
        logger.error(f"Failed to save document IDs: {e}")


def process_batch(batch_files: list[str], es_client: Elasticsearch, save_json: bool) -> dict[str, Any]:
    """Process a batch of files and send them using Elasticsearch bulk API."""
    batch_data = []
    failed_files = []
    doc_ids = []

    logger.info(f"Processing batch of {len(batch_files)} files...")

    # Load all files in the batch
    for file_path in batch_files:
        success, data = load_file_data(file_path)
        if not success:
            failed_files.append(file_path)
            continue

        fps = data.get("fps", DEFAULT_FPS)
        doc_id = data["frame_id"]
        doc_ids.append(doc_id)
        # Construct proper video URL for frame metadata
        video_url = f"{VIDEO_BASE_URL}/{data['video_id']}.mp4"

        # Prepare document for Elasticsearch bulk API
        doc = {
            "_index": index_name,
            "_id": doc_id,
            "_source": {
                "fps": fps,
                "id": data["frame_id"],
                "ocr": [normalize_text_for_indexing(text) if isinstance(text, str) else text for text in data["ocr"]] if isinstance(data["ocr"], list) else normalize_text_for_indexing(str(data["ocr"])),
                "transcription": [normalize_text_for_indexing(text) if isinstance(text, str) else text for text in data["transcription"]] if isinstance(data["transcription"], list) else normalize_text_for_indexing(str(data["transcription"])),
                "time_in_seconds": data["frame_number"] / fps,
                "description": data["description"],
                "url": video_url,
            }
        }
        logger.info(doc)
        batch_data.append(doc)

    if not batch_data:
        logger.warning(f"Batch has no valid data. All {len(batch_files)} files failed to load.")
        return {
            "success": False,
            "processed": 0,
            "failed": failed_files,
            "error": "No valid data in batch",
            "doc_ids": []
        }

    # Optionally write payload to file for debugging
    if save_json:
        try:
            PAYLOADS_DIR.mkdir(parents=True, exist_ok=True)
            timestamp_debug = int(time.time())
            payload_file_path = PAYLOADS_DIR / (
                f"payload_{index_name}_{timestamp_debug}_{str(uuid.uuid4())}.json"
            )
            debug_payload = {
                "index_name": index_name,
                "documents": [doc["_source"] for doc in batch_data],
                "batch_size": len(batch_data)
            }
            with open(payload_file_path, "w", encoding="utf-8") as payload_file:
                json.dump(debug_payload, payload_file, indent=2, ensure_ascii=False)
            logger.info(f"Wrote payload to {payload_file_path}")
        except Exception as write_err:
            logger.error(f"Failed to write payload for debugging: {write_err}")

    try:
        logger.info(f"Sending batch to Elasticsearch using streaming_bulk API")

        success_count = 0
        failed_items: list[dict[str, Any]] = []
        successful_doc_ids: list[str] = []

        # Prefer streaming_bulk to get per-item results reliably
        for ok, item in streaming_bulk(
            es_client,
            batch_data,
            index=index_name,
            chunk_size=BATCH_SIZE,
            request_timeout=TIMEOUT,
            max_retries=3,
            initial_backoff=2,
            max_backoff=600
        ):
            try:
                action = next(iter(item))  # e.g., 'index'
                meta = item[action]
                status = meta.get('status', 0)
                _id = meta.get('_id', 'unknown')
            except Exception:
                status = 0
                _id = 'unknown'

            if ok and status in (200, 201):
                success_count += 1
                successful_doc_ids.append(_id)
            else:
                failed_items.append({"id": _id, "item": item})

        # Fallback: if streaming_bulk yielded nothing (unexpected), try client.bulk
        if success_count == 0 and not failed_items:
            logger.warning("streaming_bulk returned no results; falling back to client.bulk body")
            try:
                body_lines = []
                for d in batch_data:
                    body_lines.append(json.dumps({"index": {"_index": index_name, "_id": d["_id"]}}))
                    body_lines.append(json.dumps(d["_source"]))
                body = "\n".join(body_lines) + "\n"
                resp = es_client.bulk(body=body)
                if resp.get("errors"):
                    for it in resp.get("items", []):
                        meta = it.get("index", {})
                        if meta.get("status") in (200, 201):
                            success_count += 1
                            successful_doc_ids.append(meta.get("_id", "unknown"))
                        else:
                            failed_items.append(meta)
                else:
                    # Assume all succeeded
                    success_count = len(batch_data)
                    successful_doc_ids = [d["_id"] for d in batch_data]
            except Exception as e2:
                logger.error(f"Fallback client.bulk failed: {e2}")
                failed_items = [{"error": str(e2)}]

        # Persist successful IDs
        if successful_doc_ids:
            save_document_ids(successful_doc_ids)

        if failed_items:
            logger.error(f"Some documents failed to insert: {len(failed_items)} failures")
            for failed_item in failed_items[:10]:
                log_error("BULK_INSERT_ERROR", failed_item.get("id", "unknown"), json.dumps(failed_item)[:500])

        logger.info(f"Successfully processed batch: {success_count} documents inserted")
        return {
            "success": success_count > 0,
            "processed": success_count,
            "failed": failed_files + [it.get("id", "unknown") for it in failed_items],
            "doc_ids": successful_doc_ids,
            "bulk_errors": failed_items
        }

    except Exception as e:
        error_msg = f"Elasticsearch bulk insert error: {e}"
        logger.error(f"Batch request failed: {error_msg}")

        # Log each failed document in the batch
        for doc in batch_data:
            log_error("ELASTICSEARCH_ERROR", doc["_id"], error_msg)

        return {
            "success": False,
            "processed": 0,
            "failed": failed_files + [doc["_id"] for doc in batch_data],
            "error": error_msg,
            "doc_ids": []
        }

def create_batches(files: list[str], batch_size: int) -> list[list[str]]:
    """Split files into batches of specified size."""
    batches = []
    for i in range(0, len(files), batch_size):
        batches.append(files[i:i + batch_size])
    return batches

def main():
    """Main function to orchestrate the parallel batch processing."""
    parser = argparse.ArgumentParser(description="Insert batched documents into Elastic using direct client")
    parser.add_argument(
        "--save-json",
        action="store_true",
        help="Save each batch request payload to scripts/payloads/ for debugging",
    )
    args = parser.parse_args()
    save_json = args.save_json

    # Setup error logging
    error_log_file = setup_error_logging()
    logger.info(f"Starting Elasticsearch insert process. Error log: {error_log_file}")
    logger.info(f"Document IDs will be saved to: {DOCUMENT_IDS_FILE}")

    # Setup Elasticsearch client
    try:
        es_client = setup_elasticsearch_client()
    except Exception as e:
        logger.error(f"Failed to initialize Elasticsearch client: {e}")
        return

    # Ensure index exists with Vietnamese fuzzy search configuration
    try:
        if not index_exists(es_client, index_name):
            logger.info(f"Index '{index_name}' does not exist. Creating with Vietnamese fuzzy search configuration...")
            success = create_index(es_client, index_name)
            if success:
                logger.info(f"Successfully created index '{index_name}' with Vietnamese fuzzy search support")
            else:
                logger.error(f"Failed to create index '{index_name}'")
                return
        else:
            logger.info(f"Index '{index_name}' already exists")
    except Exception as e:
        logger.error(f"Failed to setup index: {e}")
        return

    all_processing_tasks = []

    # Prepare frame processing tasks
    frame_files = glob.glob(f"{metadata_dir}/**/*.json", recursive=True)
    # Exclude files ending with error.json
    frame_files = [file for file in frame_files if not file.endswith("error.json")]

    if frame_files:
        logger.info(f"Found {len(frame_files)} frame metadata files from {metadata_dir}")
        frame_batches = create_batches(frame_files, BATCH_SIZE)
        for batch in frame_batches:
            all_processing_tasks.append(("frames", batch, process_batch))
    else:
        logger.warning(f"No frame metadata files found in {metadata_dir}")

    if not all_processing_tasks:
        logger.error("No files found to process")
        return

    logger.info(f"Total processing tasks: {len(all_processing_tasks)}")
    logger.info(f"Using {MAX_WORKERS} workers with batch size {BATCH_SIZE}")

    # Initialize document IDs file
    try:
        DOCUMENT_IDS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(DOCUMENT_IDS_FILE, 'w') as f:
            f.write(f"# Document IDs inserted on {datetime.now().isoformat()}\n")
    except Exception as e:
        logger.error(f"Failed to initialize document IDs file: {e}")

    # Process batches in parallel
    start_time = time.time()
    total_processed = 0
    total_failed = []
    all_doc_ids = []

    # Separate statistics for each data type
    frames_processed = 0
    frames_failed = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all batch processing tasks
        future_to_task = {}
        for task_type, batch, process_function in all_processing_tasks:
            future = executor.submit(process_function, batch, es_client, save_json)
            future_to_task[future] = (task_type, batch)

        # Process completed tasks
        for future in as_completed(future_to_task):
            task_type, batch = future_to_task[future]
            try:
                result = future.result()
                total_processed += result["processed"]
                total_failed.extend(result["failed"])
                all_doc_ids.extend(result.get("doc_ids", []))

                # Track statistics by type
                if task_type == "frames":
                    frames_processed += result["processed"]
                    frames_failed.extend(result["failed"])

                if result["success"]:
                    logger.info(f"✓ {task_type.capitalize()} batch completed successfully: {result['processed']} documents")
                else:
                    logger.error(f"✗ {task_type.capitalize()} batch failed: {result['error']}")

            except Exception as e:
                logger.error(f"✗ {task_type.capitalize()} batch processing error: {e}")
                # Log each file in the failed batch
                for file_path in batch:
                    log_error("BATCH_PROCESSING_ERROR", file_path, str(e))
                total_failed.extend(batch)

                # Track failures by type
                if task_type == "frames":
                    frames_failed.extend(batch)

                with open(f"logs/{timestamp}_failed_payloads_{task_type}.json", "w") as f:
                    json.dump(batch, f, indent=4)

    # Summary
    end_time = time.time()
    processing_time = end_time - start_time

    # Calculate total files
    total_files = len(frame_files)

    # Create summary report
    summary = {
        "timestamp": datetime.now().isoformat(),
        "total_files": total_files,
        "successfully_processed": total_processed,
        "failed_count": len(total_failed),
        "processing_time_seconds": processing_time,
        "average_time_per_file": processing_time/total_files if total_files > 0 else 0,
        "error_log_file": str(error_log_file),
        "document_ids_file": str(DOCUMENT_IDS_FILE),
        "total_document_ids_saved": len(all_doc_ids),
        "failed_files": total_failed,
        "frames_statistics": {
            "processed": frames_processed,
            "failed_count": len(frames_failed),
            "failed_files": frames_failed
        }
    }

    # Save summary to file
    summary_file = Path("logs") / f"{timestamp}_elastic_insert_summary.json"
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)

    logger.info("\n" + "="*50)
    logger.info("PROCESSING SUMMARY")
    logger.info("="*50)
    logger.info(f"Total files found: {total_files}")
    logger.info(f"Successfully processed: {total_processed} documents")
    logger.info(f"Failed: {len(total_failed)}")

    logger.info(f"Processing time: {processing_time:.2f} seconds")
    if total_files > 0:
        logger.info(f"Average time per file: {processing_time/total_files:.3f} seconds")
    logger.info(f"Error log file: {error_log_file}")
    logger.info(f"Document IDs file: {DOCUMENT_IDS_FILE}")
    logger.info(f"Summary file: {summary_file}")

    if total_failed:
        logger.info(f"\nFailed files (first 10):")
        for failed_file in total_failed[:10]:
            logger.info(f"  - {failed_file}")
        if len(total_failed) > 10:
            logger.info(f"  ... and {len(total_failed) - 10} more")
        logger.info(f"\nCheck error log for detailed failure information: {error_log_file}")

if __name__ == "__main__":
    main()
