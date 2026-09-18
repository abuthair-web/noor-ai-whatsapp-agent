import { GoogleGenAI, Type } from "@google/genai";
import { buildSystemPrompt } from "../agent/systemPrompt.js";
import { tools } from "../agent/tools.js";

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

/*
|--------------------------------------------------------------------------
| Convert Noor AI tools into Gemini function declarations
|--------------------------------------------------------------------------
*/

function buildToolDeclarations() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description || `Execute ${name}`,
    parameters: tool.parameters || {
      type: Type.OBJECT,
      properties: {}
    }
  }));
}

/*
|--------------------------------------------------------------------------
| Generate AI reply with function calling
|--------------------------------------------------------------------------
*/

export async function generateReply(userMessage, context = {}) {
  const ai = getClient();

  const toolDeclarations = buildToolDeclarations();

  let response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: userMessage,
    config: {
      systemInstruction: buildSystemPrompt(),
      tools: [
        {
          functionDeclarations: toolDeclarations
        }
      ]
    }
  });

  /*
  |--------------------------------------------------------------------------
  | Check whether Gemini wants to call a tool
  |--------------------------------------------------------------------------
  */

  const functionCalls = response.functionCalls;

  if (functionCalls && functionCalls.length > 0) {
    const toolResults = [];

    for (const call of functionCalls) {
      const toolName = call.name;
      const toolArgs = call.args || {};

      console.log("Gemini requested tool:", toolName);
      console.log("Tool arguments:", toolArgs);

      const tool = tools[toolName];

      if (!tool) {
        toolResults.push({
          functionResponse: {
            name: toolName,
            response: {
              success: false,
              error: `Tool ${toolName} is not available.`
            }
          }
        });

        continue;
      }

      try {
        const result = await tool.execute(toolArgs, context);

        console.log("Tool result:", result);

        toolResults.push({
          functionResponse: {
            name: toolName,
            response: result
          }
        });

      } catch (error) {
        console.error(`Tool ${toolName} failed:`, error);

        toolResults.push({
          functionResponse: {
            name: toolName,
            response: {
              success: false,
              error: error.message
            }
          }
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Send tool results back to Gemini
    |--------------------------------------------------------------------------
    */

    response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: userMessage
            }
          ]
        },
        {
          role: "model",
          parts: response.candidates?.[0]?.content?.parts || []
        },
        {
          role: "user",
          parts: toolResults.map((item) => ({
            functionResponse: item.functionResponse
          }))
        }
      ],
      config: {
        systemInstruction: buildSystemPrompt(),
        tools: [
          {
            functionDeclarations: toolDeclarations
          }
        ]
      }
    });
  }

  return (
    response.text ||
    "I'm sorry, I couldn't generate a response right now."
  );
}
