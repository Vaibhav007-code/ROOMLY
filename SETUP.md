# Roomly Setup Guide

## Database Setup

1. Create a Supabase project. In its **SQL Editor**, run:
   - `supabase/migrations/0001_hostel_flow.sql`
   - `supabase/migrations/0002_final_push.sql`
2. In Supabase **Storage**, create two private buckets: `contracts` and `complaint-photos` (the migration attempts this automatically, but verify they exist).
3. In Supabase **Authentication → Settings**, set the Site URL to your domain/Vercel URL. Enable **Email** auth.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...       # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...  # Anon/public key
SUPABASE_SERVICE_ROLE_KEY=...      # Service role key (server-only routes)
NEXT_PUBLIC_APP_URL=https://your-domain.com
CRON_SECRET=some-random-secret     # Protects the cron endpoint
```

## Running Locally

```bash
npm install
npm run dev
```

Create an owner account at `/signup`, add a hostel and rooms, then share its QR registration link with prospective residents.

## Deploying to Vercel

Push this directory to GitHub and import it in Vercel. Add all environment variables in Vercel's project settings. Vercel Cron calls `/api/cron/reminders` daily (configure `CRON_SECRET` there).

---

## WhatsApp — Important Limitation

**No WhatsApp server or bridge is required.** Roomly uses `wa.me` click-to-chat links with pre-filled messages.

### How it works
- Every "Send Reminder", "Send Receipt", "Send Contract", and "Send Login Link" button opens a pre-filled `https://wa.me/<phone>?text=<message>` link in a new browser tab.
- The owner's own WhatsApp (Web or desktop app) opens with the message ready to send — one click per message.
- This approach is free, requires no third-party service, and works on any device.

### Bulk Reminders
The `/dashboard/rent` page shows an **Overdue Reminder Queue** — a list of all overdue students with an individual "Send Reminder" button per row. The owner clicks down the list one at a time. Browsers block multiple auto-opened tabs, so this design is intentional.

### Automated Reminders — Why the Cron Can't Auto-Send
The `/api/cron/reminders` route (called daily by Vercel Cron) **flags** overdue rent payment rows by writing a `reminder_flagged_at` timestamp. It does **not** send WhatsApp messages — `wa.me` links require a real browser click from a human. The cron job's purpose is to mark which students are overdue so they appear at the top of the manual reminder queue when the owner opens the dashboard.

To send reminders automatically without manual clicks, you would need a paid WhatsApp Business API provider (360dialog, Twilio, etc.). This is out of scope for the current zero-cost setup.

---

## Multi-Tenant Security

- Each owner sees only their own hostels, rooms, and students — enforced by Row Level Security (RLS) at the database level, not just the UI.
- Students can only read their own data — they cannot update rent payments, perform room transfers, or see other students' records (RLS enforced).
- The public QR registration endpoint (`/api/submit` or `/register/[hostelId]`) can only insert into `pending_admissions` — it cannot read any private hostel data.

## Quick Start / Demo

After signing up:
1. Add a hostel at **Hostels & Rooms**
2. Add rooms (set bed capacity carefully — the system enforces it)
3. Add a resident manually from **Residents** or share the QR form link
4. Generate rent dues from **Rent Collection** → "Generate Month's Rent Dues"
5. Send reminders and collect payments from the same page

## Key Features

- **Owner-side manual admission**: Add residents directly from Residents → "Add Resident Manually"
- **QR self-registration + approval**: Students scan, self-register, owner sets terms and approves
- **Contract PDF generation**: Auto-generated on approval, downloadable, re-generatable
- **Student invite codes**: Owner sends a one-time setup link via WhatsApp; student sets up login once
- **Move Out**: Distinct from room transfer — frees the bed immediately, preserves all history
- **CSV export**: Download all resident data as CSV from the Residents page
- **Cron-flagged reminders**: Overdue flagging runs daily; owner manually sends via WhatsApp one-by-one
