// Preguntas frecuentes del panel de ayuda.
//
// Esto es contenido editable: cada entrada es una pregunta con su respuesta.
// Mantener las respuestas cortas (2-4 líneas) y en el idioma del producto.
// `tag` se usa para agrupar y para que el buscador encuentre por tema.

export const HELP_FAQ = [
  {
    id: "olvide-contrasena",
    tag: "Usuarios y accesos",
    q: "Olvidé mi contraseña, ¿qué hago?",
    a: "En la pantalla de inicio de sesión usá «¿Olvidaste tu contraseña?». Te envía un enlace válido por 1 hora y de un solo uso. Si el correo no llega (envío de correos pendiente de configurar), pedile al gestor que te la resetee desde Management → Perfiles.",
  },
  {
    id: "no-aparece-modulo",
    tag: "Usuarios y accesos",
    q: "¿Por qué no veo un módulo en el launcher?",
    a: "Los módulos dependen de la membresía del hotel: RBASIC incluye restaurante, management y facturación electrónica; recepción y contabilidad requieren una membresía mayor. Si tu hotel debería tenerlo y no aparece, revisá la membresía en el gestor.",
  },
  {
    id: "comanda-no-imprime",
    tag: "Restaurante y POS",
    q: "La comanda no imprime",
    a: "La impresión va a un agente local en 127.0.0.1:8787 con su API key; si no está corriendo, la comanda falla sin avisar en cocina. Mientras tanto podés usar el KDS en /restaurant/kds: la comanda aparece en pantalla y se actualiza sola cada 5 segundos.",
  },
  {
    id: "cerrar-turno",
    tag: "Restaurante y POS",
    q: "¿Cómo cierro el turno de caja?",
    a: "En el POS, menú de usuario → Estado de caja. El cierre X es un corte informativo y podés seguir cobrando; el cierre Z cierra el turno y es el que se usa para el arqueo del día. Una venta anterior al último cierre Z no se puede anular.",
  },
  {
    id: "anular-venta",
    tag: "Restaurante y POS",
    q: "¿Cómo anulo una venta ya cobrada?",
    a: "Restaurante → Histórico → buscá la venta → Anular venta. Pide motivo y PIN de autorización, devuelve el inventario y revierte el cargo a habitación y el asiento contable. El comprobante electrónico no se anula ahí: se emite la nota de crédito desde el histórico de facturación.",
  },
  {
    id: "ventas-y-arqueos",
    tag: "Reportes",
    q: "¿Dónde veo las ventas y los arqueos?",
    a: "Restaurante → Histórico para las ventas del día, con filtros por turno, mesero, cajero y creador. El arqueo por turno sale de Estado de caja, y los reportes contables en Contabilidad → Reportes.",
  },
  {
    id: "precios-iva-moneda",
    tag: "Configuración",
    q: "¿Dónde cambio precios, IVA y monedas?",
    a: "Management → Restaurante → Configuraciones: en «Impuestos» el IVA y el servicio, en «Pagos y divisas» la moneda base, la secundaria y el tipo de cambio, y en «Facturación» los datos que salen impresos. Los artículos y sus precios van en la pestaña Artículos.",
  },
  {
    id: "cargar-articulos",
    tag: "Configuración",
    q: "¿Cómo cargo muchos artículos de una vez?",
    a: "En el gestor, Base de datos → importar artículos. El archivo necesita nombre y familia; si la familia es nueva, el código CABYS es obligatorio. Si un artículo ya existe (por código, código de barras o nombre + familia) se actualiza en vez de duplicarse.",
  },
  {
    id: "seccion-bloqueada",
    tag: "Restaurante y POS",
    q: "No me deja renombrar una sección",
    a: "Las secciones con ventas registradas quedan fijas: los reportes y la contabilidad ya las referencian con ese nombre. Se pueden editar mientras no tengan ventas; el id nunca se cambia.",
  },
  {
    id: "factura-electronica",
    tag: "Facturación",
    q: "¿Por qué la factura electrónica no se envía a Hacienda?",
    a: "Hace falta el emisor configurado (cédula y nombre), el certificado .p12 y las credenciales de ATV, y que la facturación esté habilitada en ambiente de producción. Sin eso el comprobante se genera y se guarda, pero no se transmite.",
  },
  {
    id: "otra-cosa",
    tag: "Soporte",
    q: "No encuentro mi caso",
    a: "Escribinos por WhatsApp o por correo con los botones de abajo: el mensaje sale con el nombre del hotel, así no tenemos que preguntarte lo básico.",
  },
];
