import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

export function Logo({
  className,
  href = "/",
  size = "md",
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  size?: "sm" | "md";
  showWordmark?: boolean;
}) {
  const sizes = {
    sm: { mark: 28, text: "text-sm" },
    md: { mark: 32, text: "text-[15px]" },
  };
  const px = sizes[size].mark;

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-90",
        className
      )}
    >
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-lg bg-white",
          "ring-1 ring-black/5 shadow-[0_1px_2px_rgb(31_31_31/0.08)]",
          "transition-transform duration-200 group-active:scale-[0.97]"
        )}
        style={{ width: px, height: px }}
      >
        <Image
          src="/brand/logo.jpg"
          alt="Nullysh Forum"
          width={px}
          height={px}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {showWordmark && (
        <span
          className={cn(
            "font-semibold tracking-[-0.02em] text-[#1f1f1f]",
            sizes[size].text
          )}
        >
          Nullysh{" "}
          <span className="font-normal text-neutral-400">Forum</span>
        </span>
      )}
    </Link>
  );
}
