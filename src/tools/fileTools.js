// src/tools/fileTools.js
const fs = require("fs");
const path = require("path");
const { getSafePath, isBinaryFile, isSecretFile } = require("../safety/pathSafety");
const { successResult, errorResult, AgentError } = require("../utils/errors");
const { getConfig } = require("../utils/config");

/**
 * List files and directories inside a directory
 */
function listFiles({ directory = "." } = {}) {
  try {
    const safeDirectory = getSafePath(directory);
    if (!fs.existsSync(safeDirectory)) {
      return errorResult(`Directory '${directory}' does not exist.`, "DIR_NOT_FOUND");
    }

    const stat = fs.statSync(safeDirectory);
    if (!stat.isDirectory()) {
      return errorResult(`'${directory}' is a file, not a directory.`, "NOT_A_DIRECTORY");
    }

    const items = fs.readdirSync(safeDirectory, { withFileTypes: true });
    const formatted = items.map((item) => {
      const isDir = item.isDirectory();
      return {
        name: item.name,
        type: isDir ? "directory" : "file",
        path: path.join(directory, item.name).replace(/\\/g, "/"),
      };
    });

    return successResult(formatted, { tool: "listFiles", count: formatted.length });
  } catch (err) {
    return errorResult(err.message, "LIST_FILES_ERROR");
  }
}

/**
 * Reads a file with line-range and size safeguards
 */
function readFile({ filePath, startLine, endLine, maxLines, maxChars } = {}) {
  try {
    if (!filePath) {
      return errorResult("filePath is required.", "INVALID_ARGUMENTS");
    }

    const safePath = getSafePath(filePath);

    if (!fs.existsSync(safePath)) {
      return errorResult(`File '${filePath}' does not exist.`, "FILE_NOT_FOUND");
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      return errorResult(`'${filePath}' is a directory, not a file. Use listFiles instead.`, "IS_A_DIRECTORY");
    }

    // Check if secret file
    if (isSecretFile(filePath)) {
      return errorResult(
        `Access to secret or credential file '${filePath}' is protected. Use explicit user guidance for secrets.`,
        "SECRET_FILE_PROTECTED"
      );
    }

    // Check if binary file
    if (isBinaryFile(filePath)) {
      return errorResult(
        `Binary file (${path.extname(filePath)}) — cannot read as text.`,
        "BINARY_FILE"
      );
    }

    const config = getConfig();
    const effectiveMaxChars = maxChars || config.maxReadChars || 30000;
    const effectiveMaxFileSize = config.maxFileSize || 100000;

    if (stat.size > effectiveMaxFileSize && startLine === undefined) {
      return errorResult(
        `File is too large (${stat.size} bytes, limit ${effectiveMaxFileSize} bytes). ` +
        `Please specify 'startLine' and 'endLine' to read a specific portion of the file.`,
        "FILE_TOO_LARGE",
        { size: stat.size, limit: effectiveMaxFileSize }
      );
    }

    const rawContent = fs.readFileSync(safePath, "utf-8");
    const allLines = rawContent.split(/\r?\n/);
    const totalLines = allLines.length;

    let selectedLines = allLines;
    let actualStartLine = 1;
    let actualEndLine = totalLines;

    if (startLine !== undefined || endLine !== undefined) {
      actualStartLine = Math.max(1, parseInt(startLine, 10) || 1);
      actualEndLine = Math.min(
        totalLines,
        endLine !== undefined ? parseInt(endLine, 10) : totalLines
      );

      if (maxLines && actualEndLine - actualStartLine + 1 > maxLines) {
        actualEndLine = actualStartLine + maxLines - 1;
      }

      selectedLines = allLines.slice(actualStartLine - 1, actualEndLine);
    } else if (maxLines && maxLines < totalLines) {
      actualEndLine = maxLines;
      selectedLines = allLines.slice(0, maxLines);
    }

    let joined = selectedLines.join("\n");
    let truncated = false;

    if (joined.length > effectiveMaxChars) {
      joined = joined.slice(0, effectiveMaxChars) + "\n...[truncated remainder of content]...";
      truncated = true;
    }

    return successResult(
      {
        content: joined,
        totalLines,
        startLine: actualStartLine,
        endLine: actualEndLine,
        linesReturned: selectedLines.length,
        truncated,
      },
      { tool: "readFile", filePath }
    );
  } catch (err) {
    return errorResult(err.message, "READ_FILE_ERROR");
  }
}

/**
 * Writes content to a file (creates parent dirs if needed)
 */
