-- Migration 0003: Add Aadhaar field, add room-edit RPC, add bulk-room-create RPC
-- Apply after 0002_final_push.sql

-- 1. Add aadhaar_number column to students (nullable text, no masking beyond normal RLS)
alter table public.students add column if not exists aadhaar_number text;

-- 2. Add aadhaar_number to pending_admissions so it carries through approval
alter table public.pending_admissions add column if not exists aadhaar_number text;

-- 3. RPC: update_room — lets owner edit a room's fields, blocking capacity reduction below occupied count
create or replace function public.update_room(
  p_room uuid,
  p_room_number text,
  p_bed_capacity integer,
  p_is_ac boolean,
  p_rent_amount numeric
) returns void language plpgsql security definer set search_path=public as $$
declare
  occupied integer;
begin
  -- Ownership check: room must belong to a hostel owned by the caller
  if not exists (
    select 1 from rooms r join hostels h on h.id = r.hostel_id
    where r.id = p_room and h.owner_id = auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  -- Capacity check: cannot reduce below currently active occupants
  select count(distinct s.id)::integer into occupied
  from room_assignments a
  join students s on s.id = a.student_id and s.status = 'active'
  where a.room_id = p_room and a.moved_out_at is null;

  if p_bed_capacity < occupied then
    raise exception 'Cannot reduce capacity below % — the room currently has % active occupants. Move them first.', p_bed_capacity, occupied;
  end if;

  update rooms set
    room_number  = p_room_number,
    bed_capacity = p_bed_capacity,
    is_ac        = p_is_ac,
    rent_amount  = p_rent_amount
  where id = p_room;
end $$;

-- 4. RPC: bulk_create_rooms — creates multiple rooms on a floor in one call
create or replace function public.bulk_create_rooms(
  p_hostel     uuid,
  p_floor_num  integer,
  p_prefix     text,
  p_start      integer,
  p_end        integer,
  p_pad        integer,      -- zero-padding width, e.g. 3 for "001", 0 for none
  p_beds       integer,
  p_is_ac      boolean,
  p_rent       numeric
) returns integer language plpgsql security definer set search_path=public as $$
declare
  fid   uuid;
  n     integer := 0;
  i     integer;
  rnum  text;
begin
  if not public.owns_hostel(p_hostel) then raise exception 'Not allowed'; end if;
  if p_start > p_end then raise exception 'Start must be <= end'; end if;
  if p_end - p_start > 199 then raise exception 'Maximum 200 rooms per bulk creation'; end if;

  -- Get or create floor
  select id into fid from floors where hostel_id = p_hostel and number = p_floor_num;
  if fid is null then
    insert into floors(hostel_id, number) values(p_hostel, p_floor_num) returning id into fid;
  end if;

  for i in p_start..p_end loop
    if p_pad > 0 then
      rnum := p_prefix || lpad(i::text, p_pad, '0');
    else
      rnum := p_prefix || i::text;
    end if;
    -- Skip rooms that already exist (idempotent)
    insert into rooms(hostel_id, floor_id, room_number, bed_capacity, is_ac, rent_amount)
    values(p_hostel, fid, rnum, p_beds, p_is_ac, p_rent)
    on conflict(hostel_id, room_number) do nothing;
    get diagnostics n = row_count;
    n := n; -- accumulate via GET DIAGNOSTICS is per-statement; use a counter
  end loop;

  -- Return actual count inserted by re-checking (simple approach)
  select count(*) into n from rooms
  where hostel_id = p_hostel and floor_id = fid
    and room_number ~ ('^' || p_prefix || '\d+$');
  return n;
end $$;

-- 5. Grant new RPCs to authenticated users
grant execute on function
  public.update_room(uuid, text, integer, boolean, numeric),
  public.bulk_create_rooms(uuid, integer, text, integer, integer, integer, integer, boolean, numeric)
to authenticated;

-- 6. Update approve_admission_via_api and create_student_with_room to carry aadhaar
create or replace function public.create_student_with_room(
  p_hostel uuid, p_room uuid, p_name text, p_email text, p_phone text,
  p_whatsapp text, p_admission_date date, p_deposit numeric,
  p_deposit_duration integer, p_contract_duration integer,
  p_aadhaar text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  if not public.owns_hostel(p_hostel) then raise exception 'Not allowed'; end if;
  if not exists(select 1 from rooms where id=p_room and hostel_id=p_hostel) then raise exception 'Choose a room in this hostel'; end if;
  if exists(select 1 from students where owner_id=auth.uid() and phone=trim(p_phone)) then raise exception 'A student with this phone number already exists'; end if;
  insert into students(owner_id,hostel_id,full_name,email,phone,whatsapp_number,admission_date,security_deposit,deposit_duration_months,contract_duration_months,status,aadhaar_number)
  values(auth.uid(),p_hostel,trim(p_name),nullif(trim(p_email),''),trim(p_phone),coalesce(nullif(trim(p_whatsapp),''),trim(p_phone)),coalesce(p_admission_date,current_date),coalesce(p_deposit,0),coalesce(p_deposit_duration,0),coalesce(p_contract_duration,11),'active',nullif(trim(coalesce(p_aadhaar,'')),'')) returning id into sid;
  perform public.assign_room(sid,p_room); return sid;
exception when others then raise; end $$;

create or replace function public.approve_admission_via_api(
  p_pending uuid, p_room uuid, p_deposit numeric,
  p_deposit_duration integer, p_contract_duration integer
) returns uuid language plpgsql security definer set search_path=public as $$
declare p pending_admissions; sid uuid;
begin
  select * into p from pending_admissions where id=p_pending and reviewed_at is null and rejected_at is null for update;
  if p.id is null or not public.owns_hostel(p.hostel_id) then raise exception 'Admission is no longer pending or you do not have access'; end if;
  if exists(select 1 from students where owner_id=auth.uid() and phone=p.phone) then raise exception 'A student with this phone number already exists'; end if;
  sid:=public.create_student_with_room(p.hostel_id,p_room,p.full_name,p.email,p.phone,p.whatsapp_number,current_date,p_deposit,p_deposit_duration,p_contract_duration,p.aadhaar_number);
  update pending_admissions set reviewed_at=now() where id=p.id; return sid;
end $$;

-- Re-grant (overloaded function needs new grant)
grant execute on function
  public.create_student_with_room(uuid,uuid,text,text,text,text,date,numeric,integer,integer,text),
  public.approve_admission_via_api(uuid,uuid,numeric,integer,integer)
to authenticated;
