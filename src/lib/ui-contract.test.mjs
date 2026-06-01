import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("public/index.html", "utf8");
const app = readFileSync("public/app.mjs", "utf8");

test("all visible navigation and tool controls declare a real action contract", () => {
  const requiredActions = [
    "studio",
    "library",
    "start-practice",
    "workbench",
    "stats",
    "coach",
    "settings",
    "back-top",
    "metronome",
    "loop",
    "range",
    "comments",
  ];

  for (const action of requiredActions) {
    assert.match(html, new RegExp(`data-action="${action}"`));
    assert.match(app, new RegExp(`"${action}"\\s*:`));
  }
});

test("all workflow tabs declare a selectable workspace view", () => {
  const requiredViews = ["full", "drill", "pitch", "rhythm", "stats", "coach"];

  for (const view of requiredViews) {
    assert.match(html, new RegExp(`data-view="${view}"`));
    assert.match(app, new RegExp(`"${view}"\\s*:`));
  }
});

test("every DOM id used by the app exists in the static shell", () => {
  const queriedIds = [
    ...new Set([...app.matchAll(/querySelector\("#([^"]+)"\)/g)].map((match) => match[1])),
  ];

  for (const id of queriedIds) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("visible recurring-error labels cover every analysis issue type", () => {
  for (const issue of ["pitch-high", "pitch-low", "pitch-octave", "rhythm-drag", "stable"]) {
    assert.match(app, new RegExp(`"${issue}"\\s*:`));
  }
});

test("workflow and tool controls switch state without forcing page scroll", () => {
  assert.doesNotMatch(html, /scroll-target/);
  assert.doesNotMatch(app, /scrollTarget\s*:/);
  assert.doesNotMatch(app, /scrollToElement\(config\.scrollTarget\)/);
  assert.doesNotMatch(app, /handleMeasureClick[\s\S]*?selectView\("drill"\)/);

  const actionHandlersBlock = app.match(/const actionHandlers = \{[\s\S]*?\n\};/)?.[0] ?? "";
  for (const action of ["range", "stats", "coach"]) {
    assert.doesNotMatch(
      actionHandlersBlock,
      new RegExp(`"${action}"\\s*:\\s*\\([\\s\\S]*?selectView\\([^)]*\\)[\\s\\S]*?\\n\\s*},`, "s"),
    );
  }
});

test("static shell exposes a language switcher and both app locales", () => {
  assert.match(html, /id="languageSelect"/);
  assert.match(app, /const translations\s*=/);

  for (const locale of ["zh", "en"]) {
    assert.match(app, new RegExp(`${locale}\\s*:\\s*{[^}]*tabs\\s*:`, "s"));
    assert.match(app, new RegExp(`${locale}\\s*:\\s*{[^}]*actions\\s*:`, "s"));
    assert.match(app, new RegExp(`${locale}\\s*:\\s*{[^}]*coach\\s*:`, "s"));
  }
});

test("practice gate stays behind learner-facing summary UI", () => {
  assert.doesNotMatch(html, /practiceGate|allowedToContinue|retry-audio/);
  assert.match(app, /renderStakeholderSummaries/);
  assert.match(app, /result\.practiceGate/);
});

test("selected-bar analysis slices audio before score alignment", () => {
  assert.match(app, /function samplesForRange\(audioBuffer, piece, range\)/);
  assert.match(app, /const channel = samplesForRange\(state\.audioBuffer, state\.piece, range\);/);
  assert.doesNotMatch(
    app,
    /const channel = state\.audioBuffer\.getChannelData\(0\);[\s\S]{0,220}analyzePerformance\(\{/,
  );
});

test("MusicXML import and stakeholder summaries are wired into the shell", () => {
  for (const id of ["musicXmlInput", "parentSummary", "teacherSummary", "historySummary"]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(app, new RegExp(`${id}: document\\.querySelector\\("#${id}"\\)`));
  }
  assert.match(app, /parseMusicXml/);
  assert.match(app, /handleMusicXmlImport/);
  assert.match(app, /renderStakeholderSummaries/);
});
