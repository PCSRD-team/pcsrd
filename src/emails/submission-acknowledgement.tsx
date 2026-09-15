import { Heading, Section, Text } from '@react-email/components';
import type { Locale } from '@/lib/i18n/config';
import { type MailDict, withOrganization } from '@/lib/i18n/mail-dict';
import { Footer, Frame, Latin, styles } from './_shared';

export type SubmissionAcknowledgementProps = {
  locale: Locale;
  dict: MailDict;
  organizationName: string;
  reference: string;
};

/**
 * The visitor's acknowledgement.
 *
 * Bilingual by `locale`, one language per message — the visitor chose it when
 * they chose the form. It carries the reference and nothing the visitor wrote:
 * echoing a message back to the address that sent it is how a form becomes a
 * relay for spam, and the sender already has their own words.
 *
 * `send.ts` never renders this for a confidential submission. The template
 * cannot enforce that (it does not know what kind of submission it is) and
 * deliberately does not try; the gate is in one place.
 */
export function SubmissionAcknowledgement({
  locale,
  dict,
  organizationName,
  reference,
}: SubmissionAcknowledgementProps) {
  const t = dict.acknowledgement;
  return (
    <Frame locale={locale} preview={t.preview}>
      <div style={styles.headingMark} />
      <Heading as="h1" style={styles.h1}>
        {t.greeting}
      </Heading>
      <Section>
        <Text style={styles.text}>{withOrganization(t.received, organizationName)}</Text>
        <Text style={styles.text}>
          {t.referenceIntro} <Latin>{reference}</Latin>
        </Text>
        <Text style={styles.text}>{t.keepReference}</Text>
      </Section>
      <Section>
        <div style={styles.edgeRule} />
        <Text style={styles.muted}>{t.noReply}</Text>
      </Section>
      <Footer>{withOrganization(t.footer, organizationName)}</Footer>
    </Frame>
  );
}

export default SubmissionAcknowledgement;
