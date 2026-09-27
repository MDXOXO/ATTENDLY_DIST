# Attendly

Attendly is a cross-device attendance intelligence PWA with Supabase persistence, manual timetable support, and an optional Amizone browser-extension sync layer.

## Product goals

- CheckKaro-style attendance dashboard and workflow
- Cloud-persistent user accounts and data
- Works on phone, tablet, laptop and desktop
- Installable as a PWA
- Manual timetable always available
- Amizone sync for Amity students on supported desktop browsers
- Historical attendance is not rewritten when future timetable data changes
- User data is isolated with Supabase Auth + PostgreSQL RLS

## Features

- Email/password authentication
- Password reset
- Persistent semester data
- Subjects with optional credits for imported Amizone courses
- Manual weekly timetable
- Holidays, working days and special working days
- Class-level attendance records
- Attendance calendar
- Subject health
- Safe-skip calculation
- Recovery calculation
- What-if simulator
- Special working-day overrides
- Amizone timetable/session import
- Amizone attendance snapshot import
- Installable PWA
- Responsive UI

## Local development

```bash
npm install
npm run dev
```

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

Never put a Supabase secret/service-role key in this file or in frontend source code.

## Supabase setup

Run these migrations in order in Supabase SQL Editor:

1. Your original Attendly schema.
2. `supabase/amizone_sync.sql`
3. `supabase/production_security.sql`

The Amizone migration adds course codes, optional imported credits, `class_sessions`, and `amizone_attendance_snapshots`.

The production security migration keeps application tables inaccessible to unauthenticated users and grants the signed-in role the required access. RLS policies remain the authoritative row-level isolation mechanism.

## Amizone integration

The Amizone integration deliberately does not ask Attendly for an Amizone password. A browser extension reads information already visible in the authenticated Amizone page and passes a normalized snapshot to the open Attendly tab.

For local development:

1. Open Chrome/Edge/Brave extensions.
2. Enable Developer mode.
3. Load the `extension` folder as an unpacked extension.
4. Log in to Amizone normally.
5. Open the Amizone page containing My Classes and My Attendance.
6. Open Attendly in another tab.
7. Click Sync Amizone.

The parser is isolated in `extension/amizone.js` because the private portal's markup can change.

## Production deployment

### Vercel

Create a GitHub repository and import it into Vercel.

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Add these Vercel environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

After deployment, set the Supabase Auth Site URL and redirect URLs to the production domain. For password reset, allow:

```text
https://YOUR_DOMAIN/reset-password
```

### PWA

The production build serves `manifest.webmanifest` and a service worker. Supported browsers can offer an Install App action. iOS users can use the browser's Add to Home Screen flow.

## Data persistence

Attendance and timetable data are stored in Supabase. Logging out, closing the browser, uninstalling the PWA, or changing devices does not delete the account's cloud data.

Only an explicit account/data deletion flow should remove data.

## Security model

- Supabase Auth identifies the current user.
- PostgreSQL RLS limits each user's rows to their own semester ownership chain.
- The browser uses only the publishable/anon client key.
- Supabase service-role/secret keys must never be exposed to the frontend.
- Amizone credentials are not requested or stored by Attendly.
