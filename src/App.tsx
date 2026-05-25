import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Upload,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  FolderOpen,
  Sun,
  Moon,
  ArrowRight,
  Shield,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface ProcessResult {
  new_file_name: string;
  target_directory: string;
}

type AppStatus = "idle" | "dragging" | "processing" | "success" | "error";

interface Toast {
  id: number;
  type: "success" | "error";
  title: string;
  message: string;
  leaving?: boolean;
}

// ─── App ──────────────────────────────────────────────────────

function App() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDark, setIsDark] = useState(true);
  const toastIdRef = useRef(0);
  const isProcessingRef = useRef(false); // Guard against double-fire

  // ── Theme management ──

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // ── Toast helpers ──

  const addToast = useCallback(
    (type: "success" | "error", title: string, message: string) => {
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev, { id, type, title, message }]);

      // Auto-dismiss after 5s
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
      }, 5000);
    },
    []
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  // ── File validation ──

  const isValidVideoFile = (name: string): boolean => {
    const validExtensions = [
      ".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v",
    ];
    const ext = name.toLowerCase().slice(name.lastIndexOf("."));
    return validExtensions.includes(ext);
  };

  // ── Process file ──

  const processFile = useCallback(
    async (filePath: string, displayName: string) => {
      // Guard: skip if already processing
      if (isProcessingRef.current) return;

      if (!isValidVideoFile(displayName)) {
        setStatus("error");
        setErrorMessage(
          "Invalid file type. Please drop a video file (.mp4, .avi, .mkv, .mov, etc.)"
        );
        addToast("error", "Invalid File", "Only video files are supported.");
        return;
      }

      isProcessingRef.current = true;
      setFileName(displayName);
      setStatus("processing");
      setResult(null);
      setErrorMessage("");

      try {
        const res = await invoke<ProcessResult>("process_video_hash", {
          filePath,
        });
        setResult(res);
        setStatus("success");
        addToast(
          "success",
          "Hash Modified!",
          `Created ${res.new_file_name} successfully.`
        );
      } catch (err) {
        const msg =
          typeof err === "string" ? err : "An unexpected error occurred.";
        setErrorMessage(msg);
        setStatus("error");
        addToast("error", "Processing Failed", msg);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [addToast]
  );

  // Keep a ref to the latest processFile so event listeners always use the current version
  const processFileRef = useRef(processFile);
  useEffect(() => {
    processFileRef.current = processFile;
  }, [processFile]);

  // ── Tauri native drag-drop events ──
  // These events provide full file paths (unlike HTML5 drag events in webview)

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setupListeners = async () => {
      const unDragEnter = await listen("tauri://drag-enter", () => {
        if (isProcessingRef.current) return;
        setStatus((prev) =>
          prev === "idle" || prev === "error" || prev === "success"
            ? "dragging"
            : prev
        );
      });
      unlisteners.push(unDragEnter);

      const unDragLeave = await listen("tauri://drag-leave", () => {
        setStatus((prev) => (prev === "dragging" ? "idle" : prev));
      });
      unlisteners.push(unDragLeave);

      const unDragDrop = await listen<{ paths: string[] }>(
        "tauri://drag-drop",
        (event) => {
          if (isProcessingRef.current) return; // Prevent double-fire

          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            const fullPath = paths[0];
            const displayName =
              fullPath.split("\\").pop()?.split("/").pop() || fullPath;
            processFileRef.current(fullPath, displayName);
          } else {
            setStatus("idle");
          }
        }
      );
      unlisteners.push(unDragDrop);
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  // ── Browse file via Tauri dialog ──

  const handleBrowseClick = useCallback(async () => {
    if (isProcessingRef.current) return;

    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Video Files",
            extensions: [
              "mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "m4v",
            ],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        const displayName =
          selected.split("\\").pop()?.split("/").pop() || selected;
        processFile(selected, displayName);
      }
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }, [processFile]);

  // ── Reset ──

  const handleReset = () => {
    setStatus("idle");
    setFileName("");
    setResult(null);
    setErrorMessage("");
  };

  // ── Render ──

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden transition-colors duration-500 ${
        isDark
          ? "bg-dark-950 text-dark-100"
          : "bg-gradient-to-br from-slate-50 via-white to-indigo-50 text-slate-900"
      }`}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px] transition-colors duration-500 ${
            isDark ? "bg-primary/8" : "bg-indigo-200/40"
          }`}
        />
        <div
          className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px] transition-colors duration-500 ${
            isDark ? "bg-accent/6" : "bg-purple-200/30"
          }`}
        />
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[180px] transition-colors duration-500 ${
            isDark ? "bg-primary/4" : "bg-blue-100/30"
          }`}
        />
      </div>

      {/* Noise overlay removed */}

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <header
          className={`flex items-center justify-between px-8 py-4 border-b transition-colors duration-500 ${
            isDark ? "border-dark-800/60" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                RE<span className="gradient-text">hash</span>
              </h1>
              <p
                className={`text-[10px] font-medium tracking-widest uppercase ${
                  isDark ? "text-dark-400" : "text-slate-400"
                }`}
              >
                Video Hash Modifier
              </p>
            </div>
          </div>

          {/* Theme toggle */}
          <button
            id="theme-toggle"
            onClick={() => setIsDark(!isDark)}
            className={`group relative p-2.5 rounded-xl transition-all duration-300 cursor-pointer ${
              isDark
                ? "bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-dark-100"
                : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700"
            }`}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-4.5 h-4.5 transition-transform group-hover:rotate-45 duration-300" />
            ) : (
              <Moon className="w-4.5 h-4.5 transition-transform group-hover:-rotate-12 duration-300" />
            )}
          </button>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center px-8 py-6">
          <div className="w-full max-w-md animate-fade-in-up">
            {/* Drop zone */}
            <div
              id="drop-zone"
              onClick={
                status === "idle" || status === "error"
                  ? handleBrowseClick
                  : undefined
              }
              className={`
                relative flex flex-col items-center justify-center w-full min-h-[320px]
                rounded-[2rem] border-2 border-dashed p-8 transition-all duration-300 no-select
                ${status === "idle" || status === "error" ? "cursor-pointer" : ""}
                ${status === "processing" ? "cursor-wait" : ""}
                ${
                  status === "dragging"
                    ? isDark
                      ? "border-primary bg-primary/5 scale-[1.02] shadow-2xl shadow-primary/10"
                      : "border-indigo-400 bg-indigo-50/80 scale-[1.02] shadow-2xl shadow-indigo-200/40"
                    : status === "processing"
                    ? isDark
                      ? "border-dark-600 bg-dark-900/40"
                      : "border-slate-300 bg-white/60"
                    : status === "success"
                    ? isDark
                      ? "border-success/40 bg-success/5"
                      : "border-emerald-300 bg-emerald-50/60"
                    : status === "error"
                    ? isDark
                      ? "border-error/40 bg-error/5"
                      : "border-red-300 bg-red-50/60"
                    : isDark
                    ? "border-dark-700 hover:border-dark-500 bg-dark-900/30 hover:bg-dark-900/50"
                    : "border-slate-300 hover:border-indigo-300 bg-white/40 hover:bg-white/70"
                }
                ${status === "dragging" ? "animate-pulse-border" : ""}
              `}
            >
              {/* Inner content based on state */}
              <div className="flex flex-col items-center justify-center text-center gap-4">
                {status === "idle" && <IdleState isDark={isDark} />}
                {status === "dragging" && <DraggingState isDark={isDark} />}
                {status === "processing" && (
                  <ProcessingState isDark={isDark} fileName={fileName} />
                )}
                {status === "success" && result && (
                  <SuccessState
                    isDark={isDark}
                    result={result}
                    onReset={handleReset}
                  />
                )}
                {status === "error" && (
                  <ErrorState
                    isDark={isDark}
                    message={errorMessage}
                    onReset={handleReset}
                  />
                )}
              </div>
            </div>

            {/* Info bar */}
            <div
              className={`mt-8 flex items-center justify-center gap-2 text-xs transition-colors duration-500 ${
                isDark ? "text-dark-500" : "text-slate-400"
              }`}
            >
              <Shield className="w-3 h-3 flex-shrink-0" />
              <span>
                Files never leave your device. All processing is local.
              </span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer
          className={`px-6 py-3 text-center text-[11px] border-t transition-colors duration-500 ${
            isDark
              ? "border-dark-800/60 text-dark-500"
              : "border-slate-200/80 text-slate-400"
          }`}
        >
          Appends a null byte to modify the hash — no re-encoding required
        </footer>
      </div>

      {/* Toast container */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            toast={toast}
            isDark={isDark}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Idle State ───────────────────────────────────────────────

function IdleState({ isDark }: { isDark: boolean }) {
  return (
    <>
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
            isDark
              ? "bg-dark-800 text-dark-300"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          <Upload className="w-6 h-6 animate-bounce-subtle" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Drop your video file here</p>
        <p
          className={`text-xs ${isDark ? "text-dark-400" : "text-slate-400"}`}
        >
          or{" "}
          <span
            className={`font-medium underline underline-offset-2 decoration-dashed ${
              isDark
                ? "text-primary-light hover:text-primary"
                : "text-indigo-500 hover:text-indigo-600"
            } transition-colors cursor-pointer`}
          >
            browse your files
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap justify-center">
        {[".mp4", ".avi", ".mkv", ".mov", ".webm"].map((ext) => (
          <span
            key={ext}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors duration-500 ${
              isDark
                ? "bg-dark-800 text-dark-400"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {ext}
          </span>
        ))}
      </div>
    </>
  );
}

// ─── Dragging State ───────────────────────────────────────────

function DraggingState({ isDark }: { isDark: boolean }) {
  return (
    <>
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
          isDark
            ? "bg-primary/15 text-primary-light"
            : "bg-indigo-100 text-indigo-500"
        }`}
      >
        <FileVideo className="w-6 h-6" />
      </div>
      <p
        className={`text-sm font-semibold ${
          isDark ? "text-primary-light" : "text-indigo-600"
        }`}
      >
        Release to process
      </p>
      <p
        className={`text-xs ${isDark ? "text-dark-400" : "text-slate-400"}`}
      >
        Your file will be rehashed instantly
      </p>
    </>
  );
}

