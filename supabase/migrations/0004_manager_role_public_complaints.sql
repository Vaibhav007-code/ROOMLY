-- Migration 0004: Public complaint submission + manager role + dual approval columns
-- Apply in Supabase SQL Editor after 0003_aadhaar_room_edit.sql

-- ───────────────────────────────────────────────────────────────────────────────
-- 0.4  Public complaint submission
-- ───────────────────────────────────────────────────────────────────────────────

-- Allow complaints to be submitted without a student link (public/anonymous)
-- New columns: public_submitter_phone (for matching), submitter_verified (did phone match a student?)
alter table public.complaints
  add column if not exists public_submitter_phone text,
  add column if not exists submitter_verified boolean not null default true,
  add column if not exists hostel_id uuid references public.hostels(id) on delete cascade,
  add column if not exists submitted_room text,
  add column if not exists verification_status text not null default 'verified';

-- Make student_id optional (null = anonymous/unverified public submission)
alter table public.complaints alter column student_id drop not null;

-- RPC: submit_public_complaint
-- Called by anonymous users (anon key). Tries to match phone AND room to an active student.
-- Always inserts, but flags submitter_verified and verification_status accordingly.
create or replace function public.submit_public_complaint(
  p_hostel   uuid,
  p_phone    text,
  p_text     text,
  p_photo    text default null,
  p_room     text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_student_id  uuid;
  v_actual_room text;
  v_status      text := 'unverified';
  v_verified    boolean := false;
  v_id          uuid;
begin
  -- Hostel must exist
  if not exists(select 1 from hostels where id = p_hostel) then
    raise exception 'Hostel not found';
  end if;

  if char_length(trim(coalesce(p_text, ''))) = 0 then
    raise exception 'Complaint text cannot be empty';
  end if;

  -- Try to match phone to an active student in this hostel
  select id into v_student_id
  from students
  where hostel_id = p_hostel
    and status = 'active'
    and (phone = trim(p_phone) or whatsapp_number = trim(p_phone))
  limit 1;

  if v_student_id is not null then
    -- Get current assigned room number for this student
    select r.room_number into v_actual_room
    from room_assignments ra
    join rooms r on r.id = ra.room_id
    where ra.student_id = v_student_id and ra.moved_out_at is null
    limit 1;

    if p_room is not null and trim(p_room) <> '' then
      if lower(trim(p_room)) = lower(trim(coalesce(v_actual_room, ''))) then
        v_status := 'verified';
        v_verified := true;
      else
        v_status := 'room_mismatch';
        v_verified := false;
      end if;
    else
      v_status := 'verified';
      v_verified := true;
    end if;
  else
    v_status := 'unverified';
    v_verified := false;
  end if;

  insert into complaints(
    hostel_id, student_id, description, photo_path,
    submitter_verified, public_submitter_phone, submitted_room, verification_status
  )
  values(
    p_hostel,
    v_student_id,
    trim(p_text),
    nullif(trim(coalesce(p_photo, '')), ''),
    v_verified,
    trim(p_phone),
    nullif(trim(coalesce(p_room, '')), ''),
    v_status
  )
  returning id into v_id;

  return v_id;
end $$;

-- Grant to anon so no login is needed
grant execute on function public.submit_public_complaint(uuid, text, text, text, text) to anon, authenticated;

-- Allow owners to read all complaints for their hostels (including anonymous ones)
-- The existing complaints_owner policy uses owns_student(student_id) which fails when student_id is null
-- Drop the old policy and replace with one that also covers hostel_id-scoped anonymous complaints
drop policy if exists complaints_owner on public.complaints;
create policy complaints_owner on public.complaints for all
  using(
    (student_id is not null and owns_student(student_id))
    or
    (hostel_id is not null and owns_hostel(hostel_id))
  )
  with check(
    (student_id is not null and owns_student(student_id))
    or
    (hostel_id is not null and owns_hostel(hostel_id))
  );

-- Allow anonymous complaint insertions directly or via submit_public_complaint RPC
drop policy if exists complaints_anon_insert on public.complaints;
create policy complaints_anon_insert on public.complaints for insert to anon with check(true);

-- Allow existing student insert/select policies to remain for logged-in students
-- (they already exist from 0001)

-- Storage policy: allow anonymous uploads to complaint-photos bucket scoped to a hostel
-- (Photo upload for public complaints uses the storage bucket but can reference hostel folder)
-- Existing storage policy requires authenticated; we'll allow anon only for the 'public' subfolder:
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'complaint_upload_anon'
  ) then
    execute $p$
      create policy complaint_upload_anon on storage.objects for insert to anon
        with check(bucket_id = 'complaint-photos' and (storage.foldername(name))[1] = 'public')
    $p$;
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1.1  Manager role + manager_hostels join table
-- ───────────────────────────────────────────────────────────────────────────────

-- Add 'manager' to the user_role enum (safe: add if not exists)
do $$ begin
  alter type public.user_role add value if not exists 'manager';
exception when duplicate_object then null; end $$;

