const pool = require('../config/db');

const HabitacionesModel = {
  getTodas: async () => {
    const result = await pool.query('SELECT * FROM habitaciones ORDER BY id ASC');
    return result.rows;
  },

  getPorId: async (id) => {
    const result = await pool.query('SELECT * FROM habitaciones WHERE id = $1', [id]);
    return result.rows[0];
  },

  crear: async (data) => {
    const { numero, tipo, estado, precio } = data;
    const result = await pool.query(
      'INSERT INTO habitaciones (numero, tipo, estado, precio) VALUES ($1, $2, $3, $4) RETURNING *',
      [numero, tipo, estado, precio]
    );
    return result.rows[0];
  },

  actualizar: async (id, data) => {
    const { numero, tipo, estado, precio } = data;
    const result = await pool.query(
      'UPDATE habitaciones SET numero=$1, tipo=$2, estado=$3, precio=$4 WHERE id=$5 RETURNING *',
      [numero, tipo, estado, precio, id]
    );
    return result.rows[0];
  },

  eliminar: async (id) => {
    await pool.query('DELETE FROM habitaciones WHERE id = $1', [id]);
  },
};

module.exports = HabitacionesModel;
