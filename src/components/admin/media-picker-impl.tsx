'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { formatFileSize } from '@/lib/format';

type PickerItem = {
  id: string;
  kind: 'image' | 'document';
  url: string;
  altAr: string;
  altEn: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  consent: 'not_required' | 'obtained' | 'pending';
  hasIdentifiableMinors: boolean;
};

type ListResponse = {
  ok: boolean;
  data?: { items: PickerItem[]; page: number; totalPages: number; total: number };
};

export function MediaPickerImpl({
  name,
  initialValue = '',
  kind,
  describedBy,
  invalid,
}: {
  name: string;
  initialValue?: string;
  kind?: 'image' | 'document';
  describedBy?: string;
  invalid?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [selected, setSelected] = useState<PickerItem | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialValue) return;
    const controller = new AbortController();
    fetch(`/api/admin/media?id=${encodeURIComponent(initialValue)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((response: { data?: PickerItem | null }) => setSelected(response.data ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [initialValue]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('q', search);
    if (kind) params.set('kind', kind);
    fetch(`/api/admin/media?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('request_failed');
        return (await response.json()) as ListResponse;
      })
      .then((response) => {
        setItems(response.data?.items ?? []);
        setTotalPages(response.data?.totalPages ?? 1);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError('تعذّر تحميل مكتبة الوسائط. حاول مرة أخرى.');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [kind, open, page, search]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <>
      <input type="hidden" id={name} name={name} value={value} aria-describedby={describedBy} aria-invalid={invalid} />
      <div className={`rounded-lg border bg-paper p-3 ${invalid ? 'border-gold-600' : 'border-rule'}`}>
        {selected ? (
          <div className="flex items-center gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-paper-alt">
              {selected.kind === 'image' ? (
                <Image src={selected.url} alt={selected.altAr} fill sizes="80px" className="object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center px-2 text-center text-eyebrow text-ink-55">ملف</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-caption font-medium text-ink">{selected.altAr}</p>
              <p className="mbs-1 text-eyebrow text-ink-55">{formatFileSize(selected.fileSize, 'ar')}</p>
            </div>
          </div>
        ) : value ? (
          <p className="text-caption text-ink-55">تم حفظ ملف سابق. افتح المكتبة لمعاينته أو تغييره.</p>
        ) : (
          <p className="text-caption text-ink-55">لم يتم اختيار {kind === 'document' ? 'ملف' : 'صورة'}.</p>
        )}
        <div className="mbs-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setError(''); setLoading(true); setOpen(true); }} className="min-h-10 rounded-md bg-navy-700 px-4 text-caption font-medium text-paper hover:bg-navy-900">
            اختيار من مكتبة الوسائط
          </button>
          {value ? (
            <button type="button" onClick={() => { setValue(''); setSelected(null); }} className="min-h-10 rounded-md border border-rule px-4 text-caption text-ink hover:bg-paper-alt">
              إزالة الاختيار
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`${name}-picker-title`} className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-paper p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id={`${name}-picker-title`} className="text-h3 font-semibold text-ink">اختيار من مكتبة الوسائط</h2>
                <p className="mbs-1 text-caption text-ink-55">اضغط على {kind === 'document' ? 'الملف' : 'الصورة'} لاعتماده.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="size-10 rounded-md border border-rule text-ink hover:bg-paper-alt" aria-label="إغلاق">×</button>
            </div>

            <div className="mbs-5 flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    setError('');
                    setLoading(true);
                    setPage(1);
                    setSearch(query.trim());
                  }
                }}
                placeholder="بحث بالنص البديل…"
                className="min-h-11 flex-1 rounded-md border border-rule bg-white px-3 text-small text-ink"
              />
              <button type="button" onClick={() => { setError(''); setLoading(true); setPage(1); setSearch(query.trim()); }} className="rounded-md border border-rule px-4 text-small text-ink hover:bg-paper-alt">بحث</button>
            </div>

            {error ? <p className="rounded-md bg-gold-050 p-4 text-small text-gold-700">{error}</p> : null}
            {loading ? <p className="py-12 text-center text-small text-ink-55">جارٍ تحميل الوسائط…</p> : null}
            {!loading && !error && items.length === 0 ? <p className="py-12 text-center text-small text-ink-55">لا توجد وسائط مطابقة.</p> : null}
            {!loading && items.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {items.map((item) => {
                  const blocked = item.hasIdentifiableMinors && item.consent !== 'obtained';
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => { setValue(item.id); setSelected(item); setOpen(false); }}
                        className="w-full rounded-lg border border-rule bg-white p-2 text-start transition hover:border-navy-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <span className="relative block aspect-[4/3] overflow-hidden rounded-md bg-paper-alt">
                          {item.kind === 'image' ? <Image src={item.url} alt={item.altAr} fill sizes="220px" className="object-cover" /> : <span className="flex size-full items-center justify-center px-2 text-center text-caption text-ink-55">{item.mimeType}</span>}
                        </span>
                        <span className="mbs-2 block line-clamp-2 text-caption text-ink">{item.altAr}</span>
                        {blocked ? <span className="block text-eyebrow text-gold-700">لا يمكن استخدامها قبل توثيق الموافقة</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {totalPages > 1 ? (
              <div className="mbs-5 flex items-center justify-center gap-3">
                <button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="rounded-md border border-rule px-4 py-2 text-caption disabled:opacity-40">السابق</button>
                <span className="text-caption text-ink-55">صفحة {page} من {totalPages}</span>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="rounded-md border border-rule px-4 py-2 text-caption disabled:opacity-40">التالي</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
