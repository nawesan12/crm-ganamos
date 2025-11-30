// Canned responses for quick replies

export interface CannedResponse {
  command: string;
  label: string;
  message: string;
  category: string;
}

export const cannedResponses: CannedResponse[] = [
  // Business Hours
  {
    command: "/horarios",
    label: "Horarios de atención",
    message: "Nuestro horario de atención es de lunes a viernes de 9:00 AM a 6:00 PM, y sábados de 9:00 AM a 1:00 PM.",
    category: "Información general",
  },
  {
    command: "/horariossemana",
    label: "Horarios entre semana",
    message: "De lunes a viernes estamos disponibles de 9:00 AM a 6:00 PM.",
    category: "Información general",
  },

  // Pricing
  {
    command: "/precio",
    label: "Información de precios",
    message: "Con gusto te comparto información sobre nuestros precios. ¿Qué producto o servicio te interesa específicamente?",
    category: "Ventas",
  },
  {
    command: "/descuento",
    label: "Descuentos disponibles",
    message: "Tenemos promociones especiales vigentes. ¿Te gustaría que te comparta los descuentos actuales?",
    category: "Ventas",
  },
  {
    command: "/cotizacion",
    label: "Solicitar cotización",
    message: "Perfecto, con gusto preparo una cotización para vos. ¿Podrías compartirme más detalles sobre lo que necesitás?",
    category: "Ventas",
  },

  // Shipping
  {
    command: "/envio",
    label: "Información de envío",
    message: "Realizamos envíos a todo el país. El tiempo de entrega es de 3 a 5 días hábiles. ¿A qué zona necesitás el envío?",
    category: "Logística",
  },
  {
    command: "/costoenvio",
    label: "Costo de envío",
    message: "El costo de envío varía según la zona y el peso del paquete. ¿Me podés compartir tu código postal para darte un precio exacto?",
    category: "Logística",
  },
  {
    command: "/seguimiento",
    label: "Seguimiento de pedido",
    message: "Para rastrear tu pedido, necesito tu número de orden. ¿Lo tenés a mano?",
    category: "Logística",
  },

  // Payment
  {
    command: "/pago",
    label: "Métodos de pago",
    message: "Aceptamos transferencia bancaria, tarjeta de crédito/débito, y efectivo. ¿Cuál preferís?",
    category: "Pagos",
  },
  {
    command: "/cuotas",
    label: "Pago en cuotas",
    message: "Sí, podés pagar en cuotas con tarjeta de crédito. Tenemos opciones de 3, 6, y 12 cuotas sin interés.",
    category: "Pagos",
  },
  {
    command: "/factura",
    label: "Facturación",
    message: "Sí, emitimos factura A o B. ¿Necesitás factura para tu compra?",
    category: "Pagos",
  },

  // Warranty & Returns
  {
    command: "/garantia",
    label: "Información de garantía",
    message: "Todos nuestros productos cuentan con garantía de 12 meses contra defectos de fabricación.",
    category: "Postventa",
  },
  {
    command: "/devolucion",
    label: "Política de devoluciones",
    message: "Tenés 30 días para devolver el producto si no estás satisfecho. El producto debe estar en perfectas condiciones y con su embalaje original.",
    category: "Postventa",
  },
  {
    command: "/cambio",
    label: "Cambios de producto",
    message: "Podés cambiar el producto dentro de los 30 días posteriores a la compra. ¿Qué producto querés cambiar?",
    category: "Postventa",
  },

  // General
  {
    command: "/catalogo",
    label: "Catálogo de productos",
    message: "Te puedo enviar nuestro catálogo completo. ¿Qué tipo de productos te interesan?",
    category: "Información general",
  },
  {
    command: "/stock",
    label: "Consultar stock",
    message: "Déjame verificar el stock para vos. ¿Qué producto te interesa?",
    category: "Ventas",
  },
  {
    command: "/contacto",
    label: "Datos de contacto",
    message: "Podés contactarnos por:\n📞 Teléfono: (011) 1234-5678\n📧 Email: info@empresa.com\n📍 Dirección: Av. Principal 123, CABA",
    category: "Información general",
  },

  // Greetings
  {
    command: "/bienvenida",
    label: "Mensaje de bienvenida",
    message: "¡Hola! Bienvenido/a. Soy [TU NOMBRE] y estoy acá para ayudarte. ¿En qué puedo asistirte hoy?",
    category: "Saludos",
  },
  {
    command: "/gracias",
    label: "Agradecimiento",
    message: "¡Gracias por tu consulta! Si necesitás algo más, no dudes en contactarnos. ¡Que tengas un excelente día!",
    category: "Despedida",
  },
  {
    command: "/espera",
    label: "Mensaje de espera",
    message: "Dame un momento por favor, estoy revisando esa información para vos.",
    category: "Información general",
  },

  // Support
  {
    command: "/soporte",
    label: "Soporte técnico",
    message: "Para asistencia técnica, necesito que me compartas:\n1. Número de orden\n2. Descripción del problema\n3. Si es posible, fotos del producto",
    category: "Soporte",
  },
  {
    command: "/reclamo",
    label: "Gestión de reclamos",
    message: "Lamento que hayas tenido un inconveniente. Voy a registrar tu reclamo para darle seguimiento. ¿Podrías compartirme más detalles?",
    category: "Soporte",
  },
];

