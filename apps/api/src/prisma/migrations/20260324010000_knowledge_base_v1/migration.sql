CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "knowledgeBase"
ADD COLUMN "slug" TEXT,
ADD COLUMN "excerpt" TEXT,
ADD COLUMN "status" "KnowledgeBaseStatus",
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "category" TEXT,
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "seoDescription" TEXT;

ALTER TABLE "knowledgeBase"
ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[];

WITH base_slugs AS (
  SELECT
    id,
    COALESCE(
      NULLIF(
        BTRIM(
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(title), '[^a-z0-9]+', '-', 'g'),
            '(^-|-$)',
            '',
            'g'
          )
        ),
        ''
      ),
      'article'
    ) AS base_slug
  FROM "knowledgeBase"
),
ranked_slugs AS (
  SELECT
    id,
    base_slug,
    ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY id) AS slug_rank
  FROM base_slugs
)
UPDATE "knowledgeBase" AS kb
SET
  "slug" = CASE
    WHEN ranked_slugs.slug_rank = 1 THEN ranked_slugs.base_slug
    ELSE ranked_slugs.base_slug || '-' || ranked_slugs.slug_rank
  END,
  "status" = CASE
    WHEN kb."public" THEN 'PUBLISHED'::"KnowledgeBaseStatus"
    ELSE 'DRAFT'::"KnowledgeBaseStatus"
  END,
  "publishedAt" = CASE
    WHEN kb."public" THEN COALESCE(kb."updatedAt", kb."createdAt", NOW())
    ELSE NULL
  END
FROM ranked_slugs
WHERE kb.id = ranked_slugs.id;

ALTER TABLE "knowledgeBase"
ALTER COLUMN "slug" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE UNIQUE INDEX "knowledgeBase_slug_key" ON "knowledgeBase"("slug");
CREATE INDEX "knowledgeBase_status_publishedAt_idx" ON "knowledgeBase"("status", "publishedAt");
CREATE INDEX "knowledgeBase_category_idx" ON "knowledgeBase"("category");
