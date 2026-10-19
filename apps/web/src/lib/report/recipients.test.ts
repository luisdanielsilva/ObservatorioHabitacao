import { describe, expect, it } from "vitest";
import { reportRecipients } from "./recipients";

describe("reportRecipients", () => {
  it("always sends to the account, plus one optional address", () => {
    expect(reportRecipients("ana@example.pt", "")).toEqual(["ana@example.pt"]);
    expect(reportRecipients("ana@example.pt", "  ")).toEqual(["ana@example.pt"]);
    expect(reportRecipients("ana@example.pt", " banco@example.pt ")).toEqual([
      "ana@example.pt",
      "banco@example.pt",
    ]);
  });

  it("refuses an invalid address, and does not repeat the account's", () => {
    expect(reportRecipients("ana@example.pt", "banco")).toBeUndefined();
    expect(reportRecipients("ana@example.pt", "a@b.pt, c@d.pt")).toBeUndefined();
    expect(reportRecipients("ana@example.pt", "ANA@example.pt")).toEqual(["ana@example.pt"]);
  });
});
