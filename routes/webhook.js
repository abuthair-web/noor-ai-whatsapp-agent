import { runAgent } from "../.agent/agent.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";

/*
|--------------------------------------------------------------------------
| WhatsApp Webhook Verification
|--------------------------------------------------------------------------
|
| Meta sends a GET request when you configure the WhatsApp webhook.
|
*/

export function handleWebhookVerification(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token &&
    token === verifyToken
  ) {
    console.log("WhatsApp webhook verified successfully.");

    return res.status(200).send(challenge);
  }

  console.log("WhatsApp webhook verification failed.");

  return res.sendStatus(403);
}

/*
|--------------------------------------------------------------------------
| WhatsApp Incoming Webhook
|--------------------------------------------------------------------------
*/

export async function handleWebhook(req, res) {
  /*
   * Meta expects a quick HTTP 200 response.
   */
  res.sendStatus(200);

  try {
    console.log(
      "Incoming WhatsApp webhook:",
      JSON.stringify(req.body, null, 2)
    );

    /*
     * Extract the WhatsApp message.
     */
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    const message = value?.messages?.[0];

    /*
     * Ignore webhook events that are not messages.
     */
    if (!message) {
      console.log("Webhook event contains no message.");
      return;
    }

    /*
     * Currently process text messages.
     */
    if (message.type !== "text") {
      console.log(
        `Unsupported WhatsApp message type: ${message.type}`
      );

      return;
    }

    const customerPhone = message.from;
    const customerMessage = message.text?.body?.trim();

    if (!customerPhone || !customerMessage) {
      console.log("Message is missing phone number or text.");
      return;
    }

    console.log(
      `Customer ${customerPhone}: ${customerMessage}`
    );

    /*
     * Run Noor AI Agent.
     */
    const result = await runAgent(
      customerMessage,
      {
        customerPhone
      }
    );

    /*
     * Send the AI response back to WhatsApp.
     */
    if (!result?.reply) {
      console.log("Agent returned no reply.");
      return;
    }

    await sendWhatsAppMessage(
      customerPhone,
      result.reply
    );

    console.log(
      `Noor AI reply sent to ${customerPhone}`
    );

  } catch (error) {
    console.error(
      "WhatsApp webhook processing error:",
      error
    );
  }
}
