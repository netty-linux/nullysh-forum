"use client";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useVerificationStore } from "@/lib/verification-store";
import { cn } from "@/lib/utils";
import {
  BookmarkSimple,
  Books,
  CalendarBlank,
  ChatsCircle,
  CrownSimple,
  Fire,
  Handshake,
  House,
  Path,
  PlayCircle,
  ShieldCheck,
  SignOut,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

const baseNav = [
  { href: "/app", label: "Feed", icon: House },
  { href: "/app/populares", label: "Populares", icon: Fire },
  { href: "/app/saved", label: "Salvos", icon: BookmarkSimple },
  { href: "/app/trails", label: "Trilhas", icon: Path },
  { href: "/app/mentorship", label: "Mentorias", icon: Handshake },
  { href: "/app/events", label: "Eventos", icon: CalendarBlank },
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
  const requests = useVerificationStore((s) => s.requests);
  const reduce = useReducedMotion();

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );

  const nav = useMemo(() => {
    if (user?.role === "admin") {
      return [
        ...baseNav,
        { href: "/app/admin", label: "Painel ADM", icon: ShieldCheck },
      ];
    }
    return baseNav;
  }, [user?.role]);

  const content = (
    <div className="flex h-full flex-col bg-[var(--surface-elevated)]">
      <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
        <Logo href="/app" size="sm" />
        {onClose && (
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={16} aria-hidden />
          </motion.button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map((item, i) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const showBadge =
            item.href === "/app/admin" && pendingCount > 0 && active === false;
          return (
            <motion.div
              key={item.href}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: reduce ? 0 : i * 0.02,
                duration: 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Link
                href={item.href}
                onClick={onClose}
                className={cn(
                  "nav-item relative flex items-center gap-3 text-[14px]",
                  active
                    ? "bg-[#1f1f1f] font-medium text-white shadow-[var(--shadow-sm)] dark:bg-white/12 dark:text-white dark:shadow-none"
                    : "font-normal text-[var(--text-secondary)] hover:bg-neutral-100 hover:text-[var(--text-primary)] dark:hover:bg-zinc-800/80 dark:hover:text-white"
                )}
              >
                <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.href === "/app/admin" && pendingCount > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                      active
                        ? "bg-white text-[#1f1f1f] dark:bg-white dark:text-zinc-900"
                        : "bg-red-500 text-white",
                      showBadge && "animate-pulse"
                    )}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-[var(--border)] p-4">
        <ThemeToggle />

        {!user?.isVip && (
          <Link
            href="/pricing"
            onClick={onClose}
            className="pressable flex items-center gap-2 rounded-[var(--radius-md)] bg-[#1f1f1f] px-3 py-2.5 text-[14px] font-medium text-white shadow-[var(--shadow-sm)]"
          >
            <CrownSimple size={16} weight="fill" aria-hidden />
            Assinar Plano VIP
          </Link>
        )}
        {user && (
          <div className="flex items-center gap-3">
            <Link
              href={`/app/u/${user.id}`}
              onClick={onClose}
              className="avatar-link"
            >
              <Avatar
                name={user.name}
                src={user.avatarUrl}
                size="sm"
                frame={user.isVip ? user.avatarFrame : null}
              />
            </Link>
            <Link
              href={`/app/u/${user.id}`}
              onClick={onClose}
              className="min-w-0 flex-1"
            >
              <p className="flex items-center gap-1 truncate text-[14px] font-medium text-[var(--text-primary)] transition-opacity hover:opacity-70">
                <span className="truncate">{user.name}</span>
                {user.isVerified && <VerifiedBadge size={14} />}
              </p>
              <div className="mt-0.5">
                {user.isVip ? (
                  <Badge variant="vip">VIP</Badge>
                ) : (
                  <span className="text-[13px] font-medium text-[var(--text-tertiary)]">
                    Membro
                  </span>
                )}
              </div>
            </Link>
            <motion.button
              type="button"
              whileTap={reduce ? undefined : { scale: 0.96 }}
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              aria-label="Sair"
              title="Sair"
            >
              <SignOut size={18} aria-hidden />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-neutral-200/80 bg-white dark:border-zinc-800/80 dark:bg-[#141414] lg:block">
        <div className="sticky top-0 h-[100dvh]">{content}</div>
      </aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              onClick={onClose}
              aria-label="Fechar"
            />
            <motion.aside
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="absolute inset-y-0 left-0 w-[min(100%,18rem)] border-r border-neutral-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#141414]"
            >
              {content}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
