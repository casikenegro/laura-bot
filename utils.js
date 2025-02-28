const calcularMasaGrasa = (peso, porcentajeGrasa) => {
  return ((porcentajeGrasa / 100) * peso).toFixed(2);
};

const calcularMasaLibreGrasa = (peso, masaGrasa) => {
  return (peso - masaGrasa).toFixed(2);
};

const calcularConsumoProteinas = (masaMagra, factor = 2) => {
  return (masaMagra * factor).toFixed(2);
};

const calcularMasaMuscular = (masaLibreGrasa) => {
  return (masaLibreGrasa * 0.52).toFixed(2);
};

const calcularGastoEnergeticoBasal = (peso, estatura, edad, sexo) => {
  if (sexo === "hombre") {
    return (66 + 13.7 * peso + 5 * estatura * 100 - 6.8 * edad).toFixed(2);
  } else {
    return (655 + 9.6 * peso + 1.8 * estatura * 100 - 4.7 * edad).toFixed(2);
  }
};

const calcularETA = (GEB) => {
  return (GEB * 0.1).toFixed(2);
};

const calcularGEB_ETA = (GEB, ETA) => {
  return (parseFloat(GEB) + parseFloat(ETA)).toFixed(2);
};

const calcularGAF = (nivelActividad) => {
  const factores = [1.2, 1.375, 1.55, 1.725];
  return factores[nivelActividad - 1] || 1.2;
};

const calcularCaloriasTotales = (GEB_ETA, GAF) => {
  return (GEB_ETA * GAF).toFixed(2);
};

const calcularCaloriasRequeridas = (caloriasTotales, variacion) => {
  return (parseFloat(caloriasTotales) + variacion).toFixed(2);
};

// Funciones auxiliares
const calcularIMC = (peso, estatura) => {
  const result = (peso / (estatura * estatura)).toFixed(2);
  if (result <= 18.5) return `bajo peso =${result}`;
  if (result > 18.5 && result <= 24.9) return `resultado normal =${result}`;
  if (result > 24.9 && result <= 29.9) return `resultado sobrepeso =${result}`;
  if (result > 29.9 && result <= 34.9) return `resultado obesidad 1 =${result}`;
  if (result > 34.9 && result <= 39.9) return `resultado obesidad 2 =${result}`;
  if (result > 39.9 && result <= 49.9) return `resultado obesidad 3 =${result}`;
  if (result > 50) return `resultado obesidad 4 =${result}`;
};
const calcularICC = (cintura, cadera) => (cintura / cadera).toFixed(2);

const calcularPercentilGrasa = (sexo, edad, pliegues) => {
  const sumaPliegues =
    pliegues.biceps +
    pliegues.triceps +
    pliegues.subescapular +
    pliegues.suprailiaco;

  if (sumaPliegues <= 0) {
    return { error: "La suma de pliegues debe ser mayor que cero." };
  }

  // Coeficientes Durnin & Womersley
  const coeficientes = {
    hombre: [
      { edadMax: 19, a: 1.162, b: 0.063 },
      { edadMax: 29, a: 1.1631, b: 0.0632 },
      { edadMax: 39, a: 1.1422, b: 0.0544 },
      { edadMax: 49, a: 1.162, b: 0.07 },
    ],
    mujer: [
      { edadMax: 19, a: 1.159, b: 0.0717 },
      { edadMax: 29, a: 1.1599, b: 0.0717 },
      { edadMax: 39, a: 1.1423, b: 0.0682 },
      { edadMax: 49, a: 1.133, b: 0.0612 },
    ],
  };

  // Seleccionar coeficientes según la edad
  const { a, b } =
    coeficientes[sexo].find((c) => edad <= c.edadMax) ||
    coeficientes[sexo].slice(-1)[0];

  // Calcular densidad corporal
  const densidadCorporal = a - b * Math.log10(sumaPliegues);

  // Calcular porcentaje de grasa usando la ecuación de Siri
  let porcentajeGrasa = 495 / densidadCorporal - 450;
  porcentajeGrasa = Math.max(3, Math.min(50, porcentajeGrasa)).toFixed(2); // Limitar a valores realistas

  // **Clasificación de grasa corporal basada en Frisancho**
  let percentil = obtenerPercentil(sexo, edad, porcentajeGrasa);
  let interpretacion = `el percentil es : ${percentil}`;
  if (percentil <= 5) interpretacion += `, magro`;
  if (percentil > 5 && percentil <= 15)
    interpretacion += `, grasa debajo del promedio`;
  if (percentil > 15 && percentil <= 75) interpretacion += `, grasa promedio`;
  if (percentil > 75 && percentil <= 85)
    interpretacion += `, grasa arriba del promedio`;
  if (percentil > 85) interpretacion += `, exceso de grasa`;

  return { porcentajeGrasa, percentil: interpretacion };
};

