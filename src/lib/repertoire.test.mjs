import test from "node:test";
import assert from "node:assert/strict";

import { findPieceById, repertoire } from "./repertoire.mjs";

test("repertoire includes playable MVP seed pieces and metadata-only advanced repertoire", () => {
  assert.ok(repertoire.length >= 6);
  assert.ok(repertoire.some((piece) => piece.rightsStatus === "bundled-candidate"));
  assert.ok(repertoire.some((piece) => piece.rightsStatus === "private-dataset"));
});

test("findPieceById returns a known piece or a safe default", () => {
  assert.equal(findPieceById("bach-minuet-g-1").title, "G 大调小步舞曲第 1 首");
  assert.equal(findPieceById("missing").id, repertoire[0].id);
});

test("repertoire entries expose PRD practice metadata", () => {
  for (const piece of repertoire) {
    assert.ok(piece.examSystem, `${piece.id} should declare an exam or assignment system`);
    assert.ok(piece.assets, `${piece.id} should declare rights-aware analysis assets`);
    assert.ok(piece.phraseMap.length, `${piece.id} should include phrase ranges`);

    for (const phrase of piece.phraseMap) {
      assert.ok(phrase.measureStart <= phrase.measureEnd);
      assert.ok(piece.notes.some((note) => note.measure === phrase.measureStart));
      assert.ok(piece.notes.some((note) => note.measure === phrase.measureEnd));
    }
  }
});

test("enabled bundled candidates include an analysis asset path", () => {
  const bundledCandidates = repertoire.filter((piece) => piece.rightsStatus === "bundled-candidate");

  assert.ok(bundledCandidates.length);
  for (const piece of bundledCandidates) {
    assert.ok(
      piece.assets.musicxml || piece.assets.midi,
      `${piece.id} needs MusicXML or MIDI to support score-aware practice`,
    );
  }
});
