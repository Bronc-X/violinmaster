import { analyzePerformance, summarizePracticeSession } from "./analysis.mjs";

const DEFAULT_PRACTICE_OPTIONS = {
  unit: "measure",
  spanMeasures: 1,
  startMeasure: null,
  endMeasure: null,
};

export function createPracticeSession({ reference, options = {} }) {
  const resolvedOptions = resolveOptions(reference, options);
  const currentRange = {
    measureStart: resolvedOptions.startMeasure,
    measureEnd: Math.min(
      resolvedOptions.endMeasure,
      resolvedOptions.startMeasure + resolvedOptions.spanMeasures - 1,
    ),
  };

  return {
    pieceId: reference.id,
    pieceTitle: reference.title,
    unit: resolvedOptions.unit,
    spanMeasures: resolvedOptions.spanMeasures,
    bounds: {
      measureStart: resolvedOptions.startMeasure,
      measureEnd: resolvedOptions.endMeasure,
    },
    currentRange,
    gates: [],
    status: "ready",
    lastGate: null,
    nextPrompt: buildStartPrompt(currentRange),
  };
}

export function applyPracticeGate(session, gate) {
  const gates = [...session.gates, gate];
  if (!gate.allowedToContinue) {
    return {
      ...session,
      gates,
      currentRange: gate.range,
      status: gate.action === "retry-audio" ? "needs-audio-retry" : "needs-retry",
      lastGate: gate,
      nextPrompt: gate.retryInstruction,
      summary: summarizePracticeSession({ gates, pieceTitle: session.pieceTitle }),
    };
  }

  const nextRange = nextPracticeRange(session, gate.range);
  const completed = nextRange === null;
  return {
    ...session,
    gates,
    currentRange: completed ? gate.range : nextRange,
    status: completed ? "complete" : "ready",
    lastGate: gate,
    nextPrompt: completed
      ? "本次练习范围已经完成，可以查看总结。"
      : buildStartPrompt(nextRange),
    summary: summarizePracticeSession({ gates, pieceTitle: session.pieceTitle }),
  };
}

export function analyzePracticeAttempt({ session, reference, samples, sampleRate }) {
  const result = analyzePerformance({
    samples,
    sampleRate,
    reference,
    range: session.currentRange,
  });
  const nextSession = applyPracticeGate(session, result.practiceGate);
  return {
    result,
    session: nextSession,
    gate: result.practiceGate,
  };
}

export function selectPracticeRange(session, range) {
  const bounded = boundRange(range, session.bounds);
  return {
    ...session,
    currentRange: bounded,
    status: "ready",
    nextPrompt: buildStartPrompt(bounded),
  };
}

function resolveOptions(reference, options) {
  const merged = { ...DEFAULT_PRACTICE_OPTIONS, ...options };
  const measures = measuresFor(reference);
  const firstMeasure = measures[0] ?? 1;
  const lastMeasure = measures.at(-1) ?? firstMeasure;
  return {
    unit: merged.unit,
    spanMeasures: Math.max(1, Number(merged.spanMeasures) || 1),
    startMeasure: merged.startMeasure ?? firstMeasure,
    endMeasure: merged.endMeasure ?? lastMeasure,
  };
}

function measuresFor(reference) {
  return [...new Set((reference.notes ?? []).map((note) => note.measure))].sort((a, b) => a - b);
}

function nextPracticeRange(session, currentRange) {
  const nextStart = currentRange.measureEnd + 1;
  if (nextStart > session.bounds.measureEnd) return null;
  return {
    measureStart: nextStart,
    measureEnd: Math.min(session.bounds.measureEnd, nextStart + session.spanMeasures - 1),
  };
}

function boundRange(range, bounds) {
  const measureStart = clamp(
    Math.min(range.measureStart, range.measureEnd),
    bounds.measureStart,
    bounds.measureEnd,
  );
  const measureEnd = clamp(
    Math.max(range.measureStart, range.measureEnd),
    bounds.measureStart,
    bounds.measureEnd,
  );
  return { measureStart, measureEnd };
}

function buildStartPrompt(range) {
  return `请练习第 ${range.measureStart}-${range.measureEnd} 小节。`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
