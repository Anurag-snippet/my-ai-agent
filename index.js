require("dotenv").config();

const { GoogleGenAI, Type } = require("@google/genai");
const readline = require("readline");

const tools = require("./tools");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

const searchCodeDeclaration = {
  name: "searchCode",

  description:
    "Searches the project's source code for a given text or keyword.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      query: {
        type: Type.STRING,
        description: "The keyword or text to search for in the source code.",
      },
    },

    required: ["query"],
  },
};

const writeFileDeclaration = {
  name: "writeFile",

  description: "Writes content to a file. Use this to create or modify files.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      filePath: {
        type: Type.STRING,
        description: "The path of the file to create or modify.",
      },

      content: {
        type: Type.STRING,
        description: "The complete new content of the file.",
      },
    },

    required: ["filePath", "content"],
  },
};

const runCommandDeclaration = {
  name: "runCommand",

  description:
    "Runs a terminal command in the current project and returns its output.",

  parameters: {
    type: Type.OBJECT,

    properties: {
      command: {
        type: Type.STRING,
        description: "The terminal command to execute.",
      },
    },

    required: ["command"],
  },
};

const SYSTEM_PROMPT = `
You are an AI coding agent working inside the user's project.

Your job is to help the user understand, modify, and debug their code.

You have access to tools that allow you to:

- list files
- read files
- search source code
- write files
- run terminal commands

Rules:

1. Inspect the relevant code before modifying it.
2. Use tools whenever you need information about the project.
3. Do not guess the contents of files when you can read them.
4. When modifying code, make the smallest reasonable change.
5. After making a code change, run an appropriate test or command when possible.
6. If a command fails, inspect the error and try to fix the problem.
7. Explain what you changed after completing the task.
`;

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  const contents = [];

  while (true) {
    const userInput = await question("\nYou: ");

    if (userInput.toLowerCase() === "exit") {
      rl.close();
      break;
    }

    contents.push({
      role: "user",

      parts: [
        {
          text: userInput,
        },
      ],
    });

    while (true) {
      // --------------------------------
      // Ask Gemini
      // --------------------------------

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",

        contents: contents,

        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [
            {
              functionDeclarations: [
                listFilesDeclaration,
                readFileDeclaration,
                searchCodeDeclaration,
                writeFileDeclaration,
                runCommandDeclaration,
              ],
            },
          ],
        },
      });

      // --------------------------------
      // Check if Gemini wants a tool
      // --------------------------------

      if (response.functionCalls && response.functionCalls.length > 0) {
        // Gemini can potentially request
        // multiple tools
        for (const functionCall of response.functionCalls) {
          console.log("\n🔧 Gemini wants to use:");
          console.log("Tool:", functionCall.name);
          console.log("Arguments:", functionCall.args);

          // --------------------------------
          // Find tool
          // --------------------------------

          const tool = tools[functionCall.name];

          if (!tool) {
            throw new Error(`Tool ${functionCall.name} not found`);
          }

          // --------------------------------
          // Execute tool
          // --------------------------------

          const result = tool(functionCall.args);

          console.log("\n📁 Tool result:");
          console.log(result);

          // --------------------------------
          // Add Gemini's tool call
          // --------------------------------

          contents.push(response.candidates[0].content);

          // --------------------------------
          // Add tool result
          // --------------------------------

          contents.push({
            role: "tool",

            parts: [
              {
                functionResponse: {
                  name: functionCall.name,

                  response: {
                    result: result,
                  },

                  id: functionCall.id,
                },
              },
            ],
          });
        }

        // Continue the while loop
        // Gemini will see the tool result
        // and decide what to do next.

        continue;
      }

      // --------------------------------
      // No tool call = final answer
      // --------------------------------

      console.log("\n🤖 Gemini:");
      console.log(response.text);

      break;
    }
  }
}

main();
