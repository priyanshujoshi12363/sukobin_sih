package com.sukobin.core.net

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Multipart
import retrofit2.http.Part
import retrofit2.http.Query
import okhttp3.MultipartBody
import okhttp3.RequestBody

interface SukobinApi {

    @POST("api/user/registration")
    suspend fun userRegister(@Body body: JsonObject): Response<JsonObject>

    @POST("api/user/complete-registration")
    suspend fun userCompleteRegistration(@Body body: JsonObject): Response<JsonObject>

    @POST("api/user/login")
    suspend fun userLogin(@Body body: JsonObject): Response<JsonObject>

    @POST("api/user/verify")
    suspend fun userVerify(@Body body: JsonObject): Response<JsonObject>

    @POST("api/user/notify")
    suspend fun userSavePushToken(@Body body: JsonObject): Response<JsonObject>

    @GET("api/user/product/categories")
    suspend fun categories(): Response<JsonObject>

    @GET("api/user/product/all")
    suspend fun allProducts(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10
    ): Response<JsonObject>

    @GET("api/user/product/search")
    suspend fun searchProducts(@Query("q") query: String): Response<JsonObject>

    @GET("api/user/product/category/{category}")
    suspend fun productsByCategory(
        @Path("category") category: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10
    ): Response<JsonObject>

    @GET("api/user/product/shop/{shopId}")
    suspend fun productsByShop(@Path("shopId") shopId: String): Response<JsonObject>

    @GET("api/user/product/{id}")
    suspend fun product(@Path("id") id: String): Response<JsonObject>

    @GET("api/cart")
    suspend fun cart(): Response<JsonObject>

    @POST("api/cart/add")
    suspend fun cartAdd(@Body body: JsonObject): Response<JsonObject>

    @PUT("api/cart/update/{productId}")
    suspend fun cartUpdate(
        @Path("productId") productId: String,
        @Body body: JsonObject
    ): Response<JsonObject>

    @DELETE("api/cart/remove/{productId}")
    suspend fun cartRemove(@Path("productId") productId: String): Response<JsonObject>

    @DELETE("api/cart/clear")
    suspend fun cartClear(): Response<JsonObject>

    @GET("api/cart/summary")
    suspend fun cartSummary(): Response<JsonObject>

    @POST("api/order/check-out")
    suspend fun checkoutSummary(@Body body: JsonObject): Response<JsonObject>

    @POST("api/order/create")
    suspend fun createOrder(@Body body: JsonObject): Response<JsonObject>

    @POST("api/order/demo-pay")
    suspend fun settleDemoPayment(@Body body: JsonObject): Response<JsonObject>

    @POST("api/order/verify")
    suspend fun verifyOrderPayment(@Body body: JsonObject): Response<JsonObject>

    @POST("api/order/edit-address")
    suspend fun editOrderAddress(@Body body: JsonObject): Response<JsonObject>

    @GET("api/order/my-orders")
    suspend fun myOrders(): Response<JsonObject>

    @GET("api/order/history")
    suspend fun orderHistory(): Response<JsonObject>

    @GET("api/order/{id}")
    suspend fun order(@Path("id") id: String): Response<JsonObject>

    @PATCH("api/order/{id}/cancel")
    suspend fun cancelOrder(@Path("id") id: String): Response<JsonObject>

    @POST("api/parcel/quote")
    suspend fun parcelQuote(@Body body: JsonObject): Response<JsonObject>

    @POST("api/parcel/create")
    suspend fun parcelCreate(@Body body: JsonObject): Response<JsonObject>

    @GET("api/parcel/my-parcels")
    suspend fun myParcels(): Response<JsonObject>

    @GET("api/parcel/{id}")
    suspend fun parcel(@Path("id") id: String): Response<JsonObject>

    @PATCH("api/parcel/{id}/cancel")
    suspend fun cancelParcel(@Path("id") id: String): Response<JsonObject>

    @POST("api/partner/send-otp")
    suspend fun partnerSendOtp(@Body body: JsonObject): Response<JsonObject>

    @POST("api/partner/verify-vehicle")
    suspend fun partnerVerifyVehicle(@Body body: JsonObject): Response<JsonObject>

    @POST("api/partner/register")
    suspend fun partnerRegister(@Body body: JsonObject): Response<JsonObject>

