import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import "./index.css";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import SymptomChecker from "./pages/SymptomChecker";
import Chatbot from "./pages/Chatbot";
import Dashboard from "./pages/Dashboard";
import PatientForm from "./pages/PatientForm";
import AppointmentBooking from "./pages/AppointmentBooking";
import DoctorAppointments from "./pages/DoctorAppointments";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDoctors from "./pages/admin/AdminDoctors";
import AdminPatients from "./pages/admin/AdminPatients";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminUploads from "./pages/admin/AdminUploads";

const theme = createTheme({
  palette: {
    primary: { main: "#2563eb", light: "#60a5fa", dark: "#1e40af" },
    secondary: { main: "#14b8a6", light: "#5eead4", dark: "#0f766e" },
    success: { main: "#16a34a" },
    warning: { main: "#d97706" },
    error: { main: "#dc2626" }
  },
  shape: { borderRadius: 6 },
  typography: { fontFamily: "Inter, system-ui, sans-serif" }
});

function Protected({ children }) {
  const { session } = useAuth();
  return session ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ roles, children }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return roles.includes(session.role) ? children : <Navigate to="/" replace />;
}

function Home() {
  const { session } = useAuth();
  return session?.role === "admin" ? <Navigate to="/admin" replace /> : <Dashboard />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><AppShell /></Protected>}>
              <Route index element={<Home />} />
              <Route path="symptoms" element={<RoleRoute roles={["patient"]}><SymptomChecker /></RoleRoute>} />
              <Route path="chat" element={<RoleRoute roles={["patient"]}><Chatbot /></RoleRoute>} />
              <Route path="patient" element={<RoleRoute roles={["patient"]}><PatientForm /></RoleRoute>} />
              <Route path="appointments" element={<RoleRoute roles={["patient"]}><AppointmentBooking /></RoleRoute>} />
              <Route path="doctor-appointments" element={<RoleRoute roles={["doctor"]}><DoctorAppointments /></RoleRoute>} />
              <Route path="admin" element={<RoleRoute roles={["admin"]}><AdminDashboard /></RoleRoute>} />
              <Route path="admin/patients" element={<RoleRoute roles={["admin"]}><AdminPatients /></RoleRoute>} />
              <Route path="admin/doctors" element={<RoleRoute roles={["admin"]}><AdminDoctors /></RoleRoute>} />
              <Route path="admin/appointments" element={<RoleRoute roles={["admin"]}><AdminAppointments /></RoleRoute>} />
              <Route path="admin/revenue" element={<RoleRoute roles={["admin"]}><AdminRevenue /></RoleRoute>} />
              <Route path="admin/upload" element={<RoleRoute roles={["admin"]}><AdminUploads /></RoleRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
