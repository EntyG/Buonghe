def get_flatten_data(data: dict, collection_name: str):
    results = data.get("results", [])
    flattened = [
        {
            "image_list": result.get("image_list", []),
            "cluster_name": result.get("cluster_name", ""),
            "url": result.get("url", "")
        }
        for result in results
    ]
    return {collection_name: flattened}


if __name__ == "__main__":
    sample_json = {
        "mode": "video",
        "results": [
            {
            "cluster_name": "L01_V013",
            "image_list": [
                {
                "id": "L01_V013/001234",
                "name": "L01_V013/001234",
                "path": "L01/",
                "time_in_seconds": 25,
                "score": 0.21106886863708496
                }
            ],
            "url": "https://youtube.com/xyaz"
            }
        ],
        "state_id": "0x12321ca2fed",
        "status": "success"
    }
    collection_name = "sample_collection"
    print(get_flatten_data(sample_json, collection_name))