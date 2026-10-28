'use client';

import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';

type FormFieldProps = {
  id: string;
  label: string;
  /** Already translated. */
  error?: string | undefined;
  hint?: string | undefined;
  /** Rendered next to the label (e.g. "Forgot password?"). */
  aside?: ReactNode;
  children: (a11y: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
};

export function FormField({ id, label, error, hint, aside, children }: FormFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
