/** 1 hectare = 2.471053814671653 acres */
export const ACRES_PER_HECTARE = 2.471053814671653;

export function hectaresToAcres(ha: number): number {
  return ha * ACRES_PER_HECTARE;
}

export function acresToHectares(ac: number): number {
  return ac / ACRES_PER_HECTARE;
}

export type AreaUnit = 'ha' | 'ac';

export function toDisplayValue(hectares: number | null | undefined, unit: AreaUnit): number | '' {
  if (hectares == null || Number.isNaN(hectares)) return '';
  return unit === 'ac' ? roundTo(hectaresToAcres(hectares), 4) : roundTo(hectares, 4);
}

export function fromDisplayValue(displayValue: number | string, unit: AreaUnit): number | null {
  const n = typeof displayValue === 'string' ? parseFloat(displayValue) : displayValue;
  if (Number.isNaN(n) || n < 0) return null;
  return unit === 'ac' ? acresToHectares(n) : n;
}

function roundTo(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
