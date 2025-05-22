import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"; // ★ MODIFIED: Added useCallback
import ReactMarkdown from 'react-markdown'; // ★ 追加
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
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

// TODO: リファクタリングする
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

const ChatHistory = React.memo(function ChatHistory({ messages = [], onDeleteMessage, isThinking, thinkingDots }) {
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
          //console.log("Original assistant message content string:", contentStr); 
          
          if (contentStr) {
            let potentialJson = "";
            // Try to extract content from a ```json ... ``` block
            const jsonBlockMatch = contentStr.match(/```json\s*([\s\S]+?)\s*```/);

            if (jsonBlockMatch && jsonBlockMatch[1]) {
              potentialJson = jsonBlockMatch[1].trim();

            } else {
              potentialJson = contentStr.trim();
            }

            if (potentialJson) {
              try {
                const parsed = JSON.parse(potentialJson);
                // NEW LOGIC: Render as table if 'data.headers' and 'data.rows' exist and are arrays.
                // This makes the data structure itself the primary condition.
                if (parsed && parsed.data && Array.isArray(parsed.data.headers) && Array.isArray(parsed.data.rows)) {
                  contentToRender = <JsonTable data={parsed.data} />;
                  isJsonTable = true;
                } else {
                  // Detailed logging for why it's not a table under the new criteria:
                  // if (!parsed) console.log("Reason: Parsed object is null or undefined.");
                  // else if (!parsed.data) console.log("Reason: parsed.data is missing.");
                 //  else {
                 //    if (!Array.isArray(parsed.data.headers)) console.log("Reason: parsed.data.headers is not an array or is missing. Value:", parsed.data.headers);
                 //    if (!Array.isArray(parsed.data.rows)) console.log("Reason: parsed.data.rows is not an array or is missing. Value:", parsed.data.rows);
                 //  }
                }
              } catch (e) {
                // This catch block will now handle failures from parsing 'potentialJson'
                // If it wasn't a valid JSON (fenced or not), it will fall through to Markdown rendering.
                // console.log("Failed to parse as JSON, will render as Markdown. Error:", e.message);
                // console.log("Content that failed parsing:", potentialJson);
              }
            }
          }
        }
        if (!isJsonTable) {
          // if (msg.role === "assistant" && contentStr) { // Only log if it was an assistant message we tried to parse
          //   console.log("Rendered as Markdown.");
          // }
          contentToRender = <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeMathjax]}>{Array.isArray(msg.content) ? msg.content[0]?.text : msg.content}</ReactMarkdown>;
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
});

const ChatInput = React.memo(function ChatInput({ value, onChange, onSend }) {
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
});

