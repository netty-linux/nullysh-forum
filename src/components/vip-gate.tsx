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
        <div className="pointer-events-none select-none opacity-35 blur-[6px]">
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
        <div className="surface-card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-950">
            <Lock size={20} weight="bold" />
          </div>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
            {title}
          </h3>
          <p className="mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed text-neutral-500">
            {description}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/pricing">
              <Button className="w-full sm:w-auto">
                <CrownSimple size={15} weight="fill" />
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
    <span className="inline-flex items-center gap-1 rounded-md bg-[#1f1f1f] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
      <CrownSimple size={9} weight="fill" />
      VIP
    </span>
  );
}
