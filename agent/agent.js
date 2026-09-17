import { generateReply } from "../services/gemini.js";
import { tools } from "./tools.js";

/*
|--------------------------------------------------------------------------
| Noor AI Agent
|--------------------------------------------------------------------------
*/

export async function runAgent(userMessage, context = {}) {
  try {
    if (!userMessage || !userMessage.trim()) {
      return {
        success: false,
        reply: "Please send me a message so I can help you."
      };
    }

    console.log("Agent received:", userMessage);

    /*
     * Generate the AI response.
     */
    const reply = await generateReply(
      userMessage,
      context,
      tools
    );

    return {
      success: true,
      reply,
      context
    };

  } catch (error) {
    console.error("Agent error:", error);

    return {
      success: false,
      reply:
        "I'm sorry, I'm having trouble responding right now. Please try again shortly.",
      error: error.message
    };
  }
}
