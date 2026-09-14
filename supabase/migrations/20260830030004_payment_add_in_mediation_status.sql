-- Add 'in_mediation' to the allowed payment statuses for dispute handling.

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN (
    'pending', 'prepared', 'processing', 'requires_action', 'completed',
    'failed', 'cancelled', 'partially_refunded', 'refunded', 'charged_back',
    'in_mediation'
  ));