function writeFile({ filePath, content } = {}) {
  try {
    if (!filePath || content === undefined) {
      return errorResult("filePath and content are required.", "INVALID_ARGUMENTS");
    }

    const safePath = getSafePath(filePath);
    const parentDir = path.dirname(safePath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    let oldContent = null;
    const exists = fs.existsSync(safePath);
    if (exists) {
      oldContent = fs.readFileSync(safePath, "utf-8");
    }

    fs.writeFileSync(safePath, content, "utf-8");

    return successResult(
      {
        message: exists ? `Successfully updated ${filePath}` : `Successfully created ${filePath}`,
        filePath,
        created: !exists,
        oldContent,
        newContent: content,
      },
      { tool: "writeFile", filePath }
    );
  } catch (err) {
    return errorResult(err.message, "WRITE_FILE_ERROR");
  }
}

/**
 * Targeted replacement in an existing file
 */
function editFile({ filePath, oldText, newText } = {}) {
  try {
    if (!filePath || oldText === undefined || newText === undefined) {
      return errorResult("filePath, oldText, and newText are required.", "INVALID_ARGUMENTS");
    }

    const safePath = getSafePath(filePath);

    if (!fs.existsSync(safePath)) {
      return errorResult(`File '${filePath}' does not exist.`, "FILE_NOT_FOUND");
    }

    const content = fs.readFileSync(safePath, "utf-8");
    const occurrences = content.split(oldText).length - 1;

    if (occurrences === 0) {
      return errorResult(
        "The specified oldText was not found in the file. Ensure exact matching whitespace and indentation.",
        "OLD_TEXT_NOT_FOUND"
      );
    }

    if (occurrences > 1) {
      return errorResult(
        `The specified oldText was found ${occurrences} times. Please provide more surrounding lines/context to make it unique.`,
        "AMBIGUOUS_OLD_TEXT"
      );
    }

    const updatedContent = content.replace(oldText, newText);
    fs.writeFileSync(safePath, updatedContent, "utf-8");

    return successResult(
      {
        message: `Successfully edited ${filePath}`,
        filePath,
        oldContent: content,
        newContent: updatedContent,
      },
      { tool: "editFile", filePath }
    );
  } catch (err) {
    return errorResult(err.message, "EDIT_FILE_ERROR");
  }
}

/**
 * Deletes a file safely
 */
function deleteFile({ filePath } = {}) {
  try {
    if (!filePath) {
      return errorResult("filePath is required.", "INVALID_ARGUMENTS");
    }

    const safePath = getSafePath(filePath);

    if (!fs.existsSync(safePath)) {
      return errorResult(`File '${filePath}' does not exist.`, "FILE_NOT_FOUND");
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      return errorResult(`'${filePath}' is a directory. deleteFile only removes files.`, "IS_A_DIRECTORY");
    }

    const oldContent = fs.readFileSync(safePath, "utf-8");
    fs.unlinkSync(safePath);

    return successResult(
      {
        message: `Successfully deleted file ${filePath}`,
        filePath,
        oldContent,
      },
      { tool: "deleteFile", filePath }
    );
  } catch (err) {
    return errorResult(err.message, "DELETE_FILE_ERROR");
  }
}

/**
 * Moves or renames a file
 */
function moveFile({ sourcePath, destinationPath } = {}) {
  try {
    if (!sourcePath || !destinationPath) {
      return errorResult("sourcePath and destinationPath are required.", "INVALID_ARGUMENTS");
    }

    const safeSource = getSafePath(sourcePath);
    const safeDest = getSafePath(destinationPath);

    if (!fs.existsSync(safeSource)) {
      return errorResult(`Source '${sourcePath}' does not exist.`, "SOURCE_NOT_FOUND");
    }

    const destDir = path.dirname(safeDest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.renameSync(safeSource, safeDest);

    return successResult(
      {
        message: `Successfully moved '${sourcePath}' to '${destinationPath}'`,
        sourcePath,
        destinationPath,
      },
      { tool: "moveFile" }
    );
  } catch (err) {
    return errorResult(err.message, "MOVE_FILE_ERROR");
  }
}

/**
 * Returns file metadata without reading entire content
 */
function getFileInfo({ filePath } = {}) {
  try {
    if (!filePath) {
      return errorResult("filePath is required.", "INVALID_ARGUMENTS");
    }

    const safePath = getSafePath(filePath);

    if (!fs.existsSync(safePath)) {
      return errorResult(`File '${filePath}' does not exist.`, "FILE_NOT_FOUND");
    }

    const stat = fs.statSync(safePath);
    const isDir = stat.isDirectory();
    const isBinary = !isDir && isBinaryFile(filePath);
    let lineCount = null;

    if (!isDir && !isBinary && stat.size < 500000) {
      try {
        const content = fs.readFileSync(safePath, "utf-8");
        lineCount = content.split(/\r?\n/).length;
      } catch (_) {}
    }

    return successResult(
      {
        filePath,
        sizeBytes: stat.size,
        isDirectory: isDir,
        isBinary,
        lineCount,
        modifiedAt: stat.mtime.toISOString(),
        createdAt: stat.birthtime.toISOString(),
      },
      { tool: "getFileInfo", filePath }
    );
  } catch (err) {
    return errorResult(err.message, "GET_FILE_INFO_ERROR");
  }
}

module.exports = {
  listFiles,
  readFile,
  writeFile,
  editFile,
  deleteFile,
  moveFile,
  getFileInfo,
};
