import { NextRequest, NextResponse } from 'next/server';
import { currentUser, supabaseAdmin } from '@/lib/server';
import { generateContractPdf } from '@/lib/contract';
import { getErrorMessage } from '@/lib/errorMessages';

const code = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

async function contractFor(studentId: string) {
  const admin = supabaseAdmin();
  const { data: st, error } = await admin
    .from('students')
    .select('*,hostels(name,address,owner_id),room_assignments!inner(moved_out_at,rooms(room_number,is_ac,rent_amount))')
    .eq('id', studentId)
    .is('room_assignments.moved_out_at', null)
    .single();

  if (error || !st) throw new Error('Could not load student contract details');

  const hostelObj = Array.isArray(st.hostels) ? st.hostels[0] : st.hostels;
  let ownerName = '';
  if (hostelObj?.owner_id) {
    const { data: ownerProf } = await admin.from('profiles').select('full_name').eq('id', hostelObj.owner_id).single();
    if (ownerProf?.full_name) ownerName = ownerProf.full_name;
  }

  const room = st.room_assignments[0]?.rooms;
  const contractDateObj = new Date();
  const admissionDateObj = new Date(st.admission_date || Date.now());
  const validityToObj = new Date(admissionDateObj);
  validityToObj.setMonth(validityToObj.getMonth() + (st.contract_duration_months || 11));

  const bytes = await generateContractPdf({
    hostelName: hostelObj?.name || '',
    ownerName,
    contractNo: `RM-${contractDateObj.getFullYear()}-${studentId.slice(0, 4).toUpperCase()}`,
    contractDate: contractDateObj.toLocaleDateString('en-GB'),
    studentName: st.full_name,
    phoneNumber: st.phone,
    email: st.email || '',
    college: '', // Note: college/courseYear not in current schema
    courseYear: '',
    roomAllotted: room?.room_number || 'Unassigned',
    roomType: room ? (room.is_ac ? 'AC Room' : 'Non-AC Room') : '',
    bedNumber: 'Bed 1',
    admissionDatetime: `${st.admission_date}, ${contractDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    monthlyRent: room?.rent_amount ? Number(room.rent_amount).toLocaleString('en-IN') : 'As per agreement',
    securityDeposit: Number(st.security_deposit || 0).toLocaleString('en-IN'),
    paymentMode: 'Online Transfer',
    contractMonths: String(st.contract_duration_months || 11),
    validityFrom: st.admission_date,
    validityTo: validityToObj.toISOString().slice(0, 10),
  });

  const path = `${studentId}/contract-${Date.now()}.pdf`;
  const upload = await admin.storage.from('contracts').upload(path, bytes, { contentType: 'application/pdf', cacheControl: '0' });
  if (upload.error) throw new Error(upload.error.message);

  const insert = await admin.from('contracts').insert({
    student_id: studentId,
    storage_path: path,
    security_deposit: st.security_deposit,
    contract_duration_months: st.contract_duration_months,
  });
  if (insert.error) throw new Error(insert.error.message);

  const signed = await admin.storage.from('contracts').createSignedUrl(path, 60 * 60 * 24 * 30);
  return signed.data?.signedUrl || '';
}

async function inviteFor(studentId: string) {
  const admin = supabaseAdmin();
  await admin.from('student_invites').update({ used_at: new Date().toISOString() }).eq('student_id', studentId).is('used_at', null);
  const inviteCode = code();
  const { error } = await admin.from('student_invites').insert({
    student_id: studentId,
    code: inviteCode,
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  if (error) {
    console.warn('[Invite Table Notice]:', error.message);
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://roomly-ten-beige.vercel.app';
  return `${base}/student/setup?code=${inviteCode}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sb, user } = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (['regenerate', 'invite'].includes(body.action)) {
      const own = await sb.from('students').select('id').eq('id', body.studentId).maybeSingle();
      if (!own.data) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    let studentId: string | undefined;

    if (body.action === 'approve') {
      const r = await sb.rpc('manager_approve_admission', {
        p_pending: body.pendingId,
        p_room: body.roomId,
        p_deposit: Number(body.deposit || 0),
        p_contract_duration: Number(body.contractDuration || 11),
      });

      if (r.error) {
        throw r.error;
      }
      studentId = r.data;
    } else if (body.action === 'manual') {
      const r = await sb.rpc('create_student_with_room', {
        p_hostel: body.hostelId,
        p_room: body.roomId,
        p_name: body.name,
        p_email: body.email || '',
        p_phone: body.phone,
        p_whatsapp: body.whatsapp || body.phone,
        p_admission_date: body.admissionDate || null,
        p_deposit: Number(body.deposit || 0),
        p_deposit_duration: 0,
        p_contract_duration: Number(body.contractDuration || 11),
        p_aadhaar: body.aadhaar || null,
      });

      if (r.error) {
        if (r.error.message?.includes('Could not find the function') || r.error.code === 'PGRST202') {
          const { data: st, error: stErr } = await sb.from('students').insert({
            owner_id: user.id,
            hostel_id: body.hostelId,
            full_name: String(body.name).trim(),
            email: body.email ? String(body.email).trim() : null,
            phone: String(body.phone).trim(),
            whatsapp_number: body.whatsapp ? String(body.whatsapp).trim() : String(body.phone).trim(),
            aadhaar_number: body.aadhaar || null,
            admission_date: body.admissionDate || new Date().toISOString().slice(0, 10),
            security_deposit: Number(body.deposit || 0),
            contract_duration_months: Number(body.contractDuration || 11),
            status: 'active',
          }).select('id').single();

          if (stErr) throw stErr;
          studentId = st.id;

          const { error: assignErr } = await sb.from('room_assignments').insert({
            student_id: studentId,
            room_id: body.roomId,
          });
          if (assignErr) throw assignErr;
        } else {
          throw r.error;
        }
      } else {
        studentId = r.data;
      }
    } else if (body.action === 'regenerate') {
      studentId = body.studentId;
    } else if (body.action === 'invite') {
      const url = await inviteFor(body.studentId);
      return NextResponse.json({ inviteUrl: url });
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const contractUrl = await contractFor(studentId!);
    const inviteUrl = await inviteFor(studentId!);
    return NextResponse.json({ studentId, contractUrl, inviteUrl });
  } catch (e) {
    const userFriendlyMessage = getErrorMessage(e);
    return NextResponse.json({ error: userFriendlyMessage }, { status: 400 });
  }
}
