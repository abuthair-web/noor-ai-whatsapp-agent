/*
|--------------------------------------------------------------------------
| Database Service
|--------------------------------------------------------------------------
|
| Supabase will be connected here.
|
| Keeping database operations in their own service prevents the AI agent
| from directly depending on database implementation details.
|
*/

export async function createCustomer(data) {
  return {
    success: false,
    status: "not_connected",
    message: "Database is not connected yet.",
    data
  };
}

export async function getCustomer(data) {
  return {
    success: false,
    status: "not_connected",
    message: "Database is not connected yet.",
    data
  };
}

export async function createLead(data) {
  return {
    success: false,
    status: "not_connected",
    message: "Database is not connected yet.",
    data
  };
}

export async function createBooking(data) {
  return {
    success: false,
    status: "not_connected",
    message: "Database is not connected yet.",
    data
  };
}
