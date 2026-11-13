"use client";

import Button from "@/components/common/button";
import Modal from "@/components/common/modal";
import FuelPriceUploadZone from "@/components/settings/fuel-price-upload-zone";
import type { FuelPriceUploadModalProps } from "@/components/settings/types";
import { text } from "@/constants/text";

export default function FuelPriceUploadModal({
  open,
  onClose,
  file,
  fileInputKey,
  uploading,
  onFileChange,
  onUpload,
  onInvalidFile,
}: FuelPriceUploadModalProps) {
  const copy = text.fuelPrices;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!uploading) {
          onClose();
        }
      }}
      title={copy.modalTitle}
      subtitle={copy.modalSubtitle}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={uploading} onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="button" disabled={uploading || !file} onClick={onUpload}>
            {uploading ? copy.uploading : copy.upload}
          </Button>
        </div>
      }
    >
      <div className="px-4 py-4">
        <FuelPriceUploadZone
          file={file}
          fileInputKey={fileInputKey}
          disabled={uploading}
          onFileChange={onFileChange}
          onInvalidFile={onInvalidFile}
        />
      </div>
    </Modal>
  );
}
