import express from "express";
import "dotenv/config";

import {
  handleWebhookVerification,
  handleWebhook
} from "./routes/webhook.js";

import {
  testDatabaseConnection
} from "./services/database.js";

const app = express();

const PORT = process.env.PORT || 8080;

app.use(express.json());


// ========================================
// ROOT
// ========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    service: "Noor AI WhatsApp Agent",
    version: "1.0.0",
    status: "online"
  });
});


// ========================================
// SYSTEM STATUS
// ========================================

app.get("/status", async (req, res) => {

  const status = {
    success: true,
    service: "Noor AI WhatsApp Agent",

    gemini_configured:
      Boolean(process.env.GEMINI_API_KEY),

    whatsapp_configured:
      Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID
      ),

    webhook_configured:
      Boolean(process.env.WHATSAPP_VERIFY_TOKEN),

    database: {
      configured: false,
      connected: false
    }
  };


  // ========================================
  // SUPABASE CHECK
  // ========================================

  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY
  ) {

    status.database.configured = true;

    try {

      const databaseResult =
        await testDatabaseConnection();

      status.database.connected =
        databaseResult.connected;

      status.database.rows_found =
        databaseResult.rows_found;

    } catch (error) {

      console.error(
        "Supabase health check failed:",
        error
      );

      status.database.error =
        error.message;
    }
  }


  res.status(200).json(status);
});


// ========================================
// WHATSAPP WEBHOOK
// ========================================

app.get(
  "/webhook",
  handleWebhookVerification
);

app.post(
  "/webhook",
  handleWebhook
);


// ========================================
// 404
// ========================================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    error: "Route not found"
  });

});


// ========================================
// ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {

  console.error(
    "Server error:",
    error
  );

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });

});


// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {

  console.log(
    `Noor AI WhatsApp Agent running on port ${PORT}`
  );

});
