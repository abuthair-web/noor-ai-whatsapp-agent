import { createClient } from "@supabase/supabase-js";

let supabase = null;

/*
|--------------------------------------------------------------------------
| SUPABASE CLIENT
|--------------------------------------------------------------------------
*/

export function getSupabase() {
  if (!process.env.SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is not configured."
    );
  }

  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured."
    );
  }

  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );
  }

  return supabase;
}


/*
|--------------------------------------------------------------------------
| BUSINESS
|--------------------------------------------------------------------------
*/

export async function getBusinessFromDatabase(
  businessId
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("businesses")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (error) {
    throw new Error(
      `Failed to load business: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| CUSTOMER
|--------------------------------------------------------------------------
*/

export async function getCustomerByPhone(
  businessId,
  phone
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find customer: ${error.message}`
    );
  }

  return data;
}


export async function createCustomerRecord({
  businessId,
  name,
  phone,
  email = null
}) {
  const db = getSupabase();

  const { data, error } = await db
    .from("customers")
    .upsert(
      {
        business_id: businessId,
        name,
        phone,
        email,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "business_id,phone"
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to create customer: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| ROOMS
|--------------------------------------------------------------------------
*/

export async function getAvailableRooms({
  businessId,
  guests
}) {
  const db = getSupabase();

  const { data, error } = await db
    .from("rooms")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "available")
    .gte("capacity", Number(guests))
    .order("price_per_night", {
      ascending: true
    });

  if (error) {
    throw new Error(
      `Failed to load rooms: ${error.message}`
    );
  }

  return data || [];
}


export async function getRoom(
  businessId,
  roomId
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("rooms")
    .select("*")
    .eq("business_id", businessId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find room: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| BOOKING AVAILABILITY
|--------------------------------------------------------------------------
*/

export async function getOverlappingBookings({
  businessId,
  checkIn,
  checkOut
}) {
  const db = getSupabase();

  const { data, error } = await db
    .from("bookings")
    .select(
      "id, room_id, check_in, check_out, status"
    )
    .eq("business_id", businessId)
    .in("status", [
      "pending",
      "confirmed"
    ])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  if (error) {
    throw new Error(
      `Failed to check bookings: ${error.message}`
    );
  }

  return data || [];
}


/*
|--------------------------------------------------------------------------
| BOOKING
|--------------------------------------------------------------------------
*/

export async function createBookingRecord({
  businessId,
  customerId,
  roomId,
  checkIn,
  checkOut,
  guests,
  totalAmount
}) {
  const db = getSupabase();

  const { data, error } = await db
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      room_id: roomId,
      check_in: checkIn,
      check_out: checkOut,
      guests: Number(guests),

      // Booking is NOT confirmed until payment succeeds.
      status: "pending",
      payment_status: "pending",

      total_amount: totalAmount
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to create booking: ${error.message}`
    );
  }

  return data;
}


export async function getBookingById(
  businessId,
  bookingId
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("bookings")
    .select(`
      *,
      customers (
        id,
        name,
        phone,
        email
      )
    `)
    .eq("business_id", businessId)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find booking: ${error.message}`
    );
  }

  return data;
}


export async function getCustomerBookings({
  businessId,
  customerId
}) {
  const db = getSupabase();

  const { data, error } = await db
    .from("bookings")
    .select("*")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    throw new Error(
      `Failed to load customer bookings: ${error.message}`
    );
  }

  return data || [];
}


export async function updateBooking(
  businessId,
  bookingId,
  updates
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("bookings")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("business_id", businessId)
    .eq("id", bookingId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to update booking: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| CONVERSATIONS
|--------------------------------------------------------------------------
*/

export async function getOrCreateConversation({
  businessId,
  customerId
}) {
  const db = getSupabase();

  const {
    data: existing,
    error: findError
  } = await db
    .from("conversations")
    .select("*")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("channel", "whatsapp")
    .maybeSingle();

  if (findError) {
    throw new Error(
      `Failed to find conversation: ${findError.message}`
    );
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await db
    .from("conversations")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      channel: "whatsapp",
      status: "ai"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to create conversation: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| MESSAGES
|--------------------------------------------------------------------------
*/

export async function saveMessage({
  businessId,
  conversationId,
  customerId,
  senderType,
  message
}) {
  const db = getSupabase();

  const { data, error } = await db
    .from("messages")
    .insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customerId,
      sender_type: senderType,
      message
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to save message: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| LEADS
|--------------------------------------------------------------------------
*/

export async function createLeadRecord({
  businessId,
  customerId,
  source = "whatsapp",
  status = "new",
  notes = null
}) {
  const db = getSupabase();

  const { data, error } = await db
    .from("leads")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      source,
      status,
      notes
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to create lead: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| PAYMENTS
|--------------------------------------------------------------------------
*/

export async function createPaymentRecord({
  businessId,
  bookingId,
  customerId,
  provider = "razorpay",
  providerPaymentId = null,
  razorpayOrderId = null,
  razorpaySignature = null,
  amount,
  currency = "INR",
  status = "pending"
}) {
  const db = getSupabase();

  const { data, error } = await db
    .from("payments")
    .insert({
      business_id: businessId,
      booking_id: bookingId,
      customer_id: customerId,
      provider,
      provider_payment_id: providerPaymentId,
      razorpay_order_id: razorpayOrderId,
      razorpay_signature: razorpaySignature,
      amount,
      currency,
      status
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to create payment: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| PAYMENT LOOKUP
|--------------------------------------------------------------------------
*/

export async function getPaymentByBooking(
  businessId,
  bookingId
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("payments")
    .select("*")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("created_at", {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find payment: ${error.message}`
    );
  }

  return data;
}


export async function getPaymentByOrderId(
  razorpayOrderId
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find payment by Razorpay order: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| PAYMENT UPDATE
|--------------------------------------------------------------------------
*/

export async function updatePaymentByOrderId(
  razorpayOrderId,
  updates
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("payments")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("razorpay_order_id", razorpayOrderId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to update payment: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| PAYMENT BY RAZORPAY PAYMENT ID
|--------------------------------------------------------------------------
*/

export async function getPaymentByRazorpayPaymentId(
  razorpayPaymentId
) {
  const db = getSupabase();

  const { data, error } = await db
    .from("payments")
    .select("*")
    .eq("razorpay_payment_id", razorpayPaymentId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find payment by Razorpay payment ID: ${error.message}`
    );
  }

  return data;
}


/*
|--------------------------------------------------------------------------
| DATABASE HEALTH CHECK
|--------------------------------------------------------------------------
*/

export async function testDatabaseConnection() {
  const db = getSupabase();

  const { data, error } = await db
    .from("businesses")
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(
      `Supabase connection failed: ${error.message}`
    );
  }

  return {
    success: true,
    connected: true,
    rows_found: data?.length || 0
  };
}
