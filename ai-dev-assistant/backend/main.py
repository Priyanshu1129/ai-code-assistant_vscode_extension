from dotenv import load_dotenv
load_dotenv()

import os
import threading
import socket
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from rag_pipeline import get_relevant_chunks
from llm_cloud import query_llm
from watcher import start_watching


HF_API_KEY = os.getenv("HF_API_KEY")
if not HF_API_KEY:
    raise RuntimeError("HF_API_KEY not set — configure aiDevAssistant.hfApiKey in VS Code settings")


app = FastAPI()

class QueryRequest(BaseModel):
    question: str

@app.post("/query")
async def query_endpoint(request: QueryRequest):
    print(f"Received question: {request.question}")
    
    # ✅ Will now load the correct per-project index based on WORKSPACE_PATH
    chunks = get_relevant_chunks(request.question)
    
    answer = query_llm(question=request.question, context=chunks)
    return {"answer": answer}

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def run_server():
    port = find_free_port()
    print(f"PORT::{port}", flush=True)  # 🔁 Tell VS Code which port to use
    uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    workspace_path = os.getenv("WORKSPACE_PATH", ".")

    watcher_thread = threading.Thread(
        target=start_watching,
        args=(workspace_path,),
        daemon=True
    )
    watcher_thread.start()

    print(f"Started watcher for: {workspace_path}", flush=True)
    print("Starting backend server...", flush=True)

    run_server()

