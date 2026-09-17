'use client';
// Client Component: fetches the media library from the route handler and
// keeps the chosen id in state; the hidden input is what the form posts.

import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Cluster } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Caption, Heading, Meta } from '@/components/ui/typography';
import { formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { adminUi, fill } from './admin-ui-dict';

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

/**
 * The picker's search box is a native `<input className="control">`, not the
 * kit's `Input`: it sits inside the content form, and a kit input would
 * carry a `name` and be posted with it. It has no name on purpose.
 */
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
  const searchId = useId();
  const t = adminUi.mediaPicker;

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
          setError(t.loadError);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [kind, open, page, search, t.loadError]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const runSearch = () => {
    setError('');
    setLoading(true);
    setPage(1);
    setSearch(query.trim());
  };

  return (
    <>
      <input type="hidden" id={name} name={name} value={value} aria-describedby={describedBy} aria-invalid={invalid} />
      <Panel padding="sm" className={cn(invalid && 'border-destructive')}>
        {selected ? (
          <div className="flex items-center gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden bg-paper-alt">
              {selected.kind === 'image' ? (
                <Image src={selected.url} alt={selected.altAr} fill sizes="80px" className="object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center px-2 text-center font-mono text-eyebrow text-ink-55">
                  {t.file}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-caption font-medium text-ink">{selected.altAr}</p>
              <Meta className="mbs-1">{formatFileSize(selected.fileSize, 'ar')}</Meta>
            </div>
          </div>
        ) : (
          <Caption>{value ? t.savedPrevious : kind === 'document' ? t.noneFile : t.noneImage}</Caption>
        )}
        <Cluster gap={2} className="mbs-3">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setError('');
              setLoading(true);
              setOpen(true);
            }}
          >
            {t.choose}
          </Button>
          {value ? (
            <Button
              type="button"
              size="sm"
              tone="secondary"
              onClick={() => {
                setValue('');
                setSelected(null);
              }}
            >
              {t.clear}
            </Button>
          ) : null}
        </Cluster>
      </Panel>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${name}-picker-title`}
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto"
          >
            <Panel as="section" tone="paper" padding="md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Heading level={2} size="h3" id={`${name}-picker-title`}>
                    {t.dialogTitle}
                  </Heading>
                  <Caption className="mbs-1">
                    {kind === 'document' ? t.dialogHintFile : t.dialogHintImage}
                  </Caption>
                </div>
                <IconButton label={t.close} tone="secondary" onClick={() => setOpen(false)}>
                  <Icon name="close" />
                </IconButton>
              </div>

              <div className="mbs-5 flex gap-2">
                <label htmlFor={searchId} className="sr-only">
                  {t.searchLabel}
                </label>
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      runSearch();
                    }
                  }}
                  placeholder={t.searchPlaceholder}
                  className="control flex-1"
                />
                <Button type="button" tone="secondary" onClick={runSearch}>
                  {t.search}
                </Button>
              </div>

              <div className="mbs-5">
                {error ? <Notice tone="danger">{error}</Notice> : null}
                {loading ? <Caption className="py-12 text-center">{t.loading}</Caption> : null}
                {!loading && !error && items.length === 0 ? (
                  <Caption className="py-12 text-center">{t.noMatches}</Caption>
                ) : null}
                {!loading && items.length ? (
                  <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                    {items.map((item) => {
                      const blocked = item.hasIdentifiableMinors && item.consent !== 'obtained';
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={blocked}
                            onClick={() => {
                              setValue(item.id);
                              setSelected(item);
                              setOpen(false);
                            }}
                            className="interactive-surface rule-edge w-full bg-white p-2 text-start motion-standard transition-colors hover:border-navy-700 disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            <span className="relative block aspect-[4/3] overflow-hidden bg-paper-alt">
                              {item.kind === 'image' ? (
                                <Image src={item.url} alt={item.altAr} fill sizes="220px" className="object-cover" />
                              ) : (
                                <span className="flex size-full items-center justify-center px-2 text-center font-mono text-caption text-ink-55">
                                  {item.mimeType}
                                </span>
                              )}
                            </span>
                            <span className="mbs-2 block line-clamp-2 text-caption text-ink">{item.altAr}</span>
                            {blocked ? (
                              <span className="block text-eyebrow text-destructive">{t.blocked}</span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              {totalPages > 1 ? (
                <Cluster gap={3} justify="center" className="mbs-5">
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      setLoading(true);
                      setPage((current) => current - 1);
                    }}
                  >
                    {adminUi.pagination.previous}
                  </Button>
                  <Caption as="span">{fill(t.pageOf, { page, total: totalPages })}</Caption>
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => {
                      setLoading(true);
                      setPage((current) => current + 1);
                    }}
                  >
                    {adminUi.pagination.next}
                  </Button>
                </Cluster>
              ) : null}
            </Panel>
          </div>
        </div>
      ) : null}
    </>
  );
}
