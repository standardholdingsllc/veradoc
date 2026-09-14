-- =============================================================================
-- 00018_packet_document_versioning_cutover.sql
-- Replace the legacy (packet_id, document_type) unique index with versioned
-- and accepted-artifact indexes. Deploy AFTER compatible writers are active.
-- =============================================================================

-- Pre-check: no duplicate (packet_id, document_type, version)
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT packet_id, document_type, version
    FROM public.packet_documents
    GROUP BY packet_id, document_type, version
    HAVING count(*) > 1
  ) dupes;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate (packet_id, document_type, version) rows — remediate before cutover', dup_count;
  END IF;
END $$;

-- Pre-check: every legacy packet/type has exactly one accepted row
DO $$
DECLARE
  multi_accepted integer;
BEGIN
  SELECT count(*) INTO multi_accepted
  FROM (
    SELECT packet_id, document_type
    FROM public.packet_documents
    WHERE status = 'accepted'
    GROUP BY packet_id, document_type
    HAVING count(*) > 1
  ) dupes;
  IF multi_accepted > 0 THEN
    RAISE EXCEPTION 'Found % packet/type combos with multiple accepted rows — remediate before cutover', multi_accepted;
  END IF;
END $$;

-- Drop the legacy unique index
DROP INDEX IF EXISTS public.idx_packet_documents_packet_type;

-- Version-level uniqueness
CREATE UNIQUE INDEX idx_packet_documents_packet_type_version
  ON public.packet_documents(packet_id, document_type, version);

-- At most one accepted artifact per packet/type
CREATE UNIQUE INDEX idx_packet_documents_one_accepted
  ON public.packet_documents(packet_id, document_type)
  WHERE status = 'accepted';
