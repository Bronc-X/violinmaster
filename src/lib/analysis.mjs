const A4_FREQUENCY = 440;
const A4_MIDI = 69;
const FRAME_SIZE = 2048;
const HOP_SIZE = 1024;
const MIN_FREQUENCY = 130;
const MAX_FREQUENCY = 1400;
const MIN_RMS = 0.015;
const DEFAULT_GATE_CONFIG = {
  responseWindowMeasures: 2,
  minPitchScore: 86,
  minRhythmScore: 72,
  minConfidence: 0.45,
  pitchToleranceCents: 28,
  timingToleranceMs: 120,
};

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
      practiceGate: buildAudioQualityGate({ reference, range }),
      coach: {
        topPriorities: ["这次录音的有效音高太少，先重新录一遍更稳。"],
        nextDrill: "选择 2-4 小节，靠近麦克风，用中等音量重新录制。",
        encouragement: "先把声音采清楚，后面的诊断才会可靠。",
      },
    };
  }

  const notes = filterNotes(reference.notes, range);
  const durationSeconds = samples.length / sampleRate;
  const averageConfidence =
    pitchFrames.reduce((sum, frame) => sum + frame.confidence, 0) / pitchFrames.length;
  const noteWindows = createNoteWindows(notes, durationSeconds);
  const pitchProfile = comparePitchFramesToWindows(pitchFrames, noteWindows);
  const pitchOffsetCents = pitchProfile.averageOffsetCents;
  const pitchScore = pitchProfile.score;
  const rhythmScore = estimateRhythmScore(samples, sampleRate, reference.tempo);
  const issueTypes = classifyIssues(pitchOffsetCents, pitchScore, rhythmScore, pitchProfile);
  const measureStart = notes[0]?.measure ?? 1;
  const measureEnd = notes.at(-1)?.measure ?? measureStart;
  const overallSegment = buildDiagnosisSegment({
    measureStart,
    measureEnd,
    issueTypes,
    pitchProfile,
    pitchScore,
    rhythmScore,
    confidence: averageConfidence,
    reference,
  });
  const measureSegments = buildMeasureSegments({
    noteWindows,
    pitchFrames,
    rhythmScore,
    reference,
  });
  const segments = prioritizeSegments(measureSegments.length ? measureSegments : [overallSegment]);
  const summary = {
    pieceTitle: reference.title,
    pitchScore: Math.round(pitchScore),
    rhythmScore: Math.round(rhythmScore),
    stabilityScore: Math.round((pitchScore + rhythmScore + averageConfidence * 100) / 3),
    takeDurationSeconds: round2(durationSeconds),
    primaryIssue: segments[0]?.issueTypes[0] ?? issueTypes[0],
  };
  const practiceGate = evaluatePracticeGate({ segment: segments[0], summary, reference, range });

  return {
    status: "complete",
    pitchFrames,
    summary,
    segments,
    practiceGate,
    coach: buildCoach(segments, {
      pitchScore,
      rhythmScore,
      measureStart,
      measureEnd,
    }),
  };
}

