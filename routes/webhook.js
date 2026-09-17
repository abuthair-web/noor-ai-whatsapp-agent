import { runAgent } from "../agent/agent.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";

/*
|--------------------------------------------------------------------------
| Noor AI WhatsApp Webhook
|--------------------------------------------------------------------------
*/

/**
 * Meta WhatsApp webhook verification
 */
export function handleWebhookVerification(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  console.log("Webhook verification request received.");

  if (
    mode === "subscribe" &&
    token === verifyToken &&
    challenge
  ) {
    console.log("Noor AI WhatsApp webhook verified successfully.");

    return res.status(200).send(challenge);
  }

  console.log("Noor AI WhatsApp webhook verification failed.");

  return res.sendStatus(403);
}


/**
 * Receive WhatsApp messages from Meta
 */
export async function handleWebhook(req, res) {

  /*
   * Tell Meta that the webhook was received.
   * This must happen quickly.
   */
  res.sendStatus(200);

  try {

    console.log(
      "Incoming WhatsApp webhook:",
      JSON.stringify(req.body, null, 2)
    );

    /*
     * Extract Meta webhook data
     */
    const entry = req.body?.entry?.[0];

    const change = entry?.changes?.[0];

    const value = change?.value;

    const message = value?.messages?.[0];


    /*
     * Ignore events that don't contain a message.
     *
     * Meta also sends status updates such as:
     * sent
     * delivered
     * read
     */
    if (!message) {
      console.log("No customer message found.");
      return;
    }


    /*
     * Currently support text messages.
     */
    if (message.type !== "text") {

      console.log(
        `Unsupported message type: ${message.type}`
      );

      return;
    }


    /*
     * Customer WhatsApp number
     */
    const customerPhone = message.from;


    /*
     * Customer's message
     */
    const customerMessage =
      message.text?.body?.trim();


    if (!customerPhone || !customerMessage) {

      console.log(
        "Customer phone number or message is missing."
      );

      return;
    }


    console.log(
      `Customer ${customerPhone}: ${customerMessage}`
    );


    /*
     |--------------------------------------------------------------------------
     | Noor AI Agent
     |--------------------------------------------------------------------------
     */

    const agentResult = await runAgent(
      customerMessage,
      {
        customerPhone,
        businessId:
          process.env.BUSINESS_ID || "demo-business"
      }
    );


    /*
     * Make sure the agent actually produced a reply.
     */
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
     | Send response back to WhatsApp
     |--------------------------------------------------------------------------
     */

    await sendWhatsAppMessage(
      customerPhone,
      agentResult.reply
    );


    console.log(
      `Noor AI response sent to ${customerPhone}`
    );


  } catch (error) {

    console.error(
      "Noor AI WhatsApp webhook error:",
      error
    );

  }
}
