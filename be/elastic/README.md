# Elasticsearch Video Metadata Module

A comprehensive, production-ready Elasticsearch integration for video metadata search and indexing. This module provides a clean, modular interface for managing video search functionality with support for OCR text, subtitles, object detection, and temporal queries.

## 🚀 Features

- **Production-Ready**: Robust error handling, logging, and connection management
- **Modular Design**: Separated concerns with dedicated modules for different functionality
- **Type Safety**: Full type hints and validation for better development experience
- **Configuration Management**: Flexible configuration with environment variables and JSON files
- **Advanced Search**: Rich query building with temporal, spatial, and content-based filters
- **Bulk Operations**: Efficient data ingestion with batch processing and progress tracking
- **Context Managers**: Support for `with` statements for automatic resource management
- **Comprehensive Testing**: Built-in examples and validation methods

## 📁 Module Structure

```
elastic/
├── __init__.py           # Package initialization and exports
├── client.py             # Elasticsearch connection management
├── config.py             # Configuration and mappings management
├── index.py              # Index management operations
├── search.py             # Search functionality and query building
├── ingest.py             # Data ingestion and processing
├── templates/            # Configuration templates
│   ├── index_config.json
│   └── object_classes.json
└── examples/             # Usage examples
    ├── basic_usage.py
    └── advanced_search.py
```

## 🔧 Installation & Setup

### 1. Dependencies

Install required packages:

```bash
pip install -r requirements.txt
```

Required packages:
- `elasticsearch>=8.0.0,<9.0.0`
- `python-dotenv>=0.19.0`
- `urllib3>=1.26.0`
- `tqdm>=4.62.0` (for progress bars)

### 2. Environment Configuration

Create a `.env` file in your project root:

```env
# Elasticsearch Configuration
ELASTIC_HOST=localhost
ELASTIC_PORT=9200
ELASTIC_USERNAME=elastic
ELASTIC_PASSWORD=your_password_here
ELASTIC_USE_SSL=true
ELASTIC_VERIFY_CERTS=false
ELASTIC_TIMEOUT=30
ELASTIC_MAX_RETRIES=3
ELASTIC_CA_CERT=/path/to/ca.cert  # Optional
```

### 3. Verify Connection

Test your connection:

```python
from elastic import ElasticsearchClient

# Test connection
client = ElasticsearchClient()
es = client.connect()

if es:
    print("✅ Connected to Elasticsearch successfully!")
else:
    print("❌ Failed to connect to Elasticsearch")
```

## 🏁 Quick Start

### Basic Usage Example

```python
from elastic import ElasticsearchClient, IndexManager, SearchEngine, QueryBuilder

# 1. Connect to Elasticsearch
client = ElasticsearchClient()
es = client.connect()

# 2. Create an index
index_manager = IndexManager(es)
success = index_manager.create_index("video_metadata", recreate=True)

# 3. Search documents
search_engine = SearchEngine(es)
query = QueryBuilder().ocr_search(["hello", "world"]).build()
results = search_engine.search("video_metadata", query)

print(f"Found {results['hits']['total']['value']} documents")
```

### Data Ingestion Example

```python
from elastic.ingest import DataIngestor, VideoMetadata

# Create sample data
metadata = VideoMetadata(
    id="video1/frame001",
    url="https://example.com/video1",
    date="2024-01-15 10:30:00",
    time_in_seconds=1.5,
    objects={"person": 2, "car": 1},
    ocr=["hello", "world"],
    subtitle="Sample subtitle text"
)

# Ingest data
ingestor = DataIngestor(es)
success = ingestor.ingest_documents("video_metadata", [metadata])
```

## 🔍 Advanced Search Capabilities

### 1. Complex Query Building

Use method chaining for complex queries:

```python
from elastic import QueryBuilder

query = (QueryBuilder()
         .multi_match("car accident", ["ocr", "subtitle"])
         .object_count_filter("car", min_count=2)
         .object_count_filter("person", min_count=1)
         .year_filter(2024)
         .time_range_filter(5.0, 60.0)
         .build())

results = search_engine.search("video_metadata", query)
```

