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
import com.pms.restaurantpos.data.RestaurantStats
import kotlinx.coroutines.launch
import java.time.Instant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpenShiftScreen(navController: NavHostController, prefs: AppPreferences) {
  val scope = rememberCoroutineScope()

  val baseUrl by prefs.baseUrl.collectAsState(initial = null)
  val token by prefs.token.collectAsState(initial = null)
  val shiftOpenedAtMs by prefs.shiftOpenedAtMs.collectAsState(initial = 0L)
  val openingCashSaved by prefs.openingCash.collectAsState(initial = null)

  var stats by remember { mutableStateOf<RestaurantStats?>(null) }
  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }
  var openingCash by remember(openingCashSaved) { mutableStateOf(openingCashSaved ?: "") }

  LaunchedEffect(baseUrl, token) {
    val url = baseUrl?.trim().orEmpty()
    val t = token?.trim().orEmpty()
    when {
      url.isEmpty() -> navController.navigate(Routes.server) {
        popUpTo(Routes.openShift) { inclusive = true }
      }
      t.isEmpty() -> navController.navigate(Routes.login) {
        popUpTo(Routes.openShift) { inclusive = true }
      }
      else -> {
        try {
          loading = true
          error = null
          val client = ApiClient(baseUrl = url, tokenProvider = { t })
          stats = client.api.getRestaurantStats()
        } catch (e: Exception) {
          error = e.message ?: "No se pudieron cargar los datos de caja"
        } finally {
          loading = false
        }
      }
    }
  }

  val lastCloseAtMs = remember(stats?.lastCloseAt) { parseIsoToEpochMs(stats?.lastCloseAt) }
  val needsOpen = remember(shiftOpenedAtMs, lastCloseAtMs) {
    if (shiftOpenedAtMs <= 0L) return@remember true
    if (lastCloseAtMs != null && shiftOpenedAtMs <= lastCloseAtMs) return@remember true
    false
  }

  LaunchedEffect(loading, needsOpen) {
    if (!loading && !needsOpen) {
      navController.navigate(Routes.sections) {
        popUpTo(Routes.openShift) { inclusive = true }
      }
    }
  }

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("Caja") },
        actions = {
          IconButton(
            onClick = {
              scope.launch {
                prefs.clearToken()
                prefs.clearShift()
                navController.navigate(Routes.login) {
                  popUpTo(Routes.openShift) { inclusive = true }
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

      if (error != null) {
        Text(error!!)
      }

      val lastClose = stats?.lastCloseAt?.takeIf { it.isNotBlank() }
      if (lastClose != null) {
        Text("Último cierre: $lastClose")
      } else {
        Text("Sin cierres previos")
      }

      if (!needsOpen) {
        Text("Turno abierto")
        return@Column
      }

      Text("Apertura de caja")
      OutlinedTextField(
        value = openingCash,
        onValueChange = { openingCash = it; error = null },
        label = { Text("Fondo inicial (₡)") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth(),
      )
      Button(
        onClick = {
          val normalized = openingCash.trim()
          if (normalized.isEmpty()) {
            error = "Ingresa el fondo inicial"
            return@Button
          }
          scope.launch {
            prefs.setShiftOpened(openedAtMs = System.currentTimeMillis(), openingCash = normalized)
            navController.navigate(Routes.sections) {
              popUpTo(Routes.openShift) { inclusive = true }
            }
          }
        },
        contentPadding = PaddingValues(vertical = 14.dp, horizontal = 16.dp),
      ) {
        Text("Abrir turno")
      }
    }
  }
}

private fun parseIsoToEpochMs(value: String?): Long? {
  val v = value?.trim().orEmpty()
  if (v.isEmpty()) return null
  return try {
    Instant.parse(v).toEpochMilli()
  } catch (_: Exception) {
    null
  }
}

