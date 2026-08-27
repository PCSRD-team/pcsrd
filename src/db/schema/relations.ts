import { relations } from 'drizzle-orm';
import { auditLogs } from './audit';
import { mediaAssets } from './media';
import { impactMetrics } from './metrics';
import { organizationSettings } from './organization';
import { pages } from './pages';
import { partners } from './partners';
import { people } from './people';
import { postMedia, posts } from './posts';
import { profiles } from './profiles';
import { programMedia, programs } from './programs';
import { projectMedia, projectPartners, projects } from './projects';
import { publications } from './publications';
import { stories, storyMedia } from './stories';
import { formSubmissions } from './submissions';
import { vacancies } from './vacancies';

/**
 * Every `relations()` in one file.
 *
 * This is not tidiness. It is the fix for the circular import that appears the
 * moment `projects` references `partners` and `partners` references `projects`.
 * Table definitions import only downward; relations, which are inherently
 * bidirectional, live here where nothing imports them back.
 *
 * `relationName` is set on every media reference because several tables point
 * at `media_assets` more than once (hero and OG image, two publication files).
 * Without it Drizzle cannot tell which foreign key a relation belongs to.
 */

export const profilesRelations = relations(profiles, ({ many }) => ({
  auditEntries: many(auditLogs),
  uploadedMedia: many(mediaAssets),
  handledSubmissions: many(formSubmissions),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one, many }) => ({
  uploader: one(profiles, {
    fields: [mediaAssets.createdBy],
    references: [profiles.id],
  }),
  projectLinks: many(projectMedia),
  storyLinks: many(storyMedia),
  programLinks: many(programMedia),
  postLinks: many(postMedia),
}));

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    logoPrimary: one(mediaAssets, {
      fields: [organizationSettings.logoPrimaryId],
      references: [mediaAssets.id],
      relationName: 'org_logo_primary',
    }),
    footerLogo: one(mediaAssets, {
      fields: [organizationSettings.footerLogoId],
      references: [mediaAssets.id],
      relationName: 'org_footer_logo',
    }),
    logoMono: one(mediaAssets, {
      fields: [organizationSettings.logoMonoId],
      references: [mediaAssets.id],
      relationName: 'org_logo_mono',
    }),
    defaultOg: one(mediaAssets, {
      fields: [organizationSettings.defaultOgId],
      references: [mediaAssets.id],
      relationName: 'org_default_og',
    }),
  }),
);

export const programsRelations = relations(programs, ({ one, many }) => ({
  hero: one(mediaAssets, {
    fields: [programs.heroMediaId],
    references: [mediaAssets.id],
    relationName: 'program_hero',
  }),
  ogMedia: one(mediaAssets, {
    fields: [programs.ogMediaId],
    references: [mediaAssets.id],
    relationName: 'program_og',
  }),
  projects: many(projects),
  stories: many(stories),
  posts: many(posts),
  metrics: many(impactMetrics),
  media: many(programMedia),
}));

