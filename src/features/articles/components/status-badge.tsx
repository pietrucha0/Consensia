import { Badge } from '@/components/ui/badge';
import type { ArticleStatus } from '@/generated/prisma/enums';

const VARIANTS = {
  PUBLISHED: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'muted',
} as const satisfies Record<ArticleStatus, 'success' | 'warning' | 'muted'>;

export function StatusBadge({ status, label }: { status: ArticleStatus; label: string }) {
  return <Badge variant={VARIANTS[status]}>{label}</Badge>;
}
