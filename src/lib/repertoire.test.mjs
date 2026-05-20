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
