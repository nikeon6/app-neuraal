"use client";

import React, { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore, selectDateKey } from "@/shared/store";
import { useTopicsQuery } from "@/shared/api/queries";
import { createEntryAndInvalidate } from "@/shared/api/mutations";

/**
 * TaskForm — Quick-add form for creating new entries via the API.
 */
export function TaskForm() {
  const queryClient = useQueryClient();
  const dateKey = useStore(selectDateKey);
  const { data: topics = [] } = useTopicsQuery();

  const [newTitle, setNewTitle] = useState("");
  const [newTopicId, setNewTopicId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTitle.trim() || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await createEntryAndInvalidate(queryClient, {
          date: dateKey,
          type: "task",
          title: newTitle.trim(),
          content: {} as Record<string, never>,
          topicId: newTopicId || null,
        });
        setNewTitle("");
      } catch (err) {
        console.error("Failed to create entry:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [dateKey, newTitle, newTopicId, queryClient, isSubmitting],
  );

  return (
    <form onSubmit={handleSubmit} className="task-form">
      <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
        Add new task
      </h3>

      <div className="task-form-row">
        <label htmlFor="topic-select">Topic</label>
        <select
          id="topic-select"
          value={newTopicId}
          onChange={(e) => setNewTopicId(e.target.value)}
          className="w-28"
        >
          <option value="">No topic</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="task-input">Task</label>
        <input
          id="task-input"
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Enter task name..."
          className="flex-1 min-w-[140px]"
        />

        <button
          type="submit"
          disabled={!newTitle.trim() || isSubmitting}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isSubmitting ? "..." : "Add"}
          </span>
        </button>
      </div>
    </form>
  );
}
