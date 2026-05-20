const A4_FREQUENCY = 440;
const A4_MIDI = 69;
const FRAME_SIZE = 2048;
const HOP_SIZE = 1024;
const MIN_FREQUENCY = 130;
const MAX_FREQUENCY = 1400;
const MIN_RMS = 0.015;

export function frequencyToMidi(frequency) {
  return Math.round(69 + 12 * Math.log2(frequency / A4_FREQUENCY));
}

export function midiToFrequency(midi) {
  return A4_FREQUENCY * 2 ** ((midi - A4_MIDI) / 12);
}

export function centsBetween(referenceFrequency, observedFrequency) {
  return 1200 * Math.log2(observedFrequency / referenceFrequency);
}

export function analyzePerformance({ samples, sampleRate, reference, range }) {
  const pitchFrames = extractPitchFrames(samples, sampleRate);
  if (pitchFrames.length < 4) {
    return {
      status: "error",
      error: "录音里可用的小提琴单音太少，请靠近麦克风并重新录制。",
      pitchFrames,
      summary: emptySummary(reference),
      segments: [],
      coach: {
        topPriorities: ["这次录音的有效音高太少，先重新录一遍更稳。"],
        nextDrill: "选择 2-4 小节，靠近麦克风，用中等音量重新录制。",
        encouragement: "先把声音采清楚，后面的诊断才会可靠。",
      },
    };
  }

  const notes = filterNotes(reference.notes, range);
  const averageConfidence =
    pitchFrames.reduce((sum, frame) => sum + frame.confidence, 0) / pitchFrames.length;
  const pitchProfile = comparePitchToNotes(pitchFrames, notes, samples.length / sampleRate);
  const pitchOffsetCents = pitchProfile.averageOffsetCents;
  const pitchScore = pitchProfile.score;
  const rhythmScore = estimateRhythmScore(samples, sampleRate, reference.tempo);
  const issueTypes = classifyIssues(pitchOffsetCents, pitchScore, rhythmScore);
  const measureStart = notes[0]?.measure ?? 1;
  const measureEnd = notes.at(-1)?.measure ?? measureStart;
  const techniqueTags = techniqueTagsForRange(reference.techniqueMap, measureStart, measureEnd);
  const learnerMessage = buildLearnerMessage(issueTypes, techniqueTags);
  const practiceSuggestion = buildPracticeSuggestion(issueTypes, techniqueTags, measureStart, measureEnd);
  const severity = pitchScore < 70 || rhythmScore < 70 ? "high" : pitchScore < 86 ? "medium" : "low";

  const segment = {
    measureStart,
    measureEnd,
    issueTypes,
    severity,
    confidence: round2(averageConfidence),
    raw: {
      pitchOffsetCents: Math.round(pitchOffsetCents),
    },
    learnerMessage,
    practiceSuggestion,
  };

  return {
    status: "complete",
    pitchFrames,
    summary: {
      pieceTitle: reference.title,
      pitchScore: Math.round(pitchScore),
      rhythmScore: Math.round(rhythmScore),
      stabilityScore: Math.round((pitchScore + rhythmScore + averageConfidence * 100) / 3),
      takeDurationSeconds: round2(samples.length / sampleRate),
      primaryIssue: issueTypes[0],
    },
    segments: [segment],
    coach: buildCoach([segment], {
      pitchScore,
      rhythmScore,
      measureStart,
      measureEnd,
    }),
  };
}

function extractPitchFrames(samples, sampleRate) {
  const frames = [];
  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    const frame = samples.subarray(start, start + FRAME_SIZE);
    const rms = rootMeanSquare(frame);
    if (rms < MIN_RMS) continue;

    const pitch = detectPitch(frame, sampleRate);
    if (!pitch) continue;
    frames.push({
      time: round2(start / sampleRate),
      frequency: round2(pitch.frequency),
      midi: frequencyToMidi(pitch.frequency),
      confidence: round2(pitch.confidence),
      rms: round2(rms),
    });
  }
  return smoothOutliers(frames);
}

function comparePitchToNotes(pitchFrames, notes, durationSeconds) {
  if (!notes.length || !pitchFrames.length) {
    return { averageOffsetCents: 0, score: 0 };
  }

  const totalBeats = notes.reduce((sum, note) => sum + note.durationBeats, 0);
  let elapsedBeat = 0;
  const noteWindows = notes.map((note) => {
    const start = (elapsedBeat / totalBeats) * durationSeconds;
    elapsedBeat += note.durationBeats;
    const end = (elapsedBeat / totalBeats) * durationSeconds;
    return { ...note, start, end };
  });

  const offsets = [];
  for (const frame of pitchFrames) {
    const expected =
      noteWindows.find((note) => frame.time >= note.start && frame.time < note.end) ??
      noteWindows.at(-1);
    offsets.push(centsBetween(midiToFrequency(expected.midi), frame.frequency));
  }

  const centeredOffsets = offsets.map(normalizeCentsToNearestUnison);
  const absoluteOffsets = centeredOffsets.map((offset) => Math.abs(offset));
  const averageAbsOffset = trimmedMean(absoluteOffsets, 0.12);
  const averageOffsetCents = trimmedMean(centeredOffsets, 0.12);
  return {
    averageOffsetCents,
    score: clamp(100 - averageAbsOffset * 1.35, 0, 100),
  };
}

function detectPitch(frame, sampleRate) {
  const minLag = Math.floor(sampleRate / MAX_FREQUENCY);
  const maxLag = Math.floor(sampleRate / MIN_FREQUENCY);
  let bestLag = 0;
  let bestCorrelation = -Infinity;
  const energy = frame.reduce((sum, value) => sum + value * value, 0);
  if (energy <= 0) return null;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    for (let index = 0; index < frame.length - lag; index += 1) {
      correlation += frame[index] * frame[index + lag];
    }
    correlation /= energy;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (!bestLag || bestCorrelation < 0.35) return null;
  return {
    frequency: sampleRate / bestLag,
    confidence: clamp(bestCorrelation, 0, 1),
  };
}

