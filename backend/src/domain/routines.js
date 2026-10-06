export const ROUTINE_SENSORS = ["soil", "air", "presenca", "hora"];
export const ROUTINE_OPERATORS = ["lt", "gt", "eq"];
export const ROUTINE_ACTIONS = ["on", "off"];

const RANGES = {
  soil: [0, 100],
  air: [0, 100],
  hora: [0, 23],
};

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

const SENSOR_LABELS = { soil: "umidade do solo", air: "umidade do ar", presenca: "presença", hora: "horário" };
const OPERATOR_LABELS = { lt: "menor que", gt: "maior que", eq: "igual a" };
const UNITS = { soil: "%", air: "%", hora: "h" };

export function conditionHolds({ sensor, operator, value }, reading) {
  if (reading === undefined || reading === null) return false;
  const current = Number(reading);
  if (operator === "lt") return current < value;
  if (operator === "gt") return current > value;
  if (CONTINUOUS_SENSORS.has(sensor)) return Math.abs(current - value) <= EQ_TOLERANCE;
  return current === value;
}

const CONTINUOUS_SENSORS = new Set(["soil", "air"]);
const EQ_TOLERANCE = 0.5;

export function conditionReached(routine, before, now) {
  if (conditionHolds(routine, before)) return false;
  if (conditionHolds(routine, now)) return true;
  if (routine.operator !== "eq" || !CONTINUOUS_SENSORS.has(routine.sensor)) return false;
  if (before === undefined || before === null || now === undefined || now === null) return false;
  return (Number(before) - routine.value) * (Number(now) - routine.value) < 0;
}

export function describeCondition({ sensor, operator, value }) {
  if (sensor === "presenca") return value === 1 ? "presença detectada" : "presença não detectada";
  return `${SENSOR_LABELS[sensor]} ${OPERATOR_LABELS[operator]} ${value}${UNITS[sensor]}`;
}
