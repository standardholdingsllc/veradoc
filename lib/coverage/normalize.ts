export function normalizeCoverageText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCoverageKey(value: string): string {
  return normalizeCoverageText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE");
}

export function findCoveredProvince(
  province: string,
  coveredProvinces: string[],
): string | null {
  const target = normalizeCoverageKey(province);
  if (!target) return null;

  return (
    coveredProvinces.find(
      (covered) => normalizeCoverageKey(covered) === target,
    ) ?? null
  );
}
