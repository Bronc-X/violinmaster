export const repertoire = [
  {
    id: "twinkle-variations",
    title: "《小星星》变奏曲",
    englishTitle: "Twinkle, Twinkle, Little Star Variations",
    composer: "Suzuki / Folk",
    levelBand: "beginner",
    category: "suzuki",
    rightsStatus: "import-required",
    tempo: 72,
    notes: simpleScaleNotes(1, [69, 69, 76, 76, 78, 78, 76, 74, 74, 73, 73, 71, 71, 69]),
    techniqueMap: [
      { measureStart: 1, measureEnd: 2, tags: ["intonation", "bowing"] },
      { measureStart: 3, measureEnd: 4, tags: ["rhythm", "fourth-finger"] },
    ],
  },
  {
    id: "bach-minuet-g-1",
    title: "G 大调小步舞曲第 1 首",
    englishTitle: "Minuet in G No. 1",
    composer: "J. S. Bach / Suzuki",
    levelBand: "beginner-intermediate",
    category: "baroque",
    rightsStatus: "bundled-candidate",
    tempo: 88,
    notes: simpleScaleNotes(1, [74, 79, 81, 83, 84, 79, 74, 76, 77, 79, 81, 77, 74, 72, 71, 72]),
    techniqueMap: [
      { measureStart: 1, measureEnd: 2, tags: ["rhythm", "bowing"] },
      { measureStart: 3, measureEnd: 4, tags: ["intonation", "tone"] },
    ],
  },
  {
    id: "vivaldi-a-minor-m1",
    title: "A 小调协奏曲，第 1 乐章",
    englishTitle: "Concerto in A minor, Op. 3 No. 6, I",
    composer: "A. Vivaldi",
    levelBand: "intermediate",
    category: "concerto",
    rightsStatus: "bundled-candidate",
    tempo: 96,
    notes: simpleScaleNotes(1, [69, 72, 76, 81, 79, 77, 76, 74, 72, 71, 69, 71, 72, 76, 74, 72]),
    techniqueMap: [
      { measureStart: 1, measureEnd: 2, tags: ["fast-passages", "bowing"] },
      { measureStart: 3, measureEnd: 4, tags: ["rhythm", "intonation"] },
    ],
  },
  {
    id: "seitz-concerto-2",
    title: "学生协奏曲第 2 号",
    englishTitle: "Student Concerto No. 2, Op. 13",
    composer: "F. Seitz",
    levelBand: "intermediate",
    category: "student-concerto",
    rightsStatus: "bundled-candidate",
    tempo: 92,
    notes: simpleScaleNotes(1, [67, 71, 74, 79, 78, 76, 74, 72, 71, 74, 76, 79, 81, 79, 76, 74]),
    techniqueMap: [
      { measureStart: 1, measureEnd: 2, tags: ["shifting", "intonation"] },
      { measureStart: 3, measureEnd: 4, tags: ["tone", "bowing"] },
    ],
  },
  {
    id: "butterfly-lovers-theme",
    title: "《梁祝》开头主题",
    englishTitle: "Butterfly Lovers Concerto Opening Theme",
    composer: "何占豪 / 陈钢",
    levelBand: "advanced",
    category: "chinese",
    rightsStatus: "private-dataset",
    tempo: 66,
    notes: simpleScaleNotes(1, [74, 76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 83, 81, 79, 76]),
    techniqueMap: [
      { measureStart: 1, measureEnd: 2, tags: ["tone", "vibrato"] },
      { measureStart: 3, measureEnd: 4, tags: ["shifting", "intonation"] },
    ],
  },
  {
    id: "sunshine-tashkurgan",
    title: "《阳光照耀着塔什库尔干》",
    englishTitle: "Sunshine over Tashkurgan",
    composer: "陈钢",
    levelBand: "advanced",
    category: "chinese",
    rightsStatus: "private-dataset",
    tempo: 112,
    notes: simpleScaleNotes(1, [76, 79, 81, 84, 86, 84, 81, 79, 76, 79, 81, 88, 86, 84, 81, 79]),
    techniqueMap: [
      { measureStart: 1, measureEnd: 2, tags: ["fast-passages", "rhythm"] },
      { measureStart: 3, measureEnd: 4, tags: ["shifting", "tone"] },
    ],
  },
];

export function findPieceById(pieceId) {
  return repertoire.find((piece) => piece.id === pieceId) ?? repertoire[0];
}

function simpleScaleNotes(startMeasure, midiValues) {
  return midiValues.map((midi, index) => ({
    measure: startMeasure + Math.floor(index / 4),
    beat: (index % 4) + 1,
    durationBeats: 1,
    midi,
  }));
}
