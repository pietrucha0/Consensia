import { Vote } from 'lucide-react';

import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Vote className="size-4" aria-hidden />
      </span>
      Consensia
    </span>
  );
}