const obtenerPercentil = (sexo, edad, porcentajeGrasa) => {
  const tablas = {
    hombre: [
      { rango: [18, 24], valores: [8, 9, 10, 12, 16, 20, 23, 25, 26, 28] },
      { rango: [25, 29], valores: [9, 10, 11, 13, 18, 23, 25, 26, 29, 29] },
      { rango: [30, 34], valores: [16, 17, 18, 20, 23, 26, 27, 28, 30, 30] },
      { rango: [35, 39], valores: [15, 17, 18, 20, 23, 25, 27, 27, 29, 29] },
      { rango: [40, 44], valores: [14, 16, 18, 21, 26, 30, 32, 34, 36, 36] },
      { rango: [45, 49], valores: [15, 17, 19, 21, 26, 30, 32, 34, 36, 36] },
      { rango: [50, 54], valores: [15, 17, 19, 22, 27, 31, 33, 35, 37, 37] },
      { rango: [55, 59], valores: [15, 18, 20, 22, 27, 31, 33, 35, 37, 37] },
    ],
    mujer: [
      { rango: [18, 24], valores: [17, 19, 21, 23, 27, 33, 35, 37, 40, 40] },
      { rango: [25, 29], valores: [18, 20, 21, 24, 29, 34, 37, 39, 41, 41] },
      { rango: [30, 34], valores: [21, 23, 25, 27, 31, 36, 38, 40, 42, 42] },
      { rango: [35, 39], valores: [22, 24, 25, 28, 32, 37, 39, 40, 42, 42] },
      { rango: [40, 44], valores: [25, 28, 29, 31, 35, 39, 41, 42, 43, 43] },
      { rango: [45, 49], valores: [26, 28, 29, 32, 36, 39, 41, 42, 44, 44] },
      { rango: [50, 54], valores: [27, 30, 32, 35, 39, 43, 46, 47, 48, 48] },
      { rango: [55, 59], valores: [27, 30, 32, 35, 39, 44, 45, 47, 49, 49] },
    ],
  };

  const rangoEncontrado = tablas[sexo].find(
    (rango) => edad >= rango.rango[0] && edad <= rango.rango[1]
  );

  if (!rangoEncontrado) {
    return "Edad fuera de rango";
  }

  const valoresPercentil = rangoEncontrado.valores;
  let percentil;

  if (porcentajeGrasa <= valoresPercentil[0]) percentil = 5;
  else if (porcentajeGrasa <= valoresPercentil[1]) percentil = 10;
  else if (porcentajeGrasa <= valoresPercentil[2]) percentil = 15;
  else if (porcentajeGrasa <= valoresPercentil[3]) percentil = 25;
  else if (porcentajeGrasa <= valoresPercentil[4]) percentil = 50;
  else if (porcentajeGrasa <= valoresPercentil[5]) percentil = 75;
  else if (porcentajeGrasa <= valoresPercentil[6]) percentil = 85;
  else if (porcentajeGrasa <= valoresPercentil[7]) percentil = 90;
  else if (porcentajeGrasa <= valoresPercentil[8]) percentil = 95;
  else percentil = 95;

  return percentil;
};

module.exports = {
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
};
