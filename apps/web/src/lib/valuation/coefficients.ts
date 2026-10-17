import { intlLocale } from "../format";

/**
 * Coeficientes de desvalorização da moeda (CIRS art. 50): the purchase price of a property held
 * for more than 24 months is multiplied by its purchase year's coefficient before the gain is
 * worked out. Published each year for the sales of that year; the latest table is used until
 * the next one is out (to add each November, with the accountant's review).
 *
 * Source: Portaria n.º 382/2025/1, de 11 de novembro (Diário da República n.º 218, 1.ª série),
 * for sales in 2025. Only years from 1989: gains on homes bought earlier are not taxed.
 */
export const COEFFICIENTS_SOURCE = "Portaria n.º 382/2025/1";
export const COEFFICIENTS_SALES_YEAR = 2025;

const TABLE: [from: number, to: number, coefficient: number][] = [
  [1989, 1989, 3.0],
  [1990, 1990, 2.69],
  [1991, 1991, 2.38],
  [1992, 1992, 2.18],
  [1993, 1993, 2.01],
  [1994, 1994, 1.92],
  [1995, 1995, 1.84],
  [1996, 1996, 1.8],
  [1997, 1997, 1.77],
  [1998, 1998, 1.72],
  [1999, 1999, 1.7],
  [2000, 2000, 1.67],
  [2001, 2001, 1.55],
  [2002, 2002, 1.49],
  [2003, 2003, 1.45],
  [2004, 2004, 1.43],
  [2005, 2005, 1.4],
  [2006, 2006, 1.34],
  [2007, 2007, 1.32],
  [2008, 2008, 1.28],
  [2009, 2009, 1.3],
  [2010, 2010, 1.28],
  [2011, 2011, 1.24],
  [2012, 2015, 1.2],
  [2016, 2016, 1.19],
  [2017, 2017, 1.18],
  [2018, 2020, 1.17],
  [2021, 2021, 1.16],
  [2022, 2022, 1.06],
  [2023, 2023, 1.02],
  [2024, 2024, 1.0],
];

/** Homes bought before this year: their gains are not taxed (Decreto-Lei 442-A/88, art. 5). */
export const UNTAXED_BEFORE = 1989;

/**
 * The coefficient for a purchase year, sold in `saleYear`; 1 when held for less than 24 months
 * (taken as fewer than two calendar years apart) or for a year the table does not cover yet.
 */
export function monetaryCoefficient(purchaseYear: number, saleYear: number): number {
  if (saleYear - purchaseYear < 2) return 1;
  return TABLE.find(([from, to]) => purchaseYear >= from && purchaseYear <= to)?.[2] ?? 1;
}

/** "1,20" as in the Portaria: always two decimals. */
export function formatCoefficient(value: number, locale: string): string {
  return value.toLocaleString(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
