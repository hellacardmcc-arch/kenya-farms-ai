import React from 'react';
import { useAreaUnit } from '../context/AreaUnitContext';
import { toDisplayValue, fromDisplayValue } from '../utils/areaUtils';

interface AreaInputProps {
  value: number | null | undefined;
  onChange: (hectares: number | null) => void;
  id?: string;
  placeholder?: string;
  min?: number;
  step?: string;
  label?: string;
  className?: string;
  required?: boolean;
}

export const AreaInput: React.FC<AreaInputProps> = ({
  value,
  onChange,
  id = 'area-input',
  placeholder,
  min = 0,
  step = '0.01',
  label = 'Area',
  className = '',
  required = false
}) => {
  const { areaUnit, setAreaUnit } = useAreaUnit();
  const displayVal = toDisplayValue(value ?? null, areaUnit);
  const inputVal = displayVal === '' ? '' : String(displayVal);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '') {
      onChange(null);
      return;
    }
    const hectares = fromDisplayValue(v, areaUnit);
    onChange(hectares);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAreaUnit(e.target.value as 'ha' | 'ac');
  };

  return (
    <div className={`admin-form-field area-input-wrap ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="area-input-row">
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          value={inputVal}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          aria-label={label}
        />
        <select
          value={areaUnit}
          onChange={handleUnitChange}
          className="area-unit-select"
          aria-label="Area unit"
        >
          <option value="ha">hectares (ha)</option>
          <option value="ac">acres (ac)</option>
        </select>
      </div>
    </div>
  );
};
