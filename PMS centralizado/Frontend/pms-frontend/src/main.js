// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { HotelDataProvider } from "./context/HotelDataContext";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";

const root = ReactDOM.createRoot(document.getElementById("root"));

// PWA mínima: permite abrir la app sin internet (el shell queda en caché).
// Los datos siempre se piden al servidor, no se cachean respuestas de la API.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin service worker la app sigue funcionando, solo no abre offline */
    });
  });
}

root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      BrowserRouter,
      null,
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(
            AuthProvider,
            null,
            React.createElement(HotelDataProvider, null, React.createElement(App, null))
          )
        )
      )
    )
  )
);
