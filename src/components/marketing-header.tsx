"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/#recursos", label: "Recursos" },
  { href: "/#assuntos", label: "Assuntos" },
  { href: "/pricing", label: "VIP" },
];

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
            <div className="h-11 w-28 animate-pulse rounded-xl bg-neutral-200" />
          ) : user ? (
            <Link href="/app">
              <Button>Entrar no Forum</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link href="/register">
                <Button>Criar conta</Button>
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-black md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
        </button>
      </div>
      {open && (
        <div className="border-t-2 border-black bg-white px-4 py-4 md:hidden">
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
            <div className="mt-3 flex flex-col gap-2 border-t-2 border-neutral-200 pt-3">
              {user ? (
                <Link href="/app" onClick={() => setOpen(false)}>
                  <Button className="w-full">Entrar no Forum</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full">
                      Entrar
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setOpen(false)}>
                    <Button className="w-full">Criar conta</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
