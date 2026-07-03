-- R31.4 — flip stock Settings column defaults from SEED/Rutgers to Turgor.
-- Column defaults only: existing rows are NOT touched, so SEED's live
-- deployment keeps the identity stored in its Settings row. New installs
-- (fresh seed / no row yet) render neutral Turgor branding.
ALTER TABLE "Settings" ALTER COLUMN "orgName" SET DEFAULT 'Turgor';
ALTER TABLE "Settings" ALTER COLUMN "orgFullName" SET DEFAULT 'Turgor';
ALTER TABLE "Settings" ALTER COLUMN "orgInstitution" SET DEFAULT '';
ALTER TABLE "Settings" ALTER COLUMN "orgLogoUrl" SET DEFAULT '/turgor-logo.svg';
ALTER TABLE "Settings" ALTER COLUMN "signInLabel" SET DEFAULT 'Email';
