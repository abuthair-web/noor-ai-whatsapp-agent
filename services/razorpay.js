import Razorpay from "razorpay";
import crypto from "crypto";

let razorpay = null;

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID) {
    throw new Error("RAZORPAY_KEY_ID is not configured.");
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured.");
  }

  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  return razorpay;
}

/**
 * Create a Razorpay order.
 */
export async function createRazorpayOrder({
  bookingId,
  amount,
  currency = "INR"
}) {
  const client = getRazorpay();

  if (!bookingId) {
    throw new Error("Booking ID is required.");
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error("A valid payment amount is required.");
  }

  const amountInPaise = Math.round(Number(amount) * 100);

  const order = await client.orders.create({
    amount: amountInPaise,
    currency,
    receipt: `booking_${bookingId}`,
    notes: {
      booking_id: bookingId
    }
  });

  return {
    success: true,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    booking_id: bookingId
  };
}

/**
 * Verify Razorpay Checkout payment signature.
 */
export function verifyRazorpayPayment({
  orderId,
  paymentId,
  signature
}) {
  if (!orderId) {
    throw new Error("Razorpay order ID is required.");
  }

  if (!paymentId) {
    throw new Error("Razorpay payment ID is required.");
  }

  if (!signature) {
    throw new Error("Razorpay payment signature is required.");
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured.");
  }

  const body = `${orderId}|${paymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf8"),
    Buffer.from(signature, "utf8")
  );

  return {
    success: isValid,
    verified: isValid,
    order_id: orderId,
    payment_id: paymentId
  };
}

/**
 * Verify Razorpay webhook signature.
 */
export function verifyRazorpayWebhookSignature(
  rawBody,
  signature
) {
  if (!rawBody) {
    throw new Error("Webhook body is required.");
  }

  if (!signature) {
    throw new Error("Razorpay webhook signature is required.");
  }

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET is not configured."
    );
  }

  const expectedSignature = crypto
    .createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET
    )
    .update(rawBody)
    .digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf8"),
    Buffer.from(signature, "utf8")
  );

  return isValid;
}

/**
 * Fetch a payment directly from Razorpay.
 */
export async function fetchRazorpayPayment(paymentId) {
  const client = getRazorpay();

  if (!paymentId) {
    throw new Error("Payment ID is required.");
  }

  const payment = await client.payments.fetch(paymentId);

  return payment;
}
