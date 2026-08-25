import { useDevices } from "../store/useDevices";

/** Feedback curto — ex.: "Enviado por IR: HDMI 1". */
export default function Toasts() {
  const toasts = useDevices((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}
