// src/utils/diff.js
// Standard Unified Diff implementation with hunks and LCS

function computeLCS(aLines, bLines) {
  const n = aLines.length;
  const m = bLines.length;
  // Use DP table for LCS
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

  for (let i = 1; i <= n; i++) {
    const a = aLines[i - 1];
    for (let j = 1; j <= m; j++) {
      if (a === bLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to extract edit operations: 'keep', 'delete', 'insert'
  const edits = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      edits.push({ type: "keep", line: aLines[i - 1], oldIndex: i, newIndex: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({ type: "insert", line: bLines[j - 1], newIndex: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      edits.push({ type: "delete", line: aLines[i - 1], oldIndex: i });
      i--;
    }
  }

  return edits.reverse();
}

/**
 * Generates unified diff with hunks
 * @param {string} oldContent - Original text
 * @param {string} newContent - Modified text
 * @param {object} options - Options (filePath, contextLines)
 * @returns {string} Unified diff string
 */
function createUnifiedDiff(oldContent, newContent, options = {}) {
  const filePath = options.filePath || "file";
  const contextLines = options.contextLines !== undefined ? options.contextLines : 3;

  if (oldContent === newContent) {
    return "";
  }

  const oldLines = oldContent === "" ? [] : oldContent.split(/\r?\n/);
  const newLines = newContent === "" ? [] : newContent.split(/\r?\n/);

  // If oldContent was empty, it's a completely new file
  if (oldLines.length === 0) {
    const lines = [
      `--- /dev/null`,
      `+++ b/${filePath}`,
      `@@ -0,0 +1,${newLines.length} @@`,
      ...newLines.map((l) => `+ ${l}`),
    ];
    return lines.join("\n");
  }

  // If newContent was empty, it's a deleted file
  if (newLines.length === 0) {
    const lines = [
      `--- a/${filePath}`,
      `+++ /dev/null`,
      `@@ -1,${oldLines.length} +0,0 @@`,
      ...oldLines.map((l) => `- ${l}`),
    ];
    return lines.join("\n");
  }

  const edits = computeLCS(oldLines, newLines);

  // Find edit chunks
  const chunks = [];
  let currentChunk = null;

  for (let idx = 0; idx < edits.length; idx++) {
    const edit = edits[idx];
    if (edit.type !== "keep") {
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(edits.length, idx + contextLines + 1);

      if (!currentChunk) {
        currentChunk = { start, end };
      } else if (start <= currentChunk.end) {
        currentChunk.end = end;
      } else {
        chunks.push(currentChunk);
        currentChunk = { start, end };
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    return "";
  }

  const diffLines = [`--- a/${filePath}`, `+++ b/${filePath}`];

  for (const chunk of chunks) {
    const slice = edits.slice(chunk.start, chunk.end);
    let oldStart = 0;
    let oldCount = 0;
    let newStart = 0;
    let newCount = 0;

    for (const item of slice) {
      if (item.type === "keep") {
        if (!oldStart) oldStart = item.oldIndex;
        if (!newStart) newStart = item.newIndex;
        oldCount++;
        newCount++;
      } else if (item.type === "delete") {
        if (!oldStart) oldStart = item.oldIndex;
        oldCount++;
      } else if (item.type === "insert") {
        if (!newStart) newStart = item.newIndex;
        newCount++;
      }
    }

    if (!oldStart) oldStart = 1;
    if (!newStart) newStart = 1;

    diffLines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);

    for (const item of slice) {
      if (item.type === "keep") {
        diffLines.push(`  ${item.line}`);
      } else if (item.type === "delete") {
        diffLines.push(`- ${item.line}`);
      } else if (item.type === "insert") {
        diffLines.push(`+ ${item.line}`);
      }
    }
  }

  return diffLines.join("\n");
}

/**
 * Backwards compatible createDiff function
 */
function createDiff(oldContent, newContent, filePath = "file") {
  return createUnifiedDiff(oldContent, newContent, { filePath });
}

/**
 * Formats diff with ANSI colors for terminal display if supported
 */
function colorizeDiff(diffText) {
  if (!diffText) return "";
  const lines = diffText.split("\n");
  const colored = lines.map((line) => {
    if (line.startsWith("---") || line.startsWith("+++")) {
      return `\x1b[1m\x1b[37m${line}\x1b[0m`; // Bold white
    }
    if (line.startsWith("@@")) {
      return `\x1b[36m${line}\x1b[0m`; // Cyan
    }
    if (line.startsWith("+")) {
      return `\x1b[32m${line}\x1b[0m`; // Green
    }
    if (line.startsWith("-")) {
      return `\x1b[31m${line}\x1b[0m`; // Red
    }
    return line;
  });
  return colored.join("\n");
}

module.exports = {
  createUnifiedDiff,
  createDiff,
  colorizeDiff,
};
