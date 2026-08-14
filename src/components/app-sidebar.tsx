"use client";

import { Logo } from "@/components/logo";
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
  CaretDown,
  ChatsCircle,
  CrownSimple,
  Handshake,
  House,
  Lock,
  Path,
  PlayCircle,
  Robot,
  ShieldCheck,
  SignOut,
  UserCircle,
  UsersThree,
  CreditCard,
  Vault,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";

/** Larguras do rail desktop */
const RAIL_COLLAPSED_PX = 72;
const RAIL_EXPANDED_PX = 256;

type NavIcon = ComponentType<{
  size?: number | string;
  weight?: "fill" | "regular" | "bold" | "duotone";
  className?: string;
  "aria-hidden"?: boolean;
}>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Link externo (ex.: Nullysh Panel) */
  external?: boolean;
  /**
   * Visível para todos; uso pleno só para admin.
   * Não-admin: estilo fantasma + cadeado (ainda navega à página bloqueada).
   */
  adminOnly?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: "principal",
    label: "Principal",
    items: [
      { href: "/app", label: "Feed", icon: House },
      { href: "/app/chat", label: "Bate-papo", icon: ChatsCircle },
      { href: "/app/profile", label: "Perfil", icon: UserCircle },
      { href: "/app/saved", label: "Salvos", icon: BookmarkSimple },
      { href: "/app/communities", label: "Assuntos", icon: UsersThree },
    ],
  },
  {
    id: "aprender",
    label: "Aprendizado",
    items: [
      { href: "/app/trails", label: "Trilhas", icon: Path },
      { href: "/app/materials", label: "Materiais", icon: Books },
      { href: "/app/videos", label: "Vídeos", icon: PlayCircle },
      { href: "/app/mentorship", label: "Mentorias", icon: Handshake },
    ],
  },
  {
    id: "vault",
    label: "Vault",
    items: [
      { href: "/app/nullpass", label: "NullPass", icon: Vault },
      { href: "/app/nullysh-pay", label: "Nullysh Pay", icon: CreditCard },
    ],
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    items: [
      {
        href: "/app/tools/nullain",
        label: "Nullain Agent",
        icon: Robot,
        adminOnly: true,
      },
    ],
  },
  {
    id: "agenda",
    label: "Agenda",
    items: [
      { href: "/app/events", label: "Eventos", icon: CalendarBlank },
    ],
  },
];

const PANEL_URL =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_NULLYSH_PANEL_URL?.trim()) ||
  "https://panel.nullysh.com";

const ADMIN_ITEM: NavItem = {
  href: PANEL_URL,
  label: "Nullysh Panel",
  icon: ShieldCheck,
  external: true,
};

function isItemActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

function sectionHasActive(pathname: string, section: NavSection) {
  return section.items.some((item) => isItemActive(pathname, item.href));
}

type SidebarBodyProps = {
  alwaysExpanded?: boolean;
  onClose?: () => void;
};

