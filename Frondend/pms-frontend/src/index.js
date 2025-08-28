// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { HotelDataProvider } from "./context/HotelDataContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HotelDataProvider>
      <App />
    </HotelDataProvider>
  </React.StrictMode>
);
