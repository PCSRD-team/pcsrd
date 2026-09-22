'use client';
// Client Component: intercepts the submit so the editor stays on the page and
// the library refreshes in place. The form underneath is an ordinary
// `multipart/form-data` POST and works without this — see below.

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
 *
 * **It works with scripting off.** This was the one admin form that did not,
 * against non-negotiable #7, and the exception was recorded rather than fixed
 * on the grounds that no Server Action can stream a file and hand back a
 * record for the picker. That is true and it was never the obstacle: the route
 * handler already accepted a plain multipart POST, because that is what
 * `fetch` was sending it. What it did not do was answer a *browser* — it
 * returned JSON, so a no-JS submit landed on a page of raw JSON with no way
 * back. It now content-negotiates, and the form carries a real `action`,
 * `method` and `encType`, so the native submit redirects to `/admin/media`
 * with a flash like every other admin mutation.
 */
export function MediaUploader() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const t = adminUi.uploader;

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    // The form has a real `action`, `method` and `encType`, so with scripting
    // off it posts natively to the same route handler and comes back with a
    // redirect and a flash. This handler is the enhancement on top: it keeps
    // the editor on the page and refreshes the library in place.
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const alt = String(formData.get('altAr') ?? '').trim();
    if (!alt) {
      setMessage({ tone: 'danger', text: t.altRequired });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: formData,
        // What tells the handler to answer with JSON rather than a redirect.
        headers: { Accept: 'application/json' },
      });
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
      <form
        action="/api/admin/media"
        method="post"
        encType="multipart/form-data"
        onSubmit={upload}
      >
        {/* Where the no-JS redirect lands. Ignored by the fetch path, which
            never leaves the page. */}
        <input type="hidden" name="returnTo" value="/admin/media" />
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