// ─── Processing State ─────────────────────────────────────────

function ProcessingState({
  isDark,
  fileName,
}: {
  isDark: boolean;
  fileName: string;
}) {
  return (
    <>
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
            isDark
              ? "bg-dark-800 text-primary-light"
              : "bg-indigo-50 text-indigo-500"
          }`}
        >
          <Loader2 className="w-6 h-6 animate-spin-slow" />
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">Processing…</p>
        <p
          className={`text-xs truncate max-w-[260px] ${
            isDark ? "text-dark-400" : "text-slate-400"
          }`}
        >
          {fileName}
        </p>
      </div>
      <div
        className={`w-full max-w-[220px] h-1 rounded-full overflow-hidden ${
          isDark ? "bg-dark-800" : "bg-slate-200"
        }`}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent animate-shimmer" />
      </div>
    </>
  );
}

// ─── Success State ────────────────────────────────────────────

function SuccessState({
  isDark,
  result,
  onReset,
}: {
  isDark: boolean;
  result: ProcessResult;
  onReset: () => void;
}) {
  return (
    <>
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
          isDark
            ? "bg-success/15 text-success"
            : "bg-emerald-100 text-emerald-500"
        }`}
      >
        <CheckCircle2 className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-semibold mb-2">Hash Modified!</p>
        <div
          className={`rounded-xl p-3 text-left space-y-1.5 transition-colors duration-500 ${
            isDark ? "bg-dark-800/70" : "bg-slate-100/80"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileVideo
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                isDark ? "text-dark-400" : "text-slate-400"
              }`}
            />
            <span
              className={`text-xs truncate font-medium ${
                isDark ? "text-dark-200" : "text-slate-700"
              }`}
            >
              {result.new_file_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FolderOpen
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                isDark ? "text-dark-400" : "text-slate-400"
              }`}
            />
            <span
              className={`text-[11px] truncate ${
                isDark ? "text-dark-400" : "text-slate-500"
              }`}
            >
              {result.target_directory}
            </span>
          </div>
        </div>
      </div>
      <button
        id="process-another-btn"
        onClick={(e) => {
          e.stopPropagation();
          onReset();
        }}
        className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
          isDark
            ? "bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white"
            : "bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-800"
        }`}
      >
        Process another
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>
    </>
  );
}

