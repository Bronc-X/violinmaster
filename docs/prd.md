# ViolinMaster MVP PRD

## One-Sentence Goal

Build a real violin practice workstation that lets a learner record or upload a performance, compare it against a selected score, and receive understandable practice diagnosis plus targeted drills.

## Target Users

- Adult and youth violin learners who practice between weekly lessons.
- Parents helping children practice but unable to hear technical errors reliably.
- Teachers who want a summary of what happened during the student's home practice.

## Core Pain

Most violin learners cannot reliably hear whether their pitch, rhythm, shifting, bowing, or vibrato is wrong. Weekly lessons are too sparse to catch repeated practice mistakes, and generic music apps do not translate audio analysis into violin-specific coaching language.

## MVP Promise

After one practice take, the user should know:

- Which passages were generally stable.
- Which passages need work.
- Whether the main issue is pitch, rhythm, shifting-risk, fourth finger, bowing, or vibrato-risk.
- What to practice next, in plain teacher-like language.

## MVP Scope

### Must Have

1. Repertoire workspace
   - Browse a curated seed library across Suzuki, exam, etudes, concert pieces, and Chinese repertoire metadata.
   - Open a supported piece with bundled or imported MusicXML/MIDI.
   - Show score or structured phrase map.

2. Audio input
   - Browser microphone recording.
   - Audio file upload.
   - Clear recording states: idle, recording, processing, complete, error.

3. Full-piece analysis
   - Extract pitch contour and onset/rhythm features.
   - Align performance to the selected score or MIDI reference.
   - Produce section-level diagnosis rather than raw technical numbers.

4. Targeted drill mode
   - User can select a measure range.
   - The app analyzes only that range or highlights the selected range from the full take.
   - AI can recommend the next drill range based on recent errors.

5. Error summary statistics
   - Aggregate recurring issues across takes.
   - Initial buckets: pitch high, pitch low, rhythm rush, rhythm drag, shifting-risk passage, fourth-finger passage, bowing-risk passage, vibrato-risk passage.

6. AI coach panel
   - Explain the diagnosis in friendly, specific, non-technical language.
   - Convert low-level analysis into practice advice.
   - Avoid exposing cents and milliseconds by default.

7. Local single-user history
   - Store recent practice sessions locally.
   - No login in MVP.

### Should Have

- Metronome and tempo selector for drill mode.
- Playback of the user's recording.
- Highlighted problem ranges in the score timeline.
- Manual technique labels on measures, such as shifting, fourth finger, vibrato, bowing pattern.

### Not In MVP

- User account system.
- Marketplace, teacher dashboard, billing, or social features.
- Fully reliable automatic bow direction or fingering detection from audio alone.
- Training a custom foundation model.
- Real-time correction while playing. Real-time can be explored after offline analysis works.

## Product Model

### Primary Flow: Full Take

1. User chooses a piece.
2. User selects full-piece mode.
3. User records in browser or uploads an audio file.
4. App processes pitch and rhythm.
5. App aligns the performance to the score.
6. App shows:
   - Overall practice summary.
   - Timeline with problem areas.
   - Top 3 practice priorities.
   - AI coach explanation.

### Secondary Flow: Targeted Drill

1. User opens a piece.
2. User selects a measure range manually, or accepts AI suggested range.
3. User records only that passage.
4. App compares the take with that passage.
5. App gives a short drill instruction and stores the result in history.

### Error Statistics Flow

1. User completes multiple takes.
2. App groups repeated issues by type and piece section.
3. App shows trend language:
   - "Your third-position shifts are often landing slightly low."
   - "Fast detached notes tend to rush after bar 16."
   - "Fourth-finger notes are less stable than open-string alternatives."

## Diagnosis Language

Use teacher-like descriptions:

- "This note sits a little high."
- "The entrance is early; wait for the beat before changing bow."
- "The shift arrives low. Practice sliding slowly into the target note."
- "The fourth finger collapses slightly in this phrase."
- "The slurred group compresses near the end."

Avoid default low-level output:

- Do not show "37 cents sharp" as the main message.
- Do not show "143 ms early" as the main message.
- Keep raw values available only for future debug/developer views.

## Repertoire Data Strategy

Each piece should be represented by:

- Metadata: title, composer, level band, category, source family, rights status.
- Analysis asset: MusicXML or MIDI.
- Optional audio reference.
- Technique labels by measure or phrase.
- Phrase map: measure ranges and musical sections.

Rights-aware statuses:

- `bundled`: full asset can ship in the app.
- `import-required`: metadata exists, user must import score/audio.
- `private-dataset`: usable in private research environment only if owner supplies assets.
- `future-license`: desirable catalog entry, not enabled for analysis yet.

## Initial Data Objects

```ts
type Piece = {
  id: string;
  title: string;
  composer: string;
  levelBand: "beginner" | "intermediate" | "advanced" | "professional";
  category: "suzuki" | "etude" | "exam" | "concerto" | "concert-piece" | "chinese";
  rightsStatus: "bundled" | "import-required" | "private-dataset" | "future-license";
  assets: {
    musicxml?: string;
    midi?: string;
    referenceAudio?: string;
  };
  techniqueMap: TechniqueLabel[];
};
```

## Success Criteria

- User can select a supported piece and record through the browser.
- User can upload an audio file and receive a result.
- At least one bundled piece has end-to-end analysis from score to diagnosis.
- The UI provides full-piece analysis, targeted drill mode, statistics, and AI coach panel.
- The analysis result is phrased for a violin learner, not an audio engineer.
- The MVP has no fake-only workflow: if analysis cannot run, the UI must say why.

## Product Risks

- Browser microphone quality varies heavily.
- Polyphonic accompaniment or noisy rooms can reduce pitch-tracking quality.
- Bowing, fingering, and vibrato diagnosis cannot be reliably inferred from audio alone in MVP.
- Copyrighted score and audio assets need a clean import/licensing strategy before distribution.

## MVP Risk Controls

- Start with solo violin, monophonic practice recordings.
- Use phrase/measure technique labels to infer violin-specific context.
- Display confidence levels and ask users to retry if audio quality is too poor.
- Keep copyrighted repertoire as metadata or user-imported assets unless usage is cleared.
