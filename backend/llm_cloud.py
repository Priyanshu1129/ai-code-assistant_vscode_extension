import httpx
import os

# HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1"
HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"


HF_API_KEY = os.getenv("HF_API_KEY")
if not HF_API_KEY:
    raise ValueError("HF_API_KEY not set. Did you load the .env file?")


print("Using Hugging Face API URL:", HF_API_KEY)

headers = {
    "Authorization": f"Bearer {HF_API_KEY}"
}

def query_llm(question: str, context: list[str]) -> str:
    prompt = f"Answer the question using only the context:\n\nContext:\n{''.join(context)}\n\nQuestion: {question}\n\nAnswer:"
    
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 200,
            "temperature": 0.3,
        }
    }

    response = httpx.post(HF_API_URL, headers=headers, json=payload)
    print("Status code:", response.status_code)
    print("Raw text:", response.text)
    result = response.json()

    if isinstance(result, dict) and "error" in result:
        return f"Error from LLM: {result['error']}"
    
    if isinstance(result, list) and "generated_text" in result[0]:
        # Extract only what's after 'Answer:'
        text = result[0]["generated_text"]
        answer = text.split("Answer:")[-1].strip()
        return answer

    return "LLM response not understood"
