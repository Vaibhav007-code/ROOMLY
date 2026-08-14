-- Apply after 0001_hostel_flow.sql. The application API is the only admission entrypoint;
-- the old approve_admission RPC is retained only for backwards-compatible installations.
alter table public.pending_admissions add column if not exists rejection_reason text;
alter table public.rent_payments add column if not exists reminder_flagged_at timestamptz;
create table if not exists public.student_invites (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  code text not null unique, expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now()
);
alter table public.student_invites enable row level security;
create policy student_invites_owner on public.student_invites for all using (owns_student(student_id)) with check (owns_student(student_id));

-- Performance Indexes for RLS policies & Foreign Key lookups
create index if not exists idx_hostels_owner_id on public.hostels(owner_id);
create index if not exists idx_rooms_hostel_id on public.rooms(hostel_id);
create index if not exists idx_students_owner_id on public.students(owner_id);
create index if not exists idx_students_hostel_id on public.students(hostel_id);
create index if not exists idx_room_assignments_student_id on public.room_assignments(student_id);
create index if not exists idx_room_assignments_room_id on public.room_assignments(room_id);
create index if not exists idx_rent_payments_student_id on public.rent_payments(student_id);
create index if not exists idx_complaints_student_id on public.complaints(student_id);

create or replace function public.available_beds(room uuid) returns integer language sql stable security definer set search_path=public as $$
  select r.bed_capacity - count(distinct s.id)::integer
  from rooms r
  left join room_assignments a on a.room_id = r.id and a.moved_out_at is null
  left join students s on s.id = a.student_id and s.status = 'active'
  where r.id = room
  group by r.id, r.bed_capacity;
$$;

create or replace function public.room_availability(p_room uuid) returns table(total_beds integer, occupied_beds integer, available_beds integer)
language sql stable security definer set search_path=public as $$
  select r.bed_capacity, r.bed_capacity-public.available_beds(r.id), public.available_beds(r.id) from rooms r where r.id=p_room
$$;

create or replace function public.assign_room(p_student uuid,p_room uuid) returns void language plpgsql security definer set search_path=public as $$
declare target_owner uuid;
begin
 select owner_id into target_owner from students where id=p_student;
 if target_owner is null or target_owner<>auth.uid() or not exists(select 1 from rooms r join hostels h on h.id=r.hostel_id where r.id=p_room and h.owner_id=auth.uid()) then raise exception 'Not allowed'; end if;
 perform 1 from rooms where id=p_room for update;
 if public.available_beds(p_room)<=0 then raise exception 'Room is full'; end if;
 update room_assignments set moved_out_at=now() where student_id=p_student and moved_out_at is null;
 insert into room_assignments(student_id,room_id) values(p_student,p_room);
end $$;

