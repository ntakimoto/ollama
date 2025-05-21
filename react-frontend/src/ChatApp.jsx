import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown'; // ★ 追加
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SendIcon from '@mui/icons-material/Send'; // ★ 追加
import PersonIcon from '@mui/icons-material/Person'; // ★ 追加 (ユーザーアバター用)
import SmartToyIcon from '@mui/icons-material/SmartToy'; // ★ 追加 (アシスタントアバター用)
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined'; // ★ 追加: 評価アイコン
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined'; // ★ 追加: 評価アイコン
import "./App.css";

// 既存のコンポーネントは省略

function ChatHistory({ messages, onDeleteMessage, isThinking, thinkingDots }) { // ★ 追加: onDeleteMessage, isThinking, thinkingDots prop
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, thinkingDots]);
  // 最新のアシスタント回答のインデックスを取得
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();
  return (
    <div className="chat-history">
      {messages.map((msg, idx) => {
        const showRating = msg.role === "assistant" && idx === lastAssistantIdx;
        return (
          <div key={idx} className={`message-container ${msg.role}` + (showRating ? ' with-rating' : '')}> {/* ★ 変更: message-container を追加し、roleクラスを付与 */}
            <div className="avatar">
              {msg.role === "user" ? <PersonIcon fontSize="inherit" /> : <SmartToyIcon fontSize="inherit" />} {/* ★ 変更: MUIアイコンを使用 */}
            </div> {/* ★ 追加: アイコン用のdiv */}
            {/* ★ 評価アイコンを吹き出しの外側（右）に表示 */}
            {showRating && (
              <div className="rating-icons-outside">
                <ThumbUpAltOutlinedIcon className="thumb-icon" fontSize="small" titleAccess="良い" />
                <ThumbDownAltOutlinedIcon className="thumb-icon" fontSize="small" titleAccess="悪い" />
              </div>
            )}
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
        );
      })}
      {/* AI思考中アニメーション */}
      {isThinking && (
        <div className="message-container assistant thinking">
          <div className="avatar">
            <SmartToyIcon fontSize="inherit" />
          </div>
          <div className="msg thinking-bubble">
            <span className="thinking-dots">{thinkingDots}</span>
          </div>
        </div>
      )}
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
      <button onClick={onSend} className="send-button"> {/* ★ 変更: className追加 */}
        <SendIcon fontSize="inherit" /> {/* ★ 変更: MUIアイコンを使用 */}
      </button>
    </div>
  );
}

function YouTubePanel({ videoId }) { // ★ videoTitle prop を削除
  if (!videoId) {
    return <div className="youtube-panel-placeholder">YouTube動画プレーヤー</div>;
  }
  const videoSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;
  return (
    <div className="youtube-panel">
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // ★ 追加: サイドバーの開閉状態
  // --- 追加: AI思考中アニメーション用 ---
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingDots, setThinkingDots] = useState('…');

  // ドットアニメーション
  useEffect(() => {
    if (!isThinking) return;
    let dotsArr = ['…', '……', '………'];
    let i = 0;
    const interval = setInterval(() => {
      setThinkingDots(dotsArr[i % dotsArr.length]);
      i++;
    }, 500);
    return () => clearInterval(interval);
  }, [isThinking]);

  // ★ 追加: サイドバー開閉ハンドラ
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // 初回チャット履歴取得
  useEffect(() => {
    setIsThinking(true);
    fetch("/api/messages") // Changed from /api/messages/gemini
      .then(res => res.json())
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setIsThinking(false));
  }, []);

  // メッセージ送信
  const handleSend = async () => {
    if (!input) return;
    const newMsg = { role: "user", content: input };
    setMessages(msgs => [...msgs, newMsg]);
    setInput("");
    setIsThinking(true);
    const res = await fetch("/api/messages/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });
    const data = await res.json();
    setMessages(msgs => [...msgs, data]);
    setIsThinking(false);

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
    <> {/* ★ Fragment を使用してヘッダーとメインコンテンツをラップ */}
      <header className="app-header">
        <div className="menu-icon" title="メニュー" onClick={toggleSidebar}> {/* ★ 変更: onClick追加 */}
          <MenuIcon fontSize="inherit" />
        </div>
        <div className="header-center">
          <h1>RAG Chat Application</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="upload-icon" title="ファイルアップロード">
            <UploadFileIcon fontSize="inherit" />
          </div>
          <div className="user-icon" title="ユーザー">
            <AccountCircleIcon fontSize="inherit" />
          </div>
        </div>
      </header>
      {/* ★ 追加: サイドバー */}
      {isSidebarOpen && (
        <div className="sidebar">
          {/* サイドバーのコンテンツはここに */}
          <p>サイドバーコンテンツ</p>
          <button onClick={toggleSidebar}>閉じる</button>
        </div>
      )}
      <div className="main-content"> {/* ★ メインコンテンツをラップするdivを追加 */}
        <div className="container">
          <div className="left">
            <ChatHistory messages={messages} onDeleteMessage={handleDeleteMessage} isThinking={isThinking} thinkingDots={thinkingDots} />
            <ChatInput value={input} onChange={setInput} onSend={handleSend} />
          </div>
          <div className="right">
            {/* YouTubePanelにonReadyとonStateChangeハンドラを渡す (react-youtube を使う場合) */}
            {/* ここでは標準のiframeなので、postMessage API等を使うか、react-youtubeのようなライブラリ導入を検討 */} 
            <YouTubePanel videoId={videoId} /> 
            <TranscriptPanel text={transcript} currentTime={currentVideoTime} />
          </div>
        </div>
      </div>
    </>
  );
}