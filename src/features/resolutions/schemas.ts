import { z } from 'zod';

import { routing, type Locale } from '@/i18n/routing';
import { documentUrlField, imageUrlField } from '@/lib/image-url';

export const RESOLUTION_MIN_OPTIONS = 2;
export const RESOLUTION_MAX_OPTIONS = 10;

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const translationSchema = z.object({
  title: z.string().trim().max(300, { error: 'tooLong' }),
  /** Detailed description / legal justification (plain text, paragraphs by blank lines). */
  description: z.string().trim().max(20_000, { error: 'tooLong' }),
});

const labelField = z.string().trim().max(120, { error: 'tooLong' });

const optionSchema = z.object({
  labels: z.object({ en: labelField, pl: labelField, es: labelField, fr: labelField }),
});

export const resolutionFormSchema = z
  .object({
    reference: z.string().trim().max(40, { error: 'tooLong' }),
    imageUrl: imageUrlField,
    attachmentUrl: documentUrlField,
    /** datetime-local in APP_TIME_ZONE, or '' for no deadline (closed manually). */
    closesAt: z.string().refine((value) => value === '' || DATETIME_LOCAL.test(value), { error: 'invalid' }),
    translations: z.object({
      en: translationSchema,
      pl: translationSchema,
      es: translationSchema,
      fr: translationSchema,
    }),
    options: z
      .array(optionSchema)
      .min(RESOLUTION_MIN_OPTIONS, { error: 'optionsTooFew' })
      .max(RESOLUTION_MAX_OPTIONS, { error: 'optionsTooMany' }),
  })
  .superRefine((data, ctx) => {
    const filled = routing.locales.filter((l) => data.translations[l].title !== '' || data.translations[l].description !== '');
    if (filled.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['translations'], message: 'translationRequired' });
      return;
    }
    for (const locale of filled) {
      const t = data.translations[locale];
      if (t.title === '') ctx.addIssue({ code: 'custom', path: ['translations', locale, 'title'], message: 'titleRequired' });
      if (t.description === '') {
        ctx.addIssue({ code: 'custom', path: ['translations', locale, 'description'], message: 'descriptionRequired' });
      }
      // Every option must read in every language the resolution itself is written in.
      data.options.forEach((option, index) => {
        if (option.labels[locale] === '') {
          ctx.addIssue({ code: 'custom', path: ['options', index, 'labels', locale], message: 'optionLabelRequired' });
        }
      });
    }
  });

export type ResolutionFormValues = z.input<typeof resolutionFormSchema>;
export type OptionLabels = Record<Locale, string>;

export const emptyResolutionForm = (defaultOptions: OptionLabels[]): ResolutionFormValues => ({
  reference: '',
  imageUrl: '',
  attachmentUrl: '',
  closesAt: '',
  translations: {
    en: { title: '', description: '' },
    pl: { title: '', description: '' },
    es: { title: '', description: '' },
    fr: { title: '', description: '' },
  },
  options: defaultOptions.map((labels) => ({ labels: { ...labels } })),
});

export const voteInputSchema = z.object({
  resolutionId: z.string().min(1).max(64),
  optionId: z.string().min(1).max(64),
});