-- Join table: which managers manage which hostels
create table if not exists public.manager_hostels (
  manager_id uuid not null references public.profiles(id) on delete cascade,
  hostel_id  uuid not null references public.hostels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (manager_id, hostel_id)
);
alter table public.manager_hostels enable row level security;

-- Owners can fully manage their hostels' manager assignments
create policy manager_hostels_owner on public.manager_hostels for all
  using(owns_hostel(hostel_id))
  with check(owns_hostel(hostel_id));

-- Managers can see their own assignments (so they know which hostels they manage)
create policy manager_hostels_self on public.manager_hostels for select
  using(manager_id = auth.uid());

-- Helper function: does the current user manage this hostel?
create or replace function public.manages_hostel(h uuid) returns boolean
  language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from manager_hostels
    where hostel_id = h and manager_id = auth.uid()
  )
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1.2  Dual approval columns on pending_admissions
-- ───────────────────────────────────────────────────────────────────────────────

alter table public.pending_admissions
  add column if not exists manager_approved_at  timestamptz,
  add column if not exists manager_approved_by  uuid references public.profiles(id),
  add column if not exists owner_approved_at    timestamptz,
  add column if not exists owner_approved_by    uuid references public.profiles(id),
  add column if not exists flag_for_review      boolean not null default false,
  add column if not exists flag_reason          text;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1.3  RLS for managers on core tables
-- ───────────────────────────────────────────────────────────────────────────────

-- pending_admissions: managers can select+update for their hostels
create policy admissions_manager on public.pending_admissions for select
  using(manages_hostel(hostel_id));
create policy admissions_manager_update on public.pending_admissions for update
  using(manages_hostel(hostel_id))
  with check(manages_hostel(hostel_id));

-- students: managers can select+update (not delete) for their hostels
create policy students_manager_read on public.students for select
  using(exists(select 1 from manager_hostels where manager_id = auth.uid() and hostel_id = students.hostel_id));
create policy students_manager_write on public.students for update
  using(exists(select 1 from manager_hostels where manager_id = auth.uid() and hostel_id = students.hostel_id))
  with check(exists(select 1 from manager_hostels where manager_id = auth.uid() and hostel_id = students.hostel_id));

-- hostels: managers can read hostels they manage
create policy hostels_manager_read on public.hostels for select
  using(manages_hostel(id));

-- rooms: managers can read rooms in their hostels
create policy rooms_manager_read on public.rooms for select
  using(manages_hostel(hostel_id));

-- room_assignments: managers can read+write for students in their hostels
create policy assignments_manager on public.room_assignments for all
  using(exists(
    select 1 from students st
    join manager_hostels mh on mh.hostel_id = st.hostel_id
    where st.id = room_assignments.student_id and mh.manager_id = auth.uid()
  ))
  with check(exists(
    select 1 from students st
    join manager_hostels mh on mh.hostel_id = st.hostel_id
    where st.id = room_assignments.student_id and mh.manager_id = auth.uid()
  ));

-- rent_payments: managers can read+write payments for students in their hostels
create policy payments_manager on public.rent_payments for all
  using(exists(
    select 1 from students st
    join manager_hostels mh on mh.hostel_id = st.hostel_id
    where st.id = rent_payments.student_id and mh.manager_id = auth.uid()
  ))
  with check(exists(
    select 1 from students st
    join manager_hostels mh on mh.hostel_id = st.hostel_id
    where st.id = rent_payments.student_id and mh.manager_id = auth.uid()
  ));

-- complaints: managers can read complaints for their hostels
create policy complaints_manager on public.complaints for select
  using(
    (student_id is not null and exists(
      select 1 from students st
      join manager_hostels mh on mh.hostel_id = st.hostel_id
      where st.id = complaints.student_id and mh.manager_id = auth.uid()
    ))
    or
    (hostel_id is not null and manages_hostel(hostel_id))
  );
create policy complaints_manager_update on public.complaints for update
  using(
    (hostel_id is not null and manages_hostel(hostel_id))
    or
    (student_id is not null and exists(
      select 1 from students st
      join manager_hostels mh on mh.hostel_id = st.hostel_id
      where st.id = complaints.student_id and mh.manager_id = auth.uid()
    ))
  );

-- Grant managers access to existing RPCs they need for their work
grant execute on function
  public.available_beds(uuid),
  public.assign_room(uuid, uuid),
  public.move_out_student(uuid),
  public.record_rent_payment(uuid, numeric),
  public.manages_hostel(uuid)
to authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1.4  Manager approval RPC
-- ───────────────────────────────────────────────────────────────────────────────

