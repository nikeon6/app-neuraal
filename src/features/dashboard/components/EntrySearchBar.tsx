"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, CheckSquare, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { extractPlainText } from "@/shared/lib/extractPlainText";
import { cn } from "@/shared/lib/utils";
import type { ApiEntry } from "@/shared/api/sdk";

// ============================================================================
// Types
// ============================================================================

export interface EntrySearchBarProps {
  entriesByDate: Record<string, ApiEntry[]>;
  onSelect: (entryId: string) => void;
}

interface SearchResult {
  entry: ApiEntry;
  matchField: "title" | "content";
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RESULTS = 10;
const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;

// ============================================================================
// Component
// ============================================================================

export function EntrySearchBar({
  entriesByDate,
  onSelect,
}: Readonly<EntrySearchBarProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- Debounce ----
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // ---- All entries flattened (memoized) ----
  const allEntries = useMemo(
    () => Object.values(entriesByDate).flat(),
    [entriesByDate],
  );

  // ---- Plain text cache (avoid re-extracting on every keystroke) ----
  const plainTextCache = useMemo(() => {
    const cache = new Map<string, string>();
    for (const entry of allEntries) {
      cache.set(
        entry.id,
        extractPlainText(entry.content as Record<string, unknown>),
      );
    }
    return cache;
  }, [allEntries]);

  // ---- Filtered results ----
  const results: SearchResult[] = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (q.length < MIN_QUERY_LENGTH) return [];

    const matches: SearchResult[] = [];

    for (const entry of allEntries) {
      if (matches.length >= MAX_RESULTS) break;

      if (entry.title.toLowerCase().includes(q)) {
        matches.push({ entry, matchField: "title" });
        continue;
      }

      const plain = plainTextCache.get(entry.id) ?? "";
      if (plain.toLowerCase().includes(q)) {
        matches.push({ entry, matchField: "content" });
      }
    }

    return matches;
  }, [debouncedQuery, allEntries, plainTextCache]);

  // ---- Reset highlighted index on results change ----
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  // ---- Open/close handlers ----
  const open = useCallback(() => {
    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setHighlightedIndex(-1);
  }, []);

  const handleSelect = useCallback(
    (entryId: string) => {
      onSelect(entryId);
      close();
    },
    [onSelect, close],
  );

  // ---- Click outside ----
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  // ---- Keyboard navigation ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1,
        );
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        handleSelect(results[highlightedIndex].entry.id);
      }
    },
    [results, highlightedIndex, close, handleSelect],
  );

  // ---- Helpers ----
  const showDropdown =
    isOpen && debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className="relative flex items-center self-center">
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="search-input"
            role="combobox"
            aria-expanded={showDropdown && results.length > 0}
            aria-haspopup="listbox"
            aria-label="Search entries"
            initial={{ width: 36, opacity: 0.8 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 36, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "flex items-center gap-2 overflow-hidden",
              "rounded-full px-3 h-9",
              "bg-white/5 backdrop-blur-sm border border-white/15",
            )}
          >
            <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search entries..."
              aria-autocomplete="list"
              aria-controls="entry-search-results"
              aria-activedescendant={
                highlightedIndex >= 0
                  ? `search-result-${highlightedIndex}`
                  : undefined
              }
              className={cn(
                "flex-1 min-w-0 bg-transparent text-sm text-white",
                "placeholder:text-white/30 outline-none",
              )}
            />
            <button
              type="button"
              onClick={close}
              aria-label="Close search"
              className="flex-shrink-0 p-0.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/40" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="search-button"
            type="button"
            onClick={open}
            aria-label="Search entries"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex items-center justify-center rounded-full transition-colors",
              "w-8 h-8 md:w-9 md:h-9",
              "bg-white/5 border border-white/10",
              "hover:bg-white/10 hover:border-white/20",
            )}
          >
            <Search className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/50" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Dropdown results */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute top-full left-0 mt-2 z-50",
              "w-[280px] max-h-[320px] overflow-y-auto",
              "bg-slate-900/95 backdrop-blur-md",
              "border border-white/10 rounded-xl shadow-2xl",
            )}
          >
            {results.length > 0 ? (
              <ul
                id="entry-search-results"
                role="listbox"
                aria-label="Search results"
                className="py-1"
              >
                {results.map((result, index) => (
                  <li
                    key={result.entry.id}
                    id={`search-result-${index}`}
                    role="option"
                    aria-selected={highlightedIndex === index}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(result.entry.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        highlightedIndex === index
                          ? "bg-white/10"
                          : "hover:bg-white/5",
                      )}
                    >
                      {result.entry.type === "task" ? (
                        <CheckSquare
                          className={cn(
                            "w-3.5 h-3.5 flex-shrink-0",
                            result.entry.completed
                              ? "text-emerald-400/70"
                              : "text-white/30",
                          )}
                        />
                      ) : (
                        <FileText className="w-3.5 h-3.5 flex-shrink-0 text-sky-400/50" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/90 truncate">
                          {result.entry.title || "Untitled"}
                        </p>
                        <p className="text-[11px] text-white/40">
                          {format(parseISO(result.entry.date), "MMM d")}
                          {result.matchField === "content" && (
                            <span className="ml-1.5 text-white/25">
                              — matched in content
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-4 text-center text-sm text-white/30">
                No entries found
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
