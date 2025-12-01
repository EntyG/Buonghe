import requests
import json


def text_search_request(url: str, query: str, collection_name: str):
    payload = {
        "collection_name": collection_name,
        "text": query,
        "mode": "moment",
        "translate_mode": "true",
        "top_k": 1024
    }

    headers = {
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        response.raise_for_status()

