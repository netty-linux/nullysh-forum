"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)]">
        <div className="flex w-full max-w-sm flex-col gap-3 px-6">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-24 w-full rounded-[var(--radius-lg)]" />
          <p className="text-[13px] text-[var(--text-tertiary)]">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)]">
        <p className="text-[13px] text-[var(--text-tertiary)]">Redirecionando…</p>
      </div>
    );
  }

  return <>{children}</>;
}
