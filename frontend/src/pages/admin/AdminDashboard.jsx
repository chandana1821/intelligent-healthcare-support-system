import { useEffect, useState } from "react";
import { Activity, CalendarX2, IndianRupee, Stethoscope, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api/client";

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setData(data)).catch(() => setData(null));
  }, []);

  const totals = data?.totals || {};
  const stats = [
    { label: "Total patients", value: totals.patients || 0, icon: UsersRound, color: "text-blue-700" },
    { label: "Total doctors", value: totals.doctors || 0, icon: Stethoscope, color: "text-teal-700" },
    { label: "Appointments", value: totals.appointments || 0, icon: Activity, color: "text-emerald-700" },
    { label: "Cancelled", value: totals.cancelled || 0, icon: CalendarX2, color: "text-rose-700" },
    { label: "Revenue", value: `₹${(totals.revenue || 0).toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-amber-700" },
  ];

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
                </div>
                <span className={`icon-badge-soft ${item.color}`}><Icon size={20} /></span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel p-5">
        <h2 className="mb-4 text-lg font-black">Patient Growth Analytics</h2>
        <ResponsiveContainer width="100%" height={310}>
          <LineChart data={data?.patient_growth || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="patients" stroke="#0f766e" strokeWidth={3} dot={{ fill: "#2563eb" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel p-5">
        <h2 className="mb-4 text-lg font-black">Revenue Overview</h2>
        <ResponsiveContainer width="100%" height={270}>
          <BarChart data={[{ name: "Paid revenue", revenue: totals.revenue || 0 }, { name: "Cancelled appointments", revenue: totals.cancelled || 0 }]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
