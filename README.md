# 🏨 PMS Hotel — Property Management System

> Sistema de gestión hotelera SaaS moderno, diseñado para centralizar operaciones de hotel en una sola plataforma intuitiva y eficiente.

![Stack](https://img.shields.io/badge/Frontend-React%20%2F%20TypeScript-blue)
![Stack](https://img.shields.io/badge/Backend-Node.js%20%2F%20JavaScript-yellow)
![Stack](https://img.shields.io/badge/Auth-JWT-green)
![Stack](https://img.shields.io/badge/Deploy-Docker-2496ED)
![Status](https://img.shields.io/badge/Status-En%20Desarrollo-orange)

---

## 📋 Descripción

**PMS Hotel** es una aplicación web SaaS de gestión hotelera que permite administrar reservas, restaurante, inventario y facturación desde un solo panel centralizado. Diseñado para hoteles independientes que buscan digitalizar sus operaciones.

---

## ✅ Funcionalidades actuales

### 🛏️ Reservas de Habitaciones
- Gestión de disponibilidad en tiempo real
- Creación y seguimiento de reservas

### 🍽️ Restaurante & POS
- Sistema de punto de venta (POS)
- Gestión de menú y comandas
- Control de inventario de restaurante
- Historial de ventas y descuentos
- Facturas por turno

### 📦 Inventario
- Control de stock en tiempo real
- Importación/exportación con Excel (XLSX)

### 🧾 Facturación
- Generación de facturas
- Historial de transacciones
- Cierre de turno con resumen financiero

---

## 🔜 Próximas funcionalidades

- [ ] ✅ Check-in / Check-out digital
- [ ] 📊 Reportes y estadísticas
- [ ] 👥 Gestión de usuarios y roles

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React, TypeScript |
| Backend | Node.js, JavaScript |
| Autenticación | JWT + BCrypt |
| Base de datos | PostgreSQL (via Prisma) |
| Contenedores | Docker + Docker Compose |
| Arquitectura | SaaS Multi-hotel |

---

## 🚀 Cómo ejecutar el proyecto

### Requisitos previos
- [Docker](https://www.docker.com/) instalado
- Archivo `.env` configurado (ver `.env.example`)

### Pasos

```bash
# 1. Clona el repositorio
git clone https://github.com/Dvargas2332/PMs-Hotel.git

# 2. Copia y configura las variables de entorno
cp .env.example .env

# 3. Levanta los contenedores
docker-compose up
```

La app estará disponible en:
- 🌐 **Frontend:** http://localhost
- 🔌 **Backend API:** http://localhost:4000

---

## 🔐 Variables de entorno

Copia `.env.example` a `.env` y configura:

```env
DATABASE_URL=          # URL de conexión a PostgreSQL
DIRECT_URL=            # URL directa para migraciones Prisma
JWT_SECRET=            # Clave secreta para JWT
JWT_EXPIRES=           # Tiempo de expiración del token (ej: 7d)
BCRYPT_ROUNDS=         # Rondas de encriptación (recomendado: 10)
FRONTEND_URL=          # URL del frontend
GESTOR_EMAIL=          # Email del administrador gestor
GESTOR_PASSWORD=       # Contraseña del gestor
GESTOR_NAME=           # Nombre del gestor SaaS
GESTOR_SYSTEM_HOTEL_NAME= # Nombre del sistema
```

---

## 👨‍💻 Autor

**Diego Vargas**
- GitHub: [@Dvargas2332](https://github.com/Dvargas2332)
- LinkedIn: [Diego Vargas](https://www.linkedin.com/in/diego-vargas-almengor-5ba024240/)
- Freelancer: [Vargas2332](https://www.freelancer.com/u/Vargas2332)

---

## 📄 Licencia — Propietaria

**© 2024 Diego Vargas. Todos los derechos reservados.**

Este software es propietario. **No está permitido** usarlo, copiarlo, modificarlo ni distribuirlo sin autorización expresa del autor.

El uso comercial requiere una **licencia de pago**. Para adquirirla o consultar términos, contacta al autor.

Ver archivo [LICENSE](./LICENSE) para los términos completos.
