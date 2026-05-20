import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzePerformance,
  centsBetween,
  frequencyToMidi,
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
