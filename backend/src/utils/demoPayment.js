import crypto from "crypto";

// Demo payment mode for exhibition builds.
//
// The platform is being shown before a payment gateway account is live, so the
// checkout needs to complete without a real transaction. This is deliberately
// narrow:
//
//   * it is off unless DEMO_PAYMENT=true is set explicitly
//   * it never runs alongside a working gateway - the app asks the server which
//     mode it is in, and the server only offers demo mode when the flag is set
//   * every order it settles is stored with paymentMethod "DEMO" and a
//     demoReference, so demo money can always be told apart from real money
//   * it settles only the caller's own pending order, exactly as the verified
//     path does; it does not accept an arbitrary order id
//
// It is a simulator, not a bypass of signature checking on the real path:
// verifyPayment still validates the Razorpay signature when a gateway order is
// what was created.

export const demoPaymentEnabled = () => process.env.DEMO_PAYMENT === "true";

export const DEMO_NOTICE =
  "Demo payment mode - no money moved. Set DEMO_PAYMENT=false before real use.";

export function demoReference() {
  return `DEMO-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;
}

// Mirrors the shape of a gateway order so the client branches on `mode` alone.
export function demoOrderPayload({ order, amountPaise, summary, prefill }) {
  return {
    mode: "demo",
    notice: DEMO_NOTICE,
    demoReference: demoReference(),
    amount: amountPaise,
    currency: "INR",
    orderId: order.orderId,
    dbOrderId: order._id,
    summary,
    prefill,
    // the UPI apps a demo sheet can offer; purely presentational
    methods: ["Google Pay", "PhonePe", "Paytm", "UPI ID", "Card"],
  };
}