function SidebarBody({ alwaysExpanded, onClose }: SidebarBodyProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const logout = useAuthStore((s) => s.logout);
  const requests = useVerificationStore((s) => s.requests);
  const reduce = useReducedMotion();

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );

  const sections = useMemo(() => {
    if (user?.role === "admin") {
      return [
        ...NAV_SECTIONS,
        {
          id: "staff",
          label: "Staff",
          items: [ADMIN_ITEM],
        } satisfies NavSection,
      ];
    }
    return NAV_SECTIONS;
  }, [user?.role]);

  const isAdmin = user?.role === "admin";

  /** Seções abertas — auto-abre a que tem rota ativa */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => {
      const init: Record<string, boolean> = {};
      for (const s of NAV_SECTIONS) {
        init[s.id] = s.id === "principal" || s.id === "ferramentas";
      }
      init.staff = true;
      return init;
    }
  );

  useEffect(() => {
    // Reage à rota atual (sistema externo via usePathname), não a
    // props/state do próprio componente.
    queueMicrotask(() => {
      setOpenSections((prev) => {
        const next = { ...prev };
        for (const s of sections) {
          if (sectionHasActive(pathname, s)) next[s.id] = true;
        }
        return next;
      });
    });
  }, [pathname, sections]);

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const softReveal =
    "transition-[max-width,opacity,margin,padding,gap,height,width] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]";

  const labelClass = alwaysExpanded
    ? "max-w-[11rem] opacity-100"
    : cn(
        "max-w-0 overflow-hidden opacity-0",
        "group-hover/rail:max-w-[11rem] group-hover/rail:opacity-100",
        softReveal
      );

  const itemPadClass = alwaysExpanded
    ? "gap-3 px-3 py-2"
    : cn(
        "mx-auto h-11 w-11 justify-center gap-0 px-0 py-0",
        "group-hover/rail:mx-0 group-hover/rail:h-auto group-hover/rail:w-full group-hover/rail:justify-start group-hover/rail:gap-3 group-hover/rail:px-3 group-hover/rail:py-2",
        softReveal
      );

  const footerPadClass = alwaysExpanded
    ? "p-3"
    : cn("px-2 py-3 group-hover/rail:p-3", softReveal);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#141414]">
      {/* Logo — colapsado: só o quadradinho; hover: + wordmark */}
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-neutral-200/80 dark:border-zinc-800/80",
          alwaysExpanded
            ? "h-[4.25rem] justify-between px-4"
            : "h-16 justify-center px-2 group-hover/rail:h-[4.25rem] group-hover/rail:justify-start group-hover/rail:px-4",
          softReveal
        )}
      >
        <Logo
          href="/app"
          size="lg"
          /* Wordmark sempre no DOM no rail: some/aparece no hover.
             Nunca esconder o 1º span (marca) — bug antigo usava last-child
             e apagava a logo quando showWordmark era false. */
          showWordmark
          className={cn(
            !alwaysExpanded &&
              cn(
                "gap-0 group-hover/rail:gap-2.5",
                softReveal,
                /* 2º filho = wordmark “Nullysh Forum” */
                "[&>span:nth-child(2)]:max-w-0 [&>span:nth-child(2)]:overflow-hidden [&>span:nth-child(2)]:opacity-0 [&>span:nth-child(2)]:whitespace-nowrap",
                "group-hover/rail:[&>span:nth-child(2)]:max-w-[9rem] group-hover/rail:[&>span:nth-child(2)]:opacity-100"
              )
          )}
        />
        {onClose && (
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={reduce ? undefined : { scale: 0.9 }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-zinc-700 lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={16} aria-hidden />
          </motion.button>
        )}
      </div>

      {/* Nav agrupada */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden thin-scroll",
          alwaysExpanded ? "space-y-4 p-3" : "space-y-0.5 px-2 py-3 group-hover/rail:space-y-4 group-hover/rail:p-3",
          softReveal
        )}
      >
        {sections.map((section) => {
          const open = alwaysExpanded
            ? openSections[section.id] !== false
            : true; // rail colapsado: seções abertas (só ícones)

          return (
            <div key={section.id} className="min-w-0">
              {/* Header da seção — visível no drawer e no rail expandido */}
              <button
                type="button"
                onClick={() => {
                  if (alwaysExpanded) toggleSection(section.id);
                }}
                className={cn(
                  "mb-1 flex w-full items-center gap-1 px-2 text-left",
                  alwaysExpanded
                    ? "opacity-100"
                    : "h-0 overflow-hidden opacity-0 group-hover/rail:mb-1 group-hover/rail:h-auto group-hover/rail:opacity-100",
                  softReveal,
                  !alwaysExpanded && "pointer-events-none group-hover/rail:pointer-events-auto"
                )}
                aria-expanded={open}
              >
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  {section.label}
                </span>
                {alwaysExpanded && (
                  <CaretDown
                    size={12}
                    weight="bold"
                    className={cn(
                      "shrink-0 text-neutral-400 transition-transform duration-200",
                      open && "rotate-180"
                    )}
                    aria-hidden
                  />
                )}
              </button>

              <div
                className={cn(
                  "space-y-0.5 overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                  alwaysExpanded
                    ? open
                      ? "max-h-[32rem] opacity-100"
                      : "max-h-0 opacity-0"
                    : "max-h-[32rem] opacity-100"
                )}
              >
                {section.items.map((item) => {
                  const isPanel = !!item.external;
                  const locked = !!item.adminOnly && !isAdmin;
                  const active =
                    isPanel || locked
                      ? false
                      : isItemActive(pathname, item.href);
                  const Icon = item.icon;
                  const showBadge =
                    isPanel && pendingCount > 0 && !active;
                  const itemClass = cn(
                    "nav-item relative flex items-center rounded-xl text-sm font-medium",
                    softReveal,
                    itemPadClass,
                    locked
                      ? "cursor-default text-neutral-400/55 hover:bg-transparent dark:text-zinc-500/45"
                      : active
                        ? "bg-[#1f1f1f] text-white shadow-[0_2px_8px_-2px_rgb(0_0_0/0.25)] dark:bg-white/12 dark:text-white dark:shadow-none"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-[#1f1f1f] dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-white"
                  );
                  const title = locked
                    ? `${item.label} · só administradores`
                    : item.label;
                  const content = (
                    <>
                      <Icon
                        size={22}
                        weight={active ? "fill" : "regular"}
                        className={cn("shrink-0", locked && "opacity-60")}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate whitespace-nowrap",
                          labelClass,
                          locked && "text-neutral-400/70 dark:text-zinc-500/55"
                        )}
                      >
                        {item.label}
                      </span>
                      {locked && (
                        <Lock
                          size={14}
                          weight="bold"
                          className={cn(
                            "shrink-0 text-neutral-400/70 dark:text-zinc-500/50",
                            alwaysExpanded
                              ? "opacity-100"
                              : "absolute right-1.5 top-1.5 opacity-100 group-hover/rail:static group-hover/rail:opacity-100"
                          )}
                          aria-hidden
                        />
                      )}
                      {isPanel && pendingCount > 0 && (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center rounded-full text-[10px] font-medium tabular-nums",
                            alwaysExpanded
                              ? "h-5 min-w-5 px-1.5"
                              : "absolute right-1 top-1 h-4 min-w-4 px-1 group-hover/rail:static group-hover/rail:h-5 group-hover/rail:min-w-5 group-hover/rail:px-1.5",
                            "bg-red-500 text-white",
                            showBadge && "animate-pulse"
                          )}
                        >
                          {pendingCount}
                        </span>
                      )}
                    </>
                  );

                  if (isPanel) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose}
                        title={title}
                        className={itemClass}
                      >
                        {content}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      title={title}
                      aria-disabled={locked || undefined}
                      className={itemClass}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "mt-auto space-y-2 border-t border-neutral-200/80 dark:border-zinc-800/80",
          footerPadClass
        )}
      >
        {!user?.isVip && (
          <Link
            href="/pricing"
            onClick={onClose}
            title="Assinar Plano VIP"
            className={cn(
              "pressable flex items-center rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-medium text-neutral-950 hover:border-neutral-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500",
              softReveal,
              alwaysExpanded
                ? "gap-2 px-3 py-2.5"
                : "mx-auto h-12 w-12 justify-center group-hover/rail:mx-0 group-hover/rail:h-auto group-hover/rail:w-full group-hover/rail:justify-start group-hover/rail:gap-2 group-hover/rail:px-3 group-hover/rail:py-2.5"
            )}
          >
            <CrownSimple
              size={18}
              weight="fill"
              className="shrink-0"
              aria-hidden
            />
            <span className={cn("truncate whitespace-nowrap", labelClass)}>
              Assinar Plano VIP
            </span>
          </Link>
        )}

        {user && (
          <div
            className={cn(
              "flex items-center",
              softReveal,
              alwaysExpanded
                ? "gap-2.5"
                : "flex-col gap-2 group-hover/rail:flex-row group-hover/rail:gap-2.5"
            )}
          >
            <Link
              href={`/app/u/${user.id}`}
              onClick={onClose}
              className="avatar-link shrink-0"
              title={user.name}
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
              className={cn(
                "min-w-0",
                softReveal,
                alwaysExpanded
                  ? "flex-1 opacity-100"
                  : "pointer-events-none h-0 w-0 flex-none overflow-hidden opacity-0 group-hover/rail:pointer-events-auto group-hover/rail:h-auto group-hover/rail:w-auto group-hover/rail:flex-1 group-hover/rail:opacity-100"
              )}
            >
              <p className="flex items-center gap-1 truncate text-sm font-medium text-[#1f1f1f] transition-opacity hover:opacity-70 dark:text-zinc-100">
                <span className="truncate">{user.name}</span>
                {user.isVerified && <VerifiedBadge size={14} />}
              </p>
              <div className="mt-0.5">
                {user.isVip ? (
                  <Badge variant="vip">VIP</Badge>
                ) : (
                  <span className="text-xs text-neutral-400">Membro</span>
                )}
              </div>
            </Link>

            <motion.button
              type="button"
              whileTap={reduce ? undefined : { scale: 0.9 }}
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
}

export function AppSidebar({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <>
      <div
        className="hidden shrink-0 lg:block"
        style={{ width: RAIL_COLLAPSED_PX }}
        aria-hidden
      />

      <aside
        className={cn(
          "group/rail fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-neutral-200/80 bg-white lg:block",
          "dark:border-zinc-800/80 dark:bg-[#141414]",
          "w-[72px] hover:w-[256px]",
          "transition-[width,box-shadow] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          "hover:shadow-[6px_0_24px_-14px_rgb(0_0_0/0.12)]",
          "motion-reduce:transition-none"
        )}
      >
        <div className="h-[100dvh] w-full overflow-hidden">
          <SidebarBody />
        </div>
      </aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-neutral-950/30 backdrop-blur-[2px]"
              onClick={onClose}
              aria-label="Fechar"
            />
            <motion.aside
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="absolute inset-y-0 left-0 w-[min(100%,18rem)] border-r border-neutral-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#141414]"
            >
              <SidebarBody alwaysExpanded onClose={onClose} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
