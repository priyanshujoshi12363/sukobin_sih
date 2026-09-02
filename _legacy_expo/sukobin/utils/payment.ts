export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
}

/**
 * Opens the native Razorpay checkout sheet. We require() the module lazily so a
 * missing native build (e.g. running in Expo Go without the dev client) throws a
 * clean, handleable error instead of crashing the bundle at import time.
 */
export async function openRazorpay(options: RazorpayOptions): Promise<RazorpaySuccess> {
  let RazorpayCheckout: any;
  try {
    RazorpayCheckout = require('react-native-razorpay').default;
  } catch {
    throw {
      code: 'NATIVE_MISSING',
      description:
        'Razorpay is not available in this build. Run `npx expo prebuild` and rebuild the dev client.',
    };
  }
  return RazorpayCheckout.open(options);
}
