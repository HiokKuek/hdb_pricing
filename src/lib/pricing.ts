// Supabase retains the official sqm source value; the interface presents the locally familiar sqft view.
export const SQM_PER_SQFT = 0.09290304;

export function toPsf(pricePerSqm: number): number {
  return pricePerSqm * SQM_PER_SQFT;
}

export function toSqft(squareMetres: number): number {
  return squareMetres / SQM_PER_SQFT;
}
