import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarClock, CalendarDays, ClipboardList, Star } from "lucide-react";
import { api } from "../api/client";
import StatusBanner from "../components/StatusBanner";

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status) {
  if (status === "completed") return "bg-green-50 text-green-700 ring-green-100";
  if (status === "cancelled") return "bg-red-50 text-red-700 ring-red-100";
  if (status === "follow-up required") return "bg-purple-50 text-purple-700 ring-purple-100";
  return "bg-blue-50 text-blue-700 ring-blue-100";
}

function EmptyState({ message }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">{message}</div>;
}

function AppointmentTable({ rows, mode, cancellingId, onCancel }) {
  const todayMode = mode === "today";
  if (!rows.length) {
    return <EmptyState message={todayMode ? "No appointments scheduled for today." : "No upcoming appointments after today."} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            {!todayMode && <th className="p-3">Date</th>}
            <th className="p-3">Time</th>
            <th className="p-3">Patient</th>
            <th className="p-3">Reason</th>
            <th className="p-3">Status</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row._id} className={`border-t border-slate-100 ${index === 0 ? "bg-blue-50/70" : ""}`}>
              {!todayMode && <td className="p-3 font-semibold text-slate-700">{formatDate(row.scheduled_for)}</td>}
              <td className="p-3 font-black text-blue-800">{formatTime(row.scheduled_for)}</td>
              <td className="p-3 font-semibold text-slate-900">{row.patient_name || row.patient_email}</td>
              <td className="max-w-md p-3 text-slate-600">{row.reason || "-"}</td>
              <td className="p-3">
                <span className={`inline-flex rounded-md px-2 py-1 text-xs font-black ring-1 ${statusClass(row.status)}`}>
                  {row.status || "booked"}
                </span>
              </td>
              <td className="p-3">
                <button
                  type="button"
                  disabled={cancellingId === row._id}
                  onClick={() => onCancel(row)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Ban size={13} />
                  {cancellingId === row._id ? "Cancelling" : "Cancel"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DoctorAppointments() {
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setStatus("");
    Promise.all([
      api.get("/appointments/today"),
      api.get("/appointments/upcoming"),
    ])
      .then(([todayResponse, upcomingResponse]) => {
        if (!active) return;
        setTodayAppointments(todayResponse.data);
        setUpcomingAppointments(upcomingResponse.data);
      })
      .catch(() => {
        if (active) setError("Could not load doctor appointments.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const nextAppointment = useMemo(() => todayAppointments[0] || upcomingAppointments[0] || null, [todayAppointments, upcomingAppointments]);

  const cancelAppointment = async (appointment) => {
    const ok = window.confirm(`Cancel appointment for ${appointment.patient_name || appointment.patient_email}? This will remove it from patient and doctor history.`);
    if (!ok) return;
    setError("");
    setStatus("");
    setCancellingId(appointment._id);
    try {
      await api.delete(`/appointments/${appointment._id}`);
      setTodayAppointments((items) => items.filter((item) => item._id !== appointment._id));
      setUpcomingAppointments((items) => items.filter((item) => item._id !== appointment._id));
      setStatus("Appointment cancelled and removed from all dashboards.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not cancel appointment.");
    } finally {
      setCancellingId("");
    }
  };

  return (
    <section className="space-y-5">
      <div className="panel p-5">
        <div className="section-title">
          <span className="icon-badge"><ClipboardList size={22} /></span>
          <div>
            <h2 className="text-xl font-black">Doctor Appointments</h2>
            <p className="text-sm text-slate-600">Prioritized schedule view for patient care.</p>
          </div>
        </div>
      </div>

      {error && <StatusBanner type="error">{error}</StatusBanner>}
      {status && <StatusBanner type="success">{status}</StatusBanner>}

      {loading ? (
        <div className="panel p-5 text-sm font-semibold text-slate-500">Loading appointments...</div>
      ) : (
        <>
          {nextAppointment && (
            <div className="panel border-blue-200 bg-blue-50 p-5">
              <div className="mb-3 flex items-center gap-2 text-blue-900">
                <Star size={18} className="fill-blue-600 text-blue-600" />
                <h3 className="text-lg font-black">Next Appointment</h3>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs font-black uppercase text-slate-500">Date</p><p className="font-bold">{formatDate(nextAppointment.scheduled_for)}</p></div>
                <div><p className="text-xs font-black uppercase text-slate-500">Time</p><p className="font-bold text-blue-800">{formatTime(nextAppointment.scheduled_for)}</p></div>
                <div><p className="text-xs font-black uppercase text-slate-500">Patient</p><p className="font-bold">{nextAppointment.patient_name || nextAppointment.patient_email}</p></div>
                <div><p className="text-xs font-black uppercase text-slate-500">Status</p><p className="font-bold">{nextAppointment.status || "booked"}</p></div>
              </div>
              <p className="mt-3 text-sm text-slate-700">{nextAppointment.reason || "No reason provided."}</p>
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="border-b border-slate-200 p-4">
              <div className="section-title">
                <span className="icon-badge-soft"><CalendarClock size={18} /></span>
                <div>
                  <h3 className="text-lg font-black">Today's Appointments</h3>
                  <p className="text-sm text-slate-500">Sorted by nearest time first.</p>
                </div>
              </div>
            </div>
            <AppointmentTable rows={todayAppointments} mode="today" cancellingId={cancellingId} onCancel={cancelAppointment} />
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-slate-200 p-4">
              <div className="section-title">
                <span className="icon-badge-soft"><CalendarDays size={18} /></span>
                <div>
                  <h3 className="text-lg font-black">Upcoming Appointments</h3>
                  <p className="text-sm text-slate-500">Future appointments after today, in chronological order.</p>
                </div>
              </div>
            </div>
            <AppointmentTable rows={upcomingAppointments} mode="upcoming" cancellingId={cancellingId} onCancel={cancelAppointment} />
          </div>
        </>
      )}
    </section>
  );
}
