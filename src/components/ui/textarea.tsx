import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const areaId = id || props.name;
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={areaId}
            className="text-sm font-medium text-neutral-900"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(
            "min-h-[120px] w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm text-neutral-950",
            "placeholder:text-neutral-400",
            "transition-colors duration-200",
            "focus:border-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950/10",
            error ? "border-red-400" : "border-neutral-200",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : hint ? (
          <p className="text-xs text-neutral-500">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
