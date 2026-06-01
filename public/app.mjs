import { analyzePerformance } from "../src/lib/analysis.mjs";
import { parseMusicXml } from "../src/lib/musicxml.mjs";
import { findPieceById, repertoire } from "../src/lib/repertoire.mjs";
import { encodeWav } from "../src/lib/wav.mjs";

const state = {
  pieces: [...repertoire],
  piece: repertoire[1],
  audioBuffer: null,
  audioUrl: null,
  mediaRecorder: null,
  chunks: [],
  history: loadHistory(),
  lastResult: null,
  activeView: "drill",
  locale: loadLocale(),
  selectedRange: null,
  loopEnabled: false,
  metronomeTimer: null,
};

const els = {
  languageSelect: document.querySelector("#languageSelect"),
  pieceSelect: document.querySelector("#pieceSelect"),
  modeSelect: document.querySelector("#modeSelect"),
  recordButton: document.querySelector("#recordButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
  drillButton: document.querySelector("#drillButton"),
  demoButton: document.querySelector("#demoButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  fileInput: document.querySelector("#fileInput"),
  musicXmlInput: document.querySelector("#musicXmlInput"),
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
  parentSummary: document.querySelector("#parentSummary"),
  teacherSummary: document.querySelector("#teacherSummary"),
  historySummary: document.querySelector("#historySummary"),
  errorList: document.querySelector("#errorList"),
  frameCount: document.querySelector("#frameCount"),
  pitchCanvas: document.querySelector("#pitchCanvas"),
  measureStart: document.querySelector("#measureStart"),
  measureEnd: document.querySelector("#measureEnd"),
  drillHint: document.querySelector("#drillHint"),
};

const zhTabs = {
  full: "完整演奏",
  drill: "小节特训",
  pitch: "音准图谱",
  rhythm: "节奏",
  stats: "错误统计",
  coach: "AI 教练",
};

const enTabs = {
  full: "Full take",
  drill: "Target drill",
  pitch: "Pitch map",
  rhythm: "Rhythm",
  stats: "Error stats",
  coach: "AI coach",
};

const zhActions = {
  studio: "琴房",
  library: "曲库",
  startPractice: "开始练习",
  workbench: "练习工作台",
  settings: "设置",
  back: "返回",
  metronome: "节拍器",
  loop: "循环",
  range: "小节范围",
  comments: "批注",
  demo: "Demo",
  record: "录音",
  stop: "停止",
  analyze: "分析",
  analyzeBars: "分析选中小节",
  clear: "清空",
  upload: "上传音频",
  importScore: "导入 MusicXML",
};

const enActions = {
  studio: "Studio",
  library: "Library",
  startPractice: "Start Practice",
  workbench: "Workbench",
  settings: "Settings",
  back: "Back",
  metronome: "Metronome",
  loop: "Loop",
  range: "Measure Range",
  comments: "Comments",
  demo: "Demo",
  record: "Record",
  stop: "Stop",
  analyze: "Analyze",
  analyzeBars: "Analyze Selected Bars",
  clear: "Clear",
  upload: "Upload Audio",
  importScore: "Import MusicXML",
};

const zhCoach = {
  idleTop: "完成一次录音后，我会把问题翻译成练琴语言。",
  idleNext: "建议先从 2-4 小节的短片段开始。",
  drillDefault: "AI 会把选定范围作为下一段特训目标。",
  viewFull: "全篇模式：分析会覆盖整首当前曲目，并更新错误统计。",
  viewDrill: "特训范围：{range}。",
  viewPitchReady: "音高视图：当前音准分 {score}。",
  viewPitchIdle: "音高视图：完成分析后会在时间线上标出偏高或偏低的片段。",
  viewRhythmReady: "节奏视图：当前节奏分 {score}。",
  viewRhythmIdle: "节奏视图：完成分析后会提示快半拍、慢半拍或换弓进入不稳。",
  viewStatsReady: "错误统计已按历史分析聚合，优先处理出现次数最多的问题。",
  viewStatsIdle: "暂无历史统计；完成一次分析后会累计常见错误。",
  viewCoach: "教练模式会把音准和节奏偏差翻译成下一步练习动作。",
  analysisComplete: "已完成特训分析。",
};

const enCoach = {
  idleTop: "After one take, I will translate pitch and rhythm issues into practice language.",
  idleNext: "Start with a short Bars 2-4 drill.",
  drillDefault: "AI will use the selected bars as the next drill target.",
  viewFull: "Full take mode analyzes the whole current piece and refreshes error stats.",
  viewDrill: "Drill range: {range}.",
  viewPitchReady: "Pitch map: current intonation score {score}.",
  viewPitchIdle: "Pitch map will mark sharp or flat passages after analysis.",
  viewRhythmReady: "Rhythm view: current rhythm score {score}.",
  viewRhythmIdle: "Rhythm view will show dragging, rushing, or unstable bow entries after analysis.",
  viewStatsReady: "Error stats are grouped from past analyses; start with the most repeated issue.",
  viewStatsIdle: "No history yet. Finish one analysis to build recurring-error stats.",
  viewCoach: "Coach mode turns pitch and rhythm drift into the next practice action.",
  analysisComplete: "Target drill analysis complete.",
};

const zhLabels = {
  productOverview: "产品概览",
  workflow: "核心工作流",
  workbench: "ViolinMaster 练习工作台",
  mainNav: "主导航",
  quickTools: "快捷工具",
  piece: "曲目",
  mode: "模式",
  language: "语言",
  currentStudy: "当前曲目",
  audioInput: "音频输入",
  scoreCanvas: "乐谱分析画布",
  timeline: "演奏时间线",
  timelineTitle: "音高轮廓与问题标记",
  coach: "教练",
  diagnosis: "练习诊断",
  pitch: "音准",
  rhythm: "节奏",
  stability: "稳定性",
  topPriority: "优先问题",
  targetDrill: "目标特训",
  targetDrillTitle: "指定小节特训",
  start: "起始",
  end: "结束",
  nextDrill: "下一段练习",
  recurringErrors: "常见错误",
  parentSummary: "家长总结",
  teacherSummary: "老师总结",
};

const enLabels = {
  productOverview: "Product overview",
  workflow: "Core workflow",
  workbench: "ViolinMaster practice workbench",
  mainNav: "Main navigation",
  quickTools: "Quick tools",
  piece: "Piece",
  mode: "Mode",
  language: "Language",
  currentStudy: "Current Study",
  audioInput: "Audio input",
  scoreCanvas: "Score analysis canvas",
  timeline: "Performance timeline",
  timelineTitle: "Pitch contour and issue markers",
  coach: "Coach",
  diagnosis: "Practice diagnosis",
  pitch: "Pitch",
  rhythm: "Rhythm",
  stability: "Stability",
  topPriority: "Top Priority",
  targetDrill: "Target Drill",
  targetDrillTitle: "Selected-bar drill",
  start: "Start",
  end: "End",
  nextDrill: "Next Drill",
  recurringErrors: "Recurring Errors",
  parentSummary: "Parent Summary",
  teacherSummary: "Teacher Summary",
};

const zhMessages = {
  hero: "录音、对谱、定位问题，再把音准与节奏偏差翻译成练琴语言。",
  libraryReady: "曲目库已就绪：当前选中 {piece}",
  settingsOn: "设置：本地分析模式已开启，录音只在浏览器内完成音高与节奏诊断。",
  settingsOff: "已回到练习工作台。",
  loopOn: "循环播放已开启：建议反复听{range}。",
  loopOff: "循环播放已关闭。",
  commentsReady: "批注：{message}",
  commentsIdle: "批注：先载入 Demo 或录音，分析后这里会记录本次最需要修正的点。",
  demoReady: "已载入 Demo Take，可以分析",
  noMic: "当前浏览器不支持麦克风录音，请改用上传音频。",
  recordingReady: "录音已就绪，可以分析",
  recording: "正在录音...",
  micOpenError: "无法打开麦克风。",
  selectedFile: "已选择：{file}",
  importedScore: "已导入 MusicXML：{title}",
  scoreReadError: "无法读取这份 MusicXML，请确认文件包含第一声部的小提琴音符。",
  noDecoder: "当前浏览器无法解码音频，请换用现代浏览器或上传 WAV 文件。",
  audioReadError: "无法读取这段音频，请上传浏览器可解码的录音文件。",
  noAudio: "请先录音或上传一段小提琴音频。",
  historySaveBlocked: "本次分析已完成，但浏览器阻止了本地历史保存。",
  historyEmpty: "暂无历史统计",
  historySummaryEmpty: "暂无历史统计",
  historySummaryReady: "已记录 {count} 次分析，最常见问题：{issue}。",
  parentSummaryIdle: "完成一次分析后，这里会说明孩子是否通过回练改善。",
  teacherSummaryIdle: "完成一次分析后，这里会整理下次课前最该看的问题。",
  historyCount: "{count} 次",
  historyClearBlocked: "浏览器阻止了本地历史清理，但当前页面统计已清空。",
  metronomeOff: "节拍器已关闭。",
  metronomeOn: "节拍器已开启：{tempo} BPM。",
  metronomeError: "节拍器暂时无法启动，请检查浏览器音频权限。",
  rangeHint: "特训范围：{range}。",
  canvasEmpty: "分析后显示音高轮廓",
  frameCount: "{count} 帧",
  tooFewNotes: "录音里可用的小提琴单音太少，请靠近麦克风并重新录制。",
};

const enMessages = {
  hero: "Record, compare with the score, locate issues, then turn pitch and rhythm drift into practice language.",
  libraryReady: "Library ready: {piece} is selected",
  settingsOn: "Settings: local analysis is on. Recording stays in the browser for pitch and rhythm diagnosis.",
  settingsOff: "Back to the practice workbench.",
  loopOn: "Loop is on: repeat {range}.",
  loopOff: "Loop is off.",
  commentsReady: "Comment: {message}",
  commentsIdle: "Comment: load the demo or record first; after analysis this will capture the point to fix.",
  demoReady: "Demo Take loaded and ready to analyze",
  noMic: "This browser does not support microphone recording. Upload audio instead.",
  recordingReady: "Recording is ready to analyze",
  recording: "Recording...",
  micOpenError: "Unable to open the microphone.",
  selectedFile: "Selected: {file}",
  importedScore: "MusicXML imported: {title}",
  scoreReadError: "Could not read this MusicXML. Confirm it contains pitched notes in the first part.",
  noDecoder: "This browser cannot decode the audio. Use a modern browser or upload a WAV file.",
  audioReadError: "Could not read this audio. Upload a browser-decodable recording.",
  noAudio: "Record or upload a short violin audio clip first.",
  historySaveBlocked: "Analysis finished, but the browser blocked local history saving.",
  historyEmpty: "No history yet",
  historySummaryEmpty: "No history yet",
  historySummaryReady: "{count} analyses recorded. Most common issue: {issue}.",
  parentSummaryIdle: "After one analysis, this explains whether retry practice improved the passage.",
  teacherSummaryIdle: "After one analysis, this highlights what to check before the next lesson.",
  historyCount: "{count}x",
  historyClearBlocked: "The browser blocked local history cleanup, but the page stats are cleared.",
  metronomeOff: "Metronome is off.",
  metronomeOn: "Metronome is on: {tempo} BPM.",
  metronomeError: "The metronome cannot start right now. Check browser audio permission.",
  rangeHint: "Drill range: {range}.",
  canvasEmpty: "Pitch contour appears here after analysis",
  frameCount: "{count} frames",
  tooFewNotes: "The recording has too few usable violin notes. Move closer to the mic and record again.",
};

const zhIssues = {
  "pitch-high": "音准偏高",
  "pitch-low": "音准偏低",
  "pitch-octave": "音区或八度错误",
  "rhythm-drag": "节奏偏拖",
  "stable": "稳定片段",
};

const enIssues = {
  "pitch-high": "Sharp intonation",
  "pitch-low": "Flat intonation",
  "pitch-octave": "Wrong octave or register",
  "rhythm-drag": "Dragging rhythm",
  "stable": "Stable passage",
};

const zhLevels = {
  beginner: "初级",
  "beginner-intermediate": "初中级",
  intermediate: "中级",
  advanced: "高级",
};

const enLevels = {
  beginner: "beginner",
  "beginner-intermediate": "beginner / intermediate",
  intermediate: "intermediate",
  advanced: "advanced",
};

const zhStatus = {
  Idle: "待分析",
  Studio: "琴房",
  Library: "曲库",
  Practice: "练习",
  Workbench: "工作台",
  Settings: "设置",
  Top: "顶部",
  Range: "范围",
  Comment: "批注",
  "Full Take": "完整演奏",
  "Target Drill": "小节特训",
  "Pitch Map": "音准图谱",
  Rhythm: "节奏",
  Stats: "统计",
  Coach: "教练",
  Ready: "就绪",
  Processing: "分析中",
  Complete: "完成",
  Error: "错误",
  Recording: "录音中",
  "Loop On": "循环开",
  "Loop Off": "循环关",
  "Metronome Off": "节拍器关",
};

const enStatus = {
  Idle: "Idle",
  Studio: "Studio",
  Library: "Library",
  Practice: "Practice",
  Workbench: "Workbench",
  Settings: "Settings",
  Top: "Top",
  Range: "Range",
  Comment: "Comment",
  "Full Take": "Full Take",
  "Target Drill": "Target Drill",
  "Pitch Map": "Pitch Map",
  Rhythm: "Rhythm",
  Stats: "Stats",
  Coach: "Coach",
  Ready: "Ready",
  Processing: "Processing",
  Complete: "Complete",
  Error: "Error",
  Recording: "Recording",
  "Loop On": "Loop On",
  "Loop Off": "Loop Off",
  "Metronome Off": "Metronome Off",
};

const pieceLocales = {
  zh: {
    "twinkle-variations": { title: "《小星星》变奏曲", composer: "Suzuki / 民歌" },
    "bach-minuet-g-1": { title: "G 大调小步舞曲第 1 首", composer: "J. S. Bach / Suzuki" },
    "vivaldi-a-minor-m1": { title: "A 小调协奏曲，第一乐章", composer: "A. Vivaldi" },
    "seitz-concerto-2": { title: "学生协奏曲第 2 号", composer: "F. Seitz" },
    "butterfly-lovers-theme": { title: "《梁祝》开头主题", composer: "何占豪 / 陈钢" },
    "sunshine-tashkurgan": { title: "《阳光照耀着塔什库尔干》", composer: "陈钢" },
  },
};

const translations = {
  zh: {
    tabs: zhTabs,
    actions: zhActions,
    coach: zhCoach,
    labels: zhLabels,
    messages: zhMessages,
    issues: zhIssues,
    levels: zhLevels,
    status: zhStatus,
  },
  en: {
    tabs: enTabs,
    actions: enActions,
    coach: enCoach,
    labels: enLabels,
    messages: enMessages,
    issues: enIssues,
    levels: enLevels,
    status: enStatus,
  },
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
    els.recordingState.textContent = t("messages.libraryReady", { piece: getPieceTitle(state.piece) });
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
    applyViewState("stats");
  },
  "coach": () => {
    setDockAction("coach");
    applyViewState("coach");
  },
  "settings": (target) => {
    const enabled = !target.classList.contains("active");
    setToolActive("settings", enabled);
    setDockAction(enabled ? "settings" : "workbench");
    setStatus(enabled ? "Settings" : "Workbench", enabled ? "active" : "muted");
    els.drillHint.textContent = enabled ? t("messages.settingsOn") : t("messages.settingsOff");
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
      ? t("messages.loopOn", { range: formatRange(getSelectedRange()) })
      : t("messages.loopOff");
  },
  "range": () => {
    applyViewState("drill");
    setStatus("Range");
  },
  "comments": () => {
    setStatus("Comment");
    els.drillHint.textContent = state.lastResult
      ? t("messages.commentsReady", {
          message: localizedSegmentMessage(state.lastResult.segments[0], "learner"),
        })
      : t("messages.commentsIdle");
  },
};

const viewHandlers = {
  "full": {
    mode: "full",
    status: "Full Take",
    hint: () => t("coach.viewFull"),
  },
  "drill": {
    mode: "drill",
    status: "Target Drill",
    hint: () => t("coach.viewDrill", { range: formatRange(getSelectedRange()) }),
  },
  "pitch": {
    status: "Pitch Map",
    hint: () =>
      state.lastResult
        ? t("coach.viewPitchReady", { score: state.lastResult.summary.pitchScore })
        : t("coach.viewPitchIdle"),
  },
  "rhythm": {
    status: "Rhythm",
    hint: () =>
      state.lastResult
        ? t("coach.viewRhythmReady", { score: state.lastResult.summary.rhythmScore })
        : t("coach.viewRhythmIdle"),
  },
  "stats": {
    status: "Stats",
    hint: () => (state.history.length ? t("coach.viewStatsReady") : t("coach.viewStatsIdle")),
  },
  "coach": {
    status: "Coach",
    hint: () => t("coach.viewCoach"),
  },
};

init();

function init() {
  els.languageSelect.value = state.locale;
  els.languageSelect.addEventListener("change", () => {
    state.locale = els.languageSelect.value === "en" ? "en" : "zh";
    persistLocale();
    applyTranslations();
    renderPiece();
    renderHistory();
    if (state.lastResult) renderAnalysis(state.lastResult);
    else renderIdleAnalysisText();
    setActiveView(state.activeView);
  });
  populatePieceOptions();
  els.pieceSelect.value = state.piece.id;
  els.pieceSelect.addEventListener("change", () => {
    state.piece = findCurrentPieceById(els.pieceSelect.value);
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
  els.musicXmlInput.addEventListener("change", handleMusicXmlImport);
  els.analyzeButton.addEventListener("click", () => runAnalysis());
  els.drillButton.addEventListener("click", () => runAnalysis(getSelectedRange()));
  els.measureStart.addEventListener("change", syncSelectedRangeFromInputs);
  els.measureEnd.addEventListener("change", syncSelectedRangeFromInputs);
  els.measureStrip.addEventListener("click", handleMeasureClick);
  document.addEventListener("click", handleGlobalClick);
  applyTranslations();
  renderPiece();
  renderHistory();
  drawEmptyCanvas();
  renderIdleAnalysisText();
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
  if (loaded) els.recordingState.textContent = t("messages.demoReady");
}

function renderPiece() {
  els.pieceTitle.textContent = getPieceTitle(state.piece);
  els.pieceComposer.textContent = getPieceComposer(state.piece);
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
      return `<button type="button" data-measure="${measure}" class="${selected ? "active" : ""}" aria-pressed="${selected}">${formatMeasure(measure)}</button>`;
    })
    .join("");
}

async function toggleRecording() {
  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showError(t("messages.noMic"));
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
      els.recordButton.textContent = t("actions.record");
      if (loaded) els.recordingState.textContent = t("messages.recordingReady");
    });
    state.mediaRecorder.start();
    els.recordButton.textContent = t("actions.stop");
    els.recordingState.textContent = t("messages.recording");
    setStatus("Recording", "active");
  } catch (error) {
    showError(error?.message ?? t("messages.micOpenError"));
  }
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  els.recordingState.textContent = t("messages.selectedFile", { file: file.name });
  await loadAudioBlob(file);
}

