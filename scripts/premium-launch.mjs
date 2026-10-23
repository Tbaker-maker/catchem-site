// Launch mail stays off. Confirmed people are emailed a test checkout only
// from the worker admin route, and only when PREMIUM_MODE=live,
// PREMIUM_LAUNCH=test, and STRIPE_SECRET_KEY starts with sk_test_.
// This script does not send.
console.log("premium launch: off");
process.exit(0);
