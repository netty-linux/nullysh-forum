import { isEmailAllowed } from "@/lib/access-control";
import { useAuthStore } from "@/lib/auth-store";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const allowed = user ? isEmailAllowed(user.email) : false;

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)]">
        <div className="flex w-full max-w-sm flex-col gap-3 px-6">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-24 w-full rounded-[var(--radius-lg)]" />
          <p className="text-[13px] text-[var(--text-tertiary)]">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)]">
        <p className="text-[13px] text-[var(--text-tertiary)]">Redirecionando…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#ebebeb]">
        <div className="h-1.5 w-full bg-black" />
        <div className="border-b border-neutral-300 bg-white px-4 py-4 sm:px-6">
          <Logo />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
          <div className="app-page w-full max-w-[460px]">
            <div className="overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)]">
              <div className="border-b border-neutral-200 bg-black px-6 py-5 text-white sm:px-8">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300 border border-amber-500/30">
                  Em Desenvolvimento
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                  Estamos em Desenvolvimento
                </h1>
              </div>

              <div className="p-6 sm:p-8 space-y-4">
                <p className="text-sm leading-relaxed text-neutral-600">
                  O <strong>Nullysh Forum</strong> está em fase restrita de desenvolvimento e testes fechados.
                </p>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed space-y-2">
                  <p className="font-semibold">Acesso Restrito</p>
                  <p>
                    A conta <strong>{user.email}</strong> não possui permissão de acesso no momento. Apenas e-mails pré-autorizados da equipe têm autorização para navegar no sistema.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full"
                    onClick={async () => {
                      await logout();
                      router.replace("/login");
                    }}
                  >
                    Sair e entrar com outra conta
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
