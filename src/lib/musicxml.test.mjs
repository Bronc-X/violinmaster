import test from "node:test";
import assert from "node:assert/strict";

import { parseMusicXml } from "./musicxml.mjs";

const simpleScore = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Scale Study</work-title></work>
  <identification><creator type="composer">Teacher</creator></identification>
  <part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration></note>
      <note><rest/><duration>1</duration></note>
    </measure>
    <measure number="2">
      <note><pitch><step>C</step><alter>1</alter><octave>5</octave></pitch><duration>2</duration></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration></note>
    </measure>
  </part>
</score-partwise>`;

test("parseMusicXml converts first-part pitched notes into analysis reference notes", () => {
  const piece = parseMusicXml(simpleScore, { id: "scale-study", tempo: 80 });

  assert.equal(piece.id, "scale-study");
  assert.equal(piece.title, "Scale Study");
  assert.equal(piece.composer, "Teacher");
  assert.equal(piece.tempo, 80);
  assert.equal(piece.rightsStatus, "import-required");
  assert.deepEqual(
    piece.notes.map((note) => ({
      measure: note.measure,
      beat: note.beat,
      durationBeats: note.durationBeats,
      midi: note.midi,
    })),
    [
      { measure: 1, beat: 1, durationBeats: 1, midi: 69 },
      { measure: 1, beat: 2, durationBeats: 0.5, midi: 70 },
      { measure: 2, beat: 1, durationBeats: 1, midi: 73 },
      { measure: 2, beat: 2, durationBeats: 1, midi: 74 },
    ],
  );
});

test("parseMusicXml builds phrase map from imported measures", () => {
  const piece = parseMusicXml(simpleScore, { phraseSpanMeasures: 1 });

  assert.deepEqual(piece.phraseMap, [
    { measureStart: 1, measureEnd: 1, label: "Phrase 1" },
    { measureStart: 2, measureEnd: 2, label: "Phrase 2" },
  ]);
});

test("parseMusicXml prefers the score title over a file-name fallback", () => {
  const piece = parseMusicXml(simpleScore, { title: "scale-study-file" });

  assert.equal(piece.title, "Scale Study");
  assert.equal(piece.englishTitle, "Scale Study");
});

test("parseMusicXml fails clearly when there are no pitched notes", () => {
  assert.throws(
    () =>
      parseMusicXml(`
        <score-partwise>
          <part id="P1"><measure number="1"><note><rest/><duration>1</duration></note></measure></part>
        </score-partwise>
      `),
    /pitched notes/,
  );
});