export function evaluatePracticeGate({ segment, summary = {}, reference = {}, range, config }) {
  if (!segment) {
    return buildAudioQualityGate({ reference, range, config });
  }
  const gateConfig = resolveGateConfig(config);
  const focusRange = buildGateRange({ segment, reference, range, gateConfig });
  const segmentIssueTypes = gateIssueTypesFor(segment.issueTypes);
  const confidence = segment.confidence ?? 0;
  const confidenceTooLow = confidence < gateConfig.minConfidence;
  const pitchTooLow = (summary.pitchScore ?? 0) < gateConfig.minPitchScore;
  const rhythmTooLow = (summary.rhythmScore ?? 0) < gateConfig.minRhythmScore;
  const segmentStable = segment.issueTypes.includes("stable") && segmentIssueTypes.length === 0;
  const mustRetry = confidenceTooLow || pitchTooLow || rhythmTooLow || !segmentStable;
  const action = confidenceTooLow ? "retry-audio" : mustRetry ? "retry" : "continue";
  const issueTypes =
    action === "continue"
      ? []
      : gateIssueTypesWithThresholds(segmentIssueTypes, {
          confidenceTooLow,
          pitchTooLow,
          rhythmTooLow,
        });
  const learnerMessage =
    action === "continue"
      ? "可以，这次重练已经稳定，可以进入下一乐句。"
      : segment.learnerMessage;
  const retryInstruction =
    action === "continue"
      ? "进入下一小节或下一乐句，继续保持当前音准和拍点。"
      : focusRetryInstruction(segment.practiceSuggestion, focusRange);

  return {
    pieceId: reference.id,
    pieceTitle: reference.title,
    action,
    isBlocking: action !== "continue",
    allowedToContinue: action === "continue",
    range: focusRange,
    issueTypes,
    severity: segment.severity,
    confidence: round2(confidence),
    responseWindow: buildResponseWindow(focusRange, gateConfig),
    learnerMessage,
    retryInstruction,
    passThreshold: buildPassThreshold(gateConfig),
    parentSummary: buildParentSummary(action, issueTypes, focusRange),
  };
}

