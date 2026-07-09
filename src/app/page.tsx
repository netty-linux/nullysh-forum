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
    title: "Comunidades",
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
      <section className="relative overflow-hidden border-b border-neutral-200/80">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-24">
          <div className="lg:col-span-7">
            <p className="text-sm font-medium text-neutral-500">
              Comunidade Nullysh
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              O forum VIP para quem constrói com método
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-neutral-500 sm:text-lg">
              Vídeos, materiais, IAs, comunidades e networking em um espaço
              limpo, colaborativo e focado em execução.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button size="lg">
                  Criar conta
                  <ArrowRight size={18} weight="bold" />
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
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Plano único
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {VIP_PLAN.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold tracking-tight">
                    {formatCurrency(VIP_PLAN.price)}
                  </p>
                  <p className="text-xs text-neutral-400">/{VIP_PLAN.period}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {VIP_PLAN.features.slice(0, 5).map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm text-neutral-600"
                  >
                    <Sparkle
                      size={16}
                      weight="fill"
                      className="mt-0.5 shrink-0 text-neutral-950"
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
      </section>

      {/* Features */}
      <section id="recursos" className="border-b border-neutral-200/80">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-md text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Tudo que a comunidade precisa, em um lugar
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-neutral-500 sm:text-base">
            Design white minimalist, navegação clara e foco no conteúdo que
            move o seu negócio.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-5 transition-colors hover:border-neutral-300 hover:bg-white"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-white">
                    <Icon size={18} weight="fill" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-950">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Communities */}
      <section id="comunidades" className="border-b border-neutral-200/80">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                Comunidades dentro do forum
              </h2>
              <p className="mt-3 max-w-md text-sm text-neutral-500 sm:text-base">
                Espaços temáticos para IAs, negócios, design e networking.
              </p>
            </div>
            <Link href="/register">
              <Button variant="outline">Explorar após login</Button>
            </Link>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((c) => (
              <div
                key={c.id}
                className="flex flex-col rounded-2xl border border-neutral-200/80 p-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-950">{c.name}</h3>
                  {c.vipOnly && (
                    <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      VIP
                    </span>
                  )}
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-500">
                  {c.description}
                </p>
                <p className="mt-4 text-xs text-neutral-400">
                  {c.members.toLocaleString("pt-BR")} membros · {c.posts} posts
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-neutral-200/80 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Entre no Nullysh Forum
            </h2>
            <p className="mt-3 max-w-md text-sm text-neutral-400 sm:text-base">
              Crie sua conta grátis e desbloqueie o VIP quando quiser.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-white text-neutral-950 hover:bg-neutral-100"
              >
                Começar agora
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-neutral-700 bg-transparent text-white hover:border-neutral-500 hover:bg-neutral-900"
              >
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-neutral-400">
          © {new Date().getFullYear()} Nullysh Forum. MVP protótipo.
        </p>
        <div className="flex gap-6 text-sm text-neutral-500">
          <Link href="/pricing" className="hover:text-neutral-950">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-neutral-950">
            Login
          </Link>
          <Link href="/register" className="hover:text-neutral-950">
            Cadastro
          </Link>
        </div>
      </footer>
    </div>
  );
}
