"""
Advanced search examples using the QueryBuilder.
"""

import logging
from elastic import SearchEngine, QueryBuilder
from elastic.client import get_elasticsearch_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def demonstrate_advanced_search():
    """Show various advanced search patterns."""

    # Get Elasticsearch client
    es = get_elasticsearch_client()
    if not es:
        print("Failed to connect to Elasticsearch")
        return

    search_engine = SearchEngine(es)
    index_name = "video_metadata"  # Assuming this index exists

    print("=== Advanced Search Examples ===")

    # 1. Multi-field text search
    print("\n1. Multi-field text search:")
    query = (QueryBuilder()
            .multi_match("person walking", ["ocr", "subtitle"])
            .build())

    results = search_engine.search(index_name, query)
    print(f"Found {results['hits']['total']['value']} documents with 'person walking'")

    # 2. Object detection filters
    print("\n2. Object detection filters:")
    query = (QueryBuilder()
            .object_count_filter("person", min_count=2, max_count=5)
            .object_count_filter("car", min_count=1)
            .build())

    results = search_engine.search(index_name, query)
    print(f"Found {results['hits']['total']['value']} documents with 2-5 persons and ≥1 car")

    # 3. Time-based queries
    print("\n3. Time-based queries:")

    # Year filter
    query = (QueryBuilder()
            .year_filter(2024)
            .build())
    results = search_engine.search(index_name, query)
    print(f"Documents from 2024: {results['hits']['total']['value']}")

    # Month filter
    query = (QueryBuilder()
            .month_filter("january")
            .build())
    results = search_engine.search(index_name, query)
    print(f"Documents from January: {results['hits']['total']['value']}")

    # Day of week filter
    query = (QueryBuilder()
            .day_of_week_filter("monday")
            .build())
    results = search_engine.search(index_name, query)
    print(f"Documents from Monday: {results['hits']['total']['value']}")

    # Season filter
    query = (QueryBuilder()
            .season_filter("winter")
            .build())
    results = search_engine.search(index_name, query)
    print(f"Documents from winter: {results['hits']['total']['value']}")

    # 4. Combined filters
    print("\n4. Combined filters:")
    query = (QueryBuilder()
            .ocr_search(["hello", "world"])
            .subtitle_search(["example", "test"])
            .object_count_filter("person", min_count=1)
            .time_range_filter(0.0, 10.0)
            .build())

    results = search_engine.search(index_name, query)
    print(f"Combined filters found: {results['hits']['total']['value']} documents")

    # 5. Date range search
    print("\n5. Date range search:")
    query = (QueryBuilder()
            .date_range_filter("2024-01-01 00:00:00", "2024-01-31 23:59:59")
            .build())

    results = search_engine.search(index_name, query)
    print(f"Documents in January 2024: {results['hits']['total']['value']}")

    # 6. URL filtering
    print("\n6. URL filtering:")
    query = (QueryBuilder()
            .url_filter("https://example.com/video1")
            .build())

    results = search_engine.search(index_name, query)
    print(f"Documents from specific URL: {results['hits']['total']['value']}")

    # 7. Specific ID search
    print("\n7. Specific ID search:")
    query = (QueryBuilder()
            .id_filter(["video1/frame001", "video1/frame002"])
            .build())

    results = search_engine.search(index_name, query)
    print(f"Documents with specific IDs: {results['hits']['total']['value']}")

    # 8. Similar document search
    print("\n8. Similar document search:")
    if results['hits']['hits']:
        first_doc_id = results['hits']['hits'][0]['_id']
        similar_docs = search_engine.suggest_similar(
            index_name,
            first_doc_id,
            size=5
        )
        print(f"Found {len(similar_docs)} similar documents")

    # 9. Pagination example
    print("\n9. Pagination example:")
    query = {"match_all": {}}

    # First page
    page1 = search_engine.search(index_name, query, size=2, from_=0)
    print(f"Page 1: {len(page1['hits']['hits'])} documents")

    # Second page
    page2 = search_engine.search(index_name, query, size=2, from_=2)
    print(f"Page 2: {len(page2['hits']['hits'])} documents")

    # 10. Field selection
    print("\n10. Field selection:")
    query = {"match_all": {}}
    results = search_engine.search(
        index_name,
        query,
        source_fields=["id", "url", "objects"],
        size=1
    )

    if results['hits']['hits']:
        doc = results['hits']['hits'][0]['_source']
        print(f"Selected fields only: {list(doc.keys())}")


def demonstrate_query_builder_chaining():
    """Show QueryBuilder method chaining."""

    print("\n=== QueryBuilder Chaining Examples ===")

    # Complex chained query
    query = (QueryBuilder()
             .multi_match("car accident", ["ocr", "subtitle"])
             .object_count_filter("car", min_count=2)
             .object_count_filter("person", min_count=1)
             .year_filter(2024)
             .time_range_filter(5.0, 60.0)
             .build())

    print("Built complex query with chaining:")
    import json
    print(json.dumps(query, indent=2))

    # Query reset and reuse
    builder = QueryBuilder()

    # First query
    query1 = builder.ocr_search(["hello"]).build()
    print(f"\nFirst query: {query1}")

    # Reset and build different query
    query2 = builder.reset().subtitle_search(["world"]).build()
    print(f"Reset query: {query2}")


if __name__ == "__main__":
    demonstrate_advanced_search()
    demonstrate_query_builder_chaining()