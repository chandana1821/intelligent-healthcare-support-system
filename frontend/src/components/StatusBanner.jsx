import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export default function StatusBanner({ type = "info", children }) {
  const styles = {
    info: "border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50 text-blue-950 shadow-blue-900/5",
    error: "border-red-200 bg-gradient-to-r from-red-50 to-orange-50 text-red-950 shadow-red-900/5",
    success: "border-green-200 bg-gradient-to-r from-green-50 to-teal-50 text-green-950 shadow-green-900/5"
  };
  const Icon = type === "error" ? AlertTriangle : type === "success" ? CheckCircle2 : Info;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm ${styles[type]}`}>
      <Icon className="mt-0.5 shrink-0" size={16} />
      <span>{children}</span>
    </div>
  );
}
