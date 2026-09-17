import businessData from "../data/demo-business.json" with { type: "json" };

export function getBusiness() {
  return businessData;
}

export function getBusinessId() {
  return process.env.BUSINESS_ID || businessData.business_id;
}
