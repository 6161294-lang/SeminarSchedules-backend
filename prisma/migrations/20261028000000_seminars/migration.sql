-- סמינר: מרחב נתונים מבודד לכל מזכירה
CREATE TABLE "seminars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seminars_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "seminarId" UUID;
ALTER TABLE "classes" ADD COLUMN "seminarId" UUID;
ALTER TABLE "subjects" ADD COLUMN "seminarId" UUID;

-- נתונים קיימים משויכים לסמינר ברירת מחדל אחד
DO $$
DECLARE default_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM "users") OR EXISTS (SELECT 1 FROM "classes") OR EXISTS (SELECT 1 FROM "subjects") THEN
    INSERT INTO "seminars" ("name") VALUES ('הסמינר שלי') RETURNING "id" INTO default_id;
    UPDATE "users" SET "seminarId" = default_id;
    UPDATE "classes" SET "seminarId" = default_id;
    UPDATE "subjects" SET "seminarId" = default_id;
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "seminarId" SET NOT NULL;
ALTER TABLE "classes" ALTER COLUMN "seminarId" SET NOT NULL;
ALTER TABLE "subjects" ALTER COLUMN "seminarId" SET NOT NULL;

DROP INDEX "classes_name_key";
DROP INDEX "subjects_name_key";
CREATE UNIQUE INDEX "classes_seminarId_name_key" ON "classes"("seminarId", "name");
CREATE UNIQUE INDEX "subjects_seminarId_name_key" ON "subjects"("seminarId", "name");
CREATE INDEX "users_seminarId_idx" ON "users"("seminarId");

ALTER TABLE "users" ADD CONSTRAINT "users_seminarId_fkey" FOREIGN KEY ("seminarId") REFERENCES "seminars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classes" ADD CONSTRAINT "classes_seminarId_fkey" FOREIGN KEY ("seminarId") REFERENCES "seminars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_seminarId_fkey" FOREIGN KEY ("seminarId") REFERENCES "seminars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
