import Razorpay from "razorpay";

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
