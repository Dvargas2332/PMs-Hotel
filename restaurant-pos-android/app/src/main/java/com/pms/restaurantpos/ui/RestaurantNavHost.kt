package com.pms.restaurantpos.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.pms.restaurantpos.data.AppPreferences
import java.net.URLDecoder
import java.net.URLEncoder

@Composable
fun RestaurantNavHost(navController: NavHostController, prefs: AppPreferences) {
  NavHost(navController = navController, startDestination = Routes.bootstrap) {
    composable(Routes.bootstrap) { BootstrapScreen(navController = navController, prefs = prefs) }
    composable(Routes.server) { ServerConfigScreen(navController = navController, prefs = prefs) }
    composable(Routes.login) { LoginScreen(navController = navController, prefs = prefs) }
    composable(Routes.openShift) { OpenShiftScreen(navController = navController, prefs = prefs) }
    composable(Routes.sections) { SectionsScreen(navController = navController, prefs = prefs) }
    composable(Routes.closeShift) { CloseShiftScreen(navController = navController, prefs = prefs) }
    composable(
      route = Routes.tablesRoute,
      arguments = listOf(navArgument("sectionId") { type = NavType.StringType })
    ) {
      val sectionId = it.arguments?.getString("sectionId") ?: ""
      TablesScreen(navController = navController, prefs = prefs, sectionId = sectionId)
    }
    composable(
      route = Routes.orderRoute,
      arguments = listOf(
        navArgument("sectionId") { type = NavType.StringType },
        navArgument("tableId") { type = NavType.StringType },
        navArgument("tableName") { type = NavType.StringType },
      )
    ) {
      val sectionId = it.arguments?.getString("sectionId") ?: ""
      val tableId = it.arguments?.getString("tableId") ?: ""
      val tableName = decode(it.arguments?.getString("tableName") ?: "")
      OrderScreen(
        navController = navController,
        prefs = prefs,
        sectionId = sectionId,
        tableId = tableId,
        tableName = tableName,
      )
    }
    composable(
      route = Routes.checkoutRoute,
      arguments = listOf(
        navArgument("sectionId") { type = NavType.StringType },
        navArgument("tableId") { type = NavType.StringType },
        navArgument("tableName") { type = NavType.StringType },
      )
    ) {
      val sectionId = it.arguments?.getString("sectionId") ?: ""
      val tableId = it.arguments?.getString("tableId") ?: ""
      val tableName = decode(it.arguments?.getString("tableName") ?: "")
      CheckoutScreen(
        navController = navController,
        prefs = prefs,
        sectionId = sectionId,
        tableId = tableId,
        tableName = tableName,
      )
    }
  }
}

object Routes {
  const val bootstrap = "bootstrap"
  const val server = "server"
  const val login = "login"
  const val openShift = "openShift"
  const val sections = "sections"
  const val closeShift = "closeShift"

  const val tablesRoute = "tables/{sectionId}"
  const val orderRoute = "order/{sectionId}/{tableId}/{tableName}"
  const val checkoutRoute = "checkout/{sectionId}/{tableId}/{tableName}"

  fun tables(sectionId: String) = "tables/$sectionId"
  fun order(sectionId: String, tableId: String, tableName: String) =
    "order/$sectionId/$tableId/${encode(tableName)}"
  fun checkout(sectionId: String, tableId: String, tableName: String) =
    "checkout/$sectionId/$tableId/${encode(tableName)}"
}

private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
private fun decode(value: String): String = URLDecoder.decode(value, Charsets.UTF_8.name())
