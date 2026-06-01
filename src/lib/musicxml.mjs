const STEP_TO_SEMITONE = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function parseMusicXml(xmlText, options = {}) {
  const part = firstTag(xmlText, "part");
  if (!part) {
    throw new Error("MusicXML does not contain a readable first part.");
  }

  const measures = tags(part.content, "measure");
  if (!measures.length) {
    throw new Error("MusicXML does not contain measures in the first part.");
  }

  const notes = [];
  const measureRanges = [];
  let divisions = 1;

  for (const [measureIndex, measure] of measures.entries()) {
    const measureNumber = Number.parseInt(attribute(measure.open, "number") ?? "", 10);
    const currentMeasure = Number.isFinite(measureNumber) ? measureNumber : measureIndex + 1;
    const nextDivisions = numberTag(measure.content, "divisions");
    if (nextDivisions) divisions = nextDivisions;

    let elapsedDivisions = 0;
    for (const note of tags(measure.content, "note")) {
      const duration = numberTag(note.content, "duration") ?? divisions;
      const chord = hasTag(note.content, "chord");
      const startDivisions = elapsedDivisions;
      if (!chord) elapsedDivisions += duration;
      if (hasTag(note.content, "rest")) continue;

      const pitch = firstTag(note.content, "pitch");
      if (!pitch) continue;
      notes.push({
        measure: currentMeasure,
        beat: startDivisions / divisions + 1,
        durationBeats: duration / divisions,
        midi: pitchToMidi(pitch.content),
      });
    }

    measureRanges.push({
      measureStart: currentMeasure,
      measureEnd: currentMeasure,
      label: `Measure ${currentMeasure}`,
    });
  }

  if (!notes.length) {
    throw new Error("MusicXML does not contain pitched notes in the first part.");
  }

  return {
    id: options.id ?? `musicxml-${stableId(titleFor(xmlText, options))}`,
    title: titleFor(xmlText, options),
    englishTitle: titleFor(xmlText, options),
    composer: composerFor(xmlText, options),
    levelBand: options.levelBand ?? "intermediate",
    category: options.category ?? "exam",
    rightsStatus: "import-required",
    examSystem: options.examSystem ?? "teacher-assigned",
    tempo: options.tempo ?? 72,
    assets: {},
    notes,
    phraseMap: mergePhraseMap(measureRanges, options.phraseSpanMeasures ?? 2),
    techniqueMap: [],
  };
}

function pitchToMidi(pitchXml) {
  const step = textTag(pitchXml, "step");
  const octave = numberTag(pitchXml, "octave");
  const alter = numberTag(pitchXml, "alter") ?? 0;
  if (!step || octave === null || !(step in STEP_TO_SEMITONE)) {
    throw new Error("MusicXML note is missing pitch step or octave.");
  }
  return (octave + 1) * 12 + STEP_TO_SEMITONE[step] + alter;
}

function mergePhraseMap(measures, spanMeasures) {
  const phrases = [];
  for (let index = 0; index < measures.length; index += spanMeasures) {
    const slice = measures.slice(index, index + spanMeasures);
    phrases.push({
      measureStart: slice[0].measureStart,
      measureEnd: slice.at(-1).measureEnd,
      label: `Phrase ${phrases.length + 1}`,
    });
  }
  return phrases;
}

function firstTag(xml, tagName) {
  return tags(xml, tagName)[0] ?? null;
}

function tags(xml, tagName) {
  const pattern = new RegExp(`<${tagName}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => ({
    open: match[0].slice(0, match[0].indexOf(">") + 1),
    content: match[2],
  }));
}

function hasTag(xml, tagName) {
  return new RegExp(`<${tagName}(\\s[^>]*)?\\s*/?>`, "i").test(xml);
}

function textTag(xml, tagName) {
  const tag = firstTag(xml, tagName);
  return decodeXml(tag?.content?.trim() ?? "") || null;
}

function numberTag(xml, tagName) {
  const value = Number.parseFloat(textTag(xml, tagName) ?? "");
  return Number.isFinite(value) ? value : null;
}

function attribute(openTag, name) {
  const match = openTag.match(new RegExp(`${name}="([^"]+)"`, "i"));
  return match?.[1] ?? null;
}

function titleFor(xmlText, options) {
  return textTag(xmlText, "work-title") ?? options.title ?? "Imported MusicXML";
}

function composerFor(xmlText, options) {
  return options.composer ?? creatorByType(xmlText, "composer") ?? "Imported score";
}

function creatorByType(xmlText, type) {
  const creatorPattern = /<creator\s+[^>]*type="([^"]+)"[^>]*>([\s\S]*?)<\/creator>/gi;
  const match = [...xmlText.matchAll(creatorPattern)].find(
    (entry) => entry[1].toLowerCase() === type,
  );
  return decodeXml(match?.[2]?.trim() ?? "") || null;
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function stableId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "score";
}
