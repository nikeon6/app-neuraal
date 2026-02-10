import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardHeader, type DashboardHeaderProps } from "./DashboardHeader";

// ============================================================================
// Mock date-fns to avoid installation issues
// ============================================================================
vi.mock("date-fns", () => ({
  format: (date: Date, formatStr: string) => {
    if (formatStr === "MMMM d") return "February 4";
    if (formatStr === "yyyy") return "2026";
    if (formatStr === "EEEE") return "Wednesday";
    if (formatStr === "MMM d") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    }
    if (formatStr === "d") return String(date.getDate());
    return "mocked-date";
  },
  startOfWeek: (date: Date, opts?: { weekStartsOn?: number }) => {
    const d = new Date(date);
    const day = d.getDay();
    const start = opts?.weekStartsOn ?? 0;
    const diff = (day - start + 7) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  },
  endOfWeek: (date: Date, opts?: { weekStartsOn?: number }) => {
    const d = new Date(date);
    const day = d.getDay();
    const start = opts?.weekStartsOn ?? 0;
    const diff = (6 - day + start) % 7;
    d.setDate(d.getDate() + diff);
    return d;
  },
  getISOWeek: () => 6,
}));

// ============================================================================
// Mock Framer Motion to avoid animation issues in tests
// ============================================================================
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  },
}));

// ============================================================================
// Test Fixtures
// ============================================================================

const mockOnChangeSection = vi.fn();
const defaultProps: DashboardHeaderProps = {
  section: "daily",
  onChangeSection: mockOnChangeSection,
  selectedDate: new Date(2026, 1, 4), // February 4, 2026
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Renders DashboardHeader with default or custom props.
 */
function renderHeader(overrides: Partial<DashboardHeaderProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<DashboardHeader {...props} />);
}

// ============================================================================
// Tests
// ============================================================================
describe("DashboardHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Navigation Tabs", () => {
    it("renders all navigation tabs with aria-labels", () => {
      renderHeader();

      // All tabs should be accessible by aria-label
      expect(screen.getByRole("button", { name: "Daily Log" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Weekly Recap" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Stickies" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Topics" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    });

    it("marks active tab with aria-current='page'", () => {
      renderHeader({ section: "topics" });

      const topicsTab = screen.getByRole("button", { name: "Topics" });
      expect(topicsTab).toHaveAttribute("aria-current", "page");

      // Other tabs should NOT have aria-current
      const dailyTab = screen.getByRole("button", { name: "Daily Log" });
      expect(dailyTab).not.toHaveAttribute("aria-current");
    });

    it("calls onChangeSection when clicking a tab", async () => {
      const user = userEvent.setup();
      renderHeader({ section: "daily" });

      const topicsTab = screen.getByRole("button", { name: "Topics" });
      await user.click(topicsTab);

      expect(mockOnChangeSection).toHaveBeenCalledTimes(1);
      expect(mockOnChangeSection).toHaveBeenCalledWith("topics");
    });

    it("calls onChangeSection with correct section id for each tab", async () => {
      const user = userEvent.setup();
      renderHeader();

      // Test multiple tabs
      await user.click(screen.getByRole("button", { name: "Weekly Recap" }));
      expect(mockOnChangeSection).toHaveBeenLastCalledWith("weeklyRecap");

      await user.click(screen.getByRole("button", { name: "Stickies" }));
      expect(mockOnChangeSection).toHaveBeenLastCalledWith("stickies");

      await user.click(screen.getByRole("button", { name: "Settings" }));
      expect(mockOnChangeSection).toHaveBeenLastCalledWith("settings");
    });
  });

  describe("Responsive Behavior (Accessibility)", () => {
    it("each tab has visible text with 'hidden sm:inline' class for desktop display", () => {
      renderHeader();

      const dailyTab = screen.getByRole("button", { name: "Daily Log" });
      
      // Find the visible text span (hidden on mobile, shown on sm+)
      const visibleTextSpan = dailyTab.querySelector(".hidden.sm\\:inline");
      expect(visibleTextSpan).toBeInTheDocument();
      expect(visibleTextSpan).toHaveTextContent("Daily Log");
    });

    it("each tab has sr-only text for screen readers on mobile", () => {
      renderHeader();

      const dailyTab = screen.getByRole("button", { name: "Daily Log" });
      
      // Find the sr-only span for mobile accessibility
      const srOnlySpan = dailyTab.querySelector(".sr-only");
      expect(srOnlySpan).toBeInTheDocument();
      expect(srOnlySpan).toHaveTextContent("Daily Log");
    });

    it("all tabs have both responsive text elements", () => {
      renderHeader();

      const tabLabels = ["Daily Log", "Weekly Recap", "Stickies", "Topics", "Settings"];
      
      for (const label of tabLabels) {
        const tab = screen.getByRole("button", { name: label });
        
        // Should have hidden sm:inline for desktop
        const desktopText = tab.querySelector(".hidden.sm\\:inline");
        expect(desktopText).toBeInTheDocument();
        
        // Should have sr-only for mobile accessibility
        const mobileText = tab.querySelector(".sr-only");
        expect(mobileText).toBeInTheDocument();
      }
    });
  });

  describe("Notification Slot", () => {
    it("renders the notificationSlot when provided", () => {
      renderHeader({
        notificationSlot: <button type="button" aria-label="Notifications">Bell</button>,
      });

      expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    });

    it("renders nothing in the slot area when no notificationSlot is provided", () => {
      renderHeader({ notificationSlot: undefined });

      // No notifications button should be present
      expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
    });
  });

  describe("Title Section", () => {
    it("displays date title when section is 'daily'", () => {
      renderHeader({ section: "daily", selectedDate: new Date(2026, 1, 4) });

      // Should show the date in the title
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/February 4/i);
    });

    it("displays section label when section is not 'daily'", () => {
      renderHeader({ section: "topics" });

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Topics");
    });

    it("displays dynamic week date range for weeklyRecap section", () => {
      // Feb 4, 2026 is a Wednesday. Week (Mon-Sun): Feb 2 — Feb 8
      renderHeader({ section: "weeklyRecap", selectedDate: new Date(2026, 1, 4) });

      const heading = screen.getByRole("heading", { level: 1 });
      // Same month: "Feb 2 — 8"
      expect(heading).toHaveTextContent(/Feb 2/);
      expect(heading).toHaveTextContent(/8/);
    });

    it("displays week number in kicker for weeklyRecap section", () => {
      renderHeader({ section: "weeklyRecap", selectedDate: new Date(2026, 1, 4) });

      // Kicker should show "Week X · YYYY"
      expect(screen.getByText(/Week \d+/)).toBeInTheDocument();
    });

    it("displays kicker label for all sections", () => {
      renderHeader({ section: "stickies" });

      // The kicker (small label above title) should show section name
      // Use a more specific selector to avoid matching tab labels
      const kicker = screen.getByText("Stickies", {
        selector: ".text-xs.uppercase, span.uppercase",
      });
      expect(kicker).toBeInTheDocument();
      expect(kicker).toHaveClass("uppercase");
    });
  });

  describe("Navigation Element", () => {
    it("has navigation with accessible label", () => {
      renderHeader();

      const nav = screen.getByRole("navigation", { name: "Dashboard navigation" });
      expect(nav).toBeInTheDocument();
    });
  });
});
