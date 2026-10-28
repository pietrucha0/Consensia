import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shared body of the 404 / error screens: icon, heading, one line, actions. */
export function StatusMessage({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      {children && <div className="flex flex-wrap justify-center gap-2 pt-2">{children}</div>}
    </div>
  );
}
