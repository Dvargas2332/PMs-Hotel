package com.pms.restaurantpos.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "restaurant_pos")

class AppPreferences(private val context: Context) {
  private val keyBaseUrl = stringPreferencesKey("base_url")
  private val keyToken = stringPreferencesKey("token")
  private val keyShiftOpenedAtMs = longPreferencesKey("shift_opened_at_ms")
  private val keyOpeningCash = stringPreferencesKey("opening_cash")

  val baseUrl: Flow<String?> = context.dataStore.data.map { it[keyBaseUrl] }
  val token: Flow<String?> = context.dataStore.data.map { it[keyToken] }
  val shiftOpenedAtMs: Flow<Long> = context.dataStore.data.map { it[keyShiftOpenedAtMs] ?: 0L }
  val openingCash: Flow<String?> = context.dataStore.data.map { it[keyOpeningCash] }

  suspend fun setBaseUrl(value: String) {
    context.dataStore.edit { it[keyBaseUrl] = value }
  }

  suspend fun setToken(value: String) {
    context.dataStore.edit { it[keyToken] = value }
  }

  suspend fun clearToken() {
    context.dataStore.edit { it.remove(keyToken) }
  }

  suspend fun setShiftOpened(openedAtMs: Long, openingCash: String) {
    context.dataStore.edit {
      it[keyShiftOpenedAtMs] = openedAtMs
      it[keyOpeningCash] = openingCash
    }
  }

  suspend fun clearShift() {
    context.dataStore.edit {
      it.remove(keyShiftOpenedAtMs)
      it.remove(keyOpeningCash)
    }
  }
}
