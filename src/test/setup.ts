import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement window.scrollTo; mock it to avoid noisy test output.
Object.defineProperty(window, "scrollTo", {
  value: vi.fn(),
  writable: true,
});

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});
