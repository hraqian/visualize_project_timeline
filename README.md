# Project Timeline

Browser-based project timeline editor with Data View, Timeline View, dependency scheduling, and configurable critical path styling.

## Storage Backends

The app supports two storage modes behind the same save/load/delete UI.

### Local dev file storage

Default when no Supabase environment variables are configured.

- uses the Vite dev plugin endpoints at `/api/projects`
- saves project JSON files under `data/projects/`
- intended for local development only

### Hosted storage with Supabase

Enabled when both of these environment variables are present:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

In this mode the app keeps the same Project Manager UX, but saves projects in Supabase instead of local files.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Without Supabase env vars, the app will use the local Vite `/api/projects` storage backend.

## Supabase Setup

This repo includes a ready-to-run SQL file:

- `supabase/projects-schema.sql`

Create a Supabase project, open the SQL editor, and run that file.

It creates:

- `public.projects`
- index on `last_modified`
- permissive RLS policies for initial testing

Table shape:

- `id` `text primary key`
- `name` `text not null`
- `last_modified` `timestamptz not null`
- `data` `jsonb not null`

For real public use, you should tighten the included policies and add auth.

## Environment

Copy:

```bash
cp .env.example .env.local
```

Then fill in:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

With those values present, local development will use Supabase instead of the Vite file-storage backend.

## Deployment

Recommended frontend hosts:

- Vercel
- Cloudflare Pages

Build settings:

- build command: `npm run build`
- output directory: `dist`

Environment variables to configure in the host dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Fastest End-to-End Path

1. Create a Supabase project.
2. Run `supabase/projects-schema.sql` in Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and add your Supabase values.
4. Run `npm run dev` and verify save/load/delete works in Project Manager.
5. Push this repo to GitHub.
6. Connect the repo to Vercel or Cloudflare Pages.
7. Add the same two env vars in the deployment dashboard.

## Notes

- no Supabase env vars: local file storage via Vite plugin
- Supabase env vars present: hosted storage with the same visible save/load/delete UX
- local and deployed builds can share the same backend if you want, but separate dev/prod Supabase projects are safer
