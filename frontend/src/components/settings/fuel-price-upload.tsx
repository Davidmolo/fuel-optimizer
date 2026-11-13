"use client";

import { useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import FuelPriceUploadModal from "@/components/settings/fuel-price-upload-modal";
import Spinner from "@/components/common/spinner";
import type { FuelPriceImport } from "@/components/settings/types";
import { text } from "@/constants/text";
import { formatAppDate } from "@/lib/app-time";
import { apiRequest, apiUpload } from "@/lib/api";

export default function FuelPriceUpload() {
  const copy = text.fuelPrices;
  const [imports, setImports] = useState<FuelPriceImport[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    void loadImports();
  }, []);

  async function loadImports() {
    setLoading(true);
    const result = await apiRequest<{ items: FuelPriceImport[] }>("/api/v1/stations/prices/latest");
    setLoading(false);

    if (!result.success || !result.data) {
      setIsError(true);
      setMessage(result.message || copy.loadError);
      return;
    }

    setImports(result.data.items);
  }

  function closeUploadModal() {
    if (uploading) {
      return;
    }
    setUploadModalOpen(false);
    setFile(null);
    setFileInputKey((value) => value + 1);
  }

  async function handleUpload() {
    if (!file) {
      setIsError(true);
      setMessage(copy.chooseFile);
      return;
    }

    setUploading(true);
    setMessage("");
    setIsError(false);
    const result = await apiUpload<FuelPriceImport>("/api/v1/stations/prices/upload", file);
    setUploading(false);

    if (!result.success || !result.data) {
      setIsError(true);
      setMessage(result.message || copy.loadError);
      return;
    }

    setFile(null);
    setFileInputKey((value) => value + 1);
    setUploadModalOpen(false);
    setIsError(false);
    setMessage(
      `${result.data.partnerLabel} · ${copy.effective} ${formatAppDate(result.data.effectiveOn)} · ${result.data.stationCount} ${copy.stations}, ${result.data.createdCount} ${copy.added}, ${result.data.updatedCount} ${copy.updated}`,
    );
    await loadImports();
  }

  return (
    <div className="space-y-4">
      {message ? <Alert variant={isError ? "error" : "success"}>{message}</Alert> : null}
      {loading ? <Spinner label={copy.loading} /> : null}
      {!loading ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">{copy.latest}</h2>
            <Button type="button" disabled={uploading} onClick={() => setUploadModalOpen(true)}>
              {uploading ? copy.uploading : copy.upload}
            </Button>
          </div>
          {imports.length === 0 ? <Alert>{copy.empty}</Alert> : null}
          {imports.length > 0 ? (
            <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-surface">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-muted text-xs font-medium tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">{copy.partner}</th>
                    <th className="px-4 py-3 font-medium">{copy.fileLabel}</th>
                    <th className="px-4 py-3 font-medium">{copy.effective}</th>
                    <th className="px-4 py-3 font-medium">{copy.stations}</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((item) => (
                    <tr key={item.partner} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">{item.partnerLabel}</td>
                      <td className="px-4 py-3 text-foreground">{item.fileName}</td>
                      <td className="px-4 py-3 text-foreground">{formatAppDate(item.effectiveOn)}</td>
                      <td className="px-4 py-3 text-foreground">
                        {item.stationCount}
                        {item.missingLocationCount > 0
                          ? ` · ${item.missingLocationCount} ${copy.missingLocation}`
                          : ""}
                        {item.rejectedCount > 0 ? ` · ${item.rejectedCount} ${copy.skipped}` : ""}
                        {item.deactivatedCount > 0 ? ` · ${item.deactivatedCount} ${copy.deactivated}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      <FuelPriceUploadModal
        open={uploadModalOpen}
        onClose={closeUploadModal}
        file={file}
        fileInputKey={fileInputKey}
        uploading={uploading}
        onFileChange={setFile}
        onUpload={() => void handleUpload()}
        onInvalidFile={() => {
          setIsError(true);
          setMessage(copy.invalidFileType);
        }}
      />
    </div>
  );
}
