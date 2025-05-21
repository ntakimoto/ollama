from fastapi import FastAPI, HTTPException, Request, Form # MODIFIED: remove File, UploadFile, add Form
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from typing import List, Dict
import traceback # ★ 追加
from pydantic import BaseModel
from dotenv import load_dotenv # Add this import
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound # Add this import
from pytube import YouTube # Add this import

# +++ ADDED FOR IMAGE ILLUSTRATION +++
from PIL import Image
import base64
# +++ END ADDED FOR IMAGE ILLUSTRATION +++

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

@app.delete("/api/messages/{message_index}")
async def delete_message(message_index: int):
    print(f"--- delete_message called for index: {message_index} ---")
    messages = load_chat_history()
    print(f"--- Current chat history length: {len(messages)} ---")
    # Log first few messages for brevity, if history is long
    if messages:
        print(f"--- Current chat history (first 3 messages if available): {messages[:3]} ---")
    else:
        print("--- Current chat history is empty. ---")

    # Validate index
    if not (0 <= message_index < len(messages)):
        print(f"!!! Index {message_index} is out of bounds for messages list of length {len(messages)}.")
        raise HTTPException(status_code=404, detail="Message index out of bounds.")
    
    # Validate it's a user message
    if messages[message_index]["role"] != "user":
        print(f"!!! Message at index {message_index} is not a user message. Role: {messages[message_index]['role']}")
        raise HTTPException(status_code=400, detail="Specified index does not refer to a user message.")

    # --- ここから削除対象のチャットを記録 ---
    deleted_messages = [messages[message_index]]
    if message_index + 1 < len(messages) and messages[message_index + 1]["role"] == "assistant":
        deleted_messages.append(messages[message_index + 1])
        del messages[message_index : message_index + 2] # Remove user and AI message
        print(f"--- Deleted user message at index {message_index} and subsequent AI message ---")
    else:
        del messages[message_index]
        print(f"--- Deleted user message at index {message_index} (no subsequent AI message found) ---")
    
    save_chat_history(messages)
    print(f"--- Chat history saved. Current messages: {messages} ---")
    # --- 削除したチャットのみ返す ---
    return {"message": "Messages deleted successfully", "deleted": deleted_messages}

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

        # --- 直近5件の履歴をGeminiに渡すために整形 ---
        def flatten_message(msg):
            if msg["role"] == "user":
                # contentは配列またはstr
                if isinstance(msg["content"], list):
                    text = msg["content"][0]["text"] if msg["content"] and isinstance(msg["content"][0], dict) and "text" in msg["content"][0] else str(msg["content"])
                else:
                    text = str(msg["content"])
                return f"ユーザー: {text}"
            elif msg["role"] == "assistant":
                # contentは配列またはstr
                if isinstance(msg["content"], list):
                    text = msg["content"][0]["text"] if msg["content"] and isinstance(msg["content"][0], dict) and "text" in msg["content"][0] else str(msg["content"])
                else:
                    text = str(msg["content"])
                return f"アシスタント: {text}"
            else:
                return ""

        # 直近5件（ユーザー/アシスタント両方で5件）
        last_5 = messages[-10:] # 1往復=2件なので10件取得
        last_5_str = "\n".join([flatten_message(m) for m in last_5])

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
                "ユーザーの質問に対して、以下の【提供情報】のみを根拠として、日本語で回答してください。\n"
                "【提供情報】に記載されていない内容や、情報源（例：書籍、記事など）の構造や背景に関する憶測（例えば「書籍の冒頭には」や「著者の意図は」など）を回答に含めないでください。\n"
                "あなたの役割は、提供された情報を正確にユーザーに伝えることです。\n"
                "回答を生成する際には、「【提供情報】」、「提供された情報からは」、「書籍の記述からは、」といった定型的な前置きやラベルを回答に含めないでください。\n\n"
                f"【提供情報】\n{related_texts}\n\n"
                f"【直近の会話履歴】\n{last_5_str}\n\n"
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
                f"【直近の会話履歴】\n{last_5_str}\n\n"
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
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Updated system prompt to request JSON for tables
        system_prompt += """

【制約】
- 回答は必ず3行以上にしてください。
- できるだけ詳しく、具体例や理由も含めて説明してください。
- 箇条書きや段落を使って、読みやすくしてください。
- 回答には基本的に喜怒哀楽などの感情表現を含めてください。
- 表で表現した方がわかりやすい場合は、その表データをJSON形式で、次の構造で出力してください: ```json
{
  "is_table": true,
  "type": "table_data",
  "data": {
    "headers": ["ヘッダー1", "ヘッダー2"],
    "rows": [
      ["行1セル1", "行1セル2"],
      ["行2セル1", "行2セル2"]
    ]
  }
}
``` このJSON構造を回答のメインコンテンツにしない。JSON構造は表で返答する時のみです。"""

        response = model.generate_content(system_prompt)
        ai_text = response.text
        
        # フロントエンドへのレスポンス形式を統一
        # ... (ai_msg_content assignment - keep as is or remove if only chat_history matters here)
        
        # チャット履歴への保存用 (videoIdやtranscriptは含めない)
        messages.append({"role": "assistant", "content": ai_text }) # Ensure content is just the text for history
        print("Saving chat history...")
        save_chat_history(messages)
        
        print("--- post_message_gemini completed successfully ---")

        current_video_id = ""
        actual_transcript_data = [] # ★ 変更: デフォルトを空リストに
        video_title = "" # ★ 追加: 動画タイトル用変数

        if results["documents"] and results["documents"][0]:
            # RAG was successful
            current_video_id = "iRJvKaCGPl0" # ★ 変更: 新しいテスト動画ID
            # ★★★ 修正: RAGが成功しても字幕データは取得しない ★★★
            actual_transcript_data = [] # 字幕データは取得せず空リスト
            print("--- RAG: Success, but transcript fetch is skipped as per new requirement ---")
            return {
                "role": "assistant",
                "content": ai_text,
                "videoId": current_video_id,
                "transcript": actual_transcript_data, # 空リストを返す
                "videoTitle": "" # 動画タイトル取得は実装しない
            }

    except HTTPException as http_exc:
        print(f"--- Raising HTTPException: {http_exc.status_code} {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"!!! UNEXPECTED EXCEPTION IN post_message_gemini: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@app.get("/api/messages/transcript/{video_id}")
def get_transcript(video_id: str):
    print(f"--- get_transcript called for video_id: {video_id} ---")
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['ja', 'en'])
        print(f"--- Transcript fetched for {video_id}. Lines: {len(transcript_list)} ---")
        return {"transcript": transcript_list}
    except TranscriptsDisabled:
        print(f"--- Transcripts are disabled for video: {video_id} ---")
        return {"transcript": []}
    except NoTranscriptFound:
        print(f"--- No transcript found for video: {video_id} ---")
        return {"transcript": []}
    except Exception as e:
        print(f"--- Error fetching transcript for {video_id}: {type(e).__name__} - {e} ---")
        traceback.print_exc()
        return {"transcript": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) # ポートを8001に変更
