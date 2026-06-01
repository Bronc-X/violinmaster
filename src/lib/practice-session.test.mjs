import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzePracticeAttempt,
  applyPracticeGate,
  createPracticeSession,
  selectPracticeRange,
} from "./practice-session.mjs";

const reference = {
  id: "session-study",
  title: "Session Study",
  notes: Array.from({ length: 4 }, (_, index) => ({
    measure: index + 1,
    beat: 1,
    durationBeats: 4,
    midi: 69,
  })),
};

test("createPracticeSession starts at the first bounded practice range", () => {
  const session = createPracticeSession({ reference, options: { spanMeasures: 2 } });

  assert.equal(session.status, "ready");
  assert.deepEqual(session.bounds, { measureStart: 1, measureEnd: 4 });
  assert.deepEqual(session.currentRange, { measureStart: 1, measureEnd: 2 });
  assert.match(session.nextPrompt, /第 1-2 小节/);
});

test("applyPracticeGate keeps the session blocked on retry", () => {
  const session = createPracticeSession({ reference });
  const retryGate = makeGate({
    action: "retry",
    allowedToContinue: false,
    range: { measureStart: 1, measureEnd: 1 },
    retryInstruction: "第 1-1 小节 先慢速重练。",
  });
  const next = applyPracticeGate(session, retryGate);

  assert.equal(next.status, "needs-retry");
  assert.deepEqual(next.currentRange, { measureStart: 1, measureEnd: 1 });
  assert.equal(next.nextPrompt, "第 1-1 小节 先慢速重练。");
  assert.equal(next.summary.status, "needs-retry");
});

test("applyPracticeGate advances after a stable retry passes", () => {
  const session = createPracticeSession({ reference });
  const passed = applyPracticeGate(
    session,
    makeGate({
      action: "continue",
      allowedToContinue: true,
      isBlocking: false,
      range: { measureStart: 1, measureEnd: 1 },
    }),
  );

  assert.equal(passed.status, "ready");
  assert.deepEqual(passed.currentRange, { measureStart: 2, measureEnd: 2 });
  assert.match(passed.nextPrompt, /第 2-2 小节/);
  assert.equal(passed.summary.status, "ready-to-continue");
});

test("applyPracticeGate marks the session complete at the final range", () => {
  const session = createPracticeSession({
    reference,
    options: { startMeasure: 4, endMeasure: 4 },
  });
  const completed = applyPracticeGate(
    session,
    makeGate({
      action: "continue",
      allowedToContinue: true,
      isBlocking: false,
      range: { measureStart: 4, measureEnd: 4 },
    }),
  );

  assert.equal(completed.status, "complete");
  assert.deepEqual(completed.currentRange, { measureStart: 4, measureEnd: 4 });
  assert.match(completed.nextPrompt, /总结/);
});

test("selectPracticeRange clamps manual ranges to session bounds", () => {
  const session = createPracticeSession({
    reference,
    options: { startMeasure: 2, endMeasure: 4 },
  });
  const selected = selectPracticeRange(session, { measureStart: 1, measureEnd: 9 });

  assert.deepEqual(selected.currentRange, { measureStart: 2, measureEnd: 4 });
  assert.equal(selected.status, "ready");
});

test("analyzePracticeAttempt analyzes the current range and advances only after a pass", () => {
  const sampleRate = 44_100;
  const session = createPracticeSession({ reference });
  const failedAttempt = analyzePracticeAttempt({
    session,
    reference,
    samples: sineWave(452, 1.2, sampleRate),
    sampleRate,
  });

  assert.equal(failedAttempt.gate.action, "retry");
  assert.equal(failedAttempt.session.status, "needs-retry");
  assert.deepEqual(failedAttempt.session.currentRange, { measureStart: 1, measureEnd: 1 });

  const passedAttempt = analyzePracticeAttempt({
    session: failedAttempt.session,
    reference,
    samples: sineWave(440, 1.2, sampleRate),
    sampleRate,
  });

  assert.equal(passedAttempt.gate.action, "continue");
  assert.equal(passedAttempt.session.status, "ready");
  assert.deepEqual(passedAttempt.session.currentRange, { measureStart: 2, measureEnd: 2 });
  assert.equal(passedAttempt.session.summary.improvedRanges.length, 1);
});

function makeGate({
  action,
  allowedToContinue,
  isBlocking = !allowedToContinue,
  range,
  retryInstruction = "进入下一小节。",
}) {
  return {
    pieceTitle: "Session Study",
    action,
    isBlocking,
    allowedToContinue,
    range,
    issueTypes: allowedToContinue ? [] : ["pitch"],
    confidence: allowedToContinue ? 0.9 : 0.62,
    retryInstruction,
  };
}

function sineWave(frequency, seconds, sampleRate) {
  const samples = new Float32Array(Math.floor(seconds * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.8;
  }
  return samples;
}
