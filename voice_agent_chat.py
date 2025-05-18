import os
import speech_recognition as sr
from smolagents import LiteLLMModel
import pyttsx3
import requests
from bs4 import BeautifulSoup
import subprocess
import argparse
import json
import time
import concurrent.futures
import winreg

# Set up FLAC path for SpeechRecognition
script_dir = os.path.dirname(os.path.abspath(__file__))
flac_exe_abs_path = os.path.join(script_dir, "flac.exe")
if os.path.exists(flac_exe_abs_path):
    sr.Recognizer.FLAC_CONVERTER = flac_exe_abs_path
    try:
        import importlib
        sraudio = importlib.import_module("speech_recognition.audio")
        sraudio.get_flac_converter = lambda: flac_exe_abs_path
    except Exception:
        pass
    os.environ["FLAC_CONVERTER"] = flac_exe_abs_path
if script_dir not in os.environ["PATH"]:
    os.environ["PATH"] = script_dir + os.pathsep + os.environ["PATH"]

def recognize_speech_from_mic(recognizer, device_index_to_use): # Changed signature
    response = {"success": True, "error": None, "transcription": None}
    try:
        print(f"DEBUG: Attempting to initialize sr.Microphone with device_index: {device_index_to_use}")
        with sr.Microphone(device_index=device_index_to_use) as source:
            print(f"DEBUG: sr.Microphone context entered. Source object: {source}")
            # Check stream status immediately after entering context
            if not hasattr(source, 'stream') or source.stream is None:
                print("DEBUG: source.stream is None or missing immediately after __enter__!")
                raise RuntimeError("Microphone stream was not initialized correctly by context manager.")

            print(f"DEBUG: source.stream is {source.stream} after __enter__.")
            print("Calibrating for ambient noise...") # This was in user's log
            recognizer.adjust_for_ambient_noise(source, duration=0.5) # Shorter duration
            print("Listening...（ユーザーが発言するまで待機・ゆっくり話してもOK）")
            audio = recognizer.listen(source, timeout=None, phrase_time_limit=15)
        # Exited 'with' block
        print("DEBUG: Exited sr.Microphone context.")
        print("Recognizing speech...")
        response["transcription"] = recognizer.recognize_google(audio, language="ja-JP")

    except sr.RequestError as e:
        response["success"] = False
        response["error"] = f"API unavailable: {e}"
        print(f"DEBUG: sr.RequestError: {e}")
    except sr.UnknownValueError:
        response["error"] = "Unable to recognize speech"
        print("DEBUG: sr.UnknownValueError")
    except AssertionError as e:
        response["success"] = False
        response["error"] = f"AssertionError: {e}"
        print(f"DEBUG: AssertionError: {e}")
        import traceback
        print("Traceback:")
        traceback.print_exc()
    except RuntimeError as e: # Catch the explicit RuntimeError
        response["success"] = False
        response["error"] = str(e)
        print(f"DEBUG: Caught RuntimeError: {e}")
        import traceback
        print("Traceback for RuntimeError:")
        traceback.print_exc()
    except Exception as e:
        response["success"] = False
        response["error"] = f"Exception: {type(e).__name__}: {e}" # Show type of exception
        print(f"DEBUG: Caught generic Exception in recognize_speech_from_mic: {type(e).__name__}: {e}")
        import traceback
        print("Traceback:")
        traceback.print_exc()
    return response

def speak_text(text):
    engine = pyttsx3.init()
    engine.setProperty('rate', 180)  # 読み上げ速度（お好みで調整）
    engine.setProperty('volume', 1.0)  # 音量（0.0～1.0）
    engine.say(text)
    engine.runAndWait()

