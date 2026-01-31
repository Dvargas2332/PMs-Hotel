package com.pms.restaurantpos.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.pms.restaurantpos.data.ApiClient
import com.pms.restaurantpos.data.AppPreferences
import com.pms.restaurantpos.data.CreateOrUpdateOrderRequest
import com.pms.restaurantpos.data.MenuItem
import com.pms.restaurantpos.data.OrderItemInput
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderScreen(
  navController: NavHostController,
  prefs: AppPreferences,
  sectionId: String,
  tableId: String,
  tableName: String,
) {
  val scope = rememberCoroutineScope()
  val baseUrl by prefs.baseUrl.collectAsState(initial = null)
  val token by prefs.token.collectAsState(initial = null)

  var menu by remember { mutableStateOf<List<MenuItem>>(emptyList()) }
  var orderItems by remember { mutableStateOf<Map<String, Pair<MenuItem, Int>>>(emptyMap()) }
  var error by remember { mutableStateOf<String?>(null) }

  fun total(): Double = orderItems.values.sumOf { (item, qty) -> parseMoney(item.price) * qty.toDouble() }

  LaunchedEffect(sectionId, baseUrl, token) {
    val url = baseUrl?.trim().orEmpty()
    val t = token?.trim().orEmpty()
    if (url.isEmpty() || t.isEmpty()) return@LaunchedEffect

    try {
      error = null
      val client = ApiClient(baseUrl = url, tokenProvider = { t })
      menu = client.api.listMenu(sectionId = sectionId)
    } catch (e: Exception) {
      error = e.message ?: "No se pudo cargar el menú"
    }
  }

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("Mesa $tableName") },
        navigationIcon = {
          IconButton(onClick = { navController.popBackStack() }) { Text("←") }
        }
      )
    }
  ) { padding ->
    Column(
      modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      if (error != null) Text(error!!)

      Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Button(
          onClick = {
            scope.launch {
              val url = baseUrl?.trim().orEmpty()
              val t = token?.trim().orEmpty()
              if (url.isEmpty() || t.isEmpty()) return@launch

              try {
                error = null
                val client = ApiClient(baseUrl = url, tokenProvider = { t })
                val items = orderItems.values.map { (menuItem, qty) ->
                  OrderItemInput(
                    id = menuItem.id,
                    name = menuItem.name ?: "Item",
                    category = menuItem.category,
                    price = parseMoney(menuItem.price),
                    qty = qty,
                  )
                }

                client.api.createOrUpdateOrder(
                  CreateOrUpdateOrderRequest(
                    sectionId = sectionId,
                    tableId = tableId,
                    items = items,
                  )
                )
                orderItems = emptyMap()
                navController.popBackStack()
              } catch (e: Exception) {
                error = e.message ?: "No se pudo enviar la orden"
              }
            }
          },
          enabled = orderItems.isNotEmpty(),
        ) {
          Text("Comandar (${orderItems.size})")
        }
        Button(
          onClick = {
            navController.navigate(Routes.checkout(sectionId, tableId, tableName))
          }
        ) {
          Text("Cobrar")
        }
        Text("Total: ${"%.2f".format(total())}")
      }

      LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(menu) { item ->
          val display = item.name ?: item.id
          Column(
            modifier = Modifier
              .clickable {
                val current = orderItems[item.id]?.second ?: 0
                orderItems = orderItems + (item.id to (item to (current + 1)))
              }
              .padding(8.dp)
          ) {
            Text(display)
            item.category?.takeIf { it.isNotBlank() }?.let { Text(it) }
            Text("₡ ${"%.2f".format(parseMoney(item.price))}")
          }
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