export function summarizePracticeSession({ gates = [], pieceTitle } = {}) {
  const validGates = gates.filter(Boolean);
  if (!validGates.length) {
    return {
      status: "empty",
      attempts: 0,
      retryCount: 0,
      completedCount: 0,
      repeatedProblemRanges: [],
      improvedRanges: [],
      currentGate: null,
      parentMessage: "还没有可总结的练习记录。",
      teacherMessage: "暂无本次课后练习数据。",
    };
  }

  const currentGate = validGates.at(-1);
  const retryGates = validGates.filter((gate) => gate.isBlocking);
  const completedGates = validGates.filter((gate) => gate.allowedToContinue);
  const repeatedProblemRanges = repeatedRanges(retryGates);
  const improvedRanges = rangesImprovedAfterRetry(validGates);
  const status = currentGate.allowedToContinue ? "ready-to-continue" : "needs-retry";

  return {
    status,
    attempts: validGates.length,
    retryCount: retryGates.length,
    completedCount: completedGates.length,
    repeatedProblemRanges,
    improvedRanges,
    currentGate,
    parentMessage: buildSessionParentMessage({
      status,
      pieceTitle: pieceTitle ?? currentGate.pieceTitle,
      retryCount: retryGates.length,
      improvedRanges,
      currentGate,
    }),
    teacherMessage: buildSessionTeacherMessage({
      repeatedProblemRanges,
      improvedRanges,
      currentGate,
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
  return comparePitchFramesToWindows(pitchFrames, createNoteWindows(notes, durationSeconds));
}

function createNoteWindows(notes, durationSeconds) {
  if (!notes.length) return [];
  const totalBeats = notes.reduce((sum, note) => sum + note.durationBeats, 0);
  let elapsedBeat = 0;
  return notes.map((note) => {
    const start = (elapsedBeat / totalBeats) * durationSeconds;
    elapsedBeat += note.durationBeats;
    const end = (elapsedBeat / totalBeats) * durationSeconds;
    return { ...note, start, end };
  });
}

function comparePitchFramesToWindows(pitchFrames, noteWindows) {
  if (!noteWindows.length || !pitchFrames.length) {
    return { averageOffsetCents: 0, averageAbsOffsetCents: 0, octaveErrorRatio: 0, score: 0 };
  }

  const offsets = [];
  let octaveErrors = 0;
  for (const frame of pitchFrames) {
    const expected =
      noteWindows.find((note) => frame.time >= note.start && frame.time < note.end) ??
      noteWindows.at(-1);
    const rawOffset = centsBetween(midiToFrequency(expected.midi), frame.frequency);
    offsets.push(rawOffset);
    if (Math.abs(rawOffset) >= 650) octaveErrors += 1;
  }

  const centeredOffsets = offsets.map(normalizeCentsToNearestUnison);
  const absoluteOffsets = centeredOffsets.map((offset) => Math.abs(offset));
  const averageAbsOffset = trimmedMean(absoluteOffsets, 0.12);
  const averageOffsetCents = trimmedMean(centeredOffsets, 0.12);
  const octaveErrorRatio = octaveErrors / offsets.length;
  return {
    averageOffsetCents,
    averageAbsOffsetCents: averageAbsOffset,
    octaveErrorRatio,
    score: clamp(100 - averageAbsOffset * 1.35 - octaveErrorRatio * 90, 0, 100),
  };
}

function buildMeasureSegments({ noteWindows, pitchFrames, rhythmScore, reference }) {
  const measureNumbers = [...new Set(noteWindows.map((note) => note.measure))];
  return measureNumbers
    .map((measure) => {
      const measureWindows = noteWindows.filter((note) => note.measure === measure);
      const measureStartTime = measureWindows[0]?.start ?? 0;
      const measureEndTime = measureWindows.at(-1)?.end ?? measureStartTime;
      const frames = pitchFrames.filter(
        (frame) => frame.time >= measureStartTime && frame.time < measureEndTime,
      );
      if (frames.length < 2) return null;
      const pitchProfile = comparePitchFramesToWindows(frames, measureWindows);
      const pitchScore = pitchProfile.score;
      const confidence = frames.reduce((sum, frame) => sum + frame.confidence, 0) / frames.length;
      const issueTypes = classifyIssues(
        pitchProfile.averageOffsetCents,
        pitchScore,
        rhythmScore,
        pitchProfile,
      );
      return buildDiagnosisSegment({
        measureStart: measure,
        measureEnd: measure,
        issueTypes,
        pitchProfile,
        pitchScore,
        rhythmScore,
        confidence,
        reference,
      });
    })
    .filter(Boolean);
}

function buildDiagnosisSegment({
  measureStart,
  measureEnd,
  issueTypes,
  pitchProfile,
  pitchScore,
  rhythmScore,
  confidence,
  reference,
}) {
  const techniqueTags = techniqueTagsForRange(reference.techniqueMap, measureStart, measureEnd);
  const learnerMessage = buildLearnerMessage(issueTypes, techniqueTags);
  const practiceSuggestion = buildPracticeSuggestion(issueTypes, techniqueTags, measureStart, measureEnd);
  const severity = pitchScore < 70 || rhythmScore < 70 ? "high" : pitchScore < 86 ? "medium" : "low";
  return {
    measureStart,
    measureEnd,
    issueTypes,
    severity,
    confidence: round2(confidence),
    raw: {
      pitchOffsetCents: Math.round(pitchProfile.averageOffsetCents),
    },
    learnerMessage,
    practiceSuggestion,
  };
}

function prioritizeSegments(segments) {
  return [...segments].sort((left, right) => {
    const leftScore = segmentPriority(left);
    const rightScore = segmentPriority(right);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return left.measureStart - right.measureStart;
  });
}

function segmentPriority(segment) {
  if (segment.issueTypes.includes("pitch-octave")) return 4;
  if (segment.severity === "high") return 3;
  if (segment.severity === "medium") return 2;
  if (!segment.issueTypes.includes("stable")) return 1;
  return 0;
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

function classifyIssues(pitchOffsetCents, pitchScore, rhythmScore, pitchProfile) {
  const issueTypes = [];
  if (pitchProfile.octaveErrorRatio >= 0.35) issueTypes.push("pitch-octave");
  if (pitchOffsetCents > 28) issueTypes.push("pitch-high");
  if (pitchOffsetCents < -28) issueTypes.push("pitch-low");
  if (rhythmScore < 72) issueTypes.push("rhythm-drag");
  if (pitchScore >= 86 && rhythmScore >= 72) issueTypes.push("stable");
  return issueTypes.length ? issueTypes : ["stable"];
}

function buildLearnerMessage(issueTypes, techniqueTags) {
  if (issueTypes.includes("pitch-octave")) {
    return "这段录音的音区和谱面目标相差接近一个八度，先确认把位和目标音名，再重新录一遍。";
  }
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
  if (issueTypes.includes("pitch-octave")) {
    return `第 ${measureStart}-${measureEnd} 小节 先只拉每小节第一个目标音，确认音区和八度后，再接回完整乐句。`;
  }
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
  if (first.issueTypes.includes("pitch-octave")) {
    topPriorities.push(`先修正音区或错音：${first.learnerMessage}`);
  }
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

function buildAudioQualityGate({ reference = {}, range, config } = {}) {
  const gateConfig = resolveGateConfig(config);
  const fallbackRange = normalizeRange(range) ?? firstMeasuresRange(reference, gateConfig);
  return {
    pieceId: reference.id,
    pieceTitle: reference.title,
    action: "retry-audio",
    isBlocking: true,
    allowedToContinue: false,
    range: fallbackRange,
    issueTypes: ["insufficient-audio"],
    severity: "high",
    confidence: 0,
    responseWindow: buildResponseWindow(fallbackRange, gateConfig),
    learnerMessage: "录音里可用的小提琴单音太少，请靠近麦克风并重新录制。",
    retryInstruction: `回到第 ${fallbackRange.measureStart}-${fallbackRange.measureEnd} 小节，用中等音量重新拉一遍。`,
    passThreshold: buildPassThreshold(gateConfig),
    parentSummary: "这次音频质量不足，系统没有放行继续练习，避免给出不可靠判断。",
  };
}

function resolveGateConfig(config = {}) {
  return {
    ...DEFAULT_GATE_CONFIG,
    ...config,
  };
}

function buildGateRange({ segment, reference, range, gateConfig }) {
  const explicitRange = normalizeRange(range);
  if (explicitRange) return explicitRange;
  const measureStart = segment.measureStart ?? firstMeasure(reference);
  const measureEnd = Math.min(
    segment.measureEnd ?? measureStart,
    measureStart + gateConfig.responseWindowMeasures - 1,
  );
  return { measureStart, measureEnd };
}

function normalizeRange(range) {
  if (!range) return null;
  const measureStart = Number(range.measureStart);
  const measureEnd = Number(range.measureEnd);
  if (!Number.isFinite(measureStart) || !Number.isFinite(measureEnd)) return null;
  return {
    measureStart: Math.min(measureStart, measureEnd),
    measureEnd: Math.max(measureStart, measureEnd),
  };
}

function firstMeasuresRange(reference, gateConfig) {
  const measureStart = firstMeasure(reference);
  return {
    measureStart,
    measureEnd: measureStart + gateConfig.responseWindowMeasures - 1,
  };
}

function firstMeasure(reference = {}) {
  return reference.notes?.[0]?.measure ?? 1;
}

function gateIssueTypesFor(issueTypes = []) {
  const actionable = issueTypes.filter((issue) => issue !== "stable");
  return actionable.length ? [...new Set(actionable.map(normalizeGateIssueType))] : [];
}

function gateIssueTypesWithThresholds(issueTypes, { confidenceTooLow, pitchTooLow, rhythmTooLow }) {
  if (confidenceTooLow) return ["insufficient-audio"];
  const expanded = new Set(issueTypes);
  if (pitchTooLow) expanded.add("pitch");
  if (rhythmTooLow) expanded.add("rhythm");
  return [...expanded];
}

function normalizeGateIssueType(issueType) {
  if (issueType.startsWith("pitch-")) return "pitch";
  if (issueType.startsWith("rhythm-")) return "rhythm";
  return issueType;
}

function focusRetryInstruction(practiceSuggestion, range) {
  if (practiceSuggestion) return practiceSuggestion;
  return `回到第 ${range.measureStart}-${range.measureEnd} 小节，先慢速重练一次。`;
}

function buildResponseWindow(range, gateConfig) {
  return {
    maxMeasuresAfterMistake: gateConfig.responseWindowMeasures,
    measureStart: range.measureStart,
    measureEnd: Math.min(
      range.measureEnd,
      range.measureStart + gateConfig.responseWindowMeasures - 1,
    ),
  };
}

function buildPassThreshold(gateConfig) {
  return {
    minPitchScore: gateConfig.minPitchScore,
    minRhythmScore: gateConfig.minRhythmScore,
    minConfidence: gateConfig.minConfidence,
    pitchToleranceCents: gateConfig.pitchToleranceCents,
    timingToleranceMs: gateConfig.timingToleranceMs,
  };
}

function buildParentSummary(action, issueTypes, range) {
  if (action === "continue") {
    return `第 ${range.measureStart}-${range.measureEnd} 小节已经达到当前通过标准，可以进入下一段。`;
  }
  if (issueTypes.includes("insufficient-audio")) {
    return "这次音频质量不足，系统没有放行继续练习，避免给出不可靠判断。";
  }
  const labels = [...new Set(issueTypes)].map((issue) => {
    if (issue === "pitch") return "音准";
    if (issue === "rhythm") return "节奏";
    return issue;
  });
  return `第 ${range.measureStart}-${range.measureEnd} 小节仍有${labels.join("和")}问题，需要回练后再继续。`;
}

function repeatedRanges(gates) {
  const counts = new Map();
  for (const gate of gates) {
    const key = rangeKey(gate.range);
    const existing = counts.get(key) ?? {
      range: gate.range,
      count: 0,
      issueTypes: new Set(),
    };
    existing.count += 1;
    gate.issueTypes.forEach((issue) => existing.issueTypes.add(issue));
    counts.set(key, existing);
  }
  return [...counts.values()]
    .filter((entry) => entry.count > 1)
    .map((entry) => ({
      range: entry.range,
      count: entry.count,
      issueTypes: [...entry.issueTypes],
    }));
}

function rangesImprovedAfterRetry(gates) {
  const sawRetry = new Set();
  const improved = new Map();
  for (const gate of gates) {
    const key = rangeKey(gate.range);
    if (gate.isBlocking) {
      sawRetry.add(key);
      continue;
    }
    if (gate.allowedToContinue && sawRetry.has(key)) {
      improved.set(key, {
        range: gate.range,
        finalConfidence: gate.confidence,
      });
    }
  }
  return [...improved.values()];
}

function rangeKey(range) {
  return `${range.measureStart}-${range.measureEnd}`;
}

function buildSessionParentMessage({ status, pieceTitle, retryCount, improvedRanges, currentGate }) {
  const titlePrefix = pieceTitle ? `${pieceTitle}：` : "";
  if (status === "ready-to-continue") {
    const improvedText = improvedRanges.length
      ? `其中 ${formatRangesForMessage(improvedRanges.map((entry) => entry.range))} 已通过回练改善。`
      : "当前片段已达到继续标准。";
    return `${titlePrefix}本次练习完成 ${retryCount} 次纠错回练。${improvedText}`;
  }
  return `${titlePrefix}当前仍停在第 ${currentGate.range.measureStart}-${currentGate.range.measureEnd} 小节，需要继续回练后再往后走。`;
}

function buildSessionTeacherMessage({ repeatedProblemRanges, improvedRanges, currentGate }) {
  if (repeatedProblemRanges.length) {
    return `下次课前建议优先检查 ${formatRangesForMessage(
      repeatedProblemRanges.map((entry) => entry.range),
    )}；这些片段出现过多次阻断。`;
  }
  if (improvedRanges.length) {
    return `${formatRangesForMessage(improvedRanges.map((entry) => entry.range))} 已通过回练放行，可以从更细的音色和技术要求继续。`;
  }
  return currentGate.allowedToContinue
    ? "当前片段已放行，可以进入下一段练习。"
    : `当前片段第 ${currentGate.range.measureStart}-${currentGate.range.measureEnd} 小节仍未放行。`;
}

function formatRangesForMessage(ranges) {
  return ranges.map((range) => `第 ${range.measureStart}-${range.measureEnd} 小节`).join("、");
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
