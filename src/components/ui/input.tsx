"use client";

import { cn } from "@/lib/utils";
import { WarningCircle } from "@phosphor-icons/react";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-[var(--text-primary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cn(
            "h-10 w-full rounded-[var(--radius-md)] border bg-[var(--surface-elevated)] px-3 text-[14px] text-[var(--text-primary)]",
            "placeholder:text-[var(--text-tertiary)]",
            "hover:border-[rgba(0,0,0,0.14)] dark:hover:border-[rgba(255,255,255,0.16)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : "border-[var(--border)]",
            className
          )}
          {...props}
        />
        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="field-error"
          >
            <WarningCircle size={14} weight="fill" aria-hidden />
            {error}
          </p>
        ) : hint ? (
          <p
            id={`${inputId}-hint`}
            className="text-[13px] text-[var(--text-tertiary)]"
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