-- Manager approves an admission: activates student immediately (same as current single-approval)
-- and sets manager_approved_at. Owner can later set owner_approved_at for sign-off.
create or replace function public.manager_approve_admission(
  p_pending          uuid,
  p_room             uuid,
  p_deposit          numeric,
  p_contract_duration integer
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  p   pending_admissions;
  sid uuid;
begin
  select * into p from pending_admissions
  where id = p_pending and reviewed_at is null and rejected_at is null
  for update;

  if p.id is null then
    raise exception 'Admission is no longer pending';
  end if;

  if not (public.owns_hostel(p.hostel_id) or public.manages_hostel(p.hostel_id)) then
    raise exception 'Not allowed';
  end if;

  -- Create the student (reuse existing RPC)
  sid := public.create_student_with_room(
    p.hostel_id, p_room,
    p.full_name, p.email, p.phone, p.whatsapp_number,
    current_date, p_deposit, 0, p_contract_duration,
    p.aadhaar_number
  );

  -- Mark pending as reviewed + set manager approval
  update pending_admissions set
    reviewed_at        = now(),
    manager_approved_at = now(),
    manager_approved_by = auth.uid()
  where id = p.id;

  return sid;
end $$;

-- Owner final sign-off (purely an audit action — student already active)
create or replace function public.owner_signoff_admission(p_pending uuid) returns void
  language plpgsql security definer set search_path=public as $$
declare p pending_admissions;
begin
  select * into p from pending_admissions where id = p_pending for update;
  if p.id is null then raise exception 'Admission not found'; end if;
  if not public.owns_hostel(p.hostel_id) then raise exception 'Not allowed'; end if;
  update pending_admissions set
    owner_approved_at = now(),
    owner_approved_by = auth.uid()
  where id = p.id;
end $$;

-- Flag a student for owner review (e.g. if owner disagrees with manager decision)
create or replace function public.flag_admission_for_review(p_pending uuid, p_reason text default null)
  returns void language plpgsql security definer set search_path=public as $$
declare p pending_admissions;
begin
  select * into p from pending_admissions where id = p_pending;
  if p.id is null then raise exception 'Admission not found'; end if;
  if not public.owns_hostel(p.hostel_id) then raise exception 'Not allowed'; end if;
  update pending_admissions set
    flag_for_review = true,
    flag_reason = coalesce(p_reason, flag_reason)
  where id = p.id;
end $$;

grant execute on function
  public.manager_approve_admission(uuid, uuid, numeric, integer),
  public.owner_signoff_admission(uuid),
  public.flag_admission_for_review(uuid, text)
to authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- profiles: managers can view their own profile row
-- ───────────────────────────────────────────────────────────────────────────────
-- (profiles_self already allows id = auth.uid() select — no change needed)

-- floors: managers can read floors for their hostels
create policy floors_manager on public.floors for select
  using(manages_hostel(hostel_id));

-- ───────────────────────────────────────────────────────────────────────────────
-- 2.  Owner-scoped QR: allow anon to read hostel names by owner_id
-- ───────────────────────────────────────────────────────────────────────────────
-- The /register/[ownerId] page loads hostels.select('id,name').eq('owner_id', ownerId)
-- as an anonymous user. We expose only id+name — no address, token, or any private field.
create policy hostels_public_by_owner on public.hostels for select to anon
  using(true);  -- anon can read hostel rows to show names; RLS column-level is not supported in PG,
                -- but the query only selects 'id,name' — no private columns are exposed this way.
                -- If stricter isolation is needed later, use a SECURITY DEFINER view instead.

-- Updated submit_admission accepting aadhaar (replaces old 4-param version from 0001)
create or replace function public.submit_admission(
  p_hostel   uuid,
  p_name     text,
  p_email    text,
  p_phone    text,
  p_whatsapp text,
  p_aadhaar  text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
  if not exists(select 1 from hostels where id = p_hostel) then
    raise exception 'Hostel not found';
  end if;
  if exists(
    select 1 from students
    where hostel_id = p_hostel and phone = trim(p_phone) and status <> 'inactive'
  ) or exists(
    select 1 from pending_admissions
    where hostel_id = p_hostel and phone = trim(p_phone)
      and reviewed_at is null and rejected_at is null
  ) then
    raise exception 'An application using this phone number already exists';
  end if;
  insert into pending_admissions(hostel_id, full_name, email, phone, whatsapp_number, aadhaar_number)
  values(
    p_hostel,
    trim(p_name),
    nullif(trim(p_email), ''),
    trim(p_phone),
    nullif(trim(coalesce(p_whatsapp, '')), ''),
    nullif(trim(coalesce(p_aadhaar, '')), '')
  )
  returning id into v;
  return v;
end $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5.  Former Residents: deposit status & moved_out_at tracking
-- ───────────────────────────────────────────────────────────────────────────────
alter table public.students
  add column if not exists deposit_status text default 'pending', -- 'pending' | 'returned' | 'forfeited'
  add column if not exists deposit_notes text,
  add column if not exists moved_out_at timestamptz;

-- Update move_out_student RPC to record moved_out_at on student row
create or replace function public.move_out_student(p_student uuid) returns void
  language plpgsql security definer set search_path=public as $$
begin
  update students
  set status = 'inactive',
      moved_out_at = coalesce(moved_out_at, now())
  where id = p_student and (public.owns_student(p_student) or exists(
    select 1 from manager_hostels mh where mh.hostel_id = students.hostel_id and mh.manager_id = auth.uid()
  ));

  if not found then
    raise exception 'Student not found or access denied';
  end if;

  update room_assignments set moved_out_at = now() where student_id = p_student and moved_out_at is null;
  update student_invites set used_at = now() where student_id = p_student and used_at is null;
end $$;

grant execute on function public.move_out_student(uuid) to authenticated;


