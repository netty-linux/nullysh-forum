import { cn } from "@/lib/utils";
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
            className="text-sm font-semibold text-neutral-900"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-12 w-full rounded-xl border-2 bg-white px-4 text-sm text-[#1f1f1f]",
            "placeholder:text-neutral-400",
            "hover:border-neutral-400",
            "focus:border-[#1f1f1f] focus:outline-none focus:ring-4 focus:ring-[#1f1f1f]/8",
            error ? "border-red-500" : "border-neutral-200",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : hint ? (
          <p className="text-xs text-neutral-500">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
