const fs = require("fs");

const { GoogleGenAI, Type } = require("@google/genai");

const tools = require("../tools");
const { SYSTEM_PROMPT } = require("./prompts");
const { askForApproval } = require("./approval");
const { createDiff } = require("./diff");
const { getSafePath } = require("../workspace");
const { isDangerousCommand } = require("./commandSafety");

// --------------------------------
// Gemini client
// --------------------------------

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// --------------------------------
// Tool declarations
// --------------------------------

const listFilesDeclaration = {
  name: "listFiles",

  description: "Lists the files and folders inside a directory.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      directory: {
        type: Type.STRING,
        description:
          "The directory to inspect. Use '.' for the current project.",
      },
    },

    required: ["directory"],
  },
};

// --------------------------------

const getProjectStructureDeclaration = {
  name: "getProjectStructure",

  description:
    "Returns the file structure of the project while excluding dependency and build directories.",

  parameters: {
    type: Type.OBJECT,

    properties: {},
  },
};

// --------------------------------

const readFileDeclaration = {
  name: "readFile",

  description: "Reads the contents of a file.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      filePath: {
        type: Type.STRING,
        description: "The path of the file to read.",
      },
    },

    required: ["filePath"],
  },
};

// --------------------------------

const searchCodeDeclaration = {
  name: "searchCode",

  description:
    "Searches the project's source code for a given text or keyword.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      query: {
        type: Type.STRING,
        description:
          "The keyword or text to search for in the source code.",
      },
    },

    required: ["query"],
  },
};

// --------------------------------

const writeFileDeclaration = {
  name: "writeFile",

  description:
    "Writes content to a file. Use this to create or modify files.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      filePath: {
        type: Type.STRING,
        description:
          "The path of the file to create or modify.",
      },

      content: {
        type: Type.STRING,
        description:
          "The complete new content of the file.",
      },
    },

    required: ["filePath", "content"],
  },
};

// --------------------------------

const editFileDeclaration = {
  name: "editFile",

  description:
    "Makes a precise edit to an existing file by replacing one exact piece of text with new text.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      filePath: {
        type: Type.STRING,
        description:
          "The path of the file to edit.",
      },

      oldText: {
        type: Type.STRING,
        description:
          "The exact existing text that should be replaced.",
      },

      newText: {
        type: Type.STRING,
        description:
          "The new text that should replace oldText.",
      },
    },

    required: [
      "filePath",
      "oldText",
      "newText",
    ],
  },
};

// --------------------------------

const runCommandDeclaration = {
  name: "runCommand",

  description:
    "Runs a terminal command in the current project and returns its output.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      command: {
        type: Type.STRING,
        description:
          "The terminal command to execute.",
      },
    },

    required: ["command"],
  },
};

// --------------------------------

const gitStatusDeclaration = {
  name: "gitStatus",

  description:
    "Returns the current git repository status including modified, untracked, and staged files.",

  parameters: {
    type: Type.OBJECT,

    properties: {},
  },
};

// --------------------------------

const gitDiffDeclaration = {
  name: "gitDiff",

  description:
    "Returns the uncommitted git diff (working directory changes).",

  parameters: {
    type: Type.OBJECT,

    properties: {},
  },
};

// --------------------------------

const gitLogDeclaration = {
  name: "gitLog",

  description:
    "Returns recent commit history for the repository.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      count: {
        type: Type.INTEGER,
        description:
          "The number of recent commits to inspect (default: 5).",
      },
    },
  },
};

// --------------------------------
// All available tools
// --------------------------------

const toolDeclarations = [
  listFilesDeclaration,
  getProjectStructureDeclaration,
  readFileDeclaration,
  searchCodeDeclaration,
  writeFileDeclaration,
  editFileDeclaration,
  runCommandDeclaration,
  gitStatusDeclaration,
  gitDiffDeclaration,
  gitLogDeclaration,
];

// --------------------------------
// Agent loop
// --------------------------------

async function runAgent(contents) {
  let finalText = "";

  while (true) {
    // --------------------------------
    // Ask Gemini
    // --------------------------------

    const stream =
      await ai.models.generateContentStream({
        model: "gemini-3.1-flash-lite",

        contents: contents,

        config: {
          systemInstruction: SYSTEM_PROMPT,

          tools: [
            {
              functionDeclarations:
                toolDeclarations,
            },
          ],
        },
      });

    let functionCalls = [];
    let responseContent = null;

    // --------------------------------
    // Read Gemini stream
    // --------------------------------

    for await (const chunk of stream) {
      if (chunk.text) {
        process.stdout.write(chunk.text);

        finalText += chunk.text;
      }

      if (chunk.functionCalls) {
        functionCalls.push(
          ...chunk.functionCalls
        );

        responseContent =
          chunk.candidates?.[0]?.content ||
          responseContent;
      }
    }

    // --------------------------------
    // Gemini wants to use a tool
    // --------------------------------

    if (functionCalls.length > 0) {
      // Add Gemini's tool call to conversation
      if (responseContent) {
        contents.push(responseContent);
      }

      // --------------------------------
      // Execute every requested tool
      // --------------------------------

      for (const functionCall of functionCalls) {
        console.log(
          "\n\n🔧 Gemini wants to use:"
        );

        console.log(
          "Tool:",
          functionCall.name
        );

        console.log(
          "Arguments:",
          functionCall.args
        );

        let result;

        try {
          // --------------------------------
          // Find tool
          // --------------------------------

          const tool =
            tools[functionCall.name];

          if (!tool) {
            throw new Error(
              `Tool ${functionCall.name} not found`
            );
          }

          // =================================
          // EDIT FILE
          // =================================

          if (
            functionCall.name === "editFile"
          ) {
            const {
              filePath,
              oldText,
              newText,
            } = functionCall.args;

            // --------------------------------
            // Get safe path
            // --------------------------------

            const safePath =
              getSafePath(filePath);

            // --------------------------------
            // Read current file
            // --------------------------------

            const oldContent =
              fs.readFileSync(
                safePath,
                "utf-8"
              );

            // --------------------------------
            // Check how many matches exist
            // --------------------------------

            const occurrences =
              oldContent
                .split(oldText)
                .length - 1;

            if (occurrences === 0) {
              throw new Error(
                "The specified oldText was not found in the file."
              );
            }

            if (occurrences > 1) {
              throw new Error(
                `The specified oldText was found ${occurrences} times.`
              );
            }

            // --------------------------------
            // Create new content
            // --------------------------------

            const newContent =
              oldContent.replace(
                oldText,
                newText
              );

            // --------------------------------
            // Generate diff
            // --------------------------------

            const diff = createDiff(
              oldContent,
              newContent
            );

            console.log(
              "\n\n📝 Proposed change:"
            );

            console.log(
              "--------------------------------"
            );

            console.log(diff);

            console.log(
              "--------------------------------"
            );

            // --------------------------------
            // Ask user
            // --------------------------------

            const approved =
              await askForApproval(
                "Apply this change?"
              );

            // --------------------------------
            // User approved
            // --------------------------------

            if (approved) {
              fs.writeFileSync(
                safePath,
                newContent,
                "utf-8"
              );

              console.log(
                "\n✅ Change applied successfully."
              );

              result = {
                success: true,
                message:
                  "Change applied successfully.",
                filePath,
              };
            }

            // --------------------------------
            // User rejected
            // --------------------------------

            else {
              console.log(
                "\n❌ Change rejected by user."
              );

              result = {
                success: false,
                message:
                  "User rejected the change.",
                filePath,
              };
            }
          }

          // =================================
          // WRITE FILE
          // =================================

          else if (
            functionCall.name === "writeFile"
          ) {
            const { filePath, content } =
              functionCall.args;

            // --------------------------------
            // Get safe path
            // --------------------------------

            const safePath =
              getSafePath(filePath);

            // --------------------------------
            // Check if file exists
            // --------------------------------

            const exists =
              fs.existsSync(safePath);

            let diff;

            if (exists) {
              const oldContent =
                fs.readFileSync(
                  safePath,
                  "utf-8"
                );

              diff = createDiff(
                oldContent,
                content
              );

              console.log(
                "\n\n📝 Proposed change for existing file:"
              );
            } else {
              diff = createDiff(
                "",
                content
              );

              console.log(
                `\n\n📝 Proposed new file (${filePath}):`
              );
            }

            console.log(
              "--------------------------------"
            );

            console.log(diff);

            console.log(
              "--------------------------------"
            );

            // --------------------------------
            // Ask user for approval
            // --------------------------------

            const promptMsg = exists
              ? "Overwrite this file?"
              : `Create file ${filePath}?`;

            const approved =
              await askForApproval(promptMsg);

            // --------------------------------
            // User approved
            // --------------------------------

            if (approved) {
              fs.writeFileSync(
                safePath,
                content,
                "utf-8"
              );

              console.log(
                "\n✅ File written successfully."
              );

              result = {
                success: true,
                message:
                  "File written successfully.",
                filePath,
              };
            }

            // --------------------------------
            // User rejected
            // --------------------------------

            else {
              console.log(
                "\n❌ File write rejected by user."
              );

              result = {
                success: false,
                message:
                  "User rejected writing to file.",
                filePath,
              };
            }
          }

          // =================================
          // RUN COMMAND
          // =================================

          else if (
            functionCall.name === "runCommand"
          ) {
            const { command } =
              functionCall.args;

            console.log(
              "\n💻 Requested command:"
            );

            console.log(command);

            // --------------------------------
            // Check command safety
            // --------------------------------

            if (
              isDangerousCommand(command)
            ) {
              console.log(
                "\n⚠️ This command may be dangerous."
              );

              const approved =
                await askForApproval(
                  "Allow this command to run?"
                );

              // --------------------------------
              // User rejected command
              // --------------------------------

              if (!approved) {
                console.log(
                  "\n❌ Command rejected."
                );

                result = {
                  success: false,
                  message:
                    "User rejected the command.",
                };
              }

              // --------------------------------
              // User approved command
              // --------------------------------

              else {
                console.log(
                  "\n▶️ Running command..."
                );

                result =
                  tool(functionCall.args);

                console.log(
                  "\n📁 Command result:"
                );

                console.log(result);
              }
            }

            // --------------------------------
            // Safe command
            // --------------------------------

            else {
              console.log(
                "\n▶️ Running command..."
              );

              result =
                tool(functionCall.args);

              console.log(
                "\n📁 Command result:"
              );

              console.log(result);
            }
          }

          // =================================
          // ALL OTHER TOOLS
          // =================================

          else {
            result =
              tool(functionCall.args);

            console.log(
              "\n📁 Tool result:"
            );

            console.log(result);
          }
        } catch (error) {
          console.log(
            `\n⚠️ Tool execution error: ${error.message}`
          );

          result = {
            success: false,
            error: error.message,
          };
        }

        // --------------------------------
        // Send tool result back to Gemini
        // --------------------------------

        contents.push({
          role: "tool",

          parts: [
            {
              functionResponse: {
                name:
                  functionCall.name,

                response: {
                  result: result,
                },

                id: functionCall.id,
              },
            },
          ],
        });
      }

      // --------------------------------
      // Ask Gemini again
      // --------------------------------

      continue;
    }

    // --------------------------------
    // No tool call
    // Gemini produced final answer
    // --------------------------------

    console.log("\n");

    return finalText;
  }
}

// --------------------------------
// Export
// --------------------------------

module.exports = {
  runAgent,
};