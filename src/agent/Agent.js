// src/agent/Agent.js
const { GoogleGenAI } = require("@google/genai");
const { ToolExecutor } = require("./ToolExecutor");
const { ContextManager } = require("./ContextManager");
const { AgentLoop } = require("./AgentLoop");
const { Planner } = require("./Planner");
const { getApprovalManager } = require("./ApprovalManager");
const { getHistoryManager } = require("../utils/history");
const { getConfig, updateConfig } = require("../utils/config");
const { WORKSPACE_ROOT, setWorkspaceRoot } = require("../safety/pathSafety");
const { analyzeProject } = require("../tools/projectTools");
const logger = require("../utils/logger");

class Agent {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || WORKSPACE_ROOT;
    setWorkspaceRoot(this.workspaceRoot);
    this.config = getConfig(this.workspaceRoot);

    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ Warning: GEMINI_API_KEY is not set. Please set it in .env or environment variables.");
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.toolExecutor = new ToolExecutor(this.workspaceRoot);
    this.contextManager = new ContextManager();
    this.planner = new Planner(this.ai, this.config.model);
    this.approvalManager = getApprovalManager();
    this.historyManager = getHistoryManager(this.workspaceRoot);

    logger.initSessionLogger(this.workspaceRoot);
    this.bootstrapProjectMemory();
  }

  bootstrapProjectMemory() {
    try {
      const res = analyzeProject();
      if (res.success && res.data) {
        this.contextManager.updateProjectInfo(res.data);
      }
    } catch (_) {}
  }

  async prompt(userInput) {
    const loop = new AgentLoop(
      this.ai,
      this.toolExecutor,
      this.contextManager,
      { model: this.config.model, maxIterations: this.config.maxIterations }
    );
    return await loop.run(userInput);
  }

  async plan(taskDescription) {
    return await this.planner.createPlan(taskDescription);
  }

  undo() {
    return this.historyManager.undo();
  }

  redo() {
    return this.historyManager.redo();
  }

  getHistory() {
    return this.historyManager.getHistory();
  }

  reset() {
    this.contextManager.clear();
    this.approvalManager.resetSession();
    this.bootstrapProjectMemory();
    return { success: true, message: "Session reset successfully." };
  }

  getStatus() {
    return {
      model: this.config.model,
      workspace: this.workspaceRoot,
      memory: this.contextManager.getMemorySummary(),
      historyCount: this.historyManager.getHistory().length,
      undoAvailable: this.historyManager.undoStack.length > 0,
      redoAvailable: this.historyManager.redoStack.length > 0,
    };
  }

  setModel(modelName) {
    this.config.model = modelName;
    updateConfig({ model: modelName }, this.workspaceRoot);
    this.planner.modelName = modelName;
  }
}

// Backwards compatibility for existing code calling runAgent(contents)
async function runAgent(contents) {
  const agent = new Agent();
  // Sync contextManager with existing contents array
  agent.contextManager.contents = contents;
  const loop = new AgentLoop(
    agent.ai,
    agent.toolExecutor,
    agent.contextManager,
    { model: agent.config.model }
  );
  const result = await loop.run();
  return result.finalText;
}

module.exports = {
  Agent,
  runAgent,
};
