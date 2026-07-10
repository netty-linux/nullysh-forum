import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  "2xl": "h-24 w-24 text-2xl sm:h-[6.5rem] sm:w-[6.5rem] sm:text-3xl",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
  /** @deprecated Molduras removidas — prop ignorada por compatibilidade */
  frame?: string | null;
  framed?: boolean;
}) {
  const letter = (name || "U").slice(0, 1).toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn(
          "shrink-0 overflow-hidden rounded-full bg-neutral-200 object-cover",
          sizeMap[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1f1f1f] font-medium tracking-tight text-white",
        sizeMap[size],
        className
      )}
      aria-hidden
    >
      {letter}
    </div>
  );
}
