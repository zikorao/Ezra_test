"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function GallerySearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = query.trim();
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex items-center gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search artifacts… e.g. checkout mockups from Claude"
        className="h-10 flex-1 rounded-lg border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted/60"
      />
      <button
        type="submit"
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Search
      </button>
      {initialQuery && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            router.push("/");
          }}
          className="text-sm text-muted hover:text-foreground"
        >
          Clear
        </button>
      )}
    </form>
  );
}
