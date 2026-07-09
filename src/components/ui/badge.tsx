import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

type Variant = "default" | "vip" | "muted" | "outline";

const variants: Record<Variant, string> = {
  default: "bg-neutral-950 text-white",
  vip: "bg-neutral-950 text-white",
  muted: "bg-neutral-100 text-neutral-600",
  outline: "border border-neutral-200 text-neutral-600 bg-white",
};

export function Badge({
  className,
  variant = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
