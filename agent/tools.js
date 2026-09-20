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

function extractPaymentStatus(payment) {
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
    await getAvailableRooms({
      businessId,
      guests: 1
    });

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
    await getAvailableRooms({
      businessId,
      guests
    });

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
      await getOverlappingBookings({
        businessId,
        checkIn,
        checkOut
      });

    const roomOverlaps =
      Array.isArray(overlaps)
        ? overlaps.filter(
            booking =>
              String(
                booking?.room_id ??
                booking?.roomId ??
                ""
              ) === String(roomId)
          )
        : [];

    if (roomOverlaps.length > 0) {
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
    await getRoom(
      businessId,
      roomId
    );

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
    await getOverlappingBookings({
      businessId,
      checkIn,
      checkOut
    });

  const roomOverlaps =
    Array.isArray(overlapping)
      ? overlapping.filter(
          booking =>
            String(
              booking?.room_id ??
              booking?.roomId ??
              ""
            ) === String(roomId)
        )
      : [];

  if (roomOverlaps.length > 0) {
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
      businessId,
      customerPhone
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

  const businessId =
    context.businessId ||
    getBusinessId();

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
      businessId,
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

  const customer =
    await getCustomerByPhone(
      businessId,
      customerPhone
    );

  const bookings =
    customer?.id
      ? await getCustomerBookings({
          businessId,
          customerId: customer.id
        })
      : [];

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

  const businessId =
    args.businessId ||
    context.businessId ||
    getBusinessId();

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
      businessId,
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
      await getOverlappingBookings({
        businessId,
        checkIn: newCheckIn,
        checkOut: newCheckOut
      });

    const roomOverlaps =
      Array.isArray(overlaps)
        ? overlaps.filter(
            bookingItem =>
              String(
                bookingItem?.room_id ??
                bookingItem?.roomId ??
                ""
              ) === String(roomId) &&
              String(
                bookingItem?.id ??
                bookingItem?.booking_id ??
                ""
              ) !== String(bookingId)
          )
        : [];

    if (roomOverlaps.length > 0) {
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
        businessId,
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
      businessId,
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

  const businessId =
    args.businessId ||
    context.businessId ||
    getBusinessId();

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
      businessId,
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
      businessId,
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
        extractPaymentStatus(
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
| TOOL REGISTRY
|--------------------------------------------------------------------------
*/

export const tools = {

  get_business_info: {
    description:
      "Get complete information about the business, including name, type, description, phone, email and address.",

    parameters: {
      type: Type.OBJECT,
      properties: {}
    },

    execute: getBusinessInfo
  },

  get_rooms: {
    description:
      "Get the hotel's room types, prices, capacities and descriptions. Use this when the customer asks what rooms the hotel has or asks about room types or prices.",

    parameters: {
      type: Type.OBJECT,
      properties: {}
    },

    execute: getRooms
  },

  search_availability: {
    description:
      "Check real room availability for specific check-in and check-out dates and number of guests. Always use this before telling the customer whether a room is available.",

    parameters: {
      type: Type.OBJECT,

      properties: {
        check_in: {
          type: Type.STRING,
          description:
            "Check-in date in YYYY-MM-DD format."
        },

        check_out: {
          type: Type.STRING,
          description:
            "Check-out date in YYYY-MM-DD format."
        },

        guests: {
          type: Type.NUMBER,
          description:
            "Number of guests."
        }
      },

      required: [
        "check_in",
        "check_out"
      ]
    },

    execute: searchAvailability
  },
    create_booking: {
    description:
      "Create a hotel booking only after the customer has selected a room and provided their full name, check-in date, check-out date and number of guests. This also creates a Razorpay Payment Link.",

    parameters: {
      type: Type.OBJECT,

      properties: {
        customer_name: {
          type: Type.STRING,
          description:
            "Customer's full name."
        },

        room_id: {
          type: Type.STRING,
          description:
            "Selected room ID."
        },

        check_in: {
          type: Type.STRING,
          description:
            "Check-in date in YYYY-MM-DD format."
        },

        check_out: {
          type: Type.STRING,
          description:
            "Check-out date in YYYY-MM-DD format."
        },

        guests: {
          type: Type.NUMBER,
          description:
            "Number of guests."
        }
      },

      required: [
        "customer_name",
        "room_id",
        "check_in",
        "check_out",
        "guests"
      ]
    },

    execute: createBooking
  },

  get_booking: {
    description:
      "Get the details and current status of the current customer's booking using its booking ID. The booking must belong to the current WhatsApp customer.",

    parameters: {
      type: Type.OBJECT,

      properties: {
        booking_id: {
          type: Type.STRING,
          description:
            "Booking ID."
        }
      },

      required: [
        "booking_id"
      ]
    },

    execute: getBooking
  },

  get_customer_bookings: {
    description:
      "Get the current WhatsApp customer's previous and current hotel bookings.",

    parameters: {
      type: Type.OBJECT,
      properties: {}
    },

    execute:
      getCustomerBookingsTool
  },

  modify_booking: {
    description:
      "Modify the current customer's existing booking. Use this when the customer requests changes to dates, room or guest count. Availability must be checked before changing the room or dates.",

    parameters: {
      type: Type.OBJECT,

      properties: {
        booking_id: {
          type: Type.STRING,
          description:
            "Booking ID."
        },

        check_in: {
          type: Type.STRING,
          description:
            "New check-in date in YYYY-MM-DD format."
        },

        check_out: {
          type: Type.STRING,
          description:
            "New check-out date in YYYY-MM-DD format."
        },

        room_id: {
          type: Type.STRING,
          description:
            "New room ID."
        },

        guests: {
          type: Type.NUMBER,
          description:
            "New number of guests."
        }
      },

      required: [
        "booking_id"
      ]
    },

    execute: modifyBooking
  },

  get_payment_status: {
    description:
      "Get the current payment record and payment status for the current customer's booking.",

    parameters: {
      type: Type.OBJECT,

      properties: {
        booking_id: {
          type: Type.STRING,
          description:
            "Booking ID."
        }
      },

      required: [
        "booking_id"
      ]
    },

    execute: getPaymentStatus
  }

};