### 2. Temporal Queries

Search by various time criteria:

```python
# Year and month filtering
query = QueryBuilder().year_filter(2024).month_filter("january").build()

# Day of week filtering
query = QueryBuilder().day_of_week_filter("monday").build()

# Season filtering
query = QueryBuilder().season_filter("winter").build()

# Time range filtering (seconds in video)
query = QueryBuilder().time_range_filter(0.0, 30.0).build()

# Date range filtering
query = QueryBuilder().date_range_filter(
    "2024-01-01 00:00:00",
    "2024-01-31 23:59:59"
).build()
```

### 3. Object Detection Queries

Filter by detected objects and their counts:

```python
# Find frames with multiple people and at least one car
query = (QueryBuilder()
         .object_count_filter("person", min_count=2, max_count=5)
         .object_count_filter("car", min_count=1)
         .build())
```

### 4. Content-Based Search

Search in OCR text and subtitles:

```python
# Search in OCR text
query = QueryBuilder().ocr_search(["traffic", "accident"]).build()

# Search in subtitles
query = QueryBuilder().subtitle_search(["breaking news"]).build()

# Combined content search
query = (QueryBuilder()
         .multi_match("car accident", ["ocr", "subtitle"])
         .build())
```

### 5. Similarity Search

Find similar documents:

```python
similar_docs = search_engine.suggest_similar(
    index_name="video_metadata",
    doc_id="some_document_id",
    size=10,
    fields=["ocr", "subtitle"]
)
```

## ⚙️ Configuration Management

### Default Configuration

The module provides sensible defaults:

```python
from elastic.config import ElasticsearchConfig

# Get default mappings
mappings = ElasticsearchConfig.get_default_metadata_mapping()

# Get default settings
settings = ElasticsearchConfig.get_default_metadata_settings()

# Get default object classes
objects = ElasticsearchConfig.get_default_object_classes()
```

### Custom Configuration

Load and save custom configurations:

```python
from elastic.config import ElasticsearchConfig

# Load from file
config = ElasticsearchConfig.load_config_from_file("custom_config.json")

# Create index with custom config
index_manager.create_index(
    "custom_index",
    mappings=config["mappings"],
    settings=config["settings"]
)

# Save configuration
ElasticsearchConfig.save_config_to_file(config, "saved_config.json")
```

### Configuration Merging

Merge configurations for flexibility:

```python
base_config = ElasticsearchConfig.get_default_metadata_mapping()
custom_config = {"properties": {"custom_field": {"type": "text"}}}

merged = ElasticsearchConfig.merge_configs(base_config, custom_config)
```

## 📊 Data Processing

The `DataIngestor` class handles various data processing tasks:

### Features

- **Date Standardization**: Converts various date formats to ISO format
- **Time Calculation**: Computes time in seconds from frame numbers
- **Text Cleaning**: Normalizes OCR and subtitle text
- **Subtitle Timing**: Matches subtitles to frame timestamps
- **Batch Processing**: Efficiently processes large datasets with progress tracking

### Bulk Ingestion

```python
from elastic.ingest import DataIngestor

ingestor = DataIngestor(es)

# Ingest from file structure
success = ingestor.ingest_video_metadata(
    index_name="video_metadata",
    metadata_path="/path/to/metadata",
    batch_size=1000,
    start_id=0
)

# Ingest document list
success = ingestor.ingest_documents(
    index_name="video_metadata",
    documents=video_metadata_list,
    batch_size=1000
)
```

## 🔒 Error Handling & Logging

### Built-in Error Handling

The module includes comprehensive error handling:

```python
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

# All operations include proper error handling
try:
    client = ElasticsearchClient()
    es = client.connect()
except ConnectionError as e:
    print(f"Connection failed: {e}")
```

### Custom Exceptions

The module defines specific exceptions:

