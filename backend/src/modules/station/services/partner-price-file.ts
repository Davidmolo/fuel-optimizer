import * as XLSX from "xlsx";
import { isoDateFromParts } from "../../../utils/app-time";
import { HttpError } from "../../../utils/http-error";
import type { PartnerPricePartner } from "../models/fuel-station.model";

export type PartnerPriceRow = {
  externalStationId: string;
  merchantName: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  opisId?: string;
  retailPricePerUnit: number;
  discountedPricePerUnit: number;
  cardStationCode?: string;
};

export type ParsedPartnerPriceFile = {
  partner: PartnerPricePartner;
  effectiveOn: string;
  rows: PartnerPriceRow[];
  rejectedCount: number;
};

export type StationCoordinateCandidate = {
  name?: string;
  merchantName?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
};

const PARTNER_LABELS: Record<PartnerPricePartner, string> = {
  loves: "Love's",
  pilot: "Pilot",
  ut322: "UT322",
};

const NAME_STOP_WORDS = new Set([
  "fuel",
  "stop",
  "travel",
  "center",
  "centre",
  "plaza",
  "store",
  "stores",
  "truck",
  "the",
  "inc",
  "llc",
]);

export function partnerPriceLabel(partner: PartnerPricePartner) {
  return PARTNER_LABELS[partner];
}

export function parsePartnerPriceFile(fileName: string, buffer: Buffer): ParsedPartnerPriceFile {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new HttpError("Upload the Excel price file (.xls or .xlsx).", 400);
  }

  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: "",
    }) as unknown[][],
  }));

  const loves = sheets.find((sheet) => findHeader(sheet.rows, ["loves store no.", "best discounted price"]) >= 0);
  if (loves) {
    return parseLoves(loves.rows);
  }

  const ut322 = sheets.find((sheet) => findHeader(sheet.rows, ["xts_id", "ppg"]) >= 0);
  if (ut322) {
    return parseUt322(fileName, ut322.rows);
  }

  const pilot = sheets.find((sheet) => findHeader(sheet.rows, ["site", "your price", "retail price"]) >= 0);
  if (pilot) {
    return parsePilot(pilot.rows);
  }

  throw new HttpError("This file is not a Love's, Pilot, or UT322 price file.", 400);
}

export function matchStationCoordinates(
  row: Pick<PartnerPriceRow, "merchantName" | "name" | "city" | "state" | "latitude" | "longitude">,
  candidates: StationCoordinateCandidate[],
) {
  if (isCoordinate(row.latitude) && isCoordinate(row.longitude)) {
    return { latitude: row.latitude, longitude: row.longitude };
  }

  const key = locationKey(row.state, row.city);
  const pool = candidates.filter(
    (candidate) =>
      locationKey(candidate.state, candidate.city) === key &&
      isCoordinate(candidate.latitude) &&
      isCoordinate(candidate.longitude),
  );

  if (pool.length === 0) {
    return undefined;
  }

  if (row.merchantName === "Pilot") {
    const pilots = pool.filter((candidate) => /pilot/i.test(`${candidate.merchantName ?? ""} ${candidate.name ?? ""}`));
    if (pilots.length !== 1 || !isCoordinate(pilots[0].latitude) || !isCoordinate(pilots[0].longitude)) {
      return undefined;
    }

    return { latitude: pilots[0].latitude, longitude: pilots[0].longitude };
  }

  const wanted = nameTokens(`${row.name} ${row.merchantName}`);
  let best: { score: number; latitude: number; longitude: number } | undefined;

  for (const candidate of pool) {
    const have = nameTokens(`${candidate.name ?? ""} ${candidate.merchantName ?? ""}`);
    if (wanted.length === 0 || have.length === 0) {
      continue;
    }

    const overlap = wanted.filter((token) => have.includes(token)).length;
    const score = overlap / wanted.length;
    if (
      isCoordinate(candidate.latitude) &&
      isCoordinate(candidate.longitude) &&
      (!best || score > best.score)
    ) {
      best = { score, latitude: candidate.latitude, longitude: candidate.longitude };
    }
  }

  if (!best || best.score < 0.5) {
    return undefined;
  }

  return { latitude: best.latitude, longitude: best.longitude };
}

