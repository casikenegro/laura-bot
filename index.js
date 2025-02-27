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

const GOOGLE_SHEETS_URL = `https://script.google.com/macros/s/AKfycbxKWby-WfrBloeMZHvrsPnssNCtZPmnEoVoo_i5A-f9wKfWjSmQzQxJRUut802rP_bc/exec`;
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

let usuarios = {}; // Usamos solo en memoria

const procesarDatos = async (chatId, userRegistro) => {
  console.log(userRegistro);

  const fechaActual = new Date().toISOString().split("T")[0].replace(/-/g, "/");

  // Calculando valores
  const imc = calcularIMC(userRegistro.peso, userRegistro.estatura);
  const icc = calcularICC(userRegistro.cintura, userRegistro.cadera);
  const grasa = calcularPercentilGrasa(userRegistro.sexo, userRegistro.edad, {
    biceps: userRegistro.biceps,
    triceps: userRegistro.triceps,
    subescapular: userRegistro.subescapular,
    suprailiaco: userRegistro.suprailiaco,
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
  let respuesta = `📋 *Información de ${userData.nombre}:*\n\n`;
  respuesta += `📌 *Edad:* ${userData.edad} años\n`;
  respuesta += `⚧️ *Sexo:* ${userData.sexo}\n`;
  respuesta += `📏 *Estatura:* ${userData.estatura} m\n`;
  respuesta += `⚖️ *Peso:* ${userData.peso} kg\n\n`;
  respuesta += `📊 *Historial de mediciones:*\n`;
  respuesta += `\n📅 *Fecha:* ${userData.fecha}\n💪 *IMC:* ${userData.imc}\n📏 *ICC:* ${userData.icc}\n🔥 *Grasa Corporal:* ${userData.porcentajeGrasa}%`;

  bot.sendMessage(chatId, respuesta, { parse_mode: "Markdown" });
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Inicializa datos de usuario si es la primera vez que interactúa
  if (!usuarios[chatId]) {
    usuarios[chatId] = { tlf: null, confirmado: false };
  }

  let userData = usuarios[chatId];

  if (text.toLowerCase() === "/start") {
    delete usuarios[chatId]; // Elimina los datos actuales del usuario
    usuarios[chatId] = { tlf: null, confirmado: false }; // Reinicia el proceso
    return bot.sendMessage(
      chatId,
      "🔄 El proceso ha sido reiniciado. Inicia de nuevo ingresando tu número de teléfono."
    );
  }

  // Validación del número de teléfono
  if (!userData.tlf) {
    if (!/^\d{10,}$/.test(text)) {
      return bot.sendMessage(
        chatId,
        "❌ El número debe ser válido (al menos 10 dígitos). Inténtalo de nuevo."
      );
    }
    userData.tlf = text;
    return bot.sendMessage(
      chatId,
      `🔍 Confirmas que tu número es *${text}*?\n\nResponde *Sí* o *No*`,
      { parse_mode: "Markdown" }
    );
  }

  // Confirmación del número
  if (!userData.confirmado) {
    if (text.toLowerCase() === "si") {
      userData.confirmado = true;
      // Inicialización del registro del usuario
      usuarios[userData.tlf] = {
        telefono: userData.tlf,
        nombre: null,
        estatura: null,
        sexo: null,
        edad: null,
        peso: null,
        hombros: null,
        brazo_relajado: null,
        brazo_contraido: null,
        cintura: null,
        cadera: null,
        muslo: null,
        gluteo: null,
        pantorrilla: null,
        pliegue_cutanios_biceps: null,
        pliegue_cutanios_triceps: null,
        pliegue_cutanios_subescapular: null,
        pliegue_cutanios_suprailiaco: null,
        pectoral_inspirado: null,
        pectoral_espirado: null,
        fecha: null,
        imc: null,
        icc: null,
        iccDiagnostico: null,
        percentilGrasa: null,
        porcentajeGrasa: null,
        masaGrasa: null,
        masaLibreGrasa: null,
        consumoProteinas: null,
        masaMuscular: null,
        GEB: null,
        ETA: null,
        GEB_ETA: null,
        GAF: null,
        caloriasTotales: null,
        caloriasRequeridas: null,
      };
      return bot.sendMessage(
        chatId,
        "✅ Número confirmado. ¿Cuál es tu *nombre y apellido*?",
        { parse_mode: "Markdown" }
      );
    } else if (text.toLowerCase() === "no") {
      userData.tlf = null;
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

  const tlf = userData.tlf;
  const userRegistro = usuarios[tlf];

  // Comienza a preguntar datos personales y medidas
  if (!userRegistro.nombre) {
    if (!/^[a-zA-Z\s]+$/.test(text)) {
      return bot.sendMessage(
        chatId,
        "❌ El nombre debe contener solo letras y espacios. Inténtalo de nuevo."
      );
    }
    userRegistro.nombre = text;
    return bot.sendMessage(chatId, "📏 ¿Cuál es tu *estatura* en metros?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.estatura) {
    const estatura = parseFloat(text);
    if (isNaN(estatura) || estatura <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La estatura debe ser un número válido mayor que 0. Inténtalo de nuevo."
      );
    }
    userRegistro.estatura = estatura;
    return bot.sendMessage(chatId, "⚧️ ¿Cuál es tu *sexo*? (Hombre/Mujer)", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.sexo) {
    const sexoValidos = ["hombre", "mujer"];
    if (!sexoValidos.includes(text.toLowerCase())) {
      return bot.sendMessage(
        chatId,
        "❌ Ingresa un sexo válido: *Hombre* o *Mujer*."
      );
    }
    userRegistro.sexo = text.toLowerCase();
    return bot.sendMessage(chatId, "🎂 ¿Cuál es tu *edad*?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.edad) {
    const edad = parseInt(text);
    if (isNaN(edad) || edad <= 0 || edad > 150) {
      return bot.sendMessage(
        chatId,
        "❌ La edad debe ser un número válido entre 1 y 150. Inténtalo de nuevo."
      );
    }
    userRegistro.edad = edad;
    return bot.sendMessage(chatId, "⚖️ ¿Cuál es tu *peso corporal* en kg?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.peso) {
    const peso = parseFloat(text);
    if (isNaN(peso) || peso <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ El peso debe ser un número válido mayor que 0. Inténtalo de nuevo."
      );
    }
    userRegistro.peso = peso;
    return bot.sendMessage(
      chatId,
      "💪 ¿Cuál es tu *medida de hombros* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (!userRegistro.hombros) {
    const hombros = parseFloat(text);
    if (isNaN(hombros) || hombros <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La medida de hombros debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.hombros = hombros;
    return bot.sendMessage(
      chatId,
      "💪 ¿Cuál es tu *medida de brazo relajado* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (!userRegistro.brazo_relajado) {
    const brazoRelajado = parseFloat(text);
    if (isNaN(brazoRelajado) || brazoRelajado <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La medida del brazo relajado debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.brazo_relajado = brazoRelajado;
    return bot.sendMessage(
      chatId,
      "💪 ¿Cuál es tu *medida de brazo contraído* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (!userRegistro.brazo_contraido) {
    const brazoContraido = parseFloat(text);
    if (isNaN(brazoContraido) || brazoContraido <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La medida del brazo contraído debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.brazo_contraido = brazoContraido;
    return bot.sendMessage(chatId, "📏 ¿Cuál es tu *cintura* en cm?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.cintura) {
    const cintura = parseFloat(text);
    if (isNaN(cintura) || cintura <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La medida de la cintura debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.cintura = cintura;
    return bot.sendMessage(chatId, "📏 ¿Cuál es tu *cadera* en cm?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.cadera) {
    const cadera = parseFloat(text);
    if (isNaN(cadera) || cadera <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La medida de la cadera debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.cadera = cadera;
    return bot.sendMessage(chatId, "📏 ¿Cuál es tu *muslo* en cm?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.muslo) {
    const muslo = parseFloat(text);
    if (isNaN(muslo) || muslo <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La medida del muslo debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.muslo = muslo;
    return bot.sendMessage(chatId, "🍑 ¿Cuál es tu *glúteo* en cm?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.gluteo) {
    const gluteo = parseFloat(text);
    if (isNaN(gluteo) || gluteo <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La medida del glúteo debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.gluteo = gluteo;
    return bot.sendMessage(chatId, "🦵 ¿Cuál es tu *pantorrilla* en cm?", {
      parse_mode: "Markdown",
    });
  } else if (!userRegistro.pantorrilla) {
    const pantorrilla = parseFloat(text);
    if (isNaN(pantorrilla) || pantorrilla <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ La medida de la pantorrilla debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.pantorrilla = pantorrilla;
    return bot.sendMessage(
      chatId,
      "💪 ¿Cuál es tu *pliegue cutáneo en biceps* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (!userRegistro.pliegue_cutanios_biceps) {
    const biceps = parseFloat(text);
    if (isNaN(biceps) || biceps <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ El pliegue cutáneo en bíceps debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.pliegue_cutanios_biceps = biceps;
    return bot.sendMessage(
      chatId,
      "💪 ¿Cuál es tu *pliegue cutáneo en triceps* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (!userRegistro.pliegue_cutanios_triceps) {
    const triceps = parseFloat(text);
    if (isNaN(triceps) || triceps <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ El pliegue cutáneo en tríceps debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.pliegue_cutanios_triceps = triceps;
    return bot.sendMessage(
      chatId,
      "💪 ¿Cuál es tu *pliegue cutáneo en subescapular* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (!userRegistro.pliegue_cutanios_subescapular) {
    const subescapular = parseFloat(text);
    if (isNaN(subescapular) || subescapular <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ El pliegue cutáneo en subescapular debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.pliegue_cutanios_subescapular = subescapular;
    return bot.sendMessage(
      chatId,
      "💪 ¿Cuál es tu *pliegue cutáneo en suprailiaco* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (!userRegistro.pliegue_cutanios_suprailiaco) {
    const suprailiaco = parseFloat(text);
    if (isNaN(suprailiaco) || suprailiaco <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ El pliegue cutáneo en suprailiaco debe ser un número válido en mm. Inténtalo de nuevo."
      );
    }
    userRegistro.pliegue_cutanios_suprailiaco = suprailiaco;
  } else if (
    userRegistro.sexo === "hombre" &&
    userRegistro.pectoral_inspirado === null
  ) {
    return bot.sendMessage(
      chatId,
      "📏 ¿Cuánto mide tu *pectoral inspirado* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (
    userRegistro.sexo === "hombre" &&
    userRegistro.pectoral_inspirado === undefined
  ) {
    const pectoral = parseFloat(text);
    if (isNaN(pectoral) || pectoral <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ El pectoral inspirado debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.pectoral_inspirado = pectoral;
    return bot.sendMessage(
      chatId,
      "📏 ¿Cuánto mide tu *pectoral espirado* en cm?",
      {
        parse_mode: "Markdown",
      }
    );
  } else if (
    userRegistro.sexo === "hombre" &&
    userRegistro.pectoral_espirado === null
  ) {
    const pectoralEspirado = parseFloat(text);
    if (isNaN(pectoralEspirado) || pectoralEspirado <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ El pectoral espirado debe ser un número válido en cm. Inténtalo de nuevo."
      );
    }
    userRegistro.pectoral_espirado = pectoralEspirado;
  }

  // Procesar los datos y enviarlos a Google Sheets
  procesarDatos(chatId, userRegistro);
});
