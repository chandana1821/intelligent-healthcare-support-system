import { useState } from "react";
import { Button, TextField } from "@mui/material";
import { api } from "../api/client";
import StatusBanner from "../components/StatusBanner";

export default function PatientForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", age: "", gender: "", address: "", medical_history: "" });
  const [status, setStatus] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    await api.post("/upload", { ...form, age: form.age ? Number(form.age) : null, medical_history: form.medical_history.split(",").map((item) => item.trim()).filter(Boolean) });
    setStatus("Patient record stored successfully.");
  };

  return (
    <form onSubmit={submit} className="panel max-w-3xl space-y-4 p-5">
      <div>
        <h2 className="text-xl font-black">Patient Data Intake</h2>
        <p className="text-sm text-slate-600">Validated records are stored in the patients collection.</p>
      </div>
      {status && <StatusBanner type="success">{status}</StatusBanner>}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <TextField label="Age" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        <TextField label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
        <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <TextField fullWidth label="Medical history" helperText="Comma separated" value={form.medical_history} onChange={(e) => setForm({ ...form, medical_history: e.target.value })} />
      <Button type="submit" variant="contained">Store record</Button>
    </form>
  );
}
