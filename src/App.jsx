import { useState, useEffect, useRef, useCallback } from "react";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";

// ── Admin credentials (change these to whatever you want) ──
const ADMIN_EMAIL    = "admin@flowsync.app";
const ADMIN_PASSWORD = "Admin@1234";

// ─── Palette & Design Tokens ─────────────────────────────────────────────────
const COLORS = {
  navy: "#0A1628",
  navyLight: "#112240",
  navyMid: "#1A3A6B",
  blue: "#1E5FAD",
  blueMid: "#2E7DD4",
  teal: "#0DBFBF",
  tealLight: "#5EEAD4",
  cyan: "#00D4FF",
  white: "#FFFFFF",
  offWhite: "#F0F4F8",
  softGrey: "#E2EAF4",
  midGrey: "#8B9BB4",
  darkGrey: "#4A5568",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#7C3AED",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_USERS = {
  managers: [
    { id: "m1", name: "Alex Rivera", email: "alex@company.com", avatar: "AR", role: "manager", teamId: "team1" },
    { id: "m2", name: "Jordan Kim", email: "jordan@company.com", avatar: "JK", role: "manager", teamId: "team2" },
  ],
  employees: [
    { id: "e1", name: "Sam Chen", email: "sam@company.com", avatar: "SC", role: "employee", teamId: null },
    { id: "e2", name: "Priya Nair", email: "priya@company.com", avatar: "PN", role: "employee", teamId: "team1" },
    { id: "e3", name: "Marcus Webb", email: "marcus@company.com", avatar: "MW", role: "employee", teamId: "team1" },
    { id: "e4", name: "Lena Müller", email: "lena@company.com", avatar: "LM", role: "employee", teamId: null },
  ],
};

const INITIAL_TASKS = [
  { id: "t1", title: "Redesign Landing Page", description: "Complete overhaul of the marketing site", deadline: "2026-04-15", priority: "high", status: "ongoing", assignedTo: ["e2"], teamId: "team1", managerId: "m1", comments: [{ id: "c1", userId: "e2", text: "Started wireframes", time: "2h ago" }], createdAt: "2026-03-25", category: "Design" },
  { id: "t2", title: "API Integration", description: "Connect payment gateway to backend", deadline: "2026-04-10", priority: "high", status: "pending", assignedTo: ["e3"], teamId: "team1", managerId: "m1", comments: [], createdAt: "2026-03-26", category: "Engineering" },
  { id: "t3", title: "Q1 Report Analysis", description: "Analyze quarterly performance metrics", deadline: "2026-04-05", priority: "medium", status: "completed", assignedTo: ["e2", "e3"], teamId: "team1", managerId: "m1", comments: [{ id: "c2", userId: "e3", text: "Report finalized!", time: "1d ago" }], createdAt: "2026-03-20", category: "Analytics" },
  { id: "t4", title: "Mobile App Testing", description: "QA testing for iOS and Android builds", deadline: "2026-04-20", priority: "medium", status: "pending", assignedTo: ["e2"], teamId: "team1", managerId: "m1", comments: [], createdAt: "2026-03-27", category: "QA" },
  { id: "t5", title: "Database Optimization", description: "Optimize slow queries in production", deadline: "2026-04-08", priority: "high", status: "ongoing", assignedTo: ["e3"], teamId: "team1", managerId: "m1", comments: [], createdAt: "2026-03-28", category: "Engineering" },
  { id: "t6", title: "User Research Sessions", description: "Conduct 10 user interviews", deadline: "2026-04-25", priority: "low", status: "pending", assignedTo: ["e2"], teamId: "team1", managerId: "m1", comments: [], createdAt: "2026-03-29", category: "Research" },
];

const INITIAL_INVITATIONS = [
  { id: "inv1", managerId: "m1", managerName: "Alex Rivera", teamId: "team1", employeeId: "e1", status: "pending", message: "Join our product team!", time: "3h ago" },
  { id: "inv2", managerId: "m1", managerName: "Alex Rivera", teamId: "team1", employeeId: "e4", status: "pending", message: "We'd love to have you!", time: "1d ago" },
];

const INITIAL_NOTIFICATIONS = [
  { id: "n1", type: "task_update", message: "Priya updated 'Redesign Landing Page' to Ongoing", time: "2h ago", read: false, userId: "m1" },
  { id: "n2", type: "task_complete", message: "Q1 Report Analysis marked as Completed", time: "1d ago", read: false, userId: "m1" },
  { id: "n3", type: "invitation", message: "Alex Rivera invited you to team", time: "3h ago", read: false, userId: "e1" },
  { id: "n4", type: "task_assigned", message: "New task: Mobile App Testing assigned to you", time: "2d ago", read: true, userId: "e2" },
];

// ─── Utility Functions ────────────────────────────────────────────────────────
const getPriorityColor = (p) => p === "high" ? COLORS.danger : p === "medium" ? COLORS.warning : COLORS.success;
const getStatusColor = (s) => s === "completed" ? COLORS.success : s === "ongoing" ? COLORS.teal : COLORS.midGrey;
const getStatusLabel = (s) => s === "completed" ? "Completed" : s === "ongoing" ? "In Progress" : "Pending";
const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const isOverdue = (d) => new Date(d) < new Date() && true;

function Avatar({ initials, size = 36, color = COLORS.blue, textColor = "#fff" }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${color}, ${COLORS.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: textColor, flexShrink: 0, fontFamily: "monospace", letterSpacing: "0.05em" }}>
      {initials}
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: color || "#fff", background: bg || COLORS.blue, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {label}
    </span>
  );
}

