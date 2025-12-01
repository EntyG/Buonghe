"""
Elasticsearch search functionality with query building capabilities.
"""

import logging
from typing import Dict, Any, List, Optional, Union
from elasticsearch import Elasticsearch
from .client import get_elasticsearch_client


class QueryBuilder:
    """Builds Elasticsearch queries for video metadata search."""

    # Time constants
    MONTH_NUMBER = {
        'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
        'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6,
        'jul': 7, 'july': 7, 'aug': 8, 'august': 8,
        'sep': 9, 'sept': 9, 'september': 9, 'oct': 10, 'october': 10,
        'nov': 11, 'november': 11, 'dec': 12, 'december': 12,
    }

    DAY_OF_WEEK_NUMBER = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6, 'sunday': 7,
        'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4,
        'fri': 5, 'sat': 6, 'sun': 7
    }

    SEASONS = {
        'spring': [2, 4], 'summer': [5, 7],
        'fall': [8, 10], 'winter': [11, 1]
    }

    def __init__(self):
        """Initialize QueryBuilder with empty query structure."""
        self.query = {'bool': {'must': [], 'should': [], 'filter': []}}

    def reset(self) -> 'QueryBuilder':
        """Reset the query to empty state."""
        self.query = {'bool': {'must': [], 'should': [], 'filter': []}}
        return self

    def multi_match(self, text: str, fields: List[str], operator: str = 'and') -> 'QueryBuilder':
        """
        Add multi-match query for text across multiple fields.

        Args:
            text: Text to search for
            fields: List of fields to search in
            operator: 'and' or 'or' operator for multiple terms
        """
        self.query['bool']['must'].append({
            'multi_match': {
                'query': text,
                'fields': fields,
                'operator': operator
            }
        })
        return self

    def match_phrase(self, field: str, value: str) -> 'QueryBuilder':
        """Add exact phrase match for a field."""
        self.query['bool']['filter'].append({
            'match_phrase': {field: value}
        })
        return self

    def term_filter(self, field: str, value: Union[str, int, float]) -> 'QueryBuilder':
        """Add exact term filter for a field."""
        self.query['bool']['filter'].append({
            'term': {field: value}
        })
        return self

    def terms_filter(self, field: str, values: List[Union[str, int, float]]) -> 'QueryBuilder':
        """Add terms filter for multiple exact values."""
        self.query['bool']['filter'].append({
            'terms': {field: values}
        })
        return self

    def range_filter(self, field: str, gte=None, lte=None, gt=None, lt=None) -> 'QueryBuilder':
        """Add range filter for numeric or date fields."""
        range_query = {'range': {field: {}}}

        if gte is not None:
            range_query['range'][field]['gte'] = gte
        if lte is not None:
            range_query['range'][field]['lte'] = lte
        if gt is not None:
            range_query['range'][field]['gt'] = gt
        if lt is not None:
            range_query['range'][field]['lt'] = lt

        self.query['bool']['filter'].append(range_query)
        return self

    def url_filter(self, url: str) -> 'QueryBuilder':
        """Filter by video URL."""
        return self.match_phrase('url', url)

    def ocr_search(self, texts: List[str]) -> 'QueryBuilder':
        """Search in OCR text content."""
        for text in texts:
            self.query['bool']['should'].append({
                'match': {'ocr': text.lower()}
            })
        return self

    def subtitle_search(self, texts: List[str]) -> 'QueryBuilder':
        """Search in subtitle content."""
        for text in texts:
            self.query['bool']['should'].append({
                'match': {'subtitle': text.lower()}
            })
        return self

    def object_count_filter(self, object_name: str, min_count: int = 1, max_count: Optional[int] = None) -> 'QueryBuilder':
        """Filter by object detection count."""
        range_params = {'gte': min_count}
        if max_count is not None:
            range_params['lte'] = max_count

        self.query['bool']['filter'].append({
            'range': {f'objects.{object_name}': range_params}
        })
        return self

    def date_range_filter(self, start_date: str, end_date: str) -> 'QueryBuilder':
        """Filter by date range."""
        return self.range_filter('date', gte=start_date, lte=end_date)

    def time_range_filter(self, start_seconds: float, end_seconds: float) -> 'QueryBuilder':
        """Filter by time in seconds range."""
        return self.range_filter('time_in_seconds', gte=start_seconds, lte=end_seconds)

    def year_filter(self, year: int) -> 'QueryBuilder':
        """Filter by specific year using script query."""
        self.query['bool']['filter'].append({
            'script': {
                'script': f'''
                    try {{
                        ZonedDateTime utc = doc['date'].value.toInstant().atZone(ZoneOffset.UTC);
                        int year = utc.get(ChronoField.YEAR);
                        return year == {year};
                    }} catch (Exception ex) {{
                        return false;
                    }}
                '''
            }
        })
        return self

    def month_filter(self, month: Union[str, int]) -> 'QueryBuilder':
        """Filter by specific month (name or number)."""
        if isinstance(month, str):
            month = month.lower()
            if month not in self.MONTH_NUMBER:
                return self
            month_num = self.MONTH_NUMBER[month]
        else:
            month_num = month

        self.query['bool']['filter'].append({
            'script': {
                'script': f'''
                    try {{
                        ZonedDateTime utc = doc['date'].value.toInstant().atZone(ZoneOffset.UTC);
                        int month = utc.get(ChronoField.MONTH_OF_YEAR);
                        return month == {month_num};
                    }} catch (Exception ex) {{
                        return false;
                    }}
                '''
            }
        })
        return self

    def day_of_week_filter(self, day: str) -> 'QueryBuilder':
        """Filter by day of week."""
        day = day.lower()
        if day not in self.DAY_OF_WEEK_NUMBER:
            return self

        day_num = self.DAY_OF_WEEK_NUMBER[day]
        self.query['bool']['filter'].append({
            'script': {
                'script': f'''
                    try {{
                        ZonedDateTime utc = doc['date'].value.toInstant().atZone(ZoneOffset.UTC);
                        int dayOfWeek = utc.get(ChronoField.DAY_OF_WEEK);
                        return dayOfWeek == {day_num};
                    }} catch (Exception ex) {{
                        return false;
                    }}
                '''
            }
        })
        return self

    def season_filter(self, season: str) -> 'QueryBuilder':
        """Filter by season."""
        season = season.lower()
        if season not in self.SEASONS:
            return self

        start_month, end_month = self.SEASONS[season]
        self.query['bool']['filter'].append({
            'script': {
                'script': f'''
                    try {{
                        ZonedDateTime utc = doc['date'].value.toInstant().atZone(ZoneOffset.UTC);
                        int month = utc.get(ChronoField.MONTH_OF_YEAR);
                        return {start_month} <= month && month <= {end_month};
                    }} catch (Exception ex) {{
                        return false;
                    }}
                '''
            }
        })
        return self

    def id_filter(self, ids: List[str]) -> 'QueryBuilder':
        """Filter by document IDs."""
        return self.terms_filter('id', ids)

    def build(self) -> Dict[str, Any]:
        """Build and return the final query."""
        # Clean up empty arrays
        for key in ['must', 'should', 'filter']:
            if not self.query['bool'][key]:
                del self.query['bool'][key]

        return self.query


