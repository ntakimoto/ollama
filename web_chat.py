import torch
import streamlit as st
from smolagents import LiteLLMModel
import chromadb
import json # 追加
import os # 追加

CHAT_HISTORY_FILE = "chat_history.json" # 追加

# 追加: チャット履歴をファイルから読み込む関数
def load_chat_history():
    if os.path.exists(CHAT_HISTORY_FILE):
        try:
            with open(CHAT_HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError: # ファイルが空か壊れている場合
            return []
    return []

# 追加: チャット履歴をファイルに保存する関数
def save_chat_history(messages):
    with open(CHAT_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)

def main():
    st.title("ものがたりの作り方アシスタント")

    @st.cache_resource
    def load_model():
        return LiteLLMModel(
            model_id="ollama_chat/qwen2:7b",
            api_base="http://ollama:11434",  # Docker運用用に修正
            num_ctx=8192,
        )
    model = load_model()

    @st.cache_resource
    def load_embedder():
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer("all-MiniLM-L6-v2")
    embedder = load_embedder()

    @st.cache_resource
    def load_chroma():
        client = chromadb.PersistentClient(path="chroma_db")
        return client.get_or_create_collection("book")
    collection = load_chroma()

    if "messages" not in st.session_state:
        st.session_state["messages"] = load_chat_history()

    for msg in st.session_state["messages"]:
        if isinstance(msg.get("content"), list) and len(msg["content"]) > 0 and isinstance(msg["content"][0], dict) and "text" in msg["content"][0]:
            st.chat_message(msg["role"]).write(msg["content"][0]["text"])
        elif isinstance(msg.get("content"), str):
            st.chat_message(msg["role"]).write(msg["content"])

    user_input = st.chat_input("質問を入力してください")

    if user_input:
        st.write(user_input)
        st.session_state["messages"].append({"role": "user", "content": [{"type": "text", "text": user_input}]})
        query_vec = embedder.encode([user_input])[0].tolist()
        results = collection.query(query_embeddings=[query_vec], n_results=3)
        related = "\n".join(results["documents"][0]) if results["documents"] else "（該当する内容が見つかりませんでした）"

        system_prompt = (
            "以下は書籍からの抜粋です。ユーザーの質問に対し、できるだけこの抜粋を参考に日本語で答えてください。\n\n"
            f"【書籍抜粋】\n{related}\n\n【質問】{user_input}"
        )
        user_msg_for_llm = {"role": "user", "content": [{"type": "text", "text": system_prompt}]}

        with st.spinner("AIが考え中..."):
            response = model([user_msg_for_llm])
        ai_text = response.content.replace("書籍の抜粋から理解すると、", "")
        ai_msg = {"role": "assistant", "content": [{"type": "text", "text": ai_text}]}
        st.session_state["messages"].append(ai_msg)
        save_chat_history(st.session_state["messages"])
        st.rerun()

if __name__ == "__main__":
    main()