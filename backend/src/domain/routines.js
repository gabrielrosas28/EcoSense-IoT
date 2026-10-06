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
export function conditionHolds({ sensor, operator, value }, reading) {
  if (reading === undefined || reading === null) return false;
  const current = Number(reading);
  if (operator === "lt") return current < value;
  if (operator === "gt") return current > value;
  // Umidade chega com casas decimais (30,04; 29,97): "igual a 30" vale na faixa
  // de meio ponto em volta, senão a rotina quase nunca dispararia.
  if (CONTINUOUS_SENSORS.has(sensor)) return Math.abs(current - value) <= EQ_TOLERANCE;
  return current === value;
}

/** Sensores de leitura contínua, em que "igual a" é uma faixa e não um valor exato. */
const CONTINUOUS_SENSORS = new Set(["soil", "air"]);
const EQ_TOLERANCE = 0.5;

/**
 * A condição passou a valer entre a leitura de antes e a de agora (a BORDA que
 * dispara a rotina)? Em "igual a" de umidade, a leitura pode pular a faixa de
 * um status para o outro (30,6 → 29,4): ter passado pelo valor também conta.
 */
export function conditionReached(routine, before, now) {
  if (conditionHolds(routine, before)) return false;
  if (conditionHolds(routine, now)) return true;
  if (routine.operator !== "eq" || !CONTINUOUS_SENSORS.has(routine.sensor)) return false;
  if (before === undefined || before === null || now === undefined || now === null) return false;
  return (Number(before) - routine.value) * (Number(now) - routine.value) < 0;
}

/** "umidade do solo menor que 30%", "presença não detectada", "horário igual a 7h". */
export function describeCondition({ sensor, operator, value }) {
  if (sensor === "presenca") return value === 1 ? "presença detectada" : "presença não detectada";
  return `${SENSOR_LABELS[sensor]} ${OPERATOR_LABELS[operator]} ${value}${UNITS[sensor]}`;
}
