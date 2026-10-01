import {
  deleteDonationAccountAction,
  saveDonationAccountAction,
  saveDonationSettingsAction,
} from '@/actions/admin/donations';
import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { adminUi, count } from '@/components/admin/admin-ui-dict';
import {
  DonationAccountForm,
  type DonationAccountValues,
} from '@/components/admin/donation-account-form';
import { DonationSettingsForm } from '@/components/admin/donation-settings-form';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { Badge } from '@/components/ui/badge';
import { Code } from '@/components/ui/bidi';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Cluster, Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Table } from '@/components/ui/table';
import { Caption, Heading } from '@/components/ui/typography';
import { db } from '@/db';
import { requireAuth } from '@/lib/auth/guard';
import { formatIban } from '@/lib/donations/options';
import { can } from '@/services/_shared/permissions';
import { getDonationAdmin } from '@/services/donations/donation.service';

export const dynamic = 'force-dynamic';

const NEW_ACCOUNT: DonationAccountValues = {
  currency: 'ILS',
  bankNameAr: '',
  bankNameEn: null,
  branchAr: null,
  branchEn: null,
  beneficiaryAr: '',
  beneficiaryEn: null,
  accountNumber: '',
  iban: '',
  swift: null,
  sortOrder: 0,
  isActive: true,
};

/**
 * The donate page's settings and the bank accounts it shows.
 *
 * Admin only. A content manager reviews notices but never edits where the
 * money goes; the services refuse them regardless, and this page says so
 * instead of rendering forms whose every save would fail.
 *
 * The account editor is one form for adding and editing: `?edit=<id>`
 * prefills it with that account. A query parameter rather than a route of its
 * own, so the list of accounts stays in view while one is being changed — the
 * reviewer can see the other currencies' IBANs beside the one they are typing.
 */
