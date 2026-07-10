"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger"
  | "inverse"
  | "outlineInverse";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-[#1a1a1a] text-white shadow-[var(--shadow-sm)] hover:bg-[#2a2a2a] hover:shadow-[var(--shadow-sm)] active:scale-[0.98] disabled:bg-neutral-300 disabled:text-white disabled:shadow-none disabled:scale-100",
  secondary:
    "bg-neutral-200 text-[#1a1a1a] hover:bg-neutral-300 active:scale-[0.98]",
  ghost:
    "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-[#1a1a1a] active:scale-[0.98]",
  outline:
    "border border-[var(--border)] bg-[var(--surface-elevated)] text-[#1a1a1a] shadow-[var(--shadow-sm)] hover:border-[rgba(0,0,0,0.16)] active:scale-[0.98]",
  inverse:
    "bg-white text-[#1a1a1a] shadow-[var(--shadow-sm)] hover:bg-neutral-100 active:scale-[0.98]",
  outlineInverse:
    "border border-white/80 bg-transparent text-white hover:bg-white hover:text-[#1a1a1a] active:scale-[0.98]",
  danger:
    "bg-red-600 text-white shadow-[var(--shadow-sm)] hover:bg-red-700 active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 min-w-[2.25rem] px-3.5 text-[13px] gap-1.5 rounded-[var(--radius-md)]",
  md: "h-10 min-w-[2.5rem] px-4 text-[14px] gap-2 rounded-[var(--radius-md)]",
  lg: "h-11 min-w-[2.75rem] px-5 text-[15px] gap-2 rounded-[var(--radius-lg)]",
  icon: "h-10 w-10 rounded-[var(--radius-md)] inline-flex items-center justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      type = "button",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          "relative inline-flex items-center justify-center font-medium whitespace-nowrap select-none",
          "transition-[transform,background-color,box-shadow,color,border-color,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          loading && "text-transparent",
          className
        )}
        {...props}
      >
        {children}
        {loading && (
          <span
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent opacity-90" />
          </span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
