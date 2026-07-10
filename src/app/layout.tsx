import { SupabaseAuthBridge } from "@/components/supabase-auth-bridge";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased transition-colors duration-200">
        <ThemeProvider>
          <SupabaseAuthBridge>{children}</SupabaseAuthBridge>
        </ThemeProvider>
      </body>
    </html>
  );
}
