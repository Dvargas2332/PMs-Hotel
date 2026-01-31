package com.pms.restaurantpos.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
  primary = Color(0xFF0B57D0),
  secondary = Color(0xFF006A60),
  tertiary = Color(0xFF7D5260),
)

private val DarkColors = darkColorScheme(
  primary = Color(0xFF9EC0FF),
  secondary = Color(0xFF55DBCF),
  tertiary = Color(0xFFEFB8C8),
)

@Composable
fun RestaurantPosTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = if (darkTheme) DarkColors else LightColors,
    typography = androidx.compose.material3.Typography(),
    content = content,
  )
}