class SearchEngine:
    """High-level search interface for video metadata."""

    def __init__(self, client: Optional[Elasticsearch] = None):
        """
        Initialize SearchEngine.

        Args:
            client: Elasticsearch client instance. Uses global client if None.
        """
        self.client = client or get_elasticsearch_client()
        self.logger = logging.getLogger(__name__)

        if not self.client:
            raise ConnectionError("Failed to establish Elasticsearch connection")

    def search(
        self,
        index_name: str,
        query: Dict[str, Any],
        source_fields: Optional[List[str]] = None,
        sort: Optional[List[Dict[str, Any]]] = None,
        size: int = 100,
        from_: int = 0
    ) -> Dict[str, Any]:
        """
        Execute search query against Elasticsearch.

        Args:
            index_name: Name of the index to search
            query: Elasticsearch query dictionary
            source_fields: Fields to include in results (None for all)
            sort: Sort parameters
            size: Number of results to return
            from_: Starting offset for pagination

        Returns:
            Search results dictionary
        """
        try:
            search_params = {
                'index': index_name,
                'query': query,
                'size': size,
                'from': from_
            }

            if source_fields:
                search_params['_source'] = source_fields
            if sort:
                search_params['sort'] = sort

            return self.client.search(**search_params)

        except Exception as e:
            self.logger.error(f"Search failed: {e}")
            return {'hits': {'hits': [], 'total': {'value': 0}}}

    def get_document(self, index_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific document by ID.

        Args:
            index_name: Name of the index
            doc_id: Document ID

        Returns:
            Document dictionary or None if not found
        """
        try:
            result = self.client.get(index=index_name, id=doc_id)
            return result['_source']
        except Exception as e:
            self.logger.error(f"Failed to get document {doc_id}: {e}")
            return None

    def count_documents(self, index_name: str, query: Optional[Dict[str, Any]] = None) -> int:
        """
        Count documents matching a query.

        Args:
            index_name: Name of the index
            query: Elasticsearch query (None for match_all)

        Returns:
            Number of matching documents
        """
        try:
            if query is None:
                query = {'match_all': {}}

            result = self.client.count(index=index_name, query=query)
            return result['count']

        except Exception as e:
            self.logger.error(f"Count failed: {e}")
            return 0

    def suggest_similar(
        self,
        index_name: str,
        doc_id: str,
        size: int = 10,
        fields: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Find similar documents using More Like This query.

        Args:
            index_name: Name of the index
            doc_id: ID of the reference document
            size: Number of similar documents to return
            fields: Fields to consider for similarity

        Returns:
            List of similar documents
        """
        try:
            fields = fields or ['ocr', 'subtitle']

            query = {
                'more_like_this': {
                    'fields': fields,
                    'like': [{'_index': index_name, '_id': doc_id}],
                    'min_term_freq': 1,
                    'max_query_terms': 12
                }
            }

            result = self.search(index_name, query, size=size)
            return [hit['_source'] for hit in result['hits']['hits']]

        except Exception as e:
            self.logger.error(f"Similar search failed: {e}")
            return []