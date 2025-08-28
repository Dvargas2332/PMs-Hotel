const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const habitacionesRoutes = require('./routes/habitacionesRoutes');
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('¡Servidor del PMS funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

app.use('/api/habitaciones', habitacionesRoutes);
