import requests
import numpy as np

class TextEmbedding:
    def __init__(self, embedding_url):
        self.embedding_url = embedding_url
        try:
            embedding = self.get_embeddings(["hello"])[0]
            self.dimension = embedding.shape[0]
        except Exception as e:
            raise Exception(f"Error initializing TextEmbedding - unable to get dimension: {str(e)}")

    def get_embeddings(self, texts: list[str]):
        """Get embeddings for a list of texts"""
        try:
            response = requests.post(self.embedding_url, json={"input": texts})
            response.raise_for_status()  # Raise an exception for bad status codes
            resp_json = response.json()
            embeddings = []
            if "data" in resp_json:
                data = resp_json["data"]
                for item in data:
                    embeddings.append(item["embedding"])
            return np.array(embeddings)
        except requests.RequestException as e:
            raise Exception(f"Error fetching embeddings from API: {str(e)}")
        except Exception as e:
            raise Exception(f"Error processing embeddings: {str(e)}")
    
    def get_dimension(self):
        """Get the dimension of the embeddings"""
        return self.dimension
    
    def encode_query(self, query: str):
        """Encode a single query string"""
        try:
            embedding = self.get_embeddings([query])[0]
            return embedding
        except Exception as e:
            raise Exception(f"Error encoding query '{query}': {str(e)}")

