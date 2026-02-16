/**
 * DTO for creating a new Entry.
 */
export interface CreateEntryDTO {
  userId: string;
  date: string;
  type: "task" | "note";
  title: string;
  content: Record<string, unknown>;
  topicId?: string | null;
  completed?: boolean;
}

/**
 * DTO for Entry output.
 */
export interface EntryDTO {
  id: string;
  userId: string;
  date: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  topicId: string | null;
  completed: boolean | null;
  version: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  summary: string | null;
  summaryFormat: string | null;
  summaryUpdatedAt: string | null;
}

/**
 * DTO for updating an Entry.
 * Includes version for optimistic concurrency.
 */
export interface UpdateEntryDTO {
  version: number;
  title?: string;
  content?: Record<string, unknown>;
  topicId?: string | null;
  completed?: boolean;
  type?: "task" | "note";
}
