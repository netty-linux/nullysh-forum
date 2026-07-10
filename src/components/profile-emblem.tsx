"use client";

import { getEmblem, type EmblemId } from "@/lib/emblems";
import { cn } from "@/lib/utils";

type Props = {
  id: EmblemId | null | undefined;
  size?: number;
  className?: string;
  /** Mostra nome no title/tooltip */
  showTitle?: boolean;
};

/** Emblema equipado — pequeno, ao lado do @handle */
export function ProfileEmblem({
  id,
  size = 20,
  className,
  showTitle = true,
}: Props) {
  const def = getEmblem(id);
  if (!def) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${def.src}?v=4`}
      alt={def.name}
      title={showTitle ? `${def.name} — ${def.description}` : undefined}
      width={size}
      height={size}
      className={cn(
        "inline-block shrink-0 object-contain object-center",
        "drop-shadow-[0_1px_1px_rgb(0_0_0/0.15)]",
        className
      )}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
