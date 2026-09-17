import { getBusiness } from "../config/business.js";

/*
|--------------------------------------------------------------------------
| Tool Registry
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
| Business Information
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
| Knowledge
|--------------------------------------------------------------------------
*/

async function search_knowledge({ query = "" }) {
  const business = getBusiness();

  const searchableText = JSON.stringify(business).toLowerCase();

  if (!query || searchableText.includes(query.toLowerCase())) {
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
| Availability
|--------------------------------------------------------------------------
*/

async function search_availability({
  check_in,
  check_out,
  guests = 1
}) {
  const business = getBusiness();

  const rooms = business.rooms.filter(
    room => room.available && room.capacity >= guests
  );

  return {
    success: true,
    check_in,
    check_out,
    guests,
    rooms
  };
}

/*
|--------------------------------------------------------------------------
| Booking
|--------------------------------------------------------------------------
*/

async function create_booking(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Booking database is not connected yet. No booking was created.",
    requested_data: data
  };
}

async function modify_booking(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Booking database is not connected yet. No booking was modified.",
    requested_data: data
  };
}

async function cancel_booking(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Booking database is not connected yet. No booking was cancelled.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| Customer
|--------------------------------------------------------------------------
*/

async function create_customer(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Customer database is not connected yet.",
    requested_data: data
  };
}

async function get_customer(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Customer database is not connected yet.",
    requested_data: data
  };
}

async function update_customer(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Customer database is not connected yet.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| Products / Orders
|--------------------------------------------------------------------------
*/

async function search_products(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Product database is not connected yet.",
    requested_data: data
  };
}

async function create_order(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Order database is not connected yet. No order was created.",
    requested_data: data
  };
}

async function update_order(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Order database is not connected yet. No order was updated.",
    requested_data: data
  };
}

async function cancel_order(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Order database is not connected yet. No order was cancelled.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
*/

async function create_payment(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Payment provider is not connected yet. No payment request was created.",
    requested_data: data
  };
}

async function verify_payment(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Payment provider is not connected yet. Payment has not been verified.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| Reminders
|--------------------------------------------------------------------------
*/

async function create_reminder(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Reminder service is not connected yet.",
    requested_data: data
  };
}

async function cancel_reminder(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "Reminder service is not connected yet.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| CRM / Leads
|--------------------------------------------------------------------------
*/

async function create_lead(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "CRM database is not connected yet.",
    requested_data: data
  };
}

async function update_lead(data) {
  return {
    success: false,
    status: "not_connected",
    message:
      "CRM database is not connected yet.",
    requested_data: data
  };
}

/*
|--------------------------------------------------------------------------
| Human Handoff
|--------------------------------------------------------------------------
*/

async function transfer_to_human(data) {
  return {
    success: true,
    status: "human_handoff_requested",
    message:
      "The conversation has been marked for human assistance.",
    requested_data: data
  };
}
