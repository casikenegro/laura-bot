const TelegramBot = require("node-telegram-bot-api");
const {
  calcularCaloriasRequeridas,
  calcularCaloriasTotales,
  calcularConsumoProteinas,
  calcularETA,
  calcularGAF,
  calcularGastoEnergeticoBasal,
  calcularGEB_ETA,
  calcularICC,
  calcularIMC,
  calcularMasaGrasa,
  calcularMasaLibreGrasa,
  calcularMasaMuscular,
  calcularPercentilGrasa,
} = require("./utils");
const TOKEN = "7804878428:AAGxzPB0be7bN8uvDN3NVTy5M_NAGqBQ5uQ";
const bot = new TelegramBot(TOKEN, { polling: true });
const axios = require("axios"); // Asegúrate de instalar axios con `npm install axios`

const GOOGLE_SHEETS_URL = `https://script.google.com/macros/s/AKfycbxDF_TAbLAYNYu5QsuGcImqHC6PO-Fle6fXFlvSt1LJjZs6HfXMj3d3IgbBQodmFSGs/exec`;
const enviarDatosAGoogleSheets = async (datos) => {
  try {
    const response = await axios.post(
      GOOGLE_SHEETS_URL,
      {
        data: {
          ...datos,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response);
    console.log("✅ Datos enviados a Google Sheets:", response.data);
  } catch (error) {
    console.error("❌ Error al enviar datos a Google Sheets:", error);
  }
};

// Eliminar cualquier rastro de fs o almacenamiento en JSON

let usuario = {
  tlf: null,
  confirmado: false,
  progreso: 0,
  nombre: null,
  sexo: null,
};

const procesarDatos = async (chatId, userRegistro) => {
  console.log(userRegistro);

  const fechaActual = new Date().toISOString().split("T")[0].replace(/-/g, "/");

  // Calculando valores
  const imc = calcularIMC(userRegistro.peso, userRegistro.estatura);
  const icc = calcularICC(userRegistro.cintura, userRegistro.cadera);
  const grasa = calcularPercentilGrasa(userRegistro.sexo, userRegistro.edad, {
    biceps: userRegistro.pliegue_cutanios_biceps,
    triceps: userRegistro.pliegue_cutanios_triceps,
    subescapular: userRegistro.pliegue_cutanios_subescapular,
    suprailiaco: userRegistro.pliegue_cutanios_suprailiaco,
  });
  console.log("grasa", grasa);
  const masaGrasa = calcularMasaGrasa(userRegistro.peso, grasa.porcentajeGrasa);
  console.log(masaGrasa);
  const masaLibreGrasa = calcularMasaLibreGrasa(userRegistro.peso, masaGrasa);
  const consumoProteinas = calcularConsumoProteinas(masaLibreGrasa);
  const masaMuscular = calcularMasaMuscular(masaLibreGrasa);
  const GEB = calcularGastoEnergeticoBasal(
    userRegistro.peso,
    userRegistro.estatura,
    userRegistro.edad,
    userRegistro.sexo
  );
  const ETA = calcularETA(GEB);
  const GEB_ETA = calcularGEB_ETA(GEB, ETA);
  const GAF = calcularGAF(userRegistro.nivelActividad || "moderado");
  const caloriasTotales = calcularCaloriasTotales(GEB_ETA, GAF);
  const caloriasRequeridas = calcularCaloriasRequeridas(caloriasTotales, 0);

  let iccDiagnostico = "R.C bajo";
  if (userRegistro.sexo === "hombre") {
    if (icc > 0.95) iccDiagnostico = "R.C alto";
    else if (icc > 0.9) iccDiagnostico = "R.C moderado";
  } else {
    if (icc > 0.85) iccDiagnostico = "R.C alto";
    else if (icc > 0.8) iccDiagnostico = "R.C moderado";
  }

  userRegistro = {
    ...userRegistro,
    fecha: fechaActual,
    imc,
    icc,
    iccDiagnostico,
    percentilGrasa: grasa.percentil,
    porcentajeGrasa: grasa.porcentajeGrasa,
    masaGrasa,
    masaLibreGrasa,
    consumoProteinas,
    masaMuscular,
    GEB,
    ETA,
    GEB_ETA,
    GAF,
    caloriasTotales,
    caloriasRequeridas,
  };
  console.log(userRegistro);

  // Enviar los datos a Google Sheets
  await enviarDatosAGoogleSheets(userRegistro);

  bot.sendMessage(chatId, "✅ Medidas registradas correctamente.");
  return bot.sendMessage(
    chatId,
    "Puedes consultar tus datos con /consultar <número>"
  );
};

// // Comando para consultar datos
// bot.onText(/\/consultar (\d+)/, (msg, match) => {
//   const chatId = msg.chat.id;
//   const tlf = match[1];

//   if (!usuarios[tlf]) {
//     return bot.sendMessage(
//       chatId,
//       "❌ No hay datos registrados para esta cédula."
//     );
//   }

//   const userData = usuarios[tlf];
//   let respuesta = `📋 *Información de ${userData.nombre}:*\n\n`;
//   respuesta += `📌 *Edad:* ${userData.edad} años\n`;
//   respuesta += `⚧️ *Sexo:* ${userData.sexo}\n`;
//   respuesta += `📏 *Estatura:* ${userData.estatura} m\n`;
//   respuesta += `⚖️ *Peso:* ${userData.peso} kg\n\n`;
//   respuesta += `📊 *Historial de mediciones:*\n`;
//   respuesta += `\n📅 *Fecha:* ${userData.fecha}\n💪 *IMC:* ${userData.imc}\n📏 *ICC:* ${userData.icc}\n🔥 *Grasa Corporal:* ${userData.porcentajeGrasa}%`;

//   bot.sendMessage(chatId, respuesta, { parse_mode: "Markdown" });
// });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.toLowerCase() === "/start") {
    usuario = {
      telefono: null,
      confirmado: false,
      progreso: 0,
      nombre: null,
      sexo: null,
    };
    return bot.sendMessage(
      chatId,
      "🔄 El proceso ha sido reiniciado. Inicia de nuevo ingresando tu número de teléfono."
    );
  }

  if (!usuario.telefono) {
    if (!/^\d{10,}$/.test(text)) {
      return bot.sendMessage(
        chatId,
        "❌ El número debe ser válido (al menos 10 dígitos). Inténtalo de nuevo."
      );
    }
    usuario.telefono = text;
    return bot.sendMessage(
      chatId,
      `🔍 Confirmas que tu número es *${text}*?\n\nResponde *Sí* o *No*`,
      { parse_mode: "Markdown" }
    );
  }

  if (!usuario.confirmado) {
    if (text.toLowerCase() === "si") {
      usuario.confirmado = true;
    } else if (text.toLowerCase() === "no") {
      usuario.telefono = null;
      return bot.sendMessage(
        chatId,
        "❌ Número incorrecto. Ingresa nuevamente:"
      );
    } else {
      return bot.sendMessage(
        chatId,
        "❌ Responde *Sí* o *No* para confirmar tu número."
      );
    }
  }

  if (!usuario.nombre) {
    if (/^[a-zA-Z\s]+$/.test(text.toLowerCase())) {
      usuario.nombre = text.toLowerCase();
    } else {
      return bot.sendMessage(
        chatId,
        "❌ Ingresa un nombre y apellido válido (solo letras y espacios)."
      );
    }
  }

  if (!usuario.sexo) {
    if (/^(hombre|mujer)$/i.test(text.toLowerCase())) {
      usuario.sexo = text.toLowerCase();
    } else {
      return bot.sendMessage(
        chatId,
        "❌ Ingresa un sexo válido: *Hombre* o *Mujer*."
      );
    }
  }
  // Preguntas en orden de flujo
  const preguntas = [
    {
      key: "estatura",
      pregunta: "📏 ¿Cuál es tu *estatura* en metros?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una estatura válida en metros (Ej: 1.75).",
    },

    {
      key: "edad",
      pregunta: "🎂 ¿Cuál es tu *edad*?",
      validacion: /^\d{1,3}$/,
      error: "❌ Ingresa una edad válida entre 1 y 150.",
    },
    {
      key: "peso",
      pregunta: "⚖️ ¿Cuál es tu *peso corporal* en kg?",
      validacion: /^\d+$/,
      error: "❌ Ingresa un peso válido en kg.",
    },
    {
      key: "hombros",
      pregunta: "💪 ¿Cuál es tu *medida de hombros* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una medida válida en cm.",
    },
    {
      key: "brazo_relajado",
      pregunta: "💪 ¿Cuál es tu *medida de brazo relajado* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una medida válida en cm.",
    },
    {
      key: "brazo_contraido",
      pregunta: "💪 ¿Cuál es tu *medida de brazo contraído* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una medida válida en cm.",
    },
    {
      key: "cintura",
      pregunta: "📏 ¿Cuál es tu *cintura* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una medida válida en cm.",
    },
    {
      key: "cadera",
      pregunta: "📏 ¿Cuál es tu *cadera* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una medida válida en cm.",
    },
    {
      key: "muslo",
      pregunta: "📏 ¿Cuál es tu *muslo* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una medida válida en cm.",
    },
    {
      key: "gluteo",
      pregunta: "🍑 ¿Cuál es tu *glúteo* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una medida válida en cm.",
    },
    {
      key: "pantorrilla",
      pregunta: "🦵 ¿Cuál es tu *pantorrilla* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa una medida válida en cm.",
    },
    // Las preguntas de los pliegues cutáneos
    {
      key: "pliegue_cutanios_biceps",
      pregunta: "💪 ¿Cuál es tu *pliegue cutáneo en bíceps* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa un valor válido en cm.",
    },
    {
      key: "pliegue_cutanios_triceps",
      pregunta: "💪 ¿Cuál es tu *pliegue cutáneo en tríceps* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa un valor válido en cm.",
    },
    {
      key: "pliegue_cutanios_subescapular",
      pregunta: "💪 ¿Cuál es tu *pliegue cutáneo en subescapular* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa un valor válido en cm.",
    },
    {
      key: "pliegue_cutanios_suprailiaco",
      pregunta: "💪 ¿Cuál es tu *pliegue cutáneo en suprailiaco* en cm?",
      validacion: /^\d+(\.\d+)?$/,
      error: "❌ Ingresa un valor válido en cm.",
    },
  ];

  let progreso = usuario.progreso;

  // Primero, validamos y agregamos las respuestas a las preguntas estándar
  if (progreso < preguntas.length) {
    let preguntaActual = preguntas[progreso];

    if (!preguntaActual.validacion.test(text)) {
      return bot.sendMessage(chatId, preguntaActual.error);
    }

    usuario[preguntaActual.key] = parseFloat(text);
    usuario.progreso++;

    // Después de todas las preguntas estándar, si el sexo es hombre, preguntamos las preguntas adicionales.
    if (
      usuario.sexo &&
      usuario.sexo.toLowerCase() === "hombre" &&
      usuario.progreso === preguntas.length
    ) {
      return bot.sendMessage(
        chatId,
        "📏 ¿Cuánto mide tu *pectoral inspirado* en cm?",
        { parse_mode: "Markdown" }
      );
    }
  }

  // Si llegamos aquí, es porque hemos completado todas las preguntas estándar
  // Ahora podemos hacer preguntas adicionales específicas para hombres
  if (usuario.progreso === preguntas.length + 1) {
    if (!/^\d+(\.\d+)?$/.test(text) || parseFloat(text) <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ Ingresa un valor válido en cm (Ej: 90.5) para pectoral inspirado."
      );
    }
    usuario.pectoral_inspirado = parseFloat(text);
    return bot.sendMessage(
      chatId,
      "📏 ¿Cuánto mide tu *pectoral espirado* en cm?",
      { parse_mode: "Markdown" }
    );
  }

  if (usuario.progreso === preguntas.length + 2) {
    if (!/^\d+(\.\d+)?$/.test(text) || parseFloat(text) <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ Ingresa un valor válido en cm (Ej: 88.0) para pectoral espirado."
      );
    }
    usuario.pectoral_espirado = parseFloat(text);
    usuario.progreso++;
  }
  await procesarDatos(chatId, usuario);
});
