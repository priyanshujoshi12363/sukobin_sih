import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  const port = Number(process.env.EMAIL_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return transporter;
}

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export async function sendMerchantOrderEmail(merchant, order) {
  const t = getTransporter();
  if (!t) {
    console.log("📧 Email skipped — SMTP not configured");
    return { skipped: true };
  }
  if (!merchant?.email) {
    console.log("📧 Email skipped — merchant has no email");
    return { skipped: true };
  }

  const itemRows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${inr(i.totalPrice)}</td>
      </tr>`
    )
    .join("");

  const addr = order.deliveryAddress || {};
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #eaeaea;border-radius:12px;overflow:hidden;">
    <div style="background:#1A3D2B;color:#fff;padding:18px 22px;">
      <h2 style="margin:0;font-size:18px;">🛒 New Order Received</h2>
      <p style="margin:4px 0 0;opacity:.8;font-size:13px;">Order ${order.orderId}</p>
    </div>
    <div style="padding:20px 22px;">
      <p style="margin:0 0 12px;font-size:14px;">You have a new paid order. Please pack it and mark it ready for pickup.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#F0FAF3;">
            <th style="padding:8px 12px;text-align:left;">Item</th>
            <th style="padding:8px 12px;text-align:center;">Qty</th>
            <th style="padding:8px 12px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="margin-top:14px;font-size:14px;">
        <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${inr(order.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Delivery</span><span>${inr(order.deliveryFee)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Platform fee</span><span>${inr(order.platformFee)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;border-top:1px solid #eee;margin-top:6px;padding-top:6px;"><span>Total Paid</span><span>${inr(order.totalAmount)}</span></div>
      </div>
      <div style="margin-top:16px;padding:12px;background:#F0FAF3;border-radius:10px;font-size:13px;">
        <strong>Deliver to:</strong><br/>
        ${addr.fullAddress || ""}<br/>
        ${[addr.village, addr.town, addr.district, addr.state].filter(Boolean).join(", ")} ${addr.pincode || ""}<br/>
        📞 ${order.customerPhone || ""}
      </div>
    </div>
    <div style="padding:14px 22px;background:#fafafa;color:#888;font-size:12px;text-align:center;">Sukobin · Hyperlocal Logistics</div>
  </div>`;

  await t.sendMail({
    from: process.env.EMAIL_FROM || `Sukobin <${process.env.EMAIL_USER}>`,
    to: merchant.email,
    subject: `🛒 New Order ${order.orderId} · ${inr(order.totalAmount)}`,
    html,
  });

  return { sent: true };
}
