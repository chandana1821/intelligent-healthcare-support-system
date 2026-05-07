import { useEffect, useState } from "react";
import { Button, TextField } from "@mui/material";
import { Activity, BarChart3, CalendarClock, HeartPulse, IndianRupee, LineChart as LineChartIcon, Stethoscope, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import StatusBanner from "../components/StatusBanner";

export default function Dashboard() {
  const { session } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointmentFee, setAppointmentFee] = useState("");
  const [feeStatus, setFeeStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (session.role === "patient") {
      api.get("/appointments").then(({ data }) => setAppointments(data)).catch(() => setAppointments([]));
    }
    if (["doctor", "admin"].includes(session.role)) {
      api.get("/analytics").then(({ data }) => setAnalytics(data)).catch(() => setError("Analytics are available after MongoDB is running and data exists."));
    }
    if (session.role === "admin") {
      api.get("/patients").then(({ data }) => setPatients(data)).catch(() => setPatients([]));
      api.get("/settings/appointment-fee").then(({ data }) => setAppointmentFee(String(data.amount_inr))).catch(() => setAppointmentFee("500"));
    }
  }, [session.role]);

  const saveAppointmentFee = async () => {
    setFeeStatus("");
    const amount = Number(appointmentFee);
    if (!amount || amount <= 0) {
      setFeeStatus("Enter a valid amount.");
      return;
    }
    try {
      const { data } = await api.patch("/settings/appointment-fee", { amount_inr: amount });
      setAppointmentFee(String(data.amount_inr));
      setFeeStatus("Appointment fee updated.");
    } catch {
      setFeeStatus("Could not update appointment fee.");
    }
  };

  if (session.role === "patient") {
    return (
      <section className="space-y-5">
        <div className="panel p-5">
          <div className="section-title">
            <span className="icon-badge"><HeartPulse size={22} /></span>
            <div>
              <h2 className="text-xl font-black">Patient Workspace</h2>
              <p className="text-sm text-slate-600">Track bookings, run symptom checks, and continue assistant conversations.</p>
            </div>
          </div>
        </div>
        <AppointmentTable rows={appointments} />
      </section>
    );
  }

  if (session.role === "admin") {
    return (
      <section className="space-y-5">
        {error && <StatusBanner type="error">{error}</StatusBanner>}
        <AdminSettings amount={appointmentFee} onAmountChange={setAppointmentFee} onSave={saveAppointmentFee} status={feeStatus} />
        <AnalyticsGrid analytics={analytics} />
        <PatientTable rows={patients} />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {error && <StatusBanner type="error">{error}</StatusBanner>}
      <AnalyticsGrid analytics={analytics} />
    </section>
  );
}

function AdminSettings({ amount, onAmountChange, onSave, status }) {
  return (
    <div className="panel p-5">
      <div className="section-title mb-2">
        <span className="icon-badge-soft"><IndianRupee size={19} /></span>
        <h2 className="text-lg font-black">Appointment Fee</h2>
      </div>
      <p className="mb-4 text-sm text-slate-600">Patients can view this amount during booking, but only admin can change it.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <TextField
          label="Fixed Amount INR"
          type="number"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          inputProps={{ min: 1 }}
        />
        <Button variant="contained" onClick={onSave} startIcon={<IndianRupee size={17} />}>Save Fee</Button>
      </div>
      {status && <p className="mt-3 text-sm font-semibold text-slate-600">{status}</p>}
    </div>
  );
}

export function AnalyticsGrid({ analytics }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartPanel title="Top Diseases" icon={Stethoscope}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={analytics?.top_diseases || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="disease" />
            <YAxis />
            <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Patient Inflow" icon={LineChartIcon}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={analytics?.patient_inflow || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#14b8a6" strokeWidth={3} dot={{ fill: "#2563eb", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Urgency Levels" icon={Activity}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={analytics?.urgency_distribution || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="urgency" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#7c3aed" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Symptom Trends" icon={BarChart3}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={analytics?.symptom_trends || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="symptom" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#16a34a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
    </div>
  );
}

function ChartPanel({ title, icon: Icon, children }) {
  return (
    <div className="panel p-5">
      <div className="section-title mb-4">
        {Icon && <span className="icon-badge-soft"><Icon size={18} /></span>}
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function AppointmentTable({ rows, title = "Appointments" }) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-slate-200 p-4">
        <div className="section-title">
          <span className="icon-badge-soft"><CalendarClock size={18} /></span>
          <h2 className="text-lg font-black">{title}</h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="p-3">Patient</th><th className="p-3">Doctor</th><th className="p-3">Schedule</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-t border-slate-100">
                <td className="p-3 font-semibold">{row.patient_name || row.patient_email}</td>
                <td className="p-3">{row.doctor_name || row.doctor_email}</td>
                <td className="p-3">{row.scheduled_for ? new Date(row.scheduled_for).toLocaleString() : "-"}</td>
                <td className="p-3"><span className="rounded bg-slate-100 px-2 py-1 font-bold">{row.status}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td className="p-4 text-slate-500" colSpan="4">No appointments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PatientTable({ rows }) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-slate-200 p-4">
        <div className="section-title">
          <span className="icon-badge-soft"><UsersRound size={18} /></span>
          <h2 className="text-lg font-black">Patients Data Board</h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Age</th>
              <th className="p-3">Gender</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-t border-slate-100">
                <td className="p-3 font-semibold">{row.name || "-"}</td>
                <td className="p-3">{row.email || "-"}</td>
                <td className="p-3">{row.phone || "-"}</td>
                <td className="p-3">{row.age ?? "-"}</td>
                <td className="p-3">{row.gender || "-"}</td>
                <td className="p-3">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td className="p-4 text-slate-500" colSpan="6">No patient records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
