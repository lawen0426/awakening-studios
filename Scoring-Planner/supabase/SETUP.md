1. In your Supabase project, open `SQL Editor`.
2. Run [`schema.sql`](/Users/luanhui/Desktop/创作周期计划 APP/supabase/schema.sql).
3. Open `Project Settings` -> `API`.
4. Copy the `anon public` key.
5. Paste it into [`.env.local`](/Users/luanhui/Desktop/创作周期计划 APP/.env.local:2) as `VITE_SUPABASE_ANON_KEY=...`.
6. Restart the app.

Notes:
- Re-run `schema.sql` after this update to create the shared team-sync tables.
- The app now stores one shared planner workspace JSON per team workspace.
- Workspace owners can invite teammates by email from the app menu.
