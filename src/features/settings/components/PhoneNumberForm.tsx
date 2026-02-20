"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { get, patch, ApiError } from "@/shared/api/apiClient";
import { userProfileQueryKey } from "@/shared/api/queries";
import { CheckCircle } from "lucide-react";

interface MeResponse {
  user: { id: string; email: string; phoneNumber: string | null };
}

interface UpdatePhoneResponse {
  phoneNumber: string | null;
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function normalizeForValidation(raw: string): string {
  return raw.replaceAll(/[\s\-()]/g, "");
}

export function PhoneNumberForm() {
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [initialPhone, setInitialPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fetchCurrentPhone = useCallback(async () => {
    try {
      const data = await get<MeResponse>("/api/auth/me");
      const phone = data.user.phoneNumber ?? "";
      setPhoneNumber(phone);
      setInitialPhone(phone);
    } catch {
      setError("Failed to load phone number");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentPhone();
  }, [fetchCurrentPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const trimmed = phoneNumber.trim();

    if (trimmed.length > 0) {
      const normalized = normalizeForValidation(trimmed);
      if (!E164_REGEX.test(normalized)) {
        setError(
          "Use international format with country prefix, e.g. +34 612 345 678",
        );
        return;
      }
    }

    setSaving(true);
    try {
      await patch<UpdatePhoneResponse>("/api/auth/me", {
        phoneNumber: trimmed.length > 0 ? trimmed : null,
      });
      setInitialPhone(trimmed.length > 0 ? trimmed : "");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await queryClient.invalidateQueries({ queryKey: userProfileQueryKey });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Something went wrong. Please try again.");
      } else {
        setError("Network error. Please check your connection.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-24 bg-zinc-700/50 rounded" />
        <div className="h-10 bg-zinc-700/30 rounded-lg" />
        <div className="h-10 bg-zinc-700/30 rounded-lg" />
      </div>
    );
  }

  const hasChanged = phoneNumber !== (initialPhone ?? "");

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

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 flex items-center gap-2 justify-center"
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-sm text-emerald-400">
            Phone number saved successfully
          </span>
        </motion.div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="phoneNumber"
          className="text-[10px] uppercase tracking-wider text-zinc-500"
        >
          Phone number
        </label>
        <input
          id="phoneNumber"
          type="tel"
          value={phoneNumber}
          onChange={(e) => {
            setPhoneNumber(e.target.value);
            setError("");
            setSuccess(false);
          }}
          className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 transition-all"
          placeholder="+34 612 345 678"
          autoComplete="tel"
          disabled={saving}
        />
        <p className="text-[11px] text-zinc-500">
          Include country prefix (e.g. +34 for Spain, +1 for US). Used for
          Whatsapp reminders.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving || !hasChanged}
        className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-700"
      >
        {saving ? "Saving..." : "Save phone number"}
      </button>
    </form>
  );
}
