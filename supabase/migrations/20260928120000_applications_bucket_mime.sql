-- The `applications` bucket, widened to what the careers portal accepts.
--
-- 20260914120000 wrote the bucket for the one job-application form, which only
-- ever takes a CV: PDF and Word. The careers portal stores its attachments in
-- the same bucket and also accepts RTF, a photograph (`image`, and `scan` for
-- an ID card or a certificate photographed with a phone) and a ZIP for a
-- portfolio (`src/lib/applications/attachments.ts`). With the old list, every
-- one of those passed the application's own validation and was then refused by
-- Storage, so the applicant read "upload failed" for a file that was fine.
--
-- The list below is the union of `DOCUMENT_MIME`, `IMAGE_MIME` and
-- `ARCHIVE_MIME` in that file — change both or neither. The application still
-- decides per field which of these a given question accepts; this is only the
-- outer wall. The size limit is unchanged.

update storage.buckets
   set allowed_mime_types = array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/rtf',
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/avif',
         'application/zip'
       ]
 where id = 'applications';
