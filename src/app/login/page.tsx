"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import * as Sentry from "@sentry/nextjs";
import { useStore } from "@/shared/store";
import { post, ApiError } from "@/shared/api/apiClient";
import { ArrowRight } from "lucide-react";

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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useStore();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.push("/");
      return;
    }

    // Also check server-side auth state
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.user) {
          Sentry.setUser({ id: data.user.id, email: data.user.email });
          Sentry.addBreadcrumb({
            category: "auth",
            message: "Session restored from /api/auth/me",
            level: "info",
          });
          login(data.user);
          router.push("/");
        }
      })
      .catch(() => {
        // Not authenticated, stay on login
      });
  }, [user, login, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      const data = await post<{ user: { id: string; email: string } }>(
        "/api/auth/login",
        { email, password },
      );
      Sentry.setUser({ id: data.user.id, email: data.user.email });
      Sentry.addBreadcrumb({
        category: "auth",
        message: "User login succeeded",
        level: "info",
      });
      login(data.user);
      router.push("/");
    } catch (err) {
      Sentry.addBreadcrumb({
        category: "auth",
        message: "User login failed",
        level: "warning",
      });
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            err.message || "Too many attempts. Please wait a few minutes.",
          );
        } else if (err.status === 401) {
          setError("Invalid email or password");
        } else if (err.status === 400) {
          setError(err.message || "Invalid input");
        } else if (isConnectionApiError(err)) {
          setError("Connection error. Please check your network connection.");
        } else {
          setError("Login failed. Please try again.");
        }
      } else {
        setError("Network error. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Effects */}
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
        {/* Header with lockup logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center">
            <Image
              src="/branding/lockups/Neuraal_Blanco_Logotipo.svg"
              alt="Neuraal"
              width={200}
              height={76}
              priority
              className="h-auto w-[200px] max-w-full opacity-60"
            />
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
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
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary/90 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{loading ? "Signing in..." : "Sign In"}</span>
            {!loading && (
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            )}
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center space-y-2">
          <Link
            href="/register"
            className="text-sm text-white/40 hover:text-white/70 transition-colors block"
          >
            Create account
          </Link>
          <Link
            href="/recover"
            className="text-sm text-white/40 hover:text-white/70 transition-colors block"
          >
            Forgot password?
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
