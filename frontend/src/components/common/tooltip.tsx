"use client";

import { cn } from "@/lib/utils";

type TooltipAlign = "start" | "end";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  align?: TooltipAlign;
  className?: string;
};

export default function Tooltip({
  content,
  children,
  id,
  align = "end",
  className,
}: TooltipProps) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute top-full z-50 mt-2 w-[16.5rem] rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs leading-relaxed text-muted opacity-0 shadow-[0_12px_32px_rgba(15,23,42,0.12)] transition-opacity group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100",
          align === "end" ? "right-0" : "left-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
