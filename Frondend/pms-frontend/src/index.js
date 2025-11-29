// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { HotelDataProvider } from "./context/HotelDataContext";
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <HotelDataProvider>
          <App />
        </HotelDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
