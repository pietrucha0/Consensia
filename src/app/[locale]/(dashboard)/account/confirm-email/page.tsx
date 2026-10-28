import { CircleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmEmailChange } from '@/features/account/components/confirm-email-change';
import { Link } from '@/i18n/navigation';
import { hashToken } from '@/lib/auth/tokens';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account.email');
  return { title: t('confirmTitle') };
}

export default async function ConfirmEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await verifySession();
  const token = firstParam((await searchParams).token) ?? '';
  const t = await getTranslations('account');

  const request =
    token.length >= 20 && token.length <= 200
      ? await prisma.emailChangeRequest.findUnique({
          where: { token: hashToken(token) },
          select: { userId: true, newEmail: true, expires: true },
        })
      : null;
  const valid = request !== null && request.userId === session.user.id && request.expires > new Date();

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('email.confirmTitle')}</CardTitle>
          {valid && <CardDescription>{t('email.confirmBody', { email: request.newEmail })}</CardDescription>}
        </CardHeader>
        <CardContent>
          {valid ? (
            <ConfirmEmailChange token={token} />
          ) : (
            <div className="grid gap-4">
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{t('errors.invalid_token')}</AlertDescription>
              </Alert>
              <div>
                <Button asChild variant="outline">
                  <Link href="/account">{t('email.backToAccount')}</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
