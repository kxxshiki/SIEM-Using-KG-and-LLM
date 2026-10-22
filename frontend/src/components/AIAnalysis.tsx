
import { useState } from "react";

type AnalysisResult = {
  answer: string;
  mode: string;
  graph_context: {
    relationship_count: number;
    relationships: unknown[];
  };
};

export default function AIAnalysis() {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!question.trim()) {
      setError("Enter a question to analyze.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Analysis failed (${response.status}). Check the backend.`,
        );
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete AI analysis.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-analysis">
      <h2>AI Security Analysis</h2>

      <div role="group" aria-label="Analysis mode">
        <button
          type="button"
          aria-pressed={mode === "auto"}
          onClick={() => setMode("auto")}
        >
          Automatic analysis
        </button>

        <button
          type="button"
          aria-pressed={mode === "manual"}
          onClick={() => setMode("manual")}
        >
          Manual analysis
        </button>
      </div>

      <label htmlFor="ai-question">
        Ask about your security graph
      </label>

      <textarea
        id="ai-question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Explain suspicious logins, affected users, or attack paths..."
        rows={4}
      />

      <button
        type="button"
        onClick={analyze}
        disabled={loading || !question.trim()}
      >
        {loading ? "Analyzing..." : "Analyze with Ollama"}
      </button>

      {error && <p role="alert">{error}</p>}

      {result && (
        <div aria-live="polite">
          <h3>AI Analysis Result</h3>
          <p>{result.answer}</p>
          <p>
            Relationships retrieved:{" "}
            {result.graph_context.relationship_count}
          </p>
        </div>
      )}
    </section>
  );
}
