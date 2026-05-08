import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import { Edit3, Plus, Stethoscope, Trash2 } from "lucide-react";
import { api } from "../../api/client";

const emptyDoctor = {
  name: "",
  email: "",
  password: "",
  phone: "",
  specialization: "",
  experience: "",
  qualification: "",
  consultation_fee: 500,
  availability_status: "Available",
  profile_image: "",
};

export default function AdminDoctors() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/admin/doctors").then(({ data }) => setRows(data)).catch(() => setRows([]));

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const payload = {
      ...editing,
      experience: editing.experience ? Number(editing.experience) : null,
      consultation_fee: Number(editing.consultation_fee || 0),
    };
    if (!payload.password) {
      delete payload.password;
    }
    if (editing._id) await api.patch(`/admin/doctors/${editing._id}`, payload);
    else await api.post("/admin/doctors", payload);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this doctor?")) return;
    await api.delete(`/admin/doctors/${id}`);
    load();
  };

  return (
    <section className="space-y-5">
      <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="section-title">
          <span className="icon-badge-soft"><Stethoscope size={18} /></span>
          <h2 className="text-lg font-black">Doctors</h2>
        </div>
        <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setEditing(emptyDoctor)}>Add Doctor</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {rows.map((doctor) => (
          <div key={doctor._id} className="panel p-4">
            <div className="flex gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-blue-50 text-blue-700">
                {doctor.profile_image ? <img src={doctor.profile_image} alt="" className="h-full w-full object-cover" /> : <Stethoscope size={24} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black">{doctor.name}</h3>
                    <p className="font-semibold text-teal-700">{doctor.specialization || doctor.department}</p>
                  </div>
                  <span className="w-fit rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{doctor.availability_status || "Available"}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p>{doctor.qualification || "Qualification not set"}</p>
                  <p>{doctor.experience ?? 0} years experience</p>
                  <p>{doctor.email}</p>
                  <p>{doctor.phone || "-"}</p>
                  <p className="font-bold text-slate-900">₹{Number(doctor.consultation_fee || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="small" variant="outlined" onClick={() => setEditing(doctor)}><Edit3 size={15} /></Button>
                  <Button size="small" color="error" variant="outlined" onClick={() => remove(doctor._id)}><Trash2 size={15} /></Button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!rows.length && <div className="panel p-5 text-sm text-slate-500">No doctors found.</div>}
      </div>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle>{editing?._id ? "Edit Doctor" : "Add Doctor"}</DialogTitle>
        <DialogContent className="grid gap-3 pt-3 sm:grid-cols-2">
          {[
            ["name", "Doctor name"],
            ["email", "Email"],
            ["password", editing?._id ? "New login password" : "Login password"],
            ["phone", "Phone number"],
            ["specialization", "Specialization"],
            ["experience", "Experience"],
            ["qualification", "Qualification"],
            ["consultation_fee", "Consultation fee"],
            ["profile_image", "Profile image URL"],
          ].map(([field, label]) => (
            <TextField
              key={field}
              label={label}
              type={field === "password" ? "password" : "text"}
              required={field === "password" && !editing?._id}
              helperText={field === "password" && editing?._id ? "Leave blank to keep the current password." : ""}
              value={editing?.[field] || ""}
              onChange={(event) => setEditing({ ...editing, [field]: event.target.value })}
            />
          ))}
          <TextField select label="Availability status" value={editing?.availability_status || "Available"} onChange={(event) => setEditing({ ...editing, availability_status: event.target.value })}>
            <MenuItem value="Available">Available</MenuItem>
            <MenuItem value="Unavailable">Unavailable</MenuItem>
            <MenuItem value="On Leave">On Leave</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></DialogActions>
      </Dialog>
    </section>
  );
}
