import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parsePartnerPriceFile } from "./partner-price-file";

const samples = path.resolve(process.cwd(), "../Docs/pricing files");

function sample(name: string) {
  return readFileSync(path.join(samples, name));
}

describe("parsePartnerPriceFile", () => {
  it("reads Love's diesel prices from the daily workbook", () => {
    const parsed = parsePartnerPriceFile("Blue Stallion LLC261111.xlsx", sample("Blue Stallion LLC261111.xlsx"));
    const loxley = parsed.rows.find((row) => row.externalStationId === "206");

    assert.equal(parsed.partner, "loves");
    assert.equal(parsed.effectiveOn, "2026-11-11");
    assert.equal(parsed.rows.length, 608);
    assert.equal(parsed.rejectedCount, 0);
    assert.equal(loxley?.discountedPricePerUnit, 5.2013);
    assert.equal(loxley?.retailPricePerUnit, 5.799);
    assert.equal(loxley?.latitude, 30.6544);
  });

  it("reads the UT322 network price and the date from the file name", () => {
    const parsed = parsePartnerPriceFile("UT322-083020261111.xls", sample("UT322-083020261111.xls"));
    const dodgeCity = parsed.rows.find((row) => row.externalStationId === "512423");

    assert.equal(parsed.partner, "ut322");
    assert.equal(parsed.effectiveOn, "2026-11-11");
    assert.equal(parsed.rows.length, 553);
    assert.equal(parsed.rejectedCount, 9);
    assert.equal(dodgeCity?.name, "Dodge City Shell Fuel Stop");
    assert.equal(dodgeCity?.discountedPricePerUnit, 5.113);
    assert.equal(dodgeCity?.retailPricePerUnit, 5.859);
  });

  it("reads Pilot Your Price for diesel sites", () => {
    const parsed = parsePartnerPriceFile("cp383173 (1).xls", sample("cp383173 (1).xls"));
    const millHall = parsed.rows.find((row) => row.city === "Mill Hall" && row.state === "PA");

    assert.equal(parsed.partner, "pilot");
    assert.equal(parsed.effectiveOn, "2026-11-07");
    assert.equal(parsed.rows.length, 683);
    assert.equal(millHall?.externalStationId, "001");
    assert.equal(millHall?.discountedPricePerUnit, 5.9226);
    assert.equal(millHall?.retailPricePerUnit, 6.699);
  });
});
