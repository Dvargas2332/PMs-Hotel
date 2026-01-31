package com.pms.restaurantpos

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.rememberNavController
import com.pms.restaurantpos.data.AppPreferences
import com.pms.restaurantpos.ui.RestaurantNavHost
import com.pms.restaurantpos.ui.theme.RestaurantPosTheme

@Composable
fun RestaurantPosApp(modifier: Modifier = Modifier) {
  val context = LocalContext.current
  val prefs = remember { AppPreferences(context) }
  val navController = rememberNavController()

  RestaurantPosTheme {
    Surface(modifier = modifier, color = MaterialTheme.colorScheme.background) {
      RestaurantNavHost(navController = navController, prefs = prefs)
    }
  }
}

