import { useId } from "react";

/**
 * Slider de limite. O valor exibido vem direto do store (`value`),
 * então mover o slider atualiza o número ao vivo em toda a UI.
 */
export default function ThresholdSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  scale,
  disabled = false,
}) {
  const id = useId();
  const [minLabel, maxLabel] = scale ?? [`${min}${unit}`, `${max}${unit}`];

  return (
    <div>
      <div className="slider-head">
        <label className="slider-label" htmlFor={id}>
          {label}
        </label>
        <span className="slider-value">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="slider-scale">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
