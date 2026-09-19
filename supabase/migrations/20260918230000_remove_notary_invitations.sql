-- VeraDoc has one exclusive, operationally provisioned notary account.
-- The application release that removes invitation functionality must be
-- deployed and verified before this forward-only schema removal is applied.

do $$
begin
  if exists (
    select 1
    from public.invitations
    where status = 'pending'
  ) then
    raise exception 'Cannot remove notary invitation support while pending invitations exist';
  end if;
end
$$;

drop function public.lookup_invitation(text);
drop table public.invitations;
alter table public.profiles drop column invited_by;
