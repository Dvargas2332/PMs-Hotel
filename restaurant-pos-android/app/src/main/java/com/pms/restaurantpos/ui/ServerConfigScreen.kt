package com.pms.restaurantpos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.pms.restaurantpos.data.AppPreferences
import com.pms.restaurantpos.data.normalizeBaseUrl
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServerConfigScreen(navController: NavHostController, prefs: AppPreferences) {
  val scope = rememberCoroutineScope()
  val savedBaseUrl by prefs.baseUrl.collectAsState(initial = null)
  var baseUrl by remember(savedBaseUrl) {
    mutableStateOf(savedBaseUrl?.takeIf { it.isNotBlank() } ?: "http://10.0.2.2:4000/api")
  }
  var error by remember { mutableStateOf<String?>(null) }

  Scaffold(
    topBar = { TopAppBar(title = { Text("Configurar servidor") }) },
  ) { padding ->
    Column(
      modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Text("URL del backend (incluye /api). Ej: http://192.168.1.50:4000/api")
      OutlinedTextField(
        value = baseUrl,
        onValueChange = { baseUrl = it; error = null },
        label = { Text("Base URL") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
        isError = error != null,
        modifier = Modifier.fillMaxWidth(),
      )
      if (error != null) Text(error!!)
      Button(
        onClick = {
          val normalized = normalizeBaseUrl(baseUrl)
          if (!normalized.contains("/api/")) {
            error = "La URL debe incluir /api (ej: http://IP:4000/api)"
            return@Button
          }
          scope.launch {
            prefs.setBaseUrl(normalized.removeSuffix("/"))
            navController.navigate(Routes.login) {
              popUpTo(Routes.server) { inclusive = true }
            }
          }
        },
        contentPadding = PaddingValues(vertical = 14.dp, horizontal = 16.dp),
      ) {
        Text("Guardar")
      }
    }
  }
}
