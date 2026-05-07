export default function StatusBanner({ type = "info", children }) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900"
  };
  return <div className={`rounded-md border px-3 py-2 text-sm font-medium ${styles[type]}`}>{children}</div>;
}