    @POST("api/partner/login")
    suspend fun partnerLogin(@Body body: JsonObject): Response<JsonObject>

    @POST("api/partner/notify")
    suspend fun partnerSavePushToken(@Body body: JsonObject): Response<JsonObject>

    @GET("api/partner/me")
    suspend fun partnerMe(): Response<JsonObject>

    @PATCH("api/partner/online")
    suspend fun partnerSetOnline(@Body body: JsonObject): Response<JsonObject>

    @GET("api/partner/places")
    suspend fun partnerPlaces(@Query("q") query: String): Response<JsonObject>

    @POST("api/partner/route/match")
    suspend fun partnerMatchRoute(@Body body: JsonObject): Response<JsonObject>

    @POST("api/partner/trip/claim")
    suspend fun partnerClaim(@Body body: JsonObject): Response<JsonObject>

    @GET("api/partner/trip/active")
    suspend fun partnerActiveTrip(): Response<JsonObject>

    @POST("api/partner/trip/picked")
    suspend fun partnerMarkPicked(@Body body: JsonObject): Response<JsonObject>

    @POST("api/partner/trip/deliver")
    suspend fun partnerDeliver(@Body body: JsonObject): Response<JsonObject>

    @PATCH("api/partner/location")
    suspend fun partnerUpdateLocation(@Body body: JsonObject): Response<JsonObject>

    @GET("api/partner/stats")
    suspend fun partnerStats(): Response<JsonObject>

    @GET("api/partner/history")
    suspend fun partnerHistory(@Query("page") page: Int = 1): Response<JsonObject>

    @GET("api/partner/road-conditions")
    suspend fun partnerRoadConditions(
        @Query("lng") lng: Double? = null,
        @Query("lat") lat: Double? = null
    ): Response<JsonObject>

    @GET("api/partner/where-am-i")
    suspend fun partnerWhereAmI(
        @Query("lng") lng: Double,
        @Query("lat") lat: Double
    ): Response<JsonObject>

    @POST("api/partner/report")
    suspend fun partnerReportHazard(@Body body: JsonObject): Response<JsonObject>

    @POST("api/merchant/register")
    suspend fun merchantRegister(@Body body: JsonObject): Response<JsonObject>

    @POST("api/merchant/login")
    suspend fun merchantLogin(@Body body: JsonObject): Response<JsonObject>

    @POST("api/merchant/notify")
    suspend fun merchantSavePushToken(@Body body: JsonObject): Response<JsonObject>

    @GET("api/merchant/getme")
    suspend fun merchantMe(): Response<JsonObject>


    @GET("api/merchant/verify")
    suspend fun merchantVerify(): Response<JsonObject>

    @GET("api/merchant/stats")
    suspend fun merchantStats(): Response<JsonObject>

    @GET("api/merchant/orders")
    suspend fun merchantOrders(): Response<JsonObject>

    @PATCH("api/merchant/orders/{id}/status")
    suspend fun merchantUpdateOrderStatus(
        @Path("id") id: String,
        @Body body: JsonObject
    ): Response<JsonObject>

    @GET("api/shop/get")
    suspend fun myShops(): Response<JsonObject>

    @GET("api/product/my-products")
    suspend fun myProducts(): Response<JsonObject>

    @PATCH("api/product/toggle/{id}")
    suspend fun toggleProduct(@Path("id") id: String): Response<JsonObject>

