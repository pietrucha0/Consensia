'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Opens the browser's print dialog (also "Save as PDF"). Hidden on paper. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
