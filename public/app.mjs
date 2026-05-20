import { analyzePerformance } from "../src/lib/analysis.mjs";
import { findPieceById, repertoire } from "../src/lib/repertoire.mjs";
import { encodeWav } from "../src/lib/wav.mjs";

const state = {
  piece: repertoire[1],
  audioBuffer: null,
  audioUrl: null,
  mediaRecorder: null,
  chunks: [],
  history: loadHistory(),
  lastResult: null,
};

const els = {
  pieceSelect: document.querySelector("#pieceSelect"),
  modeSelect: document.querySelector("#modeSelect"),
  recordButton: document.querySelector("#recordButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
  drillButton: document.querySelector("#drillButton"),
  demoButton: document.querySelector("#demoButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  fileInput: document.querySelector("#fileInput"),
  audioPlayer: document.querySelector("#audioPlayer"),
  recordingState: document.querySelector("#recordingState"),
  pieceTitle: document.querySelector("#pieceTitle"),
  pieceComposer: document.querySelector("#pieceComposer"),
  pieceTempo: document.querySelector("#pieceTempo"),
  pieceLevel: document.querySelector("#pieceLevel"),
  scoreLines: document.querySelector("#scoreLines"),
  measureStrip: document.querySelector("#measureStrip"),
  analysisStatus: document.querySelector("#analysisStatus"),
  pitchScore: document.querySelector("#pitchScore"),
  rhythmScore: document.querySelector("#rhythmScore"),
  stabilityScore: document.querySelector("#stabilityScore"),
  topPriority: document.querySelector("#topPriority"),
  nextDrill: document.querySelector("#nextDrill"),
  errorList: document.querySelector("#errorList"),
  frameCount: document.querySelector("#frameCount"),
  pitchCanvas: document.querySelector("#pitchCanvas"),
  measureStart: document.querySelector("#measureStart"),
  measureEnd: document.querySelector("#measureEnd"),
  drillHint: document.querySelector("#drillHint"),
};

init();

function init() {
  els.pieceSelect.innerHTML = repertoire
    .map((piece) => `<option value="${piece.id}">${piece.title}</option>`)
    .join("");
  els.pieceSelect.value = state.piece.id;
  els.pieceSelect.addEventListener("change", () => {
    state.piece = findPieceById(els.pieceSelect.value);
    renderPiece();
    resetAnalysisView();
  });
  els.recordButton.addEventListener("click", toggleRecording);
  els.demoButton.addEventListener("click", loadDemoTake);
  els.clearHistoryButton.addEventListener("click", clearHistory);
  els.fileInput.addEventListener("change", handleFileUpload);
  els.analyzeButton.addEventListener("click", () => runAnalysis());
  els.drillButton.addEventListener("click", () => runAnalysis(getSelectedRange()));
  renderPiece();
  renderHistory();
  drawEmptyCanvas();
}

async function loadDemoTake() {
  const sampleRate = 44_100;
  const secondsPerBeat = 0.42;
  const totalBeats = state.piece.notes.reduce((sum, note) => sum + note.durationBeats, 0);
  const seconds = Math.max(1.8, totalBeats * secondsPerBeat);
  const samples = new Float32Array(Math.floor(sampleRate * seconds));
  const detune = els.modeSelect.value === "drill" ? 1.018 : 1;
  let elapsedBeats = 0;
  for (const note of state.piece.notes) {
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    const start = Math.floor(elapsedBeats * secondsPerBeat * sampleRate);
    const end = Math.floor((elapsedBeats + note.durationBeats) * secondsPerBeat * sampleRate);
    for (let index = start; index < end && index < samples.length; index += 1) {
      const localTime = (index - start) / sampleRate;
      const remaining = (end - index) / sampleRate;
      const envelope = Math.min(1, localTime * 16, remaining * 16);
      const vibrato = 1 + Math.sin(localTime * Math.PI * 9) * 0.0016;
      samples[index] = Math.sin(2 * Math.PI * frequency * detune * vibrato * localTime) * 0.72 * envelope;
    }
    elapsedBeats += note.durationBeats;
  }
  const wav = encodeWav(samples, sampleRate);
  await loadAudioBlob(new Blob([wav], { type: "audio/wav" }));
  els.recordingState.textContent = "已载入 Demo Take，可以分析";
}

function renderPiece() {
  els.pieceTitle.textContent = state.piece.title;
  els.pieceComposer.textContent = state.piece.composer;
  els.pieceTempo.textContent = `♩ = ${state.piece.tempo}`;
  els.pieceLevel.textContent = formatLevel(state.piece.levelBand);
  els.scoreLines.innerHTML = Array.from({ length: 5 })
    .map((_, staffIndex) => {
      const notes = state.piece.notes
        .slice(staffIndex * 4, staffIndex * 4 + 8)
        .map((note) => `<span style="--note-y:${noteToY(note.midi)}%"></span>`)
        .join("");
      return `<div class="staff">${notes}</div>`;
    })
    .join("");
  const measures = [...new Set(state.piece.notes.map((note) => note.measure))];
  els.measureStrip.innerHTML = measures
    .map((measure) => `<button type="button" data-measure="${measure}">Bar ${measure}</button>`)
    .join("");
}

async function toggleRecording() {
  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showError("当前浏览器不支持麦克风录音，请改用上传音频。");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.chunks = [];
    state.mediaRecorder = new MediaRecorder(stream);
    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) state.chunks.push(event.data);
    });
    state.mediaRecorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(state.chunks, { type: state.mediaRecorder.mimeType });
      await loadAudioBlob(blob);
      els.recordButton.textContent = "Record";
      els.recordingState.textContent = "录音已就绪，可以分析";
    });
    state.mediaRecorder.start();
    els.recordButton.textContent = "Stop";
    els.recordingState.textContent = "正在录音...";
    els.analysisStatus.textContent = "Recording";
  } catch (error) {
    showError(error?.message ?? "无法打开麦克风。");
  }
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  els.recordingState.textContent = `已选择：${file.name}`;
  await loadAudioBlob(file);
}

async function loadAudioBlob(blob) {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(blob);
  els.audioPlayer.src = state.audioUrl;
  els.audioPlayer.style.display = "block";

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  state.audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  await audioContext.close();
  els.analysisStatus.textContent = "Ready";
}

function runAnalysis(range) {
  if (!state.audioBuffer) {
    showError("请先录音或上传一段小提琴音频。");
    return;
  }

  els.analysisStatus.textContent = "Processing";
  const channel = state.audioBuffer.getChannelData(0);
  const result = analyzePerformance({
    samples: channel,
    sampleRate: state.audioBuffer.sampleRate,
    reference: state.piece,
    range,
  });
  state.lastResult = result;
  renderAnalysis(result);
  persistResult(result);
}

function renderAnalysis(result) {
  if (result.status === "error") {
    showError(result.error);
    return;
  }

  els.analysisStatus.textContent = "Complete";
  els.pitchScore.textContent = result.summary.pitchScore;
  els.rhythmScore.textContent = result.summary.rhythmScore;
  els.stabilityScore.textContent = result.summary.stabilityScore;
  els.topPriority.textContent = result.coach.topPriorities[0];
  els.nextDrill.textContent = result.coach.nextDrill;
  els.frameCount.textContent = `${result.pitchFrames.length} frames`;
  els.drillHint.textContent = result.segments[0]?.learnerMessage ?? "已完成特训分析。";
  renderHistory();
  drawPitchCanvas(result);
}

function persistResult(result) {
  if (result.status !== "complete") return;
  const entry = {
    id: crypto.randomUUID(),
    pieceId: state.piece.id,
    pieceTitle: state.piece.title,
    issue: result.summary.primaryIssue,
    pitchScore: result.summary.pitchScore,
    rhythmScore: result.summary.rhythmScore,
    createdAt: new Date().toISOString(),
  };
  state.history = [entry, ...state.history].slice(0, 12);
  localStorage.setItem("violinmaster.history", JSON.stringify(state.history));
}

