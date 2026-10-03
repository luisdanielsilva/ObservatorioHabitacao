"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { createFormatter } from "./format";

export function useFormat() {
  const locale = useLocale();
  return useMemo(() => createFormatter(locale), [locale]);
}
