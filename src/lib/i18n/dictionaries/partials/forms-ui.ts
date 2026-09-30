/**
 * Dictionary partial — `forms-ui`.
 *
 * Partials exist so several areas of the site can grow their copy at once
 * without editing the two root dictionaries. Each partial owns one top-level
 * namespace per key below; the root files spread them in. The English object
 * is typed from the Arabic one, so a key added on one side and forgotten on
 * the other is a build error.
 *
 * `formsUi` is the chrome *around* the six public forms — what the shell says
 * when JavaScript is off, what a hint says about a code format, what the
 * confidential channel is called. Field labels, option labels and error
 * messages stay in the root `forms`, `formOptions` and `errors` namespaces.
 */
export const forms_uiAr = {
  formsUi: {
    /**
     * Shown inside `<noscript>` where the Turnstile widget would render.
     * The action rejects a submission without a token (02-API §5.1), so a
     * visitor without JavaScript needs to be told *before* they type.
     */
    noScriptCaptcha:
      'خطوة التحقّق من أنك لست روبوتاً تعمل عبر JavaScript. فعّله في المتصفح ثم أعد الإرسال، أو تواصل معنا عبر القنوات المذكورة في هذه الصفحة.',
    /** Title of the notice above the complaint form's fields. */
    confidentialTitle: 'قناة سرّية',
    /**
     * A browser never re-fills a file input, so after a failed submission the
     * CV has to be chosen again. Said once, under the field, only then.
     */
    reselectFile: 'اختر الملف مجدداً بعد تصحيح الحقول.',
    /**
     * The careers portal's receipt. Distinct from `forms.successWithReference`
     * because an applicant sent an application, not a message.
     */
    applicationSuccess: 'وصلنا طلبك. رقمك المرجعي:',
    /**
     * Under a field whose `visibleWhen` names another field. Every field is
     * rendered — the server decides what counted — so the condition is said
     * in words. `{field}` is the controlling field's label, `{values}` the
     * matching options joined by `common.listSeparator`.
     */
    conditionHint: 'أجب عن هذا الحقل إذا كانت إجابتك في «{field}»: {values}.',
  },
} satisfies Record<string, Record<string, string>>;

/**
 * Not `as const`, for the same reason the root dictionaries are not: literal
 * value types would make the English strings unassignable to `Dictionary`.
 * The keys are what the type checks; the values widen to `string`.
 */
type Shape = typeof forms_uiAr;

export const forms_uiEn: Shape = {
  formsUi: {
    noScriptCaptcha:
      'The "I am not a robot" check runs on JavaScript. Enable it in your browser and submit again, or reach us through the channels listed on this page.',
    confidentialTitle: 'Confidential channel',
    reselectFile: 'Choose the file again after correcting the fields.',
    applicationSuccess: 'We have received your application. Your reference number:',
    conditionHint: 'Answer this only if you chose {values} for "{field}".',
  },
};
