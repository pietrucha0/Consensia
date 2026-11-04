'use client';

import { CircleAlert, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ComponentProps } from 'react';

import { FormField } from '@/components/form/form-field';
import { UPLOAD_ACCEPT, useFileUpload } from '@/components/form/use-file-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  value: string;
  onChange: (url: string) => void;
  error?: string | undefined;
  /** Props for the URL <input> (react-hook-form `register`). */
  inputProps: ComponentProps<'input'>;
};

export function HeroImageField({ value, onChange, error, inputProps }: Props) {
  const t = useTranslations('admin');
  const { fileInput, uploading, error: uploadError, upload } = useFileUpload('image', onChange);
  const id = useId();

  return (
    <div className="grid gap-3">
      <div className="aspect-[16/9] overflow-hidden rounded-md border bg-muted">
        {value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-8" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInput}
          id={`${id}-file`}
          type="file"
          accept={UPLOAD_ACCEPT.image}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {uploading ? t('form.uploading') : t('form.upload')}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
            <Trash2 aria-hidden />
            {t('form.removeImage')}
          </Button>
        )}
      </div>

      {uploadError && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${uploadError}`)}</AlertDescription>
        </Alert>
      )}

      <FormField id={`${id}-url`} label={t('form.heroImageUrl')} hint={t('form.heroImageHint')} error={error}>
        {(a11y) => <Input {...a11y} type="url" inputMode="url" placeholder="https://" {...inputProps} />}
      </FormField>
    </div>
  );
}
