import { describe, expect, it } from "vitest";
import { parseDraft } from "./draft";
import { initialState } from "./state";

describe("parseDraft", () => {
  it("restores the state, the saved scenario and the name", () => {
    const state = initialState({ askingPrice: 250_000, deals: ["flip"] });
    const draft = parseDraft(JSON.stringify({ state, savedId: 12, name: "T2 Arroios" }));
    expect(draft?.state.askingPrice).toBe(250_000);
    expect(draft?.state.deals).toEqual(["flip"]);
    expect(draft?.savedId).toBe(12);
    expect(draft?.name).toBe("T2 Arroios");
  });

  it("reads drafts kept before the saved scenario was stored with them", () => {
    const draft = parseDraft(JSON.stringify({ state: initialState(), name: "x" }));
    expect(draft?.savedId).toBeNull();
  });

  it("rejects broken or foreign data", () => {
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ hello: 1 }))).toBeNull();
    expect(parseDraft(JSON.stringify({ state: {}, savedId: -3 }))?.savedId).toBeNull();
  });
});