// Get all unique categories
export const getCategories = (): string[] => {
  const categories = new Set(cannedResponses.map((r) => r.category));
  return Array.from(categories).sort();
};

// Get responses by category
export const getResponsesByCategory = (category: string): CannedResponse[] => {
  return cannedResponses.filter((r) => r.category === category);
};

// Search responses
export const searchResponses = (query: string): CannedResponse[] => {
  const lowerQuery = query.toLowerCase();
  return cannedResponses.filter(
    (r) =>
      r.command.toLowerCase().includes(lowerQuery) ||
      r.label.toLowerCase().includes(lowerQuery) ||
      r.message.toLowerCase().includes(lowerQuery)
  );
};

// Get response by command
export const getResponseByCommand = (command: string): CannedResponse | undefined => {
  return cannedResponses.find((r) => r.command === command);
};

// Keyword mapping for smart suggestions
const keywordMapping: Record<string, string[]> = {
  "/horarios": ["horario", "hora", "abierto", "cerrado", "atienden", "abren", "cierran", "cuando abren"],
  "/precio": ["precio", "cuesta", "cuánto", "cuanto", "vale", "valor", "costar"],
  "/descuento": ["descuento", "oferta", "promo", "promoción", "promocion", "rebaja", "barato"],
  "/cotizacion": ["cotización", "cotizacion", "presupuesto", "cotizar"],
  "/envio": ["envío", "envio", "entregar", "delivery", "despacho", "entrega"],
  "/costoenvio": ["costo de envío", "costo de envio", "cuánto sale envío", "cuanto sale envio", "precio envío", "precio envio"],
  "/seguimiento": ["rastrear", "seguimiento", "tracking", "dónde está", "donde esta", "track", "pedido"],
  "/pago": ["pago", "pagar", "forma de pago", "método de pago", "metodo de pago", "cómo pago", "como pago"],
  "/cuotas": ["cuotas", "financiación", "financiacion", "tarjeta", "crédito", "credito", "plazo"],
  "/factura": ["factura", "comprobante", "recibo", "ticket"],
  "/garantia": ["garantía", "garantia", "cobertura"],
  "/devolucion": ["devolución", "devolucion", "devolver", "reembolso"],
  "/cambio": ["cambio", "cambiar", "reemplazar"],
  "/catalogo": ["catálogo", "catalogo", "productos", "que venden", "qué venden", "lista"],
  "/stock": ["stock", "hay", "disponible", "tienen", "disponibilidad", "quedan"],
  "/contacto": ["contacto", "teléfono", "telefono", "dirección", "direccion", "email", "mail", "ubicación", "ubicacion"],
  "/bienvenida": ["hola", "buenos días", "buenos dias", "buenas tardes", "buenas noches", "buen día", "buen dia", "saludos"],
  "/gracias": ["gracias", "thank you", "agradezco", "muchas gracias"],
  "/soporte": ["soporte", "ayuda", "problema", "falla", "error", "no funciona", "roto", "defecto"],
  "/reclamo": ["reclamo", "queja", "disconforme", "mal servicio", "mala atención", "mala atencion"],
  "/espera": ["espera", "momento", "un segundo"],
};

// Smart suggestion based on customer message keywords
export const getSuggestedResponses = (message: string): CannedResponse[] => {
  const lowerMessage = message.toLowerCase();
  const suggestions: { response: CannedResponse; score: number }[] = [];

  // Check each command's keywords
  Object.entries(keywordMapping).forEach(([command, keywords]) => {
    let score = 0;
    keywords.forEach((keyword) => {
      if (lowerMessage.includes(keyword)) {
        // Longer keyword matches get higher scores
        score += keyword.length;
      }
    });

    if (score > 0) {
      const response = getResponseByCommand(command);
      if (response) {
        suggestions.push({ response, score });
      }
    }
  });

  // Sort by score (highest first) and return top 3
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.response);
};
