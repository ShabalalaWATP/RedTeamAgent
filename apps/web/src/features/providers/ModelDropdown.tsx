import type { CatalogueModel } from './providerCatalogue';

type ModelDropdownProps = {
  value: string;
  options: CatalogueModel[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function ModelDropdown({ value, options, disabled = false, onChange }: ModelDropdownProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || options.length === 0}
    >
      {options.length === 0 ? <option value="">No models discovered</option> : null}
      {options.map((model) => (
        <option key={model.model_identifier} value={model.model_identifier}>{model.model_identifier}</option>
      ))}
    </select>
  );
}
