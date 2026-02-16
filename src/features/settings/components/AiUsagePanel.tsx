"use client";

import { useAiUsageOverviewQuery } from "@/shared/api/queries";

const ACTION_LABELS: Record<string, { label: string; description: string }> = {
  SUMMARY: { label: "Summaries", description: "AI-generated entry summaries" },
  TRANSCRIPT_YOUTUBE: {
    label: "YouTube Transcripts",
    description: "Video transcription via AI",
  },
  OCR_IMAGE: {
    label: "Image OCR",
    description: "Text extraction from images",
  },
  REMINDER_WHATSAPP: {
    label: "WhatsApp Reminders",
    description: "Scheduled WhatsApp messages",
  },
};

/* ------------------------------------------------------------------ */
/*  UsageBar                                                           */
/* ------------------------------------------------------------------ */

function getBarColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function UsageBar({ used, limit }: Readonly<{ used: number; limit: number }>) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>
          {used} / {limit}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AiUsagePanel                                                       */
/* ------------------------------------------------------------------ */

export function AiUsagePanel() {
  const { data, isLoading, error } = useAiUsageOverviewQuery();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-zinc-800/50"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4 text-sm text-red-400">
        Failed to load usage data. Try again later.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Monthly Usage</h3>
        <span className="text-xs text-zinc-500">{data.month}</span>
      </div>

      {data.items.map((item) => {
        const meta = ACTION_LABELS[item.action] ?? {
          label: item.action,
          description: "",
        };

        return (
          <div
            key={item.action}
            className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {meta.label}
                </p>
                <p className="text-xs text-zinc-500">{meta.description}</p>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <p>{item.rateLimitPerMinute}/min</p>
                {item.maxActivePerUser > 1 && (
                  <p>max {item.maxActivePerUser} active</p>
                )}
              </div>
            </div>
            <UsageBar used={item.requestsUsed} limit={item.requestsLimit} />
          </div>
        );
      })}

      <p className="pt-1 text-center text-xs text-zinc-600">
        Resets at the start of each month
      </p>
    </div>
  );
}
