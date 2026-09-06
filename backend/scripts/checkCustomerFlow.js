import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/user.model.js";
import Product from "../src/models/product.model.js";
import Cart from "../src/models/cart.models.js";
import Order from "../src/models/order.model.js";

dotenv.config();

const B = process.env.API_BASE || "http://127.0.0.1:5055";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${label}${extra ? "  " + extra : ""}`); }
  else { fail++; console.log(`  FAIL  ${label}${extra ? "  " + extra : ""}`); }
};

async function call(p, { method = "GET", token, body } = {}) {
  const res = await fetch(B + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  console.log("\nCUSTOMER: BROWSE, ADD TO CART, CHECK OUT, PAY\n");

  // ── what is even buyable? ────────────────────────────────────────────────
  const total = await Product.countDocuments();
  const live = await Product.countDocuments({ isAvailable: true, isActive: true, stock: { $gt: 0 } });
  const withShop = await Product.countDocuments({
    isAvailable: true, isActive: true, stock: { $gt: 0 }, shop: { $ne: null },
  });
  console.log(`  products: ${total} total, ${live} in stock, ${withShop} with a shop attached\n`);

  const phone = "9876500077";
  await User.deleteOne({ phone });
  const user = await User.create({
    name: "Cart test user",
    phone,
    address: {
      fullAddress: "Near BSNL office, Kohima, Nagaland",
      town: "Kohima", district: "Kohima", state: "NL", pincode: "797001",
    },
    location: { type: "Point", coordinates: [94.1086, 25.6751] },
  });

  const login = await call("/api/user/login", { method: "POST", body: { phone } });
  ok("customer signs in", login.status === 200 && Boolean(login.json.token), login.json?.message);
  const token = login.json.token;
  if (!token) { console.log("\n  cannot continue without a token\n"); process.exit(1); }

  // ── browse ───────────────────────────────────────────────────────────────
  console.log("browse");
  const listing = await call("/api/user/product/all?page=1", { token });
  const items = listing.data?.products || listing.json?.products || [];
  ok("home listing returns products", items.length > 0, `${items.length} shown`);

  if (!items.length) {
    console.log("\n  nothing to buy - the rest of the flow cannot be tested\n");
    await User.deleteOne({ phone });
    await mongoose.disconnect();
    process.exit(1);
  }

  const p = items[0];
  console.log(`  first product: ${p.productName}  ₹${p.price}  shop=${p.shop?.shopName ?? "NONE"}`);

  // ── cart ─────────────────────────────────────────────────────────────────
  console.log("\nadd to cart");
  await Cart.deleteMany({ user: user._id });

  const added = await call("/api/cart/add", {
    method: "POST", token, body: { productId: p._id, quantity: 2 },
  });
  ok("add to cart accepted", added.status === 200 || added.status === 201, added.json?.message);

  const cart = await call("/api/cart", { token });
  const c = cart.data?.cart;
  ok("cart comes back with the item", (c?.items?.length ?? 0) > 0,
     `${c?.items?.length ?? 0} line(s)`);
  ok("quantity is right", c?.items?.[0]?.quantity === 2, `qty ${c?.items?.[0]?.quantity}`);

  // This is what the app's CartStore reads to show the floating cart.
  const hasProductId = Boolean(c?.items?.[0]?.product?._id);
  ok("each line carries the product it points at", hasProductId,
     hasProductId ? c.items[0].product.productName : "product NOT populated");

  ok("price is on the line", typeof c?.items?.[0]?.price === "number", `₹${c?.items?.[0]?.price}`);

  // ── checkout ─────────────────────────────────────────────────────────────
  console.log("\ncheckout");
  const summary = await call("/api/order/check-out", { method: "POST", token, body: {} });
  ok("checkout summary loads", summary.status === 200, summary.json?.message);

  const s = summary.data?.checkout ?? summary.json?.checkout;
  ok("it prices the order", typeof s?.totalAmount === "number",
     s ? `items ₹${s.subtotal} + delivery ₹${s.deliveryFee} + fee ₹${s.platformFee} = ₹${s.totalAmount}` : "");
  ok("it names the shop", Boolean(s?.shop?.shopName), s?.shop?.shopName);
  ok("it has a delivery address", Boolean(s?.deliveryAddress));

  // ── pay ──────────────────────────────────────────────────────────────────
  console.log("\npayment");
  const created = await call("/api/order/create", { method: "POST", token, body: {} });
  ok("order created", created.status === 200 || created.status === 201, created.json?.message);

  const mode = created.data?.mode ?? created.json?.mode;
  console.log(`  payment mode: ${mode ?? "(none)"}`);

  if (mode === "demo") {
    const settled = await call("/api/order/demo-pay", {
      method: "POST", token, body: { method: "Google Pay" },
    });
    ok("demo payment settles", settled.status === 200, settled.json?.message);
    ok("an order comes back", Boolean(settled.data?.order?.orderId),
       settled.data?.order?.orderId);
  } else {
    ok("real gateway returned keys", Boolean(created.data?.key && created.data?.razorpayOrderId),
       "DEMO_PAYMENT is off, so this needs live Razorpay keys");
  }

  const orders = await call("/api/order/my-orders", { token });
  const mine = orders.data?.orders || orders.json?.orders || [];
  ok("it shows in my orders", mine.length > 0, `${mine.length} order(s)`);

  console.log("\ncleanup");
  await Order.deleteMany({ user: user._id });
  await Cart.deleteMany({ user: user._id });
  await User.deleteOne({ phone });
  console.log("  removed");

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\nsuite crashed:", e.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
