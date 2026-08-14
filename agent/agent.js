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
  while (true) {
    // Ask Gemini what to do next
    const response = await ai.models.generateContent({
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

    // --------------------------------
    // Gemini wants to use a tool
    // --------------------------------

    if (response.functionCalls && response.functionCalls.length > 0) {
      // Add Gemini's response containing
      // the function call to conversation history
      contents.push(response.candidates[0].content);

      // Gemini may request multiple tools
      for (const functionCall of response.functionCalls) {
        console.log("\n🔧 Gemini wants to use:");
        console.log("Tool:", functionCall.name);
        console.log("Arguments:", functionCall.args);

        // --------------------------------
        // Find the requested tool
        // --------------------------------

        const tool = tools[functionCall.name];
        if (!tool) {
          throw new Error(`Tool ${functionCall.name} not found`);
        }

        // --------------------------------
        // Execute the tool
        // --------------------------------

        const result = tool(functionCall.args);

        console.log("\n📁 Tool result:");
        console.log(result);

        // --------------------------------
        // Send tool result back to Gemini
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

      // Gemini needs to see the tool result
      // and decide what to do next
      continue;
    }

    // --------------------------------
    // Gemini has finished
    // --------------------------------

    console.log("\n🤖 Gemini:");
    console.log(response.text);

    break;
  }
}

// --------------------------------
// Export
// --------------------------------

module.exports = {
  runAgent,
};
