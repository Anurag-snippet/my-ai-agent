require("dotenv").config();
const readline = require("readline");
const { runAgent } = require("./agent/agent");

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
        if (userInput.trim().toLowerCase() === "exit") {
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
        await runAgent(contents);
    }
}
main();