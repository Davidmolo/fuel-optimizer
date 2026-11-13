"use client";

import { useRef, useState } from "react";
import type { FuelPriceUploadZoneProps } from "@/components/settings/types";
import { text } from "@/constants/text";
import { cn } from "@/lib/utils";

const FILE_ACCEPT =
  ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isExcelFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".xls") || name.endsWith(".xlsx");
}

export default function FuelPriceUploadZone({
  file,
  fileInputKey,
  disabled = false,
  onFileChange,
  onInvalidFile,
}: FuelPriceUploadZoneProps) {
  const copy = text.fuelPrices;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function applyFile(next: File | null) {
    if (!next) {
      onFileChange(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    if (!isExcelFile(next)) {
      onInvalidFile();
      return;
    }

    onFileChange(next);
  }

  function onDragEnter(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      setDragActive(true);
    }
  }

  function onDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      setDragActive(true);
    }
  }

  function onDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setDragActive(false);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (disabled) {
      return;
    }

    const dropped = event.dataTransfer.files.item(0);
    applyFile(dropped);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id="fuel-price-file"
        key={fileInputKey}
        type="file"
        accept={FILE_ACCEPT}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => applyFile(event.target.files?.[0] ?? null)}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-labelledby="fuel-price-file-label"
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!disabled && !file) {
            inputRef.current?.click();
          }
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "rounded-[var(--radius-xl)] border-2 border-dashed px-4 py-8 text-center transition-colors",
          disabled && "cursor-not-allowed opacity-60",
          !disabled && !file && "cursor-pointer hover:border-primary/40 hover:bg-surface-muted/60",
          dragActive && !disabled
            ? "border-primary bg-primary/5"
            : file
              ? "border-border bg-surface-muted/40"
              : "border-border bg-surface-muted/30",
        )}
      >
        {file ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</p>
            {!disabled ? (
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  applyFile(null);
                }}
              >
                {copy.removeFile}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            <p id="fuel-price-file-label" className="text-sm text-foreground">
              {dragActive ? (
                copy.dropZoneActive
              ) : (
                <>
                  {copy.dropZoneHint}{" "}
                  <span
                    role="presentation"
                    className="font-medium text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!disabled) {
                        inputRef.current?.click();
                      }
                    }}
                  >
                    {copy.dropZoneBrowse}
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-muted">{copy.dropZoneFormats}</p>
          </div>
        )}
      </div>
    </div>
  );
}
