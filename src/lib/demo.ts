import type { Briefing, DirectorId, Report } from "./types";

/** Respuestas pregrabadas para correr la demo sin API key. */
export const DEMO_REPORTS: Record<DirectorId, Report> = {
  ingenieria: {
    directorId: "ingenieria",
    resumen:
      "FarmaYa va 13 puntos atrasado y el bug de pagos OXXO sigue en producción. Todo pasa por Luis: 21 commits esta semana, 14 fuera de horario.",
    guias: [
      { persona: "Luis", pasos: ["Delegar la revisión del PR de Stripe OXXO a Marco y Sofía", "Bloquear 2h sin código para dejar documentada la migración de auth"] },
      { persona: "Marco", pasos: ["Reproducir el 4% de fallos OXXO con los logs de ayer", "Hacer pair review con Sofía del PR #pagos antes de las 13:00"] },
      { persona: "Daniela", pasos: ["Paginar del lado del servidor el dashboard Logistix (>10k envíos)", "Dejar handoff escrito: sale de vacaciones en 12 días"] },
      { persona: "Sofía", pasos: ["Correr la suite de regresión de checkout contra el fix de Marco", "Revisar el PR de filtros de Daniela"] },
    ],
    alertas: ["Riesgo de burnout del tech lead", "PRs sin revisión 6 y 9 días"],
    mensajes: [
      { para: "talento", texto: "Luis lleva 56h/semana y es cuello de botella. Necesito el 1:1 esta semana." },
      { para: "ventas", texto: "No tenemos capacidad para arrancar Altamar en 2 semanas sin contratar." },
    ],
    escalar: "¿Pausamos features nuevas de FarmaYa 3 días para cerrar el bug de pagos?",
  },
  ventas: {
    directorId: "ventas",
    resumen:
      "Llevamos 40% de la meta del trimestre. Grupo Altamar ($680K) está listo para firmar pero quiere arrancar en 2 semanas.",
    guias: [
      { persona: "Andrea", pasos: ["Responder hoy a Altamar proponiendo arranque escalonado en 4 semanas", "Mandar a Vitta el caso de éxito de Logistix"] },
      { persona: "Jorge", pasos: ["Descalificar Café Origen ampliación: 40% de descuento destruye margen", "Preparar la demo de Logistix fase 2 con datos reales del dashboard"] },
    ],
    alertas: ["2 correos de clientes sin respuesta > 48h"],
    mensajes: [
      { para: "operaciones", texto: "Altamar necesita fecha de arranque realista. ¿Cuándo libera gente FarmaYa?" },
      { para: "finanzas", texto: "Altamar puede pagar 30% de anticipo si cerramos esta semana." },
    ],
    escalar: "¿Firmamos Altamar con arranque en 4 semanas aunque lo pidan en 2?",
  },
  operaciones: {
    directorId: "operaciones",
    resumen:
      "Logistix va adelantado, FarmaYa en riesgo alto y el cliente ya escribió 3 veces por los pagos. El plan del mes contempla fase 2 de FarmaYa.",
    guias: [
      { persona: "Paola", pasos: ["Llamar hoy a FarmaYa antes de que vuelvan a escribir: fecha del fix OXXO", "Replanificar entrega FarmaYa con 5 días de colchón"] },
      { persona: "Iván", pasos: ["Absorber seguimiento de Café Origen para liberar a Paola"] },
      { persona: "Karla", pasos: ["Etiquetar los 11 tickets por cliente y escalar los de pagos a Marco"] },
    ],
    alertas: ["Cliente FarmaYa en riesgo de escalar"],
    mensajes: [
      { para: "finanzas", texto: "Antes de cotizar fase 2 de FarmaYa, ¿cómo va su cobranza?" },
    ],
    escalar: "",
  },
  finanzas: {
    directorId: "finanzas",
    resumen:
      "FarmaYa nos debe $260K con 47 días de vencimiento y su proyecto deja 11% de margen contra 35% presupuestado. Runway de 2.6 meses.",
    guias: [
      { persona: "Gabriela", pasos: ["Enviar a FarmaYa estado de cuenta formal con plan de pagos", "Facturar hoy el hito de Logistix (90% de avance)"] },
      { persona: "Héctor", pasos: ["Modelar el impacto en caja de contratar backend senior + anticipo Altamar"] },
    ],
    alertas: ["FarmaYa: proyecto menos rentable y mayor deudor", "Runway bajo 3 meses"],
    mensajes: [
      { para: "operaciones", texto: "No cotizar fase 2 de FarmaYa hasta que paguen lo vencido." },
    ],
    escalar: "¿Condicionamos cualquier trabajo nuevo de FarmaYa al pago de lo vencido?",
  },
  talento: {
    directorId: "talento",
    resumen:
      "El clima de ingeniería bajó a 2.8/5. Luis trabaja 56h/semana y no ha tenido 1:1 en 6 semanas. La vacante de backend senior lleva 34 días.",
    guias: [
      { persona: "Mariana", pasos: ["Agendar 1:1 con Luis mañana; tema: carga y delegación", "Compartir el comentario anónimo con Atlas sin identificar a nadie"] },
      { persona: "Tomás", pasos: ["Cerrar entrevistas finales con los 2 candidatos backend esta semana"] },
    ],
    alertas: ["Riesgo de rotación del tech lead", "Daniela sale 2 semanas en 12 días"],
    mensajes: [
      { para: "ingenieria", texto: "El comentario anónimo apunta a falta de revisiones de PR. Repartamos code review." },
      { para: "finanzas", texto: "Tenemos 2 candidatos backend finales; ¿hay caja para contratar este mes?" },
    ],
    escalar: "¿Aprobamos contratar al backend senior ya, antes de cerrar Altamar?",
  },
};

export const DEMO_BRIEFING: Briefing = {
  estado: "Crecimiento a la vista, pero FarmaYa está drenando gente, margen y caja al mismo tiempo",
  salud: 64,
  resumen:
    "Ricardo, hay un trato de $680K listo para firmar, pero el equipo no tiene capacidad y tu tech lead está al límite. FarmaYa es el origen de casi todo: te debe $260K, deja 11% de margen y su bug consume a ingeniería. Si resolvemos FarmaYa esta semana, Altamar es viable.",
  decisiones: [
    {
      titulo: "Contratar backend senior y firmar Altamar a 4 semanas",
      contexto:
        "Ventas tiene Altamar ($680K) listo; Ingeniería no tiene capacidad; Talento tiene 2 candidatos finales; el anticipo de 30% ($204K) cubre más de 2 meses del nuevo sueldo.",
      recomendacion: "Sí. Firma con arranque en 4 semanas y anticipo, y contrata esta semana.",
      opciones: ["Contratar y firmar a 4 semanas", "Firmar a 2 semanas con freelancers", "No firmar este trimestre"],
      urgencia: "alta",
      areas: ["ventas", "ingenieria", "talento", "finanzas"],
    },
    {
      titulo: "Poner condiciones a FarmaYa",
      contexto:
        "Debe $260K a 47 días, margen de 11% y su bug de pagos tiene a todo el equipo apagando fuegos. Operaciones iba a cotizar su fase 2.",
      recomendacion: "Arregla el bug OXXO primero (3 días de pausa) y condiciona la fase 2 al pago de lo vencido.",
      opciones: ["Pausa de 3 días + cobro condicionado", "Seguir igual y cobrar después"],
      urgencia: "alta",
      areas: ["finanzas", "operaciones", "ingenieria"],
    },
    {
      titulo: "Proteger a Luis (tech lead)",
      contexto: "56h/semana, 14 commits fuera de horario, sin 1:1 en 6 semanas y el clima del equipo en 2.8/5.",
      recomendacion: "1:1 mañana y code review repartido entre Marco y Sofía desde hoy.",
      opciones: ["Repartir code review", "Bono de retención", "Ambas"],
      urgencia: "media",
      areas: ["talento", "ingenieria"],
    },
  ],
};
