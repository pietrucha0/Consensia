import { CircleCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangeEmailForm } from '@/features/account/components/change-email-form';
import { ChangePasswordForm } from '@/features/account/components/change-password-form';
import { ProfileForm } from '@/features/account/components/profile-form';
import { SignOutOthersButton } from '@/features/account/components/sign-out-others-button';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return { title: t('title') };
}

export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await verifySession();
  const emailChanged = firstParam((await searchParams).notice) === 'emailChanged';
  const [user, activeSessions, pendingEmail, t, tRole, format] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, role: true, preferredLocale: true, notifyNewResolutions: true, createdAt: true },
    }),
    prisma.session.count({ where: { userId: session.user.id, expires: { gt: new Date() } } }),
    prisma.emailChangeRequest.findFirst({
      where: { userId: session.user.id, expires: { gt: new Date() } },
      select: { newEmail: true },
    }),
    getTranslations('account'),
    getTranslations('dashboard.role'),
    getFormatter(),
  ]);
  if (!user) notFound();

  const otherSessions = Math.max(0, activeSessions - 1);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>

      {emailChanged && (
        <Alert variant="success">
          <CircleCheck />
          <AlertDescription>{t('email.changed', { email: user.email })}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('details.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="grid gap-1">
              <dt className="text-muted-foreground">{t('details.email')}</dt>
              <dd className="font-medium break-all">{user.email}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-muted-foreground">{t('details.role')}</dt>
              <dd className="font-medium">{tRole(user.role)}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-muted-foreground">{t('details.memberSince')}</dt>
              <dd className="font-medium">{format.dateTime(user.createdAt, { dateStyle: 'long' })}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('email.title')}</CardTitle>
          <CardDescription>
            {pendingEmail ? t('email.pending', { email: pendingEmail.newEmail }) : t('email.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('profile.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              name: user.name ?? '',
              preferredLocale: user.preferredLocale,
              notifyNewResolutions: user.notifyNewResolutions,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('password.title')}</CardTitle>
          <CardDescription>{t('password.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sessions.title')}</CardTitle>
          <CardDescription>{t('sessions.description', { count: otherSessions })}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutOthersButton otherSessions={otherSessions} />
        </CardContent>
      </Card>
    </div>
  );
}
