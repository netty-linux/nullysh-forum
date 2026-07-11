import { MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";
import { communities, VIP_PLAN } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowRight,
  Books,
  ChatsCircle,
  PlayCircle,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

const features = [
  {
    icon: PlayCircle,
    title: "Vídeos e tutoriais",
    body: "Aulas práticas de IA, design, ofertas e operação.",
  },
  {
    icon: UsersThree,
    title: "Assuntos",
    body: "Salas temáticas para networking e troca real.",
  },
  {
    icon: Books,
    title: "Materiais e cursos",
    body: "Templates, checklists e metodologias prontas.",
  },
  {
    icon: ChatsCircle,
    title: "Bate-papo e rede",
    body: "Chat ao vivo e feed social da comunidade.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-black">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-80" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-24">
          <div className="lg:col-span-7 lg:pt-2">
            <p className="inline-flex rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600">
              Comunidade Nullysh
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight text-black sm:text-5xl lg:text-6xl">
              O forum VIP para quem constrói com método
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
              Vídeos, materiais, IAs, assuntos e networking em um espaço
              limpo, colaborativo e focado em execução.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button size="lg">
                  Criar conta
                  <ArrowRight size={16} weight="bold" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  Ver Plano VIP
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[8px_8px_0_0_#1f1f1f]">
              <div className="flex items-start justify-between gap-4 border-b-2 border-black bg-black p-6 text-white sm:p-7">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    Plano único
                  </p>
                  <p className="mt-1 text-xl font-semibold">{VIP_PLAN.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatCurrency(VIP_PLAN.price)}
                  </p>
                  <p className="text-xs text-neutral-400">/{VIP_PLAN.period}</p>
                </div>
              </div>
              <div className="p-6 sm:p-7">
                <ul className="space-y-3">
                  {VIP_PLAN.features.slice(0, 5).map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-700"
                    >
                      <Sparkle
                        size={16}
                        weight="fill"
                        className="mt-0.5 shrink-0 text-black"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/pricing" className="mt-6 block">
                  <Button className="w-full" size="lg">
                    Quero ser VIP
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recursos - banda cinza bem visível */}
      <section
        id="recursos"
        className="scroll-mt-20 border-b-2 border-black bg-[#f0f0f0]"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Recursos
          </p>
          <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-black sm:text-4xl">
            Tudo que a comunidade precisa, em um lugar
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-neutral-600">
            Design white minimalist, navegação clara e foco no conteúdo que
            move o seu negócio.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#1f1f1f] transition-transform hover:-translate-y-0.5"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
                    <Icon size={18} weight="fill" />
                  </div>
                  <h3 className="text-base font-semibold text-black">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Assuntos */}
      <section
        id="assuntos"
        className="scroll-mt-20 border-b-2 border-black bg-white"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Assuntos
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                Salas dentro do forum
              </h2>
              <p className="mt-3 max-w-md text-base text-neutral-600">
                Espaços temáticos para IAs, negócios, design e networking.
              </p>
            </div>
            <Link href="/register">
              <Button variant="outline">Explorar após login</Button>
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((c) => (
              <div
                key={c.id}
                className="flex flex-col rounded-2xl border-2 border-neutral-200 bg-white p-5 transition-colors hover:border-black"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-black">{c.name}</h3>
                  {c.vipOnly && (
                    <span className="rounded-md bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      VIP
                    </span>
                  )}
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">
                  {c.description}
                </p>
                <p className="mt-4 border-t border-neutral-200 pt-3 text-xs font-medium text-neutral-500">
                  {c.source === "staff" ? "Oficial · Staff" : "Assunto"}
                  {c.vipOnly ? " · VIP" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1f1f1f] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Entre no Nullysh Forum
            </h2>
            <p className="mt-3 max-w-md text-base text-neutral-400">
              Crie sua conta grátis e desbloqueie o VIP quando quiser.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg" variant="inverse">
                Começar agora
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outlineInverse">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-[#f0f0f0]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm font-medium text-neutral-600">
            © {new Date().getFullYear()} Nullysh Forum. MVP protótipo.
          </p>
          <div className="flex gap-6 text-sm font-medium text-neutral-600">
            <Link href="/pricing" className="hover:text-black">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-black">
              Login
            </Link>
            <Link href="/register" className="hover:text-black">
              Cadastro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
