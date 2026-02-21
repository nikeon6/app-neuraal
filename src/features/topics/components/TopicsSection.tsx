"use client";

import { useState, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTopicsQuery } from "@/shared/api/queries";
import { deleteTopicAndInvalidate } from "@/shared/api/mutations";
import { ConfirmDialog } from "@/shared/ui";
import type { ApiTopic } from "@/shared/api/sdk";
import { TopicPill } from "./TopicPill";
import { CreateTopicDialog } from "./CreateTopicDialog";
import { cn } from "@/shared/lib/utils";

/** Maximum topics per user (mirrors backend MAX_TOPICS_PER_USER). */
const MAX_TOPICS = 12;

function getTopicsSubtitle(
  isLoading: boolean,
  hasTopics: boolean,
  count: number,
): string {
  if (isLoading) return "Loading topics...";
  if (hasTopics) return `${count}/${MAX_TOPICS} topic${count !== 1 ? "s" : ""}`;
  return "Organize your tasks by topic";
}

// ============================================================================
// TopicsSection Component (Main Container)
// ============================================================================

export function TopicsSection() {
  const queryClient = useQueryClient();
  const { data: topics = [], isPending: isLoading } = useTopicsQuery();

  // Refs for focus management
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<ApiTopic | null>(null);

  // Handlers
  const handleOpenCreate = useCallback(() => {
    setIsCreateOpen(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleDeleteClick = useCallback((topic: ApiTopic) => {
    setTopicToDelete(topic);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (topicToDelete) {
      void deleteTopicAndInvalidate(queryClient, topicToDelete.id);
      setTopicToDelete(null);
    }
  }, [topicToDelete, queryClient]);

  const handleCancelDelete = useCallback(() => {
    setTopicToDelete(null);
  }, []);

  const hasTopics = topics.length > 0;
  const isAtLimit = topics.length >= MAX_TOPICS;

  return (
    <section
      data-testid="topics-section"
      role="region"
      aria-label="Topics management"
      className="h-full flex flex-col pl-6 lg:pl-10"
    >
      {/* Header */}
      <div className="flex items-center gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Your Topics</h2>
          <p className="text-sm text-white/50">
            {getTopicsSubtitle(isLoading, hasTopics, topics.length)}
          </p>
        </div>
        <button
          ref={addButtonRef}
          type="button"
          onClick={handleOpenCreate}
          disabled={isAtLimit}
          aria-label={
            isAtLimit ? `Topic limit reached (${MAX_TOPICS})` : "Add topic"
          }
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border backdrop-blur-sm",
            isAtLimit
              ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
              : "bg-gradient-to-r from-sky-500/20 to-indigo-500/15 border-sky-400/30 text-sky-300 shadow-[0_0_12px_-3px_rgba(56,189,248,0.25)] hover:from-sky-500/30 hover:to-indigo-500/25 hover:shadow-[0_0_16px_-3px_rgba(56,189,248,0.4)] hover:border-sky-400/50",
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          {isAtLimit ? "Limit reached" : "Add topic"}
        </button>
      </div>

      {/* Topics list or empty state */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {hasTopics ? (
          <ul className="flex flex-wrap gap-3" aria-label="Topics list">
            {topics.map((topic) => (
              <TopicPill
                key={topic.id}
                topic={topic}
                onDelete={() => handleDeleteClick(topic)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <p className="text-white/40 text-sm">
              No topics yet. Create your first topic to start organizing.
            </p>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateTopicDialog
        isOpen={isCreateOpen}
        onClose={handleCloseCreate}
        existingTopics={topics}
        triggerRef={addButtonRef}
      />

      {/* Confirm delete dialog - using shared ConfirmDialog */}
      <ConfirmDialog
        open={topicToDelete !== null}
        title="Delete topic"
        message={
          <>
            Are you sure you want to delete{" "}
            <strong className="text-white">{topicToDelete?.name ?? ""}</strong>?{" "}
            This action cannot be undone.
          </>
        }
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        closeOnBackdrop={true}
        destructive={true}
        initialFocus="cancel"
      />
    </section>
  );
}