function parseLoves(rows: unknown[][]): ParsedPartnerPriceFile {
  const headerIndex = findHeader(rows, ["loves store no.", "best discounted price"]);
  const header = rows[headerIndex] ?? [];
  const storeColumn = column(header, "loves store no.");
  const cityColumn = column(header, "city");
  const stateColumn = column(header, "state");
  const cardColumn = column(header, "billing card station code");
  const rackColumn = column(header, "opis rack id");
  const retailColumn = column(header, "retail price");
  const bestColumn = column(header, "best discounted price");
  const dateColumn = column(header, "effective date");
  const latColumn = column(header, "latitude");
  const lngColumn = column(header, "longitude");
  const parsed = collectRows(rows, headerIndex + 1, (row) => {
    const externalStationId = cellId(row[storeColumn]);
    const city = cellText(row[cityColumn]);
    const state = cellState(row[stateColumn]);
    const retailPricePerUnit = cellPrice(row[retailColumn]);
    const discountedPricePerUnit = cellPrice(row[bestColumn]);
    const effectiveOn = cellDate(row[dateColumn]);

    if (
      !externalStationId ||
      !city ||
      !state ||
      !effectiveOn ||
      retailPricePerUnit === undefined ||
      discountedPricePerUnit === undefined
    ) {
      return { rejected: true };
    }

    return {
      rejected: false,
      effectiveOn,
      row: {
        externalStationId,
        merchantName: "Love's",
        name: `Love's ${externalStationId}`,
        city,
        state,
        latitude: cellCoordinate(row[latColumn]),
        longitude: cellCoordinate(row[lngColumn]),
        opisId: cellId(row[rackColumn]) || undefined,
        retailPricePerUnit,
        discountedPricePerUnit,
        cardStationCode: cellId(row[cardColumn]) || undefined,
      },
    };
  });

  return finish("loves", parsed);
}

function parseUt322(fileName: string, rows: unknown[][]): ParsedPartnerPriceFile {
  const effectiveOn = effectiveDateFromFileName(fileName);
  if (!effectiveOn) {
    throw new HttpError("The UT322 file name must end with the price date, like 261111.xls.", 400);
  }

  const headerIndex = findHeader(rows, ["xts_id", "ppg"]);
  const header = rows[headerIndex] ?? [];
  const idColumn = column(header, "xts_id");
  const nameColumn = column(header, "ts_name");
  const addressColumn = column(header, "ts_addr1");
  const cityColumn = column(header, "ts_city");
  const stateColumn = column(header, "ts_state");
  const retailColumn = column(header, "retail");
  const priceColumn = column(header, "ppg");
  const parsed = collectRows(rows, headerIndex + 1, (row) => {
    const externalStationId = cellId(row[idColumn]);
    const name = cellText(row[nameColumn]);
    const city = cellText(row[cityColumn]);
    const state = cellState(row[stateColumn]);
    const retailPricePerUnit = cellPrice(row[retailColumn]);
    const discountedPricePerUnit = cellPrice(row[priceColumn]);

    if (!externalStationId || !name || !city || !state || retailPricePerUnit === undefined || discountedPricePerUnit === undefined) {
      return { rejected: true };
    }

    return {
      rejected: false,
      effectiveOn,
      row: {
        externalStationId,
        merchantName: name,
        name,
        address: cellText(row[addressColumn]) || undefined,
        city,
        state,
        retailPricePerUnit,
        discountedPricePerUnit,
      },
    };
  });

  return finish("ut322", { ...parsed, dates: new Set([effectiveOn]) });
}

function parsePilot(rows: unknown[][]): ParsedPartnerPriceFile {
  const effectiveOn = pilotEffectiveDate(rows);
  if (!effectiveOn) {
    throw new HttpError("The Pilot file is missing an effective date.", 400);
  }

  const headerIndex = findHeader(rows, ["site", "your price", "retail price"]);
  const header = rows[headerIndex] ?? [];
  const siteColumn = column(header, "site");
  const cityColumn = column(header, "city");
  const stateColumn = column(header, "st");
  const productColumn = column(header, "prod");
  const rackColumn = column(header, "rack id");
  const retailColumn = column(header, "retail price");
  const priceColumn = column(header, "your price");
  const parsed = collectRows(rows, headerIndex + 1, (row) => {
    const externalStationId = cellId(row[siteColumn]);
    const city = cellText(row[cityColumn]);
    const state = cellState(row[stateColumn]);
    const retailPricePerUnit = cellPrice(row[retailColumn]);
    const discountedPricePerUnit = cellPrice(row[priceColumn]);

    if (
      !externalStationId ||
      !city ||
      !state ||
      cellText(row[productColumn]).toUpperCase() !== "DSL" ||
      retailPricePerUnit === undefined ||
      discountedPricePerUnit === undefined
    ) {
      return { rejected: true };
    }

    return {
      rejected: false,
      effectiveOn,
      row: {
        externalStationId,
        merchantName: "Pilot",
        name: `Pilot ${city}`,
        city,
        state,
        opisId: cellId(row[rackColumn]) || undefined,
        retailPricePerUnit,
        discountedPricePerUnit,
      },
    };
  });

  return finish("pilot", { ...parsed, dates: new Set([effectiveOn]) });
}

