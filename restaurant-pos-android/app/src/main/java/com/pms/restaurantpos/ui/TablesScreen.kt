package com.pms.restaurantpos.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.pms.restaurantpos.data.ApiClient
import com.pms.restaurantpos.data.AppPreferences
import com.pms.restaurantpos.data.RestaurantSection
import com.pms.restaurantpos.data.RestaurantTable

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TablesScreen(navController: NavHostController, prefs: AppPreferences, sectionId: String) {
  val baseUrl by prefs.baseUrl.collectAsState(initial = null)
  val token by prefs.token.collectAsState(initial = null)

  var section by remember { mutableStateOf<RestaurantSection?>(null) }
  var tables by remember { mutableStateOf<List<RestaurantTable>>(emptyList()) }
  var error by remember { mutableStateOf<String?>(null) }

  LaunchedEffect(sectionId, baseUrl, token) {
    val url = baseUrl?.trim().orEmpty()
    val t = token?.trim().orEmpty()
    if (url.isEmpty() || t.isEmpty()) return@LaunchedEffect

    try {
      error = null
      val client = ApiClient(baseUrl = url, tokenProvider = { t })
      val sections = client.api.listSections()
      section = sections.firstOrNull { it.id == sectionId }
      tables = section?.tables ?: emptyList()
    } catch (e: Exception) {
      error = e.message ?: "No se pudieron cargar mesas"
    }
  }

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text(section?.name ?: "Mesas") },
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
      LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(tables) { table ->
          Column(
            modifier = Modifier
              .clickable { navController.navigate(Routes.order(sectionId, table.id, table.name)) }
              .padding(8.dp)
          ) {
            Text(table.name)
            Text("Asientos: ${table.seats}")
          }
        }
      }
    }
  }
}

