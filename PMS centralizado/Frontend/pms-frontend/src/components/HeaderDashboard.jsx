// HeaderDashboard.jsx
import React, { useEffect, useState } from "react";

const HeaderDashboard = () => {
  const [exchangeRate, setExchangeRate] = useState(null);
  const [fecha, setFecha] = useState("");

  useEffect(() => {
    // Fecha actual
    const hoy = new Date();
    setFecha(hoy.toLocaleDateString("es-CR", { day: "2-digit", month: "long", year: "numeric" }));

    // Obtener cambio del dólar (ejemplo con exchangerate.host)
    fetch("https://api.exchangerate.host/latest?base=USD&symbols=CRC")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.rates && data.rates.CRC) {
          setExchangeRate(data.rates.CRC.toFixed(2));
        }
      })
      .catch((error) => console.error("Error obteniendo tipo de cambio:", error));
  }, []);

  return (
    <div className="flex justify-between items-center bg-white p-4 rounded shadow mb-6">
      <div className="text-lg font-semibold">Dashboard</div>
      <div className="flex gap-6 text-gray-700">
        <span>{fecha}</span>
        {exchangeRate && <span>Dólar: ₡{exchangeRate}</span>}
      </div>
    </div>
  );
};

export default HeaderDashboard;
