import { describe, expect, it } from 'vitest';
import { governorate } from '@/db/schema/enums';
import {
  assertCatalogInvariants,
  CATALOG_BY_KEY,
  CATALOG_GROUPS,
  catalogField,
  DEFAULT_FORM_FIELDS,
  FIELD_CATALOG,
  GROUP_LABEL_AR,
  GROUP_LABEL_EN,
  STARTER_FIELDS,
} from '@/lib/applications/field-catalog';

/**
 * The catalogue is data, so the only way it breaks is silently: a key that the
 * `application_form_fields_key_shape` CHECK rejects, a `select` whose options
 * were deleted during an edit, two fields both claiming to be the applicant's
 * phone number. None of that fails a typecheck, and all of it fails at the
 * moment an admin adds the field to a form — or, worse, at the moment an
 * applicant presses submit.
 *
 * `assertCatalogInvariants()` deliberately does not run at import time (see
 * its own comment), so this file is what makes it run at all.
 */
describe('field catalogue invariants', () => {
  it('satisfies every rule the database enforces on a form field row', () => {
    expect(() => assertCatalogInvariants()).not.toThrow();
  });

  it('is large enough to be worth having', () => {
    // If the catalogue shrinks below this, either a group was deleted by
    // accident or somebody started moving fields out into a second list.
    expect(FIELD_CATALOG.length).toBeGreaterThan(60);
  });

  it('indexes every entry by key', () => {
    expect(CATALOG_BY_KEY.size).toBe(FIELD_CATALOG.length);
    for (const field of FIELD_CATALOG) {
      expect(catalogField(field.key)).toBe(field);
    }
  });

  it('returns undefined for a key a later release removed, rather than throwing', () => {
    expect(catalogField('a_field_that_was_deleted')).toBeUndefined();
  });
});

describe('groups', () => {
  it('gives every declared group at least one field', () => {
    for (const group of CATALOG_GROUPS) {
      const inGroup = FIELD_CATALOG.filter((field) => field.group === group);
      expect(inGroup.length, `group "${group}" is empty`).toBeGreaterThan(0);
    }
  });

  it('puts every field in a declared group, and labels every group in both languages', () => {
    for (const field of FIELD_CATALOG) {
      expect(CATALOG_GROUPS).toContain(field.group);
    }
    for (const group of CATALOG_GROUPS) {
      expect(GROUP_LABEL_AR[group]).toBeTruthy();
      expect(GROUP_LABEL_EN[group]).toBeTruthy();
    }
  });

  it('lists the catalogue in group order, so the flat array is already a form order', () => {
    const positions = FIELD_CATALOG.map((field) => CATALOG_GROUPS.indexOf(field.group));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('starter sets', () => {
  it('references only real catalogue keys from the default form', () => {
    for (const key of DEFAULT_FORM_FIELDS) {
      expect(catalogField(key), `DEFAULT_FORM_FIELDS names "${key}"`).toBeDefined();
    }
  });

  it('references only real catalogue keys from every form kind', () => {
    for (const [kind, keys] of Object.entries(STARTER_FIELDS)) {
      for (const key of keys) {
        expect(catalogField(key), `STARTER_FIELDS.${kind} names "${key}"`).toBeDefined();
      }
      // A key repeated inside one starter set would violate the
      // `(form_id, key)` unique index the moment the form is created.
      expect(new Set(keys).size, `STARTER_FIELDS.${kind} repeats a key`).toBe(keys.length);
    }
  });

  it('covers every form kind the enum declares', () => {
    expect(Object.keys(STARTER_FIELDS).sort()).toEqual(
      ['consultancy', 'internship', 'job', 'other', 'training', 'volunteer'],
    );
  });
});

describe('the governorate field', () => {
  it('offers exactly the members of the governorate enum, in order', () => {
    const field = catalogField('governorate');
    expect(field?.type).toBe('select');
    expect(field?.options?.map((option) => option.value)).toEqual([
      ...governorate.enumValues,
    ]);
  });

  it('labels each governorate in Arabic and English', () => {
    for (const option of catalogField('governorate')?.options ?? []) {
      expect(option.labelAr).toBeTruthy();
      expect(option.labelEn).toBeTruthy();
    }
  });
});

describe('the promises only a catalogue can make', () => {
  it('carries a non-empty label in both languages on every entry', () => {
    for (const field of FIELD_CATALOG) {
      expect(field.labelAr.trim(), `${field.key} labelAr`).not.toBe('');
      expect(field.labelEn.trim(), `${field.key} labelEn`).not.toBe('');
    }
  });

  it('fills all three identity roles exactly once', () => {
    const roles = FIELD_CATALOG.flatMap((field) => (field.identityRole ? [field.identityRole] : []));
    expect(roles.sort()).toEqual(['email', 'name', 'phone']);
  });

  it('marks the national ID, the birth date and the ID scan as sensitive', () => {
    // 20-PRIVACY §5 asks for an age band rather than a birth date. These three
    // exist because contracting sometimes needs them, and `sensitive` is what
    // keeps collecting them a deliberate act rather than a default.
    for (const key of ['national_id', 'date_of_birth', 'id_copy_file']) {
      expect(catalogField(key)?.sensitive, `${key} must be sensitive`).toBe(true);
    }
    expect(catalogField('age_band')?.sensitive).toBeUndefined();
  });

  it('never suggests a sensitive field as required by default', () => {
    for (const field of FIELD_CATALOG) {
      if (field.sensitive) expect(field.defaultRequired, field.key).not.toBe(true);
    }
  });

  it('keeps the optional future-vacancies consent optional', () => {
    // A consent that is a condition of applying is not a consent.
    expect(catalogField('consent_keep_cv')?.defaultRequired).toBeUndefined();
    expect(catalogField('consent_personal_data')?.defaultRequired).toBe(true);
  });

  it('gives every file field an accept catalogue, so a CV cannot be a screenshot', () => {
    for (const field of FIELD_CATALOG) {
      if (field.type === 'file') expect(field.config?.accept, field.key).toBeTruthy();
    }
  });
});
