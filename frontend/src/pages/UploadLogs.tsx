import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, FileText, Loader2, ServerCrash, Trash2, UploadCloud, XCircle } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type { UploadResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { clearQueryCache } from "@/lib/queryCache";

const ALLOWED = [".log", ".txt", ".csv", ".json"];

export default function UploadLogs() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState("");
  const [failureAlert, setFailureAlert] = useState("");

  useEffect(() => {
    if (!uploading) return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(id);
  }, [uploading]);

  const addFiles = (selectedFiles: FileList | File[] | null) => {
    if (!selectedFiles?.length) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(selectedFiles)) {
      if (ALLOWED.some((extension) => file.name.toLowerCase().endsWith(extension))) accepted.push(file);
      else rejected.push(file.name);
    }
    setFiles((current) => {
      const next = [...current];
      for (const file of accepted) {
        if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
      }
      return next;
    });
    setResults([]);
    setFailureAlert("");
    setError(rejected.length ? `Unsupported file type: ${rejected.join(", ")}. Use ${ALLOWED.join(", ")}.` : "");
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!uploading) addFiles(event.dataTransfer.files);
  };

  const upload = async () => {
    if (!files.length || uploading) return;
    setUploading(true);
    setError("");
    setFailureAlert("");
    setResults([]);
    setUploadProgress(0);
    const succeeded: UploadResult[] = [];
    const failedFiles: { index: number; file: File }[] = [];
    const failureMessages: string[] = [];
    const serverFailureMessages: string[] = [];
    const queue = [...files];
    try {
      let nextIndex = 0;
      const uploadNext = async () => {
        while (nextIndex < queue.length) {
          const index = nextIndex++;
          const file = queue[index];
          const formData = new FormData();
          formData.append("file", file);
          try {
            const response = await api.post<UploadResult>("/logs/upload", formData);
            succeeded.push(response.data);
            setResults([...succeeded]);
          } catch (err) {
            const message = `${file.name}: ${getErrorMessage(err, "Upload failed.")}`;
            failedFiles.push({ index, file });
            failureMessages.push(message);
            if (!axios.isAxiosError(err) || !err.response || err.response.status >= 500) {
              serverFailureMessages.push(message);
            }
          } finally {
            setUploadProgress((count) => count + 1);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => uploadNext()));
      if (succeeded.length) clearQueryCache();
      setFiles(failedFiles.sort((a, b) => a.index - b.index).map(({ file }) => file));
      if (inputRef.current) inputRef.current.value = "";
      if (serverFailureMessages.length) {
        setFailureAlert(serverFailureMessages.join("\n"));
      } else if (failureMessages.length) {
        setError(`Some files could not be uploaded. ${failureMessages.join(" ")}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const total = (field: "logs_parsed" | "logs_failed" | "alerts_created") =>
    results.reduce((sum, result) => sum + result[field], 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Ingestion</p>
        <h1 className="text-2xl font-bold tracking-tight">Upload Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Linux, Windows, Apache, Nginx and firewall logs in {ALLOWED.join(" · ")} format.
        </p>
      </div>

      <div className="grid w-full max-w-5xl gap-5">
        <div
          onDragOver={(event) => { event.preventDefault(); if (!uploading) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => { if (!uploading) inputRef.current?.click(); }}
          className={cn(
            "cursor-pointer rounded-xl border-2 border-dashed bg-card px-6 py-8 text-center transition-colors sm:px-10",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(",")}
            multiple
            hidden
            disabled={uploading}
            onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }}
          />
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UploadCloud size={22} />
          </div>
          <p className="font-medium">Feed the log analyzer — drop one or more files</p>
          <p className="mt-1 text-xs text-muted-foreground">Select multiple files · {ALLOWED.join(" · ")}</p>
        </div>

        {files.length > 0 && (
          <section aria-label="Files selected for upload" className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Selected files</h2>
              <span className="text-xs text-muted-foreground">{files.length} file{files.length === 1 ? "" : "s"}</span>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card/80">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 items-center gap-3 px-4 py-3">
                  <FileText size={17} className="shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${file.name}`} disabled={uploading}
                    onClick={(event) => { event.stopPropagation(); setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); }}>
                    <Trash2 size={16} />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
            <XCircle size={16} /><span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="gradient" onClick={() => void upload()} disabled={!files.length || uploading}>
            {uploading ? <><Loader2 size={16} className="animate-spin" />Uploading {uploadProgress}/{files.length}…</> : "Analyze logs"}
          </Button>
          {uploading && <span role="status" className="font-mono text-sm text-muted-foreground">{elapsed}s — processing on the server</span>}
        </div>

        {results.length > 0 && (
          <Card className="gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-500"><CheckCircle2 size={18} />
                {results.length === 1 ? "Log analysed successfully" : `${results.length} logs analysed successfully`}
              </CardTitle>
              <CardDescription>{results.map((result) => result.filename).join(" · ")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "Logs parsed", value: total("logs_parsed") },
                  { label: "Failed lines", value: total("logs_failed") },
                  { label: "Alerts created", value: total("alerts_created") },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold">{stat.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">The number of alerts created is reported by the backend; it may be zero if no events triggered the detection rules.</p>
              <Link to="/alerts"><Button variant="outline">View alerts</Button></Link>
            </CardContent>
          </Card>
        )}
      </div>
      {failureAlert && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-5 backdrop-blur-sm" onClick={() => setFailureAlert("")}>
          <button
            type="button"
            role="alert"
            aria-label="Server error. Click to dismiss."
            onClick={() => setFailureAlert("")}
            className="group relative w-full max-w-lg cursor-pointer overflow-hidden rounded-2xl border border-rose-400/60 bg-[#100b18]/95 p-6 text-left text-white shadow-[0_0_45px_rgba(168,85,247,0.35)] outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-br from-rose-500/10 via-transparent to-purple-500/20" />
            <span className="relative flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/15 text-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.3)]">
                <ServerCrash size={25} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-lg font-semibold text-rose-200">Server error</strong>
                <span className="mt-1 block whitespace-pre-line break-words text-sm text-white/75">{failureAlert}</span>
                <span className="mt-4 block text-xs text-purple-300 group-hover:text-purple-200">Click anywhere on this alert to dismiss</span>
              </span>
              <XCircle size={18} className="shrink-0 text-white/50 transition group-hover:text-white" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
