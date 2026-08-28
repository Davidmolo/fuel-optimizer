import { cn } from "@/lib/utils";
import type { BaseComponentProps } from "@/types/common";

type SpinnerProps = BaseComponentProps & {
  label?: string;
};

export default function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <div className={cn("flex items-center gap-2.5 text-sm text-muted", className)} role="status" aria-live="polite">
      <span
        className="inline-block h-4 w-4 animate-spin-slow rounded-full border-2 border-primary/20 border-t-primary"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
