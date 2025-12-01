from typing import List, Dict, Any, Union
from collections import defaultdict


class RRFFusion:
    """
    Optimized Reciprocal Rank Fusion (RRF) with CombMNZ fusion.
    
    Combines multiple search results using RRF and CombMNZ algorithms with
    configurable weighting between the two methods.
    """

    def __init__(self, k: int = 60, alpha: float = 0.1):
        """
        Initialize RRF fusion with parameters.
        
        Args:
            k: RRF constant parameter (default: 60)
            alpha: Weight for RRF vs CombMNZ (0.0 = pure CombMNZ, 1.0 = pure RRF)
        """
        self.k = k  # Fixed: was hardcoded to 60
        self.alpha = alpha  # Fixed: was hardcoded to 0.1

    @property
    def alpha(self) -> float:
        """Get alpha parameter."""
        return self._alpha

    @alpha.setter
    def alpha(self, value: float) -> None:
        """Set alpha parameter."""
        if not 0.0 <= value <= 1.0:
            raise ValueError("Alpha must be between 0.0 and 1.0")
        self._alpha = value

    @property
    def k(self) -> int:
        """Get k parameter."""
        return self._k

    @k.setter
    def k(self, value: int) -> None:
        """Set k parameter."""
        if value < 1:
            raise ValueError("k must be a positive integer")
        self._k = value

    def reciprocal_rank_fusion(self, results: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Calculate Reciprocal Rank Fusion scores.
        
        Args:
            results: List of result dictionaries from different search systems
            
        Returns:
            Dictionary mapping document IDs to RRF scores
        """
        fused_scores = defaultdict(float)
        
        for result_dict in results:
            # Use enumerate for rank calculation
            for rank, doc_id in enumerate(result_dict.keys()):
                fused_scores[doc_id] += 1.0 / (self.k + rank + 1)
        
        return dict(fused_scores)

    def comb_mnz_fusion(self, results: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Calculate CombMNZ (Combined Multiple Number of Zones) fusion scores.
        
        Args:
            results: List of result dictionaries from different search systems
            
        Returns:
            Dictionary mapping document IDs to CombMNZ scores
        """
        sum_scores = defaultdict(float)
        count_scores = defaultdict(int)
        
        # Single pass to collect scores and counts
        for result_dict in results:
            for doc_id, result in result_dict.items():
                score = result.get("score", 0.0)
                sum_scores[doc_id] += score
                count_scores[doc_id] += 1
        
        # Calculate CombMNZ scores (sum * count)
        return {doc_id: sum_scores[doc_id] * count_scores[doc_id] 
                for doc_id in sum_scores}

    def calc_final_scores(self, results: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Calculate final fusion scores combining RRF and CombMNZ.
        
        Args:
            results: List of result dictionaries from different search systems
            
        Returns:
            Dictionary mapping document IDs to final fusion scores
        """
        rrf_scores = self.reciprocal_rank_fusion(results)
        comb_mnz_scores = self.comb_mnz_fusion(results)
        
        # Get all unique document IDs
        all_doc_ids = set(rrf_scores.keys()) | set(comb_mnz_scores.keys())
        
        # Calculate weighted combination
        final_scores = {}
        for doc_id in all_doc_ids:
            rrf_score = rrf_scores.get(doc_id, 0.0)
            mnz_score = comb_mnz_scores.get(doc_id, 0.0)
            final_scores[doc_id] = self.alpha * rrf_score + (1 - self.alpha) * mnz_score
        
        return final_scores

    def merge_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Merge results from multiple search systems, keeping the latest result for each ID.
        
        Args:
            results: List of result dictionaries from different search systems
            
        Returns:
            Dictionary with merged results
        """
        merged_results = {}
        for result_dict in results:
            merged_results.update(result_dict)
        return merged_results

    def fuse(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Perform complete fusion of search results.
        
        Args:
            results: List of result dictionaries from different search systems
            
        Returns:
            Dictionary with fused and sorted results
        """
        if not results:
            return {}
        
        # Calculate final scores
        final_scores = self.calc_final_scores(results)
        
        # Merge results from all systems
        merged_results = self.merge_results(results)
        
        # Update scores and sort by final score
        for doc_id, score in final_scores.items():
            if doc_id in merged_results:
                merged_results[doc_id]["score"] = score
        
        # Sort by score in descending order
        return dict(sorted(merged_results.items(), 
                          key=lambda x: x[1].get("score", 0.0), 
                          reverse=True))