import { getBusiness } from "../config/business.js";

/*
|--------------------------------------------------------------------------
| Noor AI Tool Registry
|--------------------------------------------------------------------------
|
| These tools are the action layer of Noor AI.
|
| Later, these functions will connect to Supabase, payment providers,
| booking systems, CRM systems and notification services.
|
|--------------------------------------------------------------------------
*/

export const tools = {
  get_business_info,
  search_knowledge,

  search_availability,
  create_booking,
  modify_booking,
  cancel_booking,

  create_customer,
  get_customer,
  update_customer,

  search_products,
  create_order,
  update_order,
  cancel_order,

  create_payment,
  verify_payment,

  create_reminder,
  cancel_reminder,

  create_lead,
  update_lead,

  transfer_to_human
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

async function modify_booking(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The booking system is not connected yet. No booking was modified.",
    requested_data: data
  };
}

async function cancel_booking(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The booking system is not connected yet. No booking was cancelled.",
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

async function update_customer(data = {}) {
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
| PRODUCTS
|--------------------------------------------------------------------------
*/

async function search_products(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The product database is not connected yet.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| ORDERS
|--------------------------------------------------------------------------
*/

async function create_order(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The order system is not connected yet. No order was created.",
    requested_data: data
  };
}

async function update_order(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The order system is not connected yet. No order was updated.",
    requested_data: data
  };
}

async function cancel_order(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The order system is not connected yet. No order was cancelled.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| PAYMENTS
|--------------------------------------------------------------------------
*/

async function create_payment(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The payment provider is not connected yet. No payment request was created.",
    requested_data: data
  };
}

async function verify_payment(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The payment provider is not connected yet. Payment has not been verified.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| REMINDERS
|--------------------------------------------------------------------------
*/

async function create_reminder(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The reminder service is not connected yet.",
    requested_data: data
  };
}

async function cancel_reminder(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The reminder service is not connected yet.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| CRM
|--------------------------------------------------------------------------
*/

async function create_lead(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The CRM database is not connected yet.",
    requested_data: data
  };
}

async function update_lead(data = {}) {
  return {
    success: false,
    status: "not_connected",
    message:
      "The CRM database is not connected yet.",
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
