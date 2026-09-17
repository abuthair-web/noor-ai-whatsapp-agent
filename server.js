import express from "express";
import "dotenv/config";

import { handleWebhookVerification, handleWebhook } from "./routes/webhook.js";

const app = express();

const PORT = process.env.PORT || 8080;

app.use(express.json());

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    service: "Noor AI WhatsApp Agent",
    version: "1.0.0",
    status: "online"
  });
});

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

app.get("/status", (req, res) => {
  res.status(200).json({
    success: true,
    service: "Noor AI WhatsApp Agent",
    gemini_configured: Boolean(process.env.GEMINI_API_KEY),
    whatsapp_configured: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
    ),
    webhook_configured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN)
  });
});

/*
|--------------------------------------------------------------------------
| WhatsApp Webhook
|--------------------------------------------------------------------------
*/

app.get("/webhook", handleWebhookVerification);

app.post("/webhook", handleWebhook);

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found"
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(
    `Noor AI WhatsApp Agent running on port ${PORT}`
  );
});