async function handleMusicXmlImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const xmlText = await file.text();
    const imported = parseMusicXml(xmlText, {
      id: `imported-${Date.now()}`,
      title: file.name.replace(/\.(musicxml|xml)$/i, ""),
    });
    state.pieces = [imported, ...state.pieces.filter((piece) => piece.id !== imported.id)];
    state.piece = imported;
    populatePieceOptions();
    els.pieceSelect.value = imported.id;
    resetAnalysisView();
    els.recordingState.textContent = t("messages.importedScore", { title: getPieceTitle(imported) });
    setStatus("Library", "active");
  } catch (error) {
    showError(t("messages.scoreReadError"));
  } finally {
    event.target.value = "";
  }
}

async function loadAudioBlob(blob) {
  let nextUrl = "";
  try {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      showError(t("messages.noDecoder"));
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
    showError(t("messages.audioReadError"));
    return false;
  }
}

function runAnalysis(range) {
  if (!state.audioBuffer) {
    showError(t("messages.noAudio"));
    return;
  }

  setStatus("Processing", "active");
  const channel = samplesForRange(state.audioBuffer, state.piece, range);
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

function samplesForRange(audioBuffer, piece, range) {
  const channel = audioBuffer.getChannelData(0);
  if (!range) return channel;

  const notes = piece.notes ?? [];
  const firstMeasure = notes[0]?.measure ?? range.measureStart;
  const lastMeasure = notes.at(-1)?.measure ?? range.measureEnd;
  const measureCount = Math.max(1, lastMeasure - firstMeasure + 1);
  const startRatio = clamp((range.measureStart - firstMeasure) / measureCount, 0, 1);
  const endRatio = clamp((range.measureEnd - firstMeasure + 1) / measureCount, 0, 1);
  const startSample = Math.floor(channel.length * startRatio);
  const endSample = Math.max(startSample + 1, Math.floor(channel.length * endRatio));
  return channel.subarray(startSample, endSample);
}

function renderAnalysis(result) {
  if (result.status === "error") {
    showError(localizedAnalysisError(result.error));
    return;
  }

  setStatus("Complete", "active");
  els.pitchScore.textContent = result.summary.pitchScore;
  els.rhythmScore.textContent = result.summary.rhythmScore;
  els.stabilityScore.textContent = result.summary.stabilityScore;
  const coach = localizedCoach(result);
  els.topPriority.textContent = coach.topPriority;
  els.nextDrill.textContent = coach.nextDrill;
  renderStakeholderSummaries(result);
  els.frameCount.textContent = t("messages.frameCount", { count: result.pitchFrames.length });
  els.drillHint.textContent =
    localizedSegmentMessage(result.segments[0], "learner") ?? t("coach.analysisComplete");
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
    els.drillHint.textContent = t("messages.historySaveBlocked");
  }
}

