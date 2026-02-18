"use client";

import React, { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { post, ApiError } from "@/shared/api/apiClient";
import { ArrowRight, CheckCircle, Check, X, AlertTriangle } from "lucide-react";

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

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const requirements = useMemo(
    () => getPasswordRequirements(password),
    [password],
  );
  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) return;

    if (!allRequirementsMet) {
      setError("Password does not meet all requirements");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await post("/api/auth/reset-password", {
        token,
        newPassword: password,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError(
            "This reset link is invalid or has expired. Please request a new one.",
          );
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

  if (!token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] animate-pulse" />
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-md relative z-10 mx-4"
        >
          <div className="text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-lg font-semibold text-white">
              Invalid reset link
            </h2>
            <p className="text-sm text-white/50">
              This password reset link is missing the required token. Please use
              the link from your email or request a new one.
            </p>
            <div className="pt-4 space-y-2">
              <Link
                href="/recover"
                className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary/90 transition-colors group"
              >
                <span>Request new reset</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="text-sm text-white/40 hover:text-white/70 transition-colors block"
              >
                Back to login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-md relative z-10 mx-4"
      >
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-8">
            <Image
              src="/branding/lockups/Neuraal_Blanco_Logotipo.svg"
              alt="Neuraal"
              width={200}
              height={76}
              priority
              className="h-auto w-[200px] max-w-full opacity-60"
            />
          </div>
          <p className="text-white/40">Set your new password</p>
        </div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">
                Your password has been reset successfully. You can now sign in
                with your new password.
              </p>
            </div>

            <Link
              href="/login"
              className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary/90 transition-colors group"
            >
              <span>Go to login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-center text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-xs font-medium text-white/60 uppercase tracking-wider"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
              />
              <div className="mt-2 space-y-1.5">
                {requirements.map((req) => (
                  <div
                    key={req.label}
                    className={`flex items-center gap-2 text-xs ${
                      req.met ? "text-emerald-400/90" : "text-white/50"
                    }`}
                  >
                    {req.met ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    )}
                    <span>{req.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="text-xs font-medium text-white/60 uppercase tracking-wider"
              >
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !allRequirementsMet || !passwordsMatch}
              className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary/90 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
            >
              {loading ? (
                <span>Resetting password...</span>
              ) : (
                <>
                  <span>Reset password</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        )}

        {!success && (
          <p className="mt-6 text-center text-sm text-white/50">
            Back to{" "}
            <Link href="/login" className="text-primary hover:underline">
              login
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
