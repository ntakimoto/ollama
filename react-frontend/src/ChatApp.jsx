import React, { useState, useEffect, useRef, useMemo } from "react"; // ★ MODIFIED: Added useMemo
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
              potentialJson = contentStr.trim();
              console.log("No ```json block detected, or regex failed. Will attempt to parse trimmed original content:", potentialJson);
            }

            if (potentialJson) {
              try {
                const parsed = JSON.parse(potentialJson);
                console.log("Parsed content:", parsed); 
                // NEW LOGIC: Render as table if 'data.headers' and 'data.rows' exist and are arrays.
                // This makes the data structure itself the primary condition.
                if (parsed && parsed.data && Array.isArray(parsed.data.headers) && Array.isArray(parsed.data.rows)) {
                  contentToRender = <JsonTable data={parsed.data} />;
                  isJsonTable = true;
                  console.log("Rendered as JSON table based on presence of parsed.data.headers and parsed.data.rows arrays.");
                } else {
                  console.log("Parsed JSON does not meet structural requirements for table (expected parsed.data.headers and parsed.data.rows as arrays). Will render as Markdown. Parsed object:", parsed);
                  // Detailed logging for why it's not a table under the new criteria:
                  if (!parsed) console.log("Reason: Parsed object is null or undefined.");
                  else if (!parsed.data) console.log("Reason: parsed.data is missing.");
                  else {
                    if (!Array.isArray(parsed.data.headers)) console.log("Reason: parsed.data.headers is not an array or is missing. Value:", parsed.data.headers);
                    if (!Array.isArray(parsed.data.rows)) console.log("Reason: parsed.data.rows is not an array or is missing. Value:", parsed.data.rows);
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

function YouTubePanel({ videoId }) {
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
}

function TranscriptPanel({ text, currentTime, isLoading, error }) { // ★ MODIFIED: Added isLoading, error props
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
}

// テスト動画の初期値
const TEST_VIDEO_ID = "iRJvKaCGPl0";
const TEST_TRANSCRIPT = [];

// ★ MODIFIED: テスト用のYouTube動画データをマンガ創作コンテンツに変更
const mockYouTubeVideos = [
  { id: "iRJvKaCGPl0", title: "【プロ漫画家】背景の描き方講座！パースなんて怖くない！", thumbnailUrl: "https://img.youtube.com/vi/iRJvKaCGPl0/hqdefault.jpg" },
  { id: "Qw4nVbQ1n9w", title: "【初心者向け】魅力的なキャラクターデザインのコツ５選", thumbnailUrl: "https://img.youtube.com/vi/Qw4nVbQ1n9w/hqdefault.jpg" },
  { id: "3kQ1J2Qw9nA", title: "漫画のコマ割り教室！読者を惹きつける画面構成とは？", thumbnailUrl: "https://img.youtube.com/vi/3kQ1J2Qw9nA/hqdefault.jpg" },
  { id: "2lQ1J2Qw9nB", title: "【デジタル作画】Clip Studio Paint基本操作ガイド", thumbnailUrl: "https://img.youtube.com/vi/2lQ1J2Qw9nB/hqdefault.jpg" },
  { id: "4mQ1J2Qw9nC", title: "ストーリー漫画の作り方：プロットからネームまで徹底解説", thumbnailUrl: "https://img.youtube.com/vi/4mQ1J2Qw9nC/hqdefault.jpg" },
  { id: "5nQ1J2Qw9nD", title: "【漫画家志望者必見】持ち込みで編集者に見られるポイント", thumbnailUrl: "https://img.youtube.com/vi/5nQ1J2Qw9nD/hqdefault.jpg" },
  { id: "6oQ1J2Qw9nE", title: "簡単！ちびキャラ・SDキャラの描き方", thumbnailUrl: "https://img.youtube.com/vi/6oQ1J2Qw9nE/hqdefault.jpg" },
  { id: "7pQ1J2Qw9nF", title: "【アナログ作画】Gペン・丸ペンの使い方と練習法", thumbnailUrl: "https://img.youtube.com/vi/7pQ1J2Qw9nF/hqdefault.jpg" },
  { id: "8qQ1J2Qw9nG", title: "漫画のセリフ作成術！キャラが生き生きと喋り出す秘訣", thumbnailUrl: "https://img.youtube.com/vi/8qQ1J2Qw9nG/hqdefault.jpg" },
  { id: "9rQ1J2Qw9nH", title: "【背景時短】写真から漫画背景を制作する方法", thumbnailUrl: "https://img.youtube.com/vi/9rQ1J2Qw9nH/hqdefault.jpg" },
  { id: "0sQ1J2Qw9nI", title: "漫画家の一日ルーティン！リアルな仕事現場を公開", thumbnailUrl: "https://img.youtube.com/vi/0sQ1J2Qw9nI/hqdefault.jpg" },
  { id: "1tQ1J2Qw9nJ", title: "【イラスト添削】あなたの絵が劇的に変わるアドバイス！", thumbnailUrl: "https://img.youtube.com/vi/1tQ1J2Qw9nJ/hqdefault.jpg" },
  { id: "2uQ1J2Qw9nK", title: "漫画のカラーイラスト講座：色の選び方と塗り方", thumbnailUrl: "https://img.youtube.com/vi/2uQ1J2Qw9nK/hqdefault.jpg" },
  { id: "3vQ1J2Qw9nL", title: "【同人誌制作】印刷所選びから入稿までの流れ", thumbnailUrl: "https://img.youtube.com/vi/3vQ1J2Qw9nL/hqdefault.jpg" },
  { id: "4wQ1J2Qw9nM", title: "漫画の効果線・集中線の描き方バリエーション", thumbnailUrl: "https://img.youtube.com/vi/4wQ1J2Qw9nM/hqdefault.jpg" },
  { id: "5xQ1J2Qw9nN", title: "【プロアシスタント】背景作画のスピードアップ術", thumbnailUrl: "https://img.youtube.com/vi/5xQ1J2Qw9nN/hqdefault.jpg" },
  { id: "6yQ1J2Qw9nO", title: "魅力的な表情の描き分け講座：喜怒哀楽を表現する", thumbnailUrl: "https://img.youtube.com/vi/6yQ1J2Qw9nO/hqdefault.jpg" },
  { id: "7zQ1J2Qw9nP", title: "【漫画賞】受賞するための作品作り戦略", thumbnailUrl: "https://img.youtube.com/vi/7zQ1J2Qw9nP/hqdefault.jpg" },
  { id: "8aQ1J2Qw9nQ", title: "ファンタジー世界の武器・防具デザインのアイデア", thumbnailUrl: "https://img.youtube.com/vi/8aQ1J2Qw9nQ/hqdefault.jpg" },
  { id: "9bQ1J2Qw9nR", title: "漫画家デビューへの道：体験談とアドバイス", thumbnailUrl: "https://img.youtube.com/vi/9bQ1J2Qw9nR/hqdefault.jpg" },
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
  // ★ 追加: 右カラム幅の状態とドラッグ用ref
  const [rightColumnWidth, setRightColumnWidth] = useState(40); // 初期値: 40%
  const isResizingRef = useRef(false);
  const initialMouseXRef = useRef(0);
  const initialWidthRef = useRef(0);

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
      console.log(`Calculated newWidthPercent: ${newWidthPercent}`); // デバッグログ追加
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