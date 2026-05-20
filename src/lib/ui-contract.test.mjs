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
