'use client';

import { ErrorScreen } from '@/components/layout/error-screen';

export default function DashboardError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen {...props} />;
}
