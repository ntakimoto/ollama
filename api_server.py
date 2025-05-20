from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from typing import List, Dict
import traceback # ★ 追加
from pydantic import BaseModel
from dotenv import load_dotenv # Add this import

CHAT_HISTORY_FILE = "chat_history.json"

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# CORS設定（Reactのローカル開発用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_chat_history() -> List[Dict]:
    if os.path.exists(CHAT_HISTORY_FILE):
        try:
            with open(CHAT_HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("!!! JSONDecodeError in load_chat_history. Returning empty list.") # ★ 追加
            return []
        except Exception as e:
            print(f"!!! EXCEPTION in load_chat_history: {e}") # ★ 追加
            traceback.print_exc() # ★ 追加
            return []
    return []

def save_chat_history(messages: List[Dict]):
    try:
        with open(CHAT_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"!!! EXCEPTION in save_chat_history: {e}") # ★ 追加
        traceback.print_exc() # ★ 追加

class MessageRequest(BaseModel):
    message: str

@app.get("/api/messages")
def get_messages():
    print("--- get_messages called ---") # ★ 追加
    return load_chat_history()

@app.post("/api/messages")
async def post_message(payload: MessageRequest):
    print("--- post_message called ---")
    print(f"Received payload: {payload}")
    try:
        message = payload.message
        if not message:
            print("!!! Message is empty, raising HTTPException 400")
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        print("Loading chat history...")
        messages = load_chat_history()
        user_msg = {"role": "user", "content": [{"type": "text", "text": message}]}
        messages.append(user_msg)

        # --- ここからweb_chat.pyのロジック ---
        from sentence_transformers import SentenceTransformer
        import chromadb
        from smolagents import LiteLLMModel
        # 埋め込みモデルとChromaDBコレクションの初期化
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        client = chromadb.PersistentClient(path="chroma_db")
        collection = client.get_or_create_collection("book")
        # ユーザー入力をベクトル化
        query_vec = embedder.encode([message])[0].tolist()
        results = collection.query(query_embeddings=[query_vec], n_results=3)
        related = "\n".join(results["documents"][0]) if results["documents"] else "（該当する内容が見つかりませんでした）"
        system_prompt = (
            "以下は書籍からの抜粋です。ユーザーの質問に対し、できるだけこの抜粋を参考に日本語で答えてください。\n\n"
            f"【書籍抜粋】\n{related}\n\n【質問】{message}"
        )
        user_msg_for_llm = {"role": "user", "content": [{"type": "text", "text": system_prompt}]}
        # Ollama/LiteLLMで推論
        model = LiteLLMModel(
            model_id="ollama_chat/qwen2:7b",
            api_base="http://localhost:11434",  # 末尾のスラッシュを削除
            num_ctx=8192,
        )
        import torch
        with torch.no_grad():
            response = model([user_msg_for_llm])
        ai_text = response.content.replace("書籍の抜粋から理解すると、", "").replace("【回答】", "")
        ai_msg = {"role": "assistant", "content": [{"type": "text", "text": ai_text}]}
        messages.append(ai_msg)
        print("Saving chat history...")
        save_chat_history(messages)
        print("--- post_message completed successfully ---")
        return ai_msg
    except HTTPException as http_exc:
        print(f"--- Raising HTTPException: {http_exc.status_code} {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"!!! UNEXPECTED EXCEPTION IN post_message: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@app.post("/api/messages/gemini")
async def post_message_gemini(payload: MessageRequest):
    print("--- post_message_gemini called ---")
    print(f"Received payload: {payload}")
    try:
        message = payload.message
        if not message:
            print("!!! Message is empty, raising HTTPException 400")
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        print("Loading chat history...")
        messages = load_chat_history()
        user_msg = {"role": "user", "content": [{"type": "text", "text": message}]}
        messages.append(user_msg)

        # --- RAG部分は既存と同じ ---
        from sentence_transformers import SentenceTransformer
        import chromadb
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        client = chromadb.PersistentClient(path="chroma_db")
        collection = client.get_or_create_collection("book")
        query_vec = embedder.encode([message])[0].tolist()
        results = collection.query(query_embeddings=[query_vec], n_results=3)

        # ★ RAGの結果に基づいてシステムプロンプトを分岐 ★
        if results["documents"] and results["documents"][0]:
            related_texts = "\n".join(results["documents"][0])
            system_prompt = (
                "あなたは親切なAIアシスタントです。\n"
                "以下の書籍からの抜粋を参考に、ユーザーの質問に日本語で答えてください。\n"
                "抜粋に直接的な答えがない場合でも、関連する情報を提供し、自然な会話を心がけてください。\n\n"
                f"【書籍抜粋】\n{related_texts}\n\n"
                f"【ユーザーの質問】\n{message}"
            )
            print("--- RAG: Found related content ---")
        else:
            system_prompt = (
                "あなたは親切なAIアシスタントです。\n"
                "関連書籍のデータベースを検索しましたが、ユーザーの質問に直接合致する情報は見つかりませんでした。\n"
                "あなたの一般的な知識に基づいて、ユーザーの質問に日本語で答えてください。\n"
                "可能であれば、関連性の高い情報を提示してください。\n"
                "「情報が見つかりませんでした」という旨の直接的な言及は避けてください。\n\n"
                f"【ユーザーの質問】\n{message}"
            )
            print("--- RAG: No related content found, using general knowledge ---")

        # --- Gemini API呼び出し ---
        import google.generativeai as genai
        # APIキーの設定は環境変数などから読み込むのがより安全ですが、ここでは既存のコードを尊重します。
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not found in environment variables. Please set it in your .env file or environment.")
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash") # モデル名を更新
        
        response = model.generate_content(system_prompt)
        
        ai_text = response.text
        
        # フロントエンドへのレスポンス形式を統一
        ai_msg_content = {"role": "assistant", "content": [{"type": "text", "text": ai_text}]}
        
        # チャット履歴への保存用 (videoIdやtranscriptは含めない)
        messages.append({"role": "assistant", "content": [{"type": "text", "text": ai_text}]})
        print("Saving chat history...")
        save_chat_history(messages)
        
        print("--- post_message_gemini completed successfully ---")
        return ai_msg_content

    except HTTPException as http_exc:
        print(f"--- Raising HTTPException: {http_exc.status_code} {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"!!! UNEXPECTED EXCEPTION IN post_message_gemini: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) # ポートを8001に変更
