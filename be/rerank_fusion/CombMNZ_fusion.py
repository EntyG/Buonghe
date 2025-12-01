from collections import defaultdict

def CombMNZ(data: dict):
    sum_scores = defaultdict(float)
    count_scores = defaultdict(int)

    for results in data.values():
        for result in results:
            image_list = result.get("image_list")
            if not image_list:
                continue
            for image in image_list:
                image_id = image.get("id")
                if not image_id:
                    continue
                sum_scores[image_id] += image.get("score", 0.0)
                count_scores[image_id] += 1

    return {img_id: sum_scores[img_id] * count_scores[img_id] for img_id in sum_scores}
if __name__ == "__main__":
    import json

    with open("data.json", "r") as infile:
        data = json.load(infile)

    fused_scores = CombMNZ(data)