function ProgressBar({ value, max, color = COLORS.teal }) {
  const pct = Math.min(100, Math.round((value / max) * 100)) || 0;
  return (
    <div style={{ width: "100%", height: 6, background: COLORS.softGrey, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${COLORS.cyan})`, borderRadius: 3, transition: "width 0.6s ease" }} />
    </div>
  );
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────
const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    tasks: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>,
    team: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></>,
    analytics: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    bell: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    moon: <><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></>,
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    kanban: <><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    google: null,
    user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    comment: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>,
    chevronDown: <><polyline points="6 9 12 15 18 9"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6"/></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [step, setStep]               = useState("login");
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [adminEmail, setAdminEmail]   = useState("");
  const [adminPass, setAdminPass]     = useState("");
  const [adminError, setAdminError]   = useState("");
  const [showAdmin, setShowAdmin]     = useState(false);
  const [showPass, setShowPass]       = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user) {
        setFirebaseUser(result.user);
        setStep("role");
      }
    } catch (err) {
      console.error("Google login error:", err.code, err.message);
      if (err.code === "auth/popup-blocked") {
        setGoogleError("Popup was blocked. Please allow popups for this site in your browser settings, then try again.");
      } else if (err.code === "auth/unauthorized-domain") {
        setGoogleError("This domain is not authorized. Add flowsync-mu.vercel.app to Firebase authorized domains.");
      } else if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        setGoogleError("Sign-in was cancelled. Please try again.");
      } else {
        setGoogleError("Login failed: " + (err.message || "Unknown error. Check Firebase authorized domains."));
      }
    }
    setLoading(false);
  };

  const handleRoleSelect = (role) => {
    const u = firebaseUser;
    const nameParts = (u.displayName || u.email).split(" ");
    const initials = nameParts.map(w => w[0]).join("").slice(0, 2).toUpperCase();
    onLogin({
      id: u.uid,
      name: u.displayName || u.email.split("@")[0],
      email: u.email,
      avatar: initials,
      role,
      photoUrl: u.photoURL || null,
      teamId: null,
    });
  };

  const handleAdminLogin = () => {
    setAdminError("");
    if (!adminEmail.trim()) { setAdminError("Enter your admin email."); return; }
    if (!adminPass)          { setAdminError("Enter your password."); return; }
    if (adminEmail.trim().toLowerCase() === ADMIN_EMAIL && adminPass === ADMIN_PASSWORD) {
      onLogin({ id: "admin", name: "Admin", email: ADMIN_EMAIL, avatar: "AD", role: "admin", teamId: null });
    } else {
      setAdminError("Wrong email or password.");
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10, color: "#fff", fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };



  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navyLight} 50%, ${COLORS.navyMid} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.teal}18 0%, transparent 70%)`, top: -100, right: -100, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.blue}20 0%, transparent 70%)`, bottom: -80, left: -80, pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 460, padding: "0 24px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="zap" size={24} color="#fff" />
            </div>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>FlowSync</span>
          </div>
          <p style={{ color: COLORS.midGrey, fontSize: 14 }}>Workflow Management Platform</p>
        </div>

        <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", padding: 36 }}>

          {/* ── Google login step ── */}
          {step === "login" && !showAdmin && (
            <div>
              <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>Welcome back</h2>
              <p style={{ color: COLORS.midGrey, textAlign: "center", marginBottom: 28, fontSize: 14 }}>Sign in with your Google account</p>

              <button onClick={handleGoogleLogin} disabled={loading}
                style={{ width: "100%", padding: "14px 20px", background: loading ? "#f5f5f5" : "#fff", border: "none", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, cursor: loading ? "wait" : "pointer", fontWeight: 600, fontSize: 15, color: COLORS.navy, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", marginBottom: 14, opacity: loading ? 0.8 : 1, transition: "all 0.2s" }}>
                {loading ? (
                  <div style={{ width: 20, height: 20, border: "2px solid #ccc", borderTopColor: COLORS.blue, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                )}
                {loading ? "Opening Google sign-in..." : "Continue with Google"}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

              {googleError && (
                <div style={{ padding: "10px 14px", background: `${COLORS.danger}15`, border: `1px solid ${COLORS.danger}40`, borderRadius: 10, marginBottom: 14 }}>
                  <p style={{ color: COLORS.danger, fontSize: 13, margin: 0 }}>{googleError}</p>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                <span style={{ color: COLORS.midGrey, fontSize: 12 }}>or</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
              </div>

              <button onClick={() => setShowAdmin(true)}
                style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, cursor: "pointer", color: COLORS.midGrey, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon name="star" size={16} color={COLORS.teal} /> Admin Login
              </button>
            </div>
          )}

          {/* ── Admin login form ── */}
          {step === "login" && showAdmin && (
            <div>
              <button onClick={() => { setShowAdmin(false); setAdminError(""); }} style={{ background: "none", border: "none", color: COLORS.teal, cursor: "pointer", fontSize: 13, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
                ← Back
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <div style={{ width: 42, height: 42, background: `linear-gradient(135deg, ${COLORS.teal}30, ${COLORS.blue}30)`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="star" size={20} color={COLORS.teal} />
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Admin Login</div>
                  <div style={{ color: COLORS.midGrey, fontSize: 12 }}>Full access to all app data</div>
                </div>
              </div>

              <label style={{ color: COLORS.midGrey, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Admin Email</label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                placeholder="admin@flowsync.app" style={{ ...inputStyle, marginBottom: 14 }}
                onKeyDown={e => e.key === "Enter" && handleAdminLogin()} />

              <label style={{ color: COLORS.midGrey, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative", marginBottom: 14 }}>
                <input type={showPass ? "text" : "password"} value={adminPass} onChange={e => setAdminPass(e.target.value)}
                  placeholder="Enter admin password" style={{ ...inputStyle, paddingRight: 44 }}
                  onKeyDown={e => e.key === "Enter" && handleAdminLogin()} />
                <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: COLORS.midGrey, fontSize: 13 }}>
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>

              {adminError && (
                <div style={{ padding: "10px 14px", background: `${COLORS.danger}15`, border: `1px solid ${COLORS.danger}40`, borderRadius: 10, marginBottom: 14 }}>
                  <p style={{ color: COLORS.danger, fontSize: 13, margin: 0 }}>{adminError}</p>
                </div>
              )}

              <button onClick={handleAdminLogin}
                style={{ width: "100%", padding: "13px", background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: "none", borderRadius: 12, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 15 }}>
                Sign In as Admin
              </button>
            </div>
          )}

          {/* ── Role select after Google login ── */}
          {step === "role" && (
            <div>
              {firebaseUser && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, padding: "12px 14px", background: "rgba(255,255,255,0.06)", borderRadius: 12 }}>
                  {firebaseUser.photoURL
                    ? <img src={firebaseUser.photoURL} alt="avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                    : <Avatar initials={(firebaseUser.displayName || "U").slice(0, 2).toUpperCase()} size={44} />}
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{firebaseUser.displayName}</div>
                    <div style={{ color: COLORS.midGrey, fontSize: 13 }}>{firebaseUser.email}</div>
                  </div>
                </div>
              )}
              <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>How will you use FlowSync?</h2>
              <p style={{ color: COLORS.midGrey, textAlign: "center", marginBottom: 22, fontSize: 14 }}>Choose your role to get started</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                {[{ role: "manager", icon: "star", label: "Manager", desc: "Lead teams & assign tasks" }, { role: "employee", icon: "user", label: "Employee", desc: "View & complete tasks" }].map(r => (
                  <button key={r.role} onClick={() => handleRoleSelect(r.role)}
                    style={{ padding: "22px 14px", background: "rgba(255,255,255,0.05)", border: `2px solid ${COLORS.teal}40`, borderRadius: 16, cursor: "pointer", color: "#fff", textAlign: "center", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${COLORS.teal}15`; e.currentTarget.style.borderColor = COLORS.teal; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = `${COLORS.teal}40`; }}>
                    <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}><Icon name={r.icon} size={26} color={COLORS.teal} /></div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{r.label}</div>
                    <div style={{ color: COLORS.midGrey, fontSize: 12 }}>{r.desc}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => { signOut(auth); setStep("login"); setFirebaseUser(null); }}
                style={{ width: "100%", padding: "10px", background: "transparent", border: "none", color: COLORS.midGrey, fontSize: 13, cursor: "pointer" }}>
                ← Use a different account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ user, activeTab, setActiveTab, darkMode, setDarkMode, onLogout, notifications, mobileOpen, setMobileOpen, collapsed, setCollapsed, isMobile }) {
  const unread = notifications.filter(n => !n.read && n.userId === user.id).length;
  const managerNav = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "tasks", icon: "tasks", label: "Tasks" },
    { id: "kanban", icon: "kanban", label: "Kanban Board" },
    { id: "team", icon: "team", label: "My Team" },
    { id: "analytics", icon: "analytics", label: "Analytics" },
    { id: "notifications", icon: "bell", label: "Notifications", badge: unread },
    { id: "profile", icon: "user", label: "Profile" },
    { id: "settings", icon: "settings", label: "Settings" },
  ];
  const employeeNav = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "mytasks", icon: "tasks", label: "My Tasks" },
    { id: "inbox", icon: "inbox", label: "Inbox", badge: unread },
    { id: "activity", icon: "activity", label: "Activity" },
    { id: "notifications", icon: "bell", label: "Notifications", badge: unread },
    { id: "profile", icon: "user", label: "Profile" },
    { id: "settings", icon: "settings", label: "Settings" },
  ];
  const nav = user.role === "manager" ? managerNav : employeeNav;
  const bg = darkMode ? COLORS.navy : COLORS.navyLight;

  // On desktop: collapsed = icon-only (64px). On mobile: slide in/out via transform.
  const sidebarWidth = collapsed && !isMobile ? 64 : 240;
  const mobileTransform = isMobile ? (mobileOpen ? "translateX(0)" : "translateX(-100%)") : "none";

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 99 }} />
      )}

      <aside style={{
        width: sidebarWidth,
        background: bg,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
        transition: "width 0.25s ease, transform 0.28s ease",
        transform: mobileTransform,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        overflowX: "hidden",
      }}>

        {/* Logo + collapse toggle */}
        <div style={{ padding: collapsed && !isMobile ? "20px 0" : "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: collapsed && !isMobile ? "center" : "space-between", minHeight: 72, flexShrink: 0 }}>
          {(!collapsed || isMobile) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="zap" size={17} color="#fff" />
              </div>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>FlowSync</span>
            </div>
          )}
          {collapsed && !isMobile && (
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="zap" size={17} color="#fff" />
            </div>
          )}
          {/* Collapse toggle — desktop only */}
          {!isMobile && (
            <button onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginLeft: collapsed ? 0 : 8, transition: "background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.14)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.midGrey} strokeWidth={2.5} strokeLinecap="round">
                {collapsed ? <><polyline points="9 18 15 12 9 6"/></> : <><polyline points="15 18 9 12 15 6"/></>}
              </svg>
            </button>
          )}
          {/* Mobile close button */}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Icon name="x" size={16} color={COLORS.midGrey} />
            </button>
          )}
        </div>

        {/* User info (hidden when collapsed on desktop) */}
        {(!collapsed || isMobile) && (
          <button onClick={() => { setActiveTab("profile"); if (isMobile) setMobileOpen(false); }}
            style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left", transition: "background 0.18s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {user.photoUrl
                ? <img src={user.photoUrl} alt="dp" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `2px solid ${COLORS.teal}` }} />
                : <Avatar initials={user.avatar} size={36} />}
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: COLORS.success, border: "2px solid #112240" }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div style={{ color: COLORS.teal, fontSize: 11, fontWeight: 500, textTransform: "capitalize" }}>{user.role}</div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.midGrey} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
        {/* Avatar only when collapsed */}
        {collapsed && !isMobile && (
          <button onClick={() => setActiveTab("profile")} title="My Profile"
            style={{ padding: "12px 0", display: "flex", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", width: "100%" }}>
            {user.photoUrl
              ? <img src={user.photoUrl} alt="dp" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: `2px solid ${COLORS.teal}` }} />
              : <Avatar initials={user.avatar} size={34} />}
          </button>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, padding: collapsed && !isMobile ? "12px 8px" : "12px 10px", overflowY: "auto", overflowX: "hidden" }}>
          {nav.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); if (isMobile) setMobileOpen(false); }}
                title={collapsed && !isMobile ? item.label : ""}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: collapsed && !isMobile ? 0 : 11, justifyContent: collapsed && !isMobile ? "center" : "flex-start", padding: collapsed && !isMobile ? "11px 0" : "10px 11px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 4, background: isActive ? `linear-gradient(135deg, ${COLORS.teal}22, ${COLORS.blue}22)` : "transparent", color: isActive ? COLORS.teal : COLORS.midGrey, fontWeight: isActive ? 600 : 400, fontSize: 14, transition: "all 0.18s", textAlign: "left", position: "relative", whiteSpace: "nowrap" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                {isActive && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: `linear-gradient(${COLORS.teal}, ${COLORS.blue})`, borderRadius: "0 3px 3px 0" }} />}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Icon name={item.icon} size={18} color={isActive ? COLORS.teal : COLORS.midGrey} />
                  {/* Badge dot on icon when collapsed */}
                  {collapsed && !isMobile && item.badge > 0 && (
                    <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: COLORS.danger, border: `1.5px solid ${bg}` }} />
                  )}
                </div>
                {(!collapsed || isMobile) && (
                  <>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge > 0 && <span style={{ background: COLORS.danger, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{item.badge}</span>}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: collapsed && !isMobile ? "10px 8px" : "10px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button onClick={() => setDarkMode(!darkMode)} title={collapsed && !isMobile ? (darkMode ? "Light Mode" : "Dark Mode") : ""} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed && !isMobile ? "center" : "flex-start", gap: collapsed && !isMobile ? 0 : 11, padding: collapsed && !isMobile ? "10px 0" : "10px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: COLORS.midGrey, fontSize: 14, marginBottom: 4, whiteSpace: "nowrap" }}>
            <Icon name={darkMode ? "sun" : "moon"} size={18} color={COLORS.midGrey} />
            {(!collapsed || isMobile) && (darkMode ? "Light Mode" : "Dark Mode")}
          </button>
          <button onClick={onLogout} title={collapsed && !isMobile ? "Sign Out" : ""} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed && !isMobile ? "center" : "flex-start", gap: collapsed && !isMobile ? 0 : 11, padding: collapsed && !isMobile ? "10px 0" : "10px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: COLORS.danger, fontSize: 14, whiteSpace: "nowrap" }}>
            <Icon name="logout" size={18} color={COLORS.danger} />
            {(!collapsed || isMobile) && "Sign Out"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, users, onUpdate, onDelete, darkMode, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const assignees = task.assignedTo.map(id => [...MOCK_USERS.managers, ...MOCK_USERS.employees].find(u => u.id === id)).filter(Boolean);
  const bg = darkMode ? COLORS.navyLight : "#fff";
  const textPrimary = darkMode ? "#fff" : COLORS.navy;
  const textSecondary = darkMode ? COLORS.midGrey : COLORS.darkGrey;

  const addComment = () => {
    if (!newComment.trim()) return;
    const comment = { id: `c${Date.now()}`, userId: users[0]?.id || "u", text: newComment, time: "just now" };
    onUpdate({ ...task, comments: [...task.comments, comment] });
    setNewComment("");
  };

  const cycleStatus = () => {
    const cycle = { pending: "ongoing", ongoing: "completed", completed: "pending" };
    onUpdate({ ...task, status: cycle[task.status] });
  };

  return (
    <div style={{ background: bg, borderRadius: 14, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}`, padding: compact ? "14px 16px" : "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.2s", marginBottom: 12 }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.12)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <Badge label={task.priority} bg={`${getPriorityColor(task.priority)}22`} color={getPriorityColor(task.priority)} />
            <Badge label={getStatusLabel(task.status)} bg={`${getStatusColor(task.status)}22`} color={getStatusColor(task.status)} />
            {task.category && <Badge label={task.category} bg={`${COLORS.blue}22`} color={COLORS.blue} />}
          </div>
          <h3 style={{ color: textPrimary, fontWeight: 700, fontSize: 15, margin: "0 0 4px", lineHeight: 1.3 }}>{task.title}</h3>
          {!compact && <p style={{ color: textSecondary, fontSize: 13, margin: "0 0 10px", lineHeight: 1.5 }}>{task.description}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: isOverdue(task.deadline) && task.status !== "completed" ? COLORS.danger : textSecondary, fontSize: 12 }}>
              <Icon name="clock" size={13} color={isOverdue(task.deadline) && task.status !== "completed" ? COLORS.danger : COLORS.midGrey} />
              {formatDate(task.deadline)}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: -4 }}>
              {assignees.slice(0, 3).map((a, i) => <div key={a.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}><Avatar initials={a.avatar} size={22} /></div>)}
              {assignees.length > 3 && <span style={{ fontSize: 11, color: COLORS.midGrey, marginLeft: 4 }}>+{assignees.length - 3}</span>}
            </div>
            {task.comments.length > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4, color: textSecondary, fontSize: 12 }}><Icon name="comment" size={13} color={COLORS.midGrey} />{task.comments.length}</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button onClick={cycleStatus} style={{ padding: "6px 10px", background: `${getStatusColor(task.status)}22`, border: `1px solid ${getStatusColor(task.status)}44`, borderRadius: 8, cursor: "pointer", color: getStatusColor(task.status), fontSize: 11, fontWeight: 600 }}>
            {task.status === "completed" ? "↩ Reset" : "→ Next"}
          </button>
          <button onClick={() => setExpanded(!expanded)} style={{ padding: "6px 10px", background: "transparent", border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : COLORS.softGrey}`, borderRadius: 8, cursor: "pointer", color: textSecondary, fontSize: 11 }}>
            {expanded ? "Less" : "More"}
          </button>
          {onDelete && <button onClick={() => onDelete(task.id)} style={{ padding: "6px 8px", background: `${COLORS.danger}15`, border: "none", borderRadius: 8, cursor: "pointer" }}><Icon name="trash" size={13} color={COLORS.danger} /></button>}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}`, paddingTop: 16 }}>
          <p style={{ color: textSecondary, fontSize: 13, marginBottom: 14 }}>{task.description}</p>
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ color: textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Comments ({task.comments.length})</h4>
            {task.comments.map(c => {
              const commenter = [...MOCK_USERS.managers, ...MOCK_USERS.employees].find(u => u.id === c.userId);
              return (
                <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <Avatar initials={commenter?.avatar || "?"} size={28} />
                  <div style={{ background: darkMode ? "rgba(255,255,255,0.05)" : COLORS.offWhite, borderRadius: 10, padding: "8px 12px", flex: 1 }}>
                    <span style={{ color: textPrimary, fontSize: 13, fontWeight: 600 }}>{commenter?.name}</span>
                    <span style={{ color: COLORS.midGrey, fontSize: 11, marginLeft: 8 }}>{c.time}</span>
                    <p style={{ color: textSecondary, fontSize: 13, margin: "4px 0 0" }}>{c.text}</p>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} placeholder="Add a comment..." style={{ flex: 1, padding: "8px 12px", background: darkMode ? "rgba(255,255,255,0.05)" : COLORS.offWhite, border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : COLORS.softGrey}`, borderRadius: 8, color: textPrimary, fontSize: 13, outline: "none" }} />
              <button onClick={addComment} style={{ padding: "8px 14px", background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: "none", borderRadius: 8, cursor: "pointer", color: "#fff" }}><Icon name="send" size={14} color="#fff" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────
