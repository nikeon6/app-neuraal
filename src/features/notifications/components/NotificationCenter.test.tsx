import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationCenter } from "./NotificationCenter";
import type { ApiNotification } from "@/shared/api/sdk";

// ============================================================================
// Mock Data
// ============================================================================

function createNotification(
  overrides: Partial<ApiNotification> = {},
): ApiNotification {
  return {
    id: "notif-1",
    userId: "user-123",
    type: "SUMMARY_DONE",
    title: "Summary ready",
    message: "Your entry summary is complete.",
    status: "unread",
    payload: null,
    createdAt: "2026-01-29T10:00:00Z",
    ...overrides,
  } as ApiNotification;
}

const mockNotifications: ApiNotification[] = [
  createNotification({
    id: "notif-1",
    type: "SUMMARY_DONE",
    title: "Summary ready",
    message: "Your entry summary is complete.",
    status: "unread",
    payload: { entryId: "entry-abc" },
    createdAt: "2026-01-29T12:00:00Z",
  }),
  createNotification({
    id: "notif-2",
    type: "REMINDER_SENT",
    title: "Reminder sent",
    message: "Your reminder was delivered.",
    status: "read",
    payload: { entryId: "entry-def" },
    createdAt: "2026-01-29T10:00:00Z",
  }),
  createNotification({
    id: "notif-3",
    type: "SUMMARY_FAILED",
    title: "Summary failed",
    message: "Could not generate summary.",
    status: "unread",
    payload: null,
    createdAt: "2026-01-29T11:00:00Z",
  }),
];

// ============================================================================
// Mocks
// ============================================================================

const mockNotificationsQuery = vi.fn();
const mockMarkReadMutate = vi.fn();
const mockMarkReadMutation = vi.fn();

vi.mock("@/shared/api/queries", () => ({
  useNotificationsQuery: (...args: unknown[]) =>
    mockNotificationsQuery(...args),
  useMarkNotificationReadMutation: (...args: unknown[]) =>
    mockMarkReadMutation(...args),
  getUnreadCount: (notifications: ApiNotification[] | undefined) => {
    if (!notifications) return 0;
    return notifications.filter((n) => n.status === "unread").length;
  },
}));

// Mock Framer Motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(
      (
        { children, ...props }: React.HTMLAttributes<HTMLDivElement>,
        ref: React.Ref<HTMLDivElement>,
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      ),
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock date-fns to get deterministic relative timestamps
vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 hours ago",
}));

// ============================================================================
// Helpers
// ============================================================================

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderNotificationCenter(
  props: Partial<React.ComponentProps<typeof NotificationCenter>> = {},
) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NotificationCenter {...props} />
    </QueryClientProvider>,
  );
}

function getBellButton() {
  return screen.getByRole("button", { name: /notifications/i });
}

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(getBellButton());
}

// ============================================================================
// Tests
// ============================================================================

