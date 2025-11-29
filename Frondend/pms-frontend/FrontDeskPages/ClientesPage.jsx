import React, { useState } from "react";

// Datos de ejemplo
const initialClientes = [
  {
    id: 1,
    nombre: "Juan Pérez",
    tipoId: "Fisica",
    numeroId: "1-234-56789",
    email: "juan@mail.com",
    telefono: "8888-8888",
    direccion: "Calle 123, San José",
    provincia: "San José",
    canton: "Central",
    distrito: "Carmen",
    codPostal: "10101",
  },
  {
    id: 2,
    nombre: "Empresa XYZ",
    tipoId: "Juridica",
    numeroId: "3-456-78901",
    email: "contacto@xyz.com",
    telefono: "8555-5555",
    direccion: "Avenida 45, Heredia",
    provincia: "Heredia",
    canton: "Central",
    distrito: "Mercedes",
    codPostal: "40101",
  },
];

const ClientesPage = () => {
  const [clientes, setClientes] = useState(initialClientes);
  const [formData, setFormData] = useState({
    nombre: "",
    tipoId: "",
    numeroId: "",
    email: "",
    telefono: "",
    direccion: "",
    provincia: "",
    canton: "",
    distrito: "",
    codPostal: "",
  });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTipoId, setFilterTipoId] = useState("");

  // Crear o actualizar cliente
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validación básica
    if (!formData.nombre || !formData.tipoId || !formData.numeroId || !formData.email || !formData.telefono) {
      alert("Por favor completa los campos obligatorios.");
      return;
    }

    // Validar duplicados (tipo + número)
    const duplicate = clientes.find(
      (c) => c.tipoId === formData.tipoId && c.numeroId === formData.numeroId && c.id !== editId
    );
    if (duplicate) {
      alert("Ya existe un cliente con este tipo y número de identificación.");
      return;
    }

    if (editId) {
      // Actualizar cliente
      setClientes(clientes.map((c) => (c.id === editId ? { id: editId, ...formData } : c)));
      setEditId(null);
    } else {
      // Crear nuevo cliente
      const newCliente = { id: Date.now(), ...formData };
      setClientes([...clientes, newCliente]);
    }

    setFormData({
      nombre: "",
      tipoId: "",
      numeroId: "",
      email: "",
      telefono: "",
      direccion: "",
      provincia: "",
      canton: "",
      distrito: "",
      codPostal: "",
    });
  };

  const handleEdit = (cliente) => {
    setFormData({ ...cliente });
    setEditId(cliente.id);
  };

  const handleDelete = (id) => {
    if (window.confirm("¿Seguro que quieres eliminar este cliente?")) {
      setClientes(clientes.filter((c) => c.id !== id));
    }
  };

  // Filtrar clientes según búsqueda y tipo de ID
  const filteredClientes = clientes.filter((c) => {
    const matchesSearch =
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.numeroId.toLowerCase().includes(search.toLowerCase());
    const matchesTipo = filterTipoId ? c.tipoId === filterTipoId : true;
    return matchesSearch && matchesTipo;
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Clientes</h1>

      {/* Búsqueda y filtros */}
      <div className="mb-4 flex flex-col md:flex-row gap-3 max-w-3xl">
        <input
          type="text"
          placeholder="Buscar por nombre o ID"
          className="border p-2 rounded flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border p-2 rounded w-60"
          value={filterTipoId}
          onChange={(e) => setFilterTipoId(e.target.value)}
        >
          <option value="">Filtrar por tipo de ID</option>
          <option value="Fisica">Física</option>
          <option value="Juridica">Jurídica</option>
          <option value="DIMEX">DIMEX</option>
          <option value="Pasaporte">Pasaporte</option>
        </select>
      </div>

      {/* Formulario Crear/Editar */}
      <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
        <input
          type="text"
          placeholder="Nombre / Razón social"
          className="border p-2 rounded"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
        />

        {/* Tipo y número de identificación */}
        <div className="flex gap-2">
          <select
            className="border p-2 rounded w-1/2"
            value={formData.tipoId}
            onChange={(e) => setFormData({ ...formData, tipoId: e.target.value })}
          >
            <option value="">Tipo de ID</option>
            <option value="Fisica">Física</option>
            <option value="Juridica">Jurídica</option>
            <option value="DIMEX">DIMEX</option>
            <option value="Pasaporte">Pasaporte</option>
          </select>
          <input
            type="text"
            placeholder="Número de identificación"
            className="border p-2 rounded w-1/2"
            value={formData.numeroId}
            onChange={(e) => setFormData({ ...formData, numeroId: e.target.value })}
          />
        </div>

        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <input
          type="text"
          placeholder="Teléfono"
          className="border p-2 rounded"
          value={formData.telefono}
          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
        />
        <input
          type="text"
          placeholder="Dirección"
          className="border p-2 rounded"
          value={formData.direccion}
          onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
        />
        <input
          type="text"
          placeholder="Provincia"
          className="border p-2 rounded"
          value={formData.provincia}
          onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
        />
        <input
          type="text"
          placeholder="Cantón"
          className="border p-2 rounded"
          value={formData.canton}
          onChange={(e) => setFormData({ ...formData, canton: e.target.value })}
        />
        <input
          type="text"
          placeholder="Distrito"
          className="border p-2 rounded"
          value={formData.distrito}
          onChange={(e) => setFormData({ ...formData, distrito: e.target.value })}
        />
        <input
          type="text"
          placeholder="Código Postal (opcional)"
          className="border p-2 rounded"
          value={formData.codPostal}
          onChange={(e) => setFormData({ ...formData, codPostal: e.target.value })}
        />

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 col-span-2"
        >
          {editId ? "Actualizar Cliente" : "Agregar Cliente"}
        </button>
      </form>

      {/* Lista de Clientes */}
      <table className="w-full border-collapse border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Nombre</th>
            <th className="border p-2">ID</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Teléfono</th>
            <th className="border p-2">Dirección</th>
            <th className="border p-2">Provincia</th>
            <th className="border p-2">Cantón</th>
            <th className="border p-2">Distrito</th>
            <th className="border p-2">Cod. Postal</th>
            <th className="border p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredClientes.map((cliente) => (
            <tr key={cliente.id} className="hover:bg-gray-50">
              <td className="border p-2">{cliente.nombre}</td>
              <td className="border p-2">{cliente.tipoId} - {cliente.numeroId}</td>
              <td className="border p-2">{cliente.email}</td>
              <td className="border p-2">{cliente.telefono}</td>
              <td className="border p-2">{cliente.direccion}</td>
              <td className="border p-2">{cliente.provincia}</td>
              <td className="border p-2">{cliente.canton}</td>
              <td className="border p-2">{cliente.distrito}</td>
              <td className="border p-2">{cliente.codPostal}</td>
              <td className="border p-2 flex gap-2">
                <button
                  onClick={() => handleEdit(cliente)}
                  className="bg-yellow-400 text-white px-2 py-1 rounded hover:bg-yellow-500"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(cliente.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {filteredClientes.length === 0 && (
            <tr>
              <td colSpan="10" className="text-center p-4">
                No hay clientes que coincidan con la búsqueda
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ClientesPage;
