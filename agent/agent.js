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

const getProjectStructureDeclaration = {
    name: "getProjectStructure",

    description:
        "Returns the file structure of the project while excluding dependency and build directories.",

    parameters: {
        type: Type.OBJECT,

        properties: {},
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
                    "The path of the file to edit."
            },

            oldText: {
                type: Type.STRING,
                description:
                    "The exact existing text that should be replaced."
            },

            newText: {
                type: Type.STRING,
                description:
                    "The new text that should replace oldText."
            }
        },

        required: [
            "filePath",
            "oldText",
            "newText"
        ]
    }
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
    getProjectStructureDeclaration,
    readFileDeclaration,
    searchCodeDeclaration,
    writeFileDeclaration,
    editFileDeclaration,
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
