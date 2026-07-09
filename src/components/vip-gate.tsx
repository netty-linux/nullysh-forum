"use client";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { CrownSimple, Lock } from "@phosphor-icons/react";
import Link from "next/link";

export function VipGate({
  children,
  title = "Conteúdo exclusivo VIP",
  description = "Assine o Plano VIP para liberar este conteúdo, comunidades e materiais.",
  blur = true,
}: {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  blur?: boolean;
}) {
  const user = useAuthStore((s) => s.getCurrentUser());

  if (user?.isVip) return <>{children}</>;

  return (
    <div className="relative">
      {blur && children && (
        <div className="pointer-events-none select-none blur-[6px] opacity-40">
          {children}
        </div>
      )}
      <div
        className={
          blur && children
            ? "absolute inset-0 flex items-center justify-center p-6"
            : "flex items-center justify-center p-6"
        }
      >
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
            <Lock size={22} weight="bold" className="text-neutral-950" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-neutral-950">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            {description}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/pricing">
              <Button className="w-full sm:w-auto">
                <CrownSimple size={16} weight="fill" />
                Assinar VIP
              </Button>
            </Link>
            {!user && (
              <Link href="/login">
                <Button variant="outline" className="w-full sm:w-auto">
                  Entrar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VipBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
      <CrownSimple size={10} weight="fill" />
      VIP
    </span>
  );
}
