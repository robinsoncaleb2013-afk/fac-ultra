import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
};

export function Button({ variant = "primary", className, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 py-3 text-base font-semibold transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
        "disabled:cursor-default disabled:opacity-40",
        variant === "primary" && "bg-brass text-brass-ink hover:bg-brass/90",
        variant === "ghost" && "border border-line bg-surface text-fg hover:border-brass",
        variant === "quiet" && "bg-transparent text-muted hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}