function finish(
  partner: PartnerPricePartner,
  parsed: { rows: PartnerPriceRow[]; rejectedCount: number; dates: Set<string> },
): ParsedPartnerPriceFile {
  if (parsed.rows.length === 0) {
    throw new HttpError("The price file has no stations.", 400);
  }

  if (parsed.dates.size !== 1) {
    throw new HttpError("The price file must contain one effective date.", 400);
  }

  return {
    partner,
    effectiveOn: [...parsed.dates][0],
    rows: parsed.rows,
    rejectedCount: parsed.rejectedCount,
  };
}

function collectRows(
  rows: unknown[][],
  start: number,
  mapRow: (row: unknown[]) => { rejected: true } | { rejected: false; effectiveOn?: string; row: PartnerPriceRow },
) {
  const accepted: PartnerPriceRow[] = [];
  const dates = new Set<string>();
  let rejectedCount = 0;

  for (const row of rows.slice(start)) {
    if (!Array.isArray(row) || row.every((cell) => cellText(cell) === "")) {
      continue;
    }

    const mapped = mapRow(row);
    if (mapped.rejected) {
      rejectedCount += 1;
      continue;
    }

    if (mapped.effectiveOn) {
      dates.add(mapped.effectiveOn);
    }

    accepted.push(mapped.row);
  }

  return { rows: accepted, rejectedCount, dates };
}

function findHeader(rows: unknown[][], required: string[]) {
  const limit = Math.min(rows.length, 20);

  for (let index = 0; index < limit; index += 1) {
    const header = (rows[index] ?? []).map(headerText);
    if (required.every((name) => header.includes(name))) {
      return index;
    }
  }

  return -1;
}

function column(header: unknown[], name: string) {
  const index = header.findIndex((cell) => headerText(cell) === name);
  if (index < 0) {
    throw new HttpError("The price file is missing a required column.", 400);
  }

  return index;
}

function pilotEffectiveDate(rows: unknown[][]) {
  const limit = Math.min(rows.length, 8);

  for (let index = 0; index < limit; index += 1) {
    for (const cell of rows[index] ?? []) {
      const match = /effective date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(cellText(cell));
      if (match) {
        return cellDate(match[1]);
      }
    }
  }

  return undefined;
}

function effectiveDateFromFileName(fileName: string) {
  const match = /(\d{2})(\d{2})(\d{2})(?: \(\d+\))?\.(?:xls|xlsx)$/i.exec(fileName.trim());
  if (!match) {
    return undefined;
  }

  return isoDateFromParts(2000 + Number(match[1]), Number(match[2]), Number(match[3]));
}

function headerText(value: unknown) {
  return cellText(value).toLowerCase().replace(/\s+/g, " ");
}

function cellText(value: unknown) {
  if (value instanceof Date) {
    return cellDate(value) ?? "";
  }

  return String(value ?? "").trim();
}

function cellId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  const text = cellText(value);
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

function cellPrice(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(cellText(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 30) {
    return undefined;
  }

  return Math.round(parsed * 10000) / 10000;
}

function cellCoordinate(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(cellText(value));
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function cellState(value: unknown) {
  const text = cellText(value).toUpperCase();
  return /^[A-Z]{2}$/.test(text) ? text : undefined;
}

function cellDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDateFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && value > 20000 && value < 80000) {
    const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
    return isoDateFromParts(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }

  const text = cellText(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    return isoDateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (us) {
    return isoDateFromParts(Number(us[3]), Number(us[1]), Number(us[2]));
  }

  return undefined;
}

function locationKey(state?: string, city?: string) {
  return `${(state ?? "").trim().toUpperCase()}|${(city ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()}`;
}

function nameTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !NAME_STOP_WORDS.has(token));
}

function isCoordinate(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
