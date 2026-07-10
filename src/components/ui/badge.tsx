import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

type Variant = "default" | "vip" | "muted" | "outline";

const variants: Record<Variant, string> = {
  default: "bg-[#1f1f1f] text-white",
  vip: "bg-[#1f1f1f] text-white",
  muted: "bg-neutral-100 text-neutral-600",
  outline: "border border-neutral-200/90 text-neutral-500 bg-white",
};

export function Badge({
  className,
  variant = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium tracking-[-0.01em]",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
