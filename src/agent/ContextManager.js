// src/agent/ContextManager.js
// Context compaction, session memory, and message history manager

class ContextManager {
  constructor(maxContextLength = 80000) {
    this.maxContextLength = maxContextLength;
    this.contents = [];
    this.memory = {
      projectType: "Unknown",
      framework: null,
      currentTask: "",
      relevantFiles: new Set(),
      modifiedFiles: new Set(),
      testsRun: [],
      recentErrors: [],
    };
  }

  setCurrentTask(task) {
    this.memory.currentTask = task;
  }

  recordInspectedFile(file) {
    if (file) this.memory.relevantFiles.add(file);
  }

  recordModifiedFile(file) {
    if (file) {
      this.memory.relevantFiles.add(file);
      this.memory.modifiedFiles.add(file);
    }
  }

  recordTestRun(command, success, output) {
    this.memory.testsRun.push({
      command,
      success,
      timestamp: new Date().toISOString(),
      summary: (output || "").substring(0, 300),
    });
  }

  recordError(error) {
    this.memory.recentErrors.push({
      error: typeof error === "string" ? error : (error?.message || String(error)),
      timestamp: new Date().toISOString(),
    });
    if (this.memory.recentErrors.length > 5) {
      this.memory.recentErrors.shift();
    }
  }

  updateProjectInfo(analysis) {
    if (!analysis) return;
    if (analysis.projectType) this.memory.projectType = analysis.projectType;
    if (analysis.framework) this.memory.framework = analysis.framework;
  }

  addUserMessage(text) {
    this.contents.push({
      role: "user",
      parts: [{ text }],
    });
    this.compactIfNeeded();
  }

  addModelResponse(responseContent) {
    if (responseContent) {
      this.contents.push(responseContent);
    }
    this.compactIfNeeded();
  }

  /**
   * Adds tool execution results in the standard Gemini multi-turn format
   * Supports multiple function responses in a single tool turn
   */
  addToolResponses(toolResults) {
    // toolResults: array of { id, name, result }
    const parts = toolResults.map((item) => ({
      functionResponse: {
        name: item.name,
        response: {
          result: item.result,
        },
        id: item.id,
      },
    }));

    this.contents.push({
      role: "user",
      parts,
    });

    this.compactIfNeeded();
  }

  estimateSize() {
    let size = 0;
    for (const msg of this.contents) {
      for (const p of msg.parts || []) {
        if (p.text) size += p.text.length;
        if (p.functionCall) size += JSON.stringify(p.functionCall).length;
        if (p.functionResponse) size += JSON.stringify(p.functionResponse).length;
      }
    }
    return size;
  }

  compactIfNeeded() {
    const currentSize = this.estimateSize();
    if (currentSize <= this.maxContextLength && this.contents.length < 24) {
      return;
    }

    // Keep the first user message and the most recent 8 messages intact.
    // For intermediate tool messages, truncate large data fields.
    const keepTail = 8;
    if (this.contents.length <= keepTail + 2) return;

    const middleEnd = this.contents.length - keepTail;
    for (let i = 1; i < middleEnd; i++) {
      const msg = this.contents[i];
      if (Array.isArray(msg.parts)) {
        for (const p of msg.parts) {
          if (p.functionResponse?.response?.result?.data) {
            const data = p.functionResponse.response.result.data;
            if (typeof data === "string" && data.length > 500) {
              p.functionResponse.response.result.data =
                data.slice(0, 300) + `\n...[compacted ${data.length - 300} chars]...`;
            } else if (data && typeof data === "object") {
              if (data.content && typeof data.content === "string" && data.content.length > 500) {
                data.content =
                  data.content.slice(0, 300) + `\n...[compacted ${data.content.length - 300} chars]...`;
              }
              if (Array.isArray(data.results) && data.results.length > 5) {
                data.results = data.results.slice(0, 5);
                data.compacted = true;
              }
            }
          }
        }
      }
    }
  }

  getContents() {
    return this.contents;
  }

  getMemorySummary() {
    return {
      projectType: this.memory.projectType,
      framework: this.memory.framework,
      currentTask: this.memory.currentTask,
      relevantFiles: Array.from(this.memory.relevantFiles),
      modifiedFiles: Array.from(this.memory.modifiedFiles),
      testsRunCount: this.memory.testsRun.length,
      recentErrors: this.memory.recentErrors,
    };
  }

  clear() {
    this.contents = [];
    this.memory.relevantFiles.clear();
    this.memory.modifiedFiles.clear();
    this.memory.testsRun = [];
    this.memory.recentErrors = [];
    this.memory.currentTask = "";
  }
}

module.exports = { ContextManager };
