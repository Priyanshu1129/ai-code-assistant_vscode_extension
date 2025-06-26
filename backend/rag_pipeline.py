from sentence_transformers import SentenceTransformer
import faiss
import pickle
import os

# ✅ Derive project-specific vectorstore location
PROJECT_ID = os.path.basename(os.getenv("WORKSPACE_PATH", "."))
VECTORSTORE_DIR = os.path.join("vectorstore", PROJECT_ID)
INDEX_PATH = os.path.join(VECTORSTORE_DIR, "code_index.faiss")
DOCS_PATH = os.path.join(VECTORSTORE_DIR, "docs.pkl")

# ✅ Initialize model and memory
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
index = None
documents = []

def load_index():
    global index, documents
    if os.path.exists(INDEX_PATH) and os.path.exists(DOCS_PATH):
        index = faiss.read_index(INDEX_PATH)
        with open(DOCS_PATH, "rb") as f:
            documents = pickle.load(f)
    else:
        index = None
        documents = []

# Load the index once at import
load_index()

def get_relevant_chunks(query: str, top_k: int = 5) -> list[str]:
    if index is None or not documents:
        return ["❌ Code index not found. Please run watcher.py first to build it."]
    
    query_vec = embedding_model.encode([query])
    D, I = index.search(query_vec, top_k)
    return [documents[i] for i in I[0]]


# from sentence_transformers import SentenceTransformer
# import faiss
# import pickle
# import os

# VECTORSTORE_DIR = "vectorstore"
# INDEX_PATH = os.path.join(VECTORSTORE_DIR, "code_index.faiss")
# DOCS_PATH = os.path.join(VECTORSTORE_DIR, "docs.pkl")

# embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
# index = None
# documents = []

# def load_index():
#     global index, documents
#     if os.path.exists(INDEX_PATH) and os.path.exists(DOCS_PATH):
#         index = faiss.read_index(INDEX_PATH)
#         with open(DOCS_PATH, "rb") as f:
#             documents = pickle.load(f)
#     else:
#         index = None
#         documents = []

# # Call load_index() during FastAPI startup or explicitly later
# load_index()

# def get_relevant_chunks(query: str, top_k: int = 5) -> list[str]:
#     if index is None or not documents:
#         return ["❌ Code index not found. Please run watcher.py first to build it."]
    
#     query_vec = embedding_model.encode([query])
#     D, I = index.search(query_vec, top_k)
#     return [documents[i] for i in I[0]]
