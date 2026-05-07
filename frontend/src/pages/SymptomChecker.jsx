import { useEffect, useState } from "react";
import { Autocomplete, Button, Chip, TextField } from "@mui/material";
import { ActivitySquare, ClipboardCheck, Search, ShieldAlert, Sparkles } from "lucide-react";
import { api } from "../api/client";
import StatusBanner from "../components/StatusBanner";

export default function SymptomChecker() {
  const [options, setOptions] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/symptoms").then(({ data }) => setOptions(data.symptoms)).catch(() => setOptions(["fever", "cough", "fatigue", "headache"]));
  }, []);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/predict", { symptoms });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="panel p-5">
        <div className="section-title mb-5">
          <span className="icon-badge"><ActivitySquare size={22} /></span>
          <div>
            <h2 className="text-xl font-black">Symptom Analysis Agent</h2>
            <p className="text-sm text-slate-600">Select observed symptoms for ML-based triage support.</p>
          </div>
        </div>
        {error && <div className="mb-4"><StatusBanner type="error">{error}</StatusBanner></div>}
        <Autocomplete
          multiple
          options={options}
          value={symptoms}
          onChange={(_, value) => setSymptoms(value)}
          renderTags={(value, getTagProps) => value.map((option, index) => <Chip variant="outlined" label={option.replaceAll("_", " ")} {...getTagProps({ index })} key={option} />)}
          renderInput={(params) => <TextField {...params} label="Symptoms" placeholder="Search symptoms" />}
        />
        <Button className="mt-4" variant="contained" disabled={!symptoms.length || loading} onClick={submit} startIcon={loading ? <Sparkles size={17} /> : <Search size={17} />}>{loading ? "Analyzing" : "Run prediction"}</Button>
      </div>
      <div className="panel p-5">
        <div className="section-title mb-4">
          <span className="icon-badge-soft"><ClipboardCheck size={18} /></span>
          <h3 className="text-lg font-black">Result</h3>
        </div>
        {result ? (
          <div className="space-y-3">
            <div><p className="text-xs font-bold uppercase text-slate-500">Predicted condition</p><p className="text-2xl font-black text-ink">{result.disease}</p></div>
            <div><p className="text-xs font-bold uppercase text-slate-500">Urgency</p><p className={`flex items-center gap-2 text-xl font-black ${result.urgency === "High" ? "text-red-600" : result.urgency === "Medium" ? "text-purple-700" : "text-green-700"}`}><ShieldAlert size={20} />{result.urgency}</p></div>
            <p className="text-sm font-semibold text-slate-700">Confidence: {(result.confidence * 100).toFixed(1)}%</p>
            {result.recommendations.map((item) => <StatusBanner key={item}>{item}</StatusBanner>)}
          </div>
        ) : <p className="text-sm text-slate-500">No prediction yet.</p>}
      </div>
    </section>
  );
}
