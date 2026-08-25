import { useState } from "react";
import { DEVICE_ORDER, useDevices } from "../store/useDevices";
import {
  ACTIONS,
  OPERATORS,
  SENSORS,
  describeRoutine,
  useRoutines,
} from "../store/useRoutines";
import PageHeader from "../components/PageHeader";
import Switch from "../components/Switch";
import { IconTrash } from "../components/Icons";

const emptyDraft = {
  sensor: "soil",
  operator: "lt",
  value: 30,
  action: "on",
  device: "irrigacao",
};

export default function Rotinas() {
  const devices = useDevices((s) => s.devices);
  const routines = useRoutines((s) => s.routines);
  const add = useRoutines((s) => s.add);
  const toggle = useRoutines((s) => s.toggle);
  const remove = useRoutines((s) => s.remove);
  const [draft, setDraft] = useState(emptyDraft);

  const isPresenca = draft.sensor === "presenca";

  function update(patch) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    add({ ...draft, value: Number(draft.value) });
    setDraft(emptyDraft);
  }

  return (
    <>
      <PageHeader
        title="Rotinas"
        subtitle="Regras SE → ENTÃO entre sensores e dispositivos"
      >
        <span className="pill on">{routines.filter((r) => r.enabled).length} ativas</span>
      </PageHeader>

      <div className="stack">
        <section className="card">
          <div style={{ marginBottom: 16 }}>
            <h2 className="card-title">Nova rotina</h2>
            <p className="card-hint">Se a condição for verdadeira, o dispositivo é acionado.</p>
          </div>

          <form className="builder" onSubmit={handleSubmit}>
            <label className="field">
              <span>SE</span>
              <select
                value={draft.sensor}
                onChange={(e) => update({ sensor: e.target.value })}
              >
                {SENSORS.map((sensor) => (
                  <option key={sensor.id} value={sensor.id}>
                    {sensor.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Operador</span>
              <select
                value={isPresenca ? "eq" : draft.operator}
                disabled={isPresenca}
                onChange={(e) => update({ operator: e.target.value })}
              >
                {OPERATORS.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Valor</span>
              {isPresenca ? (
                <select
                  value={draft.value}
                  onChange={(e) => update({ value: Number(e.target.value) })}
                >
                  <option value={1}>detectada</option>
                  <option value={0}>não detectada</option>
                </select>
              ) : (
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.value}
                  onChange={(e) => update({ value: e.target.value })}
                />
              )}
            </label>

            <label className="field">
              <span>ENTÃO</span>
              <select value={draft.action} onChange={(e) => update({ action: e.target.value })}>
                {ACTIONS.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Dispositivo</span>
              <select value={draft.device} onChange={(e) => update({ device: e.target.value })}>
                {DEVICE_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {devices[id].name}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn">
              Adicionar rotina
            </button>
          </form>
        </section>

        <section className="card">
          <div style={{ marginBottom: 4 }}>
            <h2 className="card-title">Rotinas configuradas</h2>
            <p className="card-hint">Desative sem apagar usando o interruptor.</p>
          </div>

          {routines.length === 0 ? (
            <p className="empty">Nenhuma rotina ainda. Crie a primeira acima.</p>
          ) : (
            <div>
              {routines.map((routine) => {
                const { condition, consequence } = describeRoutine(routine, devices);
                return (
                  <div key={routine.id} className={`rule${routine.enabled ? "" : " off"}`}>
                    <span
                      className="event-bullet"
                      style={{
                        margin: 0,
                        background: routine.enabled
                          ? devices[routine.device]?.accent ?? "var(--green)"
                          : "var(--tint-gray)",
                      }}
                    />
                    <p className="rule-text">
                      Se <strong>{condition}</strong> → <strong>{consequence}</strong>
                    </p>
                    <Switch
                      checked={routine.enabled}
                      label={`${routine.enabled ? "Desativar" : "Ativar"} rotina`}
                      onChange={() => toggle(routine.id)}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Excluir rotina"
                      onClick={() => remove(routine.id)}
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
