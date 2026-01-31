package com.pms.restaurantpos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.pms.restaurantpos.data.ApiClient
import com.pms.restaurantpos.data.AppPreferences
import com.pms.restaurantpos.data.CloseOrderRequest
import com.pms.restaurantpos.data.RestaurantOrder
import com.pms.restaurantpos.data.RestaurantPaymentsConfig
import com.pms.restaurantpos.data.TotalsInput
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(
  navController: NavHostController,
  prefs: AppPreferences,
  sectionId: String,
  tableId: String,
  tableName: String,
) {
  val scope = rememberCoroutineScope()
  val baseUrl by prefs.baseUrl.collectAsState(initial = null)
  val token by prefs.token.collectAsState(initial = null)

  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }
  var config by remember { mutableStateOf(RestaurantPaymentsConfig()) }
  var order by remember { mutableStateOf<RestaurantOrder?>(null) }
  var payments by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

  fun methods(): List<String> = config.cobros.ifEmpty { listOf("Efectivo", "Tarjeta") }
  fun total(): Double = parseMoney(order?.total)
  fun paid(): Double = methods().sumOf { parseMoney(payments[it]) }

  LaunchedEffect(baseUrl, token, tableId) {
    val url = baseUrl?.trim().orEmpty()
    val t = token?.trim().orEmpty()
    if (url.isEmpty() || t.isEmpty() || tableId.isEmpty()) return@LaunchedEffect

    try {
      loading = true
      error = null
      val client = ApiClient(baseUrl = url, tokenProvider = { t })
      config = client.api.getRestaurantPayments()
      val open = client.api.listOrders(status = "OPEN")
      order = open.firstOrNull { it.tableId == tableId }
      payments = methods().associateWith { "" }
    } catch (e: Exception) {
      error = e.message ?: "No se pudo cargar cobro"
    } finally {
      loading = false
    }
  }

  val total = total()
  val paid = paid()
  val remaining = total - paid
  val change = if (remaining < 0) -remaining else 0.0
  val due = if (remaining > 0) remaining else 0.0

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("Cobrar - Mesa $tableName") },
        navigationIcon = { IconButton(onClick = { navController.popBackStack() }) { Text("←") } },
      )
    },
  ) { padding ->
    Column(
      modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      if (loading) {
        CircularProgressIndicator()
        return@Column
      }

      if (error != null) Text(error!!)
      if (order == null) {
        Text("No hay orden abierta para esta mesa.")
        return@Column
      }

      Text("Total: ${"%.2f".format(total)}")
      Text("Pagado: ${"%.2f".format(paid)}")
      Text("Pendiente: ${"%.2f".format(due)}")
      if (change > 0) Text("Vuelto: ${"%.2f".format(change)}")

      methods().forEach { method ->
        val value = payments[method].orEmpty()
        OutlinedTextField(
          value = value,
          onValueChange = { next -> payments = payments + (method to next); error = null },
          label = { Text(method) },
          singleLine = true,
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          modifier = Modifier.fillMaxWidth(),
        )
      }

      Button(
        enabled = total > 0 && paid >= total,
        onClick = {
          scope.launch {
            val url = baseUrl?.trim().orEmpty()
            val t = token?.trim().orEmpty()
            if (url.isEmpty() || t.isEmpty()) return@launch

            try {
              error = null
              val client = ApiClient(baseUrl = url, tokenProvider = { t })
              val paymentMap = methods()
                .mapNotNull { method ->
                  val amt = parseMoney(payments[method])
                  if (amt > 0) method to amt else null
                }
                .toMap()
              val resp = client.api.chargeOrder(
                CloseOrderRequest(
                  tableId = tableId,
                  payments = paymentMap,
                  totals = TotalsInput(total = total),
                )
              )
              if (resp.ok) {
                navController.navigate(Routes.tables(sectionId)) {
                  popUpTo(Routes.sections) { inclusive = false }
                  launchSingleTop = true
                }
              } else {
                error = "No se pudo completar el cobro"
              }
            } catch (e: Exception) {
              error = e.message ?: "No se pudo completar el cobro"
            }
          }
        },
        contentPadding = PaddingValues(vertical = 14.dp, horizontal = 16.dp),
      ) {
        Text("Cobrar y cerrar")
      }

      Text("Detalle")
      LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(order?.items ?: emptyList()) { it ->
          Text("${it.qty ?: 0} x ${it.name}")
        }
      }
    }
  }
}

private fun parseMoney(raw: String?): Double {
  val v = raw?.trim().orEmpty()
  if (v.isEmpty()) return 0.0
  val cleaned = v
    .replace("₡", "")
    .replace(",", "")
    .replace(" ", "")
  return cleaned.toDoubleOrNull() ?: 0.0
}
