import crypto from "crypto";

// Realistic sample data that mirrors a real Bharat Vahan / Surepass RC response.
// Deterministic per plate so the same number always returns the same vehicle.

const VEHICLES = [
  { vc: "MCWG", desc: "M-Cycle/Scooter(2WN)", maker: "HERO MOTOCORP LTD", models: ["SPLENDOR PLUS", "HF DELUXE", "PASSION PRO"], fuel: "PETROL", body: "SOLO" },
  { vc: "MCWG", desc: "Motor Cycle", maker: "BAJAJ AUTO LTD", models: ["PULSAR 150", "PLATINA 100 ES"], fuel: "PETROL", body: "SOLO" },
  { vc: "3WT", desc: "Three Wheeler (Passenger)", maker: "BAJAJ AUTO LTD", models: ["RE COMPACT", "MAXIMA Z"], fuel: "CNG", body: "3 SEATER AUTO" },
  { vc: "LMV", desc: "Motor Car", maker: "MARUTI SUZUKI INDIA LTD", models: ["SWIFT DZIRE VXI", "WAGON R LXI", "ALTO K10 VXI"], fuel: "PETROL", body: "SALOON" },
  { vc: "LMV", desc: "Motor Car", maker: "HYUNDAI MOTOR INDIA LTD", models: ["I20 SPORTZ", "CRETA SX", "GRAND I10 NIOS"], fuel: "PETROL", body: "SALOON" },
  { vc: "LGV", desc: "Light Goods Vehicle", maker: "TATA MOTORS LTD", models: ["ACE GOLD", "ACE HT PLUS"], fuel: "DIESEL", body: "DELIVERY VAN" },
  { vc: "HGV", desc: "Goods Carrier(Truck)", maker: "ASHOK LEYLAND LTD", models: ["DOST PLUS", "BADA DOST i3"], fuel: "DIESEL", body: "OPEN BODY TRUCK" },
];

const OWNERS = ["RAMESH CHANDRA", "BHUVAN SINGH NEGI", "MOHAN LAL SAH", "SURESH CHANDRA TAMTA", "KIRAN PANDEY", "DEEPAK BISHT", "POOJA RAWAT", "HARISH JOSHI"];
const COLORS = ["SILVER", "WHITE", "GREY", "BLACK", "BLUE", "RED", "BROWN"];
const RTOS = ["RTO HALDWANI", "RTO NAINITAL", "RTO ALMORA", "RTO RANIKHET"];
const INSURERS = ["ICICI LOMBARD GENERAL INSURANCE", "HDFC ERGO GENERAL INSURANCE", "BAJAJ ALLIANZ GENERAL INSURANCE", "THE NEW INDIA ASSURANCE CO LTD"];

const seed = (s, salt = 0) => parseInt(crypto.createHash("md5").update(`${s}:${salt}`).digest("hex").slice(0, 8), 16);
const pick = (arr, n) => arr[n % arr.length];
const pad = (n) => String(n).padStart(2, "0");

// Mimics provider response: { success, status_code, message, data: {...} }
export function getMockVahanResponse(registrationNumber) {
  const reg = String(registrationNumber || "").toUpperCase().replace(/\s+/g, "");
  const h = seed(reg);
  const v = pick(VEHICLES, h);
  const model = pick(v.models, seed(reg, 1));
  const owner = pick(OWNERS, seed(reg, 2));
  const color = pick(COLORS, seed(reg, 3));
  const rto = pick(RTOS, seed(reg, 4));

  const regYear = 2017 + (h % 8);
  const month = 1 + (seed(reg, 5) % 12);
  const day = 1 + (seed(reg, 6) % 27);
  const regDate = `${regYear}-${pad(month)}-${pad(day)}`;
  const insUpto = `${new Date().getFullYear() + 1}-${pad(month)}-${pad(day)}`;
  const fitUpto = `${regYear + 15}-${pad(month)}-${pad(day)}`;
  const financed = h % 2 === 0;

  return {
    success: true,
    status_code: 200,
    message: "Vehicle details fetched successfully (MOCK VAHAN)",
    data: {
      rc_number: reg,
      registration_number: reg,
      registration_date: regDate,
      owner_name: owner,
      father_name: "",
      present_address: `${rto.replace("RTO ", "")}, UTTARAKHAND`,
      vehicle_category: v.vc,
      vehicle_class: v.vc,
      vehicle_class_description: v.desc,
      maker_description: v.maker,
      maker_model: model,
      body_type: v.body,
      fuel_type: v.fuel,
      color,
      norms_type: "BHARAT STAGE VI",
      manufacturing_date: `${regYear}-${pad(month)}`,
      registered_at: rto,
      vehicle_chasi_number: `MA3${crypto.createHash("md5").update(reg).digest("hex").slice(0, 14).toUpperCase()}`,
      vehicle_engine_number: crypto.createHash("md5").update(reg + "eng").digest("hex").slice(0, 12).toUpperCase(),
      financed,
      financer: financed ? "HDFC BANK LTD" : "",
      insurance_company: pick(INSURERS, seed(reg, 7)),
      insurance_upto: insUpto,
      fit_up_to: fitUpto,
      status: "ACTIVE",
      rc_status: "ACTIVE",
    },
  };
}
