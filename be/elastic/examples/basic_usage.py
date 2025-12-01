"""
Example usage of the refactored Elasticsearch module.
"""

import logging
from elastic import ElasticsearchClient, IndexManager, SearchEngine, QueryBuilder, DataIngestor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Demonstrate basic usage of the elastic module."""

    # 1. Connect to Elasticsearch
    print("1. Connecting to Elasticsearch...")
    client = ElasticsearchClient()
    es = client.connect()

    if not es:
        print("Failed to connect to Elasticsearch")
        return

    # 2. Create an index
    print("2. Creating index...")
    index_manager = IndexManager(es)
    success = index_manager.create_index(
        index_name="video_metadata",
        recreate=True  # Delete if exists
    )

    if success:
        print("Index created successfully")
    else:
        print("Failed to create index")
        return

    # 3. Example: Insert some sample data
    print("3. Inserting sample data...")
    from elastic.ingest import VideoMetadata

    sample_data = [
        VideoMetadata(
            id="video1/frame001",
            url="https://example.com/video1",
            date="2024-01-15 10:30:00",
            time_in_seconds=1.5,
            objects={"person": 2, "car": 1},
            ocr=["hello", "world"],
            subtitle="This is a sample subtitle"
        ),
        VideoMetadata(
            id="video1/frame002",
            url="https://example.com/video1",
            date="2024-01-15 10:30:00",
            time_in_seconds=2.0,
            objects={"person": 1, "dog": 1},
            ocr=["test", "text"],
            subtitle="Another subtitle example"
        )
    ]

    ingestor = DataIngestor(es)
    success = ingestor.ingest_documents("video_metadata", sample_data)

    if success:
        print("Sample data inserted successfully")
    else:
        print("Failed to insert sample data")
        return

    # Refresh index to make documents searchable
    index_manager.refresh_index("video_metadata")

    # 4. Example: Search for documents
    print("4. Searching documents...")
    search_engine = SearchEngine(es)

    # Simple search for all documents
    query_builder = QueryBuilder()
    query = query_builder.build()  # Empty query = match all

    results = search_engine.search("video_metadata", {"match_all": {}})
    print(f"Found {results['hits']['total']['value']} documents")

    # 5. Example: Complex search with filters
    print("5. Complex search example...")

    # Search for documents with person objects and containing specific OCR text
    complex_query = (QueryBuilder()
                    .object_count_filter("person", min_count=1)
                    .ocr_search(["hello"])
                    .build())

    results = search_engine.search("video_metadata", complex_query)
    print(f"Complex search found {results['hits']['total']['value']} documents")

    for hit in results['hits']['hits']:
        source = hit['_source']
        print(f"  - ID: {source['id']}, Objects: {source['objects']}")

    # 6. Example: Time-based search
    print("6. Time-based search example...")

    time_query = (QueryBuilder()
                 .time_range_filter(1.0, 2.5)
                 .build())

    results = search_engine.search("video_metadata", time_query)
    print(f"Time-based search found {results['hits']['total']['value']} documents")

    # 7. Get document count
    total_docs = search_engine.count_documents("video_metadata")
    print(f"Total documents in index: {total_docs}")

    print("Example completed successfully!")


if __name__ == "__main__":
    main()