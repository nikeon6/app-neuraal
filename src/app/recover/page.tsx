"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { post, ApiError } from "@/shared/api/apiClient";
import { ArrowRight, CheckCircle } from "lucide-react";

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

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [networkError, setNetworkError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNetworkError("");

    if (!email.trim()) return;

    setLoading(true);
    try {
      await post("/api/auth/recover", { email: email.trim() });
      setSuccess(true);
    } catch (err) {
      // Only show error for network failures (timeout, no connection, etc.)
      // API errors are intentionally ignored to prevent email enumeration.
      if (!(err instanceof ApiError) || isConnectionApiError(err)) {
        setNetworkError(
          "Unable to connect. Please check your connection and try again.",
        );
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
        {/* Header */}
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
          <p className="text-white/40">Reset your password</p>
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
                If an account exists with that email, you&apos;ll receive
                password reset instructions.
              </p>
            </div>

            <Link
              href="/login"
              className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary/90 transition-colors group"
            >
              <span>Back to login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {networkError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-center text-sm"
              >
                {networkError}
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

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center space-x-2 hover:bg-primary/90 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
            >
              {loading ? (
                <span>Sending...</span>
              ) : (
                <>
                  <span>Send reset instructions</span>
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
