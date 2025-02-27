//7804878428:AAGxzPB0be7bN8uvDN3NVTy5M_NAGqBQ5uQ
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
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

const GOOGLE_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbwFrFFC1Rs_F3ogC1rI4JPhQBELbVqqXZ6gj4y3fG_8nYFA3tnRi9YfEZQOVXyN-2Xp/exec";

const enviarDatosAGoogleSheets = async (datos) => {
  try {
    const response = await axios.post(GOOGLE_SHEETS_URL, datos);
    console.log("✅ Datos enviados a Google Sheets:", response.data);
  } catch (error) {
    console.error("❌ Error al enviar datos a Google Sheets:", error);
  }
};
// Cargar datos almacenados de manera segura
let usuarios = {};
const DATA_FILE = "datos.json";

const cargarDatos = () => {
  if (fs.existsSync(DATA_FILE)) {
    try {
      usuarios = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (error) {
      console.error("Error al leer datos.json:", error);
    }
  }
};

const preguntarMedidas = (
  chatId,
  userRegistro,
  preguntas,
  medidas,
  index = 0
) => {
  if (index >= preguntas.length) {
    return preguntarPectoral(chatId, userRegistro, medidas); // Pasar a las preguntas adicionales si aplica
  }

  const pregunta = preguntas[index];

  bot.sendMessage(
    chatId,
    `📏 ¿Cuánto mide tu *${pregunta.replace(/_/g, " ")}* en cm?`,
    { parse_mode: "Markdown" }
  );

  bot.once("message", (msg) => {
    const respuesta = parseFloat(msg.text);

    if (isNaN(respuesta)) {
      bot.sendMessage(
        chatId,
        "❌ El número debe ser válido. Inténtalo de nuevo."
      );
      return preguntarMedidas(chatId, userRegistro, preguntas, medidas, index); // Volver a preguntar la misma medida
    }

    medidas[pregunta] = respuesta;
    preguntarMedidas(chatId, userRegistro, preguntas, medidas, index + 1); // Pasar a la siguiente pregunta
  });
};

const preguntarPectoral = (chatId, userRegistro, medidas) => {
  if (userRegistro.sexo === "hombre") {
    if (!userRegistro.medidas.pectoral_inspirado) {
      bot.sendMessage(chatId, "📏 ¿Cuánto mide tu *pectoral inspirado* en cm?");
      bot.once("message", (msg) => {
        const respuesta = parseFloat(msg.text);
        if (isNaN(respuesta)) {
          bot.sendMessage(
            chatId,
            "❌ El número debe ser válido. Inténtalo de nuevo."
          );
          return preguntarPectoral(chatId, userRegistro, medidas); // Reintentar
        }
        userRegistro.medidas.pectoral_inspirado = respuesta;
        preguntarPectoral(chatId, userRegistro, medidas); // Preguntar la siguiente medida
      });
      return;
    }

    if (!userRegistro.medidas.pectoral_espirado) {
      bot.sendMessage(chatId, "📏 ¿Cuánto mide tu *pectoral espirado* en cm?");
      bot.once("message", (msg) => {
        const respuesta = parseFloat(msg.text);
        if (isNaN(respuesta)) {
          bot.sendMessage(
            chatId,
            "❌ El número debe ser válido. Inténtalo de nuevo."
          );
          return preguntarPectoral(chatId, userRegistro, medidas); // Reintentar
        }
        userRegistro.medidas.pectoral_espirado = respuesta;
        procesarDatos(chatId, userRegistro, medidas); // Pasar al cálculo de datos
      });
      return;
    }
  } else {
    procesarDatos(chatId, userRegistro, medidas); // Pasar directamente al cálculo si no es hombre
  }
};

const globalQuestions = async (chatId, userRegistro) => {
  const preguntas = [
    "hombros",
    "brazo_relajado",
    "brazo_contraido",
    "cintura",
    "cadera",
    "muslo",
    "gluteo",
    "pantorrilla",
    "pliegue cutanios biceps",
    "pliegue cutanios triceps",
    "pliegue cutanios subescapular",
    "pliegue cutanios suprailiaco",
    "nivelActividad (sedentario = 1, ligero = 2, moderado = 3, activo = 4, muy activo = 5)",
  ];

  let medidas = {};
  preguntarMedidas(chatId, userRegistro, preguntas, medidas);
};

const procesarDatos = async (chatId, userRegistro, medidas) => {
  const fechaActual = new Date().toISOString().split("T")[0].replace(/-/g, "/");

  const imc = calcularIMC(userRegistro.peso, userRegistro.estatura);
  const icc = calcularICC(medidas.cintura, medidas.cadera);
  const grasa = calcularPercentilGrasa(userRegistro.sexo, userRegistro.edad, {
    biceps: medidas.biceps,
    triceps: medidas.triceps,
    subescapular: medidas.subescapular,
    suprailiaco: medidas.suprailiaco,
  });

  const masaGrasa = calcularMasaGrasa(userRegistro.peso, grasa.porcentajeGrasa);
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

  await guardarDatos();
  await enviarDatosAGoogleSheets(userRegistro); // 🚀 Enviar datos a Google Sheets

  bot.sendMessage(chatId, "✅ Medidas registradas correctamente.");
  return bot.sendMessage(
    chatId,
    "Puedes consultar tus datos con /consultar <número>"
  );
};

const guardarDatos = async () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(usuarios, null, 2));
  } catch (error) {
    console.error("Error al guardar datos.json:", error);
  }
};

