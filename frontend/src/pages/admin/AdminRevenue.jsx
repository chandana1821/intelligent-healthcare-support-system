import { useEffect, useState } from "react";
import { Button, TextField } from "@mui/material";
import { IndianRupee } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api/client";

export default function AdminRevenue() {
  const [data, setData] = useState({ doctors: [], monthly: [], payments: [] });
  const [filters, setFilters] = useState({ doctor: "", date_from: "", date_to: "" });

  const load = () => api.get("/admin/revenue", { params: filters }).then(({ data }) => setData(data)).catch(() => setData({ doctors: [], monthly: [], payments: [] }));

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="space-y-5">
      <div className="panel p-5">
        <div className="mb-4 section-title">
          <span className="icon-badge-soft"><IndianRupee size={18} /></span>
          <h2 className="text-lg font-black">Revenue</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <TextField size="small" label="Doctor email/name" value={filters.doctor} onChange={(event) => setFilters({ ...filters, doctor: event.target.value })} />
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} />
          <Button variant="contained" onClick={load}>Apply</Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="mb-4 text-lg font-black">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel p-5">
          <h2 className="mb-4 text-lg font-black">Paid vs Pending</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.payments} dataKey="count" nameKey="name" outerRadius={95} fill="#2563eb" label />
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Doctor</th>
                <th className="p-3">Email</th>
                <th className="p-3">Total earnings</th>
                <th className="p-3">Appointments handled</th>
              </tr>
            </thead>
            <tbody>
              {data.doctors.map((row) => (
                <tr key={row.email} className="border-t border-slate-100">
                  <td className="p-3 font-bold">{row.doctor}</td>
                  <td className="p-3">{row.email}</td>
                  <td className="p-3 font-black">₹{Number(row.earnings || 0).toLocaleString("en-IN")}</td>
                  <td className="p-3">{row.appointments}</td>
                </tr>
              ))}
              {!data.doctors.length && <tr><td className="p-4 text-slate-500" colSpan="4">No revenue records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
