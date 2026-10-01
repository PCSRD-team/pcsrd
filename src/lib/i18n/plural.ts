/**
 * Plural agreement for counted copy.
 *
 * Arabic has six plural forms and the noun changes in every one of them:
 * «لا مشاريع · مشروع واحد · مشروعان · 3 مشاريع · 11 مشروعاً · 100 مشروع».
 * A single `'{n} مشروع'` template is correct for one of those six and wrong
 * for the other five, which is why a count in the dictionaries is an object
 * of forms rather than a string.
 *
 * The category comes from `Intl.PluralRules`, which carries the CLDR rules
 * for both locales, so no rule is hand-written here. `zero` is chosen
 * explicitly for `0` in every locale: CLDR gives English no zero category,
 * but "No projects" reads better than "0 projects" in both languages.
 *
 * No imports, no `server-only`: a Client Component (the admin picker, the
 * form shell) may call it as freely as a page.
 */

export type PluralForms = {
  zero: string;
  one: string;
  two: string;
  few: string;
  many: string;
  other: string;
};

const rulesByLocale = new Map<string, Intl.PluralRules>();

function rulesFor(locale: string): Intl.PluralRules {
  let rules = rulesByLocale.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    rulesByLocale.set(locale, rules);
  }
  return rules;
}

/** The form a count selects, before `{n}` is filled. */
export function pluralForm(locale: string, n: number, forms: PluralForms): string {
  if (n === 0) return forms.zero;
  const category = rulesFor(locale).select(n);
  return forms[category] ?? forms.other;
}

/**
 * The counted phrase, `{n}` filled.
 *
 * `display` is the number as it should appear — a page passes
 * `formatNumber(n, locale)` so grouping and digits follow the locale; without
 * it the plain number is used.
 */
export function plural(
  locale: string,
  n: number,
  forms: PluralForms,
  display: string = String(n),
): string {
  return pluralForm(locale, n, forms).replace(/\{n\}/g, display);
}
