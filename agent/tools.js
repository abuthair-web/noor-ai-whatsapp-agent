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
  | ROOMS / AVAILABILITY
  |--------------------------------------------------------------------------
  */

  search_availability: {
    description:
      "Check real room availability for specific check-in and check-out dates and number of guests. Always use this tool before telling the customer that a room is available.",

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
      "Find the customer using their WhatsApp phone number.",

    parameters: {
      type: Type.OBJECT,

      properties: {
        phone: {
          type: Type.STRING,
          description:
            "Customer WhatsApp phone number."
        }
      },

      required: ["phone"]
    },

    execute: get_customer
  },


  create_customer: {
    description:
      "Create or update a customer record. Use this when customer information has been collected.",

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
            "Customer WhatsApp phone number."
        },

        email: {
          type: Type.STRING,
          description:
            "Customer email address, if available."
        }
      },

      required: [
        "name",
        "phone"
      ]
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
      "Create a hotel booking only after the customer has selected a room and provided their full name, phone number, check-in date, check-out date and number of guests. The backend will verify room availability again before creating the booking.",

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
            "Customer WhatsApp phone number."
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
        "customer_phone",
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
      "Get the details and current status of a booking using its booking ID.",

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
      "Get the customer's previous and current hotel bookings.",

    parameters: {
      type: Type.OBJECT,

      properties: {
        phone: {
          type: Type.STRING,
          description:
            "Customer WhatsApp phone number."
        }
      },

      required: ["phone"]
    },

    execute: get_customer_bookings
  },


  cancel_booking: {
    description:
      "Cancel an existing booking. Only cancel a booking when the customer clearly requests cancellation.",

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
      "Modify an existing booking's dates, room or guest count. Availability must be checked before changing dates or room.",

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
      "Create a business lead when a customer makes an enquiry, shows buying intent or requests follow-up.",

    parameters: {
      type: Type.OBJECT,

      properties: {

        phone: {
          type: Type.STRING,
          description:
            "Customer WhatsApp phone number."
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

      required: [
        "phone",
        "notes"
      ]
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
      "Get or create the customer's WhatsApp conversation record.",

    parameters: {
      type: Type.OBJECT,

      properties: {
        phone: {
          type: Type.STRING,
          description:
            "Customer WhatsApp phone number."
        }
      },

      required: ["phone"]
    },

    execute: get_conversation
  },


  save_message: {
    description:
      "Save a customer or AI message into the conversation history.",

    parameters: {
      type: Type.OBJECT,

      properties: {

        phone: {
          type: Type.STRING,
          description:
            "Customer WhatsApp phone number."
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
        "phone",
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
      "Create a pending payment record for a booking. This does not confirm payment. Payment confirmation must come from the payment gateway webhook.",

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
            "Customer WhatsApp phone number."
        },

        amount: {
          type: Type.NUMBER,
          description:
            "Payment amount."
        },

        provider: {
          type: Type.STRING,
          description:
            "Payment provider name, if known."
        }
      },

      required: [
        "booking_id",
        "customer_phone",
        "amount"
      ]
    },

    execute: create_payment
  },


  get_payment_status: {
    description:
      "Get the payment record and current payment status for a booking.",

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
      "Transfer the conversation to a human staff member when the customer requests human assistance or the AI cannot safely handle the request.",

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
    query.toLowerCase();

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

  if (!check_in || !check_out) {

    return {
      success: false,
      message:
        "Check-in and check-out dates are required."
    };

  }

  const checkInDate =
    new Date(check_in);

  const checkOutDate =
    new Date(check_out);

  if (
    Number.isNaN(
      checkInDate.getTime()
    ) ||
    Number.isNaN(
      checkOutDate.getTime()
    )
  ) {

    return {
      success: false,
      message:
        "Invalid date format. Use YYYY-MM-DD."
    };

  }

  if (
    checkOutDate <= checkInDate
  ) {

    return {
      success: false,
      message:
        "Check-out date must be after check-in date."
    };

  }

  const rooms =
    await getAvailableRooms({
      businessId,
      guests
    });

  if (!rooms.length) {

    return {
      success: true,
      check_in,
      check_out,
      guests,
      available_rooms: []
    };

  }

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
    guests,
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

  const businessId =
    getBusinessId(context);

  const customerPhone =
    phone ||
    context.customerPhone;

  if (!customerPhone) {

    return {
      success: false,
      message:
        "Customer phone number is required."
    };

  }

  const customer =
    await getCustomerByPhone(
      businessId,
      customerPhone
    );

  return {
    success: true,
    found: Boolean(customer),
    customer
  };
}


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

  if (!name || !phone) {

    return {
      success: false,
      message:
        "Customer name and phone are required."
    };

  }

  const customer =
    await createCustomerRecord({
      businessId,
      name,
      phone,
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

  if (
    !customer_name ||
    !customer_phone ||
    !room_id ||
    !check_in ||
    !check_out ||
    !guests
  ) {

    return {
      success: false,
      message:
        "Customer name, phone, room, dates and guest count are required."
    };

  }

  const checkInDate =
    new Date(check_in);

  const checkOutDate =
    new Date(check_out);

  if (
    Number.isNaN(
      checkInDate.getTime()
    ) ||
    Number.isNaN(
      checkOutDate.getTime()
    )
  ) {

    return {
      success: false,
      message:
        "Invalid booking dates."
    };

  }

  if (
    checkOutDate <= checkInDate
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
    Number(guests) >
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
  | Re-check availability
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
        booking.room_id === room_id
    );

  if (roomAlreadyBooked) {

    return {
      success: false,
      status: "room_unavailable",

      message:
        "Sorry, that room has just been booked for the requested dates. Please choose another room or dates."
    };

  }


  /*
  |--------------------------------------------------------------------------
  | Customer
  |--------------------------------------------------------------------------
  */

  const customer =
    await createCustomerRecord({
      businessId,
      name: customer_name,
      phone: customer_phone
    });


  /*
  |--------------------------------------------------------------------------
  | Calculate total
  |--------------------------------------------------------------------------
  */

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const nights =
    Math.round(
      (
        checkOutDate -
        checkInDate
      ) / millisecondsPerDay
    );

  const totalAmount =
    nights *
    Number(room.price_per_night);


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
        Number(guests),
      totalAmount
    });


  return {
    success: true,

    status: "booking_created",

    booking: {
      id: booking.id,
      room_id: room.room_id,
      room_name: room.name,
      check_in: booking.check_in,
      check_out: booking.check_out,
      guests: booking.guests,
      nights,
      price_per_night:
        Number(room.price_per_night),
      total_amount:
        totalAmount,
      currency:
        room.currency || "INR",
      status:
        booking.status,
      payment_status:
        booking.payment_status
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

  const businessId =
    getBusinessId(context);

  if (!booking_id) {

    return {
      success: false,
      message:
        "Booking ID is required."
    };

  }

  const booking =
    await getBookingById(
      businessId,
      booking_id
    );

  if (!booking) {

    return {
      success: false,
      found: false,
      message:
        "Booking not found."
    };

  }

  return {
    success: true,
    found: true,
    booking
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

  const customerPhone =
    phone ||
    context.customerPhone;

  if (!customerPhone) {

    return {
      success: false,
      message:
        "Customer phone number is required."
    };

  }

  const customer =
    await getCustomerByPhone(
      businessId,
      customerPhone
    );

  if (!customer) {

    return {
      success: true,
      customer_found: false,
      bookings: []
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

  const businessId =
    getBusinessId(context);

  if (!booking_id) {

    return {
      success: false,
      message:
        "Booking ID is required."
    };

  }

  const booking =
    await getBookingById(
      businessId,
      booking_id
    );

  if (!booking) {

    return {
      success: false,
      message:
        "Booking not found."
    };

  }

  if (
    booking.status ===
    "cancelled"
  ) {

    return {
      success: true,
      status: "already_cancelled",
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
      businessId,
      booking_id,
      {
        status: "cancelled"
      }
    );

  return {
    success: true,
    status: "cancelled",
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

  const businessId =
    getBusinessId(context);

  if (!booking_id) {

    return {
      success: false,
      message:
        "Booking ID is required."
    };

  }

  const booking =
    await getBookingById(
      businessId,
      booking_id
    );

  if (!booking) {

    return {
      success: false,
      message:
        "Booking not found."
    };

  }

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

  const checkInDate =
    new Date(newCheckIn);

  const checkOutDate =
    new Date(newCheckOut);

  if (
    Number.isNaN(
      checkInDate.getTime()
    ) ||
    Number.isNaN(
      checkOutDate.getTime()
    ) ||
    checkOutDate <= checkInDate
  ) {

    return {
      success: false,
      message:
        "Invalid check-in or check-out dates."
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
    Number(newGuests) >
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
      businessId,
      checkIn: newCheckIn,
      checkOut: newCheckOut
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
      message:
        "The selected room is not available for those dates."
    };

  }


  /*
  |--------------------------------------------------------------------------
  | Recalculate total
  |--------------------------------------------------------------------------
  */

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const nights =
    Math.round(
      (
        checkOutDate -
        checkInDate
      ) / millisecondsPerDay
    );

  const totalAmount =
    nights *
    Number(room.price_per_night);


  const updatedBooking =
    await updateBooking(
      businessId,
      booking_id,
      {
        room_id:
          newRoomId,

        check_in:
          newCheckIn,

        check_out:
          newCheckOut,

        guests:
          Number(newGuests),

        total_amount:
          totalAmount
      }
    );

  return {
    success: true,
    status: "booking_updated",
    booking:
      updatedBooking
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

  if (!phone || !notes) {

    return {
      success: false,
      message:
        "Phone number and lead notes are required."
    };

  }

  const customer =
    await getCustomerByPhone(
      businessId,
      phone
    );

  const lead =
    await createLeadRecord({
      businessId,
      customerId:
        customer?.id || null,
      source:
        "whatsapp",
      status,
      notes
    });

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

  const customerPhone =
    phone ||
    context.customerPhone;

  if (!customerPhone) {

    return {
      success: false,
      message:
        "Customer phone number is required."
    };

  }

  const customer =
    await getCustomerByPhone(
      businessId,
      customerPhone
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
    phone ||
    context.customerPhone;

  if (
    !customerPhone ||
    !sender_type ||
    !message
  ) {

    return {
      success: false,
      message:
        "Phone, sender type and message are required."
    };

  }

  let customer =
    await getCustomerByPhone(
      businessId,
      customerPhone
    );

  /*
  |--------------------------------------------------------------------------
  | Automatically create customer
  |--------------------------------------------------------------------------
  */

  if (!customer) {

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

  if (
    !booking_id ||
    !customer_phone ||
    !amount
  ) {

    return {
      success: false,
      message:
        "Booking ID, customer phone and amount are required."
    };

  }

  const customer =
    await getCustomerByPhone(
      businessId,
      customer_phone
    );

  if (!customer) {

    return {
      success: false,
      message:
        "Customer not found."
    };

  }

  const payment =
    await createPaymentRecord({
      businessId,
      bookingId:
        booking_id,
      customerId:
        customer.id,
      provider,
      amount:
        Number(amount),
      currency:
        "INR",
      status:
        "pending"
    });

  return {
    success: true,
    status: "payment_pending",
    payment
  };
}


async function get_payment_status(
  { booking_id } = {},
  context = {}
) {

  const businessId =
    getBusinessId(context);

  if (!booking_id) {

    return {
      success: false,
      message:
        "Booking ID is required."
    };

  }

  const payment =
    await getPaymentByBooking(
      businessId,
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

  const customerPhone =
    context.customerPhone;

  let customer = null;

  if (customerPhone) {

    customer =
      await getCustomerByPhone(
        businessId,
        customerPhone
      );

  }

  if (customer) {

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
        `Human handoff requested: ${reason || "Customer requested human assistance."}`
    });

    /*
    |--------------------------------------------------------------------------
    | Mark conversation for staff
    |--------------------------------------------------------------------------
    */

    const db =
      getSupabase();

    await db
      .from("conversations")
      .update({
        status: "human",
        updated_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        conversation.id
      );
  }

  return {
    success: true,
    status:
      "human_handoff_requested",
    reason:
      reason ||
      "Customer requested human assistance."
  };
}
