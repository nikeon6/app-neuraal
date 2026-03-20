"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { useStore } from "@/shared/store";
import { post, ApiError } from "@/shared/api/apiClient";
import { ArrowRight, Check, X, Mail, RotateCw } from "lucide-react";

function isConnectionApiError(error: ApiError): boolean {
  if (error.status >= 500) return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("connect") ||
    msg.includes("connection") ||
    msg.includes("econnrefused") ||
    msg.includes("database") ||
    msg.includes("timeout")
  );
}

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

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const { user, logout } = useStore();
  const router = useRouter();
  const [verifying, setVerifying] = useState(!!user);
  const requirements = getPasswordRequirements(password);
  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    if (!user) {
      setVerifying(false);
      return;
    }

    setVerifying(true);
    const controller = new AbortController();

    fetch("/api/auth/me", {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data?.user) {
          router.push("/");
        } else {
          logout();
          setVerifying(false);
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        logout();
        setVerifying(false);
      });

    return () => controller.abort();
  }, [user, logout, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

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
      await post<{ user: { id: string; email: string }; message: string }>(
        "/api/auth/register",
        { email: email.trim(), password },
      );
      setRegistrationSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with this email already exists");
      } else if (err instanceof ApiError && isConnectionApiError(err)) {
        setError("Connection error. Please check your database/server.");
      } else {
        setError("Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage("");
    try {
      await post("/api/auth/resend-verification", { email: email.trim() });
      setResendMessage("Verification email sent! Check your inbox.");
    } catch {
      setResendMessage("Could not resend. Please try again later.");
    } finally {
      setResendLoading(false);
    }
  };

  if (verifying) return null;

  if (registrationSuccess) {
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
          className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-md relative z-10 mx-4 text-center"
        >
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-white mb-3">
            Check your email
          </h2>
          <p className="text-white/60 text-sm mb-6 leading-relaxed">
            We sent a verification link to{" "}
            <span className="text-white font-medium">{email}</span>. Click the
            link to activate your account.
          </p>

          {resendMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-center text-sm mb-4"
            >
              {resendMessage}
            </motion.div>
          )}

          <button
            onClick={handleResendVerification}
            disabled={resendLoading}
            className="w-full bg-white/5 border border-white/10 text-white/70 font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            <RotateCw
              className={`w-4 h-4 ${resendLoading ? "animate-spin" : ""}`}
            />
            {resendLoading ? "Sending..." : "Resend verification email"}
          </button>

          <Link href="/login" className="text-sm text-primary hover:underline">
            Go to login
          </Link>
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
          <p className="text-white/40">Create your account</p>
        </div>

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
              htmlFor="email"
              className="text-xs font-medium text-white/60 uppercase tracking-wider"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-xs font-medium text-white/60 uppercase tracking-wider"
            >
              Password
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
              Confirm password
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
              <span>Creating account...</span>
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
