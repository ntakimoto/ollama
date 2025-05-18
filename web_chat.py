import torch
import streamlit as st
from smolagents import LiteLLMModel
import chromadb

def main():
    st.title("ものがたりの作り方AIアシスタント")

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
        st.session_state["messages"] = []

    # チャット履歴の表示を非表示にする（forループをコメントアウト）
    # for msg in st.session_state["messages"]:
    #     st.chat_message(msg["role"]).write(msg["content"][0]["text"])

    user_input = st.chat_input("質問を入力してください")

    if user_input:
        # 入力テキストのみを表示
        st.write(user_input)
        query_vec = embedder.encode([user_input])[0].tolist()
        results = collection.query(query_embeddings=[query_vec], n_results=3)
        related = "\n".join(results["documents"][0]) if results["documents"] else "（該当する内容が見つかりませんでした）"

        system_prompt = (
            "以下は書籍からの抜粋です。ユーザーの質問に対し、できるだけこの抜粋を参考に日本語で答えてください。\n\n"
            f"【書籍抜粋】\n{related}\n\n【質問】{user_input}"
        )
        user_msg = {"role": "user", "content": [{"type": "text", "text": system_prompt}]}
        st.session_state["messages"].append(user_msg)
        with st.spinner("AIが考え中..."):
            response = model([user_msg])
        # 回答から「書籍の抜粋から理解すると、」を除去
        ai_text = response.content.replace("書籍の抜粋から理解すると、", "")
        ai_msg = {"role": "assistant", "content": [{"type": "text", "text": ai_text}]}
        st.session_state["messages"].append(ai_msg)
        st.rerun()

if __name__ == "__main__":
    main()