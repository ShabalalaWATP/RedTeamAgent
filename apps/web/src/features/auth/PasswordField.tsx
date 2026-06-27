import { Check, Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Field } from '../../shared/ui';

const PASSWORD_REQUIREMENTS = [
  { label: '12 to 128 characters', met: (value: string) => value.length >= 12 && value.length <= 128 },
  { label: 'lowercase letter', met: (value: string) => /[a-z]/.test(value) },
  { label: 'uppercase letter', met: (value: string) => /[A-Z]/.test(value) },
  { label: 'number', met: (value: string) => /\d/.test(value) },
  { label: 'symbol', met: (value: string) => /[^\dA-Za-z\s]/.test(value) },
  { label: 'no space at the start or end', met: (value: string) => value.trim() === value }
] as const;

export function passwordMeetsPolicy(value: string) {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.met(value));
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  showRequirements = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  showRequirements?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <div className="password-input-wrap">
        <Field label={label}>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            type={visible ? 'text' : 'password'}
            autoComplete={autoComplete}
            maxLength={128}
          />
        </Field>
        <Button
          type="button"
          className="password-toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </Button>
      </div>
      {showRequirements ? (
        <ul className="password-requirements" aria-label="Password requirements">
          {PASSWORD_REQUIREMENTS.map((requirement) => {
            const met = requirement.met(value);
            return (
              <li className={met ? 'met' : 'unmet'} key={requirement.label}>
                {met ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                <span>{met ? 'Met' : 'Needed'}: {requirement.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
