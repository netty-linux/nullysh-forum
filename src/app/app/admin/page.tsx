"use client";

import { AdminTrailsPanel } from "@/components/admin-trails-panel";
import { AdminVideosPanel } from "@/components/admin-videos-panel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useTrailStore } from "@/lib/trail-store";
import { useVerificationStore } from "@/lib/verification-store";
import type { VerificationRequest } from "@/lib/types";
import { formatDate, formatRelative } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  FilmStrip,
  Path,
  ShieldCheck,
  UsersThree,
  XCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function AdminPanelPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const users = useAuthStore((s) => s.users);
  const setVerified = useAuthStore((s) => s.setVerified);
  const requests = useVerificationStore((s) => s.requests);
  const reviewRequest = useVerificationStore((s) => s.reviewRequest);
  const trailsCount = useTrailStore((s) => s.trails.length);

  const [tab, setTab] = useState<
    "pending" | "history" | "users" | "trails" | "videos"
  >("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [videosCount, setVideosCount] = useState(0);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (hydrated && user && !isAdmin) {
      router.replace("/app");
    }
  }, [hydrated, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/videos/config", { cache: "no-store" });
        const data = (await res.json()) as { count?: number };
        if (!cancelled) setVideosCount(data.count ?? 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, tab, toast]);

  const pending = useMemo(
    () =>
      requests
        .filter((r) => r.status === "pending")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [requests]
  );

  const history = useMemo(
    () =>
      requests
        .filter((r) => r.status !== "pending")
        .sort(
          (a, b) =>
            new Date(b.reviewedAt || b.createdAt).getTime() -
            new Date(a.reviewedAt || a.createdAt).getTime()
        ),
    [requests]
  );

  const verifiedCount = users.filter((u) => u.isVerified).length;

  function handleReview(
    req: VerificationRequest,
    status: "approved" | "rejected"
  ) {
    if (!user) return;
    const result = reviewRequest(req.id, status, user.id, notes[req.id] || "");
    if (!result.ok) {
      setToast(result.error);
      return;
    }
    if (status === "approved") {
      setVerified(req.userId, true);
      setToast(`${req.userName} foi verificado.`);
    } else {
      setToast(`Solicitação de ${req.userName} rejeitada.`);
    }
    setTimeout(() => setToast(""), 2800);
  }

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-400">
        Carregando...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="app-page mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-base font-semibold text-[#1f1f1f]">Acesso restrito</p>
        <p className="mt-2 text-sm text-neutral-500">
          Apenas administradores podem acessar o Painel ADM.
        </p>
        <Link href="/app" className="mt-6 inline-block">
          <Button variant="outline">Voltar ao feed</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="app-page mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={22} weight="fill" className="text-[#1f1f1f]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[#1f1f1f] sm:text-3xl">
            Painel ADM
          </h1>
        </div>
        <p className="mt-2 text-sm text-neutral-500 sm:text-base">
          Verificações, membros, trilhas e vídeos (Telegram storage).
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Pendentes", value: pending.length, icon: Clock },
          { label: "Verificados", value: verifiedCount, icon: CheckCircle },
          { label: "Membros", value: users.length, icon: UsersThree },
          { label: "Trilhas", value: trailsCount, icon: Path },
          { label: "Vídeos", value: videosCount, icon: FilmStrip },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
          >
            <s.icon size={18} className="text-neutral-400" weight="bold" />
            <p className="mt-2 text-xl font-semibold tabular-nums text-[#1f1f1f]">
              {s.value}
            </p>
            <p className="text-[11px] font-medium text-neutral-400">{s.label}</p>
          </div>
        ))}
      </div>

      {toast && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-[#1f1f1f] shadow-sm">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-neutral-200/60 p-1">
        {(
          [
            ["pending", `Pendentes (${pending.length})`],
            ["history", "Histórico"],
            ["users", "Membros"],
            ["trails", `Trilhas (${trailsCount})`],
            ["videos", `Vídeos (${videosCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "chip min-w-[calc(50%-0.125rem)] flex-1 rounded-lg bg-white px-2 py-2 text-xs font-semibold text-[#1f1f1f] shadow-sm sm:min-w-0 sm:text-sm"
                : "chip min-w-[calc(50%-0.125rem)] flex-1 rounded-lg px-2 py-2 text-xs font-medium text-neutral-500 hover:text-[#1f1f1f] sm:min-w-0 sm:text-sm"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="space-y-4">
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500">
              Nenhuma solicitação pendente.
            </div>
          ) : (
            pending.map((req) => {
              const member = users.find((u) => u.id === req.userId);
              const displayName = member?.name || req.userName;
              return (
              <article
                key={req.id}
                className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <Link href={`/app/u/${req.userId}`} className="avatar-link shrink-0">
                    <Avatar
                      name={displayName}
                      src={member?.avatarUrl}
                      size="md"
                      frame={
                        member?.isVip ? member.avatarFrame : null
                      }
                    />
                  </Link>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/app/u/${req.userId}`}
                        className="truncate font-semibold text-[#1f1f1f] hover:underline"
                      >
                        {displayName}
                      </Link>
                      <Badge variant="outline">Pendente</Badge>
                    </div>
                    <p className="truncate text-xs text-neutral-400">
                      {member?.email || req.userEmail} ·{" "}
                      {formatRelative(req.createdAt)}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Motivo
                    </dt>
                    <dd className="mt-0.5 break-words [overflow-wrap:anywhere] leading-relaxed text-neutral-700">
                      {req.reason}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Identidade
                    </dt>
                    <dd className="mt-0.5 break-words [overflow-wrap:anywhere] leading-relaxed text-neutral-700">
                      {req.identity}
                    </dd>
                  </div>
                  {req.links && (
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        Links / prova
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed text-neutral-700">
                        {req.links}
                      </dd>
                    </div>
                  )}
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Uso da comunidade
                    </dt>
                    <dd className="mt-0.5 break-words [overflow-wrap:anywhere] leading-relaxed text-neutral-700">
                      {req.communityUse}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <Textarea
                    label="Nota do admin (opcional)"
                    value={notes[req.id] || ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [req.id]: e.target.value }))
                    }
                    placeholder="Motivo da decisão..."
                    className="min-h-[72px]"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => handleReview(req, "approved")}
                  >
                    <CheckCircle size={16} weight="fill" />
                    Aprovar verificação
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleReview(req, "rejected")}
                  >
                    <XCircle size={16} weight="bold" />
                    Rejeitar
                  </Button>
                </div>
              </article>
              );
            })
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500">
              Nenhuma decisão ainda.
            </div>
          ) : (
            history.map((req) => {
              const member = users.find((u) => u.id === req.userId);
              return (
              <div
                key={req.id}
                className="flex items-start gap-3 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-4"
              >
                <Avatar
                  name={member?.name || req.userName}
                  src={member?.avatarUrl}
                  size="sm"
                  frame={
                    member?.isVip ? member.avatarFrame : null
                  }
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[#1f1f1f]">
                      {member?.name || req.userName}
                    </span>
                    {req.status === "approved" ? (
                      <Badge variant="vip">Aprovado</Badge>
                    ) : (
                      <Badge variant="outline">Rejeitado</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 break-words [overflow-wrap:anywhere] text-xs text-neutral-400">
                    {req.reviewedAt
                      ? formatDate(req.reviewedAt)
                      : formatDate(req.createdAt)}
                    {req.adminNote ? ` · ${req.adminNote}` : ""}
                  </p>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200/90 bg-white p-3 sm:p-4"
            >
              <Link href={`/app/u/${u.id}`} className="avatar-link">
                <Avatar
                  name={u.name}
                  src={u.avatarUrl}
                  size="sm"
                  frame={u.isVip ? u.avatarFrame : null}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/app/u/${u.id}`}
                    className="text-sm font-semibold text-[#1f1f1f] hover:underline"
                  >
                    {u.name}
                  </Link>
                  {u.isVerified && <VerifiedBadge size={15} />}
                  {u.role === "admin" && <Badge variant="outline">Admin</Badge>}
                  {u.isVip && <Badge variant="vip">VIP</Badge>}
                </div>
                <p className="text-xs text-neutral-400">{u.email}</p>
              </div>
              {u.role !== "admin" && (
                <Button
                  type="button"
                  size="sm"
                  variant={u.isVerified ? "outline" : "primary"}
                  onClick={() => {
                    setVerified(u.id, !u.isVerified);
                    setToast(
                      u.isVerified
                        ? `Verificação removida de ${u.name}.`
                        : `${u.name} marcado como verificado.`
                    );
                    setTimeout(() => setToast(""), 2500);
                  }}
                >
                  {u.isVerified ? "Remover selo" : "Verificar"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "trails" && user && (
        <AdminTrailsPanel
          adminId={user.id}
          adminName={user.name}
          onToast={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(""), 2800);
          }}
        />
      )}

      {tab === "videos" && user && (
        <AdminVideosPanel
          adminId={user.id}
          adminName={user.name}
          onToast={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(""), 2800);
          }}
        />
      )}
    </div>
  );
}
