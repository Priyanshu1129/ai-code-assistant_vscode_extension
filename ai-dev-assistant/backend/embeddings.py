import os
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import faiss
import pickle

# Init model & config
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
VECTORSTORE_DIR = "vectorstore"
INDEX_PATH = os.path.join(VECTORSTORE_DIR, "code_index.faiss")
DOCS_PATH = os.path.join(VECTORSTORE_DIR, "docs.pkl")

# Setup in-memory index and metadata store
index = faiss.IndexFlatL2(384)  # 384 = MiniLM vector size
documents = []

def load_or_create_index():
    global index, documents
    if os.path.exists(INDEX_PATH) and os.path.exists(DOCS_PATH):
        index = faiss.read_index(INDEX_PATH)
        with open(DOCS_PATH, "rb") as f:
            documents = pickle.load(f)

def save_index():
    faiss.write_index(index, INDEX_PATH)
    with open(DOCS_PATH, "wb") as f:
        pickle.dump(documents, f)

def embed_and_store(file_path: str):
    if not file_path.endswith(('.py', '.js', '.ts', '.md')):
        return
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    chunks = text_splitter.split_text(content)
    embeddings = embedding_model.encode(chunks)

    index.add(embeddings)
    documents.extend(chunks)
    save_index()
    print(f"[+] Indexed {len(chunks)} chunks from {file_path}")
