# Darts League — Setup Guide

## Quick Start (one-time setup)

### 1. Install remaining packages

Wait for any running npm installs to finish, then run:

```bash
npm install -D prisma
```

### 2. Set up Supabase

1. Go to https://supabase.com → create a free project
2. Go to Settings → Database → copy:
   - **Connection string (Transaction mode / pooler)** → `DATABASE_URL`
   - **Connection string (Session mode / direct)** → `DIRECT_URL`
3. Go to Settings → API → copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set up Clerk

1. Go to https://clerk.com → create a free app
2. Enable Email and Google sign-in
3. Go to API Keys → copy:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY`
4. Go to Webhooks → create endpoint:
   - URL: `https://your-app.vercel.app/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`
   - Copy signing secret → `CLERK_WEBHOOK_SECRET`
5. Go to User & Authentication → Restrictions → enable **Invitation-only sign-up**

### 4. Fill in .env.local

Edit the `.env.local` file with all the values above. The `ADMIN_EMAIL` is already set to `callumhughes2610@gmail.com`.

### 5. Run Prisma migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 6. Set up shadcn/ui

```bash
npx shadcn@latest init
```
Choose: Default style, Zinc base color, CSS variables.

Then add components:
```bash
npx shadcn@latest add button card dialog input label select table badge avatar tooltip dropdown-menu separator skeleton sonner tabs
```

### 7. Add PWA icons

Create placeholder icons (or use a darts bullseye image):
- `public/icons/icon-192.png` (192×192 PNG)
- `public/icons/icon-512.png` (512×512 PNG)

### 8. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to sign in.

### 9. Sign up as admin

Sign up using `callumhughes2610@gmail.com` — the Clerk webhook will automatically grant you ADMIN role.

---

## Deploy to Vercel

1. Push the `darts-league` folder to GitHub
2. Go to https://vercel.com → Import project
3. Add all env vars from `.env.local` in Vercel project settings
4. Deploy
5. Update the Clerk webhook URL to your Vercel domain

---

## Daily workflow

- `npm run dev` — start local server
- `npx prisma studio` — visual database browser
- `npx prisma migrate dev --name <change>` — add schema changes
