import { cn } from "@/lib/utils";
import type { BaseComponentProps } from "@/types/common";

type AlertVariant = "info" | "error" | "success";

type AlertProps = BaseComponentProps & {
  variant?: AlertVariant;
  children: React.ReactNode;
};

const variantClasses: Record<AlertVariant, string> = {
  info: "border-primary/15 bg-primary-muted text-primary",
  error: "border-danger/15 bg-danger-muted text-danger",
  success: "border-success/15 bg-success-muted text-success",
};

export default function Alert({ className, variant = "info", children }: AlertProps) {
  return (
    <p
      className={cn(
        "rounded-[var(--radius-lg)] border px-3.5 py-2.5 text-sm leading-relaxed",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </p>
  );
}
