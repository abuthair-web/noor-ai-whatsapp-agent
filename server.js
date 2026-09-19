import express from "express";
import "dotenv/config";

import {
  handleWebhookVerification,
  handleWebhook
} from "./routes/webhook.js";

import {
  testDatabaseConnection,
  getPaymentByOrderId,
  updatePaymentByOrderId,
  updateBooking
} from "./services/database.js";

import {
  verifyRazorpayWebhookSignature
} from "./services/razorpay.js";

const app = express();

const PORT = process.env.PORT || 8080;


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

    razorpay_configured:
      Boolean(
        process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET
      ),

    razorpay_webhook_configured:
      Boolean(
        process.env.RAZORPAY_WEBHOOK_SECRET
      ),

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
// RAZORPAY WEBHOOK
// ========================================
//
// IMPORTANT:
// This route must receive the raw request body
// so Razorpay's HMAC signature can be verified.
//

app.post(
  "/webhook/razorpay",
  express.raw({
    type: "application/json"
  }),
  async (req, res) => {

    try {

      const signature =
        req.headers["x-razorpay-signature"];

      if (!signature) {

        console.error(
          "Razorpay webhook signature missing."
        );

        return res.status(400).json({
          success: false,
          error: "Missing Razorpay webhook signature."
        });
      }


      const rawBody =
        req.body.toString("utf8");


      const verified =
        verifyRazorpayWebhookSignature(
          rawBody,
          signature
        );


      if (!verified) {

        console.error(
          "Invalid Razorpay webhook signature."
        );

        return res.status(400).json({
          success: false,
          error: "Invalid webhook signature."
        });
      }


      const event =
        JSON.parse(rawBody);


      console.log(
        "Verified Razorpay webhook:",
        JSON.stringify(event, null, 2)
      );


      const eventName =
        event.event;


      // ========================================
      // PAYMENT SUCCESS
      // ========================================

      if (eventName === "order.paid") {

  const paymentEntity =
    event.payload?.payment?.entity;

  const orderEntity =
    event.payload?.order?.entity;

  const paymentId =
    paymentEntity?.id || null;

  const orderId =
    paymentEntity?.order_id ||
    orderEntity?.id ||
    null;

  console.log(
    "Razorpay order.paid received:",
    {
      paymentId,
      orderId
    }
  );

  if (!orderId) {
    console.error(
      "Razorpay order.paid event has no order ID."
    );

    return res.status(400).json({
      success: false,
      error: "Payment order ID missing."
    });
  }

  const payment =
    await getPaymentByOrderId(orderId);

  if (!payment) {
    console.error(
      `No payment record found for Razorpay order ${orderId}`
    );

    return res.status(404).json({
      success: false,
      error: "Payment record not found."
    });
  }

  /*
   * Idempotency:
   * If Razorpay sends the same webhook again,
   * don't process the payment twice.
   */
  if (payment.status === "paid") {

    console.log(
      `Payment ${orderId} is already marked as paid.`
    );

    return res.status(200).json({
      success: true,
      received: true,
      already_processed: true
    });
  }

  const updatedPayment =
    await updatePaymentByOrderId(
      orderId,
      {
        status: "paid",
        provider_payment_id: paymentId,
        razorpay_payment_id: paymentId,
        razorpay_signature:
          signature
      }
    );

  console.log(
    "Payment marked as paid:",
    updatedPayment.id
  );

  if (payment.booking_id) {

    const updatedBooking =
      await updateBooking(
        payment.business_id,
        payment.booking_id,
        {
          status: "confirmed",
          payment_status: "paid"
        }
      );

    console.log(
      "Booking confirmed:",
      updatedBooking.id
    );
  }

  console.log(
    `Payment successfully processed for order ${orderId}`
  );
}

      // ========================================
      // PAYMENT FAILED
      // ========================================

     if (eventName === "payment.failed") {

  const paymentEntity =
    event.payload?.payment?.entity;

  const paymentId =
    paymentEntity?.id || null;

  const orderId =
    paymentEntity?.order_id || null;

  console.log(
    "Razorpay payment.failed received:",
    {
      paymentId,
      orderId
    }
  );

  if (!orderId) {
    console.error(
      "Payment failure event has no order ID."
    );

    return res.status(400).json({
      success: false,
      error: "Payment order ID missing."
    });
  }

  const payment =
    await getPaymentByOrderId(orderId);

  if (!payment) {
    console.error(
      `No payment record found for failed order ${orderId}`
    );

    return res.status(404).json({
      success: false,
      error: "Payment record not found."
    });
  }

  if (payment.status === "paid") {

    console.log(
      `Payment ${orderId} is already paid. Ignoring failure event.`
    );

    return res.status(200).json({
      success: true,
      received: true,
      already_paid: true
    });
  }

  await updatePaymentByOrderId(
    orderId,
    {
      status: "failed",
      provider_payment_id: paymentId,
      razorpay_payment_id: paymentId
    }
  );

  console.log(
    `Payment marked as failed for order ${orderId}`
  );
}

      // ========================================
      // ACKNOWLEDGE WEBHOOK
      // ========================================

      return res.status(200).json({
        success: true,
        received: true
      });

    } catch (error) {

      console.error(
        "Razorpay webhook error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Webhook processing failed."
      });
    }
  }
);


// ========================================
// JSON BODY PARSER
// ========================================

app.use(express.json());


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
