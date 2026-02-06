"use client";

import { X } from "lucide-react";
import type { ApiTopic } from "@/shared/api/sdk";

// ============================================================================
// TopicPill Component
// ============================================================================

export interface TopicPillProps {
  readonly topic: ApiTopic;
  readonly onDelete: () => void;
}

export function TopicPill({ topic, onDelete }: TopicPillProps) {
  return (
    <div
      data-testid={`topic-pill-${topic.id}`}
      aria-label={`Topic ${topic.name}`}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all"
    >
      {/* Color indicator */}
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: topic.color }}
      />

      {/* Name */}
      <span className="text-white text-sm font-medium">{topic.name}</span>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete topic ${topic.name}`}
        className="ml-1 p-1 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
