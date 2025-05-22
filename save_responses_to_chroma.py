import chromadb
from sentence_transformers import SentenceTransformer
import os
import time # ユニークID生成のために追加
import threading # Added for threading

# --- 設定 ---
VALIDATED_RESPONSES_FILE = "validated_responses.txt"  # 回答データを読み書きするテキストファイル
COLLECTION_NAME = "validated_responses_store"      # ChromaDBのコレクション名
CHROMA_DB_PATH = "chroma_db"                       # ChromaDBの永続化パス
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
PROCESSING_INTERVAL_SECONDS = 600 # Process every 60 seconds

# Global flag to signal the thread to stop
stop_event = threading.Event()

def process_responses():
    """
    Reads validated responses from the text file, saves them to ChromaDB,
    and clears the file. This function is intended to be run periodically.
    """
    print(f"{time.ctime()}: Checking for responses to process...")

    # --- 1. テキストファイルから検証済み回答データを読み込む ---
    if not os.path.exists(VALIDATED_RESPONSES_FILE):
        print(f"ファイル '{VALIDATED_RESPONSES_FILE}' が見つかりません。処理するデータがありません。")
        return

    texts_to_process = []
    try:
        # Open file in r+ mode (read and write)
        # This allows reading and then truncating if successful, within one operation.
        with open(VALIDATED_RESPONSES_FILE, "r+", encoding="utf-8") as f:
            texts_to_process = [line.strip() for line in f if line.strip()]
            
            if not texts_to_process:
                print(f"'{VALIDATED_RESPONSES_FILE}' は空です。処理するデータがありません。")
                return # Exit if no data, file remains as is.
            
            print(f"'{VALIDATED_RESPONSES_FILE}' から {len(texts_to_process)} 件のデータを読み込みました。")

            # --- ChromaDBクライアントと埋め込みモデルの初期化 ---
            # Initializing these here for each run is safer for resource management in a long-running thread,
            # though less performant if the interval is very short.
            try:
                embedder = SentenceTransformer(EMBEDDING_MODEL)
                chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
                collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)
                print(f"ChromaDBコレクション '{COLLECTION_NAME}' を使用します。")
            except Exception as e:
                print(f"ChromaDBまたは埋め込みモデルの初期化中にエラーが発生しました: {e}")
                print(f"エラーのため、'{VALIDATED_RESPONSES_FILE}' のデータはクリアされませんでした。")
                return # Do not proceed to clear the file if DB/embedder init fails

            # --- 2. ChromaDBのコレクションにデータを保存 ---
            try:
                print(f"{len(texts_to_process)} 件のデータを埋め込み中...")
                embeddings = embedder.encode(texts_to_process).tolist()
                
                timestamp_ns = time.time_ns() # ナノ秒単位のタイムスタンプ
                ids = [f"validated_item_{timestamp_ns}_{i}" for i in range(len(texts_to_process))]

                collection.add(documents=texts_to_process, embeddings=embeddings, ids=ids)
                print(f"{len(texts_to_process)} 件のデータをChromaDBコレクション '{COLLECTION_NAME}' に正常に保存しました。")

                # --- 3. 成功した場合、テキストファイルの内容をクリア ---
                f.seek(0)  # Go to the beginning of the file
                f.truncate() # Clear the file content
                print(f"ファイル '{VALIDATED_RESPONSES_FILE}' を正常にクリアしました。")

            except Exception as e_chroma:
                print(f"ChromaDBへのデータ保存中にエラーが発生しました: {e_chroma}")
                print(f"エラーのため、'{VALIDATED_RESPONSES_FILE}' のデータはクリアされませんでした。")
                # File is not truncated if ChromaDB save fails.
    
    except FileNotFoundError: # Should ideally be caught by os.path.exists, but good for robustness
        print(f"ファイル '{VALIDATED_RESPONSES_FILE}' が処理中に見つかりませんでした。")
    except Exception as e:
        # General exception for file operations or other unexpected issues
        print(f"ファイル '{VALIDATED_RESPONSES_FILE}' の処理中に予期せぬエラーが発生しました: {e}")
        print(f"エラーのため、'{VALIDATED_RESPONSES_FILE}' のデータはクリアされませんでした。")


def background_processor():
    """
    Worker function to run in a separate thread.
    Calls process_responses periodically until stop_event is set.
    """
    print("バックグラウンド処理ループを開始します。")
    while not stop_event.is_set():
        process_responses()
        # Wait for the specified interval or until stop_event is set
        # This makes the thread responsive to the stop signal even while waiting
        stop_event.wait(PROCESSING_INTERVAL_SECONDS)
    print("バックグラウンド処理ループが終了しました。")

if __name__ == "__main__":
    # このスクリプトを実行すると、バックグラウンドで定期的に VALIDATED_RESPONSES_FILE の内容が処理されます。
    print("バックグラウンド処理スレッドを開始します...")
    print(f"処理間隔: {PROCESSING_INTERVAL_SECONDS} 秒")
    print("Ctrl+C で終了します。")

    # Create and start the background thread
    # Using daemon=True so the thread automatically exits when the main program exits.
    # For more complex cleanup within the thread, daemon=False and explicit join logic before exit might be preferred.
    thread = threading.Thread(target=background_processor, daemon=True)
    thread.start()

    try:
        # Keep the main thread alive to allow the background thread to run.
        # The main thread will wait here until a KeyboardInterrupt (Ctrl+C).
        while thread.is_alive(): # Loop as long as the background thread is running
            time.sleep(1) # Check every second
    except KeyboardInterrupt:
        print("\n終了シグナル受信。バックグラウンドスレッドを停止します...")
        stop_event.set() # Signal the background thread to stop its loop
        thread.join(timeout=PROCESSING_INTERVAL_SECONDS + 5) # Wait for the thread to finish, with a timeout
        if thread.is_alive():
            print("バックグラウンドスレッドがタイムアウト後も実行中です。強制終了します。")
        else:
            print("バックグラウンドスレッドが正常に終了しました。")
    finally:
        print("プログラムを終了します。")