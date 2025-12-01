from rerank_fusion.test.req import *
from rerank_fusion.RRF_fusion import reciprocal_rank_fusion
from rerank_fusion.CombMNZ_fusion import CombMNZ
from rerank_fusion.preprocessing import get_flatten_data
from rerank_fusion.helpers import calc_final_scores, update_data_with_final_scores

def main():
    URL = "http://14.225.217.119:8082/search/text"
    QUERY = "Nhiều người mặc áo cờ đỏ sao vàng đứng trước biểu tượng một con cua khổng lồ. Những người này đều đội nón, một số người quấn khăn rằn trên cổ."
    
    clip_response = text_search_request(URL, QUERY, "clip_production_1024")
    sigclip_response = text_search_request(URL, QUERY, "sigclip_production_1152")

    clip_data = get_flatten_data(clip_response, "clip_production_1024")
    sigclip_data = get_flatten_data(sigclip_response, "sigclip_production_1152")

    data = {
        **clip_data,
        **sigclip_data
    }
    k = 60 # smaller K means more emphasis on top ranks

    RRF_fused = reciprocal_rank_fusion(data, k=k)
    CombMNZ_fused = CombMNZ(data)

    alpha = 0.1 # higher for rank-based fusion, lower for score-based fusion

    final_scores = calc_final_scores(RRF_fused, CombMNZ_fused, alpha=alpha)
    updated_data = update_data_with_final_scores(data, final_scores)
    with open("output.json", "w", encoding="utf-8") as outfile:
        json.dump(updated_data, outfile, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    main()