import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  asLink: true;
  disabled?: boolean;
  to: string;
  variant?: 'primary' | 'secondary' | 'danger';
};

type ButtonLikeProps = ButtonProps | ButtonLinkProps;

export function Button({ variant = 'secondary', className = '', ...props }: ButtonLikeProps) {
  if ('asLink' in props) {
    const { asLink: _asLink, disabled, to, ...linkProps } = props;
    const disabledClass = disabled ? 'disabled' : '';
    return (
      <Link
        aria-disabled={disabled || undefined}
        className={`button ${variant} ${disabledClass} ${className}`}
        to={disabled ? '#' : to}
        {...linkProps}
      />
    );
  }
  return <button className={`button ${variant} ${className}`} {...props} />;
}

export function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Status({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state" role="status">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="error-state" role="alert">
      {message}
    </div>
  );
}
