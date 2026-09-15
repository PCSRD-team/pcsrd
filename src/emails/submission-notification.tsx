import { Heading, Link, Section, Text } from '@react-email/components';
import type { SubmissionType } from '@/db/schema/enums';
import { DIR, type Locale } from '@/lib/i18n/config';
import { type MailDict, withOrganization } from '@/lib/i18n/mail-dict';
import { Footer, Frame, Latin, styles, tokens } from './_shared';

/** One row of the payload table, already labelled and stringified. */
export type NotificationField = { label: string; value: string };

/**
 * The staff notification.
 *
 * The props are a discriminated union on purpose: a confidential submission
 * (`sensitive: true`) **has no `fields` prop at all**, so the type system
 * refuses to let complaint content be handed to the template, not just the
 * template refusing to render it. This is the rule from `src/lib/mail/send.ts`
 * — mail is forwarded, archived and searched; the admin is access controlled
 * and audited — stated in a way the compiler checks.
 */
export type SubmissionNotificationProps = {
  locale: Locale;
  dict: MailDict;
  organizationName: string;
  type: SubmissionType;
  reference: string;
  adminUrl: string;
} & (
  | { sensitive: true }
  | { sensitive: false; fields: readonly NotificationField[]; hasAttachment: boolean }
);

export function SubmissionNotification(props: SubmissionNotificationProps) {
  const { locale, dict, organizationName, type, reference, adminUrl } = props;
  const t = dict.notification;
  const align = DIR[locale] === 'rtl' ? 'right' : 'left';

  return (
    <Frame locale={locale} preview={`${t.preview} — ${reference}`}>
      <Text style={styles.eyebrow}>{t.eyebrow}</Text>
      <div style={styles.headingMark} />
      <Heading as="h1" style={styles.h1}>
        {props.sensitive ? t.sensitive.heading : t.subject[type]}
      </Heading>

      <Text style={styles.text}>
        {t.reference}: <Latin>{reference}</Latin>
      </Text>

      {props.sensitive ? (
        <Section>
          <Text style={styles.text}>{t.sensitive.body}</Text>
          <Text style={{ ...styles.text, fontWeight: 600 }}>{t.sensitive.doNotForward}</Text>
        </Section>
      ) : (
        <Section>
          <div style={styles.sectionRule} />
          <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{ borderCollapse: 'collapse', fontSize: '14px' }}
          >
            <tbody>
              {props.fields.map((field) => (
                <tr key={field.label} style={{ borderBottom: `1px solid ${tokens.rule}` }}>
                  <th
                    scope="row"
                    align={align}
                    style={{
                      padding: '8px 12px',
                      verticalAlign: 'top',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      color: tokens.ink70,
                      width: '35%',
                    }}
                  >
                    {field.label}
                  </th>
                  <td
                    align={align}
                    style={{ padding: '8px 12px', verticalAlign: 'top', color: tokens.ink }}
                  >
                    {field.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {props.hasAttachment ? (
            <Text style={{ ...styles.muted, marginTop: '12px' }}>{t.hasAttachment}</Text>
          ) : null}
        </Section>
      )}

      <Section>
        <div style={styles.sectionRule} />
        <Text style={styles.text}>
          <Link href={adminUrl} style={styles.link}>
            {t.openInAdmin}
          </Link>
        </Text>
        <Text style={styles.muted}>
          <Latin>{adminUrl}</Latin>
        </Text>
      </Section>

      <Footer>{withOrganization(t.footer, organizationName)}</Footer>
    </Frame>
  );
}

export default SubmissionNotification;
