-- Douyin as third platform. Standalone: a value added to an enum cannot be
-- referenced by DML in the same transaction (PG constraint).
ALTER TYPE "public"."platform" ADD VALUE 'douyin';