function renderHistory() {
  if (!state.history.length) {
    els.historySummary.textContent = t("messages.historySummaryEmpty");
    els.errorList.innerHTML = `<li>${t("messages.historyEmpty")}</li>`;
    return;
  }

  const counts = state.history.reduce((map, entry) => {
    map.set(entry.issue, (map.get(entry.issue) ?? 0) + 1);
    return map;
  }, new Map());
  const topIssue = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  els.historySummary.textContent = t("messages.historySummaryReady", {
    count: state.history.length,
    issue: formatIssue(topIssue),
  });
  els.errorList.innerHTML = [...counts.entries()]
    .map(
      ([issue, count]) =>
        `<li><span>${formatIssue(issue)}</span><strong>${t("messages.historyCount", { count })}</strong></li>`
    )
    .join("");
}

function clearHistory() {
  state.history = [];
  try {
    localStorage.removeItem("violinmaster.history");
  } catch {
    els.drillHint.textContent = t("messages.historyClearBlocked");
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
    context.fillText(formatRange(segment), 70 + index * 120, 28);
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
  context.fillText(t("messages.canvasEmpty"), 42, height - 28);
}

function resetAnalysisView() {
  state.lastResult = null;
  state.selectedRange = null;
  setStatus("Idle", "muted");
  els.pitchScore.textContent = "--";
  els.rhythmScore.textContent = "--";
  els.stabilityScore.textContent = "--";
  els.frameCount.textContent = t("messages.frameCount", { count: 0 });
  renderIdleAnalysisText();
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
  els.drillHint.textContent = t("messages.rangeHint", { range: formatRange(state.selectedRange) });
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
  setActiveView("drill");
  els.modeSelect.value = "drill";
  setStatus("Target Drill");
  els.drillHint.textContent = t("coach.viewDrill", { range: formatRange(state.selectedRange) });
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
  applyViewState(view);
}

function applyViewState(view) {
  setActiveView(view);
  const config = viewHandlers[view];
  if (!config) return;
  if (config.mode) els.modeSelect.value = config.mode;
  if (config.status) setStatus(config.status);
  if (config.hint) els.drillHint.textContent = config.hint();
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
    els.drillHint.textContent = t("messages.metronomeOff");
    return;
  }
  const intervalMs = Math.max(260, Math.round(60_000 / state.piece.tempo));
  playMetronomeClick();
  state.metronomeTimer = setInterval(playMetronomeClick, intervalMs);
  setStatus(`q = ${state.piece.tempo}`, "active");
  els.drillHint.textContent = t("messages.metronomeOn", { tempo: state.piece.tempo });
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
    showError(t("messages.metronomeError"));
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
  els.analysisStatus.textContent = localizeStatus(label);
  els.analysisStatus.className = `status-pill ${tone}`;
}