def fetch_webpage_text(url):
    try:
        res = requests.get(url, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        return soup.get_text(separator=' ', strip=True)
    except Exception as e:
        return f"ウェブ取得エラー: {e}"

def fetch_web_search(query):
    """
    Google Custom Search APIで最初のヒットの本文を取得
    """
    import os
    import urllib.parse
    API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY")
    CX = os.environ.get("GOOGLE_CSE_ID", "YOUR_CSE_ID")
    search_url = (
        f"https://www.googleapis.com/customsearch/v1"
        f"?key={API_KEY}&cx={CX}&q={urllib.parse.quote(query)}"
    )
    try:
        res = requests.get(search_url, timeout=10)
        data = res.json()
        if "items" in data and len(data["items"]) > 0:
            first_url = data["items"][0]["link"]
            print(f"Google Custom Search: {first_url}")
            return fetch_webpage_text(first_url)
        elif "error" in data:
            return f"Google APIエラー: {data['error'].get('message', '')}"
        else:
            return "ウェブ検索結果が見つかりませんでした。"
    except Exception as e:
        return f"ウェブ検索エラー: {e}"

def load_chat_history(filename="chat_history.json"):
    if os.path.exists(filename):
        try:
            with open(filename, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_chat_history(history, filename="chat_history.json"):
    try:
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"会話履歴の保存に失敗: {e}")

def find_mt5_path():
    # MetaTrader 5のインストールパスをレジストリから取得（標準インストールの場合）
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\MetaQuotes\\MetaTrader 5") as key:
            path, _ = winreg.QueryValueEx(key, "InstallPath")
            exe_path = os.path.join(path, "terminal64.exe")
            if os.path.exists(exe_path):
                return exe_path
    except Exception:
        pass
    # 64bit OSで32bitアプリの場合
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\WOW6432Node\\MetaQuotes\\MetaTrader 5") as key:
            path, _ = winreg.QueryValueEx(key, "InstallPath")
            exe_path = os.path.join(path, "terminal.exe")
            if os.path.exists(exe_path):
                return exe_path
    except Exception:
        pass
    # よくあるパス
    for p in [
        r"C:\\Program Files\\MetaTrader 5\\terminal64.exe",
        r"C:\\Program Files (x86)\\MetaTrader 5\\terminal.exe"
    ]:
        if os.path.exists(p):
            return p
    return None

def launch_mt5():
    exe = find_mt5_path()
    if exe:
        subprocess.Popen([exe], shell=False)
        return True
    return False

def kill_mt5():
    # MT5プロセスを全て終了
    import psutil
    killed = False
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            if proc.info['name'] and ('terminal.exe' in proc.info['name'] or 'terminal64.exe' in proc.info['name']):
                proc.terminate()
                killed = True
        except Exception:
            pass
    return killed

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", action="store_true", help="マシンスペックを表示して終了")
    args = parser.parse_args()
    if args.spec:
        print("Machine spec display is currently disabled.")
        return

    recognizer = sr.Recognizer()
    print("利用可能なマイクデバイス:")
    try:
        mic_names = sr.Microphone.list_microphone_names()
        for index, name in enumerate(mic_names):
            print(f"  マイク {index}: {name}")
    except Exception as e:
        print(f"マイクデバイスのリスト取得に失敗: {e}")
        print("続行しますが、マイクの選択に問題がある可能性があります。")

    selected_device_index = None
    print("\nデフォルトマイクのdevice_index取得を試みます...")
    try:
        # Temporarily create a Microphone instance to get its device_index
        # Ensure it's properly closed using 'with'
        with sr.Microphone() as temp_mic_source:
            selected_device_index = temp_mic_source.device_index
        print(f"デフォルトマイクの device_index: {selected_device_index} を使用します。")
    except OSError as e:
        print(f"OSError: デフォルトマイクのdevice_index取得に失敗: {e}")
        print("マイクが見つからないか、アクセスできません。device_indexを手動で指定する必要があるかもしれません。")
        # Let selected_device_index remain None, sr.Microphone(device_index=None) will use default.
    except Exception as e:
        print(f"Exception: デフォルトマイクのdevice_index取得中に予期せぬエラー: {e}")
        # Let selected_device_index remain None
    
    model = LiteLLMModel(
        model_id="ollama_chat/qwen2:7b",
        api_base="http://127.0.0.1:11434",
        num_ctx=8192,
    )
    # 会話履歴のロード
    chat_history = load_chat_history()
    print("\n音声で質問してください（'終了' または 'exit' で終了）：")
    try:
        while True:
            print("ユーザーの発言を待機中...（発言があるまで無制限待機）")
            # Pass the determined device_index (could be None if detection failed)
            speech = recognize_speech_from_mic(recognizer, selected_device_index)
            if speech["transcription"]:
                user_input = speech["transcription"]
                print(f"あなた: {user_input}")
                if user_input.strip().lower() in ["exit", "終了"]:
                    print("終了します。")
                    break
                messages = chat_history + [
                    {"role": "user", "content": [{"type": "text", "text": user_input}]}
                ]
                print("AIが思考中...（しばらくお待ちください／Ctrl+Cで中断可）")
                response = None
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(model, messages)
                    try:
                        response = future.result()
                    except KeyboardInterrupt:
                        print("\nAI応答を中断しました。次の発言をどうぞ。")
                        future.cancel()
                        continue
                if response:
                    print("AI:", response.content)
                    speak_text(response.content)
                    chat_history.append({"role": "user", "content": [{"type": "text", "text": user_input}]})
                    chat_history.append({"role": "assistant", "content": [{"type": "text", "text": response.content}]})
            else:
                print("音声を認識できませんでした。")
                if speech["error"]:
                    print(f"エラー: {speech['error']}")
    except KeyboardInterrupt:
        print("\n終了します。")
    finally:
        save_chat_history(chat_history)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--spec":
        print("Machine spec display is currently disabled.")
    else:
        main()
