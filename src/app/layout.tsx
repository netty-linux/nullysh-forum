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
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Nullysh Forum",
    description:
      "Espaço colaborativo VIP: tutoriais, IAs, ferramentas, comunidades e networking.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-neutral-950 antialiased">
        {children}
      </body>
    </html>
  );
}