function showError(message) {
  setStatus("Error", "error");
  els.recordingState.textContent = message;
  els.topPriority.textContent = message;
}

function scrollToElement(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  return t(`levels.${level}`, {}, level.replace("-", " / "));
}

function formatIssue(issue) {
  return t(`issues.${issue}`, {}, issue);
}

function applyTranslations() {
  document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.setAttribute("title", t(node.dataset.i18nTitle));
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    const label = button.querySelector("span");
    if (label) label.textContent = t(`tabs.${button.dataset.view}`);
  });
  els.modeSelect.querySelector('option[value="full"]').textContent = t("tabs.full");
  els.modeSelect.querySelector('option[value="drill"]').textContent = t("tabs.drill");
  els.demoButton.textContent = t("actions.demo");
  els.recordButton.textContent =
    state.mediaRecorder?.state === "recording" ? t("actions.stop") : t("actions.record");
  els.analyzeButton.textContent = t("actions.analyze");
  els.languageSelect.setAttribute("aria-label", t("labels.language"));
  populatePieceOptions();
}

function populatePieceOptions() {
  const selectedId = state.piece.id;
  els.pieceSelect.innerHTML = state.pieces
    .map((piece) => `<option value="${piece.id}">${getPieceTitle(piece)}</option>`)
    .join("");
  els.pieceSelect.value = selectedId;
}

