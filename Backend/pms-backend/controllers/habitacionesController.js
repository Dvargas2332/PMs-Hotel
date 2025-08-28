const HabitacionesModel = require('../models/habitacionesModel');

const HabitacionesController = {
  listar: async (req, res) => {
    try {
      const habitaciones = await HabitacionesModel.getTodas();
      res.json(habitaciones);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener habitaciones' });
    }
  },

  obtener: async (req, res) => {
    try {
      const habitacion = await HabitacionesModel.getPorId(req.params.id);
      if (!habitacion) return res.status(404).json({ error: 'No encontrada' });
      res.json(habitacion);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener habitación' });
    }
  },

  crear: async (req, res) => {
    try {
      const nueva = await HabitacionesModel.crear(req.body);
      res.status(201).json(nueva);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Error al crear habitación' });
    }
  },

  actualizar: async (req, res) => {
    try {
      const actualizada = await HabitacionesModel.actualizar(req.params.id, req.body);
      res.json(actualizada);
    } catch (error) {
      res.status(500).json({ error: 'Error al actualizar habitación' });
    }
  },

  eliminar: async (req, res) => {
    try {
      await HabitacionesModel.eliminar(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Error al eliminar habitación' });
    }
  },
};

module.exports = HabitacionesController;
