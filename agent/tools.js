import { Type } from "@google/genai";
import {
  getSupabase,
  getBusinessFromDatabase,
  getCustomerByPhone,
  createCustomerRecord,
  getAvailableRooms,
  getRoom,
  getOverlappingBookings,
  createBookingRecord,
  getBookingById,
  getCustomerBookings,
  updateBooking,
  getOrCreateConversation,
  saveMessage,
  createLeadRecord,
  createPaymentRecord,
  getPaymentByBooking
} from "../services/database.js";

import {
  createRazorpayPaymentLink
} from "../services/razorpay.js";

/*
 * Noor AI WhatsApp Agent
 *
 * Tool definitions and tool execution layer.
 *
 * Important:
 * - Customer identity comes from WhatsApp context.
 * - Booking/payment actions are performed server-side.
 * - Razorpay Payment Links are used for customer payments.
 */

function getBusinessId() {
  return (
    process.env.BUSINESS_ID ||
    "demo-business"
  );
}

function getCustomerPhone(context = {}) {
  return (
    context.customerPhone ||
    context.phoneNumber ||
    null
  );
}

function normalizePhone(phone) {
  if (!phone) {
    return null;
  }

  return String(phone)
    .replace(/\D/g, "")
    .slice(-10);
}

function requireCustomerPhone(context = {}) {
  const phone =
    getCustomerPhone(context);

  if (!phone) {
    throw new Error(
      "Customer WhatsApp phone number is required."
    );
  }

  return phone;
}

function toNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 10);
}

function validateDateRange(
  checkIn,
  checkOut
) {
  if (!checkIn || !checkOut) {
    throw new Error(
      "Check-in and check-out dates are required."
    );
  }

  const start =
    new Date(`${checkIn}T00:00:00`);

  const end =
    new Date(`${checkOut}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw new Error(
      "Please provide valid check-in and check-out dates."
    );
  }

  if (end <= start) {
    throw new Error(
      "Check-out date must be after check-in date."
    );
  }

  return {
    checkIn,
    checkOut
  };
}

function calculateNights(
  checkIn,
  checkOut
) {
  const start =
    new Date(`${checkIn}T00:00:00`);

  const end =
    new Date(`${checkOut}T00:00:00`);

  const milliseconds =
    end.getTime() - start.getTime();

  return Math.ceil(
    milliseconds /
      (1000 * 60 * 60 * 24)
  );
}

function getRoomPrice(room) {
  return toNumber(
    room?.price ??
    room?.price_per_night ??
    room?.pricePerNight ??
    room?.rate ??
    0
  );
}

function getRoomCapacity(room) {
  return toNumber(
    room?.capacity ??
    room?.max_guests ??
    room?.maxGuests ??
    room?.guests ??
    0
  );
}

function getRoomName(room) {
  return (
    room?.name ||
    room?.room_name ||
    room?.roomType ||
    room?.room_type ||
    "Room"
  );
}

function getRoomDescription(room) {
  return (
    room?.description ||
    room?.room_description ||
    ""
  );
}

function getRoomId(room) {
  return (
    room?.id ||
    room?.room_id ||
    null
  );
}

function getBookingId(booking) {
  return (
    booking?.id ||
    booking?.booking_id ||
    null
  );
}

function getBookingStatus(booking) {
  return (
    booking?.status ||
    "unknown"
  );
}

function getPaymentStatus(payment) {
  return (
    payment?.status ||
    "unknown"
  );
}

function safeString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value);
}

function buildRoomSummary(room) {
  const name =
    getRoomName(room);

  const price =
    getRoomPrice(room);

  const capacity =
    getRoomCapacity(room);

  const description =
    getRoomDescription(room);

  return {
    id: getRoomId(room),
    name,
    price,
    capacity,
    description
  };
}

/**
 * Get business information.
 */
export async function getBusinessInfo(
  args = {},
  context = {}
) {
  const businessId =
    args.businessId ||
    context.businessId ||
    getBusinessId();

  const business =
    await getBusinessFromDatabase(
      businessId
    );

  if (!business) {
    return {
      success: false,
      error:
        "Business information was not found."
    };
  }

  return {
    success: true,
    business
  };
}

/**
 * Get available rooms.
 */
export async function getRooms(
  args = {},
  context = {}
) {
  const businessId =
    args.businessId ||
    context.businessId ||
    getBusinessId();

  const rooms =
    await getAvailableRooms(
      businessId
    );

  return {
    success: true,
    rooms: Array.isArray(rooms)
      ? rooms.map(buildRoomSummary)
      : []
  };
}

/**
 * Search room availability.
 */
export async function searchAvailability(
  args = {},
  context = {}
) {
  const businessId =
    args.businessId ||
    context.businessId ||
    getBusinessId();

  const checkIn =
    formatDate(
      args.checkIn ||
      args.check_in
    );

  const checkOut =
    formatDate(
      args.checkOut ||
      args.check_out
    );

  const guests =
    toNumber(
      args.guests ??
      args.numberOfGuests ??
      args.number_of_guests ??
      1
    ) || 1;

  validateDateRange(
    checkIn,
    checkOut
  );

  const rooms =
    await getAvailableRooms(
      businessId
    );

  const available = [];

  for (const room of rooms || []) {
    const capacity =
      getRoomCapacity(room);

    if (
      capacity > 0 &&
      capacity < guests
    ) {
      continue;
    }

    const roomId =
      getRoomId(room);

    if (!roomId) {
      continue;
    }

    const overlaps =
      await getOverlappingBookings(
        roomId,
        checkIn,
        checkOut
      );

    if (
      Array.isArray(overlaps) &&
      overlaps.length > 0
    ) {
      continue;
    }

    available.push(
      buildRoomSummary(room)
    );
  }

  return {
    success: true,
    business_id: businessId,
    check_in: checkIn,
    check_out: checkOut,
    guests,
    nights:
      calculateNights(
        checkIn,
        checkOut
      ),
    rooms: available
  };
}

/**
 * Create a hotel booking and a Razorpay Payment Link.
 */
export async function createBooking(
  args = {},
  context = {}
) {
  const businessId =
    args.businessId ||
    context.businessId ||
    getBusinessId();

  const customerPhone =
    requireCustomerPhone(
      context
    );

  const customerName =
    safeString(
      args.customerName ||
      args.customer_name ||
      context.customerName ||
      "WhatsApp Customer"
    ).trim();

  const roomId =
    args.roomId ||
    args.room_id;

  const checkIn =
    formatDate(
      args.checkIn ||
      args.check_in
    );

  const checkOut =
    formatDate(
      args.checkOut ||
      args.check_out
    );

  const guests =
    toNumber(
      args.guests ??
      args.numberOfGuests ??
      args.number_of_guests ??
      1
    ) || 1;

  if (!roomId) {
    throw new Error(
      "Room selection is required before creating a booking."
    );
  }

  if (!customerName) {
    throw new Error(
      "Customer full name is required before creating a booking."
    );
  }

  validateDateRange(
    checkIn,
    checkOut
  );

  const room =
    await getRoom(roomId);

  if (!room) {
    throw new Error(
      "The selected room could not be found."
    );
  }

  const capacity =
    getRoomCapacity(room);

  if (
    capacity > 0 &&
    guests > capacity
  ) {
    throw new Error(
      `This room can accommodate a maximum of ${capacity} guest(s).`
    );
  }

  const overlapping =
    await getOverlappingBookings(
      roomId,
      checkIn,
      checkOut
    );

  if (
    Array.isArray(overlapping) &&
    overlapping.length > 0
  ) {
    throw new Error(
      "The selected room is not available for those dates."
    );
  }

  const nights =
    calculateNights(
      checkIn,
      checkOut
    );

  const pricePerNight =
    getRoomPrice(room);

  if (
    !pricePerNight ||
    pricePerNight <= 0
  ) {
    throw new Error(
      "The selected room does not have a valid price."
    );
  }

  const totalAmount =
    pricePerNight * nights;

  const customer =
    await getCustomerByPhone(
      customerPhone,
      businessId
    );

  let customerId =
    customer?.id || null;

  if (!customerId) {
    const createdCustomer =
      await createCustomerRecord({
        businessId,
        phone: customerPhone,
        name: customerName
      });

    customerId =
      createdCustomer?.id ||
      null;
  }

  const booking =
    await createBookingRecord({
      businessId,
      customerId,
      customerPhone,
      customerName,
      roomId,
      checkIn,
      checkOut,
      guests,
      nights,
      pricePerNight,
      totalAmount,
      status: "pending"
    });

  const bookingId =
    getBookingId(booking);

  if (!bookingId) {
    throw new Error(
      "Booking was created but no booking ID was returned."
    );
  }

  const razorpayPaymentLink =
    await createRazorpayPaymentLink({
      bookingId,
      amount: totalAmount,
      currency: "INR",
      customerName,
      customerPhone
    });

  const payment =
    await createPaymentRecord({
      businessId,
      bookingId,
      customerId,
      amount: totalAmount,
      currency: "INR",
      provider: "razorpay",
      status: "pending",
      providerPaymentId: null,
      razorpayOrderId: null,
      razorpayPaymentLinkId:
        razorpayPaymentLink.payment_link_id,
      razorpaySignature: null
    });

  return {
    success: true,

    booking: {
      id: bookingId,
      customer_name: customerName,
      customer_phone: customerPhone,
      room_id: roomId,
      room_name:
        getRoomName(room),
      check_in: checkIn,
      check_out: checkOut,
      guests,
      nights,
      price_per_night:
        pricePerNight,
      total_amount:
        totalAmount,
      currency: "INR",
      status:
        booking?.status ||
        "pending"
    },

    payment: {
      id: payment?.id || null,
      provider: "razorpay",
      razorpay_payment_link_id:
        razorpayPaymentLink.payment_link_id,
      payment_url:
        razorpayPaymentLink.short_url,
      amount:
        razorpayPaymentLink.amount,
      currency:
        razorpayPaymentLink.currency,
      status: "pending"
    },

    message:
      "Booking created successfully. Please complete the payment using the payment link."
  };
}

/**
 * Get a booking by ID.
 */
export async function getBooking(
  args = {},
  context = {}
) {
  const customerPhone =
    requireCustomerPhone(
      context
    );

  const bookingId =
    args.bookingId ||
    args.booking_id;

  if (!bookingId) {
    throw new Error(
      "Booking ID is required."
    );
  }

  const booking =
    await getBookingById(
      bookingId
    );

  if (!booking) {
    return {
      success: false,
      error:
        "Booking not found."
    };
  }

  const bookingPhone =
    normalizePhone(
      booking.customer_phone ||
      booking.customerPhone ||
      ""
    );

  if (
    bookingPhone &&
    bookingPhone !==
      normalizePhone(
        customerPhone
      )
  ) {
    return {
      success: false,
      error:
        "This booking does not belong to the current WhatsApp customer."
    };
  }

  return {
    success: true,
    booking
  };
}

/**
 * Get the current customer's bookings.
 */
export async function getCustomerBookingsTool(
  args = {},
  context = {}
) {
  const customerPhone =
    requireCustomerPhone(
      context
    );

  const businessId =
    args.businessId ||
    context.businessId ||
    getBusinessId();

  const bookings =
    await getCustomerBookings(
      customerPhone,
      businessId
    );

  return {
    success: true,
    customer_phone:
      customerPhone,
    bookings:
      Array.isArray(bookings)
        ? bookings
        : []
  };
}

/**
 * Modify an existing booking.
 */
export async function modifyBooking(
  args = {},
  context = {}
) {
  const customerPhone =
    requireCustomerPhone(
      context
    );

  const bookingId =
    args.bookingId ||
    args.booking_id;

  if (!bookingId) {
    throw new Error(
      "Booking ID is required."
    );
  }

  const booking =
    await getBookingById(
      bookingId
    );

  if (!booking) {
    throw new Error(
      "Booking not found."
    );
  }

  const bookingPhone =
    normalizePhone(
      booking.customer_phone ||
      booking.customerPhone ||
      ""
    );

  if (
    bookingPhone &&
    bookingPhone !==
      normalizePhone(
        customerPhone
      )
  ) {
    throw new Error(
      "This booking does not belong to the current WhatsApp customer."
    );
  }

  const updates = {};

  if (
    args.checkIn ||
    args.check_in
  ) {
    updates.check_in =
      formatDate(
        args.checkIn ||
        args.check_in
      );
  }

  if (
    args.checkOut ||
    args.check_out
  ) {
    updates.check_out =
      formatDate(
        args.checkOut ||
        args.check_out
      );
  }

  if (
    args.guests !== undefined ||
    args.numberOfGuests !== undefined ||
    args.number_of_guests !== undefined
  ) {
    updates.guests =
      toNumber(
        args.guests ??
        args.numberOfGuests ??
        args.number_of_guests
      );
  }

  if (args.roomId || args.room_id) {
    updates.room_id =
      args.roomId ||
      args.room_id;
  }

  if (
    updates.check_in ||
    updates.check_out
  ) {
    const newCheckIn =
      updates.check_in ||
      formatDate(
        booking.check_in
      );

    const newCheckOut =
      updates.check_out ||
      formatDate(
        booking.check_out
      );

    validateDateRange(
      newCheckIn,
      newCheckOut
    );

    const roomId =
      updates.room_id ||
      booking.room_id;

    const overlaps =
      await getOverlappingBookings(
        roomId,
        newCheckIn,
        newCheckOut,
        bookingId
      );

    if (
      Array.isArray(overlaps) &&
      overlaps.length > 0
    ) {
      throw new Error(
        "The selected room is not available for the new dates."
      );
    }
  }

  if (
    updates.room_id &&
    updates.guests
  ) {
    const room =
      await getRoom(
        updates.room_id
      );

    if (!room) {
      throw new Error(
        "The selected room was not found."
      );
    }

    const capacity =
      getRoomCapacity(room);

    if (
      capacity > 0 &&
      updates.guests > capacity
    ) {
      throw new Error(
        `This room can accommodate a maximum of ${capacity} guest(s).`
      );
    }
  }

  if (
    Object.keys(updates)
      .length === 0
  ) {
    return {
      success: false,
      error:
        "No booking changes were provided."
    };
  }

  const updated =
    await updateBooking(
      bookingId,
      updates
    );

  return {
    success: true,
    booking: updated
  };
}

/**
 * Get payment status for a booking.
 */
export async function getPaymentStatus(
  args = {},
  context = {}
) {
  const customerPhone =
    requireCustomerPhone(
      context
    );

  const bookingId =
    args.bookingId ||
    args.booking_id;

  if (!bookingId) {
    throw new Error(
      "Booking ID is required."
    );
  }

  const booking =
    await getBookingById(
      bookingId
    );

  if (!booking) {
    return {
      success: false,
      error:
        "Booking not found."
    };
  }

  const bookingPhone =
    normalizePhone(
      booking.customer_phone ||
      booking.customerPhone ||
      ""
    );

  if (
    bookingPhone &&
    bookingPhone !==
      normalizePhone(
        customerPhone
      )
  ) {
    return {
      success: false,
      error:
        "This booking does not belong to the current WhatsApp customer."
    };
  }

  const payment =
    await getPaymentByBooking(
      bookingId
    );

  if (!payment) {
    return {
      success: true,
      booking_id: bookingId,
      payment: null,
      status: "not_found"
    };
  }

  return {
    success: true,
    booking_id: bookingId,
    payment: {
      id: payment.id,
      status:
        getPaymentStatus(
          payment
        ),
      amount:
        payment.amount,
      currency:
        payment.currency,
      provider:
        payment.provider,
      razorpay_payment_link_id:
        payment.razorpay_payment_link_id ||
        null
    }
  };
}
/*
|--------------------------------------------------------------------------
| Verify room
|--------------------------------------------------------------------------
*/
 const room =
 await getRoom(
 businessId,
 room_id
 );
 if (!room) {
 return {
 success: false,
 message:
 "The selected room could not be found."
 };
 }
 if (
 room.status !== "available"
 ) {
 return {
 success: false,
 message:
 "The selected room is currently unavailable."
 };
 }
 if (
 guestCount >
 Number(room.capacity)
 ) {
 return {
 success: false,
 message:
 `This room can accommodate up to ${room.capacity} guests.`
 };
 }
/*
|--------------------------------------------------------------------------
| Fresh availability check
|--------------------------------------------------------------------------
*/
 const overlappingBookings =
 await getOverlappingBookings({
 businessId,
 checkIn: check_in,
 checkOut: check_out
 });
 const roomAlreadyBooked =
 overlappingBookings.some(
 booking =>
 booking.room_id ===
 room_id
 );
 if (roomAlreadyBooked) {
 return {
 success: false,
 status:
 "room_unavailable",
 message:
 "Sorry, that room is not available for the requested dates. Please choose another room or dates."
 };
 }
/*
|--------------------------------------------------------------------------
| Resolve customer
|--------------------------------------------------------------------------
*/
 const existingCustomer =
 await resolveCustomer(
 context,
 customerPhone
 );
 let customer;
 if (existingCustomer) {
 customer =
 await createCustomerRecord({
 businessId,
 name:
 customer_name,
 phone:
 existingCustomer.phone
 });
 } else {
 customer =
 await createCustomerRecord({
 businessId,
 name:
 customer_name,
 phone:
 customerPhone
 });
 }
 if (!customer?.id) {
 return {
 success: false,
 message:
 "The customer record could not be created."
 };
 }
/*
|--------------------------------------------------------------------------
| Calculate total
|--------------------------------------------------------------------------
*/
 const nights =
 calculateNights(
 check_in,
 check_out
 );
 const totalAmount =
 nights *
 Number(room.price_per_night);
 if (
 !Number.isFinite(totalAmount) ||
 totalAmount <= 0
 ) {
 return {
 success: false,
 message:
 "The booking total could not be calculated."
 };
 }
/*
|--------------------------------------------------------------------------
| Create booking
|--------------------------------------------------------------------------
*/
 const booking =
 await createBookingRecord({
 businessId,
 customerId:
 customer.id,
 roomId:
 room.room_id,
 checkIn:
 check_in,
 checkOut:
 check_out,
 guests:
 guestCount,
 totalAmount
 });
 if (!booking?.id) {
 return {
 success: false,
 message:
 "The booking could not be created."
 };
 }
/*
|--------------------------------------------------------------------------
| Create pending payment record
|--------------------------------------------------------------------------
*/
 let razorpayPaymentLink;
 try {
 razorpayPaymentLink =
 await createRazorpayPaymentLink({
 bookingId:
 booking.id,
 amount:
 totalAmount,
 currency:
 room.currency ||
 "INR",
 customerName:
 customer_name,
 customerPhone:
 customerPhone
 });
 } catch (error) {
 console.error(
 "Razorpay payment link creation failed:",
 error
 );
 try {
 await updateBooking(
 businessId,
 booking.id,
 {
 status:
 "cancelled"
 }
 );
 } catch (rollbackError) {
 console.error(
 "Booking rollback failed:",
 rollbackError
 );
 }
 return {
 success: false,
 message:
 "The booking could not be prepared for payment. Please try again."
 };
 }
 if (
 !razorpayPaymentLink?.success ||
 !razorpayPaymentLink?.short_url
 ) {
 try {
 await updateBooking(
 businessId,
 booking.id,
 {
 status:
 "cancelled"
 }
 );
 } catch (rollbackError) {
 console.error(
 "Booking rollback failed:",
 rollbackError
 );
 }
 return {
 success: false,
 message:
 "The payment link could not be created."
 };
 }
/*
|--------------------------------------------------------------------------
| Create pending payment record
|--------------------------------------------------------------------------
*/
 let payment;
 try {
 payment =
 await createPaymentRecord({
 businessId,
 bookingId:
 booking.id,
 customerId:
 customer.id,
 provider:
 "razorpay",
 providerPaymentId:
 null,
 razorpayOrderId:
 null,
 razorpayPaymentLinkId:
 razorpayPaymentLink.payment_link_id,
 razorpaySignature:
 null,
 amount:
 totalAmount,
 currency:
 room.currency ||
 "INR",
 status:
 "pending"
 });
 } catch (error) {
 console.error(
 "Payment record creation failed:",
 error
 );
 try {
 await updateBooking(
 businessId,
 booking.id,
 {
 status:
 "cancelled"
 }
 );
 } catch (rollbackError) {
 console.error(
 "Booking rollback failed:",
 rollbackError
 );
 }
 return {
 success: false,
 message:
 "The payment record could not be created. Please try again."
 };
 }
 if (!payment?.id) {
 return {
 success: false,
 message:
 "The payment record could not be created."
 };
 }
/*
|--------------------------------------------------------------------------
| Booking created, payment pending
|--------------------------------------------------------------------------
*/
 return {
 success: true,
 status:
 "booking_created_payment_pending",
 booking: {
 id:
 booking.id,
 customer_id:
 booking.customer_id,
 room_id:
 room.room_id,
 room_name:
 room.name,
 check_in:
 booking.check_in,
 check_out:
 booking.check_out,
 guests:
 booking.guests,
 nights,
 price_per_night:
 Number(room.price_per_night),
 total_amount:
 totalAmount,
 currency:
 room.currency ||
 "INR",
 status:
 booking.status,
 payment_status:
 booking.payment_status
 },
 payment: {
 id:
 payment.id,
 provider:
 "razorpay",
 razorpay_payment_link_id:
 razorpayPaymentLink.payment_link_id,
 payment_url:
 razorpayPaymentLink.short_url,
 amount:
 razorpayPaymentLink.amount,
 currency:
 razorpayPaymentLink.currency,
 status:
 "pending"
 },
 customer
 };
}
/*
|--------------------------------------------------------------------------
| GET BOOKING
|--------------------------------------------------------------------------
*/
async function get_booking(
 { booking_id } = {},
 context = {}
) {
 if (!booking_id) {
 return {
 success: false,
 message:
 "Booking ID is required."
 };
 }
 const result =
 await getOwnedBooking(
 booking_id,
 context
 );
 if (!result.success) {
 return result;
 }
 return {
 success: true,
 found: true,
 booking:
 result.booking
 };
}
/*
|--------------------------------------------------------------------------
| CUSTOMER BOOKINGS
|--------------------------------------------------------------------------
*/
async function get_customer_bookings(
 { phone } = {},
 context = {}
) {
 const businessId =
 getBusinessId(context);
/*
|--------------------------------------------------------------------------
| FIRST: use trusted customer ID
|--------------------------------------------------------------------------
*/
 const customer =
 await resolveCustomer(
 context,
 phone
 );
 if (!customer) {
 return {
 success: true,
 customer_found: false,
 bookings: [],
 message:
 "No customer record was found for this WhatsApp conversation."
 };
 }
 const bookings =
 await getCustomerBookings({
 businessId,
 customerId:
 customer.id
 });
 return {
 success: true,
 customer_found: true,
 customer,
 bookings
 };
}
/*
|--------------------------------------------------------------------------
| CANCEL BOOKING
|--------------------------------------------------------------------------
*/
async function cancel_booking(
 {
 booking_id,
 reason = null
 } = {},
 context = {}
) {
 if (!booking_id) {
 return {
 success: false,
 message:
 "Booking ID is required."
 };
 }
 const ownership =
 await getOwnedBooking(
 booking_id,
 context
 );
 if (!ownership.success) {
 return ownership;
 }
 const booking =
 ownership.booking;
 if (
 booking.status ===
 "cancelled"
 ) {
 return {
 success: true,
 status:
 "already_cancelled",
 booking
 };
 }
 if (
 booking.status ===
 "completed"
 ) {
 return {
 success: false,
 message:
 "A completed booking cannot be cancelled."
 };
 }
 const updatedBooking =
 await updateBooking(
 getBusinessId(context),
 booking_id,
 {
 status:
 "cancelled"
 }
 );
 if (
 !updatedBooking ||
 updatedBooking.status !==
 "cancelled"
 ) {
 return {
 success: false,
 message:
 "The booking cancellation could not be confirmed."
 };
 }
 return {
 success: true,
 status:
 "cancelled",
 reason,
 booking:
 updatedBooking
 };
}
/*
|--------------------------------------------------------------------------
| MODIFY BOOKING
|--------------------------------------------------------------------------
*/ 
 guests
 } = {},
 context = {}
) {
 if (!booking_id) {
 return {
 success: false,
 message:
 "Booking ID is required."
 };
 }
 const ownership =
 await getOwnedBooking(
 booking_id,
 context
 );
 if (!ownership.success) {
 return ownership;
 }
 const booking =
 ownership.booking;
 if (
 booking.status ===
 "cancelled"
 ) {
 return {
 success: false,
 message:
 "A cancelled booking cannot be modified."
 };
 }
 if (
 booking.status ===
 "completed"
 ) {
 return {
 success: false,
 message:
 "A completed booking cannot be modified."
 };
 }
 const newCheckIn =
 check_in ||
 booking.check_in;
 const newCheckOut =
 check_out ||
 booking.check_out;
 const newRoomId =
 room_id ||
 booking.room_id;
 const newGuests =
 guests ??
 booking.guests;
 /*
 |--------------------------------------------------------------------------
 | Validate dates
 |--------------------------------------------------------------------------
 */
 if (
 !isValidDateString(newCheckIn) ||
 !isValidDateString(newCheckOut)
 ) {
 return {
 success: false,
 message:
 "Invalid check-in or check-out dates. Use YYYY-MM-DD."
 };
 }
 if (
 new Date(`${newCheckOut}T00:00:00Z`) <=
 new Date(`${newCheckIn}T00:00:00Z`)
 ) {
 return {
 success: false,
 message:
 "Check-out date must be after check-in date."
 };
 }
 const guestCount =
 Number(newGuests);
 if (
 !Number.isInteger(guestCount) ||
 guestCount < 1
 ) {
 return {
 success: false,
 message:
 "Number of guests must be at least 1."
 };
 }
 /*
 |--------------------------------------------------------------------------
 | Verify room
 |--------------------------------------------------------------------------
 */
 const room =
 await getRoom(
 getBusinessId(context),
 newRoomId
 );
 if (!room) {
 return {
 success: false,
 message:
 "Selected room was not found."
 };
 }
 if (
 room.status !==
 "available"
 ) {
 return {
 success: false,
 message:
 "Selected room is currently unavailable."
 };
 }
 if (
 guestCount >
 Number(room.capacity)
 ) {
 return {
 success: false,
 message:
 `This room can accommodate up to ${room.capacity} guests.`
 };
 }
 /*
 |--------------------------------------------------------------------------
 | Check conflicts
 |--------------------------------------------------------------------------
 */
 const overlappingBookings =
 await getOverlappingBookings({
 businessId:
 getBusinessId(context),
 checkIn:
 newCheckIn,
 checkOut:
 newCheckOut
 });
 const conflict =
 overlappingBookings.some(
 existingBooking =>
 existingBooking.room_id ===
 newRoomId &&
 existingBooking.id !==
 booking_id
 );
 if (conflict) {
 return {
 success: false,
 status:
 "room_unavailable",
 message:
 "The selected room is not available for those dates."
 };
 }
 /*
 |--------------------------------------------------------------------------
 | Recalculate total
 |--------------------------------------------------------------------------
 */
 const nights =
 calculateNights(
 newCheckIn,
 newCheckOut
 );
 const totalAmount =
 nights *
 Number(room.price_per_night);
 /*
 |--------------------------------------------------------------------------
 | Update booking
 |--------------------------------------------------------------------------
 */
 const updatedBooking =
 await updateBooking(
 getBusinessId(context),
 booking_id,
 {
 room_id:
 newRoomId,
 check_in:
 newCheckIn,
 check_out:
 newCheckOut,
 guests:
 guestCount,
 total_amount:
 totalAmount
 }
 );
 if (
 !updatedBooking
 ) {
 return {
 success: false,
 message:
 "The booking could not be updated."
 };
 }
 return {
 success: true,
 status:
 "booking_updated",
 booking:
 updatedBooking,
 room: {
 room_id:
 room.room_id,
 room_name:
 room.name,
 price_per_night:
 Number(room.price_per_night),
 currency:
 room.currency ||
 "INR"
 },
 nights,
 total_amount:
 totalAmount
 };
}
 /*
|--------------------------------------------------------------------------
| LEAD
|--------------------------------------------------------------------------
*/
async function create_lead(
 {
 phone,
 notes,
 status = "new"
 } = {},
 context = {}
) {
 const businessId =
 getBusinessId(context);
 const customerPhone =
 normalizePhone(
 phone ||
 context.customerPhone
 );
 if (!notes) {
 return {
 success: false,
 message:
 "Lead notes are required."
 };
 }
 const customer =
 await resolveCustomer(
 context,
 customerPhone
 );
 const lead =
 await createLeadRecord({
 businessId,
 customerId:
 customer?.id ||
 null,
 source:
 "whatsapp",
 status,
 notes
 });
 if (!lead?.id) {
 return {
 success: false,
 message:
 "The lead could not be created."
 };
 }
 return {
 success: true,
 lead
 };
}
/*
|--------------------------------------------------------------------------
| CONVERSATION
|--------------------------------------------------------------------------
*/
async function get_conversation(
 { phone } = {},
 context = {}
) {
 const businessId =
 getBusinessId(context);
 const customer =
 await resolveCustomer(
 context,
 phone
 );
 if (!customer) {
 return {
 success: true,
 customer_found: false,
 conversation: null };
 }
 const conversation =
 await getOrCreateConversation({
 businessId,
 customerId:
 customer.id
 });
 return {
 success: true,
 customer,
 conversation
 };
}
/*
|--------------------------------------------------------------------------
| SAVE MESSAGE
|--------------------------------------------------------------------------
*/
async function save_message(
 {
 phone,
 sender_type,
 message
 } = {},
 context = {}
) {
 const businessId =
 getBusinessId(context);
 const customerPhone =
 normalizePhone(
 phone ||
 context.customerPhone
 );
 if (
 !sender_type ||
 !message
 ) {
 return {
 success: false,
 message:
 "Sender type and message are required."
 };
 }
 let customer =
 await resolveCustomer(
 context,
 customerPhone
 );
 if (!customer) {
 if (!customerPhone) {
 return {
 success: false,
 message:
 "Customer identity is required."
 };
 }
 customer =
 await createCustomerRecord({
 businessId,
 name:
 "WhatsApp Customer",
 phone:
 customerPhone
 });
 }
 const conversation =
 await getOrCreateConversation({
 businessId,
 customerId:
 customer.id
 });
 const savedMessage =
 await saveMessage({
 businessId,
 conversationId:
 conversation.id,
 customerId:
 customer.id,
 senderType:
 sender_type,
 message
 });
 if (!savedMessage?.id) {
 return {
 success: false,
 message:
 "Message could not be saved."
 };
 }
 return {
 success: true,
 message:
 savedMessage
 };
}
/*
|--------------------------------------------------------------------------
| PAYMENT
|--------------------------------------------------------------------------
*/
async function create_payment(
 {
 booking_id,
 customer_phone,
 amount,
 provider = null
 } = {},
 context = {}
) {
 const businessId =
 getBusinessId(context);
 const paymentAmount =
 Number(amount);
 if (
 !booking_id ||
 !Number.isFinite(paymentAmount) ||
 paymentAmount <= 0
 ) {
 return {
 success: false,
 message:
 "Booking ID and a valid positive payment amount are required."
 };
 }
 /*
 |--------------------------------------------------------------------------
 | Verify booking ownership
 |--------------------------------------------------------------------------
 */
 const ownership =
 await getOwnedBooking(
 booking_id,
 context
 );
 if (!ownership.success) {
 return ownership;
 }
 const customer =
 ownership.customer;
 /*
 |--------------------------------------------------------------------------
 | Prevent duplicate manual payment records
 |--------------------------------------------------------------------------
 */
 const existingPayment =
 await getPaymentByBooking(
 businessId,
 booking_id
 );
 if (existingPayment) {
 return {
 success: true,
 status:
 "payment_already_exists",
 payment:
 existingPayment
 };
 }
 /*
 |--------------------------------------------------------------------------
 | Create only a pending record
 |--------------------------------------------------------------------------
 */
 const payment =
 await createPaymentRecord({
 businessId,
 bookingId:
 booking_id,
 customerId:
 customer.id,
 provider:
 provider || "razorpay",
 amount:
 paymentAmount,
 currency:
 "INR",
 status:
 "pending"
 });
 if (!payment?.id) {
 return {
 success: false,
 message:
 "The payment record could not be created."
 };
 }
 return {
 success: true,
 status:
 "payment_pending",
 payment
 };
}
/*
|--------------------------------------------------------------------------
| GET PAYMENT STATUS
|--------------------------------------------------------------------------
*/
async function get_payment_status(
 { booking_id } = {},
 context = {}
) {
 if (!booking_id) {
 return {
 success: false,
 message:
 "Booking ID is required."
 };
 }
 /*
 |--------------------------------------------------------------------------
 | Verify booking ownership first
 |--------------------------------------------------------------------------
 */
 const ownership =
 await getOwnedBooking(
 booking_id,
 context
 );
 if (!ownership.success) {
 return ownership;
 }
 const payment =
 await getPaymentByBooking(
 getBusinessId(context),
 booking_id
 );
 if (!payment) {
 return {
 success: true,
 payment_found: false,
 payment: null
 };
 }
 return {
 success: true,
 payment_found: true,
 payment
 };
}
/*
|--------------------------------------------------------------------------
| HUMAN HANDOFF
|--------------------------------------------------------------------------
*/
async function transfer_to_human(
 {
 reason
 } = {},
 context = {}
) {
 const businessId =
 getBusinessId(context);
 const customer =
 await resolveCustomer(
 context
 );
 if (!customer) {
 return {
 success: false,
 message:
 "The current customer could not be identified for human handoff."
 };
 }
 const conversation =
 await getOrCreateConversation({
 businessId,
 customerId:
 customer.id
 });
 await saveMessage({
 businessId,
 conversationId:
 conversation.id,
 customerId:
 customer.id,
 senderType:
 "system",
 message:
 `Human handoff requested: ${
 reason ||
 "Customer requested human assistance."
 }`
 });
 const db =
 getSupabase();
 const { data, error } =
 await db
 .from("conversations")
 .update({
 status:
 "human",
 updated_at:
 new Date().toISOString()
 })
 .eq(
 "id",
 conversation.id
 )
 .select("*")
 .single();
 if (error) {
 return {
 success: false,
 message:
 `Human handoff could not be completed: ${error.message}`
 };
 }
 return {
 success: true,
 status:
 "human_handoff_requested",
 reason:
 reason ||
 "Customer requested human assistance.",
 conversation:
 data
 };
}
