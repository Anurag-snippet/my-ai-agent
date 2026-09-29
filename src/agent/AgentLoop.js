// src/agent/AgentLoop.js
const { toolDeclarations } = require("../tools");
const { SYSTEM_PROMPT } = require("./prompts");
const { summaryCard } = require("../ui/renderer");
const { getConfig } = require("../utils/config");
const logger = require("../utils/logger");

class AgentLoop {
  constructor(geminiClient, toolExecutor, contextManager, options = {}) {
    this.ai = geminiClient;
    this.toolExecutor = toolExecutor;
    this.contextManager = contextManager;
    this.options = options;
  }

  async run(userPrompt) {
    const config = getConfig();
    const maxIterations = this.options.maxIterations || config.maxIterations || 30;
    const model = this.options.model || config.model || "gemini-2.5-flash";

    if (userPrompt) {
      this.contextManager.setCurrentTask(userPrompt);
      this.contextManager.addUserMessage(userPrompt);
    }

    let iterations = 0;
    let finalText = "";
    const modifiedFilesInTask = new Set();
    const verificationsRun = [];
    const whatChanged = [];

    let currentModel = model;
    const fallbackList = ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.5-flash", "gemini-flash-latest"];
    const fallbackQueue = fallbackList.filter((m) => m !== currentModel);

    while (iterations < maxIterations) {
      iterations++;
      logger.debug(`Agent iteration ${iterations}/${maxIterations} (Model: ${currentModel})`);

      let stream;
      let retries = 2;
      while (retries >= 0) {
        try {
          stream = await this.ai.models.generateContentStream({
            model: currentModel,
            contents: this.contextManager.getContents(),
            config: {
              systemInstruction: SYSTEM_PROMPT,
              tools: [{ functionDeclarations: toolDeclarations }],
            },
          });
          break;
        } catch (err) {
          const isDaily = err.message?.includes("PerDay");
          const is503 = err.message?.includes("503") || err.message?.includes("UNAVAILABLE");
          const isTransient =
            is503 ||
            err.message?.includes("429") ||
            err.message?.includes("RESOURCE_EXHAUSTED");

          // If daily quota is exhausted or 503 overloaded, fall back immediately to another model
          if ((isDaily || is503) && fallbackQueue.length > 0) {
            const nextModel = fallbackQueue.shift();
            console.log(`\n🔄 Model '${currentModel}' unavailable/exhausted. Auto-switching to '${nextModel}'...`);
            currentModel = nextModel;
            retries = 2;
            continue;
          }

          if (isTransient && retries > 0 && !isDaily) {
            retries--;
            let delayMs = 3000;
            const match = err.message?.match(/retry in ([0-9.]+)s/i);
            if (match) {
              delayMs = Math.ceil(parseFloat(match[1]) * 1000) + 1500;
            }
            // If cooldown is very long (> 15s) and we have another model, switch instead of making user wait!
            if (delayMs > 15000 && fallbackQueue.length > 0) {
              const nextModel = fallbackQueue.shift();
              console.log(`\n🔄 Rate limit reached on '${currentModel}'. Auto-switching to '${nextModel}'...`);
              currentModel = nextModel;
              retries = 2;
              continue;
            }

            logger.warn(`API rate limit / transient spike. Waiting ${Math.round(delayMs / 1000)}s before retry... (${retries} retries remaining)`);
            console.log(`\n⏳ Rate limit reached. Waiting ${Math.round(delayMs / 1000)}s before retrying...`);
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }

          logger.error(`Gemini API Error: ${err.message}`);
          console.error(`\n⚠️ Gemini API Error: ${err.message}`);
          return {
            success: false,
            error: err.message,
            finalText: `Failed to communicate with Gemini API: ${err.message}`,
          };
        }
      }

      const functionCalls = [];
      let responseContent = null;
      let streamedTurnText = "";

      try {
        for await (const chunk of stream) {
          if (chunk.text) {
            process.stdout.write(chunk.text);
            streamedTurnText += chunk.text;
            finalText += chunk.text;
          }

          if (chunk.functionCalls) {
            functionCalls.push(...chunk.functionCalls);
            responseContent = chunk.candidates?.[0]?.content || responseContent;
          }
        }
      } catch (err) {
        logger.error(`Error reading stream: ${err.message}`);
        console.error(`\n⚠️ Stream processing error: ${err.message}`);
        return {
          success: false,
          error: err.message,
          finalText,
        };
      }

      // ==========================================
      // HANDLE TOOL CALLS
      // ==========================================
      if (functionCalls.length > 0) {
        // Record assistant response with the tool calls
        if (responseContent) {
          this.contextManager.addModelResponse(responseContent);
        }

        const toolResponses = [];

        for (const call of functionCalls) {
          const result = await this.toolExecutor.execute(call);

          // Track modified files
          if (["editFile", "writeFile", "deleteFile", "moveFile"].includes(call.name) && result.success) {
            const target = call.args.filePath || call.args.destinationPath;
            if (target) {
              modifiedFilesInTask.add(target);
              this.contextManager.recordModifiedFile(target);
              whatChanged.push(`${call.name}: ${target}`);
            }
          }

          // Track inspected files
          if (call.name === "readFile" && call.args.filePath) {
            this.contextManager.recordInspectedFile(call.args.filePath);
          }

          // Track test runs
          if (call.name === "runCommand" && call.args.command) {
            const cmd = call.args.command.toLowerCase();
            if (cmd.includes("test") || cmd.includes("check") || cmd.includes("lint") || cmd.includes("build")) {
              verificationsRun.push({
                command: call.args.command,
                passed: Boolean(result.success && result.data?.success),
                message: result.data?.success ? "Passed successfully" : (result.data?.stderr || "Failed"),
              });
              this.contextManager.recordTestRun(
                call.args.command,
                Boolean(result.success && result.data?.success),
                result.data?.stdout || result.data?.stderr
              );
            }
          }

          toolResponses.push({
            id: call.id,
            name: call.name,
            result,
          });
        }

        // Return tool results back to Gemini in one coordinated response
        this.contextManager.addToolResponses(toolResponses);
        continue;
      }

      // ==========================================
      // NO TOOL CALLS -> MODEL COMPLETED TURN
      // ==========================================
      console.log("\n");

      if (modifiedFilesInTask.size > 0) {
        summaryCard(
          whatChanged,
          Array.from(modifiedFilesInTask),
          verificationsRun,
          []
        );
      }

      return {
        success: true,
        iterations,
        finalText,
        modifiedFiles: Array.from(modifiedFilesInTask),
        verifications: verificationsRun,
      };
    }

    // Hit max iterations
    const msg = `Agent reached maximum reasoning/tool iterations (${maxIterations}). Stopping to prevent infinite loops.`;
    console.warn(`\n⚠️ ${msg}`);
    return {
      success: false,
      error: msg,
      finalText: msg,
    };
  }
}

module.exports = { AgentLoop };
