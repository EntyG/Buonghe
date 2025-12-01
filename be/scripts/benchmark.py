from dotenv import load_dotenv
import os
import requests
import numpy as np

load_dotenv()

EMBEDDING_URL = os.getenv("EMBEDDING_URL")
EMBEDDING_MODEL = "siglip2"

def get_embeddings(text: str):
    payload = {
        "model": EMBEDDING_MODEL,
        "texts": [text]
    }
    response = requests.post(EMBEDDING_URL, json=payload)
    embedding = response.json()["data"][0]["embedding"]
    return embedding

input = "The image depicts a scene that appears to be from a broadcast by HTV9, likely a news segment, considering the logo in the top right corner. The composition shows a person standing to the left side, possibly a reporter or host, who seems to be addressing the audience. The background is bright and possibly features a large logo or graphic, with dominant colors including yellow and white. The text 'HTV9' in the corner provides context that this image is from a Vietnamese news program. The visual has a slightly abstract or illustrative style, suggesting that it might be from a stylized segment or graphic interlude."
query = "The composition features a person positioned on the left side—likely a reporter or host—appearing to speak to the audience, set within the context of a Vietnamese news program. The visual carries a somewhat abstract or illustrative aesthetic, hinting that it could be part of a stylized segment or a graphic interlude."

def inner_product(embedding1, embedding2):
    return np.dot(embedding1, embedding2)

print(inner_product(get_embeddings(input), get_embeddings(query)))