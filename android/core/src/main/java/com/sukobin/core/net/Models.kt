package com.sukobin.core.net

import com.google.gson.annotations.SerializedName

data class Address(
    val houseNumber: String? = null,
    val landmark: String? = null,
    val village: String? = null,
    val town: String? = null,
    val district: String? = null,
    val state: String? = null,
    val pincode: String? = null,
    val fullAddress: String? = null
) {
    fun display(): String = fullAddress
        ?: listOfNotNull(houseNumber, landmark, village, town, district, state, pincode)
            .filter { it.isNotBlank() }
            .joinToString(", ")
}

data class GeoPoint(
    val type: String? = "Point",
    val coordinates: List<Double>? = null
) {
    val lng: Double get() = coordinates?.getOrNull(0) ?: 0.0
    val lat: Double get() = coordinates?.getOrNull(1) ?: 0.0
}

data class Shop(
    @SerializedName("_id") val id: String = "",
    val shopName: String? = null,
    val shopLogo: String? = null,
    val phoneNumber: String? = null,
    val address: Address? = null,
    val location: GeoPoint? = null,
    val ratings: Double = 0.0,
    val totalReviews: Int = 0,
    val isOpen: Boolean = true
)

data class Product(
    @SerializedName("_id") val id: String = "",
    val productName: String = "",
    val shop: Shop? = null,
    val description: String? = null,
    val category: String? = null,
    val images: List<String> = emptyList(),
    val price: Double = 0.0,
    val stock: Int = 0,
    val ratings: Double = 0.0,
    val totalReviews: Int = 0,
    val isAvailable: Boolean = true,
    val isActive: Boolean = true
) {
    val thumbnail: String? get() = images.firstOrNull()
    val inStock: Boolean get() = isAvailable && isActive && stock > 0
}

data class CartItem(
    @SerializedName("_id") val id: String? = null,
    val product: Product? = null,
    val quantity: Int = 0,
    val price: Double = 0.0
) {
    val lineTotal: Double get() = price * quantity
}

data class Cart(
    @SerializedName("_id") val id: String? = null,
    val items: List<CartItem> = emptyList(),
    val shop: Shop? = null,
    val subtotal: Double = 0.0,
    val deliveryFee: Double = 0.0,
    val total: Double = 0.0
) {
    val count: Int get() = items.sumOf { it.quantity }
}

data class CartSummary(
    val itemCount: Int = 0,
    val subtotal: Double = 0.0,
    val deliveryFee: Double = 0.0,
    val platformFee: Double = 0.0,
    val total: Double = 0.0
)

data class Order(
    @SerializedName("_id") val id: String = "",
    val orderId: String? = null,
    val shop: Shop? = null,
    val items: List<CartItem> = emptyList(),
    val status: String = "",
    val subtotal: Double = 0.0,
    val deliveryFee: Double = 0.0,
    val platformFee: Double = 0.0,
    val totalAmount: Double = 0.0,
    val paymentMethod: String? = null,
    val paymentStatus: String? = null,
    val deliveryAddress: Address? = null,
    val location: GeoPoint? = null,
    val deliveryOtp: String? = null,
    val customerPhone: String? = null,
    val createdAt: String? = null
)

data class ParcelEndpoint(
    val contactName: String? = null,
    val contactPhone: String? = null,
    val address: Address? = null,
    val location: GeoPoint? = null
)

data class ParcelPackage(
    val type: String? = null,
    val weightKg: Double = 1.0,
    val description: String? = null,
    val photos: List<String> = emptyList()
)

data class Parcel(
    @SerializedName("_id") val id: String = "",
    val parcelId: String? = null,
    val pickup: ParcelEndpoint? = null,
    val drop: ParcelEndpoint? = null,
    @SerializedName("package") val pkg: ParcelPackage? = null,
    val distanceKm: Double = 0.0,
    val deliveryCharge: Double = 0.0,
    val platformFee: Double = 0.0,
    val totalAmount: Double = 0.0,
    val paymentMethod: String? = null,
    val paymentStatus: String? = null,
    val status: String = "",
    val routeDurationMin: Int = 0,
    val createdAt: String? = null
)

data class ParcelQuote(
    val distanceKm: Double = 0.0,
    val deliveryCharge: Double = 0.0,
    val platformFee: Double = 0.0,
    val totalAmount: Double = 0.0,
    val etaMinutes: Int = 0
)

data class Partner(
    @SerializedName("_id") val id: String = "",
    val name: String? = null,
    val phone: String? = null,
    val vehicleNumber: String? = null,
    val vehicleType: String? = null,
    val capacity: Int = 0,
    val isOnline: Boolean = false,
    val currentLocation: GeoPoint? = null
)

data class DeliveryJob(
    val kind: String = "",
    val refId: String = "",
    val type: String? = null,
    val fee: Double = 0.0,
    val weightKg: Double = 0.0,
    val pickup: JobPoint? = null,
    val drop: JobPoint? = null,
    val offRouteKm: Double = 0.0,
    val etaMin: Int = 0,
    val pickupOrder: Int = 0,
    val routePolyline: List<List<Double>>? = null,
    // Set by /trip/active: false means collect it next, true means hand it over.
    val picked: Boolean = false
)

data class JobPoint(
    val coordinates: List<Double>? = null,
    val label: String? = null,
    val phone: String? = null
) {
    val lng: Double get() = coordinates?.getOrNull(0) ?: 0.0
    val lat: Double get() = coordinates?.getOrNull(1) ?: 0.0
}

data class PartnerStats(
    val todayEarnings: Double = 0.0,
    val weekEarnings: Double = 0.0,
    val totalEarnings: Double = 0.0,
    val todayDeliveries: Int = 0,
    val totalDeliveries: Int = 0
)

data class AuthResult(
    val token: String? = null,
    val user: UserProfile? = null,
    val partner: Partner? = null,
    val merchant: Merchant? = null
)

data class UserProfile(
    @SerializedName("_id") val id: String = "",
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val address: Address? = null,
    val location: GeoPoint? = null
)

data class Merchant(
    @SerializedName("_id") val id: String = "",
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val walletBalance: Double = 0.0
)

data class RoadSegmentDto(
    @SerializedName("_id") val id: String = "",
    val segmentId: String = "",
    val name: String = "",
    val corridorCode: String? = null,
    val status: String = "UNKNOWN",
    val statusNote: String? = null,
    val lengthKm: Double = 0.0,
    val terrain: String? = null,
    val districts: List<String> = emptyList(),
    val states: List<String> = emptyList(),
    val lifelineFor: List<String> = emptyList(),
    val isChokepoint: Boolean = false,
    val risk: RiskDto? = null,
    val geometry: LineStringDto? = null
)

data class RiskDto(
    val score: Double = 0.0,
    val level: String = "LOW",
    val drivers: List<RiskDriverDto> = emptyList(),
    val rain24hMm: Double = 0.0,
    val rain72hMm: Double = 0.0
)

data class RiskDriverDto(
    val factor: String? = null,
    val contribution: Double = 0.0,
    val detail: String? = null
)

data class LineStringDto(
    val type: String? = null,
    val coordinates: List<List<Double>>? = null
)

data class IncidentDto(
    @SerializedName("_id") val id: String = "",
    val incidentId: String? = null,
    val clientId: String? = null,
    val type: String = "",
    val severity: String = "",
    val description: String? = null,
    val photos: List<String> = emptyList(),
    val location: GeoPoint? = null,
    val district: String? = null,
    val state: String? = null,
    val segmentId: String? = null,
    val status: String = "REPORTED",
    val capturedAt: String? = null,
    val reporterName: String? = null
)
