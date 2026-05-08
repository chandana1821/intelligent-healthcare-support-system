import { useEffect, useState } from "react";
import { Button, MenuItem, TextField } from "@mui/material";
import { CalendarClock, Filter } from "lucide-react";
import { api } from "../../api/client";

export default function AdminAppointments() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ doctor: "", patient: "", date: "", status: "" });

  const load = () => api.get("/admin/appointments", { params: filters }).then(({ data }) => setRows(data)).catch(() => setRows([]));

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="space-y-5">
      <div className="panel p-5">
        <div className="mb-4 section-title">
          <span className="icon-badge-soft"><CalendarClock size={18} /></span>
          <h2 className="text-lg font-black">Appointments</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <TextField size="small" label="Doctor" value={filters.doctor} onChange={(event) => setFilters({ ...filters, doctor: event.target.value })} />
          <TextField size="small" label="Patient" value={filters.patient} onChange={(event) => setFilters({ ...filters, patient: event.target.value })} />
          <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} />
          <TextField size="small" select label="Status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="booked">Booked</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </TextField>
          <Button variant="contained" startIcon={<Filter size={16} />} onClick={load}>Filter</Button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Patient details</th>
                <th className="p-3">Doctor details</th>
                <th className="p-3">Date and time</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t border-slate-100">
                  <td className="p-3"><p className="font-bold">{row.patient_name || "-"}</p><p className="text-slate-500">{row.patient_email}</p></td>
                  <td className="p-3"><p className="font-bold">{row.doctor_name || "-"}</p><p className="text-slate-500">{row.doctor_email}</p></td>
                  <td className="p-3">{row.scheduled_for ? new Date(row.scheduled_for).toLocaleString() : "-"}</td>
                  <td className="p-3"><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{row.payment_status || "pending"}</span></td>
                  <td className="p-3"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black capitalize text-slate-700">{row.status || "-"}</span></td>
                  <td className="p-3 font-bold">₹{Number(row.amount_inr || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
              {!rows.length && <tr><td className="p-4 text-slate-500" colSpan="6">No appointments found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
