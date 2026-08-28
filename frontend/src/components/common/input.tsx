import { cn } from "@/lib/utils";
import type { BaseComponentProps } from "@/types/common";

type InputProps = BaseComponentProps & React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[var(--radius-lg)] border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10",
        className,
      )}
      {...props}
    />
  );
}
