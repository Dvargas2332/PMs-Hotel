package com.pms.restaurantpos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import com.pms.restaurantpos.data.CloseShiftRequest
import com.pms.restaurantpos.data.RestaurantPaymentsConfig
import com.pms.restaurantpos.data.RestaurantStats
import com.pms.restaurantpos.data.TotalsInput
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CloseShiftScreen(navController: NavHostController, prefs: AppPreferences) {
  val scope = rememberCoroutineScope()

  val baseUrl by prefs.baseUrl.collectAsState(initial = null)
  val token by prefs.token.collectAsState(initial = null)
  val openingCash by prefs.openingCash.collectAsState(initial = null)

  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }
  var stats by remember { mutableStateOf<RestaurantStats?>(null) }
  var config by remember { mutableStateOf(RestaurantPaymentsConfig()) }
  var reported by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

  fun methods(): List<String> {
    val fromConfig = config.cobros
    val fromStats = stats?.byMethod?.keys?.toList().orEmpty()
    return (fromConfig + fromStats).distinct()
      .ifEmpty { listOf("Efectivo", "Tarjeta") }
  }

  fun reportedTotal(): Double = methods().sumOf { parseMoney(reported[it]) }

  LaunchedEffect(baseUrl, token) {
    val url = baseUrl?.trim().orEmpty()
    val t = token?.trim().orEmpty()
    if (url.isEmpty() || t.isEmpty()) return@LaunchedEffect

    try {
      loading = true
      error = null
      val client = ApiClient(baseUrl = url, tokenProvider = { t })
      config = client.api.getRestaurantPayments()
      stats = client.api.getRestaurantStats()

      val base = methods().associateWith { method ->
        val system = stats?.byMethod?.get(method) ?: 0.0
        if (system > 0) "%.2f".format(system) else ""
      }
      reported = base
    } catch (e: Exception) {
      error = e.message ?: "No se pudo cargar cierre"
    } finally {
      loading = false
    }
  }

  val systemTotal = stats?.systemTotal ?: 0.0
  val reportedTotal = reportedTotal()
  val diff = reportedTotal - systemTotal

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("Cierre de caja") },
        navigationIcon = { IconButton(onClick = { navController.popBackStack() }) { Text("←") } },
        actions = {
          IconButton(
            onClick = {
              scope.launch {
                prefs.clearToken()
                prefs.clearShift()
                navController.navigate(Routes.login) {
                  popUpTo(Routes.sections) { inclusive = true }
                }
              }
            }
          ) { Text("Salir") }
        }
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

      Text("Sistema: ${"%.2f".format(systemTotal)}")
      Text("Reportado: ${"%.2f".format(reportedTotal)}")
      Text("Diferencia: ${"%.2f".format(diff)}")

      val openOrders = stats?.openOrders ?: 0
      if (openOrders > 0) {
        Text("Hay $openOrders órdenes abiertas. Cierra/cobra antes de cerrar caja.")
      }

      openingCash?.takeIf { it.isNotBlank() }?.let { Text("Apertura: ₡ $it") }

      methods().forEach { method ->
        val system = stats?.byMethod?.get(method) ?: 0.0
        OutlinedTextField(
          value = reported[method].orEmpty(),
          onValueChange = { next -> reported = reported + (method to next); error = null },
          label = { Text("$method (sistema: ${"%.2f".format(system)})") },
          singleLine = true,
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          modifier = Modifier.fillMaxWidth(),
        )
      }

      Button(
        enabled = openOrders == 0,
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
                  val amt = parseMoney(reported[method])
                  if (amt > 0) method to amt else null
                }
                .toMap()
              val note = openingCash?.takeIf { it.isNotBlank() }?.let { "Apertura: ₡ $it" }

              val resp = client.api.closeShift(
                CloseShiftRequest(
                  totals = TotalsInput(system = systemTotal, reported = reportedTotal),
                  payments = paymentMap,
                  note = note,
                )
              )
              if (resp.ok) {
                prefs.clearShift()
                navController.navigate(Routes.openShift) {
                  popUpTo(Routes.sections) { inclusive = true }
                }
              } else {
                error = "No se pudo cerrar caja"
              }
            } catch (e: Exception) {
              error = e.message ?: "No se pudo cerrar caja"
            }
          }
        },
        contentPadding = PaddingValues(vertical = 14.dp, horizontal = 16.dp),
      ) {
        Text("Cerrar caja")
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

