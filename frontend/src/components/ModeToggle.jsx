const OPTIONS = [
  { id: "auto", label: "Automático" },
  { id: "manual", label: "Manual" },
];

/** Segmentado Automático/Manual — `mode` vem do store, nunca de useState local. */
export default function ModeToggle({ mode, onChange, label = "Modo de operação" }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={mode === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
