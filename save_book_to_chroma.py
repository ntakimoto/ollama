# save_book_to_chroma.py
import chromadb
from sentence_transformers import SentenceTransformer

# 書籍データの読み込み
with open("story.txt", encoding="utf-8") as f:
    book_lines = [line.strip() for line in f if line.strip()]

# 埋め込みモデル
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# ChromaDBセットアップ（永続化ディレクトリを指定）
chroma_client = chromadb.PersistentClient(path="chroma_db")
collection = chroma_client.get_or_create_collection("book")

# 既存データをクリア（必要に応じて）
collection.delete(where={"id": {"$ne": ""}})

# 書籍行ごとにベクトル登録
embeddings = embedder.encode(book_lines).tolist()
ids = [f"line_{i}" for i in range(len(book_lines))]
collection.add(documents=book_lines, embeddings=embeddings, ids=ids)

print("書籍データをChromaDBに登録しました。")