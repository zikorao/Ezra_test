"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Suggestion =
  | { kind: "query"; label: string; href: string }
  | { kind: "artifact"; id: string; title: string; subtitle: string; href: string }
  | { kind: "tag"; label: string; href: string };

export function GallerySearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search/suggest?q=${encodeURIComponent(trimmed)}`,
      );
      const data = (await res.json()) as {
        suggestions?: Suggestion[];
        source?: "llm" | "autocomplete";
      };
      setSuggestions(data.suggestions ?? []);
      setOpen((data.suggestions?.length ?? 0) > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query);
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function submitSearch(value: string) {
    const trimmed = value.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    setOpen(false);
    router.push(`/?${params.toString()}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      navigate(suggestions[activeIndex].href);
      return;
    }
    submitSearch(query);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function iconFor(kind: Suggestion["kind"]) {
    if (kind === "query") return "⌕";
    if (kind === "tag") return "#";
    return "📄";
  }

  return (
    <form onSubmit={handleSubmit} className="relative mb-6">
      <div ref={wrapRef} className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && setOpen(suggestions.length > 0)}
            onKeyDown={handleKeyDown}
            placeholder="Search artifacts… AI-powered with smart suggestions"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="search-suggestions"
            className="h-10 w-full rounded-lg border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted/60"
          />
          {loading && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              …
            </span>
          )}

          {open && suggestions.length > 0 && (
            <ul
              id="search-suggestions"
              role="listbox"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
            >
              {suggestions.map((item, index) => (
                <li key={`${item.kind}-${item.href}-${index}`} role="option">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => navigate(item.href)}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                      index === activeIndex
                        ? "bg-teal-50 text-foreground"
                        : "hover:bg-stone-50"
                    }`}
                  >
                    <span className="mt-0.5 w-5 shrink-0 text-center text-muted">
                      {iconFor(item.kind)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {item.kind === "artifact" ? item.title : item.label}
                      </span>
                      {item.kind === "artifact" && item.subtitle && (
                        <span className="block truncate text-xs text-muted">
                          {item.subtitle}
                        </span>
                      )}
                      {item.kind === "tag" && (
                        <span className="block text-xs text-muted">Tag search</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
              setOpen(false);
              router.push("/");
            }}
            className="text-sm text-muted hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
