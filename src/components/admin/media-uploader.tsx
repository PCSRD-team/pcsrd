'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { inputClass } from '@/components/admin/controls';

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
  const [fileName, setFileName] = useState('');

  async function upload(formData: FormData) {
    const alt = String(formData.get('altAr') ?? '').trim();
    if (!alt) {
      setMessage('النص البديل بالعربية مطلوب قبل الرفع.');
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
    <form action={upload} className="rounded-2xl border border-white bg-white/85 p-5 shadow-[0_14px_36px_rgb(20_33_63/0.07)] md:p-6">
      <div className="flex items-start gap-3 border-be border-rule pbe-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-700" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path d="M12 16V4m0 0 4 4m-4-4L8 8M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div>
          <h2 className="text-h4 font-semibold text-ink">رفع ملف جديد</h2>
          <p className="mbs-1 text-caption text-ink-55">ارفع صورة أو ملف PDF وأضف البيانات اللازمة لسهولة العثور عليه لاحقًا.</p>
        </div>
      </div>

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

      <div className="mbs-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-2 rounded-xl bg-paper-alt/55 p-3">
          <label htmlFor="file" className="block text-small font-medium text-ink">الملف <span className="text-gold-700">*</span></label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
            onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? '')}
            className="sr-only"
          />
          <label htmlFor="file" className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-navy-700/35 bg-white px-4 text-center transition hover:border-navy-700 hover:bg-navy-100/40">
            <span className="text-small font-medium text-navy-700">{fileName || 'اضغط لاختيار صورة أو PDF'}</span>
            <span className="mbs-1 text-caption text-ink-55">JPEG، PNG، WebP، AVIF أو PDF</span>
          </label>
          <p className="text-caption text-ink-55">
            حد أقصى 4 ميغابايت. تُجرَّد بيانات EXIF من الصور تلقائياً.
          </p>
        </div>

        <div className="space-y-2 rounded-xl bg-paper-alt/55 p-3">
          <label htmlFor="altAr" className="block text-small font-medium text-ink">النص البديل (عربي) <span className="text-gold-700">*</span></label>
          <p className="text-caption text-ink-55">وصف مختصر وواضح لمحتوى الصورة أو الملف.</p>
          <input
            id="altAr"
            name="altAr"
            required
            dir="rtl"
            placeholder="مثال: توزيع مساعدات إنسانية في غزة"
            className={inputClass}
          />
        </div>

        <div className="space-y-2 rounded-xl bg-paper-alt/55 p-3">
          <label htmlFor="consent" className="block text-small font-medium text-ink">حالة الموافقة</label>
          <select
            id="consent"
            name="consent"
            className={inputClass}
          >
            <option value="not_required">غير مطلوبة</option>
            <option value="obtained">مُوثَّقة</option>
            <option value="pending">قيد الانتظار</option>
          </select>
        </div>

        <div className="space-y-2 rounded-xl bg-paper-alt/55 p-3">
          <label htmlFor="consentReference" className="block text-small font-medium text-ink">مرجع الموافقة</label>
          <p className="text-caption text-ink-55">اختياري، مثل رقم النموذج أو اسم المستند.</p>
          <input
            id="consentReference"
            name="consentReference"
            className={inputClass}
          />
        </div>

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-rule bg-gold-050/50 px-4 text-small text-ink md:col-span-2">
          <input
            type="checkbox"
            name="hasIdentifiableMinors"
            value="true"
            className="size-5 rounded accent-navy-700"
          />
          تظهر في الصورة وجوه أطفال يمكن التعرّف عليها
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mbs-1 min-h-11 rounded-xl bg-navy-700 px-7 text-small font-medium text-paper shadow-[0_8px_20px_rgb(37_66_132/0.18)] hover:bg-navy-900 disabled:opacity-60"
      >
        {busy ? 'جارٍ الرفع…' : 'رفع'}
      </button>
    </form>
  );
}
