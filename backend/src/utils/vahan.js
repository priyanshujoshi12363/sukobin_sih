import dotenv from "dotenv";
import { getMockVahanResponse } from "./mockVahan.js";

dotenv.config();

// Map an RC "vehicle class" string to our category + parcel capacity
export function classifyVehicle(vehicleClass = "") {
  const c = String(vehicleClass).toLowerCase();
  if (/(motor ?cycle|m-?cycle|scooter|moped|two wheeler)/.test(c)) return { vehicleType: "bike", capacity: 1 };
  if (/(auto|three wheeler|e-?rickshaw|tempo)/.test(c)) return { vehicleType: "auto", capacity: 3 };
  if (/(truck|heavy goods|hgv|lorry|trailer)/.test(c)) return { vehicleType: "truck", capacity: 10 };
  if (/(pickup|light goods|lgv|mini truck|goods carrier|delivery van)/.test(c)) return { vehicleType: "pickup", capacity: 8 };
  if (/(lmv|motor car|taxi|maxi cab|cab|car|jeep|suv)/.test(c)) return { vehicleType: "car", capacity: 5 };
  return { vehicleType: "car", capacity: 5 };
}

// Normalise a provider response (Surepass / APISetu style) into our shape
function mapProviderResponse(d, reg) {
  const vehicleClass = d.vehicle_class_description || d.vehicle_class || d.vehicleClass || "";
  const maker = d.maker_description || d.manufacturer || d.maker || d.maker_model || "";
  const model = d.maker_model || d.model || d.vehicle_model || "";
  const { vehicleType, capacity } = classifyVehicle(vehicleClass);
  return {
    ownerName: d.owner_name || d.ownerName || "",
    registrationNumber: d.registration_number || d.rc_number || reg,
    registrationDate: d.registration_date || d.reg_date || "",
    vehicleClass,
    maker,
    model,
    fuelType: d.fuel_type || d.fuelType || "",
    color: d.color || d.colour || "",
    rcStatus: d.rc_status || d.status || "ACTIVE",
    insuranceValidUpto: d.insurance_upto || d.insurance_validity || "",
    fitnessValidUpto: d.fit_up_to || d.fitness_upto || "",
    source: "vahan",
    verified: true,
    vehicleType,
    capacity,
  };
}

export async function lookupVehicle(number) {
  const reg = String(number || "").toUpperCase().replace(/\s+/g, "");
  if (!reg || reg.length < 6) throw new Error("Enter a valid vehicle number");

  const url = process.env.VAHAN_API_URL;
  const key = process.env.VAHAN_API_KEY;

  // Real Bharat Vahan API when configured
  if (url && key) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ id_number: reg }),
      });
      const json = await res.json();
      const d = json?.data || json?.result || json;
      if (d && (d.maker_description || d.vehicle_class || d.maker || d.registration_number)) {
        return mapProviderResponse(d, reg);
      }
    } catch (e) {
      console.error("Vahan lookup failed, using mock:", e.message);
    }
  }

  // Mock that mirrors the real Vahan response shape → same mapper path
  const mock = getMockVahanResponse(reg);
  const mapped = mapProviderResponse(mock.data, reg);
  mapped.source = "mock";
  mapped.verified = false;
  return mapped;
}
