import { adminUi } from '@/components/admin/admin-ui-dict';
import { OrganizationForm } from '@/components/admin/organization-form';
import { AdminHeader } from '@/components/admin/shell';
import { Notice } from '@/components/ui/notice';
import { getAdminOrganization } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export const metadata = { title: adminUi.organization.title };

/**
 * Organisation settings.
 *
 * `scripts/seed.ts` writes `TODO(org):` placeholders and documents *this
 * page* as where they get replaced. Without it those placeholders render in
 * the live homepage `<title>` and the only way to change them is SQL against
 * production.
 *
 * `org.settings.contact` rather than `org.settings`: a content manager may edit
 * the contact block, and the service refuses the rest per field. Guarding on
 * the stricter capability here would lock them out of the half they are
 * entitled to.
 */
export default async function OrganizationAdminPage() {
  const actor = await requireAuth();
  assertCan(actor, 'org.settings.contact');

  const settings = await getAdminOrganization(actor);
  const t = adminUi.organization;

  return (
    <>
      <AdminHeader title={t.title} description={t.lede} />

      {settings ? (
        <OrganizationForm values={settings} />
      ) : (
        <Notice tone="warning" title={t.missingTitle} live="off">
          {t.missingBody}
        </Notice>
      )}
    </>
  );
}
