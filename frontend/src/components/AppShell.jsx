import { NavLink, Outlet } from "react-router-dom";
import { Bot, CalendarPlus, ClipboardPlus, LayoutDashboard, LogOut, MessageSquareText, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["patient", "doctor", "admin"] },
  { to: "/appointments", label: "Booking", icon: CalendarPlus, roles: ["patient"] },
  { to: "/doctor-appointments", label: "Appointments", icon: CalendarPlus, roles: ["doctor"] },
  { to: "/symptoms", label: "Symptoms", icon: ClipboardPlus, roles: ["patient"] },
  { to: "/chat", label: "Assistant", icon: MessageSquareText, roles: ["patient"] },
  { to: "/patient", label: "Patient Form", icon: UserRound, roles: ["patient"] }
];

const titles = {
  patient: "Patient care workspace",
  doctor: "Doctor workspace",
  admin: "Admin data and analytics board"
};

export default function AppShell() {
  const { session, logout } = useAuth();
  return (
    <div className="min-h-screen text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-blue-950 bg-blue-950 p-4 text-white shadow-[12px_0_36px_rgba(15,23,42,0.16)] md:block">
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-blue-900 p-3 text-xl font-black text-white ring-1 ring-white/10">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 text-white shadow-lg shadow-blue-950/20">
            <Bot size={22} />
          </span>
          <div>
            <p>CareSphere AI</p>
            <p className="text-xs font-bold uppercase text-blue-100">Hospital support</p>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.filter((item) => item.roles.includes(session.role)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-200 ${isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20" : "text-blue-100 hover:-translate-y-0.5 hover:bg-blue-900 hover:text-white hover:shadow-md"}`
                }
              >
                <Icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <button onClick={logout} className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-blue-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-900 hover:text-white hover:shadow-md">
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
      <main className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/88 px-4 py-3 shadow-sm backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{session.role}</p>
              <h1 className="text-xl font-black text-ink">{titles[session.role] || "Clinical operations workspace"}</h1>
            </div>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-900 ring-1 ring-blue-100">{session.name}</span>
          </div>
        </header>
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 grid border-t border-blue-900 bg-blue-950 text-white shadow-[0_-10px_30px_rgba(15,23,42,0.16)] md:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(nav.filter((item) => item.roles.includes(session.role)).length, 5)}, minmax(0, 1fr))` }}>
        {nav.filter((item) => item.roles.includes(session.role)).slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="flex flex-col items-center gap-1 p-2 text-[11px] font-bold text-blue-100 transition-colors hover:bg-blue-900 hover:text-white">
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
