import { GoogleGenAI } from "@google/genai";

import { buildSystemPrompt } from "../agent/systemPrompt.js";

let client = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
  }

  return client;
}

export async function generateReply(userMessage) {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: userMessage,
    config: {
      systemInstruction: buildSystemPrompt()
    }
  });

  return (
    response.text ||
    "I'm sorry, I couldn't generate a response right now."
  );
}
