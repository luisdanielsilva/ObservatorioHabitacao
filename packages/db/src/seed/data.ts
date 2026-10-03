import type { Region } from "@olhovivo/engine";

/**
 * Seed data so the app works end-to-end before real data is ingested.
 *
 * Districts, regions and municipality codes are real. Market figures, AL indicators,
 * AL rules and IMI rates are SYNTHETIC PLACEHOLDERS of a plausible order of magnitude:
 * they are stored with `synthetic = true` / `verified = false` and must be labelled in
 * the UI. Replace them with INE and partner data (WBS 4.2).
 */

export interface SeedArea {
  name: string;
  code?: string;
  region?: Region;
  lat?: number;
  lng?: number;
  /** Synthetic median sale €/m² and rent €/m²/month for 2026-Q2. */
  sale: number;
  rent: number;
  children?: SeedArea[];
}

const lisboaParishes: SeedArea[] = [
  { name: "Alvalade", sale: 6_100, rent: 20.5 },
  { name: "Arroios", sale: 5_300, rent: 20 },
  { name: "Avenidas Novas", sale: 6_500, rent: 21.5 },
  { name: "Belém", sale: 5_900, rent: 19 },
  { name: "Campo de Ourique", sale: 6_200, rent: 20.5 },
  { name: "Estrela", sale: 6_700, rent: 22 },
  { name: "Parque das Nações", sale: 6_800, rent: 21 },
  { name: "Santa Maria Maior", sale: 7_000, rent: 23 },
];

const cascaisParishes: SeedArea[] = [
  { name: "Alcabideche", sale: 4_300, rent: 15.5 },
  { name: "Carcavelos e Parede", sale: 5_200, rent: 18 },
  { name: "Cascais e Estoril", sale: 6_300, rent: 20.5 },
  { name: "São Domingos de Rana", sale: 3_800, rent: 14.5 },
];

const portoParishes: SeedArea[] = [
  { name: "Bonfim", sale: 3_900, rent: 15.5 },
  { name: "Campanhã", sale: 2_900, rent: 12.5 },
  {
    name: "Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória",
    sale: 4_500,
    rent: 17.5,
  },
  { name: "Lordelo do Ouro e Massarelos", sale: 4_600, rent: 16.5 },
  { name: "Paranhos", sale: 3_300, rent: 14 },
  { name: "Ramalde", sale: 3_700, rent: 14.5 },
];

const bragaParishes: SeedArea[] = [
  { name: "Maximinos, Sé e Cividade", sale: 2_500, rent: 10 },
  { name: "Nogueiró e Tenões", sale: 2_100, rent: 9 },
  { name: "São Victor", sale: 2_400, rent: 10 },
  { name: "São Vicente", sale: 2_300, rent: 9.5 },
];

