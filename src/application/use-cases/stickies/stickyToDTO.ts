import type { Sticky } from "@/domain/entities/Sticky";
import type { StickyDTO } from "../../dto/StickyDTO";

/** Converts a Sticky domain entity to a StickyDTO. */
export function stickyToDTO(sticky: Sticky): StickyDTO {
  return {
    id: sticky.id,
    userId: sticky.userId,
    title: sticky.title.toString(),
    content: sticky.content.toJSON(),
    version: sticky.version,
    sortOrder: sticky.sortOrder,
    columnIndex: sticky.columnIndex,
    createdAt: sticky.createdAt.toISOString(),
    updatedAt: sticky.updatedAt.toISOString(),
  };
}
