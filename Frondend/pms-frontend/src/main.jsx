import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // estilos globales + fullcalendar tweaks
import { HotelDataProvider } from "./context/HotelDataContext";


ReactDOM.createRoot(document.getElementById("root")).render(
<React.StrictMode>
<HotelDataProvider>
<App />
</HotelDataProvider>
</React.StrictMode>
);