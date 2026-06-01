# ViolinMaster PRD

## One-Sentence Goal

Build a real-time violin practice coach for exam and professional-track learners: while the student practices, ViolinMaster detects pitch and rhythm mistakes within the next two measures, explains the issue in plain language, and sends the student back to repeat the passage until it is correct.

## Product Positioning

ViolinMaster is not a generic tuner, recorder, or post-practice analytics dashboard. The paid wedge is an **immediate mistake-interruption loop** for serious young violin learners who practice between expensive lessons.

The product should prevent the most damaging practice pattern: a student plays a wrong pitch or rhythm, does not notice it, and continues forward until the mistake becomes muscle memory.

## Primary Customer and User

### Paying Customer

Parents of young violin learners who already spend money on private teachers, professors, masterclasses, institutions, exam preparation, or competition preparation.

The parent pays because teacher time is expensive and sparse. They want the teacher's lesson time spent on higher-value musical and technical guidance, not repeatedly correcting basic pitch and rhythm problems that could have been caught during daily practice.

### End User

Young violin learners preparing graded or professional-track repertoire, including national amateur exams, national professional exams, conservatory-oriented study, and competition repertoire.

### Influencer

Teachers and professors can become strong recommenders because the product should reduce repetitive correction work between lessons and produce cleaner students at the next class.

## Core Demand Evidence

The strongest observed pain is personal and direct: learners often cannot hear that their intonation is wrong, then keep playing forward. This is not only observed in others; it comes from lived practice experience.

That makes the core product claim specific:

- The student does not need another passive report.
- The student needs immediate correction before the error becomes reinforced.
- The product should stop the student from continuing past a mistake and guide them back into the right repetition.

## Core Pain

Young learners often practice many hours without reliable feedback. Between weekly or less frequent lessons, they may repeat wrong intonation or rhythm hundreds of times. During the next professor or masterclass lesson, the student's limited and expensive lesson time can be consumed by issues that should have been caught earlier.

Current alternatives are insufficient:

- A teacher catches problems, but only during class.
- A parent supervises practice, but usually cannot hear technical pitch and rhythm errors accurately.
- A tuner gives pitch data, but not score-aware violin practice guidance.
- A recording lets the student listen back, but the student may still not know what to fix.
- Generic music-learning apps rarely understand exam repertoire, score context, or violin-specific practice language.

## MVP Promise

During a practice session, the student should be able to:

1. Select an exam or professional-track piece.
2. Start practicing measure by measure or phrase by phrase.
3. Receive pitch and rhythm correction within two measures after a mistake.
4. Understand the correction in plain, teacher-like language.
5. Repeat the problem passage immediately.
6. Move forward only after the passage meets the target threshold.

For the parent, the MVP should make it clear that:

- The child did not simply play from beginning to end.
- The product identified specific wrong passages.
- The child repeated those passages until pitch and rhythm improved.
- The next lesson should start from a higher baseline.

## MVP Scope

### Must Have

1. Real-time practice loop
   - Listen during active practice through the browser microphone.
   - Track the student's current position against the selected score or phrase map.
   - Detect pitch and rhythm issues fast enough to respond within two measures.
   - Interrupt forward motion when the issue is significant.
   - Ask the student to replay the specific measure or phrase.
   - Release the student to continue only after the retry passes the configured threshold.

2. Score-aware exam repertoire
   - Provide a curated seed library for exam and professional-track practice.
   - Prioritize repertoire that serious young learners already practice.
   - Support score-derived timing and pitch expectations through bundled or imported MusicXML/MIDI.
   - Represent pieces by measure ranges, phrases, difficulty, and technique tags.

3. Pitch and rhythm diagnosis
   - Detect wrong pitch, pitch tendency, missed pitch center, rushing, dragging, and unstable rhythm.
   - Group mistakes by measure or short phrase.
   - Store confidence and raw technical values internally.
   - Show learner-facing messages in plain language, not cents and milliseconds by default.

4. Immediate retry workflow
   - Mark the exact measure or phrase to replay.
   - Provide a short correction message before retry.
   - Compare each retry against the same target.
   - Show pass/fail or ready-to-continue state.
   - Avoid turning practice into a passive analytics report.

5. Parent-facing practice summary
   - Summarize what the child practiced.
   - Show repeated problem areas.
   - Show which areas improved after retry.
   - Express value in terms of lesson-readiness, not raw audio metrics.

6. Local session history
   - Store recent practice sessions locally.
   - Preserve repeated issue patterns by piece and measure.
   - No account system required for the MVP.

7. Honest error and quality states
   - Detect poor microphone input, noisy rooms, or insufficient pitch confidence.
   - Ask the user to retry when analysis confidence is too low.
   - Never present fake precision when the signal is not reliable.

### Should Have

- Upload a practice recording for slower post-session review.
- Playback of the user's take and retries.
- Metronome and tempo control for retry loops.
- Manual teacher annotations for known hard measures.
- Teacher-shareable summary export.
- Basic calibration for instrument tuning and microphone level.

### Not In MVP

- Marketplace, billing, social features, or full teacher CRM.
- Fully reliable automatic bow direction, fingering, posture, or vibrato diagnosis from audio alone.
- Body-shape, motion, physical habit, or long-term growth modeling.
- Custom model training.
- Full autonomous teacher replacement.
- Broad all-instrument support.

## Primary Product Flow

### Real-Time Guided Practice

1. Student chooses a supported piece.
2. Student selects a practice mode: measure, phrase, or lesson assignment.
3. Student starts playing.
4. ViolinMaster follows the score position.
5. When a pitch or rhythm error crosses the threshold, the app responds within two measures.
6. The app says what went wrong in plain language.
7. The app sends the student back to the problem range.
8. Student repeats the range.
9. The app either asks for another retry or allows the student to continue.
10. Session summary records the error, retries, and improvement.

