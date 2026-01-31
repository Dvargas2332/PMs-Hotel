package com.pms.restaurantpos.data

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient(
  baseUrl: String,
  private val tokenProvider: () -> String?,
) {
  val api: PmsApi = Retrofit.Builder()
    .baseUrl(normalizeBaseUrl(baseUrl))
    .addConverterFactory(GsonConverterFactory.create())
    .client(buildOkHttp())
    .build()
    .create(PmsApi::class.java)

  private fun buildOkHttp(): OkHttpClient {
    val auth = Interceptor { chain ->
      val token = tokenProvider()?.trim().orEmpty()
      val req = if (token.isNotEmpty()) {
        chain.request().newBuilder()
          .addHeader("Authorization", "Bearer $token")
          .build()
      } else {
        chain.request()
      }
      chain.proceed(req)
    }

    val logging = HttpLoggingInterceptor().apply {
      level = HttpLoggingInterceptor.Level.BASIC
    }

    return OkHttpClient.Builder()
      .addInterceptor(auth)
      .addInterceptor(logging)
      .connectTimeout(15, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .writeTimeout(30, TimeUnit.SECONDS)
      .build()
  }
}

fun normalizeBaseUrl(raw: String): String {
  var url = raw.trim()
  if (url.isEmpty()) return url
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "http://$url"
  }
  if (!url.endsWith("/")) url += "/"
  return url
}

