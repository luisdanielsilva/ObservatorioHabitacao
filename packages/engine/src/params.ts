/**
 * Financial and tax parameters consumed by the engine.
 *
 * The engine never hard-codes tax figures: every calculation receives a ParameterSet,
 * which the app loads from versioned database rows (one set per year and region).
 * All rates are fractions (0.08 = 8 %), all amounts are euros.
 */

export type Region = "continente" | "acores" | "madeira";

/**
 * How the property is acquired, which decides the IMT table:
 * - hpp: habitação própria e permanente (buyer's own permanent home)
 * - secondary: other housing (investment, rental, second home)
 * - otherUrban: other urban property (shops, warehouses, urban land) — flat rate
 * - rustic: rustic property — flat rate
 */
export type PropertyUse = "hpp" | "secondary" | "otherUrban" | "rustic";

/**
 * One IMT bracket. Tax = value × rate − deduction ("parcela a abater"), using the
 * bracket the taxable value falls into. `upTo: null` marks the open-ended last bracket.
 */
export interface ImtBracket {
  upTo: number | null;
  rate: number;
  deduction: number;
}

export interface ParameterSet {
  year: number;
  region: Region;

  /** Imposto Municipal sobre as Transmissões Onerosas de Imóveis (CIMT art. 17). */
  imt: {
    hpp: ImtBracket[];
    secondary: ImtBracket[];
    otherUrbanRate: number;
    rusticRate: number;
    /**
     * Flat rate on housing bought by non-residents (CIMT art. 17 n.º 10, in force since
     * 2026-05-20). Absent for years without the rule.
     */
    nonResidentHousingRate?: number;
  };

  /** Imposto do Selo (TGIS). */
  stampDuty: {
    /** On the acquisition value (verba 1.1). */
    purchaseRate: number;
    /** On the loan amount, loans of 5 years or more (verba 17.1.3). */
    loanRate: number;
    /** On interest charged by the bank (verba 17.3.1). */
    interestRate: number;
  };

  /** Typical transaction fees, used when the user does not enter their own. */
  transactionFees: {
    /** Deed and registry without a mortgage (e.g. Casa Pronta). */
    deedAndRegistry: number;
    /** Deed and registry including the mortgage. */
    deedAndRegistryWithMortgage: number;
    /** Bank appraisal and processing fees. */
    bankFees: number;
  };

  financing: {
    /** Maximum loan-to-value recommended by Banco de Portugal. */
    maxLtv: { hpp: number; other: number };
    /** Early repayment fee as a fraction of the outstanding balance. */
    earlyRepaymentFeeRate: number;
    /** Typical bank spread over Euribor, used as the default interest rate with Euribor. */
    typicalSpread: number;
  };

  /** Standard VAT rate, applied to services such as the agency commission. */
  vatRate: number;

  /** Category F (long-term rental) income tax. */
  rentalIncome: {
    /** Autonomous ("taxa especial") rate. */
    autonomousRate: number;
    /** Reduced rates for long contracts; the highest `minYears` met applies. */
    longContractRates: { minYears: number; rate: number }[];
  };

  /** Alojamento local, taxed in category B under the simplified regime. */
  localAccommodation: {
    /** Share of gross income that is taxable. */
    coefficient: number;
    /** Share of gross income that is taxable in containment zones. */
    containmentZoneCoefficient: number;
    /** VAT rate on accommodation. */
    vatRate: number;
    /** Annual turnover below which the VAT exemption (CIVA art. 53) applies. */
    vatExemptionThreshold: number;
  };

  /**
   * IRS general rates for one taxpayer (CIRS art. 68): marginal rate per bracket of taxable
   * income, last bracket open-ended; and the solidarity surcharge (art. 68-A), each rate
   * applying to income above `over` up to the next threshold.
   */
  irs: {
    brackets: { upTo: number | null; rate: number }[];
    solidarity: { over: number; rate: number }[];
  };

  /** Capital gains (mais-valias, category G) for resident individuals. */
  capitalGains: {
    /** Share of the gain added to taxable income. */
    inclusionRate: number;
  };

  /** Cessão de posição contratual, taxed as a category G gain. */
  contractAssignment: {
    inclusionRate: number;
  };
}
