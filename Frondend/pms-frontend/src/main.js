// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { HotelDataProvider } from "./context/HotelDataContext";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      BrowserRouter,
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
);
