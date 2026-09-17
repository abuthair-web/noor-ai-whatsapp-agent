import { runAgent } from "../agent/agent.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";

/*
|--------------------------------------------------------------------------
| Meta Webhook Verification
|--------------------------------------------------------------------------
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
    console.log("WhatsApp webhook verified.");

    return res.status(200).send(challenge);
  }

  console.log("WhatsApp webhook verification failed.");

  return res.sendStatus(403);
}

/*
|--------------------------------------------------------------------------
| Incoming WhatsApp Webhook
|--------------------------------------------------------------------------
*/

export async function handleWebhook(req, res) {
  /*
   * Acknowledge Meta immediately.
   */
  res.sendStatus(200);

  try {
    console.log(
      "WhatsApp webhook:",
      JSON.stringify(req.body, null, 2)
    );

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    const message = value?.messages?.[0];

    /*
     * Ignore status updates and other webhook events.
     */
    if (!message) {
      return;
    }

    /*
     * Currently process text messages.
     */
    if (message.type !== "text") {
      console.log(
        `Unsupported message type: ${message.type}`
      );

      return;
    }

    const customerPhone = message.from;
    const customerMessage = message.text?.body?.trim();

    if (!customerPhone || !customerMessage) {
      return;
    }

    console.log(
      `Customer ${customerPhone}: ${customerMessage}`
    );

    /*
     * Run Noor AI.
     */
    const result = await runAgent(
      customerMessage,
      {
        customerPhone
      }
    );

    /*
     * Send AI response.
     */
    await sendWhatsAppMessage(
      customerPhone,
      result.reply
    );

    console.log(
      `Reply sent to ${customerPhone}`
    );

  } catch (error) {
    console.error(
      "Webhook processing error:",
      error
    );
  }
}
