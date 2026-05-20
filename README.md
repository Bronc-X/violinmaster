# ViolinMaster

ViolinMaster is an MVP violin practice workstation. It supports browser recording, audio upload, demo-take analysis, score-driven pitch diagnosis, targeted bar drills, local recurring-error statistics, and a coach-style diagnosis panel.

## Run

```bash
npm run dev
```

Open `http://localhost:5173`.

## Baseline

Before and after future changes, run:

```bash
npm run test:baseline
```

This freezes the current MVP baseline:

- audio analysis unit tests pass
- repertoire data tests pass
- WAV demo-take helper tests pass
- static app build checks pass
- browser workflow has been manually verified with `Demo -> Analyze`

Suggested checkpoint tag format:

```bash
git tag baseline-2026-05-20-tested
```
