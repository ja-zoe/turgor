const STOP_WORDS = new Set([
  "a","an","the","and","or","but","of","in","on","at","to","for","with",
  "by","from","up","about","into","than","so","no","not","we","i","it",
  "is","was","are","were","be","been","have","has","had","do","did",
  "that","this","they","them","their","our","us","me","my","he","she",
  "his","her","its","very","just","also","can","will","would","could",
  "should","may","might","must","need","needs","get","got","been","been",
  "still","some","any","all","due","time","project","work","week","last",
  "new","same","more","other","when","what","how","which","if","then","as",
]);

/** Extracts top-N recurring words from an array of blocker text strings. */
export function extractBlockerFrequency(
  texts: (string | null)[],
  topN = 10
): { word: string; count: number }[] {
  const freq = new Map<string, number>();

  for (const text of texts) {
    if (!text) continue;
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

/** Finds projects that missed M or more goals in a row (looking at last N records). */
export function findConsecutiveMisses(
  records: { goalMet: boolean | null }[],
  threshold: number
): number {
  let streak = 0;
  let maxStreak = 0;
  for (const r of records) {
    if (r.goalMet === false) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else if (r.goalMet === true) {
      streak = 0;
    }
    // null = N/A, don't break streak
  }
  return maxStreak;
}