cargarDatos();

// Comando para consultar datos
bot.onText(/\/consultar (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const tlf = match[1];

  if (!usuarios[tlf]) {
    return bot.sendMessage(
      chatId,
      "❌ No hay datos registrados para esta cédula."
    );
  }

  const userData = usuarios[tlf];
  const medidas = userData.medidas || [];
  let respuesta = `📋 *Información de ${userData.nombre}:*\n\n`;
  respuesta += `📌 *Edad:* ${userData.edad} años\n`;
  respuesta += `⚧️ *Sexo:* ${userData.sexo}\n`;
  respuesta += `📏 *Estatura:* ${userData.estatura} m\n`;
  respuesta += `⚖️ *Peso:* ${userData.peso} kg\n\n`;
  respuesta += `📊 *Historial de mediciones:*\n`;

  medidas.forEach(({ fecha, imc, icc, porcentajeGrasa }) => {
    respuesta += `\n📅 *Fecha:* ${fecha}\n💪 *IMC:* ${imc}\n📏 *ICC:* ${icc}\n🔥 *Grasa Corporal:* ${porcentajeGrasa}%`;
  });

  bot.sendMessage(chatId, respuesta, { parse_mode: "Markdown" });
});

// Iniciar conversación
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🔍 Ingresa tu *Número de teléfono* para iniciar el registro:",
    { parse_mode: "Markdown" }
  );
});

// Manejo del registro paso a paso
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (!usuarios[chatId]) {
    usuarios[chatId] = { tlf: null, confirmado: false };
  }

  let userData = usuarios[chatId];

  if (!userData.tlf) {
    if (isNaN(text)) {
      return bot.sendMessage(
        chatId,
        "❌ El número debe ser válido. Inténtalo de nuevo."
      );
    }
    userData.tlf = text;
    return bot.sendMessage(
      chatId,
      `🔍 Confirmas que tu número es *${text}*?\n\nResponde *Sí* o *No*`,
      { parse_mode: "Markdown" }
    );
  }

  if (!userData.confirmado) {
    if (text.toLowerCase() === "si") {
      userData.confirmado = true;
      usuarios[userData.tlf] = {
        nombre: null,
        estatura: null,
        sexo: null,
        edad: null,
        peso: null,
        medidas: [],
      };
      return bot.sendMessage(
        chatId,
        "✅ Número confirmado. ¿Cuál es tu *nombre y apellido*?",
        { parse_mode: "Markdown" }
      );
    } else {
      userData.tlf = null;
      return bot.sendMessage(
        chatId,
        "❌ Número incorrecto. Ingresa nuevamente:"
      );
    }
  }

  const tlf = userData.tlf;
  const userRegistro = usuarios[tlf];

  if (!userRegistro.nombre) {
    userRegistro.nombre = text;
    return bot.sendMessage(chatId, "📏 ¿Cuál es tu *estatura* en metros?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.estatura) {
    userRegistro.estatura = parseFloat(text);
    return bot.sendMessage(chatId, "⚧️ ¿Cuál es tu *sexo*? (Hombre/Mujer)", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.sexo) {
    userRegistro.sexo = text.toLowerCase();
    return bot.sendMessage(chatId, "🎂 ¿Cuál es tu *edad*?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.edad) {
    userRegistro.edad = parseInt(text);
    return bot.sendMessage(chatId, "⚖️ ¿Cuál es tu *peso corporal* en kg?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.peso) {
    userRegistro.peso = parseFloat(text);
    await globalQuestions(chatId, userRegistro);
  }
});
