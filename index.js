require("dotenv").config();

const { GoogleGenAI, Type } = require("@google/genai");

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

async function main() {

    const contents = [
        {
            role: "user",
            parts: [
                {
                    text: "Read tools/fileTools.js and explain what it does.",
                },
            ],
        },
    ];

    while (true) {

        // --------------------------------
        // Ask Gemini
        // --------------------------------

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",

            contents: contents,

            config: {
                tools: [
                    {
                        functionDeclarations: [
                            listFilesDeclaration,
                            readFileDeclaration,
                        ],
                    },
                ],
            },
        });


        // --------------------------------
        // Check if Gemini wants a tool
        // --------------------------------

        if (
            response.functionCalls &&
            response.functionCalls.length > 0
        ) {

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
                    throw new Error(
                        `Tool ${functionCall.name} not found`
                    );
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

                contents.push(
                    response.candidates[0].content
                );


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

main();

