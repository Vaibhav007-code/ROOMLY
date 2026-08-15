import { NextRequest, NextResponse } from 'next/server';
import { currentUser, supabaseAdmin } from '@/lib/server';

export async function POST(req: NextRequest) {
  try {
    const { sb, user } = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { email, name, hostelIds } = body;

    if (!email || !Array.isArray(hostelIds) || hostelIds.length === 0) {
      return NextResponse.json({ error: 'Email and at least one hostel are required' }, { status: 400 });
    }

    // 1. Verify caller has 'owner' role in profiles
    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only hostel owners can manage team members' }, { status: 403 });
    }

    // 2. Verify caller actually owns every requested hostel
    for (const hid of hostelIds) {
      const { data: h } = await sb.from('hostels').select('id,owner_id').eq('id', hid).maybeSingle();
      if (!h || h.owner_id !== user.id) {
        return NextResponse.json({ error: `Hostel ${hid} not found or you do not own it` }, { status: 403 });
      }
    }

    const admin = supabaseAdmin();

    // Check if user with this email already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === email);

    let managerId: string;

    if (existing) {
      managerId = existing.id;
      // Update their role to manager if not already
      await admin.from('profiles').update({ role: 'manager' }).eq('id', managerId);
    } else {
      // Invite new user as manager
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { role: 'manager', full_name: name || email },
      });
      if (inviteError) {
        return NextResponse.json({ error: inviteError.message }, { status: 500 });
      }
      managerId = invited.user.id;
    }

    // Assign to hostels (upsert to avoid conflicts)
    for (const hid of hostelIds) {
      await admin.from('manager_hostels').upsert(
        { manager_id: managerId, hostel_id: hid },
        { onConflict: 'manager_id,hostel_id' }
      );
    }

    return NextResponse.json({ ok: true, managerId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
