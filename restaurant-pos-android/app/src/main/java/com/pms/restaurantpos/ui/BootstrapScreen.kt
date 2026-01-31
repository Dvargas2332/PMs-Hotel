package com.pms.restaurantpos.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import com.pms.restaurantpos.data.AppPreferences

@Composable
fun BootstrapScreen(navController: NavHostController, prefs: AppPreferences) {
  val baseUrl by prefs.baseUrl.collectAsState(initial = null)
  val token by prefs.token.collectAsState(initial = null)

  LaunchedEffect(baseUrl, token) {
    val url = baseUrl?.trim().orEmpty()
    val t = token?.trim().orEmpty()
    when {
      url.isEmpty() -> navController.navigate(Routes.server) {
        popUpTo(Routes.bootstrap) { inclusive = true }
      }
      t.isEmpty() -> navController.navigate(Routes.login) {
        popUpTo(Routes.bootstrap) { inclusive = true }
      }
      else -> navController.navigate(Routes.openShift) {
        popUpTo(Routes.bootstrap) { inclusive = true }
      }
    }
  }

  Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    CircularProgressIndicator()
  }
}
