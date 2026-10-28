'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { isLocale, routing, type Locale } from '@/i18n/routing';

import './globals.css';

/**
 * Last-resort boundary: replaces the root layout, so no translation provider is available.
 * The few strings it needs are inlined per locale.
 */
const COPY: Record<Locale, { title: string; description: string; retry: string; reference: string }> = {
  en: {
    title: 'Something went wrong',
    description: 'The page could not be loaded. Try again in a moment.',
    retry: 'Try again',
    reference: 'Error reference:',
  },
  pl: {
    title: 'Coś poszło nie tak',
    description: 'Nie udało się wczytać strony. Spróbuj ponownie za chwilę.',
    retry: 'Spróbuj ponownie',
    reference: 'Numer błędu:',
  },
  es: {
    title: 'Algo salió mal',
    description: 'No se pudo cargar la página. Inténtalo de nuevo en un momento.',
    retry: 'Reintentar',
    reference: 'Referencia del error:',
  },
  fr: {
    title: 'Une erreur est survenue',
    description: 'La page n’a pas pu être chargée. Réessayez dans un instant.',
    retry: 'Réessayer',
    reference: 'Référence de l’erreur :',
  },
};

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const requested = useParams<{ locale?: string }>()?.locale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;
  const copy = COPY[locale];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body className="min-h-dvh font-sans">
        <title>{copy.title}</title>
        <main className="mx-auto grid max-w-md justify-items-center gap-4 px-4 py-24 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.description}</p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {copy.retry}
          </button>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              {copy.reference} <code className="font-mono">{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
