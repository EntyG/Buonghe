import glob
import os
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Tuple, Dict, Any
import time
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime
import logging

load_dotenv()

DB_URL = os.getenv("DB_URL")
collection_name = os.getenv("DEFAULT_MILVUS_COLLECTION")

# Configuration
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "8"))  # Number of files per batch
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))  # Number of parallel workers
TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))  # Request timeout in seconds

description_dir = str(Path.home() / "storage" / "aic2025" / "metadata_merged")

# Error logging setup
def setup_error_logging():
    """Setup error logging to file and console."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    error_log_file = log_dir / f"milvus_insert_errors_{timestamp}.log"
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(error_log_file),
            logging.StreamHandler()  # Also log to console
        ]
    )
    
    return error_log_file

def log_error(error_type: str, file_path: str, error_message: str, additional_info: Dict = None):
    """Log error details to file."""
    error_data = {
        "timestamp": datetime.now().isoformat(),
        "error_type": error_type,
        "file_path": file_path,
        "error_message": error_message,
        "additional_info": additional_info or {}
    }
    
    logging.error(f"INSERT ERROR: {json.dumps(error_data, indent=2)}")


def load_file_data(file_path: str) -> Tuple[str, str, str]:
    """Load data from a single JSON file."""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
            frame_id = file_path.replace(description_dir, "").replace(".json", "")
            return frame_id, data["description"], file_path
    except FileNotFoundError as e:
        log_error("FILE_NOT_FOUND", file_path, str(e))
        return None, None, file_path
    except json.JSONDecodeError as e:
        log_error("JSON_DECODE_ERROR", file_path, str(e))
        return None, None, file_path
    except KeyError as e:
        log_error("MISSING_KEY", file_path, f"Missing required key: {e}")
        return None, None, file_path
    except Exception as e:
        log_error("UNKNOWN_ERROR", file_path, str(e))
        return None, None, file_path


def process_batch(batch_files: List[str]) -> Dict[str, Any]:
    """Process a batch of files and send them in a single request."""
    batch_data = []
    failed_files = []
    
    print(f"Processing batch of {len(batch_files)} files...")
    
    # Load all files in the batch
    for file_path in batch_files:
        frame_id, description, _ = load_file_data(file_path)
        if frame_id and description:
            batch_data.append((frame_id, description))
        else:
            failed_files.append(file_path)
    
    if not batch_data:
        logging.warning(f"Batch has no valid data. All {len(batch_files)} files failed to load.")
        return {
            "success": False,
            "processed": 0,
            "failed": failed_files,
            "error": "No valid data in batch"
        }
    
    # Send batch request
    payload = {
        "collection_name": collection_name,
        "data": batch_data
    }
        
    try:
        response = requests.post(
            f"{DB_URL}/api/insert", 
            json=payload, 
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            print(f"Successfully processed batch: {response.status_code}")
            return {
                "success": True,
                "processed": len(batch_data),
                "failed": failed_files,
                "response": response.json()
            }
        else:
            error_msg = f"HTTP {response.status_code}: {response.text}"
            logging.error(f"Batch request failed: {error_msg}")
            
            # Log each failed file in the batch
            for frame_id, _ in batch_data:
                log_error("HTTP_ERROR", frame_id, error_msg, {
                    "status_code": response.status_code,
                    "response_text": response.text
                })
            
            return {
                "success": False,
                "processed": 0,
                "failed": failed_files + [f[0] for f in batch_data],
                "error": error_msg
            }
            
    except requests.Timeout as e:
        error_msg = f"Request timeout: {e}"
        logging.error(f"Batch timeout: {error_msg}")
        
        # Log each failed file in the batch
        for frame_id, _ in batch_data:
            log_error("TIMEOUT_ERROR", frame_id, error_msg)
        
        return {
            "success": False,
            "processed": 0,
            "failed": failed_files + [f[0] for f in batch_data],
            "error": error_msg
        }
    except requests.ConnectionError as e:
        error_msg = f"Connection error: {e}"
        logging.error(f"Batch connection error: {error_msg}")
        
        # Log each failed file in the batch
        for frame_id, _ in batch_data:
            log_error("CONNECTION_ERROR", frame_id, error_msg)
        
        return {
            "success": False,
            "processed": 0,
            "failed": failed_files + [f[0] for f in batch_data],
            "error": error_msg
        }
    except requests.RequestException as e:
        error_msg = f"Request error: {e}"
        logging.error(f"Batch request error: {error_msg}")
        
        # Log each failed file in the batch
        for frame_id, _ in batch_data:
            log_error("REQUEST_ERROR", frame_id, error_msg)
        
        return {
            "success": False,
            "processed": 0,
            "failed": failed_files + [f[0] for f in batch_data],
            "error": error_msg
        }


def create_batches(files: List[str], batch_size: int) -> List[List[str]]:
    """Split files into batches of specified size."""
    batches = []
    for i in range(0, len(files), batch_size):
        batches.append(files[i:i + batch_size])
    return batches


def main():
    """Main function to orchestrate the parallel batch processing."""
    # Setup error logging
    error_log_file = setup_error_logging()
    logging.info(f"Starting Milvus insert process. Error log: {error_log_file}")
    
    # Get all JSON files
    all_json_files = glob.glob(f"{description_dir}/**/*.json", recursive=True)
    
    if not all_json_files:
        logging.error(f"No JSON files found in {description_dir}")
        return
    
    logging.info(f"Found {len(all_json_files)} JSON files")
    logging.info(f"Using {MAX_WORKERS} workers with batch size {BATCH_SIZE}")
    
    # Create batches
    batches = create_batches(all_json_files, BATCH_SIZE)
    logging.info(f"Created {len(batches)} batches")
    
    # Process batches in parallel
    start_time = time.time()
    total_processed = 0
    total_failed = []
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all batch processing tasks
        future_to_batch = {executor.submit(process_batch, batch): batch for batch in batches}
        
        # Process completed tasks
        for future in as_completed(future_to_batch):
            batch = future_to_batch[future]
            try:
                result = future.result()
                total_processed += result["processed"]
                total_failed.extend(result["failed"])
                
                if result["success"]:
                    logging.info(f"✓ Batch completed successfully: {result['processed']} files")
                else:
                    logging.error(f"✗ Batch failed: {result['error']}")
                    
            except Exception as e:
                logging.error(f"✗ Batch processing error: {e}")
                # Log each file in the failed batch
                for file_path in batch:
                    log_error("BATCH_PROCESSING_ERROR", file_path, str(e))
                total_failed.extend(batch)
    
    # Summary
    end_time = time.time()
    processing_time = end_time - start_time
    
    # Create summary report
    summary = {
        "timestamp": datetime.now().isoformat(),
        "total_files": len(all_json_files),
        "successfully_processed": total_processed,
        "failed_count": len(total_failed),
        "processing_time_seconds": processing_time,
        "average_time_per_file": processing_time/len(all_json_files),
        "error_log_file": str(error_log_file),
        "failed_files": total_failed
    }
    
    # Save summary to file
    summary_file = Path("logs") / f"milvus_insert_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print("\n" + "="*50)
    print("PROCESSING SUMMARY")
    print("="*50)
    print(f"Total files found: {len(all_json_files)}")
    print(f"Successfully processed: {total_processed}")
    print(f"Failed: {len(total_failed)}")
    print(f"Processing time: {processing_time:.2f} seconds")
    print(f"Average time per file: {processing_time/len(all_json_files):.3f} seconds")
    print(f"Error log file: {error_log_file}")
    print(f"Summary file: {summary_file}")
    
    if total_failed:
        print(f"\nFailed files (first 10):")
        for failed_file in total_failed[:10]:
            print(f"  - {failed_file}")
        if len(total_failed) > 10:
            print(f"  ... and {len(total_failed) - 10} more")
        print(f"\nCheck error log for detailed failure information: {error_log_file}")


if __name__ == "__main__":
    main()