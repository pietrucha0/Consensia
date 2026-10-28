'use client';

import { CircleAlert, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type ComponentProps } from 'react';

import { FormField } from '@/components/form/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

const UPLOAD_ERRORS = ['upload_rate_limited', 'upload_too_large', 'upload_invalid_type', 'upload_failed'] as const;
type UploadError = (typeof UPLOAD_ERRORS)[number];

type Props = {
  value: string;
  onChange: (url: string) => void;
  error?: string | undefined;
  /** Props for the URL <input> (react-hook-form `register`). */
  inputProps: ComponentProps<'input'>;
};

export function HeroImageField({ value, onChange, error, inputProps }: Props) {
  const t = useTranslations('admin');
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const id = useId();

  const upload = async (file: File) => {
    setUploadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('upload_too_large');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/uploads', { method: 'POST', body });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isUploadSuccess(data)) {
        onChange(data.url);
      } else {
        setUploadError(isUploadFailure(data) ? data.error : 'upload_failed');
      }
    } catch {
      setUploadError('upload_failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

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
          accept={ACCEPT}
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

function isUploadSuccess(data: unknown): data is { url: string } {
  return typeof data === 'object' && data !== null && 'url' in data && typeof data.url === 'string';
}

function isUploadFailure(data: unknown): data is { error: UploadError } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    UPLOAD_ERRORS.some((code) => code === data.error)
  );
}
