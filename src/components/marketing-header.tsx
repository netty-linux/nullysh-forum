"use client";

/**
 * Header marketing (landing / pricing):
 * - Sem sessão → CTA "Entrar no Forum"
 * - Com sessão → Avatar + dropdown (conta, ir ao feed, sair)
 */

import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { CaretDown, List, SignOut, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const links = [
  { href: "/#recursos", label: "Recursos" },
  { href: "/#assuntos", label: "Assuntos" },
  { href: "/pricing", label: "VIP" },
];

function AccountMenu({
  name,
  email,
  avatarUrl,
  onNavigate,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  /** Fecha menus pais (ex.: drawer mobile) */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    onNavigate?.();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="group flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[var(--press-scale)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar
          name={name}
          src={avatarUrl}
          size="sm"
          className="ring-1 ring-black/5"
        />
        <CaretDown
          size={12}
          weight="bold"
          className={`text-neutral-400 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
        <span className="sr-only">Menu da conta — {name}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-1.5 shadow-[var(--shadow-md)]"
        >
          <div className="border-b border-[var(--border)] px-3 py-2.5">
            <p className="truncate text-[14px] font-medium tracking-tight text-[#1f1f1f]">
              {name}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-[var(--text-tertiary)]">
              {email || "—"}
            </p>
          </div>

          <Link
            href="/app"
            role="menuitem"
            className="mt-1 flex h-10 items-center rounded-[var(--radius-md)] px-3 text-[14px] font-medium text-[#1f1f1f] transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
          >
            Ir para o Feed
          </Link>

          <button
            type="button"
            role="menuitem"
            className="flex h-10 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-[14px] font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            onClick={() => void handleLogout()}
          >
            <SignOut size={16} weight="bold" aria-hidden />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function MarketingHeader() {
  const { user, hydrated } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-neutral-600 transition-all duration-200 hover:text-[#1f1f1f]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {!hydrated ? (
            <div
              className="h-10 w-28 animate-pulse rounded-xl bg-neutral-200"
              aria-hidden
            />
          ) : user ? (
            <AccountMenu
              name={user.name}
              email={user.email}
              avatarUrl={user.avatarUrl}
            />
          ) : (
            <Link href="/login">
              <Button>Entrar no Forum</Button>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {hydrated && user && (
            <AccountMenu
              name={user.name}
              email={user.email}
              avatarUrl={user.avatarUrl}
              onNavigate={() => setOpen(false)}
            />
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
          >
            {open ? (
              <X size={18} weight="bold" />
            ) : (
              <List size={18} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-neutral-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-2 py-2.5 text-sm font-semibold text-neutral-700"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-3">
              {!hydrated ? (
                <div className="h-11 animate-pulse rounded-xl bg-neutral-200" />
              ) : user ? (
                <>
                  <div className="rounded-[var(--radius-md)] bg-neutral-50 px-3 py-2.5">
                    <p className="truncate text-[14px] font-medium text-[#1f1f1f]">
                      {user.name}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-neutral-500">
                      {user.email}
                    </p>
                  </div>
                  <Link href="/app" onClick={() => setOpen(false)}>
                    <Button className="w-full">Ir para o Feed</Button>
                  </Link>
                </>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)}>
                  <Button className="w-full">Entrar no Forum</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
