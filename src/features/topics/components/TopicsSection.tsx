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
      <div className="flex items-center justify-between mb-6">
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 font-medium text-sm hover:bg-sky-500/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add topic
        </button>
      </div>

      {/* Topics list or empty state */}
      <div className="flex-1 overflow-y-auto">
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
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-white/20" />
            </div>
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