function ManagerDashboard({ user, tasks, users, darkMode }) {
  const myTasks = tasks.filter(t => t.managerId === user.id);
  const teamMembers = MOCK_USERS.employees.filter(e => e.teamId === user.teamId);
  const completed = myTasks.filter(t => t.status === "completed").length;
  const ongoing = myTasks.filter(t => t.status === "ongoing").length;
  const pending = myTasks.filter(t => t.status === "pending").length;
  const bg = darkMode ? COLORS.navy : COLORS.offWhite;
  const cardBg = darkMode ? COLORS.navyLight : "#fff";
  const textPrimary = darkMode ? "#fff" : COLORS.navy;
  const textSecondary = darkMode ? COLORS.midGrey : COLORS.darkGrey;

  const stats = [
    { label: "Total Tasks", value: myTasks.length, icon: "tasks", color: COLORS.blue, sub: "Across all team" },
    { label: "Completed", value: completed, icon: "check", color: COLORS.success, sub: `${myTasks.length ? Math.round((completed / myTasks.length) * 100) : 0}% completion rate` },
    { label: "In Progress", value: ongoing, icon: "activity", color: COLORS.teal, sub: "Active right now" },
    { label: "Pending", value: pending, icon: "clock", color: COLORS.warning, sub: "Waiting to start" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: textPrimary, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Good morning, {user.name.split(" ")[0]} 👋</h1>
        <p style={{ color: textSecondary, fontSize: 14 }}>Here's an overview of your team's progress</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: cardBg, borderRadius: 16, padding: "20px", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, background: `${s.color}18`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={s.icon} size={20} color={s.color} />
              </div>
              <span style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
            <div style={{ color: textPrimary, fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.label}</div>
            <div style={{ color: textSecondary, fontSize: 12 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Team overview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: cardBg, borderRadius: 16, padding: "20px", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}` }}>
          <h3 style={{ color: textPrimary, fontWeight: 700, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Icon name="team" size={16} color={COLORS.teal} />Team Members</h3>
          {teamMembers.length === 0 ? <p style={{ color: textSecondary, fontSize: 13 }}>No team members yet. Invite some!</p> : teamMembers.map(m => {
            const mTasks = myTasks.filter(t => t.assignedTo.includes(m.id));
            const mCompleted = mTasks.filter(t => t.status === "completed").length;
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Avatar initials={m.avatar} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: textPrimary, fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                  <ProgressBar value={mCompleted} max={Math.max(mTasks.length, 1)} />
                  <div style={{ color: textSecondary, fontSize: 11, marginTop: 3 }}>{mCompleted}/{mTasks.length} tasks done</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: cardBg, borderRadius: 16, padding: "20px", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}` }}>
          <h3 style={{ color: textPrimary, fontWeight: 700, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Icon name="activity" size={16} color={COLORS.teal} />Task Breakdown</h3>
          {[{ label: "Completed", value: completed, total: myTasks.length, color: COLORS.success }, { label: "In Progress", value: ongoing, total: myTasks.length, color: COLORS.teal }, { label: "Pending", value: pending, total: myTasks.length, color: COLORS.warning }].map(item => (
            <div key={item.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: textSecondary, fontSize: 13 }}>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700, fontSize: 13 }}>{item.value}</span>
              </div>
              <ProgressBar value={item.value} max={Math.max(item.total, 1)} color={item.color} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Task List View ───────────────────────────────────────────────────────────
function TaskListView({ user, tasks, setTasks, darkMode, filterEmployeeId }) {
  const [search, setSearch]             = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAddTask, setShowAddTask]   = useState(false);
  const [assignMode, setAssignMode]     = useState("team"); // "team" | "specific"
  const [newTask, setNewTask]           = useState({ title: "", description: "", deadline: "", priority: "medium", assignedTo: [], category: "" });

  const teamMembers = MOCK_USERS.employees.filter(e => e.teamId === user.teamId);
  const myTasks = tasks.filter(t => user.role === "manager" ? t.managerId === user.id : t.assignedTo.includes(user.id));
  const filtered = myTasks.filter(t =>
    (!search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())) &&
    (filterPriority === "all" || t.priority === filterPriority) &&
    (filterStatus === "all" || t.status === filterStatus) &&
    (!filterEmployeeId || t.assignedTo.includes(filterEmployeeId))
  );

  const cardBg      = darkMode ? COLORS.navyLight : "#fff";
  const inputBg     = darkMode ? "rgba(255,255,255,0.05)" : COLORS.offWhite;
  const inputBorder = darkMode ? "rgba(255,255,255,0.10)" : COLORS.softGrey;
  const textPrimary    = darkMode ? "#E8F0FF" : COLORS.navy;
  const textSecondary  = darkMode ? "#7BAAD0" : COLORS.darkGrey;
  const divider        = darkMode ? "rgba(255,255,255,0.07)" : COLORS.softGrey;

  // Toggle a specific member on/off
  const toggleMember = (id) => {
    setNewTask(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(id)
        ? prev.assignedTo.filter(x => x !== id)
        : [...prev.assignedTo, id],
    }));
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    const finalAssigned = assignMode === "team"
      ? teamMembers.map(m => m.id)            // whole team
      : newTask.assignedTo;                   // chosen individuals
    const task = {
      id: `t${Date.now()}`,
      ...newTask,
      assignedTo: finalAssigned,
      teamId: user.teamId,
      managerId: user.id,
      comments: [],
      createdAt: new Date().toISOString().split("T")[0],
      status: "pending",
    };
    setTasks(prev => [...prev, task]);
    setNewTask({ title: "", description: "", deadline: "", priority: "medium", assignedTo: [], category: "" });
    setAssignMode("team");
    setShowAddTask(false);
  };

  const updateTask = (updated) => setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  const deleteTask = (id)      => setTasks(prev => prev.filter(t => t.id !== id));

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    borderRadius: 8, color: textPrimary,
    fontSize: 14, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.18s",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800 }}>{user.role === "manager" ? "All Tasks" : "My Tasks"}</h2>
        {user.role === "manager" && (
          <button onClick={() => setShowAddTask(s => !s)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: showAddTask ? `${COLORS.teal}18` : `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: showAddTask ? `1px solid ${COLORS.teal}` : "none", borderRadius: 10, cursor: "pointer", color: showAddTask ? COLORS.teal : "#fff", fontWeight: 600, fontSize: 14, transition: "all 0.2s" }}>
            <Icon name={showAddTask ? "x" : "plus"} size={16} color={showAddTask ? COLORS.teal : "#fff"} />
            {showAddTask ? "Cancel" : "Add Task"}
          </button>
        )}
      </div>

      {/* ── Add Task Form ── */}
      {showAddTask && (
        <div style={{ background: cardBg, borderRadius: 18, padding: "24px", marginBottom: 24, border: `1px solid ${COLORS.teal}40`, boxShadow: `0 4px 32px rgba(13,191,191,0.10)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${COLORS.teal}30, ${COLORS.blue}30)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="plus" size={18} color={COLORS.teal} />
            </div>
            <div style={{ color: textPrimary, fontWeight: 800, fontSize: 16 }}>New Task</div>
          </div>

          {/* Row 1: Title + Category */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ color: textSecondary, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Title *</label>
              <input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="e.g. Design new homepage" style={inputStyle}
                onFocus={e => e.target.style.borderColor = COLORS.teal}
                onBlur={e => e.target.style.borderColor = inputBorder} />
            </div>
            <div>
              <label style={{ color: textSecondary, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</label>
              <input value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })} placeholder="e.g. Engineering, Design…" style={inputStyle}
                onFocus={e => e.target.style.borderColor = COLORS.teal}
                onBlur={e => e.target.style.borderColor = inputBorder} />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: textSecondary, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
            <textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="What needs to be done?" rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
              onFocus={e => e.target.style.borderColor = COLORS.teal}
              onBlur={e => e.target.style.borderColor = inputBorder} />
          </div>

          {/* Row 2: Deadline + Priority */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ color: textSecondary, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Deadline</label>
              <input type="date" value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })} style={inputStyle}
                onFocus={e => e.target.style.borderColor = COLORS.teal}
                onBlur={e => e.target.style.borderColor = inputBorder} />
            </div>
            <div>
              <label style={{ color: textSecondary, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Priority</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { val: "low",    label: "Low",    color: COLORS.success },
                  { val: "medium", label: "Med",    color: COLORS.warning },
                  { val: "high",   label: "High",   color: COLORS.danger  },
                ].map(p => (
                  <button key={p.val} onClick={() => setNewTask({ ...newTask, priority: p.val })}
                    style={{ flex: 1, padding: "10px 4px", borderRadius: 8, border: `1.5px solid ${newTask.priority === p.val ? p.color : inputBorder}`, background: newTask.priority === p.val ? `${p.color}20` : inputBg, color: newTask.priority === p.val ? p.color : textSecondary, fontWeight: newTask.priority === p.val ? 700 : 500, fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Assign To — the upgraded section ── */}
          <div style={{ borderTop: `1px solid ${divider}`, paddingTop: 20, marginBottom: 20 }}>
            <label style={{ color: textSecondary, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Assign To
            </label>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button onClick={() => { setAssignMode("team"); setNewTask(prev => ({ ...prev, assignedTo: [] })); }}
                style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "12px 16px", borderRadius: 12, border: `2px solid ${assignMode === "team" ? COLORS.teal : inputBorder}`, background: assignMode === "team" ? `${COLORS.teal}15` : inputBg, cursor: "pointer", transition: "all 0.18s" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: assignMode === "team" ? `${COLORS.teal}25` : `${inputBorder}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="team" size={16} color={assignMode === "team" ? COLORS.teal : textSecondary} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: assignMode === "team" ? COLORS.teal : textPrimary, fontWeight: 700, fontSize: 13 }}>Entire Team</div>
                  <div style={{ color: textSecondary, fontSize: 11 }}>{teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}</div>
                </div>
                {assignMode === "team" && (
                  <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: COLORS.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="check" size={11} color="#fff" />
                  </div>
                )}
              </button>

              <button onClick={() => setAssignMode("specific")}
                style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "12px 16px", borderRadius: 12, border: `2px solid ${assignMode === "specific" ? COLORS.blue : inputBorder}`, background: assignMode === "specific" ? `${COLORS.blue}15` : inputBg, cursor: "pointer", transition: "all 0.18s" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: assignMode === "specific" ? `${COLORS.blue}25` : `${inputBorder}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="user" size={16} color={assignMode === "specific" ? COLORS.blue : textSecondary} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: assignMode === "specific" ? COLORS.blue : textPrimary, fontWeight: 700, fontSize: 13 }}>Specific People</div>
                  <div style={{ color: textSecondary, fontSize: 11 }}>
                    {assignMode === "specific" && newTask.assignedTo.length > 0
                      ? `${newTask.assignedTo.length} selected`
                      : "Pick individuals"}
                  </div>
                </div>
                {assignMode === "specific" && (
                  <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: COLORS.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="check" size={11} color="#fff" />
                  </div>
                )}
              </button>
            </div>

            {/* Entire Team preview */}
            {assignMode === "team" && (
              <div style={{ padding: "12px 16px", background: `${COLORS.teal}08`, borderRadius: 10, border: `1px solid ${COLORS.teal}25` }}>
                {teamMembers.length === 0 ? (
                  <p style={{ color: textSecondary, fontSize: 13, margin: 0 }}>⚠️ No team members yet — invite people first.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ color: textSecondary, fontSize: 12, marginRight: 4 }}>Will be assigned to:</span>
                    {teamMembers.map(m => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: `${COLORS.teal}18`, borderRadius: 20, border: `1px solid ${COLORS.teal}30` }}>
                        <Avatar initials={m.avatar} size={18} />
                        <span style={{ color: COLORS.teal, fontSize: 12, fontWeight: 600 }}>{m.name.split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Specific people picker */}
            {assignMode === "specific" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {teamMembers.length === 0 ? (
                  <p style={{ color: textSecondary, fontSize: 13, padding: "12px 16px", background: `${COLORS.warning}08`, borderRadius: 10, border: `1px solid ${COLORS.warning}25`, margin: 0 }}>⚠️ No team members yet. Go to My Team to invite people first.</p>
                ) : teamMembers.map(m => {
                  const selected = newTask.assignedTo.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => toggleMember(m.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${selected ? COLORS.blue : inputBorder}`, background: selected ? `${COLORS.blue}12` : inputBg, cursor: "pointer", transition: "all 0.18s", textAlign: "left", width: "100%" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <Avatar initials={m.avatar} size={36} color={selected ? COLORS.blue : COLORS.navyMid} />
                        {selected && (
                          <div style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: COLORS.blue, border: `2px solid ${cardBg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name="check" size={8} color="#fff" />
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: selected ? COLORS.blue : textPrimary, fontWeight: selected ? 700 : 500, fontSize: 14 }}>{m.name}</div>
                        <div style={{ color: textSecondary, fontSize: 12 }}>{m.email}</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${selected ? COLORS.blue : inputBorder}`, background: selected ? COLORS.blue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                        {selected && <Icon name="check" size={11} color="#fff" />}
                      </div>
                    </button>
                  );
                })}

                {/* Select All / Clear */}
                {teamMembers.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={() => setNewTask(prev => ({ ...prev, assignedTo: teamMembers.map(m => m.id) }))}
                      style={{ flex: 1, padding: "8px", background: "transparent", border: `1px solid ${inputBorder}`, borderRadius: 8, cursor: "pointer", color: textSecondary, fontSize: 12, fontWeight: 600 }}>
                      Select All
                    </button>
                    <button onClick={() => setNewTask(prev => ({ ...prev, assignedTo: [] }))}
                      style={{ flex: 1, padding: "8px", background: "transparent", border: `1px solid ${inputBorder}`, borderRadius: 8, cursor: "pointer", color: textSecondary, fontSize: 12, fontWeight: 600 }}>
                      Clear
                    </button>
                  </div>
                )}

                {newTask.assignedTo.length === 0 && (
                  <div style={{ color: COLORS.warning, fontSize: 12, display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
                    <Icon name="alertTriangle" size={13} color={COLORS.warning} />
                    Select at least one person
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={addTask}
              disabled={!newTask.title.trim() || (assignMode === "specific" && newTask.assignedTo.length === 0)}
              style={{ flex: 1, padding: "12px", background: (!newTask.title.trim() || (assignMode === "specific" && newTask.assignedTo.length === 0)) ? `${COLORS.midGrey}44` : `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: "none", borderRadius: 10, cursor: (!newTask.title.trim() || (assignMode === "specific" && newTask.assignedTo.length === 0)) ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 0.2s" }}>
              <Icon name="check" size={16} color="#fff" /> Create Task
            </button>
            <button onClick={() => { setShowAddTask(false); setNewTask({ title: "", description: "", deadline: "", priority: "medium", assignedTo: [], category: "" }); setAssignMode("team"); }}
              style={{ padding: "12px 22px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 10, cursor: "pointer", color: textSecondary, fontWeight: 600, fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <Icon name="search" size={15} color={COLORS.midGrey} />
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." style={{ width: "100%", padding: "10px 14px 10px 36px", background: cardBg, border: `1px solid ${inputBorder}`, borderRadius: 10, color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "low", "medium", "high"].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              style={{ padding: "8px 14px", background: filterPriority === p ? `${COLORS.teal}22` : cardBg, border: `1px solid ${filterPriority === p ? COLORS.teal : inputBorder}`, borderRadius: 10, cursor: "pointer", color: filterPriority === p ? COLORS.teal : textSecondary, fontSize: 13, fontWeight: filterPriority === p ? 700 : 400, textTransform: "capitalize", transition: "all 0.15s" }}>{p}</button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "8px 14px", background: cardBg, border: `1px solid ${inputBorder}`, borderRadius: 10, color: textPrimary, fontSize: 13, outline: "none" }}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="ongoing">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div style={{ color: textSecondary, fontSize: 13, marginBottom: 14 }}>
        {filtered.length} task{filtered.length !== 1 ? "s" : ""} found
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: textSecondary }}>
          <Icon name="tasks" size={48} color={COLORS.midGrey} />
          <p style={{ marginTop: 16 }}>No tasks found</p>
        </div>
      ) : filtered.map(t => (
        <TaskCard key={t.id} task={t} users={[user]} onUpdate={updateTask} onDelete={user.role === "manager" ? deleteTask : null} darkMode={darkMode} />
      ))}
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────
function KanbanBoard({ user, tasks, setTasks, darkMode }) {
  const myTasks = tasks.filter(t => t.managerId === user.id);
  const cols = [
    { id: "pending",   label: "To Do",       color: COLORS.midGrey },
    { id: "ongoing",   label: "In Progress",  color: COLORS.teal    },
    { id: "completed", label: "Done",         color: COLORS.success  },
  ];
  const colBg      = darkMode ? "#112240"                        : "#E8EEF6";
  const cardBg     = darkMode ? "#1A3358"                        : "#fff";
  const cardBorder = darkMode ? "rgba(255,255,255,0.10)"         : "#D8E4F0";
  const colBorder  = darkMode ? "rgba(255,255,255,0.08)"         : "#D0DAF0";
  const textPrimary   = darkMode ? "#E8F0FF" : COLORS.navy;
  const textSecondary = darkMode ? "#7BAAD0" : COLORS.darkGrey;
  const updateTask = (updated) => setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));

  return (
    <div>
      <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Kanban Board</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {cols.map(col => {
          const colTasks = myTasks.filter(t => t.status === col.id);
          return (
            <div key={col.id} style={{ background: colBg, borderRadius: 16, padding: "14px", minHeight: 480, border: `1px solid ${colBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "4px 2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, boxShadow: `0 0 6px ${col.color}88` }} />
                  <span style={{ color: textPrimary, fontWeight: 700, fontSize: 14 }}>{col.label}</span>
                </div>
                <span style={{ background: `${col.color}30`, color: col.color, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{colTasks.length}</span>
              </div>
              {colTasks.map(t => (
                <div key={t.id} style={{ background: cardBg, borderRadius: 12, padding: "13px 14px", marginBottom: 10, border: `1px solid ${cardBorder}`, boxShadow: darkMode ? "0 2px 14px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                    <Badge label={t.priority} bg={`${getPriorityColor(t.priority)}30`} color={getPriorityColor(t.priority)} />
                    {t.category && <Badge label={t.category} bg={darkMode ? "rgba(46,125,212,0.3)" : `${COLORS.blue}18`} color={darkMode ? "#7BB8FF" : COLORS.blue} />}
                  </div>
                  <div style={{ color: textPrimary, fontWeight: 600, fontSize: 13, marginBottom: 5, lineHeight: 1.4 }}>{t.title}</div>
                  <div style={{ color: textSecondary, fontSize: 12, marginBottom: 10, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${cardBorder}`, paddingTop: 8 }}>
                    <span style={{ fontSize: 11, color: textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon name="clock" size={11} color={textSecondary} />{formatDate(t.deadline)}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {col.id !== "pending" && (
                        <button onClick={() => updateTask({ ...t, status: col.id === "ongoing" ? "pending" : "ongoing" })}
                          style={{ padding: "4px 9px", background: darkMode ? "rgba(255,255,255,0.08)" : `${COLORS.midGrey}18`, border: `1px solid ${darkMode ? "rgba(255,255,255,0.14)" : COLORS.softGrey}`, borderRadius: 6, cursor: "pointer", color: textSecondary, fontSize: 12, fontWeight: 600 }}>←</button>
                      )}
                      {col.id !== "completed" && (
                        <button onClick={() => updateTask({ ...t, status: col.id === "pending" ? "ongoing" : "completed" })}
                          style={{ padding: "4px 9px", background: `${col.color}28`, border: `1px solid ${col.color}55`, borderRadius: 6, cursor: "pointer", color: col.color, fontSize: 12, fontWeight: 600 }}>→</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div style={{ textAlign: "center", padding: "44px 16px", color: textSecondary, fontSize: 13, opacity: 0.55, border: `2px dashed ${colBorder}`, borderRadius: 10, marginTop: 8 }}>
                  Drop tasks here
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team Management ──────────────────────────────────────────────────────────
function TeamManagement({ user, invitations, setInvitations, notifications, setNotifications, darkMode }) {
  const [teamMembers, setTeamMembers] = useState(MOCK_USERS.employees.filter(e => e.teamId === user.teamId));
  const [gmailInput, setGmailInput] = useState("");
  const [gmailMessage, setGmailMessage] = useState("");
  const [gmailError, setGmailError] = useState("");
  const [gmailSuccess, setGmailSuccess] = useState("");
  const [sentInvites, setSentInvites] = useState([]);
  const [activeTab, setActiveTab] = useState("members");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const cardBg      = darkMode ? "#112240" : "#fff";
  const cardBorder  = darkMode ? "rgba(255,255,255,0.10)" : COLORS.softGrey;
  const inputBg     = darkMode ? "#0A1628" : COLORS.offWhite;
  const inputBorder = darkMode ? "rgba(255,255,255,0.14)" : "#C8D8EC";
  const textPrimary   = darkMode ? "#E8F0FF" : COLORS.navy;
  const textSecondary = darkMode ? "#7BAAD0" : COLORS.darkGrey;
  const divider       = darkMode ? "rgba(255,255,255,0.07)" : COLORS.softGrey;

  const nonMembers = MOCK_USERS.employees.filter(e => !teamMembers.find(m => m.id === e.id));

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const sendGmailInvite = () => {
    setGmailError(""); setGmailSuccess("");
    const email = gmailInput.trim().toLowerCase();
    if (!email) { setGmailError("Please enter a Gmail address."); return; }
    if (!validateEmail(email)) { setGmailError("Please enter a valid email address."); return; }
    if (sentInvites.find(i => i.email === email && i.status === "pending")) {
      setGmailError("An invite was already sent to this address."); return;
    }
    if (teamMembers.find(m => m.email === email)) {
      setGmailError("This person is already on your team!"); return;
    }

    // Check if they match a known demo user
    const knownUser = MOCK_USERS.employees.find(e => e.email === email);
    const invite = {
      id: `gi${Date.now()}`, email, name: knownUser ? knownUser.name : email.split("@")[0],
      avatar: knownUser ? knownUser.avatar : email.slice(0,2).toUpperCase(),
      message: gmailMessage || "Hi! I\'d love for you to join my team on FlowSync.",
      status: "pending", sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isKnown: !!knownUser, userId: knownUser?.id,
    };
    setSentInvites(prev => [invite, ...prev]);

    if (knownUser) {
      setInvitations(prev => [...prev, { id: `inv${Date.now()}`, managerId: user.id, managerName: user.name, teamId: user.teamId, employeeId: knownUser.id, status: "pending", message: invite.message, time: "just now" }]);
      setNotifications(prev => [{ id: `n${Date.now()}`, type: "invitation", message: `${user.name} invited you to their team via email`, time: "just now", read: false, userId: knownUser.id }, ...prev]);
    }

    setGmailSuccess(`Invite sent to ${email}! ${knownUser ? "They\'ll see it in their FlowSync inbox." : "They\'ll receive an email shortly."}`);
    setGmailInput(""); setGmailMessage("");
  };

  const quickInvite = (employee) => {
    const alreadyInvited = invitations.some(i => i.employeeId === employee.id && i.managerId === user.id && i.status === "pending");
    if (alreadyInvited) return;
    const inv = { id: `inv${Date.now()}`, managerId: user.id, managerName: user.name, teamId: user.teamId, employeeId: employee.id, status: "pending", message: "Join our team on FlowSync!", time: "just now" };
    setInvitations(prev => [...prev, inv]);
    setNotifications(prev => [{ id: `n${Date.now()}`, type: "invitation", message: `${user.name} invited you to their team`, time: "just now", read: false, userId: employee.id }, ...prev]);
  };

  const removeMember = (memberId) => {
    setRemovingId(memberId);
    setTimeout(() => {
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      const emp = MOCK_USERS.employees.find(e => e.id === memberId);
      if (emp) emp.teamId = null;
      setRemovingId(null);
    }, 300);
  };

  const getAiSuggestion = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 200, messages: [{ role: "user", content: `Give a short 2-sentence practical tip for a manager named ${user.name} with ${teamMembers.length} team member(s) on improving team workflow. Be specific and actionable.` }] })
      });
      const data = await res.json();
      setAiSuggestion(data.content[0].text);
    } catch { setAiSuggestion("Clear ownership of tasks reduces confusion — make sure every task has exactly one primary owner and a realistic deadline."); }
    setAiLoading(false);
  };

  const tabStyle = (id) => ({
    padding: "9px 20px", background: activeTab === id ? `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})` : (darkMode ? "rgba(255,255,255,0.05)" : COLORS.offWhite),
    border: `1px solid ${activeTab === id ? "transparent" : inputBorder}`,
    borderRadius: 10, cursor: "pointer", color: activeTab === id ? "#fff" : textSecondary,
    fontWeight: activeTab === id ? 700 : 500, fontSize: 13, transition: "all 0.18s",
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800 }}>My Team</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setActiveTab("members")} style={tabStyle("members")}>
            👥 Members ({teamMembers.length})
          </button>
          <button onClick={() => setActiveTab("invite")} style={tabStyle("invite")}>
            ✉️ Invite
          </button>
          <button onClick={() => setActiveTab("sent")} style={tabStyle("sent")}>
            📬 Sent ({sentInvites.length + invitations.filter(i => i.managerId === user.id).length})
          </button>
        </div>
      </div>

      {/* AI tip banner */}
      <div style={{ background: darkMode ? "rgba(13,191,191,0.08)" : `linear-gradient(135deg, ${COLORS.teal}10, ${COLORS.blue}10)`, borderRadius: 14, padding: "16px 20px", border: `1px solid ${COLORS.teal}30`, marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <Icon name="star" size={18} color={COLORS.teal} />
          {aiSuggestion
            ? <p style={{ color: textSecondary, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{aiSuggestion}</p>
            : <span style={{ color: textSecondary, fontSize: 13 }}>Get an AI-powered tip for managing your team better.</span>
          }
        </div>
        <button onClick={getAiSuggestion} disabled={aiLoading} style={{ padding: "8px 16px", background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600, opacity: aiLoading ? 0.7 : 1, flexShrink: 0 }}>
          {aiLoading ? "Thinking…" : "Get Tip ✨"}
        </button>
      </div>

      {/* ── MEMBERS TAB ── */}
      {activeTab === "members" && (
        <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, overflow: "hidden" }}>
          {teamMembers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px" }}>
              <Icon name="team" size={48} color={COLORS.midGrey} />
              <p style={{ color: textSecondary, marginTop: 16, fontSize: 14 }}>No team members yet.<br/>Go to the Invite tab to add people.</p>
            </div>
          ) : teamMembers.map((m, idx) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: idx < teamMembers.length - 1 ? `1px solid ${divider}` : "none", opacity: removingId === m.id ? 0.4 : 1, transition: "opacity 0.3s" }}>
              <Avatar initials={m.avatar} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: textPrimary, fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                <div style={{ color: textSecondary, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="mail" size={11} color={textSecondary} />{m.email}
                </div>
              </div>
              <Badge label="Active" bg={`${COLORS.success}22`} color={COLORS.success} />
              <button onClick={() => removeMember(m.id)} title="Remove from team" style={{ padding: "6px 10px", background: `${COLORS.danger}15`, border: `1px solid ${COLORS.danger}30`, borderRadius: 8, cursor: "pointer", color: COLORS.danger, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── INVITE TAB ── */}
      {activeTab === "invite" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Gmail invite form */}
          <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${COLORS.teal}30, ${COLORS.blue}30)`, border: `1px solid ${COLORS.teal}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="mail" size={18} color={COLORS.teal} />
              </div>
              <div>
                <div style={{ color: textPrimary, fontWeight: 700, fontSize: 15 }}>Invite via Gmail</div>
                <div style={{ color: textSecondary, fontSize: 12 }}>Send an invitation to any email address</div>
              </div>
            </div>

            <label style={{ color: textSecondary, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Gmail / Email Address *</label>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={COLORS.midGrey} strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke={COLORS.midGrey} strokeWidth="2"/></svg>
              </div>
              <input
                value={gmailInput}
                onChange={e => { setGmailInput(e.target.value); setGmailError(""); setGmailSuccess(""); }}
                onKeyDown={e => e.key === "Enter" && sendGmailInvite()}
                placeholder="colleague@gmail.com"
                style={{ width: "100%", padding: "11px 14px 11px 38px", background: inputBg, border: `1px solid ${gmailError ? COLORS.danger : gmailSuccess ? COLORS.success : inputBorder}`, borderRadius: 10, color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              />
            </div>

            <label style={{ color: textSecondary, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Personal Message (optional)</label>
            <textarea
              value={gmailMessage}
              onChange={e => setGmailMessage(e.target.value)}
              placeholder="Hi! I'd love for you to join my team on FlowSync..."
              rows={3}
              style={{ width: "100%", padding: "10px 14px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 10, color: textPrimary, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: 14, lineHeight: 1.5 }}
            />

            {gmailError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: `${COLORS.danger}12`, border: `1px solid ${COLORS.danger}30`, borderRadius: 8, marginBottom: 14 }}>
                <Icon name="x" size={14} color={COLORS.danger} />
                <span style={{ color: COLORS.danger, fontSize: 13 }}>{gmailError}</span>
              </div>
            )}
            {gmailSuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: `${COLORS.success}12`, border: `1px solid ${COLORS.success}30`, borderRadius: 8, marginBottom: 14 }}>
                <Icon name="check" size={14} color={COLORS.success} />
                <span style={{ color: COLORS.success, fontSize: 13 }}>{gmailSuccess}</span>
              </div>
            )}

            <button onClick={sendGmailInvite} style={{ width: "100%", padding: "12px", background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon name="send" size={16} color="#fff" /> Send Invitation
            </button>
          </div>

          {/* Quick invite — known users not on team */}
          <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: "24px" }}>
            <div style={{ color: textPrimary, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Quick Invite</div>
            <div style={{ color: textSecondary, fontSize: 12, marginBottom: 18 }}>FlowSync users not yet on your team</div>
            {nonMembers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: textSecondary, fontSize: 13, opacity: 0.7 }}>
                🎉 Everyone is already on your team!
              </div>
            ) : nonMembers.map((e, idx) => {
              const alreadyInvited = invitations.some(i => i.employeeId === e.id && i.managerId === user.id && i.status === "pending");
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: idx < nonMembers.length - 1 ? `1px solid ${divider}` : "none" }}>
                  <Avatar initials={e.avatar} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: textPrimary, fontWeight: 600, fontSize: 13 }}>{e.name}</div>
                    <div style={{ color: textSecondary, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon name="mail" size={11} color={textSecondary} />{e.email}
                    </div>
                  </div>
                  <button onClick={() => quickInvite(e)} disabled={alreadyInvited}
                    style={{ padding: "7px 14px", background: alreadyInvited ? `${COLORS.midGrey}18` : `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: `1px solid ${alreadyInvited ? inputBorder : "transparent"}`, borderRadius: 8, cursor: alreadyInvited ? "default" : "pointer", color: alreadyInvited ? COLORS.midGrey : "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {alreadyInvited ? "Invited ✓" : "Invite"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SENT TAB ── */}
      {activeTab === "sent" && (
        <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, overflow: "hidden" }}>
          {sentInvites.length === 0 && invitations.filter(i => i.managerId === user.id).length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px" }}>
              <Icon name="send" size={48} color={COLORS.midGrey} />
              <p style={{ color: textSecondary, marginTop: 16, fontSize: 14 }}>No invitations sent yet.</p>
            </div>
          ) : (
            <>
              {sentInvites.map((inv, idx) => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 20px", borderBottom: `1px solid ${divider}` }}>
                  <Avatar initials={inv.avatar} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: textPrimary, fontWeight: 600, fontSize: 14 }}>{inv.name}</div>
                    <div style={{ color: textSecondary, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon name="mail" size={11} color={textSecondary} />{inv.email}
                    </div>
                    {inv.message && <div style={{ color: textSecondary, fontSize: 12, marginTop: 3, fontStyle: "italic", opacity: 0.8 }}>"{inv.message}"</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <Badge label={inv.isKnown ? "Sent to inbox" : "Email sent"} bg={`${COLORS.teal}20`} color={COLORS.teal} />
                    <span style={{ color: COLORS.midGrey, fontSize: 11 }}>{inv.sentAt}</span>
                  </div>
                </div>
              ))}
              {invitations.filter(i => i.managerId === user.id).map((inv) => {
                const emp = MOCK_USERS.employees.find(e => e.id === inv.employeeId);
                return emp ? (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 20px", borderBottom: `1px solid ${divider}` }}>
                    <Avatar initials={emp.avatar} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: textPrimary, fontWeight: 600, fontSize: 14 }}>{emp.name}</div>
                      <div style={{ color: textSecondary, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <Icon name="mail" size={11} color={textSecondary} />{emp.email}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <Badge label={inv.status === "pending" ? "Pending" : inv.status === "accepted" ? "Accepted" : "Declined"}
                        bg={inv.status === "accepted" ? `${COLORS.success}20` : inv.status === "rejected" ? `${COLORS.danger}20` : `${COLORS.warning}20`}
                        color={inv.status === "accepted" ? COLORS.success : inv.status === "rejected" ? COLORS.danger : COLORS.warning} />
                      <span style={{ color: COLORS.midGrey, fontSize: 11 }}>{inv.time}</span>
                    </div>
                  </div>
                ) : null;
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function Analytics({ user, tasks, darkMode }) {
  const myTasks = tasks.filter(t => t.managerId === user.id);
  const textPrimary = darkMode ? "#fff" : COLORS.navy;
  const textSecondary = darkMode ? COLORS.midGrey : COLORS.darkGrey;
  const cardBg = darkMode ? COLORS.navyLight : "#fff";
  const byPriority = { high: myTasks.filter(t => t.priority === "high").length, medium: myTasks.filter(t => t.priority === "medium").length, low: myTasks.filter(t => t.priority === "low").length };
  const byStatus = { completed: myTasks.filter(t => t.status === "completed").length, ongoing: myTasks.filter(t => t.status === "ongoing").length, pending: myTasks.filter(t => t.status === "pending").length };
  const completionRate = myTasks.length ? Math.round((byStatus.completed / myTasks.length) * 100) : 0;
  const teamMembers = MOCK_USERS.employees.filter(e => e.teamId === user.teamId);

  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const getInsight = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 250,
          messages: [{ role: "user", content: `Analyze this team's task data and give a 3-sentence insight with recommendations:\n- Total tasks: ${myTasks.length}\n- Completed: ${byStatus.completed}\n- In Progress: ${byStatus.ongoing}\n- Pending: ${byStatus.pending}\n- High priority: ${byPriority.high}\n- Team size: ${teamMembers.length}\n- Completion rate: ${completionRate}%\n\nBe specific and actionable.` }]
        })
      });
      const data = await res.json();
      setAiInsight(data.content[0].text);
    } catch { setAiInsight("Your team shows solid momentum. Focus on clearing the high-priority backlog first."); }
    setAiLoading(false);
  };

  return (
    <div>
      <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Analytics</h2>

      {/* Completion Rate Spotlight */}
      <div style={{ background: `linear-gradient(135deg, ${COLORS.navyMid}, ${COLORS.blue})`, borderRadius: 20, padding: "32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, width: 200, height: 200, borderRadius: "50%", background: `${COLORS.teal}18` }} />
        <div style={{ position: "relative" }}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Overall Completion Rate</div>
          <div style={{ fontSize: 64, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 12 }}>{completionRate}<span style={{ fontSize: 28 }}>%</span></div>
          <ProgressBar value={completionRate} max={100} color={COLORS.teal} />
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 8 }}>{byStatus.completed} of {myTasks.length} tasks completed</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Priority breakdown */}
        <div style={{ background: cardBg, borderRadius: 16, padding: "20px", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}`, gridColumn: "span 2" }}>
          <h3 style={{ color: textPrimary, fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Task Distribution</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ color: textSecondary, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>By Priority</div>
              {[{ label: "High", value: byPriority.high, color: COLORS.danger }, { label: "Medium", value: byPriority.medium, color: COLORS.warning }, { label: "Low", value: byPriority.low, color: COLORS.success }].map(item => (
                <div key={item.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: textSecondary, fontSize: 13 }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: 700, fontSize: 13 }}>{item.value}</span>
                  </div>
                  <ProgressBar value={item.value} max={Math.max(myTasks.length, 1)} color={item.color} />
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: textSecondary, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>By Status</div>
              {[{ label: "Completed", value: byStatus.completed, color: COLORS.success }, { label: "In Progress", value: byStatus.ongoing, color: COLORS.teal }, { label: "Pending", value: byStatus.pending, color: COLORS.warning }].map(item => (
                <div key={item.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: textSecondary, fontSize: 13 }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: 700, fontSize: 13 }}>{item.value}</span>
                  </div>
                  <ProgressBar value={item.value} max={Math.max(myTasks.length, 1)} color={item.color} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Performance */}
        <div style={{ background: cardBg, borderRadius: 16, padding: "20px", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}` }}>
          <h3 style={{ color: textPrimary, fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Team Performance</h3>
          {teamMembers.map(m => {
            const mTasks = myTasks.filter(t => t.assignedTo.includes(m.id));
            const mDone = mTasks.filter(t => t.status === "completed").length;
            const rate = mTasks.length ? Math.round((mDone / mTasks.length) * 100) : 0;
            return (
              <div key={m.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Avatar initials={m.avatar} size={26} />
                  <span style={{ color: textPrimary, fontSize: 12, fontWeight: 600, flex: 1 }}>{m.name.split(" ")[0]}</span>
                  <span style={{ color: COLORS.teal, fontSize: 12, fontWeight: 700 }}>{rate}%</span>
                </div>
                <ProgressBar value={mDone} max={Math.max(mTasks.length, 1)} />
              </div>
            );
          })}
          {teamMembers.length === 0 && <p style={{ color: textSecondary, fontSize: 13 }}>No team data yet</p>}
        </div>
      </div>

      {/* AI Insights */}
      <div style={{ background: `linear-gradient(135deg, ${COLORS.teal}12, ${COLORS.blue}12)`, borderRadius: 16, padding: "20px", border: `1px solid ${COLORS.teal}30` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: aiInsight ? 12 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="zap" size={18} color={COLORS.teal} />
            <span style={{ color: textPrimary, fontWeight: 700, fontSize: 14 }}>AI Insights</span>
          </div>
          <button onClick={getInsight} disabled={aiLoading} style={{ padding: "8px 18px", background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600, opacity: aiLoading ? 0.7 : 1 }}>
            {aiLoading ? "Analyzing..." : "Analyze ✨"}
          </button>
        </div>
        {aiInsight && <p style={{ color: textSecondary, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{aiInsight}</p>}
      </div>
    </div>
  );
}

// ─── Employee Inbox ───────────────────────────────────────────────────────────
function EmployeeInbox({ user, invitations, setInvitations, notifications, setNotifications, darkMode }) {
  const myInvites = invitations.filter(i => i.employeeId === user.id && i.status === "pending");
  const textPrimary = darkMode ? "#fff" : COLORS.navy;
  const textSecondary = darkMode ? COLORS.midGrey : COLORS.darkGrey;
  const cardBg = darkMode ? COLORS.navyLight : "#fff";

  const handleInvite = (invId, action) => {
    setInvitations(prev => prev.map(i => i.id === invId ? { ...i, status: action } : i));
    if (action === "accepted") {
      const inv = invitations.find(i => i.id === invId);
      MOCK_USERS.employees.find(e => e.id === user.id).teamId = inv.teamId;
    }
    setNotifications(prev => [{ id: `n${Date.now()}`, type: "invite_response", message: `You ${action} the team invitation`, time: "just now", read: false, userId: user.id }, ...prev]);
  };

  return (
    <div>
      <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Inbox</h2>
      {myInvites.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, background: cardBg, borderRadius: 16, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}` }}>
          <Icon name="mail" size={48} color={COLORS.midGrey} />
          <p style={{ color: textSecondary, marginTop: 16 }}>No pending invitations</p>
        </div>
      ) : myInvites.map(inv => (
        <div key={inv.id} style={{ background: cardBg, borderRadius: 16, padding: "20px", marginBottom: 16, border: `1px solid ${COLORS.teal}30`, boxShadow: "0 2px 12px rgba(13,191,191,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.teal})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="mail" size={20} color="#fff" />
            </div>
            <div>
              <div style={{ color: textPrimary, fontWeight: 700, fontSize: 15 }}>Team Invitation</div>
              <div style={{ color: textSecondary, fontSize: 13 }}>from {inv.managerName} · {inv.time}</div>
            </div>
          </div>
          <p style={{ color: textSecondary, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>"{inv.message}"</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => handleInvite(inv.id, "accepted")} style={{ flex: 1, padding: "10px", background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", fontWeight: 600, fontSize: 14 }}>
              ✓ Accept
            </button>
            <button onClick={() => handleInvite(inv.id, "rejected")} style={{ flex: 1, padding: "10px", background: `${COLORS.danger}18`, border: `1px solid ${COLORS.danger}44`, borderRadius: 10, cursor: "pointer", color: COLORS.danger, fontWeight: 600, fontSize: 14 }}>
              ✗ Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────
function NotificationsPanel({ user, notifications, setNotifications, darkMode }) {
  const myNotifs = notifications.filter(n => n.userId === user.id);
  const textPrimary = darkMode ? "#fff" : COLORS.navy;
  const textSecondary = darkMode ? COLORS.midGrey : COLORS.darkGrey;
  const cardBg = darkMode ? COLORS.navyLight : "#fff";

  const markAllRead = () => setNotifications(prev => prev.map(n => n.userId === user.id ? { ...n, read: true } : n));
  const iconMap = { task_update: "edit", task_complete: "check", invitation: "mail", task_assigned: "tasks", invite_response: "check" };
  const colorMap = { task_update: COLORS.blue, task_complete: COLORS.success, invitation: COLORS.teal, task_assigned: COLORS.warning, invite_response: COLORS.success };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800 }}>Notifications</h2>
        <button onClick={markAllRead} style={{ padding: "8px 16px", background: `${COLORS.teal}18`, border: `1px solid ${COLORS.teal}44`, borderRadius: 8, cursor: "pointer", color: COLORS.teal, fontSize: 13, fontWeight: 600 }}>Mark all read</button>
      </div>
      {myNotifs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, background: cardBg, borderRadius: 16, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}` }}>
          <Icon name="bell" size={48} color={COLORS.midGrey} />
          <p style={{ color: textSecondary, marginTop: 16 }}>No notifications</p>
        </div>
      ) : myNotifs.map(n => (
        <div key={n.id} onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))} style={{ background: cardBg, borderRadius: 14, padding: "16px 20px", marginBottom: 12, border: `1px solid ${n.read ? (darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey) : COLORS.teal + "44"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, opacity: n.read ? 0.7 : 1, transition: "all 0.2s" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${colorMap[n.type] || COLORS.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name={iconMap[n.type] || "bell"} size={18} color={colorMap[n.type] || COLORS.blue} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: textPrimary, fontSize: 14, fontWeight: n.read ? 400 : 600, marginBottom: 3 }}>{n.message}</div>
            <div style={{ color: COLORS.midGrey, fontSize: 12 }}>{n.time}</div>
          </div>
          {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.teal, flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
function ActivityLog({ user, tasks, darkMode }) {
  const myTasks = tasks.filter(t => t.assignedTo.includes(user.id));
  const textPrimary = darkMode ? "#fff" : COLORS.navy;
  const textSecondary = darkMode ? COLORS.midGrey : COLORS.darkGrey;
  const cardBg = darkMode ? COLORS.navyLight : "#fff";

  const activities = myTasks.flatMap(t => [
    { id: `a-${t.id}-assigned`, type: "assigned", text: `Assigned to "${t.title}"`, time: t.createdAt, color: COLORS.blue },
    ...t.comments.map(c => ({ id: `a-${c.id}`, type: "comment", text: `Commented on "${t.title}": "${c.text}"`, time: c.time, color: COLORS.teal })),
    ...(t.status !== "pending" ? [{ id: `a-${t.id}-status`, type: "status", text: `Moved "${t.title}" to ${getStatusLabel(t.status)}`, time: "recently", color: getStatusColor(t.status) }] : []),
  ]);

  return (
    <div>
      <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Activity Log</h2>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: `linear-gradient(to bottom, ${COLORS.teal}, ${COLORS.blue}44)`, borderRadius: 1 }} />
        {activities.length === 0 ? <p style={{ color: textSecondary, fontSize: 14, paddingLeft: 48 }}>No activity yet</p> : activities.map(a => (
          <div key={a.id} style={{ display: "flex", gap: 16, marginBottom: 20, paddingLeft: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${a.color}18`, border: `2px solid ${a.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
              <Icon name={a.type === "assigned" ? "tasks" : a.type === "comment" ? "comment" : "check"} size={16} color={a.color} />
            </div>
            <div style={{ background: cardBg, borderRadius: 12, padding: "12px 16px", flex: 1, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}` }}>
              <div style={{ color: textPrimary, fontSize: 13, marginBottom: 4 }}>{a.text}</div>
              <div style={{ color: COLORS.midGrey, fontSize: 11 }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────
function ProfileSection({ user, setUser, tasks, darkMode }) {
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio || "");
  const [editPhone, setEditPhone] = useState(user.phone || "");
  const [editDept, setEditDept] = useState(user.department || "");
  const [editLocation, setEditLocation] = useState(user.location || "");
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const cardBg      = darkMode ? "#112240" : "#fff";
  const cardBorder  = darkMode ? "rgba(255,255,255,0.10)" : COLORS.softGrey;
  const inputBg     = darkMode ? "#0A1628" : COLORS.offWhite;
  const inputBorder = darkMode ? "rgba(255,255,255,0.14)" : "#C8D8EC";
  const textPrimary   = darkMode ? "#E8F0FF" : COLORS.navy;
  const textSecondary = darkMode ? "#7BAAD0" : COLORS.darkGrey;
  const divider       = darkMode ? "rgba(255,255,255,0.07)" : COLORS.softGrey;

  const myTasks   = tasks.filter(t => t.assignedTo?.includes(user.id) || t.managerId === user.id);
  const completed = myTasks.filter(t => t.status === "completed").length;
  const ongoing   = myTasks.filter(t => t.status === "ongoing").length;
  const rate      = myTasks.length ? Math.round((completed / myTasks.length) * 100) : 0;

  const handlePhoto = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => setPhotoUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handlePhoto(e.dataTransfer.files[0]);
  };

  const saveProfile = () => {
    if (!editName.trim()) return;
    setUser(prev => ({
      ...prev,
      name: editName.trim(),
      avatar: editName.trim().split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(),
      bio: editBio, phone: editPhone, department: editDept,
      location: editLocation, photoUrl,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle = {
    width: "100%", padding: "11px 14px",
    background: inputBg, border: `1px solid ${inputBorder}`,
    borderRadius: 10, color: textPrimary, fontSize: 14,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    transition: "border-color 0.2s",
  };

  const labelStyle = { color: textSecondary, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 };

  return (
    <div>
      <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>My Profile</h2>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left column: photo + stats ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Photo card */}
          <div style={{ background: cardBg, borderRadius: 20, border: `1px solid ${cardBorder}`, overflow: "hidden" }}>
            {/* Cover banner */}
            <div style={{ height: 90, background: `linear-gradient(135deg, ${COLORS.navyMid}, ${COLORS.blue}, ${COLORS.teal})`, position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
            </div>

            <div style={{ padding: "0 24px 24px", position: "relative" }}>
              {/* Avatar with upload zone */}
              <div style={{ position: "relative", display: "inline-block", marginTop: -40, marginBottom: 14 }}>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{ width: 80, height: 80, borderRadius: "50%", cursor: "pointer", position: "relative", border: `3px solid ${dragging ? COLORS.teal : (darkMode ? "#112240" : "#fff")}`, boxShadow: dragging ? `0 0 0 3px ${COLORS.teal}55` : "0 4px 20px rgba(0,0,0,0.2)", transition: "all 0.2s", overflow: "hidden" }}>
                  {photoUrl
                    ? <img src={photoUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>{editName.slice(0,2).toUpperCase()}</div>}
                  {/* Hover overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <Icon name="edit" size={20} color="#fff" />
                  </div>
                </div>
                {/* Online dot */}
                <div style={{ position: "absolute", bottom: 3, right: 3, width: 14, height: 14, borderRadius: "50%", background: COLORS.success, border: `2px solid ${darkMode ? "#112240" : "#fff"}` }} />
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handlePhoto(e.target.files[0])} />

              <div style={{ color: textPrimary, fontWeight: 800, fontSize: 18, marginBottom: 2 }}>{editName || user.name}</div>
              <div style={{ color: COLORS.teal, fontSize: 13, fontWeight: 600, textTransform: "capitalize", marginBottom: 6 }}>{user.role}</div>
              <div style={{ color: textSecondary, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="mail" size={12} color={textSecondary} />{user.email}
              </div>
              {editDept && <div style={{ color: textSecondary, fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="star" size={12} color={textSecondary} />{editDept}
              </div>}
              {editLocation && <div style={{ color: textSecondary, fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="send" size={12} color={textSecondary} />{editLocation}
              </div>}

              <div style={{ marginTop: 14, padding: "10px 14px", background: dragging ? `${COLORS.teal}15` : `${COLORS.blue}10`, borderRadius: 10, border: `1.5px dashed ${dragging ? COLORS.teal : inputBorder}`, textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}>
                <div style={{ color: dragging ? COLORS.teal : textSecondary, fontSize: 12, fontWeight: 500 }}>
                  {dragging ? "Drop to upload 📸" : "Click or drag to change photo"}
                </div>
              </div>
              {photoUrl && (
                <button onClick={() => setPhotoUrl(null)} style={{ width: "100%", marginTop: 8, padding: "7px", background: `${COLORS.danger}12`, border: `1px solid ${COLORS.danger}30`, borderRadius: 8, cursor: "pointer", color: COLORS.danger, fontSize: 12, fontWeight: 600 }}>
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          {/* Stats card */}
          <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: "20px" }}>
            <div style={{ color: textPrimary, fontWeight: 700, fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="analytics" size={16} color={COLORS.teal} /> Task Stats
            </div>
            {[
              { label: "Total Tasks", value: myTasks.length, color: COLORS.blue },
              { label: "Completed",   value: completed,       color: COLORS.success },
              { label: "In Progress", value: ongoing,         color: COLORS.teal },
              { label: "Completion",  value: `${rate}%`,      color: rate > 70 ? COLORS.success : rate > 40 ? COLORS.warning : COLORS.danger },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${divider}` }}>
                <span style={{ color: textSecondary, fontSize: 13 }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700, fontSize: 14 }}>{s.value}</span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: textSecondary, fontSize: 12 }}>Completion Rate</span>
                <span style={{ color: COLORS.teal, fontWeight: 700, fontSize: 12 }}>{rate}%</span>
              </div>
              <div style={{ width: "100%", height: 7, background: darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${rate}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.blue})`, borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: edit form ── */}
        <div style={{ background: cardBg, borderRadius: 20, border: `1px solid ${cardBorder}`, padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <div style={{ color: textPrimary, fontWeight: 800, fontSize: 17 }}>Edit Profile</div>
              <div style={{ color: textSecondary, fontSize: 13, marginTop: 2 }}>Update your personal information</div>
            </div>
            {saved && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", background: `${COLORS.success}15`, border: `1px solid ${COLORS.success}40`, borderRadius: 10 }}>
                <Icon name="check" size={15} color={COLORS.success} />
                <span style={{ color: COLORS.success, fontSize: 13, fontWeight: 600 }}>Saved!</span>
              </div>
            )}
          </div>

          {/* Account info (read-only) */}
          <div style={{ background: darkMode ? "rgba(13,191,191,0.07)" : `${COLORS.teal}08`, border: `1px solid ${COLORS.teal}25`, borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
            <div style={{ color: textPrimary, fontWeight: 600, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <Icon name="user" size={14} color={COLORS.teal} /> Account Information
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "User ID", value: user.id },
                { label: "Role",    value: user.role.charAt(0).toUpperCase() + user.role.slice(1) },
                { label: "Email",   value: user.email },
                { label: "Team ID", value: user.teamId || "Not assigned" },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ color: textSecondary, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ color: textPrimary, fontSize: 13, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Editable fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your full name" style={inputStyle}
                onFocus={e => e.target.style.borderColor = COLORS.teal}
                onBlur={e => e.target.style.borderColor = inputBorder} />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+1 (555) 000-0000" style={inputStyle}
                onFocus={e => e.target.style.borderColor = COLORS.teal}
                onBlur={e => e.target.style.borderColor = inputBorder} />
            </div>
            <div>
              <label style={labelStyle}>Department</label>
              <input value={editDept} onChange={e => setEditDept(e.target.value)} placeholder="e.g. Engineering" style={inputStyle}
                onFocus={e => e.target.style.borderColor = COLORS.teal}
                onBlur={e => e.target.style.borderColor = inputBorder} />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="e.g. San Francisco, CA" style={inputStyle}
                onFocus={e => e.target.style.borderColor = COLORS.teal}
                onBlur={e => e.target.style.borderColor = inputBorder} />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Bio</label>
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={4}
              placeholder="Tell your team a little about yourself..."
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              onFocus={e => e.target.style.borderColor = COLORS.teal}
              onBlur={e => e.target.style.borderColor = inputBorder} />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: divider, marginBottom: 24 }} />

          {/* Preferences */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: textPrimary, fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <Icon name="zap" size={15} color={COLORS.teal} /> Preferences
            </div>
            {[
              { label: "Email notifications", desc: "Receive task updates via email", key: "notifEmail" },
              { label: "Desktop alerts",       desc: "Show browser notifications",   key: "notifDesktop" },
              { label: "Weekly digest",        desc: "Summary of team activity",     key: "weeklyDigest" },
            ].map(pref => (
              <div key={pref.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${divider}` }}>
                <div>
                  <div style={{ color: textPrimary, fontSize: 13, fontWeight: 600 }}>{pref.label}</div>
                  <div style={{ color: textSecondary, fontSize: 12 }}>{pref.desc}</div>
                </div>
                <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, flexShrink: 0 }}>
                  <input type="checkbox" defaultChecked style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: "absolute", inset: 0, borderRadius: 24, background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, cursor: "pointer", transition: "0.2s" }}>
                    <span style={{ position: "absolute", left: 3, top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "0.2s" }} />
                  </span>
                </label>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={saveProfile}
              style={{ flex: 1, padding: "13px", background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, border: "none", borderRadius: 12, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              <Icon name="check" size={17} color="#fff" /> Save Changes
            </button>
            <button onClick={() => { setEditName(user.name); setEditBio(user.bio||""); setEditPhone(user.phone||""); setEditDept(user.department||""); setEditLocation(user.location||""); setPhotoUrl(user.photoUrl||null); }}
              style={{ padding: "13px 22px", background: darkMode ? "rgba(255,255,255,0.06)" : COLORS.offWhite, border: `1px solid ${inputBorder}`, borderRadius: 12, cursor: "pointer", color: textSecondary, fontWeight: 600, fontSize: 14 }}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ onLogout }) {
  const [activeSection, setActiveSection] = useState("overview");
  const allManagers  = MOCK_USERS.managers;
  const allEmployees = MOCK_USERS.employees;
  const allTasks     = INITIAL_TASKS;
  const completedTasks = allTasks.filter(t => t.status === "completed").length;
  const ongoingTasks   = allTasks.filter(t => t.status === "ongoing").length;
  const pendingTasks   = allTasks.filter(t => t.status === "pending").length;
  const completionRate = allTasks.length ? Math.round((completedTasks / allTasks.length) * 100) : 0;

  const sections = [
    { id: "overview",   label: "Overview",   icon: "dashboard" },
    { id: "managers",   label: "Managers",   icon: "star" },
    { id: "employees",  label: "Employees",  icon: "team" },
    { id: "tasks",      label: "All Tasks",  icon: "tasks" },
  ];

  const statCards = [
    { label: "Total Managers",  value: allManagers.length,  color: COLORS.blue,    icon: "star" },
    { label: "Total Employees", value: allEmployees.length, color: COLORS.teal,    icon: "team" },
    { label: "Total Tasks",     value: allTasks.length,     color: COLORS.blue,    icon: "tasks" },
    { label: "Completed Tasks", value: completedTasks,      color: COLORS.success, icon: "check" },
    { label: "In Progress",     value: ongoingTasks,        color: COLORS.teal,    icon: "activity" },
    { label: "Pending Tasks",   value: pendingTasks,        color: COLORS.warning, icon: "clock" },
  ];

  const rowStyle = { display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" };
  const cellLabel = { color: "#7BAAD0", fontSize: 12, fontWeight: 600, marginBottom: 2 };
  const cellValue = { color: "#E8F0FF", fontSize: 13, fontWeight: 500 };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.navy, fontFamily: "'DM Sans', sans-serif", display: "flex" }}>
      {/* Admin sidebar */}
      <div style={{ width: 220, background: COLORS.navyLight, borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", position: "fixed", height: "100vh" }}>
        <div style={{ padding: "22px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="zap" size={17} color="#fff" />
            </div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>FlowSync</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: `${COLORS.teal}15`, borderRadius: 10, border: `1px solid ${COLORS.teal}30` }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>AD</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Admin</div>
              <div style={{ color: COLORS.teal, fontSize: 11 }}>Super Admin</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "14px 10px" }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 4, background: activeSection === s.id ? `linear-gradient(135deg, ${COLORS.teal}22, ${COLORS.blue}22)` : "transparent", color: activeSection === s.id ? COLORS.teal : COLORS.midGrey, fontWeight: activeSection === s.id ? 700 : 400, fontSize: 14, textAlign: "left", transition: "all 0.18s" }}>
              <Icon name={s.icon} size={17} color={activeSection === s.id ? COLORS.teal : COLORS.midGrey} />
              {s.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: COLORS.danger, fontSize: 14 }}>
            <Icon name="logout" size={17} color={COLORS.danger} /> Sign Out
          </button>
        </div>
      </div>

      {/* Admin content */}
      <div style={{ flex: 1, marginLeft: 220, padding: "32px 36px", maxWidth: 1000, boxSizing: "border-box" }}>

        {/* ── Overview ── */}
        {activeSection === "overview" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Admin Overview</h1>
            <p style={{ color: "#7BAAD0", fontSize: 14, marginBottom: 28 }}>Full visibility into all FlowSync data</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
              {statCards.map(s => (
                <div key={s.label} style={{ background: "#112240", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, background: `${s.color}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={s.icon} size={18} color={s.color} />
                    </div>
                    <span style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</span>
                  </div>
                  <div style={{ color: "#E8F0FF", fontWeight: 600, fontSize: 13 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Completion rate */}
            <div style={{ background: `linear-gradient(135deg, ${COLORS.navyMid}, ${COLORS.blue})`, borderRadius: 20, padding: "28px 32px", marginBottom: 24 }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 8 }}>Platform Completion Rate</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 14 }}>{completionRate}<span style={{ fontSize: 24 }}>%</span></div>
              <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.15)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${completionRate}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.cyan})`, borderRadius: 4 }} />
              </div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 8 }}>{completedTasks} of {allTasks.length} tasks completed across all teams</div>
            </div>
          </div>
        )}

        {/* ── Managers ── */}
        {activeSection === "managers" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>All Managers</h1>
            <p style={{ color: "#7BAAD0", fontSize: 14, marginBottom: 24 }}>{allManagers.length} manager{allManagers.length !== 1 ? "s" : ""} registered</p>
            <div style={{ background: "#112240", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 12, padding: "12px 20px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Manager", "Email", "Team ID", "Tasks", "Status"].map(h => (
                  <div key={h} style={{ color: COLORS.teal, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
                ))}
              </div>
              {allManagers.map((m, i) => {
                const mTasks = allTasks.filter(t => t.managerId === m.id);
                const mCompleted = mTasks.filter(t => t.status === "completed").length;
                const teamEmpCount = allEmployees.filter(e => e.teamId === m.teamId).length;
                return (
                  <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 12, padding: "16px 20px", borderBottom: i < allManagers.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar initials={m.avatar} size={36} />
                      <div>
                        <div style={{ color: "#E8F0FF", fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                        <div style={{ color: "#7BAAD0", fontSize: 11 }}>ID: {m.id}</div>
                      </div>
                    </div>
                    <div style={{ color: "#7BAAD0", fontSize: 13 }}>{m.email}</div>
                    <div style={{ color: "#E8F0FF", fontSize: 13 }}>{m.teamId || "—"}</div>
                    <div>
                      <div style={{ color: "#E8F0FF", fontSize: 13, fontWeight: 600 }}>{mCompleted}/{mTasks.length}</div>
                      <div style={{ color: "#7BAAD0", fontSize: 11 }}>{teamEmpCount} members</div>
                    </div>
                    <div><Badge label="Active" bg={`${COLORS.success}22`} color={COLORS.success} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Employees ── */}
        {activeSection === "employees" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>All Employees</h1>
            <p style={{ color: "#7BAAD0", fontSize: 14, marginBottom: 24 }}>{allEmployees.length} employee{allEmployees.length !== 1 ? "s" : ""} registered</p>
            <div style={{ background: "#112240", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 12, padding: "12px 20px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Employee", "Email", "Team", "Tasks Done", "Status"].map(h => (
                  <div key={h} style={{ color: COLORS.teal, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
                ))}
              </div>
              {allEmployees.map((e, i) => {
                const eTasks = allTasks.filter(t => t.assignedTo.includes(e.id));
                const eDone  = eTasks.filter(t => t.status === "completed").length;
                const manager = e.teamId ? allManagers.find(m => m.teamId === e.teamId) : null;
                return (
                  <div key={e.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 12, padding: "16px 20px", borderBottom: i < allEmployees.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar initials={e.avatar} size={36} />
                      <div>
                        <div style={{ color: "#E8F0FF", fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                        <div style={{ color: "#7BAAD0", fontSize: 11 }}>ID: {e.id}</div>
                      </div>
                    </div>
                    <div style={{ color: "#7BAAD0", fontSize: 13 }}>{e.email}</div>
                    <div>
                      <div style={{ color: "#E8F0FF", fontSize: 13 }}>{e.teamId || "No team"}</div>
                      {manager && <div style={{ color: "#7BAAD0", fontSize: 11 }}>Mgr: {manager.name.split(" ")[0]}</div>}
                    </div>
                    <div style={{ color: "#E8F0FF", fontSize: 13, fontWeight: 600 }}>{eDone}/{eTasks.length}</div>
                    <div><Badge label={e.teamId ? "In Team" : "Unassigned"} bg={e.teamId ? `${COLORS.success}22` : `${COLORS.warning}22`} color={e.teamId ? COLORS.success : COLORS.warning} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── All Tasks ── */}
        {activeSection === "tasks" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>All Tasks</h1>
            <p style={{ color: "#7BAAD0", fontSize: 14, marginBottom: 24 }}>{allTasks.length} tasks across all teams</p>
            <div style={{ background: "#112240", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "12px 20px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Task", "Priority", "Status", "Deadline", "Assigned"].map(h => (
                  <div key={h} style={{ color: COLORS.teal, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
                ))}
              </div>
              {allTasks.map((t, i) => {
                const assignees = t.assignedTo.map(id => allEmployees.find(e => e.id === id)).filter(Boolean);
                return (
                  <div key={t.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "14px 20px", borderBottom: i < allTasks.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#E8F0FF", fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      {t.category && <div style={{ color: "#7BAAD0", fontSize: 11 }}>{t.category}</div>}
                    </div>
                    <div><Badge label={t.priority} bg={`${getPriorityColor(t.priority)}30`} color={getPriorityColor(t.priority)} /></div>
                    <div><Badge label={getStatusLabel(t.status)} bg={`${getStatusColor(t.status)}22`} color={getStatusColor(t.status)} /></div>
                    <div style={{ color: "#7BAAD0", fontSize: 12 }}>{formatDate(t.deadline)}</div>
                    <div style={{ display: "flex", gap: -4 }}>
                      {assignees.slice(0, 3).map((a, idx) => <div key={a.id} style={{ marginLeft: idx > 0 ? -6 : 0 }}><Avatar initials={a.avatar} size={24} /></div>)}
                      {assignees.length === 0 && <span style={{ color: "#7BAAD0", fontSize: 12 }}>None</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings & Delete Account ────────────────────────────────────────────────
function SettingsPage({ user, setUser, onLogout, darkMode }) {
  const [section, setSection] = useState("main"); // main | yourinfo | deleteconfirm
  const [deletePass, setDeletePass] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const cardBg     = darkMode ? "#112240" : "#fff";
  const cardBorder = darkMode ? "rgba(255,255,255,0.10)" : COLORS.softGrey;
  const inputBg    = darkMode ? "#0A1628" : COLORS.offWhite;
  const inputBorder= darkMode ? "rgba(255,255,255,0.14)" : "#C8D8EC";
  const textPrimary   = darkMode ? "#E8F0FF" : COLORS.navy;
  const textSecondary = darkMode ? "#7BAAD0" : COLORS.darkGrey;
  const divider    = darkMode ? "rgba(255,255,255,0.07)" : COLORS.softGrey;

  const CONFIRM_PASSWORD = "Delete@" + (user.name.split(" ")[0] || "User") + "123";

  const handleDeleteConfirm = () => {
    setDeleteError("");
    if (!deletePass) { setDeleteError("Please enter your confirmation password."); return; }
    if (deletePass !== CONFIRM_PASSWORD) {
      setDeleteError("Incorrect password. Check the hint above.");
      return;
    }
    // Wipe all localStorage data for this user
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("fs_") || k === "fs_user" || k === "fs_tasks" || k === "fs_invitations" || k === "fs_notifications")) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    setDeleted(true);
    setTimeout(() => {
      try { signOut(auth); } catch(e) {}
      setUser(null);
    }, 2000);
  };

  if (deleted) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
      <h2 style={{ color: textPrimary, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Account Deleted</h2>
      <p style={{ color: textSecondary, fontSize: 14 }}>All your data has been removed. Redirecting...</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        {section !== "main" && (
          <button onClick={() => { setSection(section === "deleteconfirm" ? "yourinfo" : "main"); setDeleteError(""); setDeletePass(""); }}
            style={{ background: darkMode ? "rgba(255,255,255,0.06)" : COLORS.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <Icon name="chevronRight" size={16} color={textSecondary} style={{ transform: "rotate(180deg)" }} />
          </button>
        )}
        <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 800 }}>
          {section === "main" ? "Settings" : section === "yourinfo" ? "Your Info" : "Delete Account"}
        </h2>
      </div>

      {/* ── Main settings menu ── */}
      {section === "main" && (
        <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, overflow: "hidden" }}>
          {[
            { id: "yourinfo", icon: "user", label: "Your Info", desc: "Manage your account data", color: COLORS.blue },
            { id: "notifications_pref", icon: "bell", label: "Notifications", desc: "Email and push preferences", color: COLORS.teal },
            { id: "privacy", icon: "shield", label: "Privacy & Security", desc: "Control your privacy settings", color: COLORS.success },
          ].map((item, idx) => (
            <button key={item.id} onClick={() => item.id === "yourinfo" && setSection("yourinfo")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "transparent", border: "none", borderBottom: `1px solid ${divider}`, cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.04)" : "#f8faff"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={item.icon} size={18} color={item.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: textPrimary, fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                <div style={{ color: textSecondary, fontSize: 12 }}>{item.desc}</div>
              </div>
              <Icon name="chevronRight" size={16} color={textSecondary} />
            </button>
          ))}
          {/* Sign out */}
          <button onClick={onLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => e.currentTarget.style.background = `${COLORS.danger}08`}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${COLORS.danger}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="logout" size={18} color={COLORS.danger} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.danger, fontWeight: 600, fontSize: 14 }}>Sign Out</div>
              <div style={{ color: textSecondary, fontSize: 12 }}>Log out of your account</div>
            </div>
          </button>
        </div>
      )}

      {/* ── Your Info ── */}
      {section === "yourinfo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Info card */}
          <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${divider}` }}>
              {user.photoUrl
                ? <img src={user.photoUrl} alt="avatar" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${COLORS.teal}` }} />
                : <Avatar initials={user.avatar} size={56} />}
              <div>
                <div style={{ color: textPrimary, fontWeight: 800, fontSize: 17 }}>{user.name}</div>
                <div style={{ color: COLORS.teal, fontSize: 13, textTransform: "capitalize" }}>{user.role}</div>
                <div style={{ color: textSecondary, fontSize: 12 }}>{user.email}</div>
              </div>
            </div>
            {[
              { label: "User ID", value: user.id },
              { label: "Email", value: user.email },
              { label: "Role", value: user.role },
              { label: "Team", value: user.teamId || "Not assigned" },
              { label: "Department", value: user.department || "—" },
              { label: "Location", value: user.location || "—" },
              { label: "Phone", value: user.phone || "—" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${divider}` }}>
                <span style={{ color: textSecondary, fontSize: 13 }}>{item.label}</span>
                <span style={{ color: textPrimary, fontSize: 13, fontWeight: 500, maxWidth: "60%", textAlign: "right", wordBreak: "break-all" }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Stored data summary */}
          <div style={{ background: `${COLORS.teal}08`, borderRadius: 14, border: `1px solid ${COLORS.teal}25`, padding: "16px 20px" }}>
            <div style={{ color: textPrimary, fontWeight: 600, fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="activity" size={15} color={COLORS.teal} /> Data stored on this device
            </div>
            <div style={{ color: textSecondary, fontSize: 13, lineHeight: 1.7 }}>
              Your tasks, team info, and preferences are saved locally in your browser so they persist after logout.
            </div>
          </div>

          {/* Delete Account button */}
          <button onClick={() => setSection("deleteconfirm")}
            style={{ width: "100%", padding: "14px", background: `${COLORS.danger}10`, border: `1px solid ${COLORS.danger}40`, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = `${COLORS.danger}18`}
            onMouseLeave={e => e.currentTarget.style.background = `${COLORS.danger}10`}>
            <Icon name="trash" size={18} color={COLORS.danger} />
            <span style={{ color: COLORS.danger, fontWeight: 700, fontSize: 15 }}>Delete My Account</span>
          </button>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {section === "deleteconfirm" && (
        <div>
          <div style={{ background: `${COLORS.danger}10`, border: `1px solid ${COLORS.danger}40`, borderRadius: 16, padding: "20px", marginBottom: 20, display: "flex", gap: 14 }}>
            <Icon name="alertTriangle" size={24} color={COLORS.danger} />
            <div>
              <div style={{ color: COLORS.danger, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>This action cannot be undone</div>
              <div style={{ color: textSecondary, fontSize: 13, lineHeight: 1.6 }}>
                Deleting your account will permanently remove all your tasks, team memberships, notifications, and preferences from this device.
              </div>
            </div>
          </div>

          <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: "24px" }}>
            <div style={{ color: textPrimary, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Confirm your identity</div>
            <div style={{ background: `${COLORS.blue}10`, border: `1px solid ${COLORS.blue}25`, borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ color: textSecondary, fontSize: 12, marginBottom: 4 }}>Your confirmation password is:</div>
              <div style={{ color: COLORS.teal, fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>Delete@{user.name.split(" ")[0] || "User"}123</div>
            </div>

            <label style={{ color: textSecondary, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>Enter confirmation password</label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                type={showPass ? "text" : "password"}
                value={deletePass}
                onChange={e => { setDeletePass(e.target.value); setDeleteError(""); }}
                placeholder="Enter password to confirm"
                style={{ width: "100%", padding: "12px 44px 12px 14px", background: inputBg, border: `1px solid ${deleteError ? COLORS.danger : inputBorder}`, borderRadius: 10, color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                onKeyDown={e => e.key === "Enter" && handleDeleteConfirm()}
              />
              <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: textSecondary }}>
                <Icon name={showPass ? "eyeOff" : "eye"} size={16} color={textSecondary} />
              </button>
            </div>

            {deleteError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: `${COLORS.danger}12`, border: `1px solid ${COLORS.danger}30`, borderRadius: 8, marginBottom: 16 }}>
                <Icon name="x" size={14} color={COLORS.danger} />
                <span style={{ color: COLORS.danger, fontSize: 13 }}>{deleteError}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleDeleteConfirm}
                style={{ flex: 1, padding: "13px", background: COLORS.danger, border: "none", borderRadius: 12, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>
                Yes, Delete Everything
              </button>
              <button onClick={() => { setSection("yourinfo"); setDeletePass(""); setDeleteError(""); }}
                style={{ padding: "13px 20px", background: darkMode ? "rgba(255,255,255,0.06)" : COLORS.offWhite, border: `1px solid ${inputBorder}`, borderRadius: 12, cursor: "pointer", color: textSecondary, fontWeight: 600, fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Restore session from localStorage ──
  const loadState = (key, fallback) => {
    try {
      const v = localStorage.getItem("fs_" + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  };

  const [user, setUserRaw]          = useState(() => loadState("user", null));
  const [darkMode, setDarkMode]     = useState(() => loadState("darkMode", false));
  const [activeTab, setActiveTabRaw]= useState("dashboard");
  const [tabHistory, setTabHistory] = useState(["dashboard"]);
  const [tasks, setTasksRaw]        = useState(() => loadState("tasks", INITIAL_TASKS));
  const [invitations, setInvRaw]    = useState(() => loadState("invitations", INITIAL_INVITATIONS));
  const [notifications, setNotifsRaw] = useState(() => loadState("notifications", INITIAL_NOTIFICATIONS));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);

  // ── Wrapped setters that also persist to localStorage ──
  const setUser = (u) => {
    setUserRaw(u);
    try { if (u) localStorage.setItem("fs_user", JSON.stringify(u)); else localStorage.removeItem("fs_user"); } catch {}
  };
  const setTasks = (fn) => setTasksRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    try { localStorage.setItem("fs_tasks", JSON.stringify(next)); } catch {}
    return next;
  });
  const setInvitations = (fn) => setInvRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    try { localStorage.setItem("fs_invitations", JSON.stringify(next)); } catch {}
    return next;
  });
  const setNotifications = (fn) => setNotifsRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    try { localStorage.setItem("fs_notifications", JSON.stringify(next)); } catch {}
    return next;
  });
  const toggleDark = (v) => {
    setDarkMode(v);
    try { localStorage.setItem("fs_darkMode", JSON.stringify(v)); } catch {}
  };

  // ── Tab navigation with history ──
  const setActiveTab = (tab) => {
    setActiveTabRaw(tab);
    setTabHistory(prev => {
      const next = prev[prev.length - 1] === tab ? prev : [...prev, tab];
      return next.slice(-10); // keep last 10
    });
    // Push a history state so browser back button fires popstate
    window.history.pushState({ tab }, "", window.location.pathname);
  };

  // ── Browser/phone back button → go to previous tab, not browser back ──
  useEffect(() => {
    const handlePop = (e) => {
      setTabHistory(prev => {
        if (prev.length <= 1) {
          // Already at root — push state again so they can't go further back
          window.history.pushState({ tab: "dashboard" }, "", window.location.pathname);
          setActiveTabRaw("dashboard");
          return ["dashboard"];
        }
        const newHistory = prev.slice(0, -1);
        const prevTab = newHistory[newHistory.length - 1];
        setActiveTabRaw(prevTab);
        window.history.pushState({ tab: prevTab }, "", window.location.pathname);
        return newHistory;
      });
    };
    window.addEventListener("popstate", handlePop);
    // Push initial state
    window.history.pushState({ tab: "dashboard" }, "", window.location.pathname);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load Google font
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const bg = darkMode ? COLORS.navy : COLORS.offWhite;
  const textPrimary = darkMode ? "#fff" : COLORS.navy;

  const handleLogout = () => {
    try { signOut(auth); } catch(e) {}
    localStorage.removeItem("fs_user");
    setUserRaw(null);
  };

  if (!user) return <AuthScreen onLogin={u => { setUser(u); setActiveTabRaw("dashboard"); setTabHistory(["dashboard"]); }} />;
  if (user.role === "admin") return <AdminDashboard onLogout={() => { try { signOut(auth); } catch(e){} localStorage.removeItem("fs_user"); setUserRaw(null); }} />;

  const renderContent = () => {
    if (user.role === "manager") {
      switch (activeTab) {
        case "dashboard": return <ManagerDashboard user={user} tasks={tasks} users={MOCK_USERS} darkMode={darkMode} />;
        case "tasks": return <TaskListView user={user} tasks={tasks} setTasks={setTasks} darkMode={darkMode} />;
        case "kanban": return <KanbanBoard user={user} tasks={tasks} setTasks={setTasks} darkMode={darkMode} />;
        case "team": return <TeamManagement user={user} invitations={invitations} setInvitations={setInvitations} notifications={notifications} setNotifications={setNotifications} darkMode={darkMode} />;
        case "analytics": return <Analytics user={user} tasks={tasks} darkMode={darkMode} />;
        case "notifications": return <NotificationsPanel user={user} notifications={notifications} setNotifications={setNotifications} darkMode={darkMode} />;
        case "profile": return <ProfileSection user={user} setUser={setUser} tasks={tasks} darkMode={darkMode} />;
        case "settings": return <SettingsPage user={user} setUser={setUser} onLogout={handleLogout} darkMode={darkMode} />;
        default: return null;
      }
    } else {
      switch (activeTab) {
        case "dashboard": return (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ color: textPrimary, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>My Workspace</h1>
              <p style={{ color: darkMode ? COLORS.midGrey : COLORS.darkGrey, fontSize: 14 }}>Welcome back, {user.name.split(" ")[0]}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { label: "My Tasks", value: tasks.filter(t => t.assignedTo.includes(user.id)).length, icon: "tasks", color: COLORS.blue },
                { label: "Completed", value: tasks.filter(t => t.assignedTo.includes(user.id) && t.status === "completed").length, icon: "check", color: COLORS.success },
                { label: "In Progress", value: tasks.filter(t => t.assignedTo.includes(user.id) && t.status === "ongoing").length, icon: "activity", color: COLORS.teal },
                { label: "Invites", value: invitations.filter(i => i.employeeId === user.id && i.status === "pending").length, icon: "mail", color: COLORS.warning },
              ].map(s => (
                <div key={s.label} style={{ background: darkMode ? COLORS.navyLight : "#fff", borderRadius: 16, padding: "20px", border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                  <div style={{ width: 38, height: 38, background: `${s.color}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Icon name={s.icon} size={18} color={s.color} />
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ color: textPrimary, fontWeight: 600, fontSize: 13 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <TaskListView user={user} tasks={tasks} setTasks={setTasks} darkMode={darkMode} />
          </div>
        );
        case "mytasks": return <TaskListView user={user} tasks={tasks} setTasks={setTasks} darkMode={darkMode} />;
        case "inbox": return <EmployeeInbox user={user} invitations={invitations} setInvitations={setInvitations} notifications={notifications} setNotifications={setNotifications} darkMode={darkMode} />;
        case "activity": return <ActivityLog user={user} tasks={tasks} darkMode={darkMode} />;
        case "notifications": return <NotificationsPanel user={user} notifications={notifications} setNotifications={setNotifications} darkMode={darkMode} />;
        case "profile": return <ProfileSection user={user} setUser={setUser} tasks={tasks} darkMode={darkMode} />;
        case "settings": return <SettingsPage user={user} setUser={setUser} onLogout={handleLogout} darkMode={darkMode} />;
        default: return null;
      }
    }
  };

  const desktopSidebarWidth = sidebarCollapsed ? 64 : 240;
  const showBackBtn = tabHistory.length > 1 && activeTab !== "dashboard";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: bg, fontFamily: "'DM Sans', sans-serif", transition: "background 0.3s" }}>
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        setDarkMode={toggleDark}
        onLogout={handleLogout}
        notifications={notifications}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        isMobile={isMobile}
      />

      <main style={{ flex: 1, marginLeft: isMobile ? 0 : desktopSidebarWidth, minHeight: "100vh", display: "flex", flexDirection: "column", transition: "margin-left 0.25s ease" }}>
        {/* Top bar — always visible, with back button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 16px" : "14px 32px", background: darkMode ? COLORS.navyLight : "#fff", borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}`, position: "sticky", top: 0, zIndex: 50, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Back button */}
            {showBackBtn ? (
              <button onClick={() => {
                setTabHistory(prev => {
                  const newH = prev.slice(0, -1);
                  const prevTab = newH[newH.length - 1] || "dashboard";
                  setActiveTabRaw(prevTab);
                  return newH;
                });
              }}
                style={{ background: darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "background 0.18s" }}
                onMouseEnter={e => e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.14)" : COLORS.softGrey}
                onMouseLeave={e => e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey}
                title="Go back">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            ) : (
              <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.blue})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="zap" size={16} color="#fff" />
              </div>
            )}
            <span style={{ color: textPrimary, fontWeight: 800, fontSize: isMobile ? 16 : 17 }}>
              {showBackBtn
                ? { tasks:"Tasks", kanban:"Kanban Board", team:"My Team", analytics:"Analytics", notifications:"Notifications", profile:"Profile", settings:"Settings", mytasks:"My Tasks", inbox:"Inbox", activity:"Activity" }[activeTab] || "FlowSync"
                : "FlowSync"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Dark mode toggle in topbar */}
            <button onClick={() => toggleDark(!darkMode)} style={{ background: darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Icon name={darkMode ? "sun" : "moon"} size={16} color={textPrimary} />
            </button>
            {/* Mobile hamburger */}
            {isMobile && (
              <button onClick={() => setMobileMenuOpen(o => !o)} style={{ background: darkMode ? "rgba(255,255,255,0.08)" : COLORS.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Icon name={mobileMenuOpen ? "x" : "menu"} size={18} color={textPrimary} />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, padding: isMobile ? "20px 16px" : "28px 36px", maxWidth: 1100, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
