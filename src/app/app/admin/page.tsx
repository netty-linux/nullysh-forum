"use client";

/**
 * Legado: o admin do Forum redireciona para o Nullysh Panel (Fase C).
 * Mantém deep-link ?tab=nullpass|users|… → rotas do Panel.
 */

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  getNullyshPanelUrl,
  panelPathForAdminTab,
  panelUrlForAdminTab,
} from "@/lib/panel-url";
import { ArrowSquareOut, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

function AdminRedirectInner() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = user?.role === "admin";

  const tab = searchParams.get("tab");
  const target = useMemo(() => panelUrlForAdminTab(tab), [tab]);
  const panelHome = getNullyshPanelUrl();
  const path = panelPathForAdminTab(tab);

  useEffect(() => {
    if (!hydrated) return;
    if (user && !isAdmin) {
      router.replace("/app");
      return;
    }
    if (isAdmin) {
      // Redirect hard — Panel é outro origin
      window.location.replace(target);
    }
  }, [hydrated, user, isAdmin, router, target]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-400">
        Carregando…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="app-page mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-base font-semibold text-[#1f1f1f]">Acesso restrito</p>
        <p className="mt-2 text-sm text-neutral-500">
          Apenas administradores acessam o backoffice.
        </p>
        <Link href="/app" className="mt-6 inline-block">
          <Button variant="outline">Voltar ao feed</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="app-page mx-auto max-w-lg px-4 py-16 text-center">
      <ShieldCheck
        size={28}
        weight="fill"
        className="mx-auto text-[#1f1f1f]"
      />
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-[#1f1f1f]">
        Redirecionando ao Nullysh Panel
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        A operação staff migrou para{" "}
        <span className="font-medium text-neutral-800">{panelHome}</span>
        {path !== "/" ? (
          <>
            {" "}
            · destino <code className="text-xs">{path}</code>
          </>
        ) : null}
        .
      </p>
      <a href={target} className="mt-6 inline-block">
        <Button className="gap-2">
          Abrir Panel
          <ArrowSquareOut size={16} weight="bold" />
        </Button>
      </a>
      <p className="mt-4 text-[12px] text-neutral-400">
        Se o redirect automático falhar, use o botão acima.
      </p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-400">
          Carregando…
        </div>
      }
    >
      <AdminRedirectInner />
    </Suspense>
  );
}
