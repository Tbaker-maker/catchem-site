// POST_OFFICE is off unless the worker env is exactly "on".
// Unset, blank, "off", and anything else keep the tools closed.
export const POST_OFFICE_LINE = "We're rebuilding this. Email and social tools are coming back better.";

export function postOfficeOn(env) {
  return String(env?.POST_OFFICE || "").trim().toLowerCase() === "on";
}
