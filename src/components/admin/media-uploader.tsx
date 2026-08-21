'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The uploader.
 *
 * **Alt text is required before the request is sent**, not validated after the
 * file lands. The route handler refuses it too, but a server-side refusal after
 * a successful upload leaves an orphaned object in the bucket every time
 * somebody forgets — which is often, and the bucket has no way to know the row
 * was never written.
 *
 * A Client Component because it posts multipart to a route handler and reports
 * the result; there is no Server Action equivalent that streams a file and
 * hands back a record for the picker.
 */
export function MediaUploader() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function upload(formData: FormData) {
    const alt = String(formData.get('altAr') ?? '').trim();
    if (!alt) {
      setMessage('النص البديل بالعربية مطلوب قبل الرفع.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/media', { method: 'POST', body: formData });
      const body = (await response.json()) as { ok: boolean; messageKey?: string };

      if (!response.ok || !body.ok) {
        setMessage(
          body.messageKey === 'errors.upload.too_large'
            ? 'حجم الملف يتجاوز 4 ميغابايت.'
            : 'تعذّر الرفع. تحقّق من نوع الملف وحجمه.',
        );
        return;
      }

      setMessage('تم الرفع.');
      // `router.refresh()`, not `window.location.reload()`. The library is a
      // Server Component and does need re-fetching, but a full reload tears the
      // document down immediately — including the `role="status"` region set on
      // the line above, before any assistive technology has had a chance to
      // announce it. `refresh()` re-renders the server tree in place and leaves
      // the confirmation standing.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={upload} className="rule-edge bg-paper p-5">
      <p className="text-small font-medium text-ink">رفع ملف</p>

      {/* Always present, contents swapped — see the note in form-shell.tsx.
          It matters more here: this is a polite region, and a polite region
          inserted at the moment its content arrives is the case that most often
          goes unannounced. */}
      <div aria-live="polite" role="status">
        {message ? (
          <p className="rule-edge mbs-3 border-gold-600 bg-gold-050 p-3 text-caption text-ink">
            {message}
          </p>
        ) : null}
      </div>

      <div className="mbs-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="file" className="eyebrow">
            الملف
          </label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
            className="mbs-1 block w-full text-small"
          />
          <p className="mbs-1 text-caption text-ink-55">
            حد أقصى 4 ميغابايت. تُجرَّد بيانات EXIF من الصور تلقائياً.
          </p>
        </div>

        <div>
          <label htmlFor="altAr" className="eyebrow">
            النص البديل (عربي) — مطلوب
          </label>
          <input
            id="altAr"
            name="altAr"
            required
            dir="rtl"
            className="rule-edge mbs-1 block w-full bg-paper px-3 py-2 text-small"
          />
        </div>

        <div>
          <label htmlFor="consent" className="eyebrow">
            حالة الموافقة
          </label>
          <select
            id="consent"
            name="consent"
            className="rule-edge mbs-1 block w-full bg-paper px-3 py-2 text-small"
          >
            <option value="not_required">غير مطلوبة</option>
            <option value="obtained">مُوثَّقة</option>
            <option value="pending">قيد الانتظار</option>
          </select>
        </div>

        <div>
          <label htmlFor="consentReference" className="eyebrow">
            مرجع الموافقة
          </label>
          <input
            id="consentReference"
            name="consentReference"
            className="rule-edge mbs-1 block w-full bg-paper px-3 py-2 text-small"
          />
        </div>

        <label className="flex items-center gap-2 text-small md:col-span-2">
          <input
            type="checkbox"
            name="hasIdentifiableMinors"
            value="true"
            className="size-4 accent-navy-700"
          />
          تظهر في الصورة وجوه أطفال يمكن التعرّف عليها
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mbs-5 bg-navy-700 px-5 py-2 text-small font-medium text-paper hover:bg-navy-900 disabled:opacity-60"
      >
        {busy ? 'جارٍ الرفع…' : 'رفع'}
      </button>
    </form>
  );
}