### Parent Review Flow

1. Parent opens the practice summary.
2. Parent sees total focused practice time, not just elapsed time.
3. Parent sees the measures that required repeated correction.
4. Parent sees whether the student improved after retries.
5. Parent can understand why the next teacher lesson should be more productive.

### Teacher Influence Flow

1. Teacher recommends a piece or measure range.
2. Student practices with ViolinMaster between lessons.
3. The product records recurring pitch and rhythm issues.
4. Teacher can optionally review a concise summary before the next lesson.
5. Teacher spends less time rediscovering basic mistakes.

## Diagnosis Language

Use clear, direct, teacher-like messages:

- "This note is landing a little high. Go back to bar 12 and place it lower."
- "You are entering before the beat. Wait for the pulse, then replay bars 8-9."
- "The rhythm rushes after the shift. Slow this bar down and repeat it once."
- "This passage is not ready to move on. Replay the last two bars."
- "Good. The retry is stable enough. Continue to the next phrase."

Avoid default learner-facing output such as:

- "37 cents sharp."
- "143 ms early."
- "DTW confidence 0.71."

Raw values can exist in debug data, but the normal experience should feel like a practical coach, not an audio engineering tool.

## Repertoire Data Strategy

Each piece should include:

- Title, composer, difficulty band, exam system, category, source family, and rights status.
- MusicXML or MIDI reference when analysis is enabled.
- Measure and phrase map.
- Expected pitch and rhythm timeline.
- Technique labels where known: shifting, fourth finger, bowing pattern, position change, string crossing, vibrato-risk passage.
- Practice thresholds by level where possible.

Rights-aware statuses:

- `bundled`: full analysis assets can ship with the app.
- `import-required`: metadata exists, user must import score/audio assets.
- `teacher-provided`: enabled for a specific teacher/student workflow.
- `private-dataset`: usable only in a private research or licensed environment.
- `future-license`: desirable catalog entry, not enabled for analysis yet.

## Initial Data Objects

```ts
type Piece = {
  id: string;
  title: string;
  composer: string;
  levelBand: "beginner" | "intermediate" | "advanced" | "professional";
  examSystem?: "national-amateur" | "national-professional" | "conservatory" | "competition" | "teacher-assigned";
  category: "exam" | "etude" | "concerto" | "concert-piece" | "suzuki" | "chinese";
  rightsStatus: "bundled" | "import-required" | "teacher-provided" | "private-dataset" | "future-license";
  assets: {
    musicxml?: string;
    midi?: string;
    referenceAudio?: string;
  };
  phraseMap: PhraseRange[];
  techniqueMap: TechniqueLabel[];
};

type PracticeGate = {
  pieceId: string;
  range: {
    measureStart: number;
    measureEnd: number;
  };
  issueTypes: ("pitch" | "rhythm")[];
  severity: "low" | "medium" | "high";
  confidence: number;
  learnerMessage: string;
  retryInstruction: string;
  passThreshold: {
    pitchToleranceCents?: number;
    timingToleranceMs?: number;
    minConfidence: number;
  };
};
```

## Success Criteria

- A student can select a supported exam/professional-track piece and practice through the browser microphone.
- The app can detect meaningful pitch and rhythm errors during practice and respond within two measures.
- The app can send the student back to the specific problem range and evaluate the retry.
- Learner-facing feedback is plain-language and actionable.
- Parent-facing summary shows what improved through repeated practice.
- At least one supported piece works end to end from score reference to real-time correction loop.
- The product clearly reports low-confidence audio instead of pretending to be precise.

## Product Risks

- Real-time pitch and rhythm tracking may be less stable than post-session analysis, especially in noisy rooms.
- "Within two measures" is a demanding latency and alignment requirement.
- Young learners may find interruption frustrating if thresholds are too strict.
- Parent-facing value can be weak if summaries do not connect practice behavior to teacher lesson efficiency.
- Copyrighted score and audio assets require careful import or licensing strategy.
- The long-term vision can sprawl into posture, physiology, growth modeling, and teacher replacement before the core paid loop works.

## Risk Controls

- Start with solo violin, monophonic practice, and limited supported repertoire.
- Begin with measure/phrase practice rather than unconstrained full-performance tracking.
- Use confidence thresholds and clear retry prompts.
- Let difficulty level adjust pass thresholds.
- Keep the first paid loop narrow: pitch/rhythm correction, immediate retry, parent-visible progress.
- Treat posture, body mechanics, physical development, and personalized growth modeling as future expansion after the real-time correction loop is reliable.

## Long-Term Vision

The durable advantage should come from being deeply violin- and student-aware, not merely from generic audio detection.

The foundation is repertoire intelligence: ViolinMaster should understand the pieces serious learners practice, where students usually fail, and what each measure demands technically. From there, it can grow into a long-term learning companion that understands an individual student's recurring weaknesses, practice habits, and development path.

Future versions may extend beyond pitch and rhythm into posture, movement, physical habits, technique patterns, and personalized remediation. Those are not MVP promises. They are the expansion path once the product proves it can reliably catch and correct the basic mistakes that currently waste teacher time.

## Open Questions

- What is the first exact repertoire set to support for paid users?
- What latency target is technically realistic in-browser for the first version?
- Should the first version force measure-by-measure practice, or allow phrase-based flow?
- What retry threshold feels strict enough to be useful but not so strict that students quit?
- What summary does a paying parent need to feel the product saved teacher time?
- How much teacher involvement is required for the first paid workflow?
