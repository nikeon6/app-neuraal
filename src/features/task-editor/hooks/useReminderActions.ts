import { useState, useCallback, useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  createReminderAndInvalidate,
  updateReminderAndInvalidate,
} from "@/shared/api/mutations";
import { usePendingReminderQuery } from "@/shared/api/queries";
import { ApiError } from "@/shared/api/apiClient";

/**
 * Check if a reminder API error indicates the reminder was already
 * sent/processed (409 Conflict or 400 Bad Request).
 */
function isReminderAlreadyProcessed(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 409 || error.status === 400)
  );
}

/**
 * Hook encapsulating reminder state and actions (create / reschedule / cancel).
 *
 * Initializes activeReminderId from the server via usePendingReminderQuery,
 * so the reminder indicator persists across day navigation.
 */
export function useReminderActions(entryId: string, queryClient: QueryClient) {
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [activeReminderId, setActiveReminderId] = useState<string | null>(null);
  const [isReminderSaving, setIsReminderSaving] = useState(false);

  const { data: pendingReminder } = usePendingReminderQuery(entryId);

  useEffect(() => {
    if (pendingReminder) {
      setActiveReminderId(pendingReminder.id);
    } else if (pendingReminder === null) {
      setActiveReminderId(null);
    }
  }, [pendingReminder]);

  const handleCreateReminder = useCallback(
    async (
      scheduledAt: string,
      channel: "whatsapp" | "email" | "push" | "sms",
      message?: string,
    ) => {
      setIsReminderSaving(true);
      try {
        const reminder = await createReminderAndInvalidate(queryClient, {
          entryId,
          scheduledAt,
          channel,
          message: message ?? null,
        });
        setActiveReminderId(reminder.id);
        setIsReminderDialogOpen(false);
        console.info("[TaskEditor] Reminder scheduled:", reminder.id);
      } catch (error) {
        console.error("[TaskEditor] create reminder failed:", error);
      } finally {
        setIsReminderSaving(false);
      }
    },
    [queryClient, entryId],
  );

  const handleRescheduleReminder = useCallback(
    async (scheduledAt: string) => {
      if (!activeReminderId) return;
      setIsReminderSaving(true);
      try {
        await updateReminderAndInvalidate(
          queryClient,
          activeReminderId,
          entryId,
          { scheduledAt },
        );
        setIsReminderDialogOpen(false);
        console.info("[TaskEditor] Reminder rescheduled.");
      } catch (error) {
        if (isReminderAlreadyProcessed(error)) {
          console.warn(
            "[TaskEditor] Reminder already sent or processed, clearing local state.",
          );
          setActiveReminderId(null);
          setIsReminderDialogOpen(false);
        } else {
          console.error("[TaskEditor] reschedule reminder failed:", error);
        }
      } finally {
        setIsReminderSaving(false);
      }
    },
    [queryClient, activeReminderId, entryId],
  );

  const handleCancelReminder = useCallback(async () => {
    if (!activeReminderId) return;
    setIsReminderSaving(true);
    try {
      await updateReminderAndInvalidate(
        queryClient,
        activeReminderId,
        entryId,
        { status: "canceled" },
      );
      setActiveReminderId(null);
      setIsReminderDialogOpen(false);
      console.info("[TaskEditor] Reminder canceled.");
    } catch (error) {
      if (isReminderAlreadyProcessed(error)) {
        console.warn(
          "[TaskEditor] Reminder already sent or processed, clearing local state.",
        );
        setActiveReminderId(null);
        setIsReminderDialogOpen(false);
      } else {
        console.error("[TaskEditor] cancel reminder failed:", error);
      }
    } finally {
      setIsReminderSaving(false);
    }
  }, [queryClient, activeReminderId, entryId]);

  return {
    isReminderDialogOpen,
    setIsReminderDialogOpen,
    activeReminderId,
    isReminderSaving,
    handleCreateReminder,
    handleRescheduleReminder,
    handleCancelReminder,
  };
}
