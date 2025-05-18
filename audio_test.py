import os
import speech_recognition as sr
import requests
from bs4 import BeautifulSoup

# スクリプトのディレクトリを環境変数PATHの先頭に追加し、flac.exeを見つけられるようにする
# また、sr.Recognizer.FLAC_CONVERTER にも明示的に設定する
script_dir = os.path.dirname(os.path.abspath(__file__))
flac_exe_abs_path = os.path.join(script_dir, "flac.exe")

# SpeechRecognitionライブラリにflac.exeの場所を教える (クラス属性を設定)
# これが Recognizer.get_flac_converter() 静的メソッドによって使用される
if os.path.exists(flac_exe_abs_path):
    sr.Recognizer.FLAC_CONVERTER = flac_exe_abs_path
else:
    # flac.exe が見つからない場合、ライブラリはPATH経由での検索を試みる
    # この場合、以下のPATHへの追加が役立つ可能性がある
    pass

# PATH環境変数の変更 (flac.exeがDLLを見つけるのに役立つ可能性、またはライブラリのPATH検索のフォールバックとして)
if script_dir not in os.environ["PATH"]:
    os.environ["PATH"] = script_dir + os.pathsep + os.environ["PATH"]

def recognize_speech_from_mic(recognizer, device_index_to_use): # Changed signature
    """Transcribe speech from recorded from `microphone`.

    Returns a dictionary with three keys:
    "success": a boolean indicating whether or not the API request was
               successful
    "error":   `None` if no error occured, otherwise a string containing
               an error message if the API could not be reached or
               speech was unrecognizable
    "transcription": `None` if speech could not be transcribed,
               otherwise a string containing the transcribed text
    """
    if not isinstance(recognizer, sr.Recognizer):
        raise TypeError("`recognizer` must be `Recognizer` instance")

    # Removed type check for microphone instance as it's now created internally

    response = {"success": True, "error": None, "transcription": None}
    audio = None

    try:
        print(f"DEBUG: Attempting to initialize sr.Microphone with device_index: {device_index_to_use}")
        with sr.Microphone(device_index=device_index_to_use) as source:
            print(f"DEBUG: sr.Microphone context entered. Source object: {source}")
            if not hasattr(source, 'stream') or source.stream is None:
                print("DEBUG: source.stream is None or missing immediately after __enter__!")
                raise RuntimeError("Microphone stream was not initialized correctly by context manager.")
            
            print(f"DEBUG: source.stream is {source.stream} after __enter__.")
            print("Calibrating for ambient noise...")
            recognizer.adjust_for_ambient_noise(source, duration=1)
            print("Listening...")
            audio = recognizer.listen(source)
        print("DEBUG: Exited sr.Microphone context.")

    except RuntimeError as e: # Catch explicit RuntimeError for stream init failure
        response["success"] = False
        response["error"] = str(e)
        print(f"DEBUG: Caught RuntimeError (mic stream init failed): {e}")
        return response
    except Exception as e: # Catch other exceptions during mic init/usage
        response["success"] = False
        response["error"] = f"Mic/Listen Error: {type(e).__name__}: {e}"
        print(f"DEBUG: Exception during sr.Microphone usage or listen: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return response

    if audio is None:
        if not response["error"]: # If no specific error was set yet
             response["success"] = False
             response["error"] = "Audio not captured"
        return response
    
    # try recognizing the speech in the recording
    # if a RequestError or UnknownValueError exception is caught,
    #     update the response object accordingly
    try:
        print("Recognizing speech...")
        response["transcription"] = recognizer.recognize_google(audio, language="ja-JP")
    except sr.RequestError:
        # API was unreachable or unresponsive
        response["success"] = False
        response["error"] = "API unavailable"
    except sr.UnknownValueError:
        # speech was unintelligible
        response["error"] = "Unable to recognize speech"

    return response

def fetch_webpage_text(url):
    try:
        res = requests.get(url, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        # 本文テキストだけ抽出
        return soup.get_text(separator=' ', strip=True)
    except Exception as e:
        return f"ウェブ取得エラー: {e}"

if __name__ == "__main__":
    # Debug: Print the FLAC path being set
    print(f"Setting sr.Recognizer.FLAC_CONVERTER to: {flac_exe_abs_path}")
    # sr.Recognizer.FLAC_CONVERTER = flac_exe_abs_path # This is already done by the library if found or set via env
    # Patch get_flac_converter in the actual internal module
    try:
        import importlib
        sraudio = importlib.import_module("speech_recognition.audio")
        # Check if flac_exe_abs_path exists before patching
        if os.path.exists(flac_exe_abs_path):
            sraudio.get_flac_converter = lambda: flac_exe_abs_path
            print("Patched speech_recognition.audio.get_flac_converter successfully.")
        else:
            print(f"flac.exe not found at {flac_exe_abs_path}, not patching get_flac_converter.")
    except Exception as e:
        print(f"Failed to patch speech_recognition.audio.get_flac_converter: {e}")
    # Also set environment variable as a fallback
    if os.path.exists(flac_exe_abs_path):
        os.environ["FLAC_CONVERTER"] = flac_exe_abs_path

    recognizer = sr.Recognizer()

    print("利用可能なマイクデバイス:")
    try:
        mic_names = sr.Microphone.list_microphone_names()
        if not mic_names:
            print("  利用可能なマイクが見つかりませんでした。")
        else:
            for index, name in enumerate(mic_names):
                print(f"  マイク {index}: {name}")
    except Exception as e:
        print(f"  マイクのリスト取得中にエラーが発生しました: {e}")
        print("  PyAudioが正しくインストールされていないか、オーディオデバイスに問題がある可能性があります。")

    # ユーザーにdevice_indexを入力させる
    selected_device_index = None
    try:
        user_input = input("使用するマイクの番号（device_index）を入力してください: ")
        selected_device_index = int(user_input)
        print(f"選択された device_index: {selected_device_index}")
    except Exception as e:
        print(f"入力エラー: {e}。デフォルト(None)を使用します。")

    print("マイクから音声認識を開始します。何か話してみてください。")
    print("\n連続認識モード（終了するにはCtrl+C）：")
    try:
        while True:
            speech = recognize_speech_from_mic(recognizer, selected_device_index) # Pass index
            if speech["transcription"]:
                user_input = speech["transcription"]
                print(f"認識されたテキスト: {user_input}")
                # --- ウェブ参照キーワード判定 ---
                if 'ウェブ' in user_input or '調べて' in user_input or '検索' in user_input:
                    url = 'https://ja.wikipedia.org/wiki/人工知能'  # サンプル: 固定URL。実際は動的にURLを決定可能
                    print(f"ウェブ参照: {url}")
                    web_text = fetch_webpage_text(url)
                    print(f"ウェブ情報冒頭: {web_text[:200]}...")
            else:
                print("音声を認識できませんでした。")
                if speech["error"]:
                    print(f"エラー: {speech['error']}")
                    if "Microphone stream was not initialized" in speech["error"] or \
                       "Mic/Listen Error" in speech["error"]:
                        print("マイク関連のエラーが発生しました。数秒待って再試行します。")
                        import time
                        time.sleep(2) # Wait a bit before retrying critical errors
    except KeyboardInterrupt:
        print("\n終了します。")
