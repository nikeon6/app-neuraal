import { useState, useRef, useEffect, useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  summarizeEntryAndInvalidate,
  clearSummaryAndInvalidate,
} from "@/shared/api/mutations";
import { entriesQueryKey } from "@/shared/api/queries";
import { ApiError } from "@/shared/api/apiClient";

/** Result of mapping a summarize API error. */
interface SummarizeErrorResult {
  message: string | null;
  shouldClose: boolean;
}

function readApiErrorDetails(
  error: ApiError,
): Record<string, unknown> | undefined {
  if (!error.details || typeof error.details !== "object") return undefined;
  const payload = error.details as { error?: unknown };
  if (!payload.error || typeof payload.error !== "object") return undefined;
  const details = (payload.error as { details?: unknown }).details;
  if (!details || typeof details !== "object") return undefined;
  return details as Record<string, unknown>;
}

/**
 * Map a summarize API error to a user-facing message.
 */
function mapSummarizeApiError(error: unknown): SummarizeErrorResult {
  if (!(error instanceof ApiError)) {
    console.error("[TaskEditor] summarize failed:", error);
    return { message: null, shouldClose: false };
  }
  switch (error.status) {
    case 404:
      return { message: null, shouldClose: true };
    case 429: {
      const details = readApiErrorDetails(error) as
        | { resetAt?: string; remaining?: number }
        | undefined;
      const resetAt = details?.resetAt ? new Date(details.resetAt) : null;
      const waitSec = resetAt
        ? Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
        : null;
      return {
        message: waitSec
          ? `Too many requests. Try again in ${waitSec} seconds.`
          : "Too many requests. Try again later.",
        shouldClose: false,
      };
    }
    case 403:
      return {
        message: "Monthly summary limit reached. Resets next month.",
        shouldClose: false,
      };
    case 409:
      if (error.code === "CONCURRENCY_LIMIT") {
        const scope = readApiErrorDetails(error)?.scope;
        if (scope === "USER") {
          return {
            message:
              "Another summary is already in progress for a different entry.",
            shouldClose: false,
          };
        }
        return {
          message: "A summary is already in progress for this entry.",
          shouldClose: false,
        };
      }
      return {
        message: "A summary is already in progress for this entry.",
        shouldClose: false,
      };
    case 400:
      return {
        message: error.message,
        shouldClose: false,
      };
    default:
      console.error("[TaskEditor] summarize failed:", error);
      return { message: null, shouldClose: false };
  }
}

/**
 * Hook encapsulating summary state, watcher, and actions.
 *
 * Extracted from TaskEditor to reduce its Cognitive Complexity.
 */
export function useSummaryActions(
  entryId: string,
  summaryUpdatedAt: string | null | undefined,
  dateKey: string,
  queryClient: QueryClient,
  hasSummarizableContent: boolean,
  onClose?: () => void,
) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const summaryRequestedAtRef = useRef<string | null>(null);

  // When the entry's summaryUpdatedAt changes after we requested a summary,
  // clear the "thinking" state.
  useEffect(() => {
    if (!summaryRequestedAtRef.current) return;
    if (summaryUpdatedAt && summaryUpdatedAt > summaryRequestedAtRef.current) {
      summaryRequestedAtRef.current = null;
      setIsSummarizing(false);
    }
  }, [summaryUpdatedAt]);

  const handleSummarize = useCallback(async () => {
    if (isSummarizing) return;
    if (!hasSummarizableContent) {
      setSummarizeError(
        "Cannot summarize an empty entry. Add content before requesting a summary.",
      );
      return;
    }
    setSummarizeError(null);
    setIsSummarizing(true);
    summaryRequestedAtRef.current = new Date().toISOString();
    try {
      await summarizeEntryAndInvalidate(queryClient, entryId);
      console.info("[TaskEditor] Summary requested. Waiting for result...");
    } catch (error) {
      setIsSummarizing(false);
      summaryRequestedAtRef.current = null;
      const result = mapSummarizeApiError(error);
      if (result.shouldClose) {
        await queryClient.invalidateQueries({
          queryKey: entriesQueryKey(dateKey),
        });
        onClose?.();
        return;
      }
      if (result.message) {
        setSummarizeError(result.message);
      }
    }
  }, [
    isSummarizing,
    hasSummarizableContent,
    queryClient,
    entryId,
    dateKey,
    onClose,
  ]);

  const handleClearSummary = useCallback(async () => {
    try {
      await clearSummaryAndInvalidate(queryClient, entryId, dateKey);
    } catch (error) {
      console.error("[TaskEditor] Failed to clear summary:", error);
    }
  }, [queryClient, entryId, dateKey]);

  return {
    isSummarizing,
    summarizeError,
    setSummarizeError,
    handleSummarize,
    handleClearSummary,
  };
}
