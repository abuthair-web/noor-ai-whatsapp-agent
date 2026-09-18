import { generateReply } from "../services/gemini.js";


/*
|--------------------------------------------------------------------------
| NOOR AI AGENT
|--------------------------------------------------------------------------
*/

export async function runAgent(
  userMessage,
  context = {}
) {

  try {

    /*
    |--------------------------------------------------------------------------
    | Validate message
    |--------------------------------------------------------------------------
    */

    if (
      !userMessage ||
      !userMessage.trim()
    ) {

      return {
        success: false,
        reply:
          "Please send me a message so I can help you."
      };

    }


    /*
    |--------------------------------------------------------------------------
    | Normalize context
    |--------------------------------------------------------------------------
    */

    const agentContext = {

      businessId:
        context.businessId ||
        process.env.BUSINESS_ID ||
        "demo-business",

      customerPhone:
        context.customerPhone ||
        null,

      customerId:
        context.customerId ||
        null,

      conversationId:
        context.conversationId ||
        null

    };


    console.log(
      "Agent received:",
      userMessage
    );

    console.log(
      "Agent context:",
      JSON.stringify(
        agentContext
      )
    );


    /*
    |--------------------------------------------------------------------------
    | Generate AI response
    |--------------------------------------------------------------------------
    */

    const reply =
      await generateReply(
        userMessage,
        agentContext
      );


    /*
    |--------------------------------------------------------------------------
    | Return response
    |--------------------------------------------------------------------------
    */

    return {

      success: true,

      reply,

      context:
        agentContext

    };

  } catch (error) {

    console.error(
      "Agent error:",
      error
    );


    return {

      success: false,

      reply:
        "I'm sorry, I'm having trouble responding right now. Please try again shortly.",

      error:
        error.message

    };

  }

}
