export const calculateDeliveryFee = (distanceInKm, orderAmount) => {

  let deliveryFee = 20;
  if (distanceInKm <= 10) {
    deliveryFee += 10;
  } else if (distanceInKm <= 50) {
    deliveryFee += 25;
  } else if (distanceInKm <= 100) {
    deliveryFee += 40;
  } else if (distanceInKm <= 200) {
    deliveryFee += 60;
  } else {
    deliveryFee += 80;
  }

  if (orderAmount >= 500) {

    deliveryFee -= 10;
  }

  if (orderAmount >= 1000) {

    deliveryFee -= 20;
  }

  if (orderAmount >= 2000) {

    deliveryFee -= 30;
  }

  if (deliveryFee < 20) {
    deliveryFee = 20;
  }

  if (deliveryFee > 100) {
    deliveryFee = 100;
  }

  return Math.round(deliveryFee);
};

export const calculateDistance = (
  lat1,
  lon1,
  lat2,
  lon2
) => {

  const toRad = (value) =>
    (value * Math.PI) / 180;

  const R = 6371;

  const dLat = toRad(lat2 - lat1);

  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
};

const TYPE_MULTIPLIER = {
  Documents: 0.9,
  Clothes: 1.0,
  Food: 1.1,
  Electronics: 1.2,
  Medicines: 1.2,
  Other: 1.0,
};

export const calculateParcelCharge = (distanceInKm, weightKg = 1, type = "Other") => {
  const base = 30;

  const d = Math.max(0, distanceInKm || 0);
  let distanceCharge;
  if (d <= 10) {
    distanceCharge = d * 6;
  } else if (d <= 50) {
    distanceCharge = 10 * 6 + (d - 10) * 4;
  } else if (d <= 100) {
    distanceCharge = 10 * 6 + 40 * 4 + (d - 50) * 3;
  } else {
    distanceCharge = 10 * 6 + 40 * 4 + 50 * 3 + (d - 100) * 2;
  }

  const extraKg = Math.max(0, Math.ceil(weightKg || 1) - 1);
  const weightCharge = extraKg * 10;

  const multiplier = TYPE_MULTIPLIER[type] ?? 1.0;

  let charge = (base + distanceCharge + weightCharge) * multiplier;
  charge = Math.round(charge);

  if (charge < 40) charge = 40;

  const platformFee = 5;

  return {
    deliveryCharge: charge,
    platformFee,
    totalAmount: charge + platformFee,
    breakdown: {
      base,
      distanceCharge: Math.round(distanceCharge),
      weightCharge,
      typeMultiplier: multiplier,
    },
  };
};
