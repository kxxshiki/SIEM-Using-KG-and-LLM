import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText, Loader2, UploadCloud, XCircle } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type { UploadResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ALLOWED = [".log", ".txt", ".csv", ".json"];

export default function UploadLogs() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  // Show a running timer while the server processes the file.
  useEffect(() => {
    if (!uploading) return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [uploading]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    setResult(null);
    setError("");
    const ok = ALLOWED.some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!ok) {
      setFile(null);
      setError(`Unsupported file type. Use one of: ${ALLOWED.join(", ")}`);
      return;
    }
    setFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<UploadResult>("/logs/upload", form);
      setResult(res.data);
      setFile(null);
    } catch (err) {
      setError(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Ingestion</p>
        <h1 className="text-2xl font-bold tracking-tight">Upload Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Linux, Windows, Apache, Nginx and firewall logs in {ALLOWED.join(" · ")} format.
        </p>
      </div>

      <div className="grid max-w-3xl gap-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-xl border-2 border-dashed bg-card px-6 py-14 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED.join(",")}
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UploadCloud size={22} />
          </div>
          {file ? (
            <>
              <p className="flex items-center justify-center gap-2 font-semibold">
                <FileText size={16} /> {file.name}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <p className="font-medium">Drop a log file here, or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">{ALLOWED.join("  ·  ")}</p>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
            <XCircle size={16} /> {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button variant="gradient" onClick={upload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Analysing…
              </>
            ) : (
              "Analyze logs"
            )}
          </Button>
          {uploading && (
            <span className="font-mono text-sm text-muted-foreground">
              {elapsed}s — parsing, detecting and scoring on the server
            </span>
          )}
        </div>

        {result && (
          <Card className="gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-500">
                <CheckCircle2 size={18} /> Logs analysed successfully
              </CardTitle>
              <CardDescription>{result.filename}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Logs parsed", value: result.logs_parsed },
                  { label: "Failed lines", value: result.logs_failed },
                  { label: "Alerts created", value: result.alerts_created },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold">{s.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Automatic investigation now runs in the background. Open the Alerts page — statuses move from{" "}
                <strong>New</strong> to <strong>Confirmed threat</strong> or <strong>False positive</strong> on
                their own within seconds.
              </p>
              <Link to="/alerts">
                <Button variant="outline">View alerts</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}