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
  activeView: "drill",
  selectedRange: null,
  loopEnabled: false,
  metronomeTimer: null,
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

const actionHandlers = {
  "studio": () => {
    scrollToElement(".intro-band");
    setStatus("Studio", "muted");
  },
  "library": () => {
    setDockAction("library");
    scrollToElement(".topbar");
    els.pieceSelect.focus();
    setStatus("Library");
    els.recordingState.textContent = `曲目库已就绪：当前选中 ${state.piece.title}`;
  },
  "start-practice": () => {
    selectView("drill");
    scrollToElement(".app-frame");
    els.recordButton.focus();
    setStatus("Practice");
  },
  "workbench": () => {
    setDockAction("workbench");
    scrollToElement(".app-frame");
    setStatus("Workbench");
  },
  "stats": () => {
    setDockAction("stats");
    selectView("stats");
  },
  "coach": () => {
    setDockAction("coach");
    selectView("coach");
  },
  "settings": (target) => {
    const enabled = !target.classList.contains("active");
    setToolActive("settings", enabled);
    setDockAction(enabled ? "settings" : "workbench");
    setStatus(enabled ? "Settings" : "Workbench", enabled ? "active" : "muted");
    els.drillHint.textContent = enabled
      ? "设置：本地分析模式已开启，录音只在浏览器内完成音高与节奏诊断。"
      : "已回到练习工作台。";
  },
  "back-top": () => {
    scrollToElement(".intro-band");
    setStatus("Top");
  },
  "metronome": (target) => {
    const enabled = !target.classList.contains("active");
    setToolActive("metronome", enabled);
    toggleMetronome(enabled);
  },
  "loop": (target) => {
    const enabled = !target.classList.contains("active");
    state.loopEnabled = enabled;
    els.audioPlayer.loop = enabled;
    setToolActive("loop", enabled);
    setStatus(enabled ? "Loop On" : "Loop Off", enabled ? "active" : "muted");
    els.drillHint.textContent = enabled
      ? `循环播放已开启：建议反复听第 ${getSelectedRange().measureStart}-${getSelectedRange().measureEnd} 小节。`
      : "循环播放已关闭。";
  },
  "range": () => {
    selectView("drill");
    els.measureStart.focus();
    els.measureStart.select();
    setStatus("Range");
  },
  "comments": () => {
    setStatus("Comment");
    els.drillHint.textContent = state.lastResult
      ? `批注：${state.lastResult.segments[0]?.learnerMessage ?? "这一遍可以进入下一组短句练习。"}`
      : "批注：先载入 Demo 或录音，分析后这里会记录本次最需要修正的点。";
  },
};

const viewHandlers = {
  "full": () => {
    els.modeSelect.value = "full";
    scrollToElement(".score-document");
    setStatus("Full Take");
    els.drillHint.textContent = "全篇模式：分析会覆盖整首当前曲目，并更新错误统计。";
  },
  "drill": () => {
    els.modeSelect.value = "drill";
    scrollToElement(".drill-card");
    setStatus("Target Drill");
    els.drillHint.textContent = `特训范围：第 ${getSelectedRange().measureStart}-${getSelectedRange().measureEnd} 小节。`;
  },
  "pitch": () => {
    scrollToElement(".timeline-panel");
    setStatus("Pitch Map");
    els.drillHint.textContent = state.lastResult
      ? `音高视图：当前音准分 ${state.lastResult.summary.pitchScore}。`
      : "音高视图：完成分析后会在时间线上标出偏高或偏低的片段。";
  },
  "rhythm": () => {
    scrollToElement(".timeline-panel");
    setStatus("Rhythm");
    els.drillHint.textContent = state.lastResult
      ? `节奏视图：当前节奏分 ${state.lastResult.summary.rhythmScore}。`
      : "节奏视图：完成分析后会提示快半拍、慢半拍或换弓进入不稳。";
  },
  "stats": () => {
    scrollToElement(".error-list");
    setStatus("Stats");
    els.drillHint.textContent = state.history.length
      ? "错误统计已按历史分析聚合，优先处理出现次数最多的问题。"
      : "暂无历史统计；完成一次分析后会累计常见错误。";
  },
  "coach": () => {
    scrollToElement(".coach-panel");
    setStatus("Coach");
    els.drillHint.textContent = "教练模式会把音准和节奏偏差翻译成下一步练习动作。";
  },
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
  els.modeSelect.addEventListener("change", () => {
    selectView(els.modeSelect.value === "drill" ? "drill" : "full");
  });
  els.recordButton.addEventListener("click", toggleRecording);
  els.demoButton.addEventListener("click", loadDemoTake);
  els.clearHistoryButton.addEventListener("click", clearHistory);
  els.fileInput.addEventListener("change", handleFileUpload);
  els.analyzeButton.addEventListener("click", () => runAnalysis());
  els.drillButton.addEventListener("click", () => runAnalysis(getSelectedRange()));
  els.measureStart.addEventListener("change", syncSelectedRangeFromInputs);
  els.measureEnd.addEventListener("change", syncSelectedRangeFromInputs);
  els.measureStrip.addEventListener("click", handleMeasureClick);
  document.addEventListener("click", handleGlobalClick);
  renderPiece();
  renderHistory();
  drawEmptyCanvas();
  setActiveView(state.activeView);
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
  const loaded = await loadAudioBlob(new Blob([wav], { type: "audio/wav" }));
  if (loaded) els.recordingState.textContent = "已载入 Demo Take，可以分析";
}

function renderPiece() {
  els.pieceTitle.textContent = state.piece.title;
  els.pieceComposer.textContent = state.piece.composer;
  els.pieceTempo.textContent = `q = ${state.piece.tempo}`;
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
  const measures = getMeasures();
  const { min, max } = getMeasureBounds();
  els.measureStart.min = String(min);
  els.measureStart.max = String(max);
  els.measureEnd.min = String(min);
  els.measureEnd.max = String(max);
  if (!state.selectedRange) {
    state.selectedRange = { measureStart: min, measureEnd: Math.min(max, min + 3) };
  }
  syncRangeInputs(state.selectedRange);
  els.measureStrip.innerHTML = measures
    .map((measure) => {
      const selected =
        measure >= state.selectedRange.measureStart && measure <= state.selectedRange.measureEnd;
      return `<button type="button" data-measure="${measure}" class="${selected ? "active" : ""}" aria-pressed="${selected}">Bar ${measure}</button>`;
    })
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
      const loaded = await loadAudioBlob(blob);
      els.recordButton.textContent = "Record";
      if (loaded) els.recordingState.textContent = "录音已就绪，可以分析";
    });
    state.mediaRecorder.start();
    els.recordButton.textContent = "Stop";
    els.recordingState.textContent = "正在录音...";
    setStatus("Recording", "active");
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
  let nextUrl = "";
  try {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      showError("当前浏览器无法解码音频，请换用现代浏览器或上传 WAV 文件。");
      return false;
    }
    nextUrl = URL.createObjectURL(blob);
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContextCtor();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    await audioContext.close();
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = nextUrl;
    state.audioBuffer = decoded;
    els.audioPlayer.src = state.audioUrl;
    els.audioPlayer.loop = state.loopEnabled;
    els.audioPlayer.style.display = "block";
    setStatus("Ready");
    return true;
  } catch (error) {
    if (nextUrl) URL.revokeObjectURL(nextUrl);
    state.audioBuffer = null;
    els.audioPlayer.removeAttribute("src");
    els.audioPlayer.style.display = "none";
    showError("无法读取这段音频，请上传浏览器可解码的录音文件。");
    return false;
  }
}

function runAnalysis(range) {
  if (!state.audioBuffer) {
    showError("请先录音或上传一段小提琴音频。");
    return;
  }

  setStatus("Processing", "active");
  const channel = state.audioBuffer.getChannelData(0);
  const result = analyzePerformance({
    samples: channel,
    sampleRate: state.audioBuffer.sampleRate,
    reference: state.piece,
    range,
  });
  state.lastResult = result;
  persistResult(result);
  renderAnalysis(result);
}

function renderAnalysis(result) {
  if (result.status === "error") {
    showError(result.error);
    return;
  }

  setStatus("Complete", "active");
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
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    pieceId: state.piece.id,
    pieceTitle: state.piece.title,
    issue: result.summary.primaryIssue,
    pitchScore: result.summary.pitchScore,
    rhythmScore: result.summary.rhythmScore,
    createdAt: new Date().toISOString(),
  };
  state.history = [entry, ...state.history].slice(0, 12);
  try {
    localStorage.setItem("violinmaster.history", JSON.stringify(state.history));
  } catch {
    els.drillHint.textContent = "本次分析已完成，但浏览器阻止了本地历史保存。";
  }
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
  try {
    localStorage.removeItem("violinmaster.history");
  } catch {
    els.drillHint.textContent = "浏览器阻止了本地历史清理，但当前页面统计已清空。";
  }
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
  state.lastResult = null;
  state.selectedRange = null;
  setStatus("Idle", "muted");
  els.pitchScore.textContent = "--";
  els.rhythmScore.textContent = "--";
  els.stabilityScore.textContent = "--";
  els.frameCount.textContent = "0 frames";
  els.topPriority.textContent = "完成一次录音后，我会把问题翻译成练琴语言。";
  els.nextDrill.textContent = "建议先从 2-4 小节的短片段开始。";
  renderPiece();
  drawEmptyCanvas();
}

function getSelectedRange() {
  return syncSelectedRangeFromInputs();
}

function syncSelectedRangeFromInputs() {
  const { min, max } = getMeasureBounds();
  const rawStart = Number.parseInt(els.measureStart.value, 10);
  const rawEnd = Number.parseInt(els.measureEnd.value, 10);
  const start = Number.isFinite(rawStart) ? rawStart : min;
  const end = Number.isFinite(rawEnd) ? rawEnd : start;
  const measureStart = clamp(Math.min(start, end), min, max);
  const measureEnd = clamp(Math.max(start, end), min, max);
  state.selectedRange = { measureStart, measureEnd };
  syncRangeInputs(state.selectedRange);
  updateMeasureButtons();
  els.drillHint.textContent = `特训范围：第 ${measureStart}-${measureEnd} 小节。`;
  return state.selectedRange;
}

function syncRangeInputs(range) {
  els.measureStart.value = String(range.measureStart);
  els.measureEnd.value = String(range.measureEnd);
}

function handleMeasureClick(event) {
  const button = event.target.closest("[data-measure]");
  if (!button) return;
  const measure = Number.parseInt(button.dataset.measure, 10);
  if (!Number.isFinite(measure)) return;
  state.selectedRange = { measureStart: measure, measureEnd: measure };
  syncRangeInputs(state.selectedRange);
  updateMeasureButtons();
  selectView("drill");
}

function handleGlobalClick(event) {
  const viewTarget = event.target.closest("[data-view]");
  if (viewTarget) {
    event.preventDefault();
    selectView(viewTarget.dataset.view);
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  event.preventDefault();
  const handler = actionHandlers[actionTarget.dataset.action];
  if (handler) handler(actionTarget);
}

function selectView(view) {
  setActiveView(view);
  const handler = viewHandlers[view];
  if (handler) handler();
}

function setActiveView(view) {
  state.activeView = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  });
}

function setDockAction(action) {
  document.querySelectorAll(".dock-button[data-action]").forEach((button) => {
    button.classList.toggle("active", button.dataset.action === action);
  });
}

function setToolActive(action, active) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach((button) => {
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function toggleMetronome(enabled) {
  if (state.metronomeTimer) {
    clearInterval(state.metronomeTimer);
    state.metronomeTimer = null;
  }
  if (!enabled) {
    setStatus("Metronome Off");
    els.drillHint.textContent = "节拍器已关闭。";
    return;
  }
  const intervalMs = Math.max(260, Math.round(60_000 / state.piece.tempo));
  playMetronomeClick();
  state.metronomeTimer = setInterval(playMetronomeClick, intervalMs);
  setStatus(`q = ${state.piece.tempo}`, "active");
  els.drillHint.textContent = `节拍器已开启：${state.piece.tempo} BPM。`;
}

function playMetronomeClick() {
  try {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.09);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    showError("节拍器暂时无法启动，请检查浏览器音频权限。");
  }
}

function updateMeasureButtons() {
  if (!state.selectedRange) return;
  els.measureStrip.querySelectorAll("[data-measure]").forEach((button) => {
    const measure = Number.parseInt(button.dataset.measure, 10);
    const selected =
      measure >= state.selectedRange.measureStart && measure <= state.selectedRange.measureEnd;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function setStatus(label, tone = "muted") {
  els.analysisStatus.textContent = label;
  els.analysisStatus.className = `status-pill ${tone}`;
}

function showError(message) {
  setStatus("Error", "error");
  els.recordingState.textContent = message;
  els.topPriority.textContent = message;
}

function scrollToElement(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function getMeasures() {
  return [...new Set(state.piece.notes.map((note) => note.measure))];
}

function getMeasureBounds() {
  const measures = getMeasures();
  return {
    min: Math.min(...measures),
    max: Math.max(...measures),
  };
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
