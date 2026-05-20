import test from "node:test";
import assert from "node:assert/strict";

import { encodeWav } from "./wav.mjs";

test("encodeWav writes a playable mono PCM wav header", () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const wav = encodeWav(samples, 44_100);
  const bytes = new Uint8Array(wav);
  const view = new DataView(wav);
  const riff = new TextDecoder("ascii").decode(bytes.subarray(0, 4));
  const wave = new TextDecoder("ascii").decode(bytes.subarray(8, 12));

  assert.equal(riff, "RIFF");
  assert.equal(wave, "WAVE");
  assert.equal(view.getUint32(4, true), 36 + samples.length * 2);
  assert.equal(wav.byteLength, 44 + samples.length * 2);
});
