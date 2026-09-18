import { GoogleGenAI, Type } from "@google/genai";
import { buildSystemPrompt } from "../agent/systemPrompt.js";
import { tools } from "../agent/tools.js";

let client = null;

const MODEL = "gemini-3.5-flash-lite";
const MAX_RETRIES = 3;

/*
|--------------------------------------------------------------------------
| Gemini Client
|--------------------------------------------------------------------------
*/

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
| Retry helper
|--------------------------------------------------------------------------
|
| Gemini can temporarily return 503/429 errors.
| We retry with exponential backoff:
|
| Attempt 1 → immediate
| Attempt 2 → 1.5s
| Attempt 3 → 3s
| Attempt 4 → 6s
|
|--------------------------------------------------------------------------
*/

async function withRetry(operation) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const status = error?.status;

      const retryable =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504;

      if (!retryable || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = 1500 * Math.pow(2, attempt);

      console.log(
        `Gemini temporary error ${status}. Retrying in ${delay}ms...`
      );

      await new Promise(resolve =>
        setTimeout(resolve, delay)
      );
    }
  }

  throw lastError;
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
| Execute a Noor AI tool
|--------------------------------------------------------------------------
*/

async function executeTool(toolName, args, context) {
  const tool = tools[toolName];

  if (!tool) {
    return {
      success: false,
      error: `Tool "${toolName}" is not available.`
    };
  }

  if (typeof tool.execute !== "function") {
    return {
      success: false,
      error: `Tool "${toolName}" does not have an execute function.`
    };
  }

  try {
    console.log(`Executing tool: ${toolName}`);
    console.log("Tool arguments:", JSON.stringify(args));

    const result = await tool.execute(args || {}, context);

    console.log(
      `Tool ${toolName} result:`,
      JSON.stringify(result)
    );

    return result;

  } catch (error) {
    console.error(
      `Tool ${toolName} failed:`,
      error
    );

    return {
      success: false,
      error: error.message
    };
  }
}

/*
|--------------------------------------------------------------------------
| Generate AI Reply
|--------------------------------------------------------------------------
*/

export async function generateReply(
  userMessage,
  context = {}
) {
  const ai = getClient();

  const toolDeclarations =
    buildToolDeclarations();

  /*
  |--------------------------------------------------------------------------
  | Conversation contents
  |--------------------------------------------------------------------------
  */

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: userMessage
        }
      ]
    }
  ];

  /*
  |--------------------------------------------------------------------------
  | First Gemini request
  |--------------------------------------------------------------------------
  */

  let response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(),

        tools: [
          {
            functionDeclarations:
              toolDeclarations
          }
        ]
      }
    })
  );

  /*
  |--------------------------------------------------------------------------
  | Function calling loop
  |--------------------------------------------------------------------------
  */

  let toolRound = 0;
  const MAX_TOOL_ROUNDS = 5;

  while (
    response.functionCalls &&
    response.functionCalls.length > 0 &&
    toolRound < MAX_TOOL_ROUNDS
  ) {
    toolRound++;

    console.log(
      `Gemini tool-calling round ${toolRound}`
    );

    /*
    |--------------------------------------------------------------------------
    | Add Gemini's response to conversation
    |--------------------------------------------------------------------------
    */

    const modelParts =
      response.candidates?.[0]?.content?.parts || [];

    contents.push({
      role: "model",
      parts: modelParts
    });

    /*
    |--------------------------------------------------------------------------
    | Execute requested tools
    |--------------------------------------------------------------------------
    */

    const functionResponses = [];

    for (const call of response.functionCalls) {
      const toolResult = await executeTool(
        call.name,
        call.args || {},
        context
      );

      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: toolResult
        }
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Send tool results back to Gemini
    |--------------------------------------------------------------------------
    */

    contents.push({
      role: "user",
      parts: functionResponses
    });

    /*
    |--------------------------------------------------------------------------
    | Ask Gemini for the next response
    |--------------------------------------------------------------------------
    */

    response = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction:
            buildSystemPrompt(),

          tools: [
            {
              functionDeclarations:
                toolDeclarations
            }
          ]
        }
      })
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Final response
  |--------------------------------------------------------------------------
    */

  return (
    response.text ||
    "I'm sorry, I couldn't generate a response right now."
  );
}
