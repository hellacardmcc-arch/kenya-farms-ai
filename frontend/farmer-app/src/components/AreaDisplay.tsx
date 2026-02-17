import React from 'react';
import { useAreaUnit } from '../context/AreaUnitContext';
import { toDisplayValue } from '../utils/areaUtils';

interface AreaDisplayProps {
  hectares: number | null | undefined;
  className?: string;
}

export const AreaDisplay: React.FC<AreaDisplayProps> = ({ hectares, className = '' }) => {
  const { areaUnit } = useAreaUnit();
  const val = toDisplayValue(hectares ?? null, areaUnit);
  if (val === '') return <span className={className}>—</span>;
  const unit = areaUnit === 'ac' ? 'ac' : 'ha';
  return <span className={className}>{val} {unit}</span>;
};
