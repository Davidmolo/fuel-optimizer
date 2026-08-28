import { twMerge } from "tailwind-merge";

export function cn(...classNames: Array<string | undefined | null | false>) {
  return twMerge(classNames.filter(Boolean).join(" "));
}
