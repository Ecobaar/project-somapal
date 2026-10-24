# SomaPal Workspace Instructions

- This is a React, TypeScript, Vite application for Kenyan CBC teachers.
- Keep workflows mobile-first, touch-friendly, lightweight, and English-only.
- Follow the existing warm green, cream, and coral visual language in `src/somapal.css`.
- Supabase data must remain teacher-private. Keep row-level security enabled and update `supabase/migrations` when changing the schema.
- Never add a Supabase service-role key or other secrets to client code.
- Run `npm run build` after app changes and `npm run lint` for lint validation.