function findCurrentPieceById(pieceId) {
  return state.pieces.find((piece) => piece.id === pieceId) ?? findPieceById(pieceId);
}

function renderIdleAnalysisText() {
  els.topPriority.textContent = t("coach.idleTop");
  els.nextDrill.textContent = t("coach.idleNext");
  els.drillHint.textContent = t("coach.drillDefault");
  els.parentSummary.textContent = t("messages.parentSummaryIdle");
  els.teacherSummary.textContent = t("messages.teacherSummaryIdle");
}

function renderStakeholderSummaries(result) {
  const gate = result.practiceGate;
  if (state.locale === "zh") {
    els.parentSummary.textContent = gate?.parentSummary ?? t("messages.parentSummaryIdle");
    els.teacherSummary.textContent = teacherSummaryForGate(gate);
    return;
  }
  els.parentSummary.textContent = englishParentSummaryForGate(gate);
  els.teacherSummary.textContent = englishTeacherSummaryForGate(gate);
}

function localizedCoach(result) {
  if (state.locale === "zh") {
    return {
      topPriority: result.coach.topPriorities[0],
      nextDrill: result.coach.nextDrill,
    };
  }

  const segment = result.segments[0];
  const range = formatRange(segment ?? getSelectedRange());
  const issue = result.summary.primaryIssue;
  const learner = localizedSegmentMessage(segment, "learner");
  const nextDrill = localizedSegmentMessage(segment, "practice");
  const prefixes = {
    "pitch-octave": `Fix the register first: ${learner}`,
    "pitch-high": `Intonation is the top priority: ${learner}`,
    "pitch-low": `Intonation is the top priority: ${learner}`,
    "rhythm-drag": `Rhythm needs to sit closer to the beat, especially on entries and bow changes.`,
    stable: `This take is stable. Next, refine tone density and phrase connection.`,
  };
  return {
    topPriority: prefixes[issue] ?? learner,
    nextDrill: nextDrill ?? `${range} is ready for a slower, focused repeat.`,
  };
}

