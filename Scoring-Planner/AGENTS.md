# Repository Guidelines

## Project Structure & Module Organization
This is a React + Vite + Electron desktop app. Core UI and state orchestration live in `src/AppController.tsx`, with feature modules under `src/features/` such as `projects`, `tasks`, `workspace`, `scoring`, and `unicue`. Shared utilities are in `src/lib/` and `src/shared/`. Styling is split across `src/styles/` and imported from `src/App.css`. Electron entry points live in `electron/main.cjs` and `electron/preload.cjs`. Build output is written to `dist/`; packaged macOS releases go to `release/`. Static assets belong in `build/`, `public/`, or `src/assets/` as appropriate.

## Build, Test, and Development Commands
- `npm run dev`: run Vite and Electron together for local development.
- `npm run dev:web`: start only the Vite server on `127.0.0.1:4173`.
- `npm run desktop`: launch Electron against the built/local app.
- `npm run build`: run TypeScript project build and Vite production build.
- `npm run pack:mac`: build and package arm64 macOS DMG/ZIP artifacts.
- `npm run release:github:check`: verify expected release files exist.
- `npm run release:ship`: package and upload release assets when a GitHub token is configured.

## Coding Style & Naming Conventions
Use TypeScript and React function components. Prefer existing feature folders and helpers before adding new abstractions. Use two-space indentation in JSON/YAML and project-standard formatting in TS/TSX. Component names use `PascalCase`; hooks and helpers use `camelCase`; constants use descriptive `SCREAMING_SNAKE_CASE` only for storage keys and environment names.

## Testing Guidelines
There is no dedicated test suite yet. Treat `npm run build` as the required verification gate before shipping. For UI changes, run the Electron app and check the affected view manually. Add focused tests only when introducing a test framework or changing shared logic with high regression risk.

## Commit & Pull Request Guidelines
Recent history uses short release-oriented messages, for example `release: v0.0.2`. Keep commits concise and scoped, such as `fix: align project overview cards` or `release: v0.0.3`. Pull requests should include a summary, verification steps, screenshots for UI work, and notes about release packaging or data migration effects.

## Security & Configuration Tips
Keep secrets in `.env.local`; never commit real Supabase, Unicue, AI, Apple, or GitHub tokens. Release upload accepts `RELEASE_REPO_TOKEN`, `GITHUB_TOKEN`, or `GH_TOKEN`. Local app data lives under `~/Library/Application Support/Film Scoring Weekly Planner` and Electron local storage; deleting local data must not call Supabase delete APIs.
