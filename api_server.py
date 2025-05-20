from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from typing import List, Dict
import traceback # ★ 追加
from pydantic import BaseModel
from dotenv import load_dotenv # Add this import
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound # Add this import
from pytube import YouTube # Add this import

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

    # Determine if there's a subsequent assistant message to remove as well
    if message_index + 1 < len(messages) and messages[message_index + 1]["role"] == "assistant":
        del messages[message_index : message_index + 2] # Delete user message and AI response
        print(f"--- Deleted user message at index {message_index} and subsequent AI message ---")
    else:
        del messages[message_index] # Delete only the user message
        print(f"--- Deleted user message at index {message_index} (no subsequent AI message found) ---")
    
    save_chat_history(messages)
    print(f"--- Chat history saved. Current messages: {messages} ---")
    # Return the updated chat history so the frontend can sync
    return {"message": "Messages deleted successfully", "chat_history": messages}

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
                "ユーザーの質問に対して、以下の【提供情報】のみを根拠として、日本語で回答してください。\n"
                "【提供情報】に記載されていない内容や、情報源（例：書籍、記事など）の構造や背景に関する憶測（例えば「書籍の冒頭には」や「著者の意図は」など）を回答に含めないでください。\n"
                "あなたの役割は、提供された情報を正確にユーザーに伝えることです。\n"
                "回答を生成する際には、「【提供情報】」、「提供された情報からは、」、「書籍の記述からは、」といった定型的な前置きやラベルを回答に含めないでください。\n\n"
                f"【提供情報】\n{related_texts}\n\n" # Changed label from 書籍抜粋
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
            try:
                yt = YouTube(f"https://www.youtube.com/watch?v={current_video_id}")
                video_title = yt.title
                print(f"--- Fetched video title: {video_title} ---")
            except Exception as e:
                print(f"--- Error fetching video title for {current_video_id}: {type(e).__name__} - {e} ---")
                traceback.print_exc() # ★ 追加: 詳細なトレースバックをログに出力
                video_title = "動画タイトルを取得できませんでした"

            try:
                # Attempt to fetch Japanese transcript first, then English as fallback
                transcript_list = YouTubeTranscriptApi.get_transcript(current_video_id, languages=['ja', 'en'])
                actual_transcript_data = transcript_list 
                # Ensure this print statement is detailed
                print(f"--- Transcript fetched for {current_video_id}. Type: {type(actual_transcript_data)}, Lines: {len(actual_transcript_data) if isinstance(actual_transcript_data, list) else 'N/A'} ---")
            except TranscriptsDisabled:
                print(f"--- Transcripts are disabled for video: {current_video_id} ---")
                actual_transcript_data = [] # エラー時は空リスト
            except NoTranscriptFound:
                print(f"--- No Japanese or English transcript found for video: {current_video_id} ---")
                actual_transcript_data = [] # エラー時は空リスト
            except Exception as e: # More general exception catch
                print(f"--- Error fetching transcript for {current_video_id}: {type(e).__name__} - {e} ---")
                traceback.print_exc() # Log the stack trace
                actual_transcript_data = [] # エラー時は空リスト
            
            # Add detailed log before returning
            data_to_return_transcript = actual_transcript_data if actual_transcript_data is not None else []
            print(f"--- Preparing to return for RAG success. Transcript Type: {type(data_to_return_transcript)}, Lines: {len(data_to_return_transcript) if isinstance(data_to_return_transcript, list) else 'N/A'}, Content (first 70 chars): {str(data_to_return_transcript)[:70]} ---")
            
            return {
                "role": "assistant",
                "content": ai_text,
                "videoId": current_video_id,
                "transcript": data_to_return_transcript, # Use the potentially defaulted variable
                "videoTitle": video_title # ★ 追加
            }
        else:
            # RAG failed, Gemini direct answer
            current_video_id = "dQw4w9WgXcQ" # Fallback dummy video ID
            try:
                yt = YouTube(f"https://www.youtube.com/watch?v={current_video_id}")
                video_title = yt.title
                print(f"--- Fetched video title: {video_title} ---")
            except Exception as e:
                print(f"--- Error fetching video title for {current_video_id}: {type(e).__name__} - {e} ---")
                traceback.print_exc() # ★ 追加: 詳細なトレースバックをログに出力
                video_title = "動画タイトルを取得できませんでした"
            actual_transcript_data = [] # ★ 変更: RAG失敗時も空リスト
            return {
                "role": "assistant",
                "content": ai_text,
                "videoId": current_video_id,
                "transcript": actual_transcript_data, # ★ 変更: 空リストを返す
                "videoTitle": video_title # ★ 追加
            }

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
