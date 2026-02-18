"use client";

import { StorageUsagePanel } from "./StorageUsagePanel";
import { AiUsagePanel } from "./AiUsagePanel";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { HardDrive, Sparkles, KeyRound } from "lucide-react";

function SectionCard({
  icon,
  title,
  description,
  children,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-700/50 text-zinc-400">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
          {description && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function SettingsPanel() {
  return (
    <div className="h-full overflow-y-auto pr-1 tasks-scrollbar tasks-scroll-fade">
      <div className="max-w-xl mx-auto py-4 space-y-4">
        <SectionCard
          icon={<KeyRound className="w-4 h-4" />}
          title="Change password"
          description="All active sessions will be revoked after changing"
        >
          <ChangePasswordForm />
        </SectionCard>

        <SectionCard
          icon={<HardDrive className="w-4 h-4" />}
          title="Storage"
          description="Attachment storage usage and limits"
        >
          <StorageUsagePanel />
        </SectionCard>

        <SectionCard
          icon={<Sparkles className="w-4 h-4" />}
          title="AI Usage"
          description="Monthly AI feature usage and rate limits"
        >
          <AiUsagePanel />
        </SectionCard>
      </div>
    </div>
  );
}