function renderHistory() {
  if (!state.history.length) {
    els.errorList.innerHTML = "<li>暂无历史统计</li>";
    return;
  }

  const counts = state.history.reduce((map, entry) => {
    map.set(entry.issue, (map.get(entry.issue) ?? 0) + 1);
    return map;
  }, new Map());
  els.errorList.innerHTML = [...counts.entries()]
    .map(([issue, count]) => `<li><span>${formatIssue(issue)}</span><strong>${count} 次</strong></li>`)
    .join("");
}

function clearHistory() {
  state.history = [];
  localStorage.removeItem("violinmaster.history");
  renderHistory();
}

function drawPitchCanvas(result) {
  const canvas = els.pitchCanvas;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  paintCanvasBase(context, width, height);
  if (!result.pitchFrames.length) return;

  const frequencies = result.pitchFrames.map((frame) => frame.frequency);
  const min = Math.min(...frequencies) - 10;
  const max = Math.max(...frequencies) + 10;
  context.strokeStyle = "#b86b28";
  context.lineWidth = 5;
  context.beginPath();
  result.pitchFrames.forEach((frame, index) => {
    const x = (index / Math.max(1, result.pitchFrames.length - 1)) * width;
    const y = height - ((frame.frequency - min) / (max - min || 1)) * (height - 60) - 30;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  context.fillStyle = result.summary.primaryIssue === "stable" ? "#657a3d" : "#9a3f2f";
  result.segments.forEach((segment, index) => {
    context.fillRect(70 + index * 120, 36, 96, 18);
    context.fillText(`Bars ${segment.measureStart}-${segment.measureEnd}`, 70 + index * 120, 28);
  });
}

function drawEmptyCanvas() {
  const canvas = els.pitchCanvas;
  paintCanvasBase(canvas.getContext("2d"), canvas.width, canvas.height);
}

function paintCanvasBase(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f3eadc";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(70, 45, 28, 0.16)";
  context.lineWidth = 2;
  for (let y = 44; y < height; y += 42) {
    context.beginPath();
    context.moveTo(30, y);
    context.lineTo(width - 30, y);
    context.stroke();
  }
  context.fillStyle = "rgba(48, 35, 26, 0.45)";
  context.font = "22px Arial";
  context.fillText("Pitch contour appears here after analysis", 42, height - 28);
}

function resetAnalysisView() {
  els.analysisStatus.textContent = "Idle";
  els.pitchScore.textContent = "--";
  els.rhythmScore.textContent = "--";
  els.stabilityScore.textContent = "--";
  els.topPriority.textContent = "完成一次录音后，我会把问题翻译成练琴语言。";
  els.nextDrill.textContent = "建议先从 2-4 小节的短片段开始。";
  drawEmptyCanvas();
}

function getSelectedRange() {
  const measureStart = Number.parseInt(els.measureStart.value, 10);
  const measureEnd = Number.parseInt(els.measureEnd.value, 10);
  return {
    measureStart: Math.min(measureStart, measureEnd),
    measureEnd: Math.max(measureStart, measureEnd),
  };
}

function showError(message) {
  els.analysisStatus.textContent = "Error";
  els.recordingState.textContent = message;
  els.topPriority.textContent = message;
}

function noteToY(midi) {
  return 75 - ((midi - 60) % 18) * 3.2;
}

function formatLevel(level) {
  return level.replace("-", " / ");
}

function formatIssue(issue) {
  const labels = {
    "pitch-high": "音准偏高",
    "pitch-low": "音准偏低",
    "rhythm-drag": "节奏偏拖",
    stable: "稳定片段",
  };
  return labels[issue] ?? issue;
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("violinmaster.history") ?? "[]");
  } catch {
    return [];
  }
}