function localizedSegmentMessage(segment, kind) {
  if (!segment) return null;
  if (state.locale === "zh") {
    return kind === "practice" ? segment.practiceSuggestion : segment.learnerMessage;
  }

  const range = formatRange(segment);
  const issues = new Set(segment.issueTypes);
  if (kind === "practice") {
    if (issues.has("pitch-octave")) {
      return `${range}: play only the first target note of each bar, confirm register and octave, then reconnect the phrase.`;
    }
    if (issues.has("pitch-high") || issues.has("pitch-low")) {
      return `${range}: use slow long tones to check finger spacing, then return to tempo once stable.`;
    }
    if (issues.has("rhythm-drag")) {
      return `${range}: turn on the metronome and repeat four times with smaller bow strokes.`;
    }
    return `${range}: this is steady; focus the next take on tone and connection.`;
  }

  if (issues.has("pitch-octave")) {
    return "This recording is nearly an octave away from the score target. Confirm position and target note, then record again.";
  }
  if (issues.has("pitch-high")) {
    return "This passage is generally sharp. Bring the left-hand spacing slightly back.";
  }
  if (issues.has("pitch-low")) {
    return "This passage is generally flat. Reach a little higher toward the target pitch.";
  }
  if (issues.has("rhythm-drag")) {
    return "The rhythm is dragging slightly. Make the bow change and beat entry more decisive.";
  }
  return "This passage is stable overall. Keep the tone and beat placement consistent.";
}

