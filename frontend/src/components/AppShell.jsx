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
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-4 md:block">
        <div className="mb-6 flex items-center gap-2 text-xl font-black text-ink">
          <Bot className="text-brand" />
          CareSphere AI
        </div>
        <nav className="space-y-1">
          {nav.filter((item) => item.roles.includes(session.role)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? "bg-teal-50 text-brand" : "text-slate-600 hover:bg-slate-50"}`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <button onClick={logout} className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
      <main className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand">{session.role}</p>
              <h1 className="text-xl font-black text-ink">{titles[session.role] || "Clinical operations workspace"}</h1>
            </div>
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{session.name}</span>
          </div>
        </header>
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 grid border-t border-slate-200 bg-white md:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(nav.filter((item) => item.roles.includes(session.role)).length, 5)}, minmax(0, 1fr))` }}>
        {nav.filter((item) => item.roles.includes(session.role)).slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="flex flex-col items-center gap-1 p-2 text-[11px] font-semibold text-slate-600">
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
