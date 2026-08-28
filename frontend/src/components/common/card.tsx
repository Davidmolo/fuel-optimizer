import { cn } from "@/lib/utils";
import type { BaseComponentProps } from "@/types/common";

type CardProps = BaseComponentProps &
  React.HTMLAttributes<HTMLDivElement> & {
    compact?: boolean;
  };

export default function Card({ className, compact = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "card-surface w-full rounded-[var(--radius-xl)]",
        compact ? "p-5" : "p-6",
        className,
      )}
      {...props}
    />
  );
}
