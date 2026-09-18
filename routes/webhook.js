import { runAgent } from "../agent/agent.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";

import {
  getCustomerByPhone,
  createCustomerRecord,
  getOrCreateConversation,
  saveMessage
} from "../services/database.js";


/*
|--------------------------------------------------------------------------
| WEBHOOK VERIFICATION
|--------------------------------------------------------------------------
*/

export function handleWebhookVerification(
  req,
  res
) {

  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN;

  console.log(
    "Webhook verification request received."
  );

  if (
    mode === "subscribe" &&
    token === verifyToken &&
    challenge
  ) {

    console.log(
      "Noor AI WhatsApp webhook verified successfully."
    );

    return res
      .status(200)
      .send(challenge);
  }

  console.log(
    "Noor AI WhatsApp webhook verification failed."
  );

  return res.sendStatus(403);
}


/*
|--------------------------------------------------------------------------
| WHATSAPP WEBHOOK
|--------------------------------------------------------------------------
*/

export async function handleWebhook(
  req,
  res
) {

  /*
  |--------------------------------------------------------------------------
  | Respond to Meta immediately
  |--------------------------------------------------------------------------
  */

  res.sendStatus(200);


  try {

    console.log(
      "Incoming WhatsApp webhook:",
      JSON.stringify(
        req.body,
        null,
        2
      )
    );


    /*
    |--------------------------------------------------------------------------
    | Extract webhook data
    |--------------------------------------------------------------------------
    */

    const entry =
      req.body?.entry?.[0];

    const change =
      entry?.changes?.[0];

    const value =
      change?.value;

    const message =
      value?.messages?.[0];


    /*
    |--------------------------------------------------------------------------
    | Ignore status webhooks
    |--------------------------------------------------------------------------
    */

    if (!message) {

      console.log(
        "No customer message found."
      );

      return;
    }


    /*
    |--------------------------------------------------------------------------
    | Supported message type
    |--------------------------------------------------------------------------
    */

    if (
      message.type !== "text"
    ) {

      console.log(
        `Unsupported message type: ${message.type}`
      );

      return;
    }


    /*
    |--------------------------------------------------------------------------
    | Customer information
    |--------------------------------------------------------------------------
    */

    const customerPhone =
      message.from;

    const customerMessage =
      message.text?.body?.trim();


    if (
      !customerPhone ||
      !customerMessage
    ) {

      console.log(
        "Customer phone number or message is missing."
      );

      return;
    }


    const businessId =
      process.env.BUSINESS_ID ||
      "demo-business";


    console.log(
      `Customer ${customerPhone}: ${customerMessage}`
    );


    /*
    |--------------------------------------------------------------------------
    | Find or create customer
    |--------------------------------------------------------------------------
    */

    let customer =
      await getCustomerByPhone(
        businessId,
        customerPhone
      );


    if (!customer) {

      customer =
        await createCustomerRecord({
          businessId,
          name:
            "WhatsApp Customer",
          phone:
            customerPhone
        });

      console.log(
        `New customer created: ${customer.id}`
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Find or create conversation
    |--------------------------------------------------------------------------
    */

    const conversation =
      await getOrCreateConversation({
        businessId,
        customerId:
          customer.id
      });


    /*
    |--------------------------------------------------------------------------
    | Save customer message
    |--------------------------------------------------------------------------
    */

    await saveMessage({
      businessId,
      conversationId:
        conversation.id,
      customerId:
        customer.id,
      senderType:
        "customer",
      message:
        customerMessage
    });


    console.log(
      `Customer message saved: ${conversation.id}`
    );


    /*
    |--------------------------------------------------------------------------
    | Run Noor AI Agent
    |--------------------------------------------------------------------------
    */

    const agentResult =
      await runAgent(
        customerMessage,
        {
          customerPhone,
          businessId,
          customerId:
            customer.id,
          conversationId:
            conversation.id
        }
      );


    if (
      !agentResult ||
      !agentResult.reply
    ) {

      console.log(
        "Noor AI Agent returned no response."
      );

      return;
    }


    console.log(
      `Noor AI Agent reply: ${agentResult.reply}`
    );


    /*
    |--------------------------------------------------------------------------
    | Send AI response to WhatsApp
    |--------------------------------------------------------------------------
    */

    await sendWhatsAppMessage(
      customerPhone,
      agentResult.reply
    );


    /*
    |--------------------------------------------------------------------------
    | Save AI message
    |--------------------------------------------------------------------------
    */

    await saveMessage({
      businessId,
      conversationId:
        conversation.id,
      customerId:
        customer.id,
      senderType:
        "ai",
      message:
        agentResult.reply
    });


    console.log(
      `Noor AI response sent and saved for ${customerPhone}`
    );


  } catch (error) {

    console.error(
      "Noor AI WhatsApp webhook error:",
      error
    );

  }

}
