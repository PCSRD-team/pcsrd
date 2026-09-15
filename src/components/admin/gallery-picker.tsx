'use client';

import { useState } from 'react';
import { MediaPicker } from '@/components/admin/media-picker';

/**
 * A gallery: an ordered list of media ids, posted as repeated `name` fields.
 *
 * A Client Component because slots are added and removed in place; the
 * `useState` is the reason. Each slot is an ordinary `MediaPicker` whose
 * hidden input carries the same `name`, so `parseAdminForm`'s `multi` list
 * collects them in order — and an empty slot posts `''`, which that helper
 * drops. Without JavaScript the stored slots still submit unchanged; only
 * adding a new one needs the script.
 *
 * Order is the DOM order, which is `displayOrder` on the junction row.
 */
export function GalleryPicker({
  name,
  initial,
  label,
  hint,
}: {
  name: string;
  initial: string[];
  label: string;
  hint?: string;
}) {
  // Slot keys are stable per slot so removing one does not remount the rest.
  const [slots, setSlots] = useState(() => initial.map((id, index) => ({ key: index, id })));
  const [nextKey, setNextKey] = useState(initial.length);

  return (
    <fieldset className="space-y-3 rounded-none bg-white/55 p-3">
      <legend className="text-small font-medium text-ink">{label}</legend>
      {/* Always posted, even with no slots: the action reads its presence as
          "this form owns the gallery", so an emptied gallery is saved as empty
          rather than left as it was. An empty value is dropped on parse. */}
      <input type="hidden" name={name} value="" />
      {hint ? <p className="text-caption text-ink-55">{hint}</p> : null}

      {slots.length === 0 ? (
        <p className="text-caption text-ink-55">—</p>
      ) : (
        <ol className="grid gap-3 md:grid-cols-2">
          {slots.map((slot, index) => (
            <li key={slot.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-eyebrow text-mono-muted" dir="ltr">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setSlots((current) => current.filter((s) => s.key !== slot.key))}
                  className="rule-edge px-3 py-1 text-caption text-ink hover:bg-paper-alt"
                >
                  إزالة
                </button>
              </div>
              <MediaPicker name={name} initialValue={slot.id} kind="image" />
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={() => {
          setSlots((current) => [...current, { key: nextKey, id: '' }]);
          setNextKey((k) => k + 1);
        }}
        className="rule-edge px-4 py-2 text-small text-ink hover:bg-paper-alt"
      >
        إضافة صورة
      </button>
    </fieldset>
  );
}
