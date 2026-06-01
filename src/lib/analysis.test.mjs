import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzePerformance,
  centsBetween,
  evaluatePracticeGate,
  frequencyToMidi,
  summarizePracticeSession,
} from "./analysis.mjs";

function sineWave(frequency, seconds, sampleRate = 44_100) {
  const samples = new Float32Array(Math.floor(seconds * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.8;
  }
  return { samples, sampleRate };
}

test("frequencyToMidi maps concert A to MIDI note 69", () => {
  assert.equal(frequencyToMidi(440), 69);
});

test("centsBetween reports a half-step sized pitch gap", () => {
  const cents = centsBetween(440, 466.1637615);
  assert.ok(Math.abs(cents - 100) < 0.5);
});

test("analyzePerformance diagnoses a stable A4 recording against an A4 reference", () => {
  const audio = sineWave(440, 2.2);
  const result = analyzePerformance({
    samples: audio.samples,
    sampleRate: audio.sampleRate,
    reference: {
      id: "a4-study",
      title: "A4 Stability Study",
      tempo: 72,
      notes: [
        { measure: 1, beat: 1, durationBeats: 4, midi: 69 },
        { measure: 2, beat: 1, durationBeats: 4, midi: 69 },
      ],
      techniqueMap: [{ measureStart: 1, measureEnd: 2, tags: ["tone", "intonation"] }],
    },
  });

  assert.equal(result.status, "complete");
  assert.ok(result.pitchFrames.length > 10);
  assert.ok(result.summary.pitchScore >= 90);
  assert.ok(result.segments.some((segment) => segment.issueTypes.includes("stable")));
});

test("analyzePerformance turns a sharp recording into learner-facing diagnosis", () => {
  const audio = sineWave(452, 2.2);
  const result = analyzePerformance({
    samples: audio.samples,
    sampleRate: audio.sampleRate,
    reference: {
      id: "a4-study",
      title: "A4 Stability Study",
      tempo: 72,
      notes: [{ measure: 1, beat: 1, durationBeats: 4, midi: 69 }],
      techniqueMap: [{ measureStart: 1, measureEnd: 1, tags: ["intonation"] }],
    },
  });

  assert.equal(result.status, "complete");
  assert.ok(result.summary.pitchScore < 85);
  assert.ok(result.segments.some((segment) => segment.issueTypes.includes("pitch-high")));
  assert.match(result.coach.topPriorities[0], /偏高|音准/);
});

test("analyzePerformance scores a matching melodic sequence note by note", () => {
  const sampleRate = 44_100;
  const notes = [
    { measure: 1, beat: 1, durationBeats: 1, midi: 60 },
    { measure: 1, beat: 2, durationBeats: 1, midi: 72 },
    { measure: 1, beat: 3, durationBeats: 1, midi: 64 },
    { measure: 1, beat: 4, durationBeats: 1, midi: 76 },
  ];
  const samples = synthesizeNotes(notes, sampleRate, 0.45);
  const result = analyzePerformance({
    samples,
    sampleRate,
    reference: {
      id: "wide-melody",
      title: "Wide Melody",
      tempo: 96,
      notes,
      techniqueMap: [{ measureStart: 1, measureEnd: 1, tags: ["intonation"] }],
    },
  });

  assert.equal(result.status, "complete");
  assert.ok(result.summary.pitchScore >= 86);
  assert.ok(result.segments.some((segment) => segment.issueTypes.includes("stable")));
});

test("analyzePerformance does not mark a borderline pitch score as stable", () => {
  const audio = sineWave(453, 2.2);
  const result = analyzePerformance({
    samples: audio.samples,
    sampleRate: audio.sampleRate,
    reference: {
      id: "a4-study",
      title: "A4 Stability Study",
      tempo: 72,
      notes: [{ measure: 1, beat: 1, durationBeats: 4, midi: 69 }],
      techniqueMap: [{ measureStart: 1, measureEnd: 1, tags: ["intonation"] }],
    },
  });

  assert.equal(result.status, "complete");
  assert.ok(result.summary.pitchScore < 86);
  assert.ok(!result.segments[0].issueTypes.includes("stable"));
  assert.notEqual(result.summary.primaryIssue, "stable");
});

test("analyzePerformance flags wrong-octave audio instead of folding it into tune", () => {
  const audio = sineWave(880, 2.2);
  const result = analyzePerformance({
    samples: audio.samples,
    sampleRate: audio.sampleRate,
    reference: {
      id: "a4-study",
      title: "A4 Stability Study",
      tempo: 72,
      notes: [{ measure: 1, beat: 1, durationBeats: 4, midi: 69 }],
      techniqueMap: [{ measureStart: 1, measureEnd: 1, tags: ["intonation"] }],
    },
  });

  assert.equal(result.status, "complete");
  assert.ok(result.summary.pitchScore < 50);
  assert.ok(result.segments[0].issueTypes.includes("pitch-octave"));
  assert.equal(result.summary.primaryIssue, "pitch-octave");
  assert.match(result.coach.topPriorities[0], /八度|音区|错音/);
  assert.match(result.coach.nextDrill, /八度|音区|目标音/);
});

test("analyzePerformance exposes a blocking practice gate for the exact problem measure", () => {
  const sampleRate = 44_100;
  const notes = [
    { measure: 1, beat: 1, durationBeats: 1, midi: 69 },
    { measure: 2, beat: 1, durationBeats: 1, midi: 69 },
    { measure: 3, beat: 1, durationBeats: 1, midi: 69 },
  ];
  const samples = synthesizeFrequencies([440, 452, 440], sampleRate, 0.8);
  const result = analyzePerformance({
    samples,
    sampleRate,
    reference: {
      id: "gate-study",
      title: "Gate Study",
      tempo: 72,
      notes,
      techniqueMap: [{ measureStart: 2, measureEnd: 2, tags: ["intonation"] }],
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(result.practiceGate.action, "retry");
  assert.equal(result.practiceGate.allowedToContinue, false);
  assert.deepEqual(result.practiceGate.range, { measureStart: 2, measureEnd: 2 });
  assert.deepEqual(result.practiceGate.issueTypes, ["pitch"]);
  assert.match(result.practiceGate.retryInstruction, /第 2-2 小节/);
  assert.equal(result.practiceGate.responseWindow.maxMeasuresAfterMistake, 2);
  assert.ok(result.practiceGate.passThreshold.minPitchScore >= 86);
  assert.match(result.practiceGate.parentSummary, /第 2-2 小节/);
});

test("analyzePerformance practice gate allows a stable retry to continue", () => {
  const audio = sineWave(440, 2.2);
  const result = analyzePerformance({
    samples: audio.samples,
    sampleRate: audio.sampleRate,
    reference: {
      id: "stable-gate",
      title: "Stable Gate",
      tempo: 72,
      notes: [{ measure: 8, beat: 1, durationBeats: 4, midi: 69 }],
      techniqueMap: [{ measureStart: 8, measureEnd: 8, tags: ["intonation"] }],
    },
    range: { measureStart: 8, measureEnd: 8 },
  });

  assert.equal(result.practiceGate.action, "continue");
  assert.equal(result.practiceGate.isBlocking, false);
  assert.equal(result.practiceGate.allowedToContinue, true);
  assert.deepEqual(result.practiceGate.range, { measureStart: 8, measureEnd: 8 });
  assert.match(result.practiceGate.learnerMessage, /可以/);
});

test("analyzePerformance blocks continuation when audio quality is too low", () => {
  const result = analyzePerformance({
    samples: new Float32Array(44_100),
    sampleRate: 44_100,
    reference: {
      id: "quiet-gate",
      title: "Quiet Gate",
      tempo: 72,
      notes: [{ measure: 4, beat: 1, durationBeats: 4, midi: 69 }],
      techniqueMap: [],
    },
    range: { measureStart: 4, measureEnd: 5 },
  });

  assert.equal(result.status, "error");
  assert.equal(result.practiceGate.action, "retry-audio");
  assert.equal(result.practiceGate.allowedToContinue, false);
  assert.deepEqual(result.practiceGate.issueTypes, ["insufficient-audio"]);
  assert.deepEqual(result.practiceGate.range, { measureStart: 4, measureEnd: 5 });
});

test("evaluatePracticeGate keeps the PRD gate contract independent from audio analysis", () => {
  const gate = evaluatePracticeGate({
    segment: {
      measureStart: 10,
      measureEnd: 11,
      issueTypes: ["rhythm-drag"],
      severity: "high",
      confidence: 0.7,
      learnerMessage: "节奏有一点拖。",
      practiceSuggestion: "第 10-11 小节 打开节拍器重练。",
    },
    summary: {
      pitchScore: 92,
      rhythmScore: 66,
    },
    reference: {
      id: "rhythm-study",
      title: "Rhythm Study",
      notes: [{ measure: 10, beat: 1, durationBeats: 1, midi: 69 }],
    },
  });

  assert.equal(gate.action, "retry");
  assert.equal(gate.isBlocking, true);
  assert.deepEqual(gate.range, { measureStart: 10, measureEnd: 11 });
  assert.deepEqual(gate.issueTypes, ["rhythm"]);
  assert.equal(gate.passThreshold.minRhythmScore, 72);
  assert.match(gate.parentSummary, /节奏/);
});

test("evaluatePracticeGate reports threshold misses even when the segment is locally stable", () => {
  const gate = evaluatePracticeGate({
    segment: {
      measureStart: 1,
      measureEnd: 1,
      issueTypes: ["stable"],
      severity: "low",
      confidence: 0.82,
      learnerMessage: "stable segment",
      practiceSuggestion: "retry the bar",
    },
    summary: {
      pitchScore: 84,
      rhythmScore: 96,
    },
    reference: {
      id: "threshold-study",
      title: "Threshold Study",
      notes: [{ measure: 1, beat: 1, durationBeats: 1, midi: 69 }],
    },
  });

  assert.equal(gate.action, "retry");
  assert.equal(gate.allowedToContinue, false);
  assert.deepEqual(gate.issueTypes, ["pitch"]);
  assert.ok(gate.parentSummary.length > 0);
});

test("summarizePracticeSession reports retries, improvement, and lesson readiness", () => {
  const retryGate = {
    pieceTitle: "Gate Study",
    action: "retry",
    isBlocking: true,
    allowedToContinue: false,
    range: { measureStart: 2, measureEnd: 2 },
    issueTypes: ["pitch"],
    confidence: 0.6,
  };
  const passGate = {
    pieceTitle: "Gate Study",
    action: "continue",
    isBlocking: false,
    allowedToContinue: true,
    range: { measureStart: 2, measureEnd: 2 },
    issueTypes: [],
    confidence: 0.92,
  };

  const summary = summarizePracticeSession({
    gates: [retryGate, retryGate, passGate],
  });

  assert.equal(summary.status, "ready-to-continue");
  assert.equal(summary.attempts, 3);
  assert.equal(summary.retryCount, 2);
  assert.deepEqual(summary.repeatedProblemRanges[0].range, { measureStart: 2, measureEnd: 2 });
  assert.deepEqual(summary.improvedRanges[0].range, { measureStart: 2, measureEnd: 2 });
  assert.match(summary.parentMessage, /2 次纠错回练/);
  assert.match(summary.teacherMessage, /多次阻断|第 2-2 小节/);
});

test("summarizePracticeSession keeps the student blocked when the latest gate needs retry", () => {
  const summary = summarizePracticeSession({
    gates: [
      {
        pieceTitle: "Gate Study",
        action: "retry",
        isBlocking: true,
        allowedToContinue: false,
        range: { measureStart: 4, measureEnd: 5 },
        issueTypes: ["rhythm"],
        confidence: 0.51,
      },
    ],
  });

  assert.equal(summary.status, "needs-retry");
  assert.equal(summary.currentGate.allowedToContinue, false);
  assert.match(summary.parentMessage, /第 4-5 小节/);
  assert.match(summary.teacherMessage, /仍未放行/);
});

function synthesizeNotes(notes, sampleRate, secondsPerNote) {
  const samples = new Float32Array(Math.floor(sampleRate * secondsPerNote * notes.length));
  notes.forEach((note, noteIndex) => {
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    const start = Math.floor(noteIndex * secondsPerNote * sampleRate);
    const end = Math.floor((noteIndex + 1) * secondsPerNote * sampleRate);
    for (let index = start; index < end; index += 1) {
      const localTime = (index - start) / sampleRate;
      const envelope = Math.min(1, localTime * 18, ((end - index) / sampleRate) * 18);
      samples[index] = Math.sin(2 * Math.PI * frequency * localTime) * 0.75 * envelope;
    }
  });
  return samples;
}

function synthesizeFrequencies(frequencies, sampleRate, secondsPerNote) {
  const samples = new Float32Array(Math.floor(sampleRate * secondsPerNote * frequencies.length));
  frequencies.forEach((frequency, noteIndex) => {
    const start = Math.floor(noteIndex * secondsPerNote * sampleRate);
    const end = Math.floor((noteIndex + 1) * secondsPerNote * sampleRate);
    for (let index = start; index < end; index += 1) {
      const localTime = (index - start) / sampleRate;
      const envelope = Math.min(1, localTime * 18, ((end - index) / sampleRate) * 18);
      samples[index] = Math.sin(2 * Math.PI * frequency * localTime) * 0.75 * envelope;
    }
  });
  return samples;
}
