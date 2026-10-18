/**
 * "Outras perguntas a que respondemos" on the home page: each question, the tool that answers it
 * and a small example of the answer. Edit the cards here; `OtherQuestions.tsx` only draws them.
 *
 * Every amount is an illustrative example, not a calculation: none of it comes from the
 * calculators or from real tax rates. Keep each card's figures consistent with one another
 * (totals add up); `otherQuestions.test.ts` checks it.
 */

export type Tool = "evaluate" | "sell";
/** A text in both languages of the site. */
export type Text = { pt: string; en: string };

/**
 * One line of a receipt-like list: a label and an amount in euros. A negative amount is a
 * deduction (shown with "−"); a `subtotal` line ("=") is the sum of the lines above it.
 */
export type ReceiptLine = { label: Text; amount: number; subtotal?: boolean };

export type Visual =
  /** Card 1: the listing's price per m² against the area's median. */
  | {
      kind: "versus";
      listing: { label: Text; perM2: number };
      median: { label: Text; perM2: number };
      /** Shown after the difference, as in "+18 % vs. mediana". */
      versus: Text;
    }
  /** Card 2: four bars of different heights (no amounts: it only shows the comparison). */
  | { kind: "bars"; bars: { label: Text; height: number }[] }
  /**
   * Cards 3 and 5: lines, then a final line below a rule. With `totalIsSum` the final line is
   * the sum of the lines (card 3); otherwise it is a result of them (card 5's IRS).
   */
  | { kind: "receipt"; lines: ReceiptLine[]; total: ReceiptLine; totalIsSum: boolean }
  /** Card 4: the break-even price and the prices a few steps of `step` % above it. */
  | { kind: "steps"; base: number; step: number; labels: Text[] }
  /** Card 6: what is left of the sale price after the deductions. */
  | {
      kind: "split";
      price: { label: Text; amount: number };
      keep: { label: Text; amount: number };
      deductions: { label: Text; amount: number }[];
    };

export type OtherQuestion = {
  key: string;
  tool: Tool;
  /** The card's background: the site's card colour, soft green, soft sand or the dark band's. */
  tone: "card" | "mint" | "sand" | "dark";
  question: Text;
  answer: Text;
  visual: Visual;
};

export const OTHER_QUESTIONS: OtherQuestion[] = [
  {
    key: "pricey",
    tool: "evaluate",
    tone: "card",
    question: { pt: "Este anúncio está caro?", en: "Is this listing overpriced?" },
    answer: {
      pt: "Compara o preço por m² com a mediana do INE e com anúncios semelhantes que juntares.",
      en: "Compare the price per m² with the INE median and with similar listings you add.",
    },
    visual: {
      kind: "versus",
      listing: { label: { pt: "Este anúncio", en: "This listing" }, perM2: 3420 },
      median: { label: { pt: "Mediana INE da zona", en: "INE median for the area" }, perM2: 2900 },
      versus: { pt: "vs. mediana", en: "vs. median" },
    },
  },
  {
    key: "strategy",
    tool: "evaluate",
    tone: "mint",
    question: {
      pt: "Rende mais arrendar, revender ou fazer alojamento local?",
      en: "Does renting, reselling or short-term letting pay more?",
    },
    answer: {
      pt: "Os quatro negócios lado a lado: lucro, TIR, rentabilidade e cash flow.",
      en: "The four deals side by side: profit, IRR, yield and cash flow.",
    },
    visual: {
      kind: "bars",
      bars: [
        { label: { pt: "Lucro", en: "Profit" }, height: 0.92 },
        { label: { pt: "TIR", en: "IRR" }, height: 0.64 },
        { label: { pt: "Rentab.", en: "Yield" }, height: 0.78 },
        { label: { pt: "Cash flow", en: "Cash flow" }, height: 0.46 },
      ],
    },
  },
  {
    key: "costs",
    tool: "evaluate",
    tone: "card",
    question: {
      pt: "Quanto pago de IMT, Imposto do Selo e escritura?",
      en: "How much IMT, stamp duty and deed costs will I pay?",
    },
    answer: {
      pt: "Os custos de compra calculados, com crédito ou sem crédito, para habitação própria ou investimento.",
      en: "The purchase costs worked out, with or without a mortgage, for your own home or an investment.",
    },
    visual: {
      kind: "receipt",
      lines: [
        { label: { pt: "IMT", en: "IMT" }, amount: 6100 },
        { label: { pt: "Imposto do Selo", en: "Stamp duty" }, amount: 1600 },
        { label: { pt: "Escritura", en: "Deed" }, amount: 2100 },
      ],
      total: { label: { pt: "Total", en: "Total" }, amount: 9800 },
      totalIsSum: true,
    },
  },
  {
    key: "breakEven",
    tool: "evaluate",
    tone: "card",
    question: {
      pt: "A que preço posso vender sem perder dinheiro?",
      en: "What is the lowest price I can sell at without a loss?",
    },
    answer: {
      pt: "O preço mínimo sem prejuízo e quanto ganhas a cada subida de 5 %.",
      en: "The break-even price and what you gain at each 5 % step above it.",
    },
    visual: {
      kind: "steps",
      base: 214_000,
      step: 5,
      labels: [
        { pt: "Mínimo", en: "Break-even" },
        { pt: "+5 %", en: "+5 %" },
        { pt: "+10 %", en: "+10 %" },
      ],
    },
  },
  {
    key: "gainTax",
    tool: "sell",
    tone: "sand",
    question: {
      pt: "Quanto pago de IRS se vender com lucro?",
      en: "How much IRS do I pay if I sell at a profit?",
    },
    answer: {
      pt: "A mais-valia explicada linha a linha, com a correção pela inflação e os escalões.",
      en: "The capital gain explained line by line, with the inflation correction and the brackets.",
    },
    visual: {
      kind: "receipt",
      lines: [
        { label: { pt: "Mais-valia bruta", en: "Gross capital gain" }, amount: 52_000 },
        { label: { pt: "Correção pela inflação", en: "Inflation correction" }, amount: -9_400 },
        { label: { pt: "Base tributável", en: "Taxable gain" }, amount: 42_600, subtotal: true },
      ],
      total: { label: { pt: "IRS estimado", en: "Estimated IRS" }, amount: 6_400 },
      totalIsSum: false,
    },
  },
  {
    key: "proceeds",
    tool: "sell",
    tone: "dark",
    question: {
      pt: "Quanto fica para mim depois de vender?",
      en: "How much do I keep after selling?",
    },
    answer: {
      pt: "Do preço de venda tiramos a comissão, o IRS e o crédito em dívida.",
      en: "From the sale price we take the commission, IRS and the mortgage still owed.",
    },
    visual: {
      kind: "split",
      price: { label: { pt: "Preço de venda", en: "Sale price" }, amount: 260_000 },
      keep: { label: { pt: "Ficas com", en: "You keep" }, amount: 187_000 },
      deductions: [
        { label: { pt: "Crédito", en: "Mortgage" }, amount: 52_300 },
        { label: { pt: "Comissão", en: "Commission" }, amount: 14_300 },
        { label: { pt: "IRS", en: "IRS" }, amount: 6_400 },
      ],
    },
  },
];
