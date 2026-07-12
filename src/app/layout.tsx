import { ChatBridge } from "@/components/chat-bridge";
import { PostsBridge } from "@/components/posts-bridge";
import { SupabaseAuthBridge } from "@/components/supabase-auth-bridge";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

/**
 * Body/UI: Inter variable — features cv05/cv11/ss01 aproximam Chirp / gg sans.
 * Display: Satoshi (Fontshare) via CSS link — personalidade sem clone.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nullysh Forum",
    template: "%s · Nullysh Forum",
  },
  description:
    "Comunidade VIP da Nullysh: vídeos, materiais, cursos, bate-papo e rede social para criadores e founders.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: "/favicon.png",
  },
  openGraph: {
    title: "Nullysh Forum",
    description:
      "Espaço colaborativo VIP: tutoriais, IAs, ferramentas, assuntos e networking.",
    type: "website",
    locale: "pt_BR",
  },
};

/** Tema fixo light por enquanto (toggle de modo escuro desativado). */
const themeInitScript = `
(function(){
  try {
    var root = document.documentElement;
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    try { localStorage.setItem('nullysh-theme', 'light'); } catch (e) {}
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Satoshi — display / headings (Fontshare) */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --font-satoshi: "Satoshi", var(--font-inter), system-ui, sans-serif; }`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <ThemeProvider>
          <SupabaseAuthBridge>
            <PostsBridge>
              <ChatBridge>{children}</ChatBridge>
            </PostsBridge>
          </SupabaseAuthBridge>
        </ThemeProvider>
      </body>
    </html>
  );
}
