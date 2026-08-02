-- Migration: Signing token security hardening
-- Adds partial index for fast active-token lookups and an expiry function
-- for periodic cleanup of stale tokens.

-- Partial index: only index tokens that are still active (lookupable).
-- This makes hash lookups faster and excludes consumed/expired tokens from the index.
CREATE INDEX IF NOT EXISTS idx_signing_tokens_active
  ON public.signing_tokens (token_hash)
  WHERE status IN ('pending', 'otp_verified', 'account_created', 'claiming');

-- Function to expire tokens that have passed their expires_at timestamp.
-- Should be called periodically via pg_cron or an Edge Function.
CREATE OR REPLACE FUNCTION public.expire_signing_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE public.signing_tokens
  SET status = 'expired'
  WHERE status IN ('pending', 'otp_verified')
    AND expires_at < now();

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- Grant execute to service_role only (not anon or authenticated)
REVOKE ALL ON FUNCTION public.expire_signing_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_signing_tokens() TO service_role;

-- Optional: schedule with pg_cron if the extension is available.
-- Uncomment the following line after enabling pg_cron in Supabase dashboard:
-- SELECT cron.schedule('expire-signing-tokens', '0 * * * *', 'SELECT public.expire_signing_tokens()');
