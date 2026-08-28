"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown } from "@/components/common/icons";
import { useClientMounted } from "@/lib/use-client-mounted";
import { cn } from "@/lib/utils";
import type { BaseComponentProps } from "@/types/common";

export type SelectOption<T extends string | number = string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  leading?: React.ReactNode;
};

type SelectSize = "sm" | "md";
type SelectAlign = "start" | "end";

type SelectProps<T extends string | number> = BaseComponentProps & {
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  size?: SelectSize;
  fullWidth?: boolean;
  align?: SelectAlign;
  triggerClassName?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
  maxHeight: number;
  placement: "top" | "bottom";
};

const MENU_GAP = 6;
const VIEWPORT_PAD = 8;
const TYPEAHEAD_MS = 450;

function findEnabledIndex<T extends string | number>(
  options: Array<SelectOption<T>>,
  from: number,
  step: 1 | -1,
) {
  if (options.length === 0) {
    return -1;
  }

  let index = from;

  for (let i = 0; i < options.length; i += 1) {
    index = (index + step + options.length) % options.length;
    if (!options[index]?.disabled) {
      return index;
    }
  }

  return options[from]?.disabled ? -1 : from;
}

export default function Select<T extends string | number = string>({
  value,
  onChange,
  options,
  id,
  name,
  disabled = false,
  placeholder,
  size = "md",
  fullWidth = false,
  align = "start",
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SelectProps<T>) {
  const mounted = useClientMounted();
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 0;
    const menuWidth = menu?.offsetWidth ?? rect.width;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const placement: MenuPosition["placement"] =
      spaceBelow < Math.min(menuHeight || 240, 240) && spaceAbove > spaceBelow ? "top" : "bottom";
    const maxHeight = Math.max(120, placement === "bottom" ? spaceBelow - MENU_GAP : spaceAbove - MENU_GAP);
    const width = Math.min(
      Math.max(rect.width, fullWidth ? rect.width : menuWidth),
      window.innerWidth - VIEWPORT_PAD * 2,
    );
    const unclampedLeft = align === "end" ? rect.right - width : rect.left;
    const left = Math.min(Math.max(VIEWPORT_PAD, unclampedLeft), window.innerWidth - VIEWPORT_PAD - width);
    const top = placement === "bottom" ? rect.bottom + MENU_GAP : rect.top - Math.min(menuHeight, maxHeight) - MENU_GAP;

    setPosition((current) => {
      const next = {
        top: Math.max(VIEWPORT_PAD, top),
        left,
        minWidth: width,
        maxHeight,
        placement,
      };

      if (
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.minWidth === next.minWidth &&
        current.maxHeight === next.maxHeight &&
        current.placement === next.placement
      ) {
        return current;
      }

      return next;
    });
  }, [align, fullWidth]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      updatePosition();
    });

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onReposition() {
      updatePosition();
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, options, updatePosition]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const option = menuRef.current?.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  useEffect(() => {
    return () => {
      if (typeaheadTimerRef.current !== null) {
        window.clearTimeout(typeaheadTimerRef.current);
      }
    };
  }, []);

  function seedPosition() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const width = Math.min(
      Math.max(rect.width, fullWidth ? rect.width : 184),
      window.innerWidth - VIEWPORT_PAD * 2,
    );
    const unclampedLeft = align === "end" ? rect.right - width : rect.left;

    setPosition({
      top: rect.bottom + MENU_GAP,
      left: Math.min(Math.max(VIEWPORT_PAD, unclampedLeft), window.innerWidth - VIEWPORT_PAD - width),
      minWidth: width,
      maxHeight: Math.max(120, spaceBelow - MENU_GAP),
      placement: "bottom",
    });
  }

  function openMenu(index = selectedIndex >= 0 ? selectedIndex : findEnabledIndex(options, -1, 1)) {
    if (disabled || options.length === 0) {
      return;
    }

    seedPosition();
    setHighlightedIndex(Math.max(0, index));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) {
      return;
    }

    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function matchTypeahead(character: string, fromIndex: number, shouldSelect: boolean) {
    typeaheadRef.current += character.toLowerCase();

    if (typeaheadTimerRef.current !== null) {
      window.clearTimeout(typeaheadTimerRef.current);
    }

    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadRef.current = "";
      typeaheadTimerRef.current = null;
    }, TYPEAHEAD_MS);

    const query = typeaheadRef.current;
    const start = fromIndex + 1;

    for (let i = 0; i < options.length; i += 1) {
      const index = (start + i) % options.length;
      const option = options[index];
      if (option?.disabled) {
        continue;
      }

      if (option.label.toLowerCase().startsWith(query) || String(option.value).toLowerCase().startsWith(query)) {
        if (shouldSelect) {
          onChange(option.value);
        } else {
          setHighlightedIndex(index);
        }
        return;
      }
    }
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setHighlightedIndex((current) => {
        const next = findEnabledIndex(options, current, 1);
        return next >= 0 ? next : current;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setHighlightedIndex((current) => {
        const next = findEnabledIndex(options, current, -1);
        return next >= 0 ? next : current;
      });
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const first = findEnabledIndex(options, -1, 1);
      if (!open) {
        openMenu(first);
        return;
      }
      if (first >= 0) {
        setHighlightedIndex(first);
      }
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = findEnabledIndex(options, 0, -1);
      if (!open) {
        openMenu(last);
        return;
      }
      if (last >= 0) {
        setHighlightedIndex(last);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      choose(highlightedIndex);
      return;
    }

    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (!open) {
        matchTypeahead(event.key, selectedIndex, true);
        return;
      }
      matchTypeahead(event.key, highlightedIndex, false);
    }
  }

  const activeOptionId = open ? `${listboxId}-opt-${highlightedIndex}` : undefined;
  const compact = size === "sm";

  const menu =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            className={cn(
              "fixed z-[1200] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-1 shadow-[0_16px_40px_rgba(15,23,42,0.14)]",
              position && "dropdown-in",
              compact ? "min-w-[11.5rem]" : "min-w-[12.5rem]",
            )}
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              minWidth: position?.minWidth,
              maxHeight: position?.maxHeight,
              visibility: position ? "visible" : "hidden",
              transformOrigin: position?.placement === "top" ? "bottom center" : "top center",
              ["--dropdown-nudge" as string]: position?.placement === "top" ? "6px" : "-6px",
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === highlightedIndex;

              return (
                <div
                  key={String(option.value)}
                  id={`${listboxId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onMouseEnter={() => {
                    if (!option.disabled) {
                      setHighlightedIndex(index);
                    }
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg text-left transition",
                    compact ? "px-2 py-1.5" : "px-2.5 py-2",
                    option.disabled && "cursor-not-allowed opacity-40",
                    isActive && !option.disabled && "bg-primary-muted",
                    isSelected && "text-foreground",
                  )}
                >
                  {option.leading ? <span className="shrink-0">{option.leading}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-foreground", compact ? "text-xs font-medium" : "text-sm font-medium")}>
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted">{option.description}</span>
                    ) : null}
                  </span>
                  <IconCheck
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-primary transition-opacity",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("relative", fullWidth && "w-full max-w-full", className)}>
      {name ? <input type="hidden" name={name} value={String(value)} /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="none"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "inline-flex cursor-pointer items-center justify-between gap-1.5 border border-border bg-surface text-foreground outline-none transition",
          "hover:border-primary/30 hover:bg-primary-muted/35",
          "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          compact
            ? "h-7 rounded-full px-2.5 text-xs"
            : "h-10 rounded-[var(--radius-lg)] px-3 text-sm",
          fullWidth && "w-full",
          open && "border-primary/35 bg-primary-muted/45",
          triggerClassName,
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-1.5", compact && "whitespace-nowrap")}>
          {selected?.leading ? <span className="shrink-0">{selected.leading}</span> : null}
          <span className={cn("truncate", !selected && "text-muted")}>
            {selected?.label ?? placeholder ?? String(value)}
          </span>
          {selected?.description ? (
            <span className={cn("truncate text-muted", compact ? "text-[11px]" : "hidden sm:inline")}>
              {selected.description}
            </span>
          ) : null}
        </span>
        <IconChevronDown
          className={cn(
            "shrink-0 text-muted transition-transform",
            compact ? "h-3 w-3" : "h-3.5 w-3.5",
            open && "rotate-180",
          )}
        />
      </button>
      {menu}
    </div>
  );
}
