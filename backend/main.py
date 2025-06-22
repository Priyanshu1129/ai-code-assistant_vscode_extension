from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, Request
from pydantic import BaseModel
from rag_pipeline import get_relevant_chunks
from llm_cloud import query_llm


app = FastAPI()

class QueryRequest(BaseModel):
    question: str

@app.post("/query")
async def query_code(request: QueryRequest):
    chunks = get_relevant_chunks(request.question)
    response = query_llm(question=request.question, context=chunks)
    
    return {"answer": response}
