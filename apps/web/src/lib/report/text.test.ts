import { describe, expect, it } from "vitest";
import { labelLines, pdfSafe, reportFilename } from "./text";

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
    expect(pdfSafe("Lisboa › Cascais")).toBe("Lisboa > Cascais");
  });
});

describe("reportFilename", () => {
  it("builds a safe file name from the scenario name", () => {
    expect(reportFilename("Apartamento T2 em São Vicente")).toBe(
      "observatorio-habitacao-apartamento-t2-em-sao-vicente.pdf",
    );
    expect(reportFilename("«»")).toBe("observatorio-habitacao-cenario.pdf");
    expect(reportFilename('a"b\nc')).toBe("observatorio-habitacao-a-b-c.pdf");
  });
});

describe("labelLines", () => {
  it("keeps a label that fits on one line", () => {
    expect(labelLines("Venda", 38, 6.5)).toEqual(["Venda"]);
  });
  it("splits a long label at the space nearest the middle", () => {
    expect(labelLines("IRS mais-valia", 38, 6.5)).toEqual(["IRS", "mais-valia"]);
    expect(labelLines("Lucro ao preço indicado", 38, 6.5)).toEqual(["Lucro ao preço", "indicado"]);
  });
  it("leaves a single long word alone", () => {
    expect(labelLines("Empréstimo", 20, 6.5)).toEqual(["Empréstimo"]);
  });
});
