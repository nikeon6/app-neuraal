import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { MainLayout } from "./MainLayout";

const pushMock = vi.fn();
const sentrySetUserMock = vi.fn();
const sentryAddBreadcrumbMock = vi.fn();

const loginMock = vi.fn();
const logoutMock = vi.fn();

let storeState: {
  user: { id: string; email: string } | null;
  login: typeof loginMock;
  logout: typeof logoutMock;
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@sentry/nextjs", () => ({
  setUser: (...args: unknown[]) => sentrySetUserMock(...args),
  addBreadcrumb: (...args: unknown[]) => sentryAddBreadcrumbMock(...args),
}));

vi.mock("@/shared/store", () => ({
  useStore: () => storeState,
}));

describe("MainLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      user: null,
      login: loginMock,
      logout: logoutMock,
    };
  });

  it("loads authenticated user and renders children", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: "u1", email: "u1@example.com" } }),
      }),
    );

    const { rerender } = render(
      <MainLayout>
        <div>private-content</div>
      </MainLayout>,
    );

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        id: "u1",
        email: "u1@example.com",
      });
    });
    expect(sentrySetUserMock).toHaveBeenCalledWith({
      id: "u1",
      email: "u1@example.com",
    });

    // Simulate store update after login.
    storeState = { ...storeState, user: { id: "u1", email: "u1@example.com" } };
    rerender(
      <MainLayout>
        <div>private-content</div>
      </MainLayout>,
    );

    expect(screen.getByText("private-content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cerrar sesión/i }),
    ).toBeInTheDocument();
  });

  it("redirects to login when auth check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(
      <MainLayout>
        <div>private-content</div>
      </MainLayout>,
    );

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
    expect(sentrySetUserMock).toHaveBeenCalledWith(null);
    expect(screen.queryByText("private-content")).not.toBeInTheDocument();
  });

  it("redirects to login when auth response has no user payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    render(
      <MainLayout>
        <div>private-content</div>
      </MainLayout>,
    );

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
    expect(sentrySetUserMock).toHaveBeenCalledWith(null);
  });

  it("handles logout success flow", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { id: "u1", email: "u1@example.com" } }),
        })
        .mockResolvedValueOnce({ ok: true }),
    );

    const user = userEvent.setup();
    const { rerender } = render(
      <MainLayout>
        <div>private-content</div>
      </MainLayout>,
    );

    await waitFor(() => expect(loginMock).toHaveBeenCalled());
    storeState = { ...storeState, user: { id: "u1", email: "u1@example.com" } };
    rerender(
      <MainLayout>
        <div>private-content</div>
      </MainLayout>,
    );

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
    expect(sentrySetUserMock).toHaveBeenCalledWith(null);
  });

  it("handles logout API failure and still logs out client-side", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { id: "u1", email: "u1@example.com" } }),
        })
        .mockRejectedValueOnce(new Error("network")),
    );

    const user = userEvent.setup();
    const { rerender } = render(
      <MainLayout>
        <div>private-content</div>
      </MainLayout>,
    );

    await waitFor(() => expect(loginMock).toHaveBeenCalled());
    storeState = { ...storeState, user: { id: "u1", email: "u1@example.com" } };
    rerender(
      <MainLayout>
        <div>private-content</div>
      </MainLayout>,
    );

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/login");
    });

    expect(sentryAddBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "auth",
        level: "warning",
      }),
    );
  });
});
