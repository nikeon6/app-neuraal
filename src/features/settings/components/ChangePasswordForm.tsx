"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { post, ApiError } from "@/shared/api/apiClient";
import { useStore } from "@/shared/store";
import { CheckCircle, Check, X } from "lucide-react";

const PASSWORD_REQUIREMENTS = [
  { label: "Min 8 characters", test: (p: string) => p.length >= 8 },
  { label: "1 uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "1 lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "1 number", test: (p: string) => /\d/.test(p) },
  {
    label: "1 special character",
    test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
  },
] as const;

function getPasswordRequirements(password: string) {
  return PASSWORD_REQUIREMENTS.map((r) => ({
    ...r,
    met: r.test(password),
  }));
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { logout } = useStore();
  const router = useRouter();

  const requirements = useMemo(
    () => getPasswordRequirements(newPassword),
    [newPassword],
  );
  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentPassword.trim()) {
      setError("Current password is required");
      return;
    }

    if (!allRequirementsMet) {
      setError("New password does not meet all requirements");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setSuccess(true);
      setTimeout(() => {
        logout();
        router.push("/login");
      }, 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Current password is incorrect");
        } else if (err.status === 400) {
          setError(err.message || "Invalid input");
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else {
        setError("Network error. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4 flex items-start gap-3"
      >
        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
        <div className="text-sm text-emerald-400">
          <p>Password changed successfully.</p>
          <p className="text-emerald-400/60 mt-1 text-xs">
            All sessions revoked. Redirecting to login...
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-red-900/30 bg-red-950/20 p-3 text-sm text-red-400 text-center"
        >
          {error}
        </motion.div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="currentPassword"
          className="text-[10px] uppercase tracking-wider text-zinc-500"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 transition-all"
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="newPassword"
          className="text-[10px] uppercase tracking-wider text-zinc-500"
        >
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 transition-all"
          placeholder="••••••••"
          autoComplete="new-password"
          disabled={loading}
        />
        {newPassword.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {requirements.map((req) => (
              <div
                key={req.label}
                className={`flex items-center gap-1.5 text-[11px] ${
                  req.met ? "text-emerald-400/80" : "text-zinc-500"
                }`}
              >
                {req.met ? (
                  <Check className="w-3 h-3 shrink-0" />
                ) : (
                  <X className="w-3 h-3 shrink-0 opacity-50" />
                )}
                <span>{req.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="confirmNewPassword"
          className="text-[10px] uppercase tracking-wider text-zinc-500"
        >
          Confirm new password
        </label>
        <input
          id="confirmNewPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 transition-all"
          placeholder="••••••••"
          autoComplete="new-password"
          disabled={loading}
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="text-[11px] text-red-400 mt-0.5">
            Passwords do not match
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={
          loading ||
          !currentPassword.trim() ||
          !allRequirementsMet ||
          !passwordsMatch
        }
        className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-700"
      >
        {loading ? "Changing..." : "Change password"}
      </button>
    </form>
  );
}
