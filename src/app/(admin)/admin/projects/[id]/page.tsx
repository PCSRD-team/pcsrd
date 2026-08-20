import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ProjectForm } from '@/components/admin/project-form';
import { AdminHeader } from '@/components/admin/shell';
import { TranslationBadge } from '@/components/admin/controls';
import { db } from '@/db';
import { getAdminRow, listRelationOptions } from '@/db/queries/admin';
import { readAsActor } from '@/db/session';
import { projectMedia, projectPartners } from '@/db/schema';
import type { Project } from '@/db/schema/projects';
import { requireAuth } from '@/lib/auth/guard';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import { can } from '@/services/_shared/permissions';
import { translationStatusFrom } from '@/components/admin/bilingual-field';

export const dynamic = 'force-dynamic';

export default async function EditProjectPage({
  params,
  searchParams,
}: PageProps<'/admin/projects/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const row = (await getAdminRow(actor, 'project', id)) as Project | null;
  if (!row) notFound();

  const [programs, partners, links] = await Promise.all([
    listRelationOptions(actor, 'programs'),
    listRelationOptions(actor, 'partners'),
    readAsActor(db, actor, async (tx) => ({
      partners: await tx
        .select({ partnerId: projectPartners.partnerId, role: projectPartners.role })
        .from(projectPartners)
        .where(eq(projectPartners.projectId, id)),
      media: await tx
        .select({ mediaId: projectMedia.mediaId })
        .from(projectMedia)
        .where(eq(projectMedia.projectId, id))
        .orderBy(projectMedia.displayOrder),
    })),
  ]);

  // Derived from what is filled in, not from a field the editor maintains.
  const translation = translationStatusFrom([
    { ar: row.titleAr, en: row.titleEn },
    { ar: row.summaryAr, en: row.summaryEn },
    { ar: row.seoTitleAr, en: row.seoTitleEn },
  ]);

  return (
    <>
      <AdminHeader
        title={row.titleAr}
        description={`آخر تعديل — ${row.updatedAt.toISOString().slice(0, 10)}`}
        action={<TranslationBadge partial={translation.partial} />}
      />

      {search.saved ? (
        <div className="rule-edge mbe-6 border-gold-600 bg-gold-050 p-4" role="status">
          <p className="text-small text-ink">تم الحفظ.</p>
        </div>
      ) : null}

      <ProjectForm
        canPublish={can(actor, 'content.publish')}
        canDelete={can(actor, 'content.delete')}
        values={{
          id: row.id,
          status: row.status,
          titleAr: row.titleAr,
          titleEn: row.titleEn,
          slugAr: row.slugAr,
          slugEn: row.slugEn,
          summaryAr: row.summaryAr,
          summaryEn: row.summaryEn,
          objectiveAr: row.objectiveAr,
          objectiveEn: row.objectiveEn,
          activitiesAr: row.activitiesAr,
          activitiesEn: row.activitiesEn,
          outcomesAr: row.outcomesAr,
          outcomesEn: row.outcomesEn,
          programId: row.programId,
          projectState: row.projectState,
          startDate: row.startDate,
          endDate: row.endDate,
          governorates: row.governorates,
          localities: row.localities,
          themes: row.themes,
          heroMediaId: row.heroMediaId,
          isFeatured: row.isFeatured,
          sourceNote: row.sourceNote,
          seoTitleAr: row.seoTitleAr,
          seoTitleEn: row.seoTitleEn,
          seoDescriptionAr: row.seoDescriptionAr,
          seoDescriptionEn: row.seoDescriptionEn,
          noIndex: row.noIndex,
          implementingPartners: links.partners
            .filter((link) => link.role === 'implementing')
            .map((link) => link.partnerId),
          donors: links.partners
            .filter((link) => link.role === 'donor')
            .map((link) => link.partnerId),
        }}
        options={{
          programs: programs.map((p) => ({ value: p.id, label: p.label })),
          partners: partners.map((p) => ({ value: p.id, label: p.label })),
          governorates: [...ADMIN_OPTIONS.governorate],
          themes: [...ADMIN_OPTIONS.theme],
          states: [...ADMIN_OPTIONS.projectState],
        }}
      />
    </>
  );
}
