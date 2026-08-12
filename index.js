require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const readline = require("readline");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion() {
    rl.question("You: ", async (question) => {

        if (question.toLowerCase() === "exit") {
            console.log("Goodbye!");
            rl.close();
            return;
        }

        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: question
            });

            console.log("AI:", response.text);
            console.log();

        } catch (error) {
            console.log("Error:", error.message);
        }

        askQuestion();
    });
}

console.log("🤖 My AI Agent");
console.log("Type 'exit' to quit.\n");

askQuestion();