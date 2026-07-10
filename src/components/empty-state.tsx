import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Empty state padronizado: ícone + título curto + descrição + CTA.
 * Nunca deixe uma seção em branco sem este bloco.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("empty-state", className)} role="status">
      <div className="empty-state__icon" aria-hidden>
        {icon}
      </div>
      <h2 className="empty-state__title">{title}</h2>
      {description ? (
        <p className="empty-state__desc">{description}</p>
      ) : null}
      {action ? <div className="empty-state__cta">{action}</div> : null}
    </div>
  );
}
