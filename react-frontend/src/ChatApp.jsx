import React, { useState, useEffect, useRef, useMemo } from "react"; // ★ MODIFIED: Added useMemo
import ReactMarkdown from 'react-markdown'; // ★ 追加
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SendIcon from '@mui/icons-material/Send'; // ★ 追加
import PersonIcon from '@mui/icons-material/Person'; // ★ 追加 (ユーザーアバター用)
import SmartToyIcon from '@mui/icons-material/SmartToy'; // ★ 追加 (アシスタントアバター用)
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined'; // ★ 追加: 評価アイコン
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined'; // ★ 追加: 評価アイコン
import CloseIcon from '@mui/icons-material/Close'; // ★ ADDED: Close icon for sidebar
import Button from '@mui/material/Button'; // ★ ADDED: MUI Button for file upload
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

// ★ 変更: currentTime prop を追加
function TranscriptPanel({ text, currentTime, isLoading, error }) { // ★ MODIFIED: Added isLoading, error props
  const transcriptLines = useMemo(() => (Array.isArray(text) ? text : []), [text]); // ★ MODIFIED: Wrapped in useMemo
  const currentLineRef = useRef(null);

  useEffect(() => {
    if (currentLineRef.current) {
      currentLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime, transcriptLines]); // ★ MODIFIED: Added transcriptLines to dependency array

  if (isLoading) {
    return (
      <div className="transcript-panel">
        <div className="transcript-loading">Loading transcript...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transcript-panel">
        <div className="transcript-error">{error}</div>
      </div>
    );
  }

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

// ★ 追加: テスト用のYouTube動画データ (20個に増やす)
const mockYouTubeVideos = [
  { id: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up", thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
  { id: "QH2-TGUlwu4", title: "Nyan Cat [original]", thumbnailUrl: "https://i.ytimg.com/vi/QH2-TGUlwu4/hqdefault.jpg" },
  { id: "V-_O7nl0Ii0", title: "Keyboard Cat!", thumbnailUrl: "https://i.ytimg.com/vi/V-_O7nl0Ii0/hqdefault.jpg" },
  { id: "ZZ5LpwO-An4", title: "Charlie bit my finger - again !", thumbnailUrl: "https://i.ytimg.com/vi/ZZ5LpwO-An4/hqdefault.jpg" },
  { id: "tntOCGkgt98", title: "Chocolate Rain Original Song by Tay Zonday", thumbnailUrl: "https://i.ytimg.com/vi/tntOCGkgt98/hqdefault.jpg" },
  { id: "oHg5SJYRHA0", title: "The Gummy Bear Song", thumbnailUrl: "https://i.ytimg.com/vi/oHg5SJYRHA0/hqdefault.jpg" },
  { id: "yPYZpwSpKmA", title: "Crazy Frog - Axel F", thumbnailUrl: "https://i.ytimg.com/vi/yPYZpwSpKmA/hqdefault.jpg" },
  { id: "fWNaR-rxAic", title: "Baby Shark Dance", thumbnailUrl: "https://i.ytimg.com/vi/fWNaR-rxAic/hqdefault.jpg" },
  { id: "kJQP7kiw5Fk", title: "PSY - GANGNAM STYLE", thumbnailUrl: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg" },
  { id: "HPj61QnhX_A", title: "Pen Pineapple Apple Pen", thumbnailUrl: "https://i.ytimg.com/vi/HPj61QnhX_A/hqdefault.jpg" },
  { id: "jNQXAC9IVRw", title: "Me at the zoo", thumbnailUrl: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg" },
  { id: "L_jWHffIx5E", title: "David After Dentist", thumbnailUrl: "https://i.ytimg.com/vi/L_jWHffIx5E/hqdefault.jpg" },
  { id: "EwTZ2xpQwpA", title: "Rebecca Black - Friday", thumbnailUrl: "https://i.ytimg.com/vi/EwTZ2xpQwpA/hqdefault.jpg" },
  { id: "OQSNhk5ICTI", title: "Dramatic Chipmunk", thumbnailUrl: "https://i.ytimg.com/vi/OQSNhk5ICTI/hqdefault.jpg" },
  { id: "sCNrK-n68CM", title: "Shoes The Full Version", thumbnailUrl: "https://i.ytimg.com/vi/sCNrK-n68CM/hqdefault.jpg" },
  { id: "zYKupOsaJmk", title: "Potter Puppet Pals: The Mysterious Ticking Noise", thumbnailUrl: "https://i.ytimg.com/vi/zYKupOsaJmk/hqdefault.jpg" },
  { id: "KmtzQCSh6xk", title: "The Duck Song", thumbnailUrl: "https://i.ytimg.com/vi/KmtzQCSh6xk/hqdefault.jpg" },
  { id: "M3iOROuTuMA", title: "Salad Fingers Episode 1 Spoons", thumbnailUrl: "https://i.ytimg.com/vi/M3iOROuTuMA/hqdefault.jpg" },
  { id: "Y1hcc1QvM2Q", title: "Badger Badger Badger", thumbnailUrl: "https://i.ytimg.com/vi/Y1hcc1QvM2Q/hqdefault.jpg" },
  { id: "X21mJh6j9i4", title: "The Annoying Orange", thumbnailUrl: "https://i.ytimg.com/vi/X21mJh6j9i4/hqdefault.jpg" },
];

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
  // --- ADDED: Dialog states ---
  const [isFileUploadDialogOpen, setIsFileUploadDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  // --- ADDED: Transcript loading and error states ---
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(true);
  const [transcriptError, setTranscriptError] = useState(null);
  // --- ADDED: File Upload Dialog state ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileUploadError, setFileUploadError] = useState("");

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

  // ★ 初期表示時に字幕全文を取得 (with retry logic)
  useEffect(() => {
    async function fetchInitialTranscriptWithRetries() {
      setIsTranscriptLoading(true);
      setTranscriptError(null);
      // setTranscript(TEST_TRANSCRIPT); // Initial state is already TEST_TRANSCRIPT (empty array)

      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(`/api/messages/transcript/${TEST_VIDEO_ID}`);
          if (res.ok) {
            const data = await res.json();
            setTranscript(Array.isArray(data.transcript) ? data.transcript : []);
            setTranscriptError(null);
            setIsTranscriptLoading(false);
            return; // Success, exit function
          }
          // Handle non-OK response
          const errorText = await res.text().catch(() => "Could not parse error response.");
          if (attempt === maxRetries) {
            console.error(`Failed to fetch transcript after ${maxRetries} attempts. Status: ${res.status}, Response: ${errorText}`);
            setTranscriptError(`Failed to load transcript (Status: ${res.status}).`);
            setTranscript([]);
          } else {
            console.warn(`Attempt ${attempt} failed to fetch transcript. Status: ${res.status}. Retrying in ${retryDelay / 1000}s...`);
          }
        } catch (e) {
          console.error(`Attempt ${attempt} - Error fetching transcript:`, e);
          if (attempt === maxRetries) {
            setTranscriptError("Failed to load transcript due to a network or parsing error.");
            setTranscript([]);
          } else {
            console.warn(`Retrying in ${retryDelay / 1000}s...`);
          }
        }
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      setIsTranscriptLoading(false); // Ensure loading is set to false after all attempts
    }
    fetchInitialTranscriptWithRetries();
  }, []); // Empty dependency array to run once on mount, as TEST_VIDEO_ID is const

  // ★ 追加: サイドバー開閉ハンドラ
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // --- ADDED: Dialog toggle functions ---
  const toggleFileUploadDialog = () => {
    setIsFileUploadDialogOpen(!isFileUploadDialogOpen);
    setSelectedFile(null); // Reset file selection when dialog closes
    setFileUploadError(""); // Reset error message
  };

  const toggleUserDialog = () => {
    setIsUserDialogOpen(!isUserDialogOpen);
  };

  // --- ADDED: File Upload Handlers ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['.txt', '.csv'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (allowedTypes.includes(fileExtension)) {
        setSelectedFile(file);
        setFileUploadError("");
      } else {
        setSelectedFile(null);
        setFileUploadError("無効なファイル形式です。.txt または .csv ファイルを選択してください。"); // TRANSLATED
      }
    } else {
      setSelectedFile(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setFileUploadError("アップロードするファイルを選択してください。"); // TRANSLATED
      return;
    }
    // Placeholder for actual file upload logic
    console.log("ファイルをアップロード中:", selectedFile.name); // TRANSLATED
    // Example:
    // const formData = new FormData();
    // formData.append('file', selectedFile);
    // try {
    //   const response = await fetch('/api/upload', { // Replace with your actual upload endpoint
    //     method: 'POST',
    //     body: formData,
    //   });
    //   if (response.ok) {
    //     console.log('ファイルが正常にアップロードされました'); // TRANSLATED
    //     toggleFileUploadDialog(); // Close dialog on success
    //   } else {
    //     const errorData = await response.json().catch(() => ({ detail: "アップロード失敗" })); // TRANSLATED
    //     setFileUploadError(errorData.detail || "ファイルのアップロードに失敗しました。"); // TRANSLATED
    //     console.error('ファイルのアップロードに失敗しました:', errorData); // TRANSLATED
    //   }
    // } catch (error) {
    //   setFileUploadError("アップロード中にエラーが発生しました。"); // TRANSLATED
    //   console.error('ファイルアップロード中のエラー:', error); // TRANSLATED
    // }
    // For now, just close the dialog and log
    toggleFileUploadDialog();
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
          <div className="upload-icon" title="ファイルアップロード" onClick={toggleFileUploadDialog}>
            <UploadFileIcon fontSize="inherit" />
          </div>
          <div className="user-icon" title="ユーザー" onClick={toggleUserDialog}>
            <AccountCircleIcon fontSize="inherit" />
          </div>
        </div>
      </header>
      {/* ★ ADDED: Sidebar backdrop */}
      {isSidebarOpen && <div className="sidebar-backdrop" onClick={toggleSidebar}></div>}
      {/* ★ 追加: サイドバー */}
      {isSidebarOpen && (
        <div className="sidebar">
          {/* サイドバーのコンテンツはここに */}
          <div className="sidebar-header"> {/* ★ ADDED: Header for title and close button */}
            <h2>関連動画</h2>
            <button onClick={toggleSidebar} className="sidebar-close-button-icon"> {/* ★ MODIFIED: ClassName and content */}
              <CloseIcon fontSize="inherit" />
            </button>
          </div>
          <ul className="youtube-video-list">
            {mockYouTubeVideos.map(video => (
              <li key={video.id} className="youtube-video-item">
                <img src={video.thumbnailUrl} alt={video.title} className="youtube-thumbnail" />
                <div className="video-info">
                  <p className="video-title">{video.title}</p>
                  {/* <p className="video-id">ID: {video.id}</p> */}
                </div>
              </li>
            ))}
          </ul>
          {/* <button onClick={toggleSidebar} className="sidebar-close-button">閉じる</button> */} {/* ★ REMOVED: Old text button */}
        </div>
      )}
      <div className="main-content"> {/* ★ メインコンテンツをラップするdivを追加 */}
{/* --- ADDED: File Upload Dialog --- */}
      {isFileUploadDialogOpen && (
        <div className="dialog-backdrop"> {/* ★ MODIFIED: onClick removed */}
          <div className="dialog-content file-upload-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>ファイルアップロード</h2> {/* TRANSLATED */}
            <p>.txt または .csv ファイルを選択してアップロードしてください。</p> {/* TRANSLATED */}
            
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileChange}
              className="file-input"
              id="file-upload-input" // Added id for label association
            />
            <label htmlFor="file-upload-input" className="file-input-label">
              {selectedFile ? selectedFile.name : "ファイルを選択..."} {/* TRANSLATED */}
            </label>

            {fileUploadError && <p className="file-upload-error">{fileUploadError}</p>}
            
            <div className="dialog-actions">
              <Button 
                variant="contained" 
                onClick={handleFileUpload} 
                disabled={!selectedFile}
                className="upload-button-mui"
              >
                アップロード {/* TRANSLATED */}
              </Button>
            </div>

            <button onClick={toggleFileUploadDialog} className="dialog-close-button">
              <CloseIcon fontSize="inherit" />
            </button>
          </div>
        </div>
      )}

      {/* --- ADDED: User Dialog --- */}
      {isUserDialogOpen && (
        <div className="dialog-backdrop"> {/* ★ MODIFIED: onClick removed */}
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <h2>User Information</h2>
            <p>This is the user information dialog.</p>
            <button onClick={toggleUserDialog} className="dialog-close-button">
              <CloseIcon fontSize="inherit" />
            </button>
            {/* Add user information or settings here */}
          </div>
        </div>
      )}
        <div className="container">
          <div className="left">
            <ChatHistory messages={messages} onDeleteMessage={handleDeleteMessage} isThinking={isThinking} thinkingDots={thinkingDots} />
            <ChatInput value={input} onChange={setInput} onSend={handleSend} />
          </div>
          <div className="right">
            {/* YouTubePanelにonReadyとonStateChangeハンドラを渡す (react-youtube を使う場合) */}
            {/* ここでは標準のiframeなので、postMessage API等を使うか、react-youtubeのようなライブラリ導入を検討 */} 
            <YouTubePanel videoId={videoId} /> 
            <TranscriptPanel text={transcript} currentTime={currentVideoTime} isLoading={isTranscriptLoading} error={transcriptError} />
          </div>
        </div>
      </div>
    </>
  );
}