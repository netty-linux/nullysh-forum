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
    "bg-[#1f1f1f] text-white shadow-[0_1px_2px_rgb(0_0_0/0.12),0_4px_12px_-4px_rgb(0_0_0/0.2)] hover:bg-[#2a2a2a] hover:shadow-[0_2px_8px_-2px_rgb(0_0_0/0.25)] hover:-translate-y-px active:translate-y-0 active:scale-[0.97] active:shadow-sm disabled:bg-neutral-300 disabled:text-white disabled:shadow-none disabled:translate-y-0 disabled:scale-100",
  secondary:
    "bg-neutral-200 text-[#1f1f1f] hover:bg-neutral-300 hover:shadow-sm hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
  ghost:
    "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-[#1f1f1f] active:scale-[0.97]",
  outline:
    "border-2 border-[#1f1f1f] bg-white text-[#1f1f1f] shadow-sm hover:bg-neutral-50 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
  inverse:
    "bg-white text-[#1f1f1f] shadow-[0_2px_12px_-2px_rgb(0_0_0/0.25)] hover:bg-neutral-100 hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
  outlineInverse:
    "border-2 border-white bg-transparent text-white hover:bg-white hover:text-[#1f1f1f] active:scale-[0.97]",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  icon: "h-11 w-11 rounded-xl inline-flex items-center justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center font-semibold whitespace-nowrap select-none",
          "transition-[transform,background-color,box-shadow,color,border-color] duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1f] focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
