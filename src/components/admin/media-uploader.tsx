'use client';
// Client Component: posts multipart to the route handler with `fetch` and
// reports the result in place — there is no Server Action that streams a
// file and hands back a record for the picker.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Field, FieldRow, FormStack } from '@/components/ui/field';
import { Checkbox, FileInput, Input, Select } from '@/components/ui/inputs';
import { LiveRegion, Notice } from '@/components/ui/notice';
import { Caption, Heading } from '@/components/ui/typography';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import { adminUi } from './admin-ui-dict';

/**
 * The uploader.
 *
 * **Alt text is required before the request is sent**, not validated after the
 * file lands. The route handler refuses it too, but a server-side refusal after
 * a successful upload leaves an orphaned object in the bucket every time
 * somebody forgets — which is often, and the bucket has no way to know the row
 * was never written.
 */
export function MediaUploader() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const t = adminUi.uploader;

  async function upload(formData: FormData) {
    const alt = String(formData.get('altAr') ?? '').trim();
    if (!alt) {
      setMessage({ tone: 'danger', text: t.altRequired });
      return;
    }

    const file = formData.get('file');
    if (file instanceof File) formData.set('kind', file.type === 'application/pdf' ? 'document' : 'image');

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/media', { method: 'POST', body: formData });
      const body = (await response.json()) as { ok: boolean; messageKey?: string };

      if (!response.ok || !body.ok) {
        setMessage({
          tone: 'danger',
          text: body.messageKey === 'errors.upload.too_large' ? t.tooLarge : t.failed,
        });
        return;
      }

      setMessage({ tone: 'success', text: t.done });
      // `router.refresh()`, not `window.location.reload()`. The library is a
      // Server Component and does need re-fetching, but a full reload tears the
      // document down immediately — including the live region set on the line
      // above, before any assistive technology has had a chance to announce
      // it. `refresh()` re-renders the server tree in place and leaves the
      // confirmation standing.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel as="section" tone="white" padding="md" labelledBy="uploader-title">
      <form action={upload}>
        <FormStack>
          <div>
            <Heading level={2} size="h4" id="uploader-title">
              {t.title}
            </Heading>
            <Caption className="mbs-1">{t.lede}</Caption>
          </div>

          {/* Always present, contents swapped: a polite region inserted at the
              moment its content arrives is the case that most often goes
              unannounced. */}
          <LiveRegion>
            {message ? (
              <Notice tone={message.tone} live="off">
                {message.text}
              </Notice>
            ) : null}
          </LiveRegion>

          <FieldRow>
            <Field name="file" label={t.file} hint={t.fileHint} required>
              <FileInput
                name="file"
                required
                hint={t.fileHint}
                accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
              />
            </Field>
            <Field name="altAr" label={t.altAr} hint={t.altHint} required>
              <Input name="altAr" required dir="rtl" hint={t.altHint} placeholder={t.altPlaceholder} />
            </Field>
            <Field name="consent" label={t.consent}>
              <Select name="consent" placeholder={null} options={[...ADMIN_OPTIONS.consentStatus]} />
            </Field>
            <Field name="consentReference" label={t.consentReference} hint={t.consentReferenceHint}>
              <Input name="consentReference" hint={t.consentReferenceHint} />
            </Field>
          </FieldRow>

          <Checkbox name="hasIdentifiableMinors" value="true" label={t.minors} />

          <div>
            <Button type="submit" loading={busy}>
              {busy ? t.uploading : t.upload}
            </Button>
          </div>
        </FormStack>
      </form>
    </Panel>
  );
}
