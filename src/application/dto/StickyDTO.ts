/**
 * DTO for creating a new Sticky.
 */
export interface CreateStickyDTO {
  userId: string;
  title: string;
  content: Record<string, unknown>;
  columnIndex?: number;
}

/**
 * DTO for Sticky output.
 */
export interface StickyDTO {
  id: string;
  userId: string;
  title: string;
  content: Record<string, unknown>;
  version: number;
  sortOrder: number;
  columnIndex: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for updating a Sticky.
 * Includes version for optimistic concurrency.
 */
export interface UpdateStickyDTO {
  version: number;
  title?: string;
  content?: Record<string, unknown>;
  columnIndex?: number;
}
