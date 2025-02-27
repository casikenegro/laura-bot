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
  porcentajeGrasa = Math.max(3, Math.min(50, porcentajeGrasa)); // Limitar a valores realistas

  // **Clasificación de grasa corporal basada en Frisancho**
  let percentil;
  if (sexo === "hombre") {
    if (sumaPliegues < 20) percentil = "< 5% (Muy bajo)";
    else if (sumaPliegues < 40) percentil = "5-15% (Bajo)";
    else if (sumaPliegues < 60) percentil = "15-50% (Normal)";
    else if (sumaPliegues < 80) percentil = "50-85% (Sobrepeso)";
    else percentil = "> 85% (Obesidad)";
  } else {
    if (sumaPliegues < 30) percentil = "< 5% (Muy bajo)";
    else if (sumaPliegues < 50) percentil = "5-15% (Bajo)";
    else if (sumaPliegues < 70) percentil = "15-50% (Normal)";
    else if (sumaPliegues < 90) percentil = "50-85% (Sobrepeso)";
    else percentil = "> 85% (Obesidad)";
  }

  return { porcentajeGrasa: porcentajeGrasa.toFixed(2), percentil };
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
