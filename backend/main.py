from dotenv import load_dotenv
load_dotenv()

import os
import socket
import uvicorn
import threading
from fastapi import FastAPI
from pydantic import BaseModel
from rag_pipeline import get_relevant_chunks
from llm_cloud import query_llm
from watcher import start_watching


app = FastAPI()

class QueryRequest(BaseModel):
    question: str

@app.post("/query")
async def query_endpoint(request: QueryRequest):
    print(f"Received question: {request.question}")
    chunks = get_relevant_chunks(request.question)
    answer = query_llm(question=request.question, context=chunks)
    return {"answer": answer}

# Utility to find an open port
def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]

# Derive workspace path from environment
workspace_path = os.getenv("WORKSPACE_PATH", ".")

@app.on_event("startup")
def launch_watcher():
    # Spawn watcher in background before server starts
    t = threading.Thread(
        target=start_watching,
        args=(workspace_path,),
        daemon=True
    )
    t.start()
    print(f"🛠 Watcher thread launched for: {workspace_path}", flush=True)

if __name__ == "__main__":
    port = find_free_port()
    print(f"PORT::{port}", flush=True)
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_config=None,
        access_log=False
    )