    @GET("api/merchant/orders")
    suspend fun merchantOrdersFiltered(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<JsonObject>

    @GET("api/merchant/orders/{id}")
    suspend fun merchantOrderDetail(@Path("id") id: String): Response<JsonObject>

    @GET("api/product/search")
    suspend fun searchMyProducts(@Query("q") query: String): Response<JsonObject>

    @GET("api/product/{id}")
    suspend fun productDetail(@Path("id") id: String): Response<JsonObject>

    @DELETE("api/product/delete/{id}")
    suspend fun deleteProduct(@Path("id") id: String): Response<JsonObject>

    @PATCH("api/product/toggle-bulk")
    suspend fun bulkToggleProducts(@Body body: JsonObject): Response<JsonObject>

    // Products and shops carry images, so these go up as multipart rather than
    // JSON. The server reads the files under productImages / shopLogo.
    @Multipart
    @POST("api/product/")
    suspend fun createProduct(
        @Part("productName") productName: RequestBody,
        @Part("description") description: RequestBody,
        @Part("category") category: RequestBody,
        @Part("price") price: RequestBody,
        @Part("stock") stock: RequestBody,
        @Part images: List<MultipartBody.Part>
    ): Response<JsonObject>

    @Multipart
    @PUT("api/product/edit/{id}")
    suspend fun editProduct(
        @Path("id") id: String,
        @Part("productName") productName: RequestBody,
        @Part("description") description: RequestBody,
        @Part("category") category: RequestBody,
        @Part("price") price: RequestBody,
        @Part("stock") stock: RequestBody,
        @Part images: List<MultipartBody.Part>
    ): Response<JsonObject>

    @Multipart
    @POST("api/shop/create")
    suspend fun createShop(
        @Part("shopName") shopName: RequestBody,
        @Part("description") description: RequestBody,
        @Part("category") category: RequestBody,
        @Part("phoneNumber") phoneNumber: RequestBody,
        @Part("address") address: RequestBody,
        @Part("coordinates") coordinates: RequestBody,
        @Part logo: MultipartBody.Part?
    ): Response<JsonObject>

    @Multipart
    @PUT("api/shop/edit/{id}")
    suspend fun editShop(
        @Path("id") id: String,
        @Part("shopName") shopName: RequestBody,
        @Part("description") description: RequestBody,
        @Part("category") category: RequestBody,
        @Part("phoneNumber") phoneNumber: RequestBody,
        @Part("address") address: RequestBody,
        @Part logo: MultipartBody.Part?
    ): Response<JsonObject>

    // ── field officer ────────────────────────────────────────────────────────

    @GET("api/officer/directory")
    suspend fun officerDirectory(): Response<JsonObject>

    @POST("api/officer/otp")
    suspend fun officerSendOtp(@Body body: JsonObject): Response<JsonObject>

    @POST("api/officer/login")
    suspend fun officerLogin(@Body body: JsonObject): Response<JsonObject>

    @POST("api/officer/register")
    suspend fun officerRegister(@Body body: JsonObject): Response<JsonObject>

    @POST("api/officer/verify")
    suspend fun officerVerifySession(): Response<JsonObject>

    @PATCH("api/officer/profile")
    suspend fun officerUpdateProfile(@Body body: JsonObject): Response<JsonObject>

    @GET("api/officer/home")
    suspend fun officerHome(@Query("lang") lang: String? = null): Response<JsonObject>

    @GET("api/officer/segments")
    suspend fun officerSegments(@Query("status") status: String? = null): Response<JsonObject>

    @GET("api/officer/nearby")
    suspend fun officerNearby(
        @Query("lng") lng: Double,
        @Query("lat") lat: Double,
        @Query("radiusKm") radiusKm: Int = 25
    ): Response<JsonObject>

    @GET("api/officer/alerts")
    suspend fun officerAlerts(@Query("lang") lang: String? = null): Response<JsonObject>

    @GET("api/officer/forecast")
    suspend fun officerForecast(@Query("min") min: Double = 0.2): Response<JsonObject>

    @GET("api/officer/reports")
    suspend fun officerMyReports(): Response<JsonObject>

    @GET("api/officer/notifications")
    suspend fun officerNotifications(
        @Query("unreadOnly") unreadOnly: Boolean = false,
        @Query("lang") lang: String? = null
    ): Response<JsonObject>

    @POST("api/officer/notifications/read")
    suspend fun officerMarkNotificationsRead(@Body body: JsonObject): Response<JsonObject>

    @POST("api/officer/report")
    suspend fun officerReport(@Body body: JsonObject): Response<JsonObject>

    @POST("api/officer/report/sync")
    suspend fun officerSyncReports(@Body body: JsonObject): Response<JsonObject>

    @GET("api/officer/verify-queue")
    suspend fun officerVerifyQueue(): Response<JsonObject>

    @PATCH("api/officer/incident/{id}/verify")
    suspend fun officerVerifyIncident(
        @Path("id") id: String,
        @Body body: JsonObject
    ): Response<JsonObject>

    @POST("api/officer/segment/{segmentId}/status")
    suspend fun officerSetSegmentStatus(
        @Path("segmentId") segmentId: String,
        @Body body: JsonObject
    ): Response<JsonObject>
}
