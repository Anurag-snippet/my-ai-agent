// src/agent/ToolExecutor.js
const fs = require("fs");
const path = require("path");
const { tools } = require("../tools");
const { getSafePath, WORKSPACE_ROOT } = require("../safety/pathSafety");
const { classifyCommand, CATEGORIES } = require("../safety/commandSafety");
const { createUnifiedDiff } = require("../utils/diff");
const { getHistoryManager } = require("../utils/history");
const { getApprovalManager } = require("./ApprovalManager");
const { toolStart, toolSuccess, toolFailure } = require("../ui/renderer");
const { successResult, errorResult } = require("../utils/errors");
const logger = require("../utils/logger");

class ToolExecutor {
  constructor(workspaceRoot = WORKSPACE_ROOT) {
    this.workspaceRoot = workspaceRoot;
    this.approvalManager = getApprovalManager();
    this.historyManager = getHistoryManager(workspaceRoot);
  }

  async execute(functionCall) {
    const { name, args } = functionCall;
    toolStart(name, args);
    logger.debug(`Executing tool '${name}'`, args);

    const tool = tools[name];
    if (!tool) {
      const err = `Tool '${name}' is not recognized.`;
      toolFailure(name, err);
      return errorResult(err, "TOOL_NOT_FOUND");
    }

    try {
      let result;

      // ==========================================
      // INTERCEPT EDIT FILE
      // ==========================================
      if (name === "editFile") {
        result = await this.handleEditFile(args);
      }
      // ==========================================
      // INTERCEPT WRITE FILE
      // ==========================================
      else if (name === "writeFile") {
        result = await this.handleWriteFile(args);
      }
      // ==========================================
      // INTERCEPT DELETE FILE
      // ==========================================
      else if (name === "deleteFile") {
        result = await this.handleDeleteFile(args);
      }
      // ==========================================
      // INTERCEPT MOVE FILE
      // ==========================================
      else if (name === "moveFile") {
        result = await this.handleMoveFile(args);
      }
      // ==========================================
      // INTERCEPT RUN COMMAND (SAFETY CHECKS)
      // ==========================================
      else if (name === "runCommand") {
        result = await this.handleRunCommand(args);
      }
      // ==========================================
      // ALL OTHER READ-ONLY TOOLS
      // ==========================================
      else {
        result = tool(args);
        if (result && result.success) {
          toolSuccess(name, this.summarizeSuccess(name, result));
        } else if (result && !result.success) {
          toolFailure(name, result.error?.message || "Execution failed");
        }
      }

      return result;
    } catch (err) {
      toolFailure(name, err.message);
      return errorResult(err.message, "UNHANDLED_TOOL_EXCEPTION");
    }
  }

  summarizeSuccess(name, result) {
    switch (name) {
      case "readFile":
        return `Read ${result.data?.linesReturned || 0} lines from ${result.metadata?.filePath || ""}`;
      case "searchCode":
        return `Found ${result.data?.totalMatches || 0} match(es)`;
      case "listFiles":
        return `Listed ${result.data?.length || 0} items`;
      case "getProjectStructure":
        return `Project tree with ${result.data?.totalEntries || 0} files`;
      case "analyzeProject":
        return `Detected ${result.data?.projectType} (${result.data?.language || ""})`;
      case "gitStatus":
        return `Branch ${result.data?.branch || ""}, ${result.data?.filesChangedCount || 0} file(s) changed`;
      case "gitDiff":
        return result.data?.hasChanges ? "Retrieved uncommitted diff" : "No uncommitted changes";
      case "gitLog":
        return `Retrieved ${result.data?.count || 0} commits`;
      default:
        return "Completed successfully";
    }
  }

  async handleEditFile(args) {
    const { filePath, oldText, newText } = args;
    if (!filePath || oldText === undefined || newText === undefined) {
      return errorResult("filePath, oldText, and newText are required.", "INVALID_ARGUMENTS");
    }

    const safePath = getSafePath(filePath);
    if (!fs.existsSync(safePath)) {
      toolFailure("editFile", `File '${filePath}' does not exist.`);
      return errorResult(`File '${filePath}' does not exist.`, "FILE_NOT_FOUND");
    }

    const currentContent = fs.readFileSync(safePath, "utf-8");
    const occurrences = currentContent.split(oldText).length - 1;

    if (occurrences === 0) {
      const msg = "The specified oldText was not found in the file. Ensure exact matching whitespace.";
      toolFailure("editFile", msg);
      return errorResult(msg, "OLD_TEXT_NOT_FOUND");
    }

    if (occurrences > 1) {
      const msg = `oldText found ${occurrences} times. Provide more unique surrounding context lines.`;
      toolFailure("editFile", msg);
      return errorResult(msg, "AMBIGUOUS_OLD_TEXT");
    }

    const updatedContent = currentContent.replace(oldText, newText);
    const diff = createUnifiedDiff(currentContent, updatedContent, { filePath });

    const { approved } = await this.approvalManager.requestFileApproval(filePath, diff, "EDIT");
    if (!approved) {
      toolFailure("editFile", "User rejected the change.");
      return errorResult("User rejected the edit.", "USER_REJECTED", { filePath });
    }

    fs.writeFileSync(safePath, updatedContent, "utf-8");
    this.historyManager.recordChange({
      type: "edit",
      filePath,
      oldContent: currentContent,
      newContent: updatedContent,
    });

    toolSuccess("editFile", `Applied changes to ${filePath}`);
    return successResult(
      {
        message: `Successfully edited ${filePath}`,
        filePath,
      },
      { tool: "editFile", filePath }
    );
  }

  async handleWriteFile(args) {
    const { filePath, content } = args;
    if (!filePath || content === undefined) {
      return errorResult("filePath and content are required.", "INVALID_ARGUMENTS");
    }

    const safePath = getSafePath(filePath);
    const exists = fs.existsSync(safePath);
    let oldContent = "";

    if (exists) {
      oldContent = fs.readFileSync(safePath, "utf-8");
    }

    const diff = createUnifiedDiff(oldContent, content, { filePath });
    const action = exists ? "OVERWRITE" : "CREATE";

    const { approved } = await this.approvalManager.requestFileApproval(filePath, diff, action);
    if (!approved) {
      toolFailure("writeFile", `User rejected file ${action.toLowerCase()}.`);
      return errorResult(`User rejected file ${action.toLowerCase()}.`, "USER_REJECTED", { filePath });
    }

    const parentDir = path.dirname(safePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(safePath, content, "utf-8");
    this.historyManager.recordChange({
      type: exists ? "write" : "create",
      filePath,
      oldContent: exists ? oldContent : null,
      newContent: content,
    });

    toolSuccess("writeFile", `${action === "CREATE" ? "Created" : "Updated"} ${filePath}`);
    return successResult(
      {
        message: `Successfully wrote to ${filePath}`,
        filePath,
        created: !exists,
      },
      { tool: "writeFile", filePath }
    );
  }

  async handleDeleteFile(args) {
    const { filePath } = args;
    const safePath = getSafePath(filePath);

    if (!fs.existsSync(safePath)) {
      return errorResult(`File '${filePath}' does not exist.`, "FILE_NOT_FOUND");
    }

    const oldContent = fs.readFileSync(safePath, "utf-8");
    const diff = createUnifiedDiff(oldContent, "", { filePath });

    const { approved } = await this.approvalManager.requestFileApproval(filePath, diff, "DELETE");
    if (!approved) {
      toolFailure("deleteFile", "User rejected deletion.");
      return errorResult("User rejected deletion.", "USER_REJECTED", { filePath });
    }

    fs.unlinkSync(safePath);
    this.historyManager.recordChange({
      type: "delete",
      filePath,
      oldContent,
    });

    toolSuccess("deleteFile", `Deleted ${filePath}`);
    return successResult({ message: `Successfully deleted ${filePath}`, filePath }, { tool: "deleteFile" });
  }

  async handleMoveFile(args) {
    const { sourcePath, destinationPath } = args;
    const safeSource = getSafePath(sourcePath);
    const safeDest = getSafePath(destinationPath);

    if (!fs.existsSync(safeSource)) {
      return errorResult(`Source '${sourcePath}' does not exist.`, "SOURCE_NOT_FOUND");
    }

    const diff = `--- a/${sourcePath}\n+++ b/${destinationPath}\n(File moved / renamed)`;
    const { approved } = await this.approvalManager.requestFileApproval(
      `${sourcePath} -> ${destinationPath}`,
      diff,
      "MOVE"
    );

    if (!approved) {
      toolFailure("moveFile", "User rejected file move.");
      return errorResult("User rejected move.", "USER_REJECTED");
    }

    const destDir = path.dirname(safeDest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.renameSync(safeSource, safeDest);
    this.historyManager.recordChange({
      type: "move",
      oldPath: sourcePath,
      newPath: destinationPath,
    });

    toolSuccess("moveFile", `Moved ${sourcePath} -> ${destinationPath}`);
    return successResult({ message: `Moved ${sourcePath} to ${destinationPath}` }, { tool: "moveFile" });
  }

  async handleRunCommand(args) {
    const { command } = args;
    const classification = classifyCommand(command);

    if (!classification.isAllowed) {
      const msg = `Command blocked by security policy: ${classification.blockedReason}`;
      toolFailure("runCommand", msg);
      return errorResult(msg, "COMMAND_BLOCKED", { command });
    }

    if (
      classification.category === CATEGORIES.DESTRUCTIVE ||
      classification.category === CATEGORIES.HIGH_RISK
    ) {
      const { approved } = await this.approvalManager.requestCommandApproval(
        command,
        classification.reason,
        classification.category
      );

      if (!approved) {
        toolFailure("runCommand", "User rejected command execution.");
        return errorResult("User rejected dangerous command.", "USER_REJECTED", { command });
      }
    }

    const result = tools.runCommand(args);
    if (result.success) {
      toolSuccess("runCommand", `Exit code ${result.data?.exitCode} (${result.data?.duration}ms)`);
    } else {
      toolFailure("runCommand", `Failed with exit code ${result.error?.details?.exitCode ?? "err"}`);
    }

    return result;
  }
}

module.exports = { ToolExecutor };
