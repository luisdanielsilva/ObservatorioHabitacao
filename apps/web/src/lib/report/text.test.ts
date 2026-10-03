import { describe, expect, it } from "vitest";
import { pdfSafe, reportFilename } from "./text";

describe("pdfSafe", () => {
  it("keeps Portuguese text, the euro sign and m²", () => {
    expect(pdfSafe("Avaliação: 250 000 € · 80 m² · «ação»")).toBe(
      "Avaliação: 250 000 € · 80 m² · «ação»",
    );
  });

  it("maps characters outside the built-in fonts", () => {
    const formatted = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
      -1234.5,
    );
    expect(pdfSafe(formatted)).not.toMatch(/[^\u0000-ÿ€]/);
    expect(pdfSafe("a b – c ≈ d → e")).toBe("a b - c ~ d -> e");
    expect(pdfSafe("✓ ok")).toBe(" ok");
  });
});

describe("reportFilename", () => {
  it("builds a safe file name from the scenario name", () => {
    expect(reportFilename("Apartamento T2 em São Vicente")).toBe(
      "olhovivo-apartamento-t2-em-sao-vicente.pdf",
    );
    expect(reportFilename("«»")).toBe("olhovivo-cenario.pdf");
    expect(reportFilename('a"b\nc')).toBe("olhovivo-a-b-c.pdf");
  });
});
