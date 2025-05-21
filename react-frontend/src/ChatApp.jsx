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
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import "./App.css";

// 既存のコンポーネントは省略

// テーブル表示用コンポーネント
function JsonTable({ data }) {
  const columns = React.useMemo(() => {
    if (!data || !data.headers) return [];
    return data.headers.map((header, idx) => ({
      header,
      accessorKey: String(idx),
    }));
  }, [data]);

  const tableData = React.useMemo(() => {
    if (!data || !data.rows) return [];
    return data.rows.map(rowArr => {
      const rowObj = {};
      data.headers.forEach((_, idx) => {
        rowObj[String(idx)] = rowArr[idx];
      });
      return rowObj;
    });
  }, [data]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!data || !data.headers || !data.rows) return null;

  return (
    <div className="table-container">
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ★ 変更: messages propにデフォルト値([])を設定
function ChatHistory({ messages = [], onDeleteMessage, isThinking, thinkingDots }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, thinkingDots]); // ★ 変更: 依存配列を messages に戻す

  // 最新のアシスタント回答のインデックスを取得
  const lastAssistantIdx = (() => {
    if (messages.length === 0) return -1; // ★ messages を直接使用
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();
  return (
    <div className="chat-history">
      {messages.map((msg, idx) => { // ★ messages を直接使用
        const showRating = msg.role === "assistant" && idx === lastAssistantIdx;
        let contentToRender;
        let isJsonTable = false;
        let contentStr = null;
        // --- 修正: 配列形式のcontentにも対応 ---
        if (msg.role === "assistant") {
          if (typeof msg.content === 'string') {
            contentStr = msg.content;
          } else if (Array.isArray(msg.content) && msg.content[0]?.text) {
            contentStr = msg.content[0].text;
          }
          console.log("Original assistant message content string:", contentStr); 
          
          if (contentStr) {
            let potentialJson = "";
            // Try to extract content from a ```json ... ``` block
            const jsonBlockMatch = contentStr.match(/```json\s*([\s\S]+?)\s*```/);

            if (jsonBlockMatch && jsonBlockMatch[1]) {
              potentialJson = jsonBlockMatch[1].trim();
              console.log("Extracted from ```json block:", potentialJson);
            } else {
              // No ```json block found, or it's malformed.
              // Assume the whole contentStr might be JSON, or it's plain Markdown.
              // We'll try to parse it, and if it fails, it will be rendered as Markdown.
              potentialJson = contentStr.trim();
              console.log("No ```json block detected, or regex failed. Will attempt to parse trimmed original content:", potentialJson);
            }

            if (potentialJson) {
              try {
                const parsed = JSON.parse(potentialJson);
                console.log("Parsed content:", parsed); 
                if (parsed && parsed.is_table && parsed.type === 'table_data' && parsed.data && parsed.data.headers && parsed.data.rows) {
                  contentToRender = <JsonTable data={parsed.data} />;
                  isJsonTable = true;
                  console.log("Rendered as JSON table.");
                } else {
                  console.log("Parsed successfully, but not recognized as a valid table structure. Parsed object:", parsed);
                  if (!parsed) {
                    console.log("Reason: Parsed object is null or undefined.");
                  } else {
                    if (parsed.is_table !== true) console.log("Reason: parsed.is_table is not true. Value:", parsed.is_table);
                    if (parsed.type !== 'table_data') console.log("Reason: parsed.type is not 'table_data'. Value:", parsed.type);
                    if (!parsed.data) {
                      console.log("Reason: parsed.data is missing. Value:", parsed.data);
                    } else {
                      if (!parsed.data.headers) console.log("Reason: parsed.data.headers is missing. Value:", parsed.data.headers);
                      if (!parsed.data.rows) console.log("Reason: parsed.data.rows is missing. Value:", parsed.data.rows);
                    }
                  }
                }
              } catch (e) {
                // This catch block will now handle failures from parsing 'potentialJson'
                // If it wasn't a valid JSON (fenced or not), it will fall through to Markdown rendering.
                console.log("Failed to parse as JSON, will render as Markdown. Error:", e.message);
                console.log("Content that failed parsing:", potentialJson);
              }
            }
          }
        }
        if (!isJsonTable) {
          if (msg.role === "assistant" && contentStr) { // Only log if it was an assistant message we tried to parse
            console.log("Rendered as Markdown.");
          }
          contentToRender = <ReactMarkdown>{Array.isArray(msg.content) ? msg.content[0]?.text : msg.content}</ReactMarkdown>;
        }
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
            <div className={isJsonTable ? "msg table-msg" : "msg"}> {/* ★ 変更: roleクラスを削除 */}
              {contentToRender}
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

  // 字幕全文を連結して表示
  const allTranscriptText = transcriptLines.map(line => line.text).join(' ');

  return (
    <div className="transcript-panel">
      {allTranscriptText && (
        <div className="transcript-full-text" style={{ marginBottom: '1em', color: '#333', background: '#f9f9f9', padding: '8px', borderRadius: '4px', fontSize: '0.95em' }}>
          {allTranscriptText}
        </div>
      )}
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
const TEST_TRANSCRIPT = [];

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [videoId] = useState(TEST_VIDEO_ID);
  const [transcript, setTranscript] = useState(TEST_TRANSCRIPT);
  const [currentVideoTime] = useState(0); // setCurrentVideoTime削除
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

  // ★ 初期表示時に字幕全文を取得
  useEffect(() => {
    async function fetchInitialTranscript() {
      try {
        const res = await fetch(`/api/messages/transcript/${TEST_VIDEO_ID}`);
        if (res.ok) {
          const data = await res.json();
          setTranscript(Array.isArray(data.transcript) ? data.transcript : []);
        }
      } catch (e) {
        // エラー時は何もしない
      }
    }
    fetchInitialTranscript();
  }, []);

  // ★ 追加: サイドバー開閉ハンドラ
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // 初回チャット履歴取得
  useEffect(() => {
    setIsThinking(true);
    fetch("/api/messages")
      .then(res => {
        if (!res.ok) {
          // レスポンスがOKでない場合、エラーをスローして .catch で処理
          return res.json().then(err => { 
            // エラーレスポンスに詳細が含まれているか確認
            const errorMessage = err.detail || res.statusText || "Unknown error fetching messages";
            throw new Error(errorMessage);
          });
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data);
        } else {
          console.error("Fetched initial messages is not an array:", data);
          setMessages([]); // データが配列でない場合は空配列にフォールバック
        }
      })
      .catch((error) => {
        console.error("Failed to fetch initial messages:", error.message);
        setMessages([]); // エラー時は空の配列に設定
      })
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
    setMessages(newMessages); // Optimistic UI update

    try {
      // ★ 修正: userMessageToDelete.id ではなく userMessageIndex を使用する
      const response = await fetch(`/api/messages/${userMessageIndex}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // If API call is successful, the optimistic update was correct.
        // No need to call setMessages again with response data,
        // as the current API for DELETE doesn't return the full updated chat history.
        console.log("Message deleted successfully on server.");
      } else {
        // If API call fails, rollback the optimistic update.
        const errorData = await response.json().catch(() => ({ detail: "Failed to parse error response from server" }));
        console.error("Failed to delete message on server:", errorData.detail || response.statusText);
        setMessages(originalMessages); 
        // Optionally, inform the user about the error via a system message
        setMessages(prevMessages => [...prevMessages, {role: 'system', content: `Error: Could not delete message. ${errorData.detail || response.statusText}`}]);
      }
    } catch (error) {
      console.error("Error during handleDeleteMessage fetch operation:", error);
      setMessages(originalMessages); // Rollback on network error or other exceptions
      setMessages(prevMessages => [...prevMessages, {role: 'system', content: `Error: Could not delete message. ${error.message}`}]);
    }
  };

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