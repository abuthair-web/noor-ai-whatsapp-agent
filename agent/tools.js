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


/*
|--------------------------------------------------------------------------
| CONFIGURATION
|--------------------------------------------------------------------------
*/

function getBusinessId(context = {}) {
  return (
    context.businessId ||
    process.env.BUSINESS_ID ||
    "demo-business"
  );
}


/*
|--------------------------------------------------------------------------
| PHONE NORMALIZATION
|--------------------------------------------------------------------------
|
| Keeps WhatsApp/customer phone numbers consistent.
|
| Examples:
| 9447722883      -> 919447722883
| +91 9447722883 -> 919447722883
| 919447722883    -> 919447722883
|
|--------------------------------------------------------------------------
*/

function normalizePhone(phone) {
  if (!phone) {
    return null;
  }

  let value = String(phone).trim();

  value = value.replace(/\D/g, "");

  if (value.startsWith("00")) {
    value = value.substring(2);
  }

  if (value.length === 10) {
    value = `91${value}`;
  }

  if (
    value.length === 11 &&
    value.startsWith("0")
  ) {
    value = `91${value.substring(1)}`;
  }

  return value || null;
}


/*
|--------------------------------------------------------------------------
| DATE VALIDATION
|--------------------------------------------------------------------------
*/

function isValidDateString(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.toISOString().slice(0, 10) === value
  );
}


function calculateNights(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);

  return Math.round(
    (end - start) /
      (1000 * 60 * 60 * 24)
  );
}


/*
|--------------------------------------------------------------------------
| CUSTOMER RESOLUTION
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| For a live WhatsApp conversation, context.customerId is the
| most reliable identity because webhook.js already resolved it.
|
| Phone number is used as a fallback.
|
|--------------------------------------------------------------------------
*/

async function resolveCustomer(
  context = {},
  phone = null
) {
  const businessId =
    getBusinessId(context);

  const db = getSupabase();

  /*
  |--------------------------------------------------------------------------
  | 1. Trusted customer ID from webhook context
  |--------------------------------------------------------------------------
  */

  if (context.customerId) {

    const { data, error } =
      await db
        .from("customers")
        .select("*")
        .eq(
          "business_id",
          businessId
        )
        .eq(
          "id",
          context.customerId
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to resolve customer: ${error.message}`
      );
    }

    if (data) {
      return data;
    }
  }


  /*
  |--------------------------------------------------------------------------
  | 2. Fallback to phone
  |--------------------------------------------------------------------------
  */

  const candidatePhone =
    normalizePhone(
      phone ||
      context.customerPhone
    );

  if (!candidatePhone) {
    return null;
  }


  /*
  |--------------------------------------------------------------------------
  | Try normalized phone first
  |--------------------------------------------------------------------------
  */

  const customer =
    await getCustomerByPhone(
      businessId,
      candidatePhone
    );

  if (customer) {
    return customer;
  }


  /*
  |--------------------------------------------------------------------------
  | Fallback to original phone if normalization changed it
  |--------------------------------------------------------------------------
  */

  const originalPhone =
    phone ||
    context.customerPhone;

  if (
    originalPhone &&
    String(originalPhone) !== candidatePhone
  ) {

    return await getCustomerByPhone(
      businessId,
      String(originalPhone)
    );
  }

  return null;
}


/*
|--------------------------------------------------------------------------
| BOOKING OWNERSHIP
|--------------------------------------------------------------------------
|
| Customer-facing tools must not allow a customer to access or modify
| another customer's booking just by knowing a UUID.
|
|--------------------------------------------------------------------------
*/

async function getOwnedBooking(
  bookingId,
  context = {}
) {
  const businessId =
    getBusinessId(context);

  const booking =
    await getBookingById(
      businessId,
      bookingId
    );

  if (!booking) {
    return {
      success: false,
      found: false,
      message: "Booking not found."
    };
  }

  const customer =
    await resolveCustomer(context);

  if (!customer) {
    return {
      success: false,
      found: false,
      message:
        "The current WhatsApp customer could not be verified."
    };
  }

  if (
    booking.customer_id !==
    customer.id
  ) {
    return {
      success: false,
      found: false,
      message:
        "This booking does not belong to the current customer."
    };
  }

  return {
    success: true,
    booking,
    customer
  };
}


/*
|--------------------------------------------------------------------------
| TOOL REGISTRY
|--------------------------------------------------------------------------
*/

export const tools = {

  /*
  |--------------------------------------------------------------------------
  | BUSINESS
  |--------------------------------------------------------------------------
  */

  get_business_info: {

    description:
      "Get complete information about the business, including name, type, description, phone, email and address.",

    parameters: {
      type: Type.OBJECT,
      properties: {}
    },

    execute: get_business_info
  },


  search_knowledge: {

    description:
      "Search the business information to answer customer questions about the business.",

    parameters: {
      type: Type.OBJECT,

      properties: {

        query: {
          type: Type.STRING,
          description:
            "The information the customer is asking about."
        }

      },

      required: ["query"]
    },

    execute: search_knowledge
  },


  /*
  |--------------------------------------------------------------------------
  | ROOM CATALOG
  |--------------------------------------------------------------------------
  */

  get_rooms: {

    description:
      "Get the hotel's room types, prices, capacities and descriptions. Use this when the customer asks what rooms the hotel has or asks about room types/prices. Do not require dates just to list room types.",

    parameters: {
      type: Type.OBJECT,
      properties: {}
    },

    execute: get_rooms
  },


  /*
  |--------------------------------------------------------------------------
  | ROOM AVAILABILITY
  |--------------------------------------------------------------------------
  */

  search_availability: {

    description:
      "Check real room availability for specific check-in and check-out dates and number of guests. Always use this before telling the customer that a room is available for specific dates.",

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
        "check_out",
        "guests"
      ]
    },

    execute: search_availability
  },


  /*
  |--------------------------------------------------------------------------
  | CUSTOMERS
  |--------------------------------------------------------------------------
  */

  get_customer: {

    description:
      "Find the current WhatsApp customer. Prefer the customer identity from the conversation context. A phone number is optional.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        phone: {
          type: Type.STRING,
          description:
            "Optional customer WhatsApp phone number. Use only if needed."
        }

      }
    },

    execute: get_customer
  },


  create_customer: {

    description:
      "Create or update a customer record after customer information has been collected.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        name: {
          type: Type.STRING,
          description:
            "Customer full name."
        },

        phone: {
          type: Type.STRING,
          description:
            "Customer WhatsApp phone number. If omitted, use the current WhatsApp customer."
        },

        email: {
          type: Type.STRING,
          description:
            "Customer email address, if available."
        }

      },

      required: ["name"]
    },

    execute: create_customer
  },


  /*
  |--------------------------------------------------------------------------
  | BOOKINGS
  |--------------------------------------------------------------------------
  */

  create_booking: {

    description:
      "Create a hotel booking only after the customer has selected a room and provided their full name, check-in date, check-out date and number of guests. The current WhatsApp customer's phone number should be used automatically when available. The backend checks the room, capacity and date conflicts again before creating the booking.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        customer_name: {
          type: Type.STRING,
          description:
            "Customer full name."
        },

        customer_phone: {
          type: Type.STRING,
          description:
            "Optional customer WhatsApp phone number. Prefer the current WhatsApp customer context."
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

    execute: create_booking
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
            "Booking UUID."
        }

      },

      required: ["booking_id"]
    },

    execute: get_booking
  },


  get_customer_bookings: {

    description:
      "Get the current WhatsApp customer's previous and current hotel bookings. Prefer the current customer identity from conversation context; do not ask the customer for their phone number just to look up their bookings.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        phone: {
          type: Type.STRING,
          description:
            "Optional customer WhatsApp phone number. Usually not needed because the current customer is already known."
        }

      }
    },

    execute: get_customer_bookings
  },


  cancel_booking: {

    description:
      "Cancel an existing booking belonging to the current WhatsApp customer. Only cancel when the customer clearly requests cancellation.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        booking_id: {
          type: Type.STRING,
          description:
            "Booking UUID."
        },

        reason: {
          type: Type.STRING,
          description:
            "Reason for cancellation, if provided."
        }

      },

      required: ["booking_id"]
    },

    execute: cancel_booking
  },


  modify_booking: {

    description:
      "Modify the current customer's existing booking. Use this when the customer requests changes to dates, room or guest count. Availability must be checked before changing dates or room.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        booking_id: {
          type: Type.STRING,
          description:
            "Booking UUID."
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

      required: ["booking_id"]
    },

    execute: modify_booking
  },


  /*
  |--------------------------------------------------------------------------
  | LEADS
  |--------------------------------------------------------------------------
  */

  create_lead: {

    description:
      "Create a business lead when a customer shows meaningful buying intent, requests follow-up or makes a sales enquiry.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        phone: {
          type: Type.STRING,
          description:
            "Optional customer WhatsApp phone number."
        },

        notes: {
          type: Type.STRING,
          description:
            "Short description of the customer's enquiry."
        },

        status: {
          type: Type.STRING,
          description:
            "Lead status such as new, contacted or qualified."
        }

      },

      required: ["notes"]
    },

    execute: create_lead
  },


  /*
  |--------------------------------------------------------------------------
  | CONVERSATIONS / MESSAGES
  |--------------------------------------------------------------------------
  */

  get_conversation: {

    description:
      "Get or create the current customer's WhatsApp conversation.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        phone: {
          type: Type.STRING,
          description:
            "Optional customer WhatsApp phone number."
        }

      }
    },

    execute: get_conversation
  },


  save_message: {

    description:
      "Save a customer, AI or staff message into the current WhatsApp conversation.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        phone: {
          type: Type.STRING,
          description:
            "Optional customer WhatsApp phone number."
        },

        sender_type: {
          type: Type.STRING,
          description:
            "Message sender type: customer, ai or staff."
        },

        message: {
          type: Type.STRING,
          description:
            "Message text."
        }

      },

      required: [
        "sender_type",
        "message"
      ]
    },

    execute: save_message
  },


  /*
  |--------------------------------------------------------------------------
  | PAYMENTS
  |--------------------------------------------------------------------------
  */

  create_payment_record: {

    description:
      "Create a manual pending payment record only when no payment record exists for the booking. Do not call this immediately after create_booking because create_booking already creates the Razorpay payment record.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        booking_id: {
          type: Type.STRING,
          description:
            "Booking UUID."
        },

        customer_phone: {
          type: Type.STRING,
          description:
            "Optional customer WhatsApp phone number."
        },

        amount: {
          type: Type.NUMBER,
          description:
            "Payment amount."
        },

        provider: {
          type: Type.STRING,
          description:
            "Payment provider name, if known. Razorpay is used for hotel bookings."
        }

      },

      required: [
        "booking_id",
        "amount"
      ]
    },

    execute: create_payment
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
            "Booking UUID."
        }

      },

      required: ["booking_id"]
    },

    execute: get_payment_status
  },


  /*
  |--------------------------------------------------------------------------
  | HUMAN HANDOFF
  |--------------------------------------------------------------------------
  */

  transfer_to_human: {

    description:
      "Transfer the conversation to human staff when the customer requests human assistance or the AI cannot safely handle the request.",

    parameters: {

      type: Type.OBJECT,

      properties: {

        reason: {
          type: Type.STRING,
          description:
            "Reason for requesting human assistance."
        }

      },

      required: ["reason"]
    },

    execute: transfer_to_human
  }

};


/*
|--------------------------------------------------------------------------
| BUSINESS INFORMATION
|--------------------------------------------------------------------------
*/

async function get_business_info(
  args = {},
  context = {}
) {/*
|--------------------------------------------------------------------------
| BUSINESS INFORMATION
|--------------------------------------------------------------------------
*/

async function get_business_info(
  args = {},
  context = {}
) {
  const businessId =
    getBusinessId(context);

  const business =
    await getBusinessFromDatabase(
      businessId
    );

  return {
    success: true,
    business
  };
}


/*
|--------------------------------------------------------------------------
| KNOWLEDGE SEARCH
|--------------------------------------------------------------------------
*/

async function search_knowledge(
  { query = "" } = {},
  context = {}
) {
  const businessId =
    getBusinessId(context);

  const business =
    await getBusinessFromDatabase(
      businessId
    );

  if (!query.trim()) {
    return {
      success: true,
      result: business
    };
  }

  const searchableBusiness =
    JSON.stringify(
      business
    ).toLowerCase();

  const searchQuery =
    query.toLowerCase().trim();

  if (
    searchableBusiness.includes(
      searchQuery
    )
  ) {
    return {
      success: true,
      query,
      result: business
    };
  }

  return {
    success: false,
    query,
    message:
      "No matching business information was found."
  };
}


/*
|--------------------------------------------------------------------------
| ROOM CATALOG
|--------------------------------------------------------------------------
*/

async function get_rooms(
  args = {},
  context = {}
) {
  const businessId =
    getBusinessId(context);

  const db =
    getSupabase();

  const { data, error } =
    await db
      .from("rooms")
      .select("*")
      .eq(
        "business_id",
        businessId
      )
      .order(
        "price_per_night",
        {
          ascending: true
        }
      );

  if (error) {
    throw new Error(
      `Failed to load rooms: ${error.message}`
    );
  }

  return {
    success: true,
    rooms: data || []
  };
}


/*
|--------------------------------------------------------------------------
| ROOM AVAILABILITY
|--------------------------------------------------------------------------
*/

async function search_availability(
  {
    check_in,
    check_out,
    guests = 1
  } = {},
  context = {}
) {
  const businessId =
    getBusinessId(context);

  const guestCount =
    Number(guests);

  if (!check_in || !check_out) {
    return {
      success: false,
      message:
        "Check-in and check-out dates are required."
    };
  }

  if (
    !isValidDateString(check_in) ||
    !isValidDateString(check_out)
  ) {
    return {
      success: false,
      message:
        "Invalid date format. Use YYYY-MM-DD."
    };
  }

  if (
    new Date(`${check_out}T00:00:00Z`) <=
    new Date(`${check_in}T00:00:00Z`)
  ) {
    return {
      success: false,
      message:
        "Check-out date must be after check-in date."
    };
  }

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

  const rooms =
    await getAvailableRooms({
      businessId,
      guests: guestCount
    });

  const overlappingBookings =
    await getOverlappingBookings({
      businessId,
      checkIn: check_in,
      checkOut: check_out
    });

  const bookedRoomIds =
    new Set(
      overlappingBookings.map(
        booking =>
          booking.room_id
      )
    );

  const availableRooms =
    rooms.filter(
      room =>
        !bookedRoomIds.has(
          room.room_id
        )
    );

  return {
    success: true,
    check_in,
    check_out,
    guests: guestCount,
    available_rooms:
      availableRooms
  };
}


/*
|--------------------------------------------------------------------------
| CUSTOMER
|--------------------------------------------------------------------------
*/

async function get_customer(
  { phone } = {},
  context = {}
) {
  const customer =
    await resolveCustomer(
      context,
      phone
    );

  return {
    success: true,
    found: Boolean(customer),
    customer
  };
}


/*
|--------------------------------------------------------------------------
| CREATE / UPDATE CUSTOMER
|--------------------------------------------------------------------------
*/

async function create_customer(
  {
    name,
    phone,
    email = null
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

  if (!name || !customerPhone) {
    return {
      success: false,
      message:
        "Customer name and WhatsApp phone number are required."
    };
  }

  const customer =
    await createCustomerRecord({
      businessId,
      name,
      phone: customerPhone,
      email
    });

  return {
    success: true,
    customer
  };
}


/*
|--------------------------------------------------------------------------
| CREATE BOOKING
|--------------------------------------------------------------------------
*/

async function create_booking(
  {
    customer_name,
    customer_phone,
    room_id,
    check_in,
    check_out,
    guests
  } = {},
  context = {}
) {
  const businessId =
    getBusinessId(context);

  const guestCount =
    Number(guests);

  const customerPhone =
    normalizePhone(
      customer_phone ||
      context.customerPhone
    );

  /*
  |--------------------------------------------------------------------------
  | Validate required information
  |--------------------------------------------------------------------------
  */

  if (
    !customer_name ||
    !room_id ||
    !check_in ||
    !check_out ||
    !customerPhone ||
    !guests
  ) {
    return {
      success: false,
      message:
        "Customer name, phone, room, dates and guest count are required."
    };
  }

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

  if (
    !isValidDateString(check_in) ||
    !isValidDateString(check_out)
  ) {
    return {
      success: false,
      message:
        "Invalid booking dates. Use YYYY-MM-DD."
    };
  }

  if (
    new Date(`${check_out}T00:00:00Z`) <=
    new Date(`${check_in}T00:00:00Z`)
  ) {
    return {
      success: false,
      message:
        "Check-out date must be after check-in date."
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
  | Create Razorpay order
  |--------------------------------------------------------------------------
  */

  let razorpayOrder;

  try {
    razorpayOrder =
      await createRazorpayOrder({
        bookingId:
          booking.id,
        amount:
          totalAmount,
        currency:
          room.currency ||
          "INR"
      });
  } catch (error) {
    console.error(
      "Razorpay order creation failed:",
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
    !razorpayOrder?.success ||
    !razorpayOrder?.order_id
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
        "The payment order could not be created."
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
          razorpayOrder.order_id,
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

      razorpay_order_id:
        razorpayOrder.order_id,

      amount:
        razorpayOrder.amount,

      currency:
        razorpayOrder.currency,

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

async function modify_booking(
  {
    booking_id,
    check_in,
    check_out,
    room_id,
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
      conversation: null
    };
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

    
