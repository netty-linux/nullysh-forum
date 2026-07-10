"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/hooks/use-auth";
import { useVerificationStore } from "@/lib/verification-store";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, SealCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

export default function VerificationRequestPage() {
  const { user } = useAuth();
  const router = useRouter();
  const submitRequest = useVerificationStore((s) => s.submitRequest);
  const requests = useVerificationStore((s) => s.requests);

  const latest = useMemo(
    () =>
      user
        ? requests
            .filter((r) => r.userId === user.id)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )[0]
        : undefined,
    [requests, user]
  );

  const [reason, setReason] = useState("");
  const [identity, setIdentity] = useState("");
  const [links, setLinks] = useState("");
  const [communityUse, setCommunityUse] = useState("");
  const [isRealPerson, setIsRealPerson] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!user) return null;

  if (user.isVerified) {
    return (
      <div className="app-page mx-auto max-w-lg px-4 py-12 text-center sm:px-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50">
          <VerifiedBadge size={28} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-[#1f1f1f]">
          Você já é verificado
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Seu perfil possui o selo azul de verificação.
        </p>
        <Link href={`/app/u/${user.id}`} className="mt-6 inline-block">
          <Button>Ver meu perfil</Button>
        </Link>
      </div>
    );
  }

  const hasPending = latest?.status === "pending";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setSuccess("");
    const result = submitRequest({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      reason,
      identity,
      links,
      communityUse,
      isRealPerson,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(
      "Solicitação enviada. Os administradores vão analisar no Painel ADM."
    );
    setReason("");
    setIdentity("");
    setLinks("");
    setCommunityUse("");
    setIsRealPerson(false);
  }

  return (
    <div className="app-page mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/app/profile"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition hover:text-[#1f1f1f]"
      >
        <ArrowLeft size={15} weight="bold" />
        Perfil
      </Link>

      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50">
          <VerifiedBadge size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1f1f1f]">
            Obter perfil verificado
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
            O selo azul confirma que você é uma pessoa real e relevante na
            comunidade. Responda com honestidade para evitar perfis fake.
          </p>
        </div>
      </div>

      {latest && latest.status !== "pending" && (
        <div
          className={
            latest.status === "approved"
              ? "mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
              : "mb-5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
          }
        >
          {latest.status === "approved"
            ? "Sua última solicitação foi aprovada."
            : `Sua última solicitação foi rejeitada${
                latest.adminNote ? `: ${latest.adminNote}` : "."
              } Você pode enviar uma nova.`}
          {latest.reviewedAt && (
            <span className="mt-1 block text-xs opacity-70">
              {formatDate(latest.reviewedAt)}
            </span>
          )}
        </div>
      )}

      {hasPending ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-center gap-2">
            <SealCheck size={20} weight="fill" className="text-amber-700" />
            <p className="font-semibold text-amber-900">Em análise</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-amber-800/90">
            Sua solicitação foi enviada em {formatDate(latest.createdAt)} e
            está na fila do Painel ADM. Você será notificado quando houver
            decisão (no MVP, confira seu perfil periodicamente).
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/app/u/${user.id}`)}
          >
            Ver meu perfil
          </Button>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_3px_rgb(0_0_0/0.04)] sm:p-6"
        >
          <Textarea
            label="Por que você quer ser verificado?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Sou criador de conteúdo na área X e quero que a comunidade saiba que sou eu..."
            required
            className="min-h-[100px]"
            hint="Mínimo 20 caracteres."
          />
          <Textarea
            label="Quem é você? O que faz?"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder="Nome real ou marca, área de atuação, tempo de experiência..."
            required
            className="min-h-[90px]"
            hint="Mínimo 15 caracteres."
          />
          <Textarea
            label="Links de prova (redes, site, portfólio)"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="Instagram, LinkedIn, site, YouTube... um por linha"
            className="min-h-[80px]"
            hint="Opcional, mas ajuda a validar."
          />
          <Textarea
            label="Como você usa o Nullysh Forum?"
            value={communityUse}
            onChange={(e) => setCommunityUse(e.target.value)}
            placeholder="Ex.: posto tutoriais, ajudo em IAs, networking..."
            required
            className="min-h-[80px]"
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3.5">
            <input
              type="checkbox"
              checked={isRealPerson}
              onChange={(e) => setIsRealPerson(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-[#1f1f1f]"
            />
            <span className="text-sm leading-relaxed text-neutral-700">
              Declaro que este perfil representa uma{" "}
              <strong className="font-semibold text-[#1f1f1f]">
                pessoa real
              </strong>{" "}
              (ou marca legítima), não um fake, bot ou conta enganosa.
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
            </p>
          )}

          <Button type="submit" className="w-full sm:w-auto">
            <SealCheck size={18} weight="fill" />
            Enviar solicitação
          </Button>
        </form>
      )}
    </div>
  );
}
