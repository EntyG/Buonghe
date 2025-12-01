from rerank_fusion.preprocessing import get_flatten_data
from rerank_fusion.RRF_fusion import reciprocal_rank_fusion
from rerank_fusion.CombMNZ_fusion import CombMNZ

def calc_final_scores(RRF_results: dict, CombMNZ_results: dict, alpha: float = 0.5):
    all_image_ids = set(RRF_results) | set(CombMNZ_results)
    final_scores = {
        image_id: alpha * RRF_results.get(image_id, 0.0) + (1 - alpha) * CombMNZ_results.get(image_id, 0.0)
        for image_id in all_image_ids
    }
    return dict(sorted(final_scores.items(), key=lambda item: item[1], reverse=True))

def merge_collections(data):
    merged = {}
    for items in data.values():
        for item in items:
            image_list = item.get("image_list")
            if not image_list:
                continue
            image_id = image_list[0]["id"]
            if image_id not in merged:
                merged[image_id] = item
    return list(merged.values())

def update_data_with_final_scores(data, final_scores):
    merged_data = merge_collections(data)
    for item in merged_data:
        image_list = item.get("image_list")
        if not image_list:
            continue
        image_id = image_list[0]["id"]
        image_list[0]["score"] = final_scores.get(image_id, 0.0)
    return sorted(merged_data, key=lambda x: x["image_list"][0]["score"], reverse=True)





    


    
