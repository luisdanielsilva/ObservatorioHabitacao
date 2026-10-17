import type { ParameterSet } from "@observatorio-habitacao/engine";
import { describe, expect, it } from "vitest";
import { params2025 } from "../../../../../packages/engine/src/__fixtures__/params2025";
import { englobamentoThreshold } from "./tax";

describe("englobamentoThreshold", () => {
  it("is the top of the last bracket taxed below the flat rate on rents", () => {
    // 2025: 24.4 % up to 22 306 €, then 31.4 %; flat rate 25 %.
    expect(englobamentoThreshold(params2025)).toEqual({
      income: 22_306,
      marginalRate: 0.244,
      flatRate: 0.25,
    });
  });

  it("is null when every bracket is above the flat rate", () => {
    const params: ParameterSet = {
      ...params2025,
      rentalIncome: { ...params2025.rentalIncome, autonomousRate: 0.1 },
    };
    expect(englobamentoThreshold(params)).toBeNull();
  });
});
