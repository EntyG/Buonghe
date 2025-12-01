from rerank_fusion.preprocessing import *
from typing import Dict, List

def reciprocal_rank_fusion(data: Dict[str, List[dict]], k=60):
    from collections import defaultdict
    fused_scores = defaultdict(float)

    for results in data.values():
        for rank_position, result in enumerate(results, start=1):
            image_list = result.get("image_list")
            if not image_list:
                continue
            image_id = image_list[0]["id"]
            fused_scores[image_id] += 1.0 / (k + rank_position)

    return dict(fused_scores)
    
if __name__ == "__main__":
    with open("data.json", "r") as infile:
        import json
        data = json.load(infile)
    
    fused_results = reciprocal_rank_fusion(data, 20)
    print(fused_results)