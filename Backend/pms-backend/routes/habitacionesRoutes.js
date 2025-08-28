const express = require('express');
const router = express.Router();
const HabitacionesController = require('../controllers/habitacionesController');

router.get('/', HabitacionesController.listar);
router.get('/:id', HabitacionesController.obtener);
router.post('/', HabitacionesController.crear);
router.put('/:id', HabitacionesController.actualizar);
router.delete('/:id', HabitacionesController.eliminar);

module.exports = router;
