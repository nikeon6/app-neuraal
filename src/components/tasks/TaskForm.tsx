"use client";

import React, { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { TOPICS, DAYS, type TopicId } from "@/domain/types";

export function TaskForm() {
  const { selectedDay, setSelectedDay, addTask } = useStore();
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState<TopicId>("work");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTitle.trim()) return;
      addTask(selectedDay, newTitle, newTopic);
      setNewTitle("");
    },
    [selectedDay, newTitle, newTopic, addTask]
  );

  return (
    <form onSubmit={handleSubmit} className="task-form">
      <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
        Add new task
      </h3>

      <div className="task-form-row">
        <label htmlFor="day-select">Day</label>
        <select
          id="day-select"
          value={selectedDay}
          onChange={(e) => setSelectedDay(Number(e.target.value))}
          className="w-20"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <label htmlFor="topic-select">Topic</label>
        <select
          id="topic-select"
          value={newTopic}
          onChange={(e) => setNewTopic(e.target.value as TopicId)}
          className="w-28"
        >
          {(Object.keys(TOPICS) as TopicId[]).map((id) => (
            <option key={id} value={id}>
              {TOPICS[id].name}
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
          disabled={!newTitle.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>
    </form>
  );
}
