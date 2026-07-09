import { cn } from "@/lib/utils";

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };
  const letter = (name || "U").slice(0, 1).toUpperCase();
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-950 font-medium text-white",
        sizes[size],
        className
      )}
      aria-hidden
    >
      {letter}
    </div>
  );
}
