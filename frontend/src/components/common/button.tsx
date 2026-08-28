import { cn } from "@/lib/utils";
import type { BaseComponentProps } from "@/types/common";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md";

type ButtonProps = BaseComponentProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
  };

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary/25 disabled:bg-primary/50",
  secondary:
    "border border-border bg-surface text-foreground hover:border-primary/30 hover:bg-primary-muted/50 focus-visible:ring-primary/15",
  outline:
    "border border-border bg-surface text-foreground hover:border-primary/30 hover:bg-primary-muted/40 focus-visible:ring-primary/15",
  ghost: "text-muted hover:bg-primary-muted/60 hover:text-primary focus-visible:ring-primary/15",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export default function Button({
  className,
  type = "button",
  variant = "primary",
  size = "md",
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
