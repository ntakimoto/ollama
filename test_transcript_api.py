# test_transcript_api.py
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import traceback
import xml.etree.ElementTree as ET  # 追加

video_id = "iRJvKaCGPl0"
print(f"Attempting to fetch transcript for video ID: {video_id}")
try:
    transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['ja', 'en'])
    print(f"Successfully fetched transcript for {video_id}:")
    if transcript_list:
        # 最後の1行を除外して表示（重複防止）
        trimmed_list = transcript_list[:-1] if len(transcript_list) > 1 else []
        for i, item in enumerate(trimmed_list[:5]):  # Print first 5 lines as sample
            print(f"  Line {i+1}: {item}")
    else:
        print("  Transcript list is empty.")
except TranscriptsDisabled:
    print(f"Transcripts are disabled for video: {video_id}")
except NoTranscriptFound:
    print(f"No Japanese or English transcript found for video: {video_id}")
except ET.ParseError as e:
    print(f"ParseError: Could not parse transcript XML for video: {video_id} ({e})")
except Exception as e:
    print(f"An error occurred while fetching transcript for {video_id}: {type(e).__name__} - {e}")
    traceback.print_exc()
