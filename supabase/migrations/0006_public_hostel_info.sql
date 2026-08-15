-- Migration 0006: Secure RPC for public hostel info lookup
-- Used by /register/[id] for unauthenticated visitors without exposing internal table fields or other owners' data.

create or replace function public.get_public_hostel_info(p_id uuid)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
begin
  -- Check if p_id is a specific hostel_id
  if exists (select 1 from hostels where hostels.id = p_id) then
    return query
      select hostels.id, hostels.name
      from hostels
      where hostels.id = p_id;
  else
    -- Return hostels belonging to owner_id = p_id
    return query
      select hostels.id, hostels.name
      from hostels
      where hostels.owner_id = p_id
      order by hostels.name;
  end if;
end;
$$;

grant execute on function public.get_public_hostel_info(uuid) to anon, authenticated;
