package com.sukobin.app.data

import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Cart
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.jsonOf
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class CartState(
    val quantities: Map<String, Int> = emptyMap(),
    val itemCount: Int = 0,
    val subtotal: Double = 0.0
)

object CartStore {

    private val _state = MutableStateFlow(CartState())
    val state: StateFlow<CartState> = _state

    fun quantityOf(productId: String): Int = _state.value.quantities[productId] ?: 0

    suspend fun refresh(): ApiResult<JsonObject> {
        val result = apiCall { cart() }
        if (result is ApiResult.Ok) apply(result.value)
        return result
    }

    suspend fun add(productId: String, quantity: Int = 1): ApiResult<JsonObject> {
        val result = apiCall {
            cartAdd(jsonOf("productId" to productId, "quantity" to quantity))
        }
        if (result is ApiResult.Ok) apply(result.value) else refresh()
        return result
    }

    suspend fun setQuantity(productId: String, quantity: Int): ApiResult<JsonObject> {
        if (quantity <= 0) return remove(productId)

        val result = apiCall {
            cartUpdate(productId, jsonOf("quantity" to quantity))
        }
        if (result is ApiResult.Ok) apply(result.value) else refresh()
        return result
    }

    suspend fun remove(productId: String): ApiResult<JsonObject> {
        val result = apiCall { cartRemove(productId) }
        if (result is ApiResult.Ok) apply(result.value) else refresh()
        return result
    }

    suspend fun clear(): ApiResult<JsonObject> {
        val result = apiCall { cartClear() }
        if (result is ApiResult.Ok) _state.value = CartState()
        return result
    }

    fun reset() {
        _state.value = CartState()
    }

    private fun apply(body: JsonObject) {
        val cart = body.decode<Cart>("cart") ?: run {
            _state.value = CartState()
            return
        }

        val quantities = cart.items
            .mapNotNull { item -> item.product?.id?.let { it to item.quantity } }
            .toMap()

        _state.value = CartState(
            quantities = quantities,
            itemCount = cart.items.sumOf { it.quantity },
            subtotal = cart.items.sumOf { it.price * it.quantity }
        )
    }
}