describe("NotificationCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Pin Date.now so mock notification dates (2026-01-29) are always "recent"
    // relative to the auto-dismiss 24h filter, regardless of when tests run.
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-01-29T13:00:00Z").getTime(),
    );

    // Default: return 3 notifications (2 unread, 1 read)
    mockNotificationsQuery.mockReturnValue({
      data: mockNotifications,
      isLoading: false,
    });

    mockMarkReadMutation.mockReturnValue({
      mutate: mockMarkReadMutate,
      isPending: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Bell Button
  // --------------------------------------------------------------------------

  describe("Bell Button", () => {
    it("renders a bell button with accessible label", () => {
      renderNotificationCenter();

      const btn = getBellButton();
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("aria-haspopup", "true");
    });

    it("shows aria-expanded=false when panel is closed", () => {
      renderNotificationCenter();

      expect(getBellButton()).toHaveAttribute("aria-expanded", "false");
    });

    it("shows aria-expanded=true when panel is open", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      expect(getBellButton()).toHaveAttribute("aria-expanded", "true");
    });
  });

  // --------------------------------------------------------------------------
  // Unread Badge
  // --------------------------------------------------------------------------

  describe("Unread Badge", () => {
    it("shows unread count when there are unread notifications", () => {
      renderNotificationCenter();

      // 2 unread (notif-1 and notif-3)
      expect(getBellButton()).toHaveAttribute(
        "aria-label",
        "Notifications (2 unread)",
      );
    });

    it("does not include unread count in label when all are read", () => {
      mockNotificationsQuery.mockReturnValue({
        data: mockNotifications.map((n) => ({ ...n, status: "read" })),
        isLoading: false,
      });

      renderNotificationCenter();

      expect(getBellButton()).toHaveAttribute("aria-label", "Notifications");
    });

    it("does not show badge when there are 0 unread notifications", () => {
      mockNotificationsQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      renderNotificationCenter();

      // The badge is a <span> with the bg-sky-500 class inside the button
      const btn = getBellButton();
      const badge = btn.querySelector("span.bg-sky-500");
      expect(badge).not.toBeInTheDocument();
    });

    it("shows badge text with count", () => {
      renderNotificationCenter();

      const btn = getBellButton();
      const badge = btn.querySelector("span.bg-sky-500");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("2");
    });
  });

  // --------------------------------------------------------------------------
  // Panel Open/Close
  // --------------------------------------------------------------------------

  describe("Panel Open/Close", () => {
    it("does not show the panel by default", () => {
      renderNotificationCenter();

      expect(
        screen.queryByText("No notifications yet."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /notifications/i }),
      ).not.toBeInTheDocument();
    });

    it("opens the panel when bell button is clicked", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });

    it("closes the panel when bell button is clicked again (toggle)", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);
      expect(screen.getByText("Notifications")).toBeInTheDocument();

      // Click again to close
      await user.click(getBellButton());
      expect(
        screen.queryByText("No notifications yet."),
      ).not.toBeInTheDocument();
    });

    it("closes the panel when Escape key is pressed", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);
      expect(screen.getByText("Notifications")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(getBellButton()).toHaveAttribute("aria-expanded", "false");
      });
    });

    it("closes the panel when clicking outside", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);
      expect(screen.getByText("Notifications")).toBeInTheDocument();

      // Click on the document body (outside)
      await user.click(document.body);

      await waitFor(() => {
        expect(getBellButton()).toHaveAttribute("aria-expanded", "false");
      });
    });
  });

  // --------------------------------------------------------------------------
  // Notification List
  // --------------------------------------------------------------------------

  describe("Notification List", () => {
    it("shows panel header with unread count", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(screen.getByText("2 unread")).toBeInTheDocument();
    });

    it("does not show unread count text when all notifications are read", async () => {
      const user = userEvent.setup();
      mockNotificationsQuery.mockReturnValue({
        data: mockNotifications.map((n) => ({ ...n, status: "read" })),
        isLoading: false,
      });

      renderNotificationCenter();
      await openPanel(user);

      expect(screen.queryByText(/unread/)).not.toBeInTheDocument();
    });

    it("shows notification titles in the list", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      // notif-1 title is "Summary ready" (also matches the type label, so use getAllByText)
      // notif-2 title is "Reminder sent" (also matches type label)
      // notif-3 title is "Summary failed" (also matches type label)
      // Each appears twice: once as type label (<span>) and once as title (<p>)
      // Just verify they appear at least once
      expect(
        screen.getAllByText("Summary ready").length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText("Reminder sent").length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText("Summary failed").length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("shows notification messages when they differ from title", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      expect(
        screen.getByText("Your entry summary is complete."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Your reminder was delivered."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Could not generate summary."),
      ).toBeInTheDocument();
    });

    it("shows notification type labels with correct styling", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      // Type labels are rendered as <span class="text-xs font-medium ...">
      const typeLabels = document.querySelectorAll("span.text-xs.font-medium");
      const labelTexts = Array.from(typeLabels).map((el) => el.textContent);

      expect(labelTexts).toContain("Summary ready");
      expect(labelTexts).toContain("Summary failed");
      expect(labelTexts).toContain("Reminder sent");
    });

    it("shows relative timestamps", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      // All mocked to "2 hours ago"
      const timestamps = screen.getAllByText("2 hours ago");
      expect(timestamps.length).toBe(3);
    });

    it("shows empty state when there are no notifications", async () => {
      const user = userEvent.setup();
      mockNotificationsQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      renderNotificationCenter();
      await openPanel(user);

      expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
    });

    it("shows loading spinner when query is loading", async () => {
      const user = userEvent.setup();
      mockNotificationsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      renderNotificationCenter();
      await openPanel(user);

      // Spinner is a div with animate-spin class
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("sorts notifications descending by createdAt (newest first)", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      // notif-1 is 12:00, notif-3 is 11:00, notif-2 is 10:00
      const titles = screen
        .getAllByText(/Summary ready|Summary failed|Reminder sent/)
        .filter((el) => el.classList.contains("text-sm"));

      // First should be "Summary ready" (12:00), then "Summary failed" (11:00), then "Reminder sent" (10:00)
      expect(titles[0]).toHaveTextContent("Summary ready");
      expect(titles[1]).toHaveTextContent("Summary failed");
      expect(titles[2]).toHaveTextContent("Reminder sent");
    });
  });

  // --------------------------------------------------------------------------
  // Mark as Read
  // --------------------------------------------------------------------------

  describe("Mark as Read", () => {
    it("shows 'Mark read' button only for unread notifications", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      // 2 unread notifications should have the button
      const markReadBtns = screen.getAllByRole("button", {
        name: /^mark read$/i,
      });
      expect(markReadBtns).toHaveLength(2);
    });

    it("calls markRead mutation when 'Mark read' is clicked", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      const markReadBtns = screen.getAllByRole("button", {
        name: /^mark read$/i,
      });
      await user.click(markReadBtns[0]);

      expect(mockMarkReadMutate).toHaveBeenCalledTimes(1);
      // Should be called with the id of the first unread notification (sorted: notif-1 is first)
      expect(mockMarkReadMutate).toHaveBeenCalledWith("notif-1");
    });
  });

  // --------------------------------------------------------------------------
  // Mark All as Read
  // --------------------------------------------------------------------------

  describe("Mark All as Read", () => {
    it("shows 'Mark all read' button in header when there are unread notifications", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      expect(
        screen.getByRole("button", { name: /mark all read/i }),
      ).toBeInTheDocument();
    });

    it("does not show 'Mark all read' button when all are read", async () => {
      const user = userEvent.setup();
      mockNotificationsQuery.mockReturnValue({
        data: mockNotifications.map((n) => ({ ...n, status: "read" })),
        isLoading: false,
      });

      renderNotificationCenter();
      await openPanel(user);

      expect(
        screen.queryByRole("button", { name: /mark all read/i }),
      ).not.toBeInTheDocument();
    });

    it("does not show 'Mark all read' button when list is empty", async () => {
      const user = userEvent.setup();
      mockNotificationsQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      renderNotificationCenter();
      await openPanel(user);

      expect(
        screen.queryByRole("button", { name: /mark all read/i }),
      ).not.toBeInTheDocument();
    });

    it("calls markRead mutation for each unread notification when clicked", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      const markAllBtn = screen.getByRole("button", {
        name: /mark all read/i,
      });
      await user.click(markAllBtn);

      // Should be called once per unread notification (notif-1 and notif-3)
      expect(mockMarkReadMutate).toHaveBeenCalledTimes(2);
      expect(mockMarkReadMutate).toHaveBeenCalledWith("notif-1");
      expect(mockMarkReadMutate).toHaveBeenCalledWith("notif-3");
    });
  });

  // --------------------------------------------------------------------------
  // Go to Entry
  // --------------------------------------------------------------------------

  describe("Go to Entry", () => {
    it("shows 'Go to entry' button for notifications with entryId in payload", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      // notif-1 and notif-2 have entryId in payload, notif-3 does not
      const goToEntryBtns = screen.getAllByRole("button", {
        name: /go to entry/i,
      });
      expect(goToEntryBtns).toHaveLength(2);
    });

    it("does not show 'Go to entry' when payload has no entryId", async () => {
      const user = userEvent.setup();
      mockNotificationsQuery.mockReturnValue({
        data: [
          createNotification({
            id: "notif-no-entry",
            payload: null,
            status: "unread",
          }),
        ],
        isLoading: false,
      });

      renderNotificationCenter();
      await openPanel(user);

      expect(
        screen.queryByRole("button", { name: /go to entry/i }),
      ).not.toBeInTheDocument();
    });

    it("calls onNavigateToEntry with the entryId when clicked", async () => {
      const user = userEvent.setup();
      const mockNavigate = vi.fn();
      renderNotificationCenter({ onNavigateToEntry: mockNavigate });

      await openPanel(user);

      const goToEntryBtns = screen.getAllByRole("button", {
        name: /go to entry/i,
      });
      await user.click(goToEntryBtns[0]);

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("entry-abc");
    });

    it("closes the panel after navigating to entry", async () => {
      const user = userEvent.setup();
      const mockNavigate = vi.fn();
      renderNotificationCenter({ onNavigateToEntry: mockNavigate });

      await openPanel(user);

      const goToEntryBtns = screen.getAllByRole("button", {
        name: /go to entry/i,
      });
      await user.click(goToEntryBtns[0]);

      await waitFor(() => {
        expect(getBellButton()).toHaveAttribute("aria-expanded", "false");
      });
    });
  });

  // --------------------------------------------------------------------------
  // Auto-dismiss: hide read notifications older than 24h
  // --------------------------------------------------------------------------

  describe("Auto-dismiss read notifications after 24h", () => {
    it("hides read notifications older than 24 hours", async () => {
      const user = userEvent.setup();

      const now = new Date("2026-01-30T12:00:00Z").getTime();
      vi.mocked(Date.now).mockReturnValue(now);

      mockNotificationsQuery.mockReturnValue({
        data: [
          createNotification({
            id: "old-read",
            title: "Old read notification",
            message: "This was read long ago",
            status: "read",
            // 25 hours ago — should be hidden
            createdAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
          }),
          createNotification({
            id: "recent-read",
            title: "Recent read notification",
            message: "This was read recently",
            status: "read",
            // 2 hours ago — should be visible
            createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
          }),
          createNotification({
            id: "old-unread",
            title: "Old unread notification",
            message: "Unread but old",
            status: "unread",
            // 48 hours ago — unread, should still be visible
            createdAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
          }),
        ],
        isLoading: false,
      });

      renderNotificationCenter();
      await openPanel(user);

      // Old read notification should be hidden
      expect(
        screen.queryByText("Old read notification"),
      ).not.toBeInTheDocument();

      // Recent read should be visible
      expect(screen.getByText("Recent read notification")).toBeInTheDocument();

      // Old unread should still be visible (unread are never auto-hidden)
      expect(screen.getByText("Old unread notification")).toBeInTheDocument();
    });

    it("does not hide unread notifications regardless of age", async () => {
      const user = userEvent.setup();

      const now = new Date("2026-01-30T12:00:00Z").getTime();
      vi.mocked(Date.now).mockReturnValue(now);

      mockNotificationsQuery.mockReturnValue({
        data: [
          createNotification({
            id: "ancient-unread",
            title: "Very old unread",
            message: "Still unread after days",
            status: "unread",
            createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        ],
        isLoading: false,
      });

      renderNotificationCenter();
      await openPanel(user);

      expect(screen.getByText("Very old unread")).toBeInTheDocument();
    });

    it("still counts only visible unread notifications in badge", async () => {
      const now = new Date("2026-01-30T12:00:00Z").getTime();
      vi.mocked(Date.now).mockReturnValue(now);

      mockNotificationsQuery.mockReturnValue({
        data: [
          createNotification({
            id: "visible-unread",
            status: "unread",
            createdAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
          }),
          createNotification({
            id: "old-read-hidden",
            status: "read",
            createdAt: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
          }),
        ],
        isLoading: false,
      });

      renderNotificationCenter();

      // Only 1 unread — badge should show 1
      expect(getBellButton()).toHaveAttribute(
        "aria-label",
        "Notifications (1 unread)",
      );
    });
  });

  // --------------------------------------------------------------------------
  // Scrollbar Styling
  // --------------------------------------------------------------------------

  describe("Scrollbar Styling", () => {
    it("uses the custom-scrollbar class on the notification list", async () => {
      const user = userEvent.setup();
      renderNotificationCenter();

      await openPanel(user);

      // The scrollable list container should have the custom-scrollbar class
      const scrollContainer = document.querySelector(".custom-scrollbar");
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("handles undefined notifications data gracefully", () => {
      mockNotificationsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      renderNotificationCenter();

      // Should render without crashing, no badge
      expect(getBellButton()).toHaveAttribute("aria-label", "Notifications");
    });

    it("does not crash when onNavigateToEntry is not provided", async () => {
      const user = userEvent.setup();
      mockNotificationsQuery.mockReturnValue({
        data: [
          createNotification({
            payload: { entryId: "entry-xyz" },
            status: "unread",
          }),
        ],
        isLoading: false,
      });

      renderNotificationCenter(); // no onNavigateToEntry
      await openPanel(user);

      const goBtn = screen.getByRole("button", { name: /go to entry/i });
      // Should not throw
      await expect(user.click(goBtn)).resolves.not.toThrow();
    });

    it("does not show message text when message equals title", async () => {
      const user = userEvent.setup();
      mockNotificationsQuery.mockReturnValue({
        data: [
          createNotification({
            id: "notif-same",
            title: "Summary ready",
            message: "Summary ready",
            status: "unread",
          }),
        ],
        isLoading: false,
      });

      renderNotificationCenter();
      await openPanel(user);

      // Title "Summary ready" shows once as title, but message should NOT render
      // because message === title
      const allSummaryReady = screen.getAllByText("Summary ready");
      // One for the type label (notifMeta) and one for the p.text-sm (title)
      // Message paragraph should NOT be rendered
      expect(allSummaryReady).toHaveLength(2);
    });
  });
});