export default async function DonationSettingsPage({
  searchParams,
}: PageProps<'/admin/donations/settings'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  const t = adminUi.donations;

  if (!can(actor, 'donations.settings')) {
    return (
      <>
        <AdminHeader title={t.settingsTitle} />
        <Notice
          tone="warning"
          title={t.settings.forbiddenTitle}
          live="off"
          actions={
            <ButtonLink href="/admin/donations" tone="secondary" size="sm">
              {t.backToList}
            </ButtonLink>
          }
        >
          {t.settings.forbiddenBody}
        </Notice>
      </>
    );
  }

  const { settings, accounts } = await getDonationAdmin(db, actor);
  const a = t.accounts;
  const dict = adminFormDict();

  const editId = Array.isArray(search.edit) ? search.edit[0] : search.edit;
  const editing = editId ? accounts.find((account) => account.id === editId) : undefined;

  return (
    <>
      <AdminHeader
        title={t.settingsTitle}
        description={t.settings.lede}
        action={
          <ButtonLink href="/admin/donations" tone="quiet">
            {t.backToList}
          </ButtonLink>
        }
      />

      <Flash searchParams={search} />

      <Stack gap={12}>
        <DonationSettingsForm
          action={saveDonationSettingsAction}
          dict={dict}
          values={{
            isEnabled: settings?.isEnabled ?? false,
            introAr: settings?.introAr ?? null,
            introEn: settings?.introEn ?? null,
            iburaqAlias: settings?.iburaqAlias ?? null,
            iburaqQrMediaId: settings?.iburaqQrMediaId ?? null,
            cardPaymentUrl: settings?.cardPaymentUrl ?? null,
            thankYouAr: settings?.thankYouAr ?? null,
            thankYouEn: settings?.thankYouEn ?? null,
            notifyEmails: settings?.notifyEmails ?? [],
          }}
        />

        <section aria-labelledby="donation-accounts">
          <Heading level={2} size="h3" id="donation-accounts">
            {a.title}
          </Heading>
          <Caption className="mbs-1 mbe-6">
            {a.lede} {count(a.count, accounts.length)}.
          </Caption>

          <Table
            caption={a.title}
            captionHidden
            rows={accounts}
            empty={<EmptyState title={a.empty} body={a.emptyBody} />}
            columns={[
              {
                key: 'currency',
                header: a.currency,
                rowHeader: true,
                cell: (row) => (
                  <Cluster gap={2}>
                    <Code>{row.currency}</Code>
                    <span className="text-caption text-ink-55">
                      {t.currencies[row.currency as keyof typeof t.currencies] ?? ''}
                    </span>
                  </Cluster>
                ),
              },
              {
                key: 'bank',
                header: a.bank,
                cell: (row) => (row.branchAr ? `${row.bankNameAr} — ${row.branchAr}` : row.bankNameAr),
              },
              { key: 'beneficiary', header: a.beneficiary, cell: (row) => row.beneficiaryAr },
              {
                key: 'iban',
                header: a.iban,
                cell: (row) => <Code className="whitespace-nowrap">{formatIban(row.iban)}</Code>,
              },
              {
                key: 'state',
                header: a.state,
                cell: (row) =>
                  row.isActive ? (
                    <Badge tone="success">{a.active}</Badge>
                  ) : (
                    <Badge tone="neutral">{a.inactive}</Badge>
                  ),
              },
            ]}
            actionsLabel={adminDict.form.actions}
            actions={(row) => (
              <Cluster gap={2} align="start">
                <ButtonLink
                  href={`/admin/donations/settings?edit=${row.id}#account-form`}
                  tone="quiet"
                  size="sm"
                >
                  {a.edit}
                </ButtonLink>
                {/* Two steps without script: the confirm button is not in the
                    page until the disclosure is opened. */}
                <details>
                  <summary
                    className={buttonClasses({
                      tone: 'secondary',
                      size: 'sm',
                      className: 'cursor-pointer list-none',
                    })}
                  >
                    {a.delete}
                  </summary>
                  <Panel tone="paper" padding="sm" className="mbs-2 max-w-sm border-destructive/40">
                    <Caption>{a.deleteConfirmSentence}</Caption>
                    <form action={deleteDonationAccountAction} className="mbs-3">
                      <input type="hidden" name="id" value={row.id} />
                      <Button type="submit" size="sm" tone="danger">
                        {a.deleteConfirm}
                      </Button>
                    </form>
                  </Panel>
                </details>
              </Cluster>
            )}
          />
        </section>

        <Panel as="section" tone="white" padding="md" id="account-form" labelledBy="account-form-title">
          <Cluster gap={3} justify="between" className="mbe-6">
            <Heading level={2} size="h3" id="account-form-title">
              {editing ? a.editTitle : a.addTitle}
            </Heading>
            {editing ? (
              <ButtonLink href="/admin/donations/settings#account-form" tone="quiet" size="sm">
                {a.cancelEdit}
              </ButtonLink>
            ) : null}
          </Cluster>

          {editId && !editing ? (
            <Notice tone="danger" live="off" className="mbe-6">
              {a.notFound}
            </Notice>
          ) : null}

          <DonationAccountForm
            // A new key per account: switching from one account to another
            // must remount the form, or the inputs keep the first one's values.
            key={editing?.id ?? 'new'}
            action={saveDonationAccountAction}
            dict={dict}
            values={
              editing
                ? {
                    id: editing.id,
                    currency: editing.currency,
                    bankNameAr: editing.bankNameAr,
                    bankNameEn: editing.bankNameEn,
                    branchAr: editing.branchAr,
                    branchEn: editing.branchEn,
                    beneficiaryAr: editing.beneficiaryAr,
                    beneficiaryEn: editing.beneficiaryEn,
                    accountNumber: editing.accountNumber,
                    iban: editing.iban,
                    swift: editing.swift,
                    sortOrder: editing.sortOrder,
                    isActive: editing.isActive,
                  }
                : NEW_ACCOUNT
            }
          />
        </Panel>
      </Stack>
    </>
  );
}
