"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ALLOWED_MIME_TYPES } from "@/lib/constants";

type PublishState = "idle" | "analyzing" | "uploading" | "error";

const accept = ALLOWED_MIME_TYPES.join(",");

export function PublishForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PublishState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [userEdited, setUserEdited] = useState(false);

  const analyzeFile = useCallback(async (next: File) => {
    setState("analyzing");
    setAiNote(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", next);

    try {
      const res = await fetch("/api/artifacts/suggest-metadata", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setAiNote("AI metadata unavailable — fill in fields manually.");
        setState("idle");
        return;
      }

      if (!userEdited) {
        if (data.metadata?.title) setTitle(data.metadata.title);
        if (data.metadata?.description) setDescription(data.metadata.description);
        if (data.metadata?.tags?.length) setTags(data.metadata.tags.join(", "));
      }

      setAiNote(
        data.aiGenerated
          ? "Metadata suggested by Ollama — edit before publishing."
          : "Using filename defaults (Ollama offline).",
      );
    } catch {
      setAiNote("Could not reach AI — using filename for title.");
    } finally {
      setState("idle");
    }
  }, [userEdited]);

  const pickFile = useCallback(
    (next: File | null) => {
      if (!next) return;
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(next.type)) {
        setError(`Unsupported type: ${next.type || "unknown"}`);
        return;
      }
      setError(null);
      setFile(next);
      setUserEdited(false);
      void analyzeFile(next);
    },
    [analyzeFile],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to publish.");
      return;
    }

    setState("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("tags", tags);

    try {
      const res = await fetch("/api/artifacts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setError(data.error ?? "Publish failed.");
        return;
      }

      router.push(`/artifacts/${data.artifact.id}`);
      router.refresh();
    } catch {
      setState("error");
      setError("Network error — could not reach the server.");
    }
  }

  const busy = state === "analyzing" || state === "uploading";

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files[0] ?? null);
        }}
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center transition-colors ${
          dragOver
            ? "border-accent bg-teal-50/50"
            : "border-border bg-surface hover:border-accent/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {state === "analyzing" ? (
          <>
            <p className="text-sm font-medium text-foreground">Analyzing content…</p>
            <p className="mt-2 text-xs text-muted">Ollama is generating title, description, and tags</p>
          </>
        ) : file ? (
          <>
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="mt-1 text-xs text-muted">
              {(file.size / 1024).toFixed(1)} KB · {file.type}
            </p>
            <button
              type="button"
              className="mt-3 text-xs font-medium text-accent hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setAiNote(null);
              }}
            >
              Remove file
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">
              Drop a file here or click to browse
            </p>
            <p className="mt-2 text-xs text-muted">
              HTML, PNG, JPG, WebP, or PDF · max 10 MB
            </p>
          </>
        )}
      </div>

      {aiNote && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {aiNote}
        </p>
      )}

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setUserEdited(true);
              setTitle(e.target.value);
            }}
            placeholder="Checkout flow mockup"
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Description</span>
          <textarea
            value={description}
            onChange={(e) => {
              setUserEdited(true);
              setDescription(e.target.value);
            }}
            rows={3}
            placeholder="What is this artifact? Who is it for?"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Tags</span>
          <input
            type="text"
            value={tags}
            onChange={(e) => {
              setUserEdited(true);
              setTags(e.target.value);
            }}
            placeholder="ux, checkout, html"
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Auto-generated from content when Ollama is running.
          </span>
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!file || busy}
        className="w-full rounded-full bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "uploading"
          ? "Publishing…"
          : state === "analyzing"
            ? "Analyzing…"
            : "Publish artifact"}
      </button>
    </form>
  );
}
