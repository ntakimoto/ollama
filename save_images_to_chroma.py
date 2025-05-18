# save_images_to_chroma.py (仮の構成)
import os
import chromadb
from sentence_transformers import SentenceTransformer
from PIL import Image
import glob

def save_images_to_chroma(image_folder_path, chroma_db_path="chroma_db", collection_name="image_vectors"):
    # 1. モデルのロード
    # model = SentenceTransformer('clip-ViT-B-32') # 画像用モデル

    # 2. ChromaDBクライアントの初期化
    # client = chromadb.PersistentClient(path=chroma_db_path)
    # collection = client.get_or_create_collection(name=collection_name)

    # 3. 画像ファイルのリストアップ (例: jpg, png)
    # image_paths = glob.glob(os.path.join(image_folder_path, "*.jpg")) + \
    #               glob.glob(os.path.join(image_folder_path, "*.png"))

    # image_embeddings = []
    # image_metadata = []
    # image_ids = []

    # for idx, img_path in enumerate(image_paths):
        # try:
            # img = Image.open(img_path)
            # embedding = model.encode(img).tolist() # PIL Imageオブジェクトをエンコード

            # image_embeddings.append(embedding)
            # image_metadata.append({"source": img_path})
            # image_ids.append(f"img_{idx}")
        # except Exception as e:
            # print(f"Error processing {img_path}: {e}")

    # if image_ids:
        # collection.add(
            # embeddings=image_embeddings,
            # metadatas=image_metadata,
            # ids=image_ids
        # )
        # print(f"Added {len(image_ids)} images to ChromaDB collection '{collection_name}'.")
    # else:
        # print("No images found or processed.")