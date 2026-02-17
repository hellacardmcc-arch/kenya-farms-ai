import React, { useState, useEffect } from 'react';
import { useAreaUnit } from '../context/AreaUnitContext';
import { toDisplayValue, fromDisplayValue } from '../utils/areaUtils';

interface AreaInputProps {
  value: number | null | undefined;
  onChange: (hectares: number | null) => void;
  id?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: string;
  label?: string;
  className?: string;
  required?: boolean;
  hint?: string;
}

export const AreaInput: React.FC<AreaInputProps> = ({
  value,
  onChange,
  id = 'area-input',
  placeholder = 'e.g. 2.5',
  min = 0,
  max,
  step = '0.01',
  label = 'Area',
  className = '',
  required = false,
  hint
}) => {
  const { areaUnit, setAreaUnit } = useAreaUnit();
  const [inputStr, setInputStr] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  const displayVal = toDisplayValue(value ?? null, areaUnit);
  const resolvedDisplay = displayVal === '' ? '' : String(displayVal);

  useEffect(() => {
    if (!isFocused) {
      setInputStr(resolvedDisplay);
    }
  }, [resolvedDisplay, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputStr(v);
    if (v.trim() === '' || v.trim() === '.') {
      onChange(null);
      return;
    }
    let hectares = fromDisplayValue(v, areaUnit);
    if (hectares != null) {
      if (max != null && hectares > max) hectares = max;
      onChange(hectares);
    }
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => {
    setIsFocused(false);
    const v = inputStr.trim();
    if (v === '' || v === '.') {
      setInputStr(resolvedDisplay);
      return;
    }
    let hectares = fromDisplayValue(v, areaUnit);
    if (hectares != null && max != null && hectares > max) hectares = max;
    setInputStr(hectares != null ? String(toDisplayValue(hectares, areaUnit)) : resolvedDisplay);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value as 'ha' | 'ac';
    setAreaUnit(newUnit);
  };

  const displayValue = isFocused ? inputStr : resolvedDisplay;

  return (
    <div className={`form-row area-input-wrap ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="area-input-row">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          aria-label={label}
          className="area-size-input"
        />
        <select
          value={areaUnit}
          onChange={handleUnitChange}
          className="area-unit-select"
          aria-label="Area unit"
        >
          <option value="ha">ha</option>
          <option value="ac">ac</option>
        </select>
      </div>
      {hint && <p className="form-hint area-input-hint">{hint}</p>}
    </div>
  );
};
