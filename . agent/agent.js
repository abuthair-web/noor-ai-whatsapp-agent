import { generateReply } from "../services/gemini.js";

/*
|--------------------------------------------------------------------------
| Noor AI Agent
|--------------------------------------------------------------------------
*/

export async function runAgent(userMessage, context = {}) {
  try {
    const reply = await generateReply(userMessage);

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
