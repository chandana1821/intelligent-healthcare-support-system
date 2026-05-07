import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { api } from "../api/client";
import StatusBanner from "../components/StatusBanner";
import { AppointmentTable } from "./Dashboard";

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/appointments")
      .then(({ data }) => setAppointments(data))
      .catch(() => setError("Could not load doctor appointments."));
  }, []);

  return (
    <section className="space-y-5">
      <div className="panel p-5">
        <div className="section-title">
          <span className="icon-badge"><ClipboardList size={22} /></span>
          <div>
            <h2 className="text-xl font-black">Doctor Appointments</h2>
            <p className="text-sm text-slate-600">Appointments assigned to your doctor account.</p>
          </div>
        </div>
      </div>
      {error && <StatusBanner type="error">{error}</StatusBanner>}
      <AppointmentTable rows={appointments} title="My Appointments" />
    </section>
  );
}