export const seedAreas: SeedArea[] = [
  { name: "Aveiro", code: "01", lat: 40.6405, lng: -8.6538, sale: 2_100, rent: 9.5 },
  { name: "Beja", code: "02", lat: 38.0151, lng: -7.8632, sale: 1_150, rent: 6 },
  {
    name: "Braga",
    code: "03",
    lat: 41.5454,
    lng: -8.4265,
    sale: 1_900,
    rent: 8.5,
    children: [
      {
        name: "Braga",
        code: "0303",
        lat: 41.5454,
        lng: -8.4265,
        sale: 2_300,
        rent: 9.5,
        children: bragaParishes,
      },
    ],
  },
  { name: "Bragança", code: "04", lat: 41.8061, lng: -6.7567, sale: 1_000, rent: 5.5 },
  { name: "Castelo Branco", code: "05", lat: 39.8222, lng: -7.4909, sale: 950, rent: 5.5 },
  { name: "Coimbra", code: "06", lat: 40.2033, lng: -8.4103, sale: 1_900, rent: 9.5 },
  { name: "Évora", code: "07", lat: 38.5714, lng: -7.9135, sale: 1_800, rent: 8.5 },
  { name: "Faro", code: "08", lat: 37.0194, lng: -7.9304, sale: 3_500, rent: 12.5 },
  { name: "Guarda", code: "09", lat: 40.5373, lng: -7.2658, sale: 850, rent: 5 },
  { name: "Leiria", code: "10", lat: 39.7436, lng: -8.8071, sale: 1_700, rent: 8 },
  {
    name: "Lisboa",
    code: "11",
    lat: 38.7223,
    lng: -9.1393,
    sale: 4_000,
    rent: 15,
    children: [
      {
        name: "Cascais",
        code: "1105",
        lat: 38.6979,
        lng: -9.4215,
        sale: 5_200,
        rent: 18,
        children: cascaisParishes,
      },
      {
        name: "Lisboa",
        code: "1106",
        lat: 38.7223,
        lng: -9.1393,
        sale: 5_600,
        rent: 20,
        children: lisboaParishes,
      },
    ],
  },
  { name: "Portalegre", code: "12", lat: 39.2967, lng: -7.4285, sale: 800, rent: 5 },
  {
    name: "Porto",
    code: "13",
    lat: 41.1579,
    lng: -8.6291,
    sale: 2_900,
    rent: 12,
    children: [
      {
        name: "Porto",
        code: "1312",
        lat: 41.1579,
        lng: -8.6291,
        sale: 3_900,
        rent: 15.5,
        children: portoParishes,
      },
    ],
  },
  { name: "Santarém", code: "14", lat: 39.2362, lng: -8.6859, sale: 1_300, rent: 7 },
  { name: "Setúbal", code: "15", lat: 38.5244, lng: -8.8882, sale: 2_600, rent: 11 },
  { name: "Viana do Castelo", code: "16", lat: 41.6932, lng: -8.8329, sale: 1_500, rent: 7 },
  { name: "Vila Real", code: "17", lat: 41.3006, lng: -7.7441, sale: 1_100, rent: 6 },
  { name: "Viseu", code: "18", lat: 40.6566, lng: -7.9125, sale: 1_200, rent: 6.5 },
  // Autonomous regions have no single CAOP code at this level.
  { name: "Açores", region: "acores", lat: 37.7412, lng: -25.6756, sale: 1_700, rent: 8.5 },
  { name: "Madeira", region: "madeira", lat: 32.6669, lng: -16.9241, sale: 3_000, rent: 11.5 },
];

/** Synthetic AL profile per municipality: peak ADR (€) and peak occupancy. */
export const seedAlProfiles: Record<string, { peakAdr: number; peakOccupancy: number }> = {
  "lisboa/lisboa": { peakAdr: 165, peakOccupancy: 0.88 },
  "lisboa/cascais": { peakAdr: 190, peakOccupancy: 0.85 },
  "porto/porto": { peakAdr: 135, peakOccupancy: 0.87 },
  "braga/braga": { peakAdr: 95, peakOccupancy: 0.75 },
};

/** Share of the peak, January to December (coastal city pattern). */
export const SEASONALITY = {
  adr: [0.62, 0.62, 0.7, 0.78, 0.82, 0.9, 1, 1, 0.9, 0.8, 0.66, 0.72],
  occupancy: [0.6, 0.65, 0.75, 0.84, 0.9, 0.95, 1, 1, 0.95, 0.88, 0.68, 0.7],
};

/** Placeholder AL rules, by area path. NOT VERIFIED against municipal regulations. */
export const seedAlRules: Record<string, "allowed" | "containment" | "suspended"> = {
  "lisboa/lisboa": "containment",
  "lisboa/lisboa/santa-maria-maior": "suspended",
  "lisboa/cascais": "allowed",
  "porto/porto": "containment",
  "porto/porto/cedofeita-santo-ildefonso-se-miragaia-sao-nicolau-e-vitoria": "suspended",
  "braga/braga": "allowed",
};

/** Placeholder IMI rates for 2025, by municipality path. NOT VERIFIED. */
export const seedImiRates: Record<string, number> = {
  "lisboa/lisboa": 0.003,
  "lisboa/cascais": 0.003,
  "porto/porto": 0.003,
  "braga/braga": 0.0035,
};
