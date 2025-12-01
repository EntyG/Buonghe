import os
from dotenv import load_dotenv
from helpers.embedding import TextEmbedding

load_dotenv()

embedding = TextEmbedding(os.getenv("EMBEDDING_URL"))

print(embedding.get_dimension())
print(embedding.encode_query("hello"))