import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown'; // ★ 追加
import "./App.css";

// 既存のコンポーネントは省略

function ChatHistory({ messages }) {
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

function YouTubePanel({ videoId }) {
  return (
    <div className="youtube-panel">
      <h3>YouTube表示画面</h3>
      {videoId && (
        <iframe
          width="100%"
          height="200"
          src={`https://www.youtube.com/embed/${videoId}`} // ここを修正しました
          title="YouTube video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}

function TranscriptPanel({ text }) {
  return (
    <div className="transcript-panel">
      <h3>対象YouTube動画の音声データをテキスト表示</h3>
      <div>{text}</div>
    </div>
  );
}

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [videoId, setVideoId] = useState("");
  const [transcript, setTranscript] = useState("");

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

    // ここからが追加・修正部分です
    // APIからの応答にvideoIdとtranscriptが含まれていると仮定
    if (data.videoId) {
      setVideoId(data.videoId);
    }
    if (data.transcript) {
      setTranscript(data.transcript);
    }
    // ここまでが追加・修正部分です
  };

  return (
    <div className="container">
      <div className="left">
        <ChatHistory messages={messages} />
        <ChatInput value={input} onChange={setInput} onSend={handleSend} />
      </div>
      <div className="right">
        <YouTubePanel videoId={videoId} />
        <TranscriptPanel text={transcript} />
      </div>
    </div>
  );
}