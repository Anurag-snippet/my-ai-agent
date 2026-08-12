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

// Store the conversation
const conversation = [];

function askQuestion() {
    rl.question("You: ", async (question) => {

        if (question.toLowerCase() === "exit") {
            console.log("Goodbye!");
            rl.close();
            return;
        }

        // Add user's message to conversation
        conversation.push({
            role: "user",
            parts: [{ text: question }]
        });

        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: conversation
            });

            const answer = response.text;

            console.log("AI:", answer);
            console.log();

            // Add AI's response to conversation
            conversation.push({
                role: "model",
                parts: [{ text: answer }]
            });

        } catch (error) {
            console.log("Error:", error.message);

            // Remove user's message if API call failed
            conversation.pop();
        }

        askQuestion();
    });
}

console.log("🤖 My AI Agent");
console.log("Type 'exit' to quit.\n");

askQuestion();