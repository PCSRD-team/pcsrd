import { OrganizationForm } from '@/components/admin/organization-form';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminOrganization } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'بيانات المؤسسة' };

/**
 * Organisation settings.
 *
 * This route was in the primary nav (`shell.tsx`) with an **empty** directory
 * behind it, so it 404ed — the only screen the nav promised and did not
 * deliver. `getAdminOrganization` and `saveOrganization` both existed and had
 * no callers, which made the feature look implemented in a file listing.
 *
 * It matters more than a missing CRUD screen usually would: `scripts/seed.ts`
 * writes `TODO(org):` placeholders and documents *this page* as where they get
 * replaced. Without it those placeholders render in the live homepage `<title>`
 * and the only way to change them is SQL against production.
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

  return (
    <>
      <AdminHeader
        title="بيانات المؤسسة"
        description="كل ما يعرضه الموقع عن المؤسسة يُقرأ من هنا، لا من الشيفرة."
      />

      {settings ? (
        <OrganizationForm values={settings} />
      ) : (
        <div className="rule-edge border-gold-600 bg-gold-050 p-6">
          <p className="text-small font-medium text-ink">لا يوجد سجل إعدادات.</p>
          <p className="mbs-2 text-caption text-ink-70">
            الجدول مفرد ويُنشأ في <code dir="ltr">scripts/seed.ts</code>. إن كان فارغاً فالبذرة لم
            تُنفَّذ على قاعدة البيانات هذه.
          </p>
        </div>
      )}
    </>
  );
}
