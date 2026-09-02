package com.sukobin.core.net

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.Response
import java.io.IOException

sealed class ApiResult<out T> {
    data class Ok<T>(val value: T) : ApiResult<T>()
    data class Err(val message: String, val code: Int = 0, val body: JsonObject? = null) :
        ApiResult<Nothing>()

    val isOk: Boolean get() = this is Ok
    fun getOrNull(): T? = (this as? Ok)?.value
    fun errorOrNull(): String? = (this as? Err)?.message
}

private val gson = Gson()

suspend fun apiCall(block: suspend SukobinApi.() -> Response<JsonObject>): ApiResult<JsonObject> =
    withContext(Dispatchers.IO) {
        try {
            val response = ApiClient.api.block()
            val body = response.body() ?: runCatching {
                gson.fromJson(response.errorBody()?.string(), JsonObject::class.java)
            }.getOrNull()

            val message = body?.get("message")?.takeIf { !it.isJsonNull }?.asString

            if (!response.isSuccessful) {
                return@withContext ApiResult.Err(
                    message ?: "Request failed (${response.code()})",
                    response.code(),
                    body
                )
            }

            if (body == null) return@withContext ApiResult.Err("Empty response")

            val success = body.get("success")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: true
            if (!success) {
                return@withContext ApiResult.Err(message ?: "Request failed", response.code(), body)
            }

            ApiResult.Ok(body)
        } catch (e: IOException) {
            ApiResult.Err("No internet connection")
        } catch (e: Exception) {
            ApiResult.Err(e.message ?: "Something went wrong")
        }
    }

private fun JsonObject.lookup(key: String): JsonElement? {
    get(key)?.takeIf { it !is JsonNull }?.let { return it }
    val data = get("data")
    if (data is JsonObject) data.get(key)?.takeIf { it !is JsonNull }?.let { return it }
    return null
}

fun JsonObject.str(key: String): String? =
    lookup(key)?.takeIf { it.isJsonPrimitive }?.asString

fun JsonObject.bool(key: String, default: Boolean = false): Boolean =
    lookup(key)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: default

fun JsonObject.num(key: String, default: Double = 0.0): Double =
    lookup(key)?.takeIf { it.isJsonPrimitive }?.asDouble ?: default

fun JsonObject.int(key: String, default: Int = 0): Int =
    lookup(key)?.takeIf { it.isJsonPrimitive }?.asInt ?: default

fun JsonObject.obj(key: String): JsonObject? = lookup(key) as? JsonObject

fun JsonObject.arr(key: String): JsonArray? = lookup(key) as? JsonArray

inline fun <reified T> JsonObject.decode(key: String): T? {
    val el = obj(key) ?: return null
    return runCatching { com.google.gson.Gson().fromJson(el, T::class.java) }.getOrNull()
}

inline fun <reified T> JsonObject.decodeList(key: String): List<T> {
    val el = arr(key) ?: return emptyList()
    val type = object : TypeToken<List<T>>() {}.type
    return runCatching { com.google.gson.Gson().fromJson<List<T>>(el, type) }.getOrNull()
        ?: emptyList()
}

inline fun <reified T> JsonObject.decodeRoot(): T? =
    runCatching {
        val target = (get("data") as? JsonObject) ?: this
        com.google.gson.Gson().fromJson(target, T::class.java)
    }.getOrNull()

fun JsonObject.stringList(key: String): List<String> =
    arr(key)?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList()

fun jsonOf(vararg pairs: Pair<String, Any?>): JsonObject {
    val o = JsonObject()
    for ((k, v) in pairs) {
        when (v) {
            null -> o.add(k, JsonNull.INSTANCE)
            is String -> o.addProperty(k, v)
            is Number -> o.addProperty(k, v)
            is Boolean -> o.addProperty(k, v)
            is JsonElement -> o.add(k, v)
            else -> o.add(k, gson.toJsonTree(v))
        }
    }
    return o
}

fun jsonArrayOf(vararg values: Any?): JsonArray {
    val a = JsonArray()
    for (v in values) {
        when (v) {
            null -> a.add(JsonNull.INSTANCE)
            is String -> a.add(v)
            is Number -> a.add(v)
            is Boolean -> a.add(v)
            is JsonElement -> a.add(v)
            else -> a.add(gson.toJsonTree(v))
        }
    }
    return a
}
