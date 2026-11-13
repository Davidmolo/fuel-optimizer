import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { HttpError } from "../../../utils/http-error";
import {
  importPartnerPriceFile,
  listLatestPartnerPriceImports,
} from "../services/partner-price-import.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export function uploadPartnerPriceFile(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error: unknown) => {
    if (error) {
      next(new HttpError("Upload an Excel price file up to 8 MB.", 400));
      return;
    }

    next();
  });
}

export async function importPartnerPriceFileController(req: Request, res: Response) {
  if (!req.file) {
    throw new HttpError("Choose an Excel price file.", 400);
  }

  const fileName = req.file.originalname.toLowerCase();
  if (!fileName.endsWith(".xls") && !fileName.endsWith(".xlsx")) {
    throw new HttpError("Upload the Excel price file (.xls or .xlsx).", 400);
  }

  const data = await importPartnerPriceFile({
    fileName: req.file.originalname,
    buffer: req.file.buffer,
  });

  return res.status(200).json({
    success: true,
    message: "Fuel prices updated",
    data,
  });
}

export async function latestPartnerPriceImportsController(_req: Request, res: Response) {
  const data = await listLatestPartnerPriceImports();

  return res.status(200).json({
    success: true,
    message: "Fuel price uploads",
    data,
  });
}
