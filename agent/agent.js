const { GoogleGenAI, Type } = require("@google/genai");

const tools = require("../tools");
const { SYSTEM_PROMPT } = require("./prompts");

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

// --------------------------------
// All available tools
// --------------------------------

const toolDeclarations = [
  listFilesDeclaration,
  readFileDeclaration,
  searchCodeDeclaration,
  writeFileDeclaration,
  runCommandDeclaration,
];

// --------------------------------
// Agent loop
// --------------------------------

async function runAgent(contents) {
  let finalText = "";

  while (true) {
    const stream = await ai.models.generateContentStream({
      model: "gemini-3.1-flash-lite",

      contents: contents,

      config: {
        systemInstruction: SYSTEM_PROMPT,

        tools: [
          {
            functionDeclarations: toolDeclarations,
          },
        ],
      },
    });

    let functionCalls = [];
    let responseContent = null;

    for await (const chunk of stream) {
      if (chunk.text) {
        process.stdout.write(chunk.text);

        finalText += chunk.text;
      }

      if (chunk.functionCalls) {
        functionCalls.push(...chunk.functionCalls);

        responseContent = chunk.candidates?.[0]?.content;
      }
    }

    if (functionCalls.length > 0) {
      if (responseContent) {
        contents.push(responseContent);
      }

      for (const functionCall of functionCalls) {
        console.log("\n\n🔧 Gemini wants to use:");

        console.log("Tool:", functionCall.name);

        console.log("Arguments:", functionCall.args);

        const tool = tools[functionCall.name];

        if (!tool) {
          throw new Error(`Tool ${functionCall.name} not found`);
        }

        const result = tool(functionCall.args);

        console.log("\n📁 Tool result:");

        console.log(result);

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
      continue;
    }

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
