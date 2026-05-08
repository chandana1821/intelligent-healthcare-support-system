import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import { Edit3, Eye, Search, Trash2, UserRound } from "lucide-react";
import { api } from "../../api/client";

const emptyPatient = { name: "", email: "", phone: "", gender: "", age: "", medical_history: "" };

export default function AdminPatients() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => {
    api.get("/admin/patients", { params: { search, gender } }).then(({ data }) => setRows(data)).catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, []);

  const activePatient = useMemo(() => editing || emptyPatient, [editing]);

  const save = async () => {
    const payload = {
      ...activePatient,
      age: activePatient.age ? Number(activePatient.age) : null,
      medical_history: String(activePatient.medical_history || "").split(",").map((item) => item.trim()).filter(Boolean),
    };
    await api.patch(`/admin/patients/${editing._id}`, payload);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this patient account?")) return;
    await api.delete(`/admin/patients/${id}`);
    load();
  };

  return (
    <section className="space-y-5">
      <div className="panel p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="section-title">
            <span className="icon-badge-soft"><UserRound size={18} /></span>
            <h2 className="text-lg font-black">Patients</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <TextField size="small" label="Search patients" value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <Search size={16} className="mr-2 text-slate-400" /> }} />
            <TextField size="small" select label="Gender" value={gender} onChange={(event) => setGender(event.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
            <Button variant="contained" onClick={load}>Apply</Button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Full name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Gender</th>
                <th className="p-3">Age</th>
                <th className="p-3">Registration date</th>
                <th className="p-3">Medical history</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t border-slate-100">
                  <td className="p-3 font-bold">{row.name || "-"}</td>
                  <td className="p-3">{row.email || "-"}</td>
                  <td className="p-3">{row.phone || "-"}</td>
                  <td className="p-3">{row.gender || "-"}</td>
                  <td className="p-3">{row.age ?? "-"}</td>
                  <td className="p-3">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
                  <td className="max-w-[240px] truncate p-3">{Array.isArray(row.medical_history) ? row.medical_history.join(", ") : row.medical_history || "-"}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button size="small" variant="outlined" onClick={() => setSelected(row)}><Eye size={15} /></Button>
                      <Button size="small" variant="outlined" onClick={() => setEditing({ ...row, medical_history: Array.isArray(row.medical_history) ? row.medical_history.join(", ") : row.medical_history || "" })}><Edit3 size={15} /></Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => remove(row._id)}><Trash2 size={15} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td className="p-4 text-slate-500" colSpan="8">No patients found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Patient Profile</DialogTitle>
        <DialogContent>
          {selected && <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm">{JSON.stringify(selected, null, 2)}</pre>}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Patient</DialogTitle>
        <DialogContent className="space-y-3 pt-3">
          {["name", "email", "phone", "gender", "age", "medical_history"].map((field) => (
            <TextField key={field} fullWidth label={field.replace("_", " ")} value={activePatient[field] || ""} onChange={(event) => setEditing({ ...activePatient, [field]: event.target.value })} />
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></DialogActions>
      </Dialog>
    </section>
  );
}
