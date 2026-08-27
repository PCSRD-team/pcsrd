import './scripts/_env';
import { getAdminOrganization } from './src/db/queries/admin';
import { _getOrganization } from './src/db/queries/content';
import type { Actor } from './src/services/_shared/actor';

const actor: Actor = {
  id: '6803f489-4013-4928-89ce-f42391503930',
  role: 'admin',
  canViewSensitive: false,
  isActive: true,
};

async function main() {
  console.log('admin:start');
  const admin = await getAdminOrganization(actor);
  console.log('admin:done');
  console.log('public-ar:start');
  const publicAr = await _getOrganization('ar');
  console.log('public-ar:done');
  console.log('public-en:start');
  const publicEn = await _getOrganization('en');
  console.log('public-en:done');

  console.log(JSON.stringify({
    adminLoaded: Boolean(admin),
    adminLegalNameAr: admin?.legalNameAr,
    adminFoundedYear: admin?.foundedYear,
    adminLicenseNumber: admin?.licenseNumber,
    adminVisionAr: admin?.visionAr,
    adminStrategicObjectiveCount: Array.isArray(admin?.strategicObjectives)
      ? admin.strategicObjectives.length
      : 0,
    publicArLegalName: publicAr?.legalName,
    publicArMission: publicAr?.mission,
    publicArVision: publicAr?.vision,
    publicArStrategicObjectiveCount: Array.isArray(publicAr?.strategicObjectives)
      ? publicAr.strategicObjectives.length
      : 0,
    publicEnLegalName: publicEn?.legalName,
    publicEnMission: publicEn?.mission,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
