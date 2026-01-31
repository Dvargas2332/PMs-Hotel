package com.pms.restaurantpos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.pms.restaurantpos.data.ApiClient
import com.pms.restaurantpos.data.AppPreferences
import com.pms.restaurantpos.data.LauncherLoginRequest
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(navController: NavHostController, prefs: AppPreferences) {
  val scope = rememberCoroutineScope()
  val baseUrl by prefs.baseUrl.collectAsState(initial = null)

  var username by remember { mutableStateOf("") }
  var pin by remember { mutableStateOf("") }
  var error by remember { mutableStateOf<String?>(null) }
  var loading by remember { mutableStateOf(false) }

  Scaffold(
    topBar = { TopAppBar(title = { Text("Restaurante - Login") }) },
  ) { padding ->
    Column(
      modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      OutlinedTextField(
        value = username,
        onValueChange = { username = it; error = null },
        label = { Text("Usuario") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
      )
      OutlinedTextField(
        value = pin,
        onValueChange = { pin = it.filter { c -> c.isDigit() }; error = null },
        label = { Text("PIN") },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = Modifier.fillMaxWidth(),
      )

      if (error != null) Text(error!!)

      Button(
        enabled = !loading,
        onClick = {
          val u = username.trim()
          val p = pin.trim()
          val url = baseUrl?.trim().orEmpty()
          if (url.isEmpty()) {
            navController.navigate(Routes.server) {
              popUpTo(Routes.login) { inclusive = true }
            }
            return@Button
          }
          if (u.isEmpty() || p.isEmpty()) {
            error = "Usuario y PIN requeridos"
            return@Button
          }

          loading = true
          scope.launch {
            try {
              val client = ApiClient(baseUrl = url, tokenProvider = { null })
              val resp = client.api.launcherLogin(LauncherLoginRequest(username = u, password = p))
              prefs.setToken(resp.token)
              navController.navigate(Routes.openShift) {
                popUpTo(Routes.login) { inclusive = true }
              }
            } catch (e: Exception) {
              error = e.message ?: "No se pudo iniciar sesión"
            } finally {
              loading = false
            }
          }
        },
        contentPadding = PaddingValues(vertical = 14.dp, horizontal = 16.dp),
      ) {
        if (loading) {
          CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
        } else {
          Text("Entrar")
        }
      }
    }
  }
}
