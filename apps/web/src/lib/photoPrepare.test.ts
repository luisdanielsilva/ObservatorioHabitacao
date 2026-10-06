import { describe, expect, it } from "vitest";
import { fitsLimits } from "./photoPrepare";

const limits = { maxCount: 30, maxBytes: 5 * 1024 * 1024 };
const MB = 1024 * 1024;

describe("fitsLimits", () => {
  it("fits within the photos and bytes left", () => {
    expect(fitsLimits([{ bytes: MB }, { bytes: MB }], { count: 28, bytes: 3 * MB }, limits)).toBe(
      true,
    );
  });

  it("refuses more photos than are left", () => {
    expect(fitsLimits([{ bytes: 1 }, { bytes: 1 }], { count: 29, bytes: 0 }, limits)).toBe(false);
  });

  it("refuses more bytes than are left", () => {
    expect(fitsLimits([{ bytes: 2 * MB + 1 }], { count: 0, bytes: 3 * MB }, limits)).toBe(false);
  });

  it("an empty selection always fits", () => {
    expect(fitsLimits([], { count: 30, bytes: 5 * MB }, limits)).toBe(true);
  });
});
