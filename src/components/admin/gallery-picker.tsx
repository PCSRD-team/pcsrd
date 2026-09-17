'use client';
// Client Component: slots are added and removed in place (`useState`).
// The stored slots still post without JavaScript; only adding one needs it.

import { useId, useState } from 'react';
import { MediaPicker } from '@/components/admin/media-picker';
import { Button } from '@/components/ui/button';
import { Fieldset } from '@/components/ui/field';
import { Grid } from '@/components/ui/layout';
import { Caption } from '@/components/ui/typography';
import { adminUi } from './admin-ui-dict';

/**
 * A gallery: an ordered list of media ids, posted as repeated `name` fields.
 *
 * Each slot is an ordinary `MediaPicker` whose hidden input carries the same
 * `name`, so `parseAdminForm`'s `multi` list collects them in order — and an
 * empty slot posts `''`, which that helper drops.
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
  const groupId = useId();
  const t = adminUi.gallery;

  return (
    <Fieldset name={groupId} legend={label} hint={hint}>
      {/* Always posted, even with no slots: the action reads its presence as
          "this form owns the gallery", so an emptied gallery is saved as empty
          rather than left as it was. An empty value is dropped on parse. */}
      <input type="hidden" name={name} value="" />

      {slots.length === 0 ? (
        <Caption>{t.empty}</Caption>
      ) : (
        <Grid as="ol" cols={2} gap={3}>
          {slots.map((slot, index) => (
            <li key={slot.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-eyebrow text-mono-muted" dir="ltr">
                  {index + 1}
                </span>
                <Button
                  type="button"
                  tone="quiet"
                  size="sm"
                  onClick={() => setSlots((current) => current.filter((s) => s.key !== slot.key))}
                >
                  {t.remove}
                </Button>
              </div>
              <MediaPicker name={name} initialValue={slot.id} kind="image" />
            </li>
          ))}
        </Grid>
      )}

      <Button
        type="button"
        tone="secondary"
        size="sm"
        className="mbs-3"
        onClick={() => {
          setSlots((current) => [...current, { key: nextKey, id: '' }]);
          setNextKey((k) => k + 1);
        }}
      >
        {t.add}
      </Button>
    </Fieldset>
  );
}