// ─── Error State ──────────────────────────────────────────────

function ErrorState({
  isDark,
  message,
  onReset,
}: {
  isDark: boolean;
  message: string;
  onReset: () => void;
}) {
  return (
    <>
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
          isDark ? "bg-error/15 text-error" : "bg-red-100 text-red-500"
        }`}
      >
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">Something went wrong</p>
        <p
          className={`text-xs max-w-[260px] ${
            isDark ? "text-dark-400" : "text-slate-400"
          }`}
        >
          {message}
        </p>
      </div>
      <button
        id="try-again-btn"
        onClick={(e) => {
          e.stopPropagation();
          onReset();
        }}
        className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
          isDark
            ? "bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white"
            : "bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-800"
        }`}
      >
        Try again
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>
    </>
  );
}

// ─── Toast Notification ───────────────────────────────────────

function ToastNotification({
  toast,
  isDark,
  onDismiss,
}: {
  toast: Toast;
  isDark: boolean;
  onDismiss: (id: number) => void;
}) {
  const isSuccess = toast.type === "success";
  return (
    <div
      className={`
        pointer-events-auto min-w-[320px] max-w-sm rounded-2xl p-5 shadow-2xl border transition-colors duration-500
        ${toast.leaving ? "animate-slide-out-right" : "animate-slide-in-right"}
        ${
          isDark
            ? `glass border-dark-700/50 ${
                isSuccess ? "shadow-success/5" : "shadow-error/5"
              }`
            : `glass-light border-slate-200 ${
                isSuccess ? "shadow-emerald-200/30" : "shadow-red-200/30"
              }`
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 p-1 rounded-lg ${
            isSuccess
              ? isDark
                ? "bg-success/15 text-success"
                : "bg-emerald-100 text-emerald-500"
              : isDark
              ? "bg-error/15 text-error"
              : "bg-red-100 text-red-500"
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              isDark ? "text-dark-100" : "text-slate-800"
            }`}
          >
            {toast.title}
          </p>
          <p
            className={`text-xs mt-0.5 truncate ${
              isDark ? "text-dark-400" : "text-slate-500"
            }`}
          >
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className={`p-1 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? "text-dark-500 hover:text-dark-200 hover:bg-dark-700"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default App;
