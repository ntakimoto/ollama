import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown'; // ★ 追加
import "./App.css";

// 既存のコンポーネントは省略

function ChatHistory({ messages, onDeleteMessage }) { // ★ 追加: onDeleteMessage prop
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  return (
    <div className="chat-history">
      {messages.map((msg, idx) => (
        <div key={idx} className={`message-container ${msg.role}`}> {/* ★ 変更: message-container を追加し、roleクラスを付与 */}
          <div className="avatar">{msg.role === "user" ? "🧑" : "🤖"}</div> {/* ★ 追加: アイコン用のdiv */}
          <div className={"msg"}> {/* ★ 変更: roleクラスを削除 */}
            <ReactMarkdown>{Array.isArray(msg.content) ? msg.content[0]?.text : msg.content}</ReactMarkdown> {/* ★ 変更: ReactMarkdown を使用 */}
          </div>
          {/* ★ 追加: ユーザーメッセージに削除ボタンを追加 */} 
          {msg.role === "user" && (
            <button 
              onClick={() => onDeleteMessage(idx)} 
              className="delete-button"
              title="Delete this message and its response"
            >
              🗑️
            </button>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function ChatInput({ value, onChange, onSend }) {
  return (
    <div className="chat-input">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSend()}
        placeholder="質問を入力してください"
      />
      <button onClick={onSend}>送信</button>
    </div>
  );
}

function YouTubePanel({ videoId, videoTitle }) { // ★ videoTitle prop を追加
  if (!videoId) {
    return <div className="youtube-panel-placeholder">YouTube動画プレーヤー</div>;
  }
  const videoSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;
  return (
    <div className="youtube-panel">
      {videoTitle && <h3 className="video-title">{videoTitle}</h3>} {/* ★ 動画タイトルを表示 */}
      <iframe
        width="100%"
        height="405" // ★ 変更: 高さを360から405に
        src={videoSrc} // ★ 変更: videoSrcを使用
        title="YouTube video"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function TranscriptPanel({ text, currentTime }) { // ★ 変更: currentTime prop を追加
  const transcriptLines = Array.isArray(text) ? text : []; // ★ 変更: text が配列であることを期待
  const currentLineRef = useRef(null);

  useEffect(() => {
    if (currentLineRef.current) {
      currentLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]); // currentTime が変わるたびにスクロール

  return (
    <div className="transcript-panel">
      <h3>対象YouTube動画の音声データをテキスト表示</h3>
      {transcriptLines.length > 0 ? (
        <ul className="transcript-list">
          {transcriptLines.map((line, index) => {
            const isActive = currentTime >= line.start && currentTime < line.start + line.duration;
            return (
              <li 
                key={index} 
                className={isActive ? "active-transcript-line" : ""}
                ref={isActive ? currentLineRef : null}
              >
                {line.text}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>字幕情報はありません。</p>
      )}
    </div>
  );
}

// テスト動画の初期値
const TEST_VIDEO_ID = "iRJvKaCGPl0";
const TEST_VIDEO_TITLE = "テスト動画";
const TEST_TRANSCRIPT = [];

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [videoId, setVideoId] = useState(TEST_VIDEO_ID); // ★ 初期値をテスト動画IDに
  const [transcript, setTranscript] = useState(TEST_TRANSCRIPT); // ★ 初期値をテスト用に
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const playerRef = useRef(null); // YouTubeプレーヤーの参照用
  const [videoTitle, setVideoTitle] = useState(TEST_VIDEO_TITLE); // ★ 初期値をテスト用に

  // 初回チャット履歴取得
  useEffect(() => {
    fetch("/api/messages") // Changed from /api/messages/gemini
      .then(res => res.json())
      .then(setMessages)
      .catch(() => setMessages([]));
  }, []);

  // メッセージ送信
  const handleSend = async () => {
    if (!input) return;
    const newMsg = { role: "user", content: input };
    setMessages(msgs => [...msgs, newMsg]);
    setInput("");
    const res = await fetch("/api/messages/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });
    const data = await res.json();
    setMessages(msgs => [...msgs, data]);

    // ★ 送信時は動画・トランスクリプトを変更しない（初期表示のまま）
    // if (data.videoId) {
    //   setVideoId(data.videoId);
    // }
    // if (data.transcript) {
    //   setTranscript(Array.isArray(data.transcript) ? data.transcript : []);
    // }
    // setCurrentVideoTime(0);
    // setVideoTitle(data.videoTitle || '');
  };

  // メッセージ削除処理
  const handleDeleteMessage = async (userMessageIndex) => {
    const originalMessages = [...messages]; // Store original messages for potential rollback
    // const userMessageToDelete = messages[userMessageIndex]; // Not strictly needed if we use userMessageIndex directly

    // Optimistically update UI
    let newMessages = [...messages];
    if (userMessageIndex + 1 < newMessages.length && newMessages[userMessageIndex + 1].role === 'assistant') {
      newMessages.splice(userMessageIndex, 2); // Remove user and AI message
    } else {
      newMessages.splice(userMessageIndex, 1); // Remove only user message
    }
    setMessages(newMessages);

    try {
      // ★ 修正: userMessageToDelete.id ではなく userMessageIndex を使用する
      const response = await fetch(`/api/messages/${userMessageIndex}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        setMessages(result.chat_history);
        // Video/Transcript clearing logic is intentionally removed as per previous request
      } else {
        const errorData = await response.json();
        console.error("Failed to delete message:", errorData.detail);
        setMessages(originalMessages); // Rollback optimistic update
        setMessages(prevMessages => [...prevMessages, {role: 'system', content: `Error deleting message: ${errorData.detail || response.statusText}`}]);
      }
    } catch (error) {
      console.error("Error in handleDeleteMessage:", error);
      setMessages(originalMessages); // Rollback optimistic update
      setMessages(prevMessages => [...prevMessages, {role: 'system', content: `Error deleting message: ${error.message}`}]);
    }
  };

  // YouTubeプレーヤーの状態変更ハンドラ
  const onPlayerStateChange = async (event) => {
    // event.data === 1 は再生中を示す (YT.PlayerState.PLAYING)
    if (event.data === 1 && videoId) {
      // 字幕情報が未取得または空なら取得
      if (!transcript || transcript.length === 0) {
        try {
          const res = await fetch(`/api/messages/transcript/${videoId}`);
          if (res.ok) {
            const data = await res.json();
            setTranscript(Array.isArray(data.transcript) ? data.transcript : []);
          }
        } catch (e) {
          // エラー時は何もしない
        }
      }
      // 1秒ごとに現在の再生時間を取得して状態を更新
      const intervalId = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const time = playerRef.current.getCurrentTime();
          setCurrentVideoTime(time);
        } else {
          clearInterval(intervalId);
        }
      }, 1000);
      return () => clearInterval(intervalId);
    }
  };

  // YouTubeプレーヤーの準備完了ハンドラ
  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    // プレーヤーが準備できたら、再生時間監視を開始
    // (onPlayerStateChange で再生開始時に監視を開始するので、ここでは不要かもしれない)
  };

  // react-youtube導入時にYouTubePanelへonPlayerStateChangeを渡す
  // <YouTubePanel videoId={videoId} videoTitle={videoTitle} onPlayerStateChange={onPlayerStateChange} />

  return (
    <div className="container">
      <div className="left">
        <ChatHistory messages={messages} onDeleteMessage={handleDeleteMessage} />
        <ChatInput value={input} onChange={setInput} onSend={handleSend} />
      </div>
      <div className="right">
        {/* YouTubePanelにonReadyとonStateChangeハンドラを渡す (react-youtube を使う場合) */}
        {/* ここでは標準のiframeなので、postMessage API等を使うか、react-youtubeのようなライブラリ導入を検討 */} 
        <YouTubePanel videoId={videoId} videoTitle={videoTitle} /> 
        <TranscriptPanel text={transcript} currentTime={currentVideoTime} />
      </div>
    </div>
  );
}