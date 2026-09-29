// src/agent/Planner.js
const { PLANNER_PROMPT } = require("./prompts");
const { toolDeclarations } = require("../tools");
const { analyzeProject, getProjectStructure } = require("../tools/projectTools");
const { searchCode } = require("../tools/searchTools");
const { divider } = require("../ui/renderer");

class Planner {
  constructor(geminiClient, modelName = "gemini-2.5-flash") {
    this.ai = geminiClient;
    this.modelName = modelName;
  }

  /**
   * Generates a high-level engineering plan without modifying any files
   */
  async createPlan(taskDescription) {
    divider("PLANNING MODE", "═");
    console.log(`Analyzing project and formulating implementation plan for:\n"${taskDescription}"\n`);

    // 1. Inspect project basics
    const projectInfo = analyzeProject().data;
    const structure = getProjectStructure({ maxDepth: 2 }).data;

    // 2. Perform quick keywords search if task mentions terms
    const keywords = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["this", "that", "with", "make", "create", "need", "want", "help", "from"].includes(w))
      .slice(0, 3);

    let searchMatches = [];
    for (const kw of keywords) {
      const res = searchCode({ query: kw, maxResults: 5 });
      if (res.success && res.data?.results) {
        searchMatches.push(...res.data.results.map((m) => m.file));
      }
    }
    const candidateFiles = Array.from(new Set(searchMatches));

    const promptContext = `
Project Context:
- Project Type: ${projectInfo.projectType}
- Language: ${projectInfo.language}
- Framework: ${projectInfo.framework || "None"}
- Test Commands: ${projectInfo.testCommands.join(", ") || "None"}
- Build Commands: ${projectInfo.buildCommands.join(", ") || "None"}
- Candidate Files Found: ${candidateFiles.length > 0 ? candidateFiles.join(", ") : "None specific"}
- Top-level directories: ${structure.structure.slice(0, 15).join(", ")}

User Task:
${taskDescription}

Please construct a comprehensive implementation plan adhering to the planning instructions.
`;

    let response;
    let retries = 3;
    while (retries >= 0) {
      try {
        response = await this.ai.models.generateContent({
          model: this.modelName,
          contents: [
            {
              role: "user",
              parts: [{ text: promptContext }],
            },
          ],
          config: {
            systemInstruction: PLANNER_PROMPT,
          },
        });
        break;
      } catch (err) {
        if (retries > 0) {
          retries--;
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }

    const planText = response.text || "Failed to generate plan.";
    divider("PROPOSED IMPLEMENTATION PLAN");
    console.log(planText);
    divider("", "═");

    return {
      task: taskDescription,
      planText,
      candidateFiles,
      testCommands: projectInfo.testCommands,
    };
  }
}

module.exports = { Planner };
