# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
# Project Timeline

## Storage Backends

The app supports two storage modes behind the same save/load/delete UI:

### 1. Local dev file storage

Default when no Supabase environment variables are configured.

- uses the Vite dev plugin endpoints at `/api/projects`
- saves project JSON files under `data/projects/`
- intended for local development only

### 2. Hosted storage with Supabase

Enabled when both of these environment variables are present:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

In this mode the app keeps the same project-manager UX, but saves projects in Supabase instead of local files.

## Supabase Setup

Create a table named `projects` with columns:

- `id` `text primary key`
- `name` `text not null`
- `last_modified` `timestamptz not null`
- `data` `jsonb not null`

Example SQL:

```sql
create table if not exists projects (
  id text primary key,
  name text not null,
  last_modified timestamptz not null,
  data jsonb not null
);
```

For a first pass, you can allow public read/write on this table if the app is only for personal testing. For a real public deployment, add auth and proper row-level security.

## Environment

Copy `.env.example` to `.env.local` for local hosted-storage testing.

If no Supabase variables are set, the app falls back to local file storage.

## Deployment Recommendation

- local development: keep using the current Vite dev workflow
- production deployment: use Vercel or Cloudflare Pages for the frontend and Supabase for storage

This keeps the visible save/load/delete behavior similar between local and deployed versions, while allowing the local workflow to continue unchanged.
