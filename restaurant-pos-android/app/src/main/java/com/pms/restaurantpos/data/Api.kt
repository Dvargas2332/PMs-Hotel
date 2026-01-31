package com.pms.restaurantpos.data

import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

data class LauncherLoginRequest(
  val username: String,
  val password: String,
)

data class LauncherLoginResponse(
  val token: String,
  val launcher: LauncherInfo,
)

data class LauncherInfo(
  val id: String,
  val username: String,
  val hotelId: String,
  val hotelName: String? = null,
  val roleId: String? = null,
  val permissions: List<String> = emptyList(),
  val allowedModules: List<String> = emptyList(),
)

data class ActiveMenu(
  val id: String,
  val name: String,
)

data class RestaurantTable(
  val id: String,
  val sectionId: String,
  val name: String,
  val seats: Int = 2,
  val x: Float? = null,
  val y: Float? = null,
)

data class RestaurantSection(
  val id: String,
  val name: String,
  val tables: List<RestaurantTable> = emptyList(),
  val activeMenu: ActiveMenu? = null,
)

data class MenuItem(
  val id: String,
  val itemId: String? = null,
  val name: String? = null,
  val category: String? = null,
  @SerializedName("imageUrl") val imageUrl: String? = null,
  @SerializedName("priceIncludesTaxesAndService") val priceIncludesTaxesAndService: Boolean? = null,
  val price: String = "0",
)

data class OrderItemInput(
  val id: String,
  val name: String,
  val category: String? = null,
  val price: Double,
  val qty: Int,
)

data class CreateOrUpdateOrderRequest(
  val sectionId: String? = null,
  val tableId: String,
  val items: List<OrderItemInput>,
  val note: String? = null,
  val covers: Int? = null,
  val serviceType: String? = null,
  val roomId: String? = null,
)

data class RestaurantOrderItem(
  val id: String,
  val itemId: String,
  val name: String,
  val category: String? = null,
  val price: String? = null,
  val qty: Int? = null,
  val status: String? = null,
  val area: String? = null,
)

data class RestaurantOrder(
  val id: String,
  val hotelId: String? = null,
  val sectionId: String? = null,
  val tableId: String,
  val status: String? = null,
  val subtotal: String? = null,
  val tip10: String? = null,
  val tax: String? = null,
  val total: String? = null,
  val items: List<RestaurantOrderItem> = emptyList(),
)

data class RestaurantPaymentsConfig(
  val monedaBase: String? = null,
  val monedaSec: String? = null,
  val tipoCambio: Double? = null,
  val cobros: List<String> = emptyList(),
  val cargoHabitacion: Boolean? = null,
)

data class RestaurantStats(
  val systemTotal: Double = 0.0,
  val openOrders: Int = 0,
  val salesCount: Int = 0,
  val openOrderValue: Double = 0.0,
  val lastCloseAt: String? = null,
  val byMethod: Map<String, Double> = emptyMap(),
)

data class TotalsInput(
  val total: Double? = null,
  val service: Double? = null,
  val reported: Double? = null,
  val system: Double? = null,
)

data class CloseOrderRequest(
  val tableId: String,
  val payments: Map<String, Double>? = null,
  val totals: TotalsInput? = null,
  val note: String? = null,
  val serviceType: String? = null,
  val roomId: String? = null,
)

data class CloseOrderResponse(
  val ok: Boolean,
  val order: RestaurantOrder? = null,
)

data class CloseShiftRequest(
  val totals: TotalsInput? = null,
  val payments: Map<String, Double>? = null,
  val note: String? = null,
  val breakdown: Map<String, Any?>? = null,
)

data class CloseShiftResponse(
  val ok: Boolean,
)

interface PmsApi {
  @POST("launcher/login")
  suspend fun launcherLogin(@Body body: LauncherLoginRequest): LauncherLoginResponse

  @GET("restaurant/sections")
  suspend fun listSections(): List<RestaurantSection>

  @GET("restaurant/menu")
  suspend fun listMenu(@Query("section") sectionId: String): List<MenuItem>

  @GET("restaurant/orders")
  suspend fun listOrders(@Query("status") status: String = "OPEN"): List<RestaurantOrder>

  @POST("restaurant/order")
  suspend fun createOrUpdateOrder(@Body body: CreateOrUpdateOrderRequest): RestaurantOrder

  @POST("restaurant/order/charge")
  suspend fun chargeOrder(@Body body: CloseOrderRequest): CloseOrderResponse

  @GET("restaurant/stats")
  suspend fun getRestaurantStats(): RestaurantStats

  @GET("restaurant/payments")
  suspend fun getRestaurantPayments(): RestaurantPaymentsConfig

  @POST("restaurant/close")
  suspend fun closeShift(@Body body: CloseShiftRequest): CloseShiftResponse
}
