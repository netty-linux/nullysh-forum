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
      { url: "/brand/logo.jpg", type: "image/jpeg", sizes: "any" },
      { url: "/favicon.jpg", type: "image/jpeg" },
    ],
    apple: [{ url: "/brand/logo.jpg", type: "image/jpeg" }],
  },
  openGraph: {
    title: "Nullysh Forum",
    description:
      "Espaço colaborativo VIP: tutoriais, IAs, ferramentas, comunidades e networking.",
    type: "website",
    locale: "pt_BR",
  },
};

const themeInitScript = `
(function(){
  try {
    var k = 'nullysh-theme';
    var t = localStorage.getItem(k);
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
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
          <SupabaseAuthBridge>{children}</SupabaseAuthBridge>
        </ThemeProvider>
      </body>
    </html>
  );
}
