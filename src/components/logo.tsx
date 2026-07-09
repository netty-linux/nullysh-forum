import { cn } from "@/lib/utils";
import Link from "next/link";

export function Logo({
  className,
  href = "/",
  size = "md",
}: {
  className?: string;
  href?: string;
  size?: "sm" | "md";
}) {
  const sizes = {
    sm: { mark: "h-7 w-7 text-xs", text: "text-sm" },
    md: { mark: "h-8 w-8 text-sm", text: "text-base" },
  };
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-lg bg-neutral-950 font-semibold text-white",
          sizes[size].mark
        )}
      >
        N
      </span>
      <span className={cn("font-semibold tracking-tight text-neutral-950", sizes[size].text)}>
        Nullysh <span className="font-normal text-neutral-400">Forum</span>
      </span>
    </Link>
  );
}
