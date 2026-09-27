# Attendly distribution checklist

## 1. Supabase

1. Create/keep the production Supabase project.
2. Run the existing Attendly schema.
3. Run `supabase/amizone_sync.sql`.
4. Run `supabase/production_security.sql`.
5. In Authentication settings, configure the production Site URL.
6. Add the production password-reset redirect URL:
   `https://YOUR_DOMAIN/reset-password`
7. Keep email confirmation enabled if you want verified accounts.
8. Never put a service-role/secret key in the frontend.

Supabase RLS must remain enabled on every private application table.

## 2. GitHub

Commit everything except `.env.local`, `node_modules`, and `dist`.

```bash
git init
git add .
git commit -m "Attendly production v1"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

## 3. Vercel

Import the GitHub repository into Vercel.

Framework preset: Vite

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Deploy.

## 4. Verify production

- Sign up with a test account.
- Confirm the account appears in Supabase Auth.
- Create a semester.
- Add a subject.
- Add a timetable.
- Add a holiday.
- Mark a class present/absent.
- Refresh the browser.
- Log out and log back in.
- Open the same account on another device.
- Confirm the same data appears.
- Confirm a second test account cannot see the first account's rows.
- Test password reset.
- Test PWA installation.

## 5. Amizone extension

The extension is optional and is currently intended for desktop Chromium browsers. The main Attendly web app remains usable on mobile devices without the extension.

Load the `extension` directory as an unpacked extension during testing. For public distribution, publish the extension separately through the appropriate browser extension store or distribute it through an approved organizational channel.

## 6. Data retention

Closing a tab, quitting the browser, logging out, uninstalling the PWA, or changing devices does not delete the user's cloud data. Data is only removed by an explicit database/account deletion operation.
