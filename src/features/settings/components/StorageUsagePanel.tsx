"use client";

import { useStorageUsageQuery } from "@/shared/api/queries";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Formats bytes into a human-readable string (e.g. 12.5 MB, 1.02 GB).
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formatted = unitIndex === 0 ? size.toString() : size.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function getBarColor(pct: number): string {
  if (pct >= 95) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-sky-500";
}

/* ------------------------------------------------------------------ */
/*  StorageBar                                                         */
/* ------------------------------------------------------------------ */

function StorageBar({
  used,
  limit,
  label,
}: Readonly<{ used: number; limit: number; label: string }>) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="text-zinc-400">
          {formatBytes(used)} / {formatBytes(limit)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-0.5 text-right text-[10px] text-zinc-500">
        {Math.round(pct)}% used
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StorageUsagePanel                                                  */
/* ------------------------------------------------------------------ */

export function StorageUsagePanel() {
  const { data, isLoading, error } = useStorageUsageQuery();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-lg bg-zinc-800/50" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4 text-sm text-red-400">
        Failed to load storage data. Try again later.
      </div>
    );
  }

  const remainingBytes = Math.max(0, data.maxUserStorageBytes - data.usedBytes);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-zinc-300">Storage</h3>

      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-4 space-y-4">
        {/* Global user quota */}
        <StorageBar
          used={data.usedBytes}
          limit={data.maxUserStorageBytes}
          label="Total storage"
        />

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-zinc-900/60 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Remaining
            </p>
            <p className="mt-0.5 text-sm font-medium text-zinc-200">
              {formatBytes(remainingBytes)}
            </p>
          </div>
          <div className="rounded-md bg-zinc-900/60 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Max per entry
            </p>
            <p className="mt-0.5 text-sm font-medium text-zinc-200">
              {formatBytes(data.maxEntryAttachmentBytes)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
