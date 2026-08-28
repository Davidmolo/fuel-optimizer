import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
};

export function IconLayoutDashboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function IconMail({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function IconLogOut({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconPanelLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconTruck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h3l3 3v2h-6z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

export function IconRoute({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19c4-8 4-8 8-12" />
    </svg>
  );
}

export function IconStation({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M5 20V8l7-4 7 4v12" />
      <path d="M9 20v-6h6v6" />
      <path d="M9 10h6" />
      <path d="M12 4v3" />
    </svg>
  );
}

export function IconFuel({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M6 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" />
      <path d="M6 12h8" />
      <path d="M14 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 4 0V9l-3-3" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" className={cn("h-4 w-4", className)}>
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCircleDollar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M15 9.5c0-1-1-1.5-3-1.5s-3 .5-3 1.5 1 1.5 3 1.5 3 .5 3 1.5-1 1.5-3 1.5-3-.5-3-1.5" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-5 w-5", className)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M21 12a9 9 0 1 1-2.3-6" />
      <path d="M21 4v6h-6" />
    </svg>
  );
}

export function IconX({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconFilter({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={cn("h-4 w-4", className)}>
      <path d="M4 5h16l-6.5 8.5V19l-3 1.5v-7L4 5z" strokeLinejoin="round" />
    </svg>
  );
}
