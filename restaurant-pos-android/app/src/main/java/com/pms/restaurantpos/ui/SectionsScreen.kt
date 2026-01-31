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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.pms.restaurantpos.data.ApiClient
import com.pms.restaurantpos.data.AppPreferences
import com.pms.restaurantpos.data.RestaurantSection
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SectionsScreen(navController: NavHostController, prefs: AppPreferences) {
  val scope = rememberCoroutineScope()
  val baseUrl by prefs.baseUrl.collectAsState(initial = null)
  val token by prefs.token.collectAsState(initial = null)

  var sections by remember { mutableStateOf<List<RestaurantSection>>(emptyList()) }
  var error by remember { mutableStateOf<String?>(null) }

  suspend fun load() {
    val url = baseUrl?.trim().orEmpty()
    val t = token?.trim().orEmpty()
    if (url.isEmpty() || t.isEmpty()) return

    try {
      error = null
      val client = ApiClient(baseUrl = url, tokenProvider = { t })
      sections = client.api.listSections()
    } catch (e: Exception) {
      error = e.message ?: "No se pudieron cargar secciones"
    }
  }

  LaunchedEffect(baseUrl, token) { load() }

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("Secciones") },
        actions = {
          IconButton(onClick = { navController.navigate(Routes.closeShift) }) {
            Text("Caja")
          }
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
          ) {
            Text("Salir")
          }
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
        items(sections) { section ->
          Column(
            modifier = Modifier
              .clickable { navController.navigate(Routes.tables(section.id)) }
              .padding(8.dp)
          ) {
            Text(section.name)
            section.activeMenu?.name?.takeIf { it.isNotBlank() }?.let { Text("Menú: $it") }
            Text("Mesas: ${section.tables.size}")
          }
        }
      }
    }
  }
}
