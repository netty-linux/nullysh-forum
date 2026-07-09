"use client";

import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Books,
  ChatsCircle,
  CrownSimple,
  House,
  PlayCircle,
  SignOut,
  UsersThree,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

const nav = [
  { href: "/app", label: "Feed", icon: House },
  { href: "/app/communities", label: "Comunidades", icon: UsersThree },
  { href: "/app/videos", label: "Vídeos", icon: PlayCircle },
  { href: "/app/materials", label: "Materiais", icon: Books },
  { href: "/app/chat", label: "Bate-papo", icon: ChatsCircle },
  { href: "/app/profile", label: "Perfil", icon: UserCircle },
];

export function AppSidebar({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const logout = useAuthStore((s) => s.logout);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-neutral-200/80 px-5">
        <Logo href="/app" size="sm" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              )}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200/80 p-4">
        {!user?.isVip && (
          <Link
            href="/pricing"
            onClick={onClose}
            className="mb-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:border-neutral-400"
          >
            <CrownSimple size={16} weight="fill" />
            Assinar Plano VIP
          </Link>
        )}
        {user && (
          <div className="flex items-center gap-3">
            <Avatar name={user.avatar || user.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-950">
                {user.name}
              </p>
              <div className="flex items-center gap-1.5">
                {user.isVip ? (
                  <Badge variant="vip">VIP</Badge>
                ) : (
                  <span className="text-xs text-neutral-400">Membro</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
              aria-label="Sair"
              title="Sair"
            >
              <SignOut size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-neutral-200/80 bg-white lg:block">
        <div className="sticky top-0 h-[100dvh]">{content}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-950/30"
            onClick={onClose}
            aria-label="Fechar"
          />
          <aside className="absolute inset-y-0 left-0 w-[min(100%,18rem)] bg-white shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
