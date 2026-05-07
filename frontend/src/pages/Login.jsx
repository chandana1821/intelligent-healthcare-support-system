import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button, TextField } from "@mui/material";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import StatusBanner from "../components/StatusBanner";

export default function Login() {
  const { session, login, register } = useAuth();

  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "patient",
    phone: "",
    age: "",
    gender: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Auto redirect if already logged in
  if (session) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register({
          ...form,
          role: "patient",
          age: form.age ? Number(form.age) : null,
        });

        // ✅ FORCE REDIRECT AFTER REGISTER
        window.location.href = "/";
      }
    } catch (err) {
      console.log("ERROR:", err.response); // 🔍 DEBUG

      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(", "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (err.response?.status) {
        setError(`Authentication failed (${err.response.status})`);
      } else if (err.message) {
        setError(`Authentication failed: ${err.message}`);
      } else {
        setError("Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-clinical p-4">
      <form onSubmit={submit} className="panel w-full max-w-md p-6 shadow-sm">
        
        {/* HEADER */}
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="text-brand" size={30} />
          <div>
            <h1 className="text-2xl font-black text-ink">
              CareSphere AI
            </h1>
            <p className="text-sm text-slate-600">
              Secure healthcare assistant access
            </p>
          </div>
        </div>

        {/* TOGGLE */}
        <div className="mb-4 grid grid-cols-2 rounded-md bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded px-3 py-2 text-sm font-bold ${
              mode === "login"
                ? "bg-white text-brand shadow-sm"
                : "text-slate-600"
            }`}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded px-3 py-2 text-sm font-bold ${
              mode === "register"
                ? "bg-white text-brand shadow-sm"
                : "text-slate-600"
            }`}
          >
            Register
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-4">
            <StatusBanner type="error">{error}</StatusBanner>
          </div>
        )}

        {/* FORM */}
        <div className="space-y-3">
          
          {mode === "register" && (
            <TextField
              fullWidth
              label="Full name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              required
            />
          )}

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
            required
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
            required
          />

          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Phone"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
              />

              <TextField
                label="Age"
                type="number"
                value={form.age}
                onChange={(e) =>
                  setForm({ ...form, age: e.target.value })
                }
              />
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            size="large"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Create account"}
          </Button>
        </div>
      </form>
    </div>
  );
}
