"""
store_embeddings.py
------------------
1. Loads optimized chunks from chunks_output.json.
2. Generates embeddings using 'all-MiniLM-L6-v2' (Hugging Face).
3. Stores them in a local ChromaDB collection for fast RAG retrieval.

Usage:
  python3 store_embeddings.py
"""

import os
import json 
from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer

# ─── Configuration ─────────────────────────────────────────────────────────────
CHUNKS_FILE = Path(__file__).parent / "chunks_output.json"
DB_PATH     = Path(__file__).parent / "chroma_db"
COLLECTION_NAME = "placement_chunks"
MODEL_NAME      = "all-MiniLM-L6-v2"

def main():
    print("=" * 60)
    print("Placement Vector Store Builder")
    print("=" * 60)

    if not CHUNKS_FILE.exists():
        print(f"ERROR: {CHUNKS_FILE} not found. Please run generate_chunks.py first.")
        return

    # 1. Load Chunks
    print(f"Loading chunks from {CHUNKS_FILE.name}...")
    with open(CHUNKS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    all_chunks = []
    for company_chunks in data.get("chunks", {}).values():
        all_chunks.extend(company_chunks)
    
    if not all_chunks:
        print("ERROR: No chunks found in the JSON file.")
        return
    
    print(f"  → Found {len(all_chunks)} chunks.")

    # 2. Initialize ChromaDB
    print(f"Initializing ChromaDB at {DB_PATH.name}/...")
    client = chromadb.PersistentClient(path=str(DB_PATH))
    
    # Use SentenceTransformers for embeddings
    # Chroma handles the embedding generation internally if we provide the function
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=MODEL_NAME)
    
    # 3. Create or Get Collection
    # Resetting the collection if it exists to ensure a clean state (optional)
    # collection = client.get_or_create_collection(name=COLLECTION_NAME, embedding_function=emb_fn)
    
    # For a fresh start, we'll try to delete and recreate, or just get_or_create
    try:
        client.delete_collection(name=COLLECTION_NAME)
        print(f"  → Resetting existing collection '{COLLECTION_NAME}'")
    except:
        pass
    
    collection = client.create_collection(name=COLLECTION_NAME, embedding_function=emb_fn)

    # 4. Prepare data for Chroma
    print(f"Generating embeddings and storing vectors (this may take a minute)...")
    
    ids = []
    documents = []
    metadatas = []
    
    for i, chunk in enumerate(all_chunks):
        # 1. Use a strictly unique ID to avoid collisions
        unique_id = f"chunk_{i:05d}"
        
        # 2. IMPORTANT: Include the header in the text we embed.
        # This ensures keywords like Company Name are present in the vector.
        text_to_embed = f"{chunk['header']}\n\n{chunk['content']}"
        
        ids.append(unique_id)
        documents.append(text_to_embed)
        
        # 3. Metadata for filtering remains the same
        metadatas.append({
            "company":   chunk['company'],
            "role":      chunk['role'],
            "section":   chunk['section'],
            "filename":  chunk['filename'],
            "file_type": chunk['file_type'],
            "header":    chunk['header']
        })

    # 5. Batch Upsert
    # Chroma works well with batches. We'll add them all at once or in small batches if very large.
    batch_size = 100
    for i in range(0, len(ids), batch_size):
        end = i + batch_size
        collection.add(
            ids=ids[i:end],
            documents=documents[i:end],
            metadatas=metadatas[i:end]
        )
        print(f"  → Processed {min(end, len(ids))}/{len(ids)} chunks...")

    print("\n" + "=" * 60)
    print("Done! Vector store created successfully.")
    print(f"      Total chunks stored : {len(ids)}")
    print(f"      Database location    : {DB_PATH}")
    print(f"      Embedding model      : {MODEL_NAME}")
    print("=" * 60)

if __name__ == "__main__":
    main()
