// Normalize the two delivery sources (Order, Parcel) into ONE shape — a DeliveryJob —
// so the matching engine runs identical geometry on both.
//
// DeliveryJob = {
//   kind, refId, type, fee, weightKg,
//   pickup: { coordinates:[lng,lat], label, phone },
//   drop:   { coordinates:[lng,lat], label, phone },
// }

const coordsOf = (point) =>
  Array.isArray(point?.coordinates) && point.coordinates.length === 2
    ? point.coordinates
    : null;

// Parcel → job. Pickup/drop live on the parcel itself.
export function jobFromParcel(p) {
  const pickup = coordsOf(p.pickup?.location);
  const drop = coordsOf(p.drop?.location);
  if (!pickup || !drop) return null;
  return {
    kind: "parcel",
    refId: p.parcelId,
    type: p.package?.type || "Other",
    weightKg: p.package?.weightKg || 1,
    fee: p.deliveryCharge || 0, // ◀ only the delivery fee is ever exposed
    pickup: {
      coordinates: pickup,
      label: p.pickup?.address?.fullAddress || "Pickup point",
      phone: p.pickup?.contactPhone || "",
    },
    drop: {
      coordinates: drop,
      label: p.drop?.address?.fullAddress || "Drop point",
      phone: p.drop?.contactPhone || "",
    },
    routePolyline: p.routePolyline || null,
    routeKm: p.distanceKm || 0,
    durationMin: p.routeDurationMin || 0,
    _deliveryOtp: p.deliveryOtp || null,
  };
}

// Order → job. PICKUP is the SHOP it came from (must be populated); DROP is the customer.
export function jobFromOrder(o) {
  const shop = o.shop && typeof o.shop === "object" ? o.shop : null;
  const pickup = coordsOf(shop?.location);
  const drop = coordsOf(o.location);
  if (!pickup || !drop) return null; // skip orders whose shop has no geo
  return {
    kind: "order",
    refId: o.orderId,
    type: "Order",
    weightKg: 1, // an order takes one slot in the vehicle
    fee: o.deliveryFee || 0, // ◀ only the delivery fee — never subtotal/goods value
    pickup: {
      coordinates: pickup,
      label: shop?.shopName || shop?.address?.fullAddress || "Shop",
      phone: shop?.phoneNumber || "",
    },
    drop: {
      coordinates: drop,
      label: o.deliveryAddress?.fullAddress || "Customer address",
      phone: o.customerPhone || "",
    },
    routePolyline: o.routePolyline || null,
    routeKm: o.routeDistanceKm || 0,
    durationMin: o.routeDurationMin || 0,
    _deliveryOtp: o.deliveryOtp || null,
  };
}