function estimateRhythmScore(samples, sampleRate, tempo) {
  const windowSize = Math.floor(sampleRate * 0.05);
  const envelope = [];
  for (let start = 0; start + windowSize <= samples.length; start += windowSize) {
    envelope.push(rootMeanSquare(samples.subarray(start, start + windowSize)));
  }
  if (envelope.length < 8) return 78;

  const average = envelope.reduce((sum, value) => sum + value, 0) / envelope.length;
  const peaks = envelope.filter((value, index) => {
    const previous = envelope[index - 1] ?? 0;
    const next = envelope[index + 1] ?? 0;
    return value > average * 1.12 && value >= previous && value >= next;
  });
  const expectedBeatCount = Math.max(1, Math.round((samples.length / sampleRate / 60) * tempo));
  const peakRatio = Math.min(peaks.length, expectedBeatCount) / expectedBeatCount;
  return clamp(72 + peakRatio * 24, 60, 96);
}

function classifyIssues(pitchOffsetCents, pitchScore, rhythmScore) {
  const issueTypes = [];
  if (pitchOffsetCents > 28) issueTypes.push("pitch-high");
  if (pitchOffsetCents < -28) issueTypes.push("pitch-low");
  if (rhythmScore < 72) issueTypes.push("rhythm-drag");
  if (pitchScore >= 86 && rhythmScore >= 72) issueTypes.push("stable");
  return issueTypes.length ? issueTypes : ["stable"];
}

function buildLearnerMessage(issueTypes, techniqueTags) {
  if (issueTypes.includes("pitch-high")) {
    return techniqueTags.includes("shifting")
      ? "这一段换把落点偏高，先慢慢找到目标音再加速。"
      : "这一段音准整体有一点偏高，左手指距可以稍微收回来。";
  }
  if (issueTypes.includes("pitch-low")) {
    return techniqueTags.includes("fourth-finger")
      ? "四指相关的音容易偏低，先保持手型再落指。"
      : "这一段音准整体有一点偏低，目标音需要再向上找一点。";
  }
  if (issueTypes.includes("rhythm-drag")) {
    return "节奏有一点拖，换弓和进入拍点需要更果断。";
  }
  return "这一段整体稳定，可以继续保持音色和拍点。";
}

function buildPracticeSuggestion(issueTypes, techniqueTags, measureStart, measureEnd) {
  const range = `第 ${measureStart}-${measureEnd} 小节`;
  if (issueTypes.includes("pitch-high") || issueTypes.includes("pitch-low")) {
    if (techniqueTags.includes("shifting")) {
      return `${range} 先慢速练换把落点，每次停在目标音确认后再继续。`;
    }
    return `${range} 用慢速长音检查手指距离，稳定后再恢复原速。`;
  }
  if (issueTypes.includes("rhythm-drag")) {
    return `${range} 打开节拍器，用更小的弓段练 4 次。`;
  }
  return `${range} 已经比较稳，下一遍可以把注意力放在音色和连贯性上。`;
}

function buildCoach(segments, summary) {
  const first = segments[0];
  const topPriorities = [];
  if (first.issueTypes.includes("pitch-high") || first.issueTypes.includes("pitch-low")) {
    topPriorities.push(`音准是当前第一优先级：${first.learnerMessage}`);
  }
  if (first.issueTypes.includes("rhythm-drag")) {
    topPriorities.push("节奏需要更靠近拍点，尤其是进入和换弓的时候。");
  }
  if (!topPriorities.length) {
    topPriorities.push("这一遍很稳定，下一步可以提升音色密度和句子连贯性。");
  }

  return {
    topPriorities,
    nextDrill: first.practiceSuggestion,
    encouragement:
      summary.pitchScore >= 86
        ? "这次的基础音准已经站住了，可以进入更细的音色练习。"
        : "问题集中在清晰的小范围里，适合用短小节反复修正。",
  };
}

function filterNotes(notes, range) {
  if (!range) return notes;
  return notes.filter(
    (note) => note.measure >= range.measureStart && note.measure <= range.measureEnd,
  );
}

function techniqueTagsForRange(techniqueMap = [], measureStart, measureEnd) {
  return [
    ...new Set(
      techniqueMap
        .filter((entry) => entry.measureStart <= measureEnd && entry.measureEnd >= measureStart)
        .flatMap((entry) => entry.tags),
    ),
  ];
}

function rootMeanSquare(values) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function smoothOutliers(frames) {
  if (frames.length < 3) return frames;
  return frames.filter((frame, index) => {
    const neighbors = frames.slice(Math.max(0, index - 2), index + 3);
    const localMedian = median(neighbors.map((neighbor) => neighbor.frequency));
    return Math.abs(centsBetween(localMedian, frame.frequency)) < 90;
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function trimmedMean(values, trimRatio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * trimRatio);
  const trimmed = sorted.slice(trim, sorted.length - trim || sorted.length);
  return trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
}

function normalizeCentsToNearestUnison(cents) {
  if (!Number.isFinite(cents)) return 0;
  let normalized = cents;
  while (normalized > 600) normalized -= 1200;
  while (normalized < -600) normalized += 1200;
  return normalized;
}

function emptySummary(reference) {
  return {
    pieceTitle: reference.title,
    pitchScore: 0,
    rhythmScore: 0,
    stabilityScore: 0,
    takeDurationSeconds: 0,
    primaryIssue: "insufficient-audio",
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