export const programMediaRelations = relations(programMedia, ({ one }) => ({
  program: one(programs, {
    fields: [programMedia.programId],
    references: [programs.id],
  }),
  media: one(mediaAssets, {
    fields: [programMedia.mediaId],
    references: [mediaAssets.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  program: one(programs, {
    fields: [projects.programId],
    references: [programs.id],
  }),
  hero: one(mediaAssets, {
    fields: [projects.heroMediaId],
    references: [mediaAssets.id],
    relationName: 'project_hero',
  }),
  ogMedia: one(mediaAssets, {
    fields: [projects.ogMediaId],
    references: [mediaAssets.id],
    relationName: 'project_og',
  }),
  partnerLinks: many(projectPartners),
  media: many(projectMedia),
  stories: many(stories),
  posts: many(posts),
  metrics: many(impactMetrics),
}));

export const projectPartnersRelations = relations(projectPartners, ({ one }) => ({
  project: one(projects, {
    fields: [projectPartners.projectId],
    references: [projects.id],
  }),
  partner: one(partners, {
    fields: [projectPartners.partnerId],
    references: [partners.id],
  }),
}));

export const projectMediaRelations = relations(projectMedia, ({ one }) => ({
  project: one(projects, {
    fields: [projectMedia.projectId],
    references: [projects.id],
  }),
  media: one(mediaAssets, {
    fields: [projectMedia.mediaId],
    references: [mediaAssets.id],
  }),
}));

export const partnersRelations = relations(partners, ({ one, many }) => ({
  logo: one(mediaAssets, {
    fields: [partners.logoMediaId],
    references: [mediaAssets.id],
    relationName: 'partner_logo',
  }),
  projectLinks: many(projectPartners),
}));

export const impactMetricsRelations = relations(impactMetrics, ({ one }) => ({
  program: one(programs, {
    fields: [impactMetrics.programId],
    references: [programs.id],
  }),
  project: one(projects, {
    fields: [impactMetrics.projectId],
    references: [projects.id],
  }),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  program: one(programs, {
    fields: [stories.programId],
    references: [programs.id],
  }),
  project: one(projects, {
    fields: [stories.projectId],
    references: [projects.id],
  }),
  hero: one(mediaAssets, {
    fields: [stories.heroMediaId],
    references: [mediaAssets.id],
    relationName: 'story_hero',
  }),
  ogMedia: one(mediaAssets, {
    fields: [stories.ogMediaId],
    references: [mediaAssets.id],
    relationName: 'story_og',
  }),
  media: many(storyMedia),
}));

export const storyMediaRelations = relations(storyMedia, ({ one }) => ({
  story: one(stories, {
    fields: [storyMedia.storyId],
    references: [stories.id],
  }),
  media: one(mediaAssets, {
    fields: [storyMedia.mediaId],
    references: [mediaAssets.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  program: one(programs, {
    fields: [posts.programId],
    references: [programs.id],
  }),
  project: one(projects, {
    fields: [posts.projectId],
    references: [projects.id],
  }),
  hero: one(mediaAssets, {
    fields: [posts.heroMediaId],
    references: [mediaAssets.id],
    relationName: 'post_hero',
  }),
  ogMedia: one(mediaAssets, {
    fields: [posts.ogMediaId],
    references: [mediaAssets.id],
    relationName: 'post_og',
  }),
  media: many(postMedia),
}));

export const postMediaRelations = relations(postMedia, ({ one }) => ({
  post: one(posts, { fields: [postMedia.postId], references: [posts.id] }),
  media: one(mediaAssets, {
    fields: [postMedia.mediaId],
    references: [mediaAssets.id],
  }),
}));

export const vacanciesRelations = relations(vacancies, ({ one }) => ({
  ogMedia: one(mediaAssets, {
    fields: [vacancies.ogMediaId],
    references: [mediaAssets.id],
    relationName: 'vacancy_og',
  }),
}));

export const peopleRelations = relations(people, ({ one }) => ({
  photo: one(mediaAssets, {
    fields: [people.photoMediaId],
    references: [mediaAssets.id],
    relationName: 'person_photo',
  }),
}));

export const publicationsRelations = relations(publications, ({ one }) => ({
  fileAr: one(mediaAssets, {
    fields: [publications.fileArId],
    references: [mediaAssets.id],
    relationName: 'publication_file_ar',
  }),
  fileEn: one(mediaAssets, {
    fields: [publications.fileEnId],
    references: [mediaAssets.id],
    relationName: 'publication_file_en',
  }),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  ogMedia: one(mediaAssets, {
    fields: [pages.ogMediaId],
    references: [mediaAssets.id],
    relationName: 'page_og',
  }),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  handler: one(profiles, {
    fields: [formSubmissions.handledBy],
    references: [profiles.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(profiles, {
    fields: [auditLogs.actorId],
    references: [profiles.id],
  }),
}));
