package com.sukobin.core.net

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    const val PROD_BASE = "https://sukobin-v2.onrender.com/"
    const val EMULATOR_BASE = "http://10.0.2.2:8000/"

    @Volatile
    private var baseUrl: String = PROD_BASE

    @Volatile
    private var retrofit: Retrofit? = null

    fun useBaseUrl(url: String) {
        if (url != baseUrl) {
            baseUrl = if (url.endsWith("/")) url else "$url/"
            retrofit = null
        }
    }

    private fun build(): Retrofit {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val builder = chain.request().newBuilder()
                    .addHeader("Accept", "application/json")
                Session.token?.takeIf { it.isNotBlank() }?.let {
                    builder.addHeader("Authorization", "Bearer $it")
                }
                chain.proceed(builder.build())
            }
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val api: SukobinApi
        get() {
            val r = retrofit ?: synchronized(this) {
                retrofit ?: build().also { retrofit = it }
            }
            return r.create(SukobinApi::class.java)
        }
}
