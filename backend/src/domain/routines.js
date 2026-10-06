/**
 * Vocabulário do construtor SE → ENTÃO, igual ao do frontend
 * (store/useRoutines.js: SENSORS, OPERATORS e ACTIONS).
 */
export const ROUTINE_SENSORS = ["soil", "air", "presenca", "hora"];
export const ROUTINE_OPERATORS = ["lt", "gt", "eq"];
export const ROUTINE_ACTIONS = ["on", "off"];

/** Faixa de valores que faz sentido para cada sensor numérico. */
const RANGES = {
  soil: [0, 100], // umidade do solo, %
  air: [0, 100], // umidade do ar, %
  hora: [0, 23], // hora do dia
};

/**
 * Regras que dependem de mais de um campo. Devolve os problemas no formato de
 * erro da API (`[{ campo, erro }]`), ou lista vazia se a rotina for válida.
 */
export function routineProblems({ sensor, operator, value }) {
  if (sensor === "presenca") {
    const problems = [];
    if (operator !== "eq") {
      problems.push({ campo: "operator", erro: "presença só aceita o operador eq (igual a)" });
    }
    if (value !== 0 && value !== 1) {
      problems.push({ campo: "value", erro: "presença é 1 (detectada) ou 0 (não detectada)" });
    }
    return problems;
  }

  const [min, max] = RANGES[sensor];
  if (value < min || value > max) {
    return [{ campo: "value", erro: `o valor de ${sensor} vai de ${min} a ${max}` }];
  }
  return [];
}

/** Como cada sensor aparece no histórico ("umidade do solo menor que 30%"). */
const SENSOR_LABELS = { soil: "umidade do solo", air: "umidade do ar", presenca: "presença", hora: "horário" };
const OPERATOR_LABELS = { lt: "menor que", gt: "maior que", eq: "igual a" };
const UNITS = { soil: "%", air: "%", hora: "h" };

/**
 * A condição vale para este valor do sensor? Presença chega como booleano no
 * status e é comparada como 1/0, o mesmo número que a rotina guarda. Sem
 * leitura (`undefined`), a condição não vale.
 */
export function conditionHolds({ operator, value }, reading) {
  if (reading === undefined || reading === null) return false;
  const current = Number(reading);
  if (operator === "lt") return current < value;
  if (operator === "gt") return current > value;
  return current === value;
}

/** "umidade do solo menor que 30%", "presença não detectada", "horário igual a 7h". */
export function describeCondition({ sensor, operator, value }) {
  if (sensor === "presenca") return value === 1 ? "presença detectada" : "presença não detectada";
  return `${SENSOR_LABELS[sensor]} ${OPERATOR_LABELS[operator]} ${value}${UNITS[sensor]}`;
}
