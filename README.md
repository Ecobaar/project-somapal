# SomaPal

SomaPal is a mobile-first CBC teaching workspace for Kenyan teachers. It keeps class lists, quick assessments, lesson plans and learner reports together, with a lightweight interface for small screens.
## Run locally

Requirements: Node.js and npm.
```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```
Open the local address printed by Vite. Without Supabase credentials, the app offers an **on-device preview**. Preview records remain in the current browser and are not synced or protected by teacher accounts.
## Enable accounts and sync

1. Create a Supabase project and enable email/password authentication.
2. Copy the project URL and anon/public key into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run the SQL in `supabase/migrations/20261016000000_somapal.sql` in the project's SQL editor.
4. Restart the Vite development server and create a teacher account.
The signup form captures the teacher's name, school, phone, grades and subjects. A database trigger creates the profile. Classes, learners, assessments, plans and remarks are stored in Supabase. Row-level security is enabled on every table, and policies restrict reads and writes to the authenticated teacher who owns the records.

Only the Supabase anon/public key belongs in browser configuration. Never put a service-role key in this app. Do not disable row-level security.
## Main workflows

- Home summary with classes, learners and assessments recorded this week.
- Classes with one-at-a-time learner entry, multiline roster import (including admission numbers), editing, removal and search.
- Scan a class-list photo from a phone or computer, review/correct OCR results, then create the class and learners together. Scanning runs in the browser; the English OCR model may download on first use, but the photo is not uploaded.
- Quick assessment by class, strand, sub-strand and date, with EE, ME, AE and BE levels.
- CBC lesson plans saved by class, week and term, filterable by term/week and exportable individually or together as PDF.
- Class rosters, assessment sheets and learner reports grouped by subject and strand can also be exported as PDF.
- Persistent light and dark theme toggle.
- Teacher profile editing after sign-in.
Choose **Export PDF** for the roster, assessment, report or lesson plan(s), then choose **Save as PDF** in the browser's print dialog.

## Checks

```powershell
npm run build
npm run lint
```
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