- `ConnectionError`: Connection-related issues
- `ConfigurationError`: Configuration problems
- `IndexError`: Index operation failures

### Context Manager Support

Use context managers for automatic resource cleanup:

```python
# Automatic connection management
with ElasticsearchClient() as es:
    index_manager = IndexManager(es)
    # ... perform operations
# Connection automatically closed
```

## 🎯 Best Practices

### 1. Connection Management

```python
# ✅ Good: Use context managers
with ElasticsearchClient() as es:
    # Perform operations
    pass

# ✅ Good: Reuse connections
client = ElasticsearchClient()
es = client.get_client()
# Use es for multiple operations
client.close()
```

### 2. Index Management

```python
# ✅ Good: Check if index exists
if not index_manager.index_exists("my_index"):
    index_manager.create_index("my_index")

# ✅ Good: Refresh after bulk operations
ingestor.ingest_documents(index_name, documents)
index_manager.refresh_index(index_name)
```

### 3. Query Building

```python
# ✅ Good: Use method chaining
query = (QueryBuilder()
         .ocr_search(["term1", "term2"])
         .time_range_filter(0, 30)
         .build())

# ✅ Good: Reset and reuse query builders
builder = QueryBuilder()
query1 = builder.ocr_search(["hello"]).build()
query2 = builder.reset().subtitle_search(["world"]).build()
```

### 4. Batch Processing

```python
# ✅ Good: Use appropriate batch sizes
ingestor.ingest_documents(
    index_name="video_metadata",
    documents=large_dataset,
    batch_size=1000  # Adjust based on document size
)
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection Timeout**
   ```python
   # Check your ELASTIC_HOST and ELASTIC_PORT
   # Verify Elasticsearch is running
   curl -k https://localhost:9200
   ```

2. **Authentication Errors**
   ```python
   # Verify credentials in .env file
   # Check ELASTIC_USERNAME and ELASTIC_PASSWORD
   ```

3. **SSL Certificate Issues**
   ```python
   # For development, disable certificate verification
   ELASTIC_VERIFY_CERTS=false
   ```

4. **Index Already Exists**
   ```python
   # Use recreate=True to overwrite
   index_manager.create_index("my_index", recreate=True)
   ```

### Performance Optimization

1. **Batch Size Tuning**
   - Start with 1000 documents per batch
   - Adjust based on document size and memory

2. **Connection Pooling**
   - Reuse client connections
   - Use global client for multiple operations

3. **Index Settings**
   - Adjust shards and replicas based on cluster size
   - Increase `max_result_window` for large result sets

## 📚 API Reference

### Core Classes

- **`ElasticsearchClient`**: Connection management
- **`IndexManager`**: Index operations
- **`SearchEngine`**: Search functionality
- **`QueryBuilder`**: Query construction
- **`DataIngestor`**: Data ingestion
- **`ElasticsearchConfig`**: Configuration management

### Data Models

- **`VideoMetadata`**: Video metadata data class

For detailed API documentation, see the docstrings in each module.

## 🧪 Testing

Run the examples to test functionality:

```bash
# Basic usage test
python -m elastic.examples.basic_usage

# Advanced search test
python -m elastic.examples.advanced_search
```

## 📝 Migration from Legacy Code

The refactored module maintains backward compatibility while providing these improvements:

1. **Cleaner API**: More intuitive method names and organization
2. **Better Error Handling**: Comprehensive exception handling and logging
3. **Type Safety**: Full type hints for better IDE support
4. **Modularity**: Separated concerns for easier testing and maintenance
5. **Configuration**: Environment-based configuration instead of hardcoded values
6. **Performance**: Optimized connection management and batch processing

## 🤝 Contributing

When contributing to this module:

1. Follow the existing code style and patterns
2. Add comprehensive docstrings and type hints
3. Include proper error handling and logging
4. Write tests for new functionality
5. Update documentation as needed

## 📄 License

This module is part of the video metadata search system and follows the same licensing terms as the parent project.

---

For more examples and detailed usage patterns, see the `examples/` directory.