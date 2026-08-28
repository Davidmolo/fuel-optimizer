import { cn } from "@/lib/utils";
import type { BaseComponentProps } from "@/types/common";

type LabelProps = BaseComponentProps & React.LabelHTMLAttributes<HTMLLabelElement>;

export default function Label({ className, ...props }: LabelProps) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-foreground", className)} {...props} />
  );
}
