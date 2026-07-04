-- R32.4 — theme system v2 drops the R29.2 custom color picker. The free-form
-- Settings.customColors JSON is no longer read (getOrgSettings maps any legacy
-- "custom" themePreset to the forest family at read time), so the column is
-- removed. themePreset stays; a stored "custom" value is harmless (normalized
-- on read). IF EXISTS keeps this idempotent across partially-migrated dev DBs.
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "customColors";