create or replace function public.create_student_with_room(p_hostel uuid,p_room uuid,p_name text,p_email text,p_phone text,p_whatsapp text,p_admission_date date,p_deposit numeric,p_deposit_duration integer,p_contract_duration integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  if not public.owns_hostel(p_hostel) then raise exception 'Not allowed'; end if;
  if not exists(select 1 from rooms where id=p_room and hostel_id=p_hostel) then raise exception 'Choose a room in this hostel'; end if;
  if exists(select 1 from students where owner_id=auth.uid() and phone=trim(p_phone)) then raise exception 'A student with this phone number already exists'; end if;
  insert into students(owner_id,hostel_id,full_name,email,phone,whatsapp_number,admission_date,security_deposit,deposit_duration_months,contract_duration_months,status)
  values(auth.uid(),p_hostel,trim(p_name),nullif(trim(p_email),''),trim(p_phone),coalesce(nullif(trim(p_whatsapp),''),trim(p_phone)),coalesce(p_admission_date,current_date),coalesce(p_deposit,0),coalesce(p_deposit_duration,0),coalesce(p_contract_duration,11),'active') returning id into sid;
  perform public.assign_room(sid,p_room); return sid;
exception when others then raise; end $$;

create or replace function public.approve_admission_via_api(p_pending uuid,p_room uuid,p_deposit numeric,p_deposit_duration integer,p_contract_duration integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare p pending_admissions; sid uuid;
begin
  select * into p from pending_admissions where id=p_pending and reviewed_at is null and rejected_at is null for update;
  if p.id is null or not public.owns_hostel(p.hostel_id) then raise exception 'Admission is no longer pending or you do not have access'; end if;
  if exists(select 1 from students where owner_id=auth.uid() and phone=p.phone) then raise exception 'A student with this phone number already exists'; end if;
  sid:=public.create_student_with_room(p.hostel_id,p_room,p.full_name,p.email,p.phone,p.whatsapp_number,current_date,p_deposit,p_deposit_duration,p_contract_duration);
  update pending_admissions set reviewed_at=now() where id=p.id; return sid;
end $$;

create or replace function public.reject_admission(p_pending uuid,p_reason text default null) returns void language plpgsql security definer set search_path=public as $$
begin update pending_admissions set rejected_at=now(), rejection_reason=nullif(trim(p_reason),'') where id=p_pending and reviewed_at is null and rejected_at is null and public.owns_hostel(hostel_id); if not found then raise exception 'Admission is no longer pending or you do not have access'; end if; end $$;

create or replace function public.record_rent_payment(p_payment uuid,p_amount numeric) returns void language plpgsql security definer set search_path=public as $$
declare due numeric; paid numeric; total numeric;
begin
  select amount_due,amount_paid into due,paid from rent_payments where id=p_payment and owns_student(student_id) for update;
  if not found then raise exception 'Payment not found'; end if;
  if paid>=due then return; end if;
  if p_amount<=0 then raise exception 'Payment amount must be positive'; end if;
  total:=least(due,paid+p_amount);
  update rent_payments set amount_paid=total,paid_at=case when total>=due then now() else paid_at end,status=case when total>=due then 'paid'::payment_status else 'partial'::payment_status end where id=p_payment;
end $$;

create or replace function public.generate_rent_period(p_period date,p_due_date date default null) returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  insert into rent_payments(student_id,period,amount_due,due_date,status)
  select s.id,date_trunc('month',p_period)::date,r.rent_amount,coalesce(p_due_date,(date_trunc('month',p_period)::date+interval '4 days')::date),'due'
  from students s join room_assignments a on a.student_id=s.id and a.moved_out_at is null join rooms r on r.id=a.room_id
  where s.owner_id=auth.uid() and s.status='active' on conflict(student_id,period) do nothing;
  get diagnostics n=row_count; return n;
end $$;

create or replace function public.move_out_student(p_student uuid) returns void language plpgsql security definer set search_path=public as $$
begin update students set status='inactive' where id=p_student and owner_id=auth.uid(); if not found then raise exception 'Student not found'; end if; update room_assignments set moved_out_at=now() where student_id=p_student and moved_out_at is null; update student_invites set used_at=now() where student_id=p_student and used_at is null; end $$;

create or replace function public.can_delete_hostel(p_hostel uuid) returns boolean language sql stable security definer set search_path=public as $$select public.owns_hostel(p_hostel) and not exists(select 1 from students where hostel_id=p_hostel and status='active')$$;
create or replace function public.delete_hostel_safely(p_hostel uuid) returns void language plpgsql security definer set search_path=public as $$begin if not public.can_delete_hostel(p_hostel) then raise exception 'Move out all active students before deleting this hostel'; end if; delete from hostels where id=p_hostel; end $$;

grant execute on function public.room_availability(uuid), public.create_student_with_room(uuid,uuid,text,text,text,text,date,numeric,integer,integer), public.approve_admission_via_api(uuid,uuid,numeric,integer,integer), public.reject_admission(uuid,text), public.record_rent_payment(uuid,numeric), public.generate_rent_period(date,date), public.move_out_student(uuid), public.delete_hostel_safely(uuid) to authenticated;
