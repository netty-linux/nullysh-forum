"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/utils";
import { CrownSimple, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function ProfilePage() {
  const { user } = useAuth();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setBio(user.bio || "");
    }
  }, [user]);

  function onSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const result = updateProfile({
      name,
      email,
      bio,
      password: password || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPassword("");
    setMessage("Perfil atualizado com sucesso.");
  }

  function onDelete() {
    if (
      !confirm(
        "Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita no MVP."
      )
    ) {
      return;
    }
    const result = deleteAccount();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Perfil
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Gerencie seus dados (CRUD local do MVP).
        </p>
      </div>

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-neutral-200/80 bg-white p-6">
        <Avatar name={user.avatar || user.name} size="lg" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-neutral-950">{user.name}</p>
            {user.isVip ? (
              <Badge variant="vip">
                <CrownSimple size={10} weight="fill" className="mr-0.5" />
                VIP
              </Badge>
            ) : (
              <Badge>Membro</Badge>
            )}
            {user.role === "admin" && <Badge variant="outline">Admin</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">{user.email}</p>
          <p className="mt-1 text-xs text-neutral-400">
            Membro desde {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      {!user.isVip && (
        <Link
          href="/pricing"
          className="mb-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition-colors hover:border-neutral-400"
        >
          <div>
            <p className="text-sm font-medium text-neutral-950">
              Desbloqueie o Plano VIP
            </p>
            <p className="text-xs text-neutral-500">
              Vídeos, materiais e salas exclusivas
            </p>
          </div>
          <CrownSimple size={20} weight="fill" />
        </Link>
      )}

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-6"
      >
        <h2 className="text-sm font-semibold text-neutral-950">
          Editar dados
        </h2>
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Textarea
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Conte um pouco sobre você..."
          className="min-h-[100px]"
        />
        <Input
          label="Nova senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Deixe em branco para manter"
          hint="Mínimo 6 caracteres se for alterar."
        />

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit">Salvar alterações</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              logout();
              router.push("/");
            }}
          >
            Sair da conta
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-6">
        <h2 className="text-sm font-semibold text-red-800">Zona de perigo</h2>
        <p className="mt-1 text-sm text-red-700/80">
          Exclui permanentemente sua conta deste navegador (CRUD delete).
        </p>
        <Button
          type="button"
          variant="danger"
          className="mt-4"
          onClick={onDelete}
        >
          <Trash size={16} weight="bold" />
          Excluir conta
        </Button>
      </div>
    </div>
  );
}
