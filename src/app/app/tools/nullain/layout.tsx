// Página client-side (useAuth) sem dados no server — evita o pré-render
// estático do Next/OpenNext que aplicava Cache-Control: s-maxage=31536000
// na borda e mantinha versões antigas servidas após deploy.
export const dynamic = "force-dynamic";

export default function NullainLayout({ children }: { children: React.ReactNode }) {
  return children;
}
