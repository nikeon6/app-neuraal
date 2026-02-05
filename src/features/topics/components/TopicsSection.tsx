"use client";

import { useState, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/shared/store";
import { ConfirmDialog } from "@/shared/ui";
import type { UserTopic } from "@/shared/types";
import { TopicPill } from "./TopicPill";
import { CreateTopicDialog } from "./CreateTopicDialog";

// ============================================================================
// TopicsSection Component (Main Container)
// ============================================================================

export function TopicsSection() {
  const topics = useStore((s) => s.topics);
  const removeTopic = useStore((s) => s.removeTopic);

  // Refs for focus management
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<UserTopic | null>(null);

  // Handlers
  const handleOpenCreate = useCallback(() => {
    setIsCreateOpen(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleDeleteClick = useCallback((topic: UserTopic) => {
    setTopicToDelete(topic);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (topicToDelete) {
      removeTopic(topicToDelete.id);
      setTopicToDelete(null);
    }
  }, [topicToDelete, removeTopic]);

  const handleCancelDelete = useCallback(() => {
    setTopicToDelete(null);
  }, []);

  const hasTopics = topics.length > 0;

  return (
    <section
      data-testid="topics-section"
      role="region"
      aria-label="Topics management"
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Your Topics</h2>
          <p className="text-sm text-white/50">
            {hasTopics
              ? `${topics.length} topic${topics.length !== 1 ? "s" : ""}`
              : "Organize your tasks by topic"}
          </p>
        </div>
        <button
          ref={addButtonRef}
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border backdrop-blur-sm bg-gradient-to-r from-sky-500/20 to-indigo-500/15 border-sky-400/30 text-sky-300 shadow-[0_0_12px_-3px_rgba(56,189,248,0.25)] hover:from-sky-500/30 hover:to-indigo-500/25 hover:shadow-[0_0_16px_-3px_rgba(56,189,248,0.4)] hover:border-sky-400/50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add topic
        </button>
      </div>

      {/* Topics list or empty state */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {hasTopics ? (
          <div className="flex flex-wrap gap-3">
            {topics.map((topic) => (
              <TopicPill
                key={topic.id}
                topic={topic}
                onDelete={() => handleDeleteClick(topic)}
              />
            ))}
          </div>
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
