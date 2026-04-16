# Film Scoring Weekly Planner

Desktop planner for film scoring schedules, writing weeks, timeline planning, and Gantt tracking.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## macOS Packaging

```bash
npm run pack:mac
```

This produces release files in:

- `release/Film Scoring Weekly Planner-<version>-arm64.dmg`
- `release/Film Scoring Weekly Planner-<version>-arm64.dmg.blockmap`
- `release/Film Scoring Weekly Planner-<version>-arm64-mac.zip`
- `release/Film Scoring Weekly Planner-<version>-arm64-mac.zip.blockmap`

## GitHub Releases Auto Update

This project is configured to use GitHub Releases for update checks.

### 1. Fill in your GitHub repo

Edit:

`electron/github-release.json`

```json
{
  "owner": "your-github-name",
  "repo": "your-repo-name",
  "releaseType": "release"
}
```

### 2. Build the release

```bash
npm run pack:mac
```

### 3. Verify what to upload

```bash
npm run release:github:check
```

### 4. Create a GitHub Release

Create a release on GitHub with a tag that matches the app version, for example:

- `v0.0.1`

### 5. Upload these files to the release

- `.dmg`
- `.dmg.blockmap`
- `-mac.zip`
- `-mac.zip.blockmap`

After that, packaged apps that already have the GitHub repo configured can use:

- automatic update checks on launch
- `Check for Updates…` from the app menu

## Important Note

Unsigned or ad-hoc signed macOS apps can still be distributed, but automatic installation behavior is less reliable than a fully signed and notarized build.