function teacherSummaryForGate(gate) {
  if (!gate) return t("messages.teacherSummaryIdle");
  const range = formatRange(gate.range);
  if (gate.allowedToContinue) {
    return `${range} 已达到当前通过标准，下次课可以从音色、连接和技术细节继续。`;
  }
  if (gate.action === "retry-audio") {
    return `${range} 的录音质量不足，建议先检查环境、麦克风距离和单音清晰度。`;
  }
  const issueText = gate.issueTypes.map(formatIssue).join("、");
  return `${range} 仍被门禁挡住，主要问题是${issueText}，下次课前应优先复查。`;
}

function englishParentSummaryForGate(gate) {
  if (!gate) return t("messages.parentSummaryIdle");
  const range = formatRange(gate.range);
  if (gate.allowedToContinue) {
    return `${range} met the current pass threshold. The student can move forward.`;
  }
  if (gate.action === "retry-audio") {
    return `${range} could not be judged reliably because the audio quality was too low.`;
  }
  const issueText = gate.issueTypes.map(formatIssue).join(" and ");
  return `${range} still needs retry practice for ${issueText}.`;
}

function englishTeacherSummaryForGate(gate) {
  if (!gate) return t("messages.teacherSummaryIdle");
  const range = formatRange(gate.range);
  if (gate.allowedToContinue) {
    return `${range} passed the current gate. The next lesson can move into tone, connection, and technical detail.`;
  }
  if (gate.action === "retry-audio") {
    return `${range} needs a cleaner recording before the result is useful.`;
  }
  const issueText = gate.issueTypes.map(formatIssue).join(" and ");
  return `${range} is still blocked by ${issueText}; review this before the next lesson.`;
}