// TODO: リファクタリングする
const YouTubePanel = React.memo(function YouTubePanel({ videoId }) { 
  if (!videoId) {
    return <div className="youtube-panel-placeholder">YouTube動画プレーヤー</div>;
  }
  const videoSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;
  return (
    <div className="youtube-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <iframe
        width="100%"
        height="100%"
        style={{ flex: 1, minWidth: 0, minHeight: 0, border: 0, background: '#282c34' }}
        src={videoSrc}
        title="YouTube video"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
});

// TODO: リファクタリングする
const TranscriptPanel = React.memo(function TranscriptPanel({ text, currentTime, isLoading, error }) { // ★ MODIFIED: Added isLoading, error props
  const transcriptLines = useMemo(() => (Array.isArray(text) ? text : []), [text]);
  // const currentLineRef = useRef(null); // REMOVED: This ref was for the old single-block structure

  // REMOVED: This useEffect was for scrolling the old single-block transcript.
  // The new line-by-line display would require a different approach for highlighting/scrolling the current line.
  // useEffect(() => {
  //   if (currentLineRef.current) {
  //     currentLineRef.current.scrollIntoView({
  //       behavior: "smooth",
  //       block: "center",
  //     });
  //   }
  // }, [currentTime, transcriptLines]);

  if (isLoading) {
    return (
      <div className="transcript-panel" style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid #222' }}>
        <div className="transcript-loading">Loading transcript...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transcript-panel" style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red', borderTop: '1px solid #222' }}>
        <div className="transcript-error">{error}</div>
      </div>
    );
  }

  // REMOVED: const allTranscriptText = transcriptLines.map(line => line.text).join(' ');

  return (
    <div 
      className="transcript-panel" 
      style={{ 
        flexGrow: 1, // Allow panel to grow and fill available vertical space
        overflowY: 'auto', // Enable vertical scrolling for transcript lines
        borderTop: '1px solid #222', // Add a separator from the YouTube panel
        height: '0px', // Necessary for flexGrow to work correctly in some flex contexts
        minHeight: 0,
        background: '#282c34'
      }}
    >
      {transcriptLines.length > 0 ? (
        <div className="transcript-list">
          {transcriptLines.map((line, index) => (
            <div 
              key={index} 
              className="transcript-line" // Added className for potential CSS styling
              style={{ 
                padding: '8px 12px', 
                borderBottom: '1px solid #f0f0f0', 
                cursor: 'pointer',
                fontSize: '0.9em',
                lineHeight: '1.5',
              }}
              // onClick={() => console.log("Clicked line:", line)} // Example onClick
            >
              {line.text}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#777' }}>
          No transcript available.
        </div>
      )}
    </div>
  );
});

// テスト動画の初期値
const TEST_VIDEO_ID = "iRJvKaCGPl0";
const TEST_TRANSCRIPT = [];

// ★ MODIFIED: テスト用のYouTube動画データを再生可能で字幕があるものに変更
const mockYouTubeVideos = [
  { id: "LHFiGPb-Bp8", title: "ガイダンス編", thumbnailUrl: "https://img.youtube.com/vi/LHFiGPb-Bp8/hqdefault.jpg" },
  { id: "gpemT3xIYG0", title: "第1回 〜この教科書の課題〜", thumbnailUrl: "https://img.youtube.com/vi/gpemT3xIYG0/hqdefault.jpg" },

];

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [videoId, setVideoId] = useState(TEST_VIDEO_ID);
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
  // ★ 追加: 右カラム幅の状態とドラッグ用ref
  const [rightColumnWidth, setRightColumnWidth] = useState(40); // 初期値: 40%
  const isResizingRef = useRef(false);
  const initialMouseXRef = useRef(0);
  const initialWidthRef = useRef(0);
  const [videoSearchTerm, setVideoSearchTerm] = useState(""); // ★ 追加: 動画検索キーワード

  // ドラッグ開始
  const handleMouseDownOnDivider = (e) => {
    isResizingRef.current = true;
    initialMouseXRef.current = e.clientX;
    initialWidthRef.current = rightColumnWidth;
    document.body.style.cursor = 'col-resize';
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
  };

  // ドラッグ中
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      const container = document.querySelector('.container');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const minPercent = 30;
      const maxPercent = 50;
      // ドラッグ開始時のマウス位置との差分で幅を計算
      const deltaX = initialMouseXRef.current - e.clientX;
      let newWidthPercent = initialWidthRef.current + (deltaX / containerRect.width) * 100;
      newWidthPercent = Math.max(minPercent, Math.min(maxPercent, newWidthPercent));
      setRightColumnWidth(newWidthPercent);
    };
    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
    async function fetchTranscriptForVideo(currentVideoId) {
      if (!currentVideoId) {
        setTranscript([]);
        setIsTranscriptLoading(false);
        setTranscriptError(null);
        console.log("No video ID provided, clearing transcript.");
        return;
      }

      console.log(`Fetching transcript for video ID: ${currentVideoId}`);
      setIsTranscriptLoading(true);
      setTranscriptError(null);
      setTranscript(TEST_TRANSCRIPT); // Clear previous transcript

      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // ★ MODIFIED: Use currentVideoId in the fetch URL
          const res = await fetch(`/api/messages/transcript/${currentVideoId}`);
          if (res.ok) {
            const data = await res.json();
            console.log(`Transcript data received for ${currentVideoId}:`, data);
            setTranscript(Array.isArray(data.transcript) ? data.transcript : []);
            setTranscriptError(null);
            setIsTranscriptLoading(false);
            return; // Success, exit function
          }
          const errorText = await res.text().catch(() => "Could not parse error response.");
          if (attempt === maxRetries) {
            console.error(`Failed to fetch transcript for ${currentVideoId} after ${maxRetries} attempts. Status: ${res.status}, Response: ${errorText}`);
            setTranscriptError(`Failed to load transcript (Status: ${res.status}).`);
            setTranscript([]);
          } else {
            console.warn(`Attempt ${attempt} failed for ${currentVideoId}. Status: ${res.status}. Retrying in ${retryDelay / 1000}s...`);
          }
        } catch (e) {
          console.error(`Attempt ${attempt} - Error fetching transcript for ${currentVideoId}:`, e);
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
    fetchTranscriptForVideo(videoId);
  }, [videoId]); // ★ MODIFIED: Dependency array now includes videoId

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

  // ★ ADDED: Function to handle video selection from sidebar
  const handleVideoSelect = (newVideoId) => {
    setVideoId(newVideoId);
    setIsSidebarOpen(false);
    // Transcript fetching will be handled by the useEffect hook below
  };

  // ★ 追加: フィルタリングされた動画リスト
  const filteredYouTubeVideos = useMemo(() => {
    if (!videoSearchTerm) {
      return mockYouTubeVideos;
    }
    return mockYouTubeVideos.filter(video =>
      video.title.toLowerCase().includes(videoSearchTerm.toLowerCase())
    );
  }, [videoSearchTerm]);

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
  const handleSend = useCallback(async () => { // ★ MODIFIED: Wrapped with useCallback
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
  }, [input, setMessages, setInput, setIsThinking]); // ★ MODIFIED: Added dependencies

  // メッセージ削除処理
  const handleDeleteMessage = useCallback(async (userMessageIndex) => { // ★ MODIFIED: Wrapped with useCallback
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
  }, [messages, setMessages]); // ★ MODIFIED: Added dependencies

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
            {/* ★ 変更: 「関連動画」を検索ボックスに置き換え */}
            <input
              type="text"
              placeholder="動画を検索..."
              value={videoSearchTerm}
              onChange={(e) => setVideoSearchTerm(e.target.value)}
              className="video-search-input" // CSSでスタイル調整用
            />
            <button onClick={toggleSidebar} className="sidebar-close-button-icon"> {/* ★ MODIFIED: ClassName and content */}
              <CloseIcon fontSize="inherit" />
            </button>
          </div>
          <ul className="youtube-video-list">
            {filteredYouTubeVideos.map(video => (
              <li key={video.id} className="youtube-video-item" onClick={() => handleVideoSelect(video.id)}>
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
        <div className="container" style={{ display: 'flex', width: '100%', height: 'calc(100vh - 48px)' }}>
          <div className="left" style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, maxWidth: `${100 - rightColumnWidth}%`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ChatHistory messages={messages} onDeleteMessage={handleDeleteMessage} isThinking={isThinking} thinkingDots={thinkingDots} />
            <ChatInput value={input} onChange={setInput} onSend={handleSend} />
          </div>
          {/* ★ ドラッグ用ディバイダー */}
          <div
            className="column-divider"
            style={{ width: 8, cursor: 'col-resize', background: '#282c34', zIndex: 2 }}
            onMouseDown={handleMouseDownOnDivider}
          />
          <div className="right" style={{ flexBasis: `${rightColumnWidth}%`, minWidth: '30%', maxWidth: '50%', display: 'flex', flexDirection: 'column', transition: isResizingRef.current ? 'none' : 'flex-basis 0.2s', background: '#282c34' }}>
            <YouTubePanel videoId={videoId} />
            <TranscriptPanel text={transcript} currentTime={currentVideoTime} isLoading={isTranscriptLoading} error={transcriptError} />
          </div>
        </div>
      </div>
    </>
  );
}