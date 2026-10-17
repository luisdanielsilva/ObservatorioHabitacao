import { MAX_FLOOR, type Feature } from "./state";

/** Message keys of the features' labels (namespace "evaluate"). */
export const FEATURE_LABEL: Record<Feature, "extraElevator" | "extraGarage" | "extraBalcony"> = {
  elevator: "extraElevator",
  garage: "extraGarage",
  balcony: "extraBalcony",
};

/** "R/C", "3.º andar", "10.º andar ou acima". */
export function floorLabel(
  floor: number,
  t: (key: "floorGround" | "floorN" | "floorMax", values?: { n: number }) => string,
): string {
  if (floor === 0) return t("floorGround");
  return floor >= MAX_FLOOR ? t("floorMax", { n: MAX_FLOOR }) : t("floorN", { n: floor });
}
