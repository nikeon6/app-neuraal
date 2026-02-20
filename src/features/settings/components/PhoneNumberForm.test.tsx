import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { PhoneNumberForm } from "./PhoneNumberForm";

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock("@/shared/api/apiClient", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

describe("PhoneNumberForm", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
  });

  it("renders loading state while fetching current phone", async () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { container } = render(<PhoneNumberForm />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("displays the current phone number when user has one", async () => {
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", phoneNumber: "+34612345678" },
    });

    render(<PhoneNumberForm />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("+34612345678")).toBeInTheDocument();
    });
  });

  it("shows empty input when user has no phone number", async () => {
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", phoneNumber: null },
    });

    render(<PhoneNumberForm />);

    await waitFor(() => {
      const input = screen.getByLabelText(/phone number/i);
      expect(input).toHaveValue("");
    });
  });

  it("shows placeholder with country prefix example", async () => {
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", phoneNumber: null },
    });

    render(<PhoneNumberForm />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/\+34/);
      expect(input).toBeInTheDocument();
    });
  });

  it("shows helper text about international prefix", async () => {
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", phoneNumber: null },
    });

    render(<PhoneNumberForm />);

    await waitFor(() => {
      expect(screen.getByText(/country prefix/i)).toBeInTheDocument();
    });
  });

  it("submits the phone number and shows success", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", phoneNumber: null },
    });
    mockPatch.mockResolvedValue({ phoneNumber: "+34612345678" });

    render(<PhoneNumberForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/phone number/i);
    await user.type(input, "+34612345678");

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/api/auth/me", {
        phoneNumber: "+34612345678",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });

  it("allows removing the phone number", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", phoneNumber: "+34612345678" },
    });
    mockPatch.mockResolvedValue({ phoneNumber: null });

    render(<PhoneNumberForm />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("+34612345678")).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/phone number/i);
    await user.clear(input);

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/api/auth/me", {
        phoneNumber: null,
      });
    });
  });

  it("shows validation error for invalid format before submitting", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", phoneNumber: null },
    });

    render(<PhoneNumberForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/phone number/i);
    await user.type(input, "not-a-phone");

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    expect(mockPatch).not.toHaveBeenCalled();
    expect(screen.getByText(/international format/i)).toBeInTheDocument();
  });

  it("shows server error message on API failure", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", phoneNumber: null },
    });

    const { ApiError } = await import("@/shared/api/apiClient");
    mockPatch.mockRejectedValue(new ApiError("Invalid phone", 400));

    render(<PhoneNumberForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/phone number/i);
    await user.type(input, "+34612345678");

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid phone/i)).toBeInTheDocument();
    });
  });
});
