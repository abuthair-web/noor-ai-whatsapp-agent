import { Type } from "@google/genai";
import { getBusiness } from "../config/business.js";

/*
|--------------------------------------------------------------------------
| Noor AI Tool Registry
|--------------------------------------------------------------------------
|
| Each tool contains:
| - description
| - parameters
| - execute()
|
| Gemini uses the description + parameters to decide when to call a tool.
|
|--------------------------------------------------------------------------
*/

export const tools = {
  get_business_info: {
    description:
      "Get complete information about the business, including name, type, location, hours, services, rooms, prices and policies.",

    parameters: {
      type: Type.OBJECT,
      properties: {}
    },

    execute: get_business_info
  },

  search_knowledge: {
    description:
      "Search the business knowledge for information relevant to the customer's question.",

    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The information the customer is asking about."
        }
      },
      required: ["query"]
    },

    execute: search_knowledge
  },

  search_availability: {
    description:
      "Check which hotel rooms are available for the requested dates and number of guests.",

    parameters: {
      type: Type.OBJECT,
      properties: {
        check_in: {
          type: Type.STRING,
          description: "Check-in date in YYYY-MM-DD format."
        },
        check_out: {
          type: Type.STRING,
          description: "Check-out date in YYYY-MM-DD format."
        },
        guests: {
          type: Type.NUMBER,
          description: "Number of guests."
        }
      },
      required: ["check_in", "check_out", "guests"]
    },

    execute: search_availability
  },

  create_booking: {
    description:
      "Create a hotel booking. Only use this when all required booking information has been collected.",

    parameters: {
      type: Type.OBJECT,
      properties: {
        customer_name: {
          type: Type.STRING,
          description: "Customer full name."
        },
        customer_phone: {
          type: Type.STRING,
          description: "Customer WhatsApp phone number."
        },
        room_id: {
          type: Type.STRING,
          description: "ID of the selected room."
        },
        check_in: {
          type: Type.STRING,
          description: "Check-in date in YYYY-MM-DD format."
        },
        check_out: {
          type: Type.STRING,
          description: "Check-out date in YYYY-MM-DD format."
        },
        guests: {
          type: Type.NUMBER,
          description: "Number of guests."
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

  create_customer: {
    description:
      "Create a customer record in the business customer database.",

    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Customer full name."
        },
        phone: {
          type: Type.STRING,
          description: "Customer WhatsApp phone number."
        },
        email: {
          type: Type.STRING,
          description: "Customer email address, if available."
        }
      },
      required: ["name", "phone"]
    },

    execute: create_customer
  },

  get_customer: {
    description:
      "Find an existing customer using their phone number.",

    parameters: {
      type: Type.OBJECT,
      properties: {
        phone: {
          type: Type.STRING,
          description: "Customer WhatsApp phone number."
        }
      },
      required: ["phone"]
    },

    execute: get_customer
  },

  transfer_to_human: {
    description:
      "Transfer the conversation to a human staff member when the customer requests human assistance or the AI cannot safely handle the request.",

    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: "Reason for requesting human assistance."
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

async function get_business_info() {
  const business = getBusiness();

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

async function search_knowledge({ query = "" } = {}) {
  const business = getBusiness();

  if (!query) {
    return {
      success: true,
      result: business
    };
  }

  const searchableBusiness =
    JSON.stringify(business).toLowerCase();

  const searchQuery = query.toLowerCase();

  if (searchableBusiness.includes(searchQuery)) {
    return {
      success: true,
      query,
      result: business
    };
  }

  return {
    success: false,
    query,
    message: "No matching business information was found."
  };
}

/*
|--------------------------------------------------------------------------
| AVAILABILITY
|--------------------------------------------------------------------------
*/

async function search_availability({
  check_in,
  check_out,
  guests = 1
} = {}) {
  const business = getBusiness();

  const rooms = (business.rooms || []).filter(
    room =>
      room.available === true &&
      room.capacity >= Number(guests)
  );

  return {
    success: true,
    check_in,
    check_out,
    guests,
    available_rooms: rooms
  };
}

/*
|--------------------------------------------------------------------------
| BOOKINGS
|--------------------------------------------------------------------------
*/

async function create_booking(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The booking system is not connected yet. No booking was created.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| CUSTOMERS
|--------------------------------------------------------------------------
*/

async function create_customer(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The customer database is not connected yet.",
    requested_data: data
  };
}

async function get_customer(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The customer database is not connected yet.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| HUMAN HANDOFF
|--------------------------------------------------------------------------
*/

async function transfer_to_human(data = {}) {
  return {
    success: true,
    status: "human_handoff_requested",
    message:
      "The conversation has been marked for human assistance.",
    requested_data: data
  };
}
