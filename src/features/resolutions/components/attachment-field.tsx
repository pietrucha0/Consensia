'use client';

import { CircleAlert, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ComponentProps } from 'react';

import { FormField } from '@/components/form/form-field';
import { UPLOAD_ACCEPT, useFileUpload } from '@/components/form/use-file-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DOCUMENT_URL_PATTERN } from '@/lib/image-url';

type Props = {
  value: string;
  onChange: (url: string) => void;
  error?: string | undefined;
  /** Props for the URL <input> (react-hook-form `register`). */
  inputProps: ComponentProps<'input'>;
};

/** Attachment of a resolution: an uploaded PDF, or a link to a document elsewhere. */
export function AttachmentField({ value, onChange, error, inputProps }: Props) {
  const t = useTranslations('admin');
  const { fileInput, uploading, error: uploadError, upload } = useFileUpload('document', onChange);
  const id = useId();
  const uploaded = DOCUMENT_URL_PATTERN.test(value);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          id={`${id}-file`}
          type="file"
          accept={UPLOAD_ACCEPT.document}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {uploading ? t('form.uploading') : t('resolutions.form.uploadPdf')}
        </Button>
        {uploaded && (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileText className="size-4" aria-hidden />
              {t('resolutions.form.pdfAttached')}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              <Trash2 aria-hidden />
              {t('resolutions.form.removeAttachment')}
            </Button>
          </>
        )}
      </div>

      {uploadError && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${uploadError}`)}</AlertDescription>
        </Alert>
      )}

      <FormField id={`${id}-url`} label={t('resolutions.form.attachmentUrl')} hint={t('resolutions.form.attachmentHint')} error={error}>
        {(a11y) => <Input {...a11y} inputMode="url" placeholder="https://" {...inputProps} />}
      </FormField>
    </div>
  );
}
