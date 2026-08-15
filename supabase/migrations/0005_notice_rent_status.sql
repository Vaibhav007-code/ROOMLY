-- Migration 0005: Notice Period, Security Settlement & Public Complaint Room Verification
-- Idempotent & safe to re-apply

-- 1. Complaints room verification & submitter phone
alter table public.complaints
  add column if not exists public_submitter_phone text,
  add column if not exists submitter_verified boolean not null default true,
  add column if not exists hostel_id uuid references public.hostels(id) on delete cascade,
  add column if not exists submitted_room text,
  add column if not exists verification_status text not null default 'verified';

alter table public.complaints alter column student_id drop not null;

-- RPC: submit_public_complaint (Idempotent update)
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
  if not exists(select 1 from hostels where id = p_hostel) then
    raise exception 'Hostel not found';
  end if;

  if char_length(trim(coalesce(p_text, ''))) = 0 then
    raise exception 'Complaint text cannot be empty';
  end if;

  select id into v_student_id
  from students
  where hostel_id = p_hostel
    and status = 'active'
    and (phone = trim(p_phone) or whatsapp_number = trim(p_phone))
  limit 1;

  if v_student_id is not null then
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

grant execute on function public.submit_public_complaint(uuid, text, text, text, text) to anon, authenticated;

-- 2. Students notice period & security deposit settlement columns
alter table public.students
  add column if not exists notice_given_at timestamptz,
  add column if not exists intended_move_out_date date,
  add column if not exists security_settlement text default 'pending', -- 'pending' | 'apply_as_rent' | 'refund' | 'forfeit' | 'applied_as_rent'
  add column if not exists security_settlement_note text;

-- 3. Rent payments settlement tracking column
alter table public.rent_payments
  add column if not exists settled_via text; -- e.g. 'security_deposit', 'upi', 'cash'

-- RPC: apply_security_as_rent
-- Marks current/latest unpaid rent row for a student as paid via security_deposit, or creates one if none exists.
create or replace function public.apply_security_as_rent(p_student uuid) returns void
  language plpgsql security definer set search_path=public as $$
declare
  v_rent_id uuid;
  v_rent_amt numeric;
  v_period date;
  v_due_date date;
begin
  if not (public.owns_student(p_student) or exists(
    select 1 from manager_hostels mh join students s on s.hostel_id = mh.hostel_id
    where s.id = p_student and mh.manager_id = auth.uid()
  )) then
    raise exception 'Access denied';
  end if;

  -- Find open rent payment for current period
  select id, amount_due into v_rent_id, v_rent_amt
  from rent_payments
  where student_id = p_student and status <> 'paid'
  order by due_date desc
  limit 1;

  if v_rent_id is not null then
    update rent_payments set
      amount_paid = v_rent_amt,
      paid_at = now(),
      status = 'paid'::payment_status,
      settled_via = 'security_deposit'
    where id = v_rent_id;
  else
    -- Create current month's rent row as paid via security deposit
    v_period := date_trunc('month', current_date)::date;
    v_due_date := current_date;

    select r.rent_amount into v_rent_amt
    from room_assignments ra
    join rooms r on r.id = ra.room_id
    where ra.student_id = p_student and ra.moved_out_at is null
    limit 1;

    insert into rent_payments(student_id, period, amount_due, amount_paid, due_date, paid_at, status, settled_via)
    values (
      p_student, v_period, coalesce(v_rent_amt, 0), coalesce(v_rent_amt, 0),
      v_due_date, now(), 'paid'::payment_status, 'security_deposit'
    )
    on conflict(student_id, period) do update set
      amount_paid = excluded.amount_due,
      paid_at = now(),
      status = 'paid'::payment_status,
      settled_via = 'security_deposit';
  end if;

  -- Update student deposit status
  update students set
    security_settlement = 'apply_as_rent',
    deposit_status = 'returned',
    security_settlement_note = coalesce(security_settlement_note, 'Applied as last month rent')
  where id = p_student;
end $$;

grant execute on function public.apply_security_as_rent(uuid) to authenticated;
