export type FuelPriceImport = {
  partner: "loves" | "pilot" | "ut322";
  partnerLabel: string;
  fileName: string;
  effectiveOn: string;
  stationCount: number;
  createdCount: number;
  updatedCount: number;
  deactivatedCount: number;
  rejectedCount: number;
  missingLocationCount: number;
  uploadedAt: string;
};

export type FuelPriceUploadModalProps = {
  open: boolean;
  onClose: () => void;
  file: File | null;
  fileInputKey: number;
  uploading: boolean;
  onFileChange: (file: File | null) => void;
  onUpload: () => void;
  onInvalidFile: () => void;
};

export type FuelPriceUploadZoneProps = {
  file: File | null;
  fileInputKey: number;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  onInvalidFile: () => void;
};
