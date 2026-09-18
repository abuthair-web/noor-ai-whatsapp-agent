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

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(express.json());

/*
|--------------------------------------------------------------------------
| Root Health Check
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
| System Status
|--------------------------------------------------------------------------
|
| Checks:
| - Gemini configuration
| - WhatsApp configuration
| - Webhook configuration
| - Supabase configuration
| - Supabase database connection
|
|--------------------------------------------------------------------------
*/

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

  /*
  |--------------------------------------------------------------------------
  | Check Supabase configuration
  |--------------------------------------------------------------------------
  */

  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_KEY
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

/*
|--------------------------------------------------------------------------
| WhatsApp Webhook Verification
|--------------------------------------------------------------------------
*/

app.get(
  "/webhook",
  handleWebhookVerification
);

/*
|--------------------------------------------------------------------------
| WhatsApp Incoming Messages
|--------------------------------------------------------------------------
*/

app.post(
  "/webhook",
  handleWebhook
);

/*
|--------------------------------------------------------------------------
| 404 Handler
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
  console.error(
    "Server error:",
    error
  );

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