function formatRange(range) {
  if (state.locale === "zh") {
    return `第 ${range.measureStart}-${range.measureEnd} 小节`;
  }
  return `Bars ${range.measureStart}-${range.measureEnd}`;
}

function formatMeasure(measure) {
  return state.locale === "zh" ? `第 ${measure} 小节` : `Bar ${measure}`;
}

function getPieceTitle(piece) {
  return state.locale === "zh" ? pieceLocales.zh[piece.id]?.title ?? piece.title : piece.englishTitle;
}

function getPieceComposer(piece) {
  return state.locale === "zh" ? pieceLocales.zh[piece.id]?.composer ?? piece.composer : piece.composer;
}

function localizeStatus(label) {
  return t(`status.${label}`, {}, label);
}

function localizedAnalysisError(error) {
  if (state.locale === "en" && error === "录音里可用的小提琴单音太少，请靠近麦克风并重新录制。") {
    return t("messages.tooFewNotes");
  }
  return error;
}

function t(path, values = {}, fallback = path) {
  const dictionary = translations[state.locale] ?? translations.zh;
  const value = path.split(".").reduce((current, key) => current?.[key], dictionary);
  if (typeof value !== "string") return fallback;
  return value.replaceAll(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("violinmaster.history") ?? "[]");
  } catch {
    return [];
  }
}

function loadLocale() {
  try {
    return localStorage.getItem("violinmaster.locale") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function persistLocale() {
  try {
    localStorage.setItem("violinmaster.locale", state.locale);
  } catch {
    // Language selection still works for this session when storage is unavailable.
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
