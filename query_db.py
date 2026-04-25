"""
query_db.py
----------
Test script to verify retrieval from the ChromaDB vector store.
"""

import chromadb
from chromadb.utils import embedding_functions 

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "placement_chunks"
MODEL_NAME = "all-MiniLM-L6-v2"

def query_placements(query_text, n_results=3):
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=MODEL_NAME)
    collection = client.get_collection(name=COLLECTION_NAME, embedding_function=emb_fn)

    print(f"\n🔍 Querying for: '{query_text}'")
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results
    )

    for i in range(len(results['ids'][0])):
        doc = results['documents'][0][i]
        meta = results['metadatas'][0][i]
        dist = results['distances'][0][i]
        
        print(f"\n[Result {i+1}] (Distance: {dist:.4f})")
        print(f"Company: {meta['company']} | Section: {meta['section']}")
        print(f"Header: {meta['header']}")
        print(f"--- Content Preview ---")
        # Print first 200 chars
        print(doc[:200].replace('\n', ' ') + "...")

if __name__ == "__main__":
    queries = [
        "What is the stipend for Amazon?",
        "What are the eligibility criteria for Bosch?",
        "Tell me about the Data Science challenge at Astrikos"
    ]
    
    for q in queries:
        query_placements(q)
