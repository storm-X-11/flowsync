import { useState, useEffect, useRef } from "react";
import { auth, googleProvider, db, storage } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, addDoc, serverTimestamp, arrayUnion
} from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

const ADMIN_EMAIL = "admin@flowsync.app";
const ADMIN_PASSWORD = "Admin@1234";
const EJS_SVC = "service_z87qj7l";
const EJS_TPL = "template_w4zm91k";
const EJS_KEY = "RYJYBmmM_2u7WyK2m";

async function sendEmail({ toEmail, toName, fromName, subject, message }) {
  try {
    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: EJS_SVC, template_id: EJS_TPL, user_id: EJS_KEY,
        template_params: { to_email: toEmail, to_name: toName, from_name: fromName,
          subject, message, app_url: "https://flowsync-mu.vercel.app" } }),
    });
    return r.ok;
  } catch { return false; }
}

const DEF_PREFS = {
  inviteReceived: true, inviteAccepted: true, taskAssigned: true,
  taskStatusChange: true, emailInvite: true, emailTaskUpdate: false, deadlineReminder: true,
};
const loadPrefs = () => { try { const v = localStorage.getItem("fs_np"); return v ? { ...DEF_PREFS, ...JSON.parse(v) } : DEF_PREFS; } catch { return DEF_PREFS; } };
const savePrefs = (p) => { try { localStorage.setItem("fs_np", JSON.stringify(p)); } catch {} };

const C = {
  navy: "#0A1628", navyL: "#112240", navyM: "#1A3A6B",
  blue: "#1E5FAD", teal: "#0DBFBF", cyan: "#00D4FF",
  offWhite: "#F0F4F8", softGrey: "#E2EAF4", midGrey: "#8B9BB4",
  darkGrey: "#4A5568", success: "#10B981", warning: "#F59E0B",
  danger: "#EF4444", purple: "#7C3AED",
};

const pcol = (p) => p === "high" ? C.danger : p === "medium" ? C.warning : C.success;
const scol = (s) => s === "completed" ? C.success : s === "ongoing" ? C.teal : C.midGrey;
const slbl = (s) => s === "completed" ? "Completed" : s === "ongoing" ? "In Progress" : "Pending";
const ini  = (n) => (n || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const fdate = (d) => { if (!d) return "—"; const dt = d?.toDate ? d.toDate() : new Date(d); return isNaN(dt) ? "—" : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const isOver = (d) => { if (!d) return false; const dt = d?.toDate ? d.toDate() : new Date(d); return dt < new Date(); };
const ago = (ts) => { if (!ts) return ""; const d = ts?.toDate ? ts.toDate() : new Date(ts); const s = Math.floor((Date.now() - d) / 1000); if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };

const TC = () => collection(db, "tasks");
const IC = () => collection(db, "invitations");
const NC = () => collection(db, "notifications");

function Av({ photoUrl, name, size = 36 }) {
  if (photoUrl) return <img src={photoUrl} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${C.teal}55` }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{ini(name)}</div>;
}
function Badge({ label, color, bg }) {
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: color || "#fff", background: bg || C.blue, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>;
}
function PBar({ value, max, color = C.teal }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100)) || 0;
  return <div style={{ width: "100%", height: 6, background: C.softGrey, borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${C.cyan})`, borderRadius: 3, transition: "width 0.6s ease" }} /></div>;
}
function Toggle({ on, onChange }) {
  return <button onClick={() => onChange(!on)} style={{ position: "relative", width: 46, height: 26, borderRadius: 13, background: on ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : "rgba(128,128,128,0.25)", border: "none", cursor: "pointer", flexShrink: 0, transition: "background 0.22s", padding: 0 }}><div style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", transition: "left 0.22s" }} /></button>;
}

const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const paths = {
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
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></>,
    logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    kanban: <><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/></>,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    comment: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6"/></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    paperclip: <><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></>,
    chat: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>,
    at: <><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/></>,
    export: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    extend: <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

function Loader({ msg = "Loading..." }) {
  return (
    <div style={{ minHeight: "100vh", background: C.navy, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}`}</style>
      <img src="/logo.png" alt="FlowSync" style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 24, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ width: 32, height: 32, border: `3px solid ${C.teal}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 16 }} />
      <p style={{ color: C.midGrey, fontSize: 14 }}>{msg}</p>
    </div>
  );
}

function AuthScreen({ onLogin }) {
  const [step, setStep] = useState("login");
  const [fbUser, setFbUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [adEmail, setAdEmail] = useState("");
  const [adPass, setAdPass] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleGoogle = async () => {
    setErr(""); setLoading(true);
    try {
      const r = await signInWithPopup(auth, googleProvider);
      setFbUser(r.user); setStep("role");
    } catch (e) {
      if (e.code === "auth/popup-blocked") setErr("Popup blocked — allow popups for this site.");
      else if (e.code === "auth/unauthorized-domain") setErr("Add flowsync-mu.vercel.app to Firebase authorized domains.");
      else setErr("Login failed: " + (e.message || "Unknown error"));
    }
    setLoading(false);
  };

  const handleRole = async (role) => {
    setLoading(true);
    const u = fbUser;
    // Base data from Google account
    const baseData = {
      id: u.uid,
      name: u.displayName || u.email.split("@")[0],
      email: u.email,
      avatar: ini(u.displayName || u.email),
      role,
      photoUrl: u.photoURL || null,
      teamId: null,
    };
    try {
      // Always check Firestore first — returning users have existing data
      const ex = await getDoc(doc(db, "users", u.uid));
      if (ex.exists()) {
        // RETURNING USER: restore ALL their data (teamId, profile, role etc.)
        const existing = ex.data();
        const full = {
          ...baseData,
          ...existing,   // existing data wins — keeps teamId, bio, phone, dept etc.
          id: u.uid,
          // Only update photo if Google has one and Firestore doesn't
          photoUrl: existing.photoUrl || u.photoURL || null,
        };
        localStorage.setItem("fs_user_cache", JSON.stringify(full));
        onLogin(full);
        // Update role and name silently in background if changed
        await updateDoc(doc(db, "users", u.uid), {
          name: u.displayName || existing.name,
          role: existing.role || role,
          lastLogin: serverTimestamp(),
        }).catch(() => {});
      } else {
        // NEW USER: create their profile in Firestore
        await setDoc(doc(db, "users", u.uid), { ...baseData, createdAt: serverTimestamp(), lastLogin: serverTimestamp() });
        localStorage.setItem("fs_user_cache", JSON.stringify(baseData));
        onLogin(baseData);
      }
    } catch (err) {
      // Firestore unreachable — use cached data or base data
      const cached = localStorage.getItem("fs_user_cache");
      if (cached) {
        try {
          const cachedUser = JSON.parse(cached);
          if (cachedUser.id === u.uid) { onLogin(cachedUser); setLoading(false); return; }
        } catch {}
      }
      localStorage.setItem("fs_user_cache", JSON.stringify(baseData));
      onLogin(baseData);
    }
    setLoading(false);
  };

  const handleAdmin = () => {
    setErr("");
    if (adEmail.trim().toLowerCase() === ADMIN_EMAIL && adPass === ADMIN_PASSWORD) {
      const u = { id: "admin", name: "Admin", email: ADMIN_EMAIL, avatar: "AD", role: "admin", teamId: null };
      localStorage.setItem("fs_admin", "1"); onLogin(u);
    } else setErr("Wrong email or password.");
  };

  const inp = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyL} 50%, ${C.navyM} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "relative" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${C.teal}18 0%, transparent 70%)`, top: -100, right: -100, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue}20 0%, transparent 70%)`, bottom: -80, left: -80, pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 460, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <img src="/logo.png" alt="FlowSync" style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 16, objectFit: "cover" }} />
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 28, letterSpacing: "-0.5px" }}>FlowSync</div>
          <p style={{ color: C.midGrey, fontSize: 14, marginTop: 4 }}>Workflow Management Platform</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", padding: 36 }}>
          {step === "login" && !showAdmin && (
            <div>
              <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>Welcome back</h2>
              <p style={{ color: C.midGrey, textAlign: "center", marginBottom: 28, fontSize: 14 }}>Sign in with your Google account</p>
              <button onClick={handleGoogle} disabled={loading} style={{ width: "100%", padding: "14px 20px", background: loading ? "#f5f5f5" : "#fff", border: "none", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, cursor: loading ? "wait" : "pointer", fontWeight: 600, fontSize: 15, color: C.navy, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", marginBottom: 14, opacity: loading ? 0.8 : 1 }}>
                {loading ? <div style={{ width: 20, height: 20, border: "2px solid #ccc", borderTopColor: C.blue, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
                {loading ? "Opening Google..." : "Continue with Google"}
              </button>
              {err && <div style={{ padding: "10px 14px", background: `${C.danger}15`, border: `1px solid ${C.danger}40`, borderRadius: 10, marginBottom: 14 }}><p style={{ color: C.danger, fontSize: 13, margin: 0 }}>{err}</p></div>}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} /><span style={{ color: C.midGrey, fontSize: 12 }}>or</span><div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} /></div>
              <button onClick={() => setShowAdmin(true)} style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, cursor: "pointer", color: C.midGrey, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon name="shield" size={16} color={C.teal} /> Admin Login
              </button>
            </div>
          )}
          {step === "login" && showAdmin && (
            <div>
              <button onClick={() => { setShowAdmin(false); setErr(""); }} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: 13, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>← Back</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <div style={{ width: 42, height: 42, background: `${C.teal}30`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="shield" size={20} color={C.teal} /></div>
                <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Admin Login</div><div style={{ color: C.midGrey, fontSize: 12 }}>Full platform access</div></div>
              </div>
              <label style={{ color: C.midGrey, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Admin Email</label>
              <input type="email" value={adEmail} onChange={e => setAdEmail(e.target.value)} placeholder="admin@flowsync.app" style={{ ...inp, marginBottom: 14 }} onKeyDown={e => e.key === "Enter" && handleAdmin()} />
              <label style={{ color: C.midGrey, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative", marginBottom: 14 }}>
                <input type={showPw ? "text" : "password"} value={adPass} onChange={e => setAdPass(e.target.value)} placeholder="Enter password" style={{ ...inp, paddingRight: 44 }} onKeyDown={e => e.key === "Enter" && handleAdmin()} />
                <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.midGrey, fontSize: 13 }}>{showPw ? "Hide" : "Show"}</button>
              </div>
              {err && <div style={{ padding: "10px 14px", background: `${C.danger}15`, border: `1px solid ${C.danger}40`, borderRadius: 10, marginBottom: 14 }}><p style={{ color: C.danger, fontSize: 13, margin: 0 }}>{err}</p></div>}
              <button onClick={handleAdmin} style={{ width: "100%", padding: "13px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 12, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 15 }}>Sign In as Admin</button>
            </div>
          )}
          {step === "role" && (
            <div>
              {fbUser && <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, padding: "12px 14px", background: "rgba(255,255,255,0.06)", borderRadius: 12 }}>
                {fbUser.photoURL ? <img src={fbUser.photoURL} style={{ width: 44, height: 44, borderRadius: "50%" }} /> : <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{ini(fbUser.displayName)}</div>}
                <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{fbUser.displayName}</div><div style={{ color: C.midGrey, fontSize: 13 }}>{fbUser.email}</div></div>
              </div>}
              <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>How will you use FlowSync?</h2>
              <p style={{ color: C.midGrey, textAlign: "center", marginBottom: 22, fontSize: 14 }}>Choose your role</p>
              {loading ? <div style={{ textAlign: "center", padding: 24 }}><div style={{ width: 32, height: 32, border: `3px solid ${C.teal}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} /></div> :
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  {[{ role: "manager", icon: "star", label: "Manager", desc: "Lead teams & assign tasks" }, { role: "employee", icon: "user", label: "Employee", desc: "View & complete tasks" }].map(r => (
                    <button key={r.role} onClick={() => handleRole(r.role)} style={{ padding: "22px 14px", background: "rgba(255,255,255,0.05)", border: `2px solid ${C.teal}40`, borderRadius: 16, cursor: "pointer", color: "#fff", textAlign: "center", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${C.teal}15`; e.currentTarget.style.borderColor = C.teal; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = `${C.teal}40`; }}>
                      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}><Icon name={r.icon} size={26} color={C.teal} /></div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{r.label}</div>
                      <div style={{ color: C.midGrey, fontSize: 12 }}>{r.desc}</div>
                    </button>
                  ))}
                </div>}
              <button onClick={() => { signOut(auth); setStep("login"); setFbUser(null); }} style={{ width: "100%", padding: "10px", background: "transparent", border: "none", color: C.midGrey, fontSize: 13, cursor: "pointer" }}>← Use a different account</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDash({ onLogout }) {
  const [sec, setSec] = useState("overview");
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    const u1 = onSnapshot(collection(db, "users"), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "tasks"), s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "teams"), s => setTeams(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); };
  }, []);
  const mgrs = users.filter(u => u.role === "manager");
  const emps = users.filter(u => u.role === "employee");
  const done = tasks.filter(t => t.status === "completed").length;
  const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const navs = [{ id: "overview", icon: "dashboard", label: "Overview" }, { id: "managers", icon: "star", label: "Managers" }, { id: "employees", icon: "team", label: "Employees" }, { id: "tasks", icon: "tasks", label: "All Tasks" }, { id: "teams", icon: "team", label: "Teams" }];
  return (
    <div style={{ minHeight: "100vh", background: C.navy, fontFamily: "'DM Sans', sans-serif", display: "flex" }}>
      <div style={{ width: 220, background: C.navyL, borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", position: "fixed", height: "100vh" }}>
        <div style={{ padding: "22px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <img src="/logo.png" alt="FS" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>FlowSync</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: `${C.teal}15`, borderRadius: 10, border: `1px solid ${C.teal}30` }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>AD</div>
            <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Admin</div><div style={{ color: C.teal, fontSize: 11 }}>Super Admin</div></div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "14px 10px" }}>
          {navs.map(n => <button key={n.id} onClick={() => setSec(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 4, background: sec === n.id ? `linear-gradient(135deg, ${C.teal}22, ${C.blue}22)` : "transparent", color: sec === n.id ? C.teal : C.midGrey, fontWeight: sec === n.id ? 700 : 400, fontSize: 14, textAlign: "left" }}><Icon name={n.icon} size={17} color={sec === n.id ? C.teal : C.midGrey} />{n.label}</button>)}
        </nav>
        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: C.danger, fontSize: 14 }}><Icon name="logout" size={17} color={C.danger} /> Sign Out</button>
        </div>
      </div>
      <div style={{ flex: 1, marginLeft: 220, padding: "32px 36px", maxWidth: 1100, boxSizing: "border-box" }}>
        {sec === "overview" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Admin Overview</h1>
            <p style={{ color: "#7BAAD0", fontSize: 14, marginBottom: 28 }}>Real-time Firestore data</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
              {[{ label: "Total Users", value: users.length, color: C.blue, icon: "team" }, { label: "Managers", value: mgrs.length, color: C.teal, icon: "star" }, { label: "Employees", value: emps.length, color: C.purple, icon: "user" }, { label: "Total Tasks", value: tasks.length, color: C.blue, icon: "tasks" }, { label: "Completed", value: done, color: C.success, icon: "check" }, { label: "Completion Rate", value: rate + "%", color: rate > 70 ? C.success : C.warning, icon: "analytics" }].map(s => (
                <div key={s.label} style={{ background: "#112240", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, background: `${s.color}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={s.icon} size={18} color={s.color} /></div>
                    <span style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</span>
                  </div>
                  <div style={{ color: "#E8F0FF", fontWeight: 600, fontSize: 13 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#112240", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ color: "#E8F0FF", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Overall Completion</div>
              <PBar value={done} max={Math.max(tasks.length, 1)} color={C.teal} />
              <div style={{ color: "#7BAAD0", fontSize: 12, marginTop: 8 }}>{done} of {tasks.length} tasks completed</div>
            </div>
          </div>
        )}
        {sec === "managers" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Managers ({mgrs.length})</h1>
            <div style={{ background: "#112240", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              {mgrs.length === 0 ? <p style={{ color: "#7BAAD0", padding: 24 }}>No managers yet.</p> : mgrs.map((m, i) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: i < mgrs.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                  <Av photoUrl={m.photoUrl} name={m.name} size={44} />
                  <div style={{ flex: 1 }}><div style={{ color: "#E8F0FF", fontWeight: 700, fontSize: 14 }}>{m.name}</div><div style={{ color: "#7BAAD0", fontSize: 12 }}>{m.email}</div><div style={{ color: "#7BAAD0", fontSize: 11 }}>Team: {m.teamId || "None"}</div></div>
                  <Badge label="Manager" bg={`${C.teal}22`} color={C.teal} />
                  <button onClick={() => deleteDoc(doc(db, "users", m.id))} style={{ padding: "6px 10px", background: `${C.danger}15`, border: "none", borderRadius: 8, cursor: "pointer", color: C.danger, fontSize: 12 }}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {sec === "employees" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Employees ({emps.length})</h1>
            <div style={{ background: "#112240", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              {emps.length === 0 ? <p style={{ color: "#7BAAD0", padding: 24 }}>No employees yet.</p> : emps.map((e, i) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: i < emps.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                  <Av photoUrl={e.photoUrl} name={e.name} size={44} />
                  <div style={{ flex: 1 }}><div style={{ color: "#E8F0FF", fontWeight: 700, fontSize: 14 }}>{e.name}</div><div style={{ color: "#7BAAD0", fontSize: 12 }}>{e.email}</div><div style={{ color: "#7BAAD0", fontSize: 11 }}>Team: {e.teamId || "Not assigned"}</div></div>
                  <Badge label={e.teamId ? "In Team" : "Unassigned"} bg={e.teamId ? `${C.success}22` : `${C.midGrey}22`} color={e.teamId ? C.success : C.midGrey} />
                  <button onClick={() => deleteDoc(doc(db, "users", e.id))} style={{ padding: "6px 10px", background: `${C.danger}15`, border: "none", borderRadius: 8, cursor: "pointer", color: C.danger, fontSize: 12 }}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {sec === "tasks" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 22, fontWeight: 800, marginBottom: 20 }}>All Tasks ({tasks.length})</h1>
            <div style={{ background: "#112240", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              {tasks.map((t, i) => (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, padding: "14px 20px", borderBottom: i < tasks.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", alignItems: "center" }}>
                  <div><div style={{ color: "#E8F0FF", fontWeight: 600, fontSize: 13 }}>{t.title}</div>{t.category && <div style={{ color: "#7BAAD0", fontSize: 11 }}>{t.category}</div>}</div>
                  <Badge label={t.priority} bg={`${pcol(t.priority)}30`} color={pcol(t.priority)} />
                  <Badge label={slbl(t.status)} bg={`${scol(t.status)}22`} color={scol(t.status)} />
                  <div style={{ color: "#7BAAD0", fontSize: 12 }}>{fdate(t.deadline)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {sec === "teams" && (
          <div>
            <h1 style={{ color: "#E8F0FF", fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Teams ({teams.length})</h1>
            {teams.length === 0 ? <p style={{ color: "#7BAAD0" }}>No teams yet.</p> : teams.map(t => (
              <div key={t.id} style={{ background: "#112240", borderRadius: 14, padding: "20px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ color: "#E8F0FF", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.name || t.id}</div>
                <div style={{ color: "#7BAAD0", fontSize: 13 }}>Manager: {t.managerName || "—"} · Members: {(t.members || []).length}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Sidebar({ user, activeTab, setActiveTab, darkMode, setDarkMode, onLogout, unread, mobileOpen, setMobileOpen, collapsed, setCollapsed, isMobile }) {
  const bg = darkMode ? C.navy : C.navyL;
  const sw = collapsed && !isMobile ? 64 : 240;
  const tr = isMobile ? (mobileOpen ? "translateX(0)" : "translateX(-100%)") : "none";
  const mgNav = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "tasks", icon: "tasks", label: "Tasks" },
    { id: "kanban", icon: "kanban", label: "Progress" },
    { id: "team", icon: "team", label: "My Team" },
    { id: "chat", icon: "chat", label: "Team Chat" },
    { id: "analytics", icon: "analytics", label: "Analytics" },
    { id: "notifications", icon: "bell", label: "Notifications", badge: unread },
    { id: "profile", icon: "user", label: "Profile" },
    { id: "settings", icon: "settings", label: "Settings" },
  ];
  const emNav = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "mytasks", icon: "tasks", label: "My Tasks" },
    { id: "chat", icon: "chat", label: "Team Chat" },
    { id: "inbox", icon: "inbox", label: "Inbox", badge: unread },
    { id: "activity", icon: "activity", label: "Activity" },
    { id: "notifications", icon: "bell", label: "Notifications", badge: unread },
    { id: "profile", icon: "user", label: "Profile" },
    { id: "settings", icon: "settings", label: "Settings" },
  ];
  const nav = user.role === "manager" ? mgNav : emNav;
  return (
    <>
      {isMobile && mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 99 }} />}
      <aside style={{ width: sw, background: bg, display: "flex", flexDirection: "column", height: "100vh", position: "fixed", top: 0, left: 0, zIndex: 100, transition: "width 0.25s ease, transform 0.28s ease", transform: tr, borderRight: "1px solid rgba(255,255,255,0.06)", overflowX: "hidden" }}>
        <div style={{ padding: collapsed && !isMobile ? "20px 0" : "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: collapsed && !isMobile ? "center" : "space-between", minHeight: 72, flexShrink: 0 }}>
          {(!collapsed || isMobile) && <div style={{ display: "flex", alignItems: "center", gap: 10 }}><img src="/logo.png" alt="FS" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} /><span style={{ color: "#fff", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap" }}>FlowSync</span></div>}
          {collapsed && !isMobile && <img src="/logo.png" alt="FS" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} />}
          {!isMobile && <button onClick={() => setCollapsed(!collapsed)} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginLeft: collapsed ? 0 : 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.midGrey} strokeWidth={2.5} strokeLinecap="round">{collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}</svg>
          </button>}
          {isMobile && <button onClick={() => setMobileOpen(false)} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="x" size={16} color={C.midGrey} /></button>}
        </div>
        {(!collapsed || isMobile) && (
          <button onClick={() => { setActiveTab("profile"); if (isMobile) setMobileOpen(false); }} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ position: "relative", flexShrink: 0 }}><Av photoUrl={user.photoUrl} name={user.name} size={36} /><div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: C.success, border: "2px solid #112240" }} /></div>
            <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "#fff", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div><div style={{ color: C.teal, fontSize: 11, fontWeight: 500, textTransform: "capitalize" }}>{user.role}</div></div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.midGrey} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
        {collapsed && !isMobile && <button onClick={() => setActiveTab("profile")} style={{ padding: "12px 0", display: "flex", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", width: "100%" }}><Av photoUrl={user.photoUrl} name={user.name} size={34} /></button>}
        <nav style={{ flex: 1, padding: collapsed && !isMobile ? "12px 8px" : "12px 10px", overflowY: "auto", overflowX: "hidden" }}>
          {nav.map(item => {
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); if (isMobile) setMobileOpen(false); }} title={collapsed && !isMobile ? item.label : ""}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: collapsed && !isMobile ? 0 : 11, justifyContent: collapsed && !isMobile ? "center" : "flex-start", padding: collapsed && !isMobile ? "11px 0" : "10px 11px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 4, background: active ? `linear-gradient(135deg, ${C.teal}22, ${C.blue}22)` : "transparent", color: active ? C.teal : C.midGrey, fontWeight: active ? 600 : 400, fontSize: 14, transition: "all 0.18s", textAlign: "left", position: "relative", whiteSpace: "nowrap" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                {active && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: `linear-gradient(${C.teal}, ${C.blue})`, borderRadius: "0 3px 3px 0" }} />}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Icon name={item.icon} size={18} color={active ? C.teal : C.midGrey} />
                  {collapsed && !isMobile && item.badge > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: C.danger, border: `1.5px solid ${bg}` }} />}
                </div>
                {(!collapsed || isMobile) && <><span style={{ flex: 1 }}>{item.label}</span>{item.badge > 0 && <span style={{ background: C.danger, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{item.badge}</span>}</>}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: collapsed && !isMobile ? "10px 8px" : "10px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button onClick={() => setDarkMode(!darkMode)} title={collapsed && !isMobile ? (darkMode ? "Light" : "Dark") : ""} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed && !isMobile ? "center" : "flex-start", gap: collapsed && !isMobile ? 0 : 11, padding: collapsed && !isMobile ? "10px 0" : "10px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: C.midGrey, fontSize: 14, marginBottom: 4 }}>
            <Icon name={darkMode ? "sun" : "moon"} size={18} color={C.midGrey} />
            {(!collapsed || isMobile) && (darkMode ? "Light Mode" : "Dark Mode")}
          </button>
          <button onClick={onLogout} title={collapsed && !isMobile ? "Sign Out" : ""} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed && !isMobile ? "center" : "flex-start", gap: collapsed && !isMobile ? 0 : 11, padding: collapsed && !isMobile ? "10px 0" : "10px 11px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: C.danger, fontSize: 14 }}>
            <Icon name="logout" size={18} color={C.danger} />
            {(!collapsed || isMobile) && "Sign Out"}
          </button>
        </div>
      </aside>
    </>
  );
}

function TaskCard({ task, me, members, canEdit, darkMode }) {
  const [open, setOpen] = useState(false);
  const [editing, setEdit] = useState(false);
  const [comment, setCom] = useState("");
  const [uploading, setUpl] = useState(false);
  const getDeadlineStr = (dl) => {
    if (!dl) return "";
    try {
      const dt = dl?.toDate ? dl.toDate() : new Date(dl);
      if (isNaN(dt)) return "";
      return dt.toISOString().split("T")[0];
    } catch { return ""; }
  };
  const [ed, setEd] = useState({ title: task.title || "", description: task.description || "", deadline: getDeadlineStr(task.deadline), priority: task.priority || "medium", category: task.category || "" });
  const fileRef = useRef(null);
  const bg = darkMode ? "#1A3358" : "#fff";
  const bdr = darkMode ? "rgba(255,255,255,0.08)" : C.softGrey;
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const ib = darkMode ? "rgba(255,255,255,0.05)" : C.offWhite;
  const assignees = (task.assignedTo || []).map(id => members.find(m => m.id === id)).filter(Boolean);
  const od = isOver(task.deadline) && task.status !== "completed";

  const cycleStatus = async () => {
    const cy = { pending: "ongoing", ongoing: "completed", completed: "pending" };
    const ns = cy[task.status];
    await updateDoc(doc(db, "tasks", task.id), { status: ns, updatedAt: serverTimestamp() });
    const prefs = loadPrefs();
    if (me.role === "employee" && task.managerId !== me.id && prefs.taskStatusChange) {
      await addDoc(NC(), { type: "taskStatusChange", message: `${me.name} moved "${task.title}" to ${slbl(ns)}`, time: serverTimestamp(), read: false, userId: task.managerId });
    }
  };
  const addComment = async () => {
    if (!comment.trim()) return;
    const c = { id: `c${Date.now()}`, userId: me.id, userName: me.name, userPhoto: me.photoUrl || null, text: comment, time: new Date().toISOString() };
    await updateDoc(doc(db, "tasks", task.id), { comments: arrayUnion(c) });
    setCom("");
  };
  const saveEdit = async () => {
    const payload = {
      title: ed.title,
      description: ed.description,
      category: ed.category,
      priority: ed.priority,
      deadline: ed.deadline || null,
      updatedAt: serverTimestamp()
    };
    try {
      await updateDoc(doc(db, "tasks", task.id), payload);
    } catch (e) { console.error("Save task error:", e); }
    setEdit(false);
  };
  const uploadFile = async (file) => {
    if (!file) return;
    setUpl(true);
    try {
      const r = sRef(storage, `tasks/${task.id}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, "tasks", task.id), { attachments: arrayUnion({ name: file.name, url, type: file.type, by: me.name, at: new Date().toISOString() }) });
    } catch (e) { alert("Upload failed: " + e.message); }
    setUpl(false);
  };
  const inp = { padding: "8px 12px", background: ib, border: `1px solid ${bdr}`, borderRadius: 8, color: tp, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" };

  if (editing) return (
    <div style={{ background: bg, borderRadius: 14, border: `1px solid ${bdr}`, padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ color: tp, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Edit Task</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><label style={{ color: ts, fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Title</label><input value={ed.title} onChange={e => setEd({ ...ed, title: e.target.value })} style={inp} /></div>
        <div><label style={{ color: ts, fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Category</label><input value={ed.category} onChange={e => setEd({ ...ed, category: e.target.value })} style={inp} /></div>
      </div>
      <div style={{ marginBottom: 10 }}><label style={{ color: ts, fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Description</label><textarea value={ed.description} onChange={e => setEd({ ...ed, description: e.target.value })} rows={3} style={{ ...inp, resize: "vertical" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div><label style={{ color: ts, fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Deadline</label><input type="date" value={ed.deadline} onChange={e => setEd({ ...ed, deadline: e.target.value })} style={inp} /></div>
        <div><label style={{ color: ts, fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Priority</label>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ v: "low", c: C.success }, { v: "medium", c: C.warning }, { v: "high", c: C.danger }].map(p => (
              <button key={p.v} onClick={() => setEd({ ...ed, priority: p.v })} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1.5px solid ${ed.priority === p.v ? p.c : bdr}`, background: ed.priority === p.v ? `${p.c}20` : "transparent", color: ed.priority === p.v ? p.c : ts, fontSize: 11, cursor: "pointer", textTransform: "capitalize" }}>{p.v}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={saveEdit} style={{ flex: 1, padding: "10px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", fontWeight: 700 }}>Save</button>
        <button onClick={() => setEdit(false)} style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 10, cursor: "pointer", color: ts, fontWeight: 600 }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ background: bg, borderRadius: 14, border: `1px solid ${bdr}`, padding: "16px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 12, transition: "box-shadow 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.12)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <Badge label={task.priority} bg={`${pcol(task.priority)}22`} color={pcol(task.priority)} />
            <Badge label={slbl(task.status)} bg={`${scol(task.status)}22`} color={scol(task.status)} />
            {task.category && <Badge label={task.category} bg={`${C.blue}18`} color={darkMode ? "#7BB8FF" : C.blue} />}
            {od && <Badge label="OVERDUE" bg={`${C.danger}22`} color={C.danger} />}
          </div>
          <h3 style={{ color: tp, fontWeight: 700, fontSize: 15, margin: "0 0 4px", lineHeight: 1.3 }}>{task.title}</h3>
          <p style={{ color: ts, fontSize: 13, margin: "0 0 8px", lineHeight: 1.5 }}>{task.description}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: od ? C.danger : ts, fontSize: 12 }}><Icon name="clock" size={13} color={od ? C.danger : C.midGrey} />{fdate(task.deadline)}</span>
            <div style={{ display: "flex" }}>{assignees.slice(0, 3).map((a, i) => <div key={a.id} style={{ marginLeft: i > 0 ? -8 : 0 }}><Av photoUrl={a.photoUrl} name={a.name} size={22} /></div>)}{assignees.length > 3 && <span style={{ fontSize: 11, color: ts, marginLeft: 4 }}>+{assignees.length - 3}</span>}</div>
            {(task.comments || []).length > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4, color: ts, fontSize: 12 }}><Icon name="comment" size={13} color={C.midGrey} />{(task.comments || []).length}</span>}
            {(task.attachments || []).length > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4, color: ts, fontSize: 12 }}><Icon name="paperclip" size={13} color={C.midGrey} />{(task.attachments || []).length}</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button onClick={cycleStatus} style={{ padding: "6px 10px", background: `${scol(task.status)}22`, border: `1px solid ${scol(task.status)}44`, borderRadius: 8, cursor: "pointer", color: scol(task.status), fontSize: 11, fontWeight: 600 }}>{task.status === "completed" ? "↩ Reset" : "→ Next"}</button>
          {canEdit && <button onClick={() => setEdit(true)} style={{ padding: "6px 10px", background: `${C.blue}15`, border: `1px solid ${C.blue}30`, borderRadius: 8, cursor: "pointer", color: C.blue, fontSize: 11 }}><Icon name="edit" size={12} color={C.blue} /></button>}
          <button onClick={() => setOpen(!open)} style={{ padding: "6px 10px", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 8, cursor: "pointer", color: ts, fontSize: 11 }}>{open ? "Less" : "More"}</button>
          {canEdit && <button onClick={() => deleteDoc(doc(db, "tasks", task.id))} style={{ padding: "6px 8px", background: `${C.danger}15`, border: "none", borderRadius: 8, cursor: "pointer" }}><Icon name="trash" size={13} color={C.danger} /></button>}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${bdr}`, paddingTop: 14 }}>
          {(task.attachments || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: tp, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Attachments</div>
              {(task.attachments || []).map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: ib, borderRadius: 8, marginBottom: 6, textDecoration: "none" }}>
                  <Icon name="paperclip" size={14} color={C.teal} /><span style={{ color: C.teal, fontSize: 13 }}>{a.name}</span><span style={{ color: ts, fontSize: 11, marginLeft: "auto" }}>by {a.by}</span>
                </a>
              ))}
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <input ref={fileRef} type="file" style={{ display: "none" }} onChange={e => uploadFile(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: `${C.teal}15`, border: `1px solid ${C.teal}30`, borderRadius: 8, cursor: "pointer", color: C.teal, fontSize: 12, fontWeight: 600 }}>
              <Icon name="paperclip" size={14} color={C.teal} />{uploading ? "Uploading..." : "Attach File"}
            </button>
          </div>
          {me.role === "employee" && task.status !== "completed" && (
            <button onClick={async () => {
              const r = prompt("Reason for deadline extension?");
              if (!r) return;
              await addDoc(NC(), { type: "extensionRequest", message: `${me.name} requested deadline extension for "${task.title}": "${r}"`, time: serverTimestamp(), read: false, userId: task.managerId });
              alert("Request sent to manager!");
            }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: `${C.warning}12`, border: `1px solid ${C.warning}30`, borderRadius: 8, cursor: "pointer", color: C.warning, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              <Icon name="extend" size={14} color={C.warning} /> Request Deadline Extension
            </button>
          )}
          <div style={{ color: tp, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Comments ({(task.comments || []).length})</div>
          {(task.comments || []).map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <Av photoUrl={c.userPhoto} name={c.userName || "?"} size={28} />
              <div style={{ background: ib, borderRadius: 10, padding: "8px 12px", flex: 1 }}>
                <span style={{ color: tp, fontSize: 13, fontWeight: 600 }}>{c.userName}</span>
                <span style={{ color: C.midGrey, fontSize: 11, marginLeft: 8 }}>{ago(c.time)}</span>
                <p style={{ color: ts, fontSize: 13, margin: "4px 0 0" }}>{c.text}</p>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input value={comment} onChange={e => setCom(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} placeholder="Add a comment..." style={{ flex: 1, padding: "8px 12px", background: ib, border: `1px solid ${bdr}`, borderRadius: 8, color: tp, fontSize: 13, outline: "none" }} />
            <button onClick={addComment} style={{ padding: "8px 14px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 8, cursor: "pointer" }}><Icon name="send" size={14} color="#fff" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function MgrDash({ user, tasks, members, darkMode }) {
  const mt = tasks.filter(t => t.managerId === user.id);
  const don = mt.filter(t => t.status === "completed").length;
  const ong = mt.filter(t => t.status === "ongoing").length;
  const pen = mt.filter(t => t.status === "pending").length;
  const bg = darkMode ? "#112240" : "#fff";
  const bdr = darkMode ? "rgba(255,255,255,0.08)" : C.softGrey;
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const upcoming = mt.filter(t => {
    if (t.status === "completed") return false;
    const dt = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline || 0);
    return (dt - Date.now()) / (1000 * 60 * 60 * 24) <= 3 && dt > new Date();
  });
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: tp, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Good morning, {user.name.split(" ")[0]} 👋</h1>
        <p style={{ color: ts, fontSize: 14 }}>Live team data synced from Firestore</p>
      </div>
      {upcoming.length > 0 && (
        <div style={{ background: `${C.warning}12`, border: `1px solid ${C.warning}40`, borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Icon name="clock" size={16} color={C.warning} /><span style={{ color: C.warning, fontWeight: 700, fontSize: 14 }}>⏰ {upcoming.length} task{upcoming.length > 1 ? "s" : ""} due within 3 days</span></div>
          {upcoming.map(t => <div key={t.id} style={{ color: ts, fontSize: 13 }}>• {t.title} — due {fdate(t.deadline)}</div>)}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[{ label: "Total Tasks", value: mt.length, icon: "tasks", color: C.blue, sub: "Across team" }, { label: "Completed", value: don, icon: "check", color: C.success, sub: `${mt.length ? Math.round((don / mt.length) * 100) : 0}% rate` }, { label: "In Progress", value: ong, icon: "activity", color: C.teal, sub: "Active now" }, { label: "Pending", value: pen, icon: "clock", color: C.warning, sub: "Not started" }].map(s => (
          <div key={s.label} style={{ background: bg, borderRadius: 16, padding: "20px", border: `1px solid ${bdr}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, background: `${s.color}18`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={s.icon} size={20} color={s.color} /></div>
              <span style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
            <div style={{ color: tp, fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.label}</div>
            <div style={{ color: ts, fontSize: 12 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: bg, borderRadius: 16, padding: "20px", border: `1px solid ${bdr}` }}>
          <h3 style={{ color: tp, fontWeight: 700, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Icon name="team" size={16} color={C.teal} />Team ({members.length})</h3>
          {members.length === 0 ? <p style={{ color: ts, fontSize: 13 }}>No members yet. Invite someone!</p> : members.map(m => {
            const mT = mt.filter(t => (t.assignedTo || []).includes(m.id));
            const mD = mT.filter(t => t.status === "completed").length;
            return <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Av photoUrl={m.photoUrl} name={m.name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: tp, fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                <PBar value={mD} max={Math.max(mT.length, 1)} />
                <div style={{ color: ts, fontSize: 11, marginTop: 2 }}>{mD}/{mT.length} done</div>
              </div>
            </div>;
          })}
        </div>
        <div style={{ background: bg, borderRadius: 16, padding: "20px", border: `1px solid ${bdr}` }}>
          <h3 style={{ color: tp, fontWeight: 700, fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Icon name="activity" size={16} color={C.teal} />Breakdown</h3>
          {[{ label: "Completed", value: don, color: C.success }, { label: "In Progress", value: ong, color: C.teal }, { label: "Pending", value: pen, color: C.warning }].map(i => (
            <div key={i.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: ts, fontSize: 13 }}>{i.label}</span><span style={{ color: i.color, fontWeight: 700, fontSize: 13 }}>{i.value}</span></div>
              <PBar value={i.value} max={Math.max(mt.length, 1)} color={i.color} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgBoard({ user, tasks, members, darkMode }) {
  const mt = tasks.filter(t => t.managerId === user.id);
  const cols = [{ id: "pending", label: "To Do", color: C.midGrey }, { id: "ongoing", label: "In Progress", color: C.teal }, { id: "completed", label: "Done", color: C.success }];
  const cb = darkMode ? "#112240" : "#E8EEF6";
  const crd = darkMode ? "#1A3358" : "#fff";
  const cbr = darkMode ? "rgba(255,255,255,0.10)" : "#D8E4F0";
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const move = async (id, s) => updateDoc(doc(db, "tasks", id), { status: s, updatedAt: serverTimestamp() });
  return (
    <div>
      <h2 style={{ color: tp, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Progress Board</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {cols.map(col => {
          const ct = mt.filter(t => t.status === col.id);
          return (
            <div key={col.id} style={{ background: cb, borderRadius: 16, padding: "14px", minHeight: 480, border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "#D0DAF0"}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, boxShadow: `0 0 6px ${col.color}88` }} /><span style={{ color: tp, fontWeight: 700, fontSize: 14 }}>{col.label}</span></div>
                <span style={{ background: `${col.color}30`, color: col.color, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{ct.length}</span>
              </div>
              {ct.map(t => {
                const asn = (t.assignedTo || []).map(id => members.find(m => m.id === id)).filter(Boolean);
                return (
                  <div key={t.id} style={{ background: crd, borderRadius: 12, padding: "13px 14px", marginBottom: 10, border: `1px solid ${cbr}`, boxShadow: darkMode ? "0 2px 14px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                      <Badge label={t.priority} bg={`${pcol(t.priority)}30`} color={pcol(t.priority)} />
                      {t.category && <Badge label={t.category} bg={darkMode ? "rgba(46,125,212,0.3)" : `${C.blue}18`} color={darkMode ? "#7BB8FF" : C.blue} />}
                    </div>
                    <div style={{ color: tp, fontWeight: 600, fontSize: 13, marginBottom: 5, lineHeight: 1.4 }}>{t.title}</div>
                    <div style={{ color: ts, fontSize: 12, marginBottom: 8, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</div>
                    <div style={{ display: "flex", marginBottom: 8 }}>{asn.slice(0, 3).map((a, i) => <div key={a.id} style={{ marginLeft: i > 0 ? -6 : 0 }}><Av photoUrl={a.photoUrl} name={a.name} size={22} /></div>)}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${cbr}`, paddingTop: 8 }}>
                      <span style={{ fontSize: 11, color: ts, display: "flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={11} color={ts} />{fdate(t.deadline)}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {col.id !== "pending" && <button onClick={() => move(t.id, col.id === "ongoing" ? "pending" : "ongoing")} style={{ padding: "4px 9px", background: darkMode ? "rgba(255,255,255,0.08)" : `${C.midGrey}18`, border: `1px solid ${darkMode ? "rgba(255,255,255,0.14)" : C.softGrey}`, borderRadius: 6, cursor: "pointer", color: ts, fontSize: 12, fontWeight: 600 }}>←</button>}
                        {col.id !== "completed" && <button onClick={() => move(t.id, col.id === "pending" ? "ongoing" : "completed")} style={{ padding: "4px 9px", background: `${col.color}28`, border: `1px solid ${col.color}55`, borderRadius: 6, cursor: "pointer", color: col.color, fontSize: 12, fontWeight: 600 }}>→</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {ct.length === 0 && <div style={{ textAlign: "center", padding: "44px 16px", color: ts, fontSize: 13, opacity: 0.55, border: `2px dashed ${darkMode ? "rgba(255,255,255,0.08)" : "#D0DAF0"}`, borderRadius: 10, marginTop: 8 }}>Drop tasks here</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskList({ user, tasks, members, darkMode }) {
  const [search, setSrch] = useState("");
  const [fPri, setFP] = useState("all");
  const [fSts, setFS] = useState("all");
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState("team");
  const [mSrch, setMS] = useState("");
  const [nt, setNT] = useState({ title: "", description: "", deadline: "", priority: "medium", assignedTo: [], category: "" });
  const bg = darkMode ? "#112240" : "#fff";
  const ib = darkMode ? "rgba(255,255,255,0.05)" : C.offWhite;
  const ibr = darkMode ? "rgba(255,255,255,0.10)" : C.softGrey;
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const dv = darkMode ? "rgba(255,255,255,0.07)" : C.softGrey;
  const myT = tasks.filter(t => user.role === "manager" ? t.managerId === user.id : (t.assignedTo || []).includes(user.id));
  const filt = myT.filter(t => (!search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase())) && (fPri === "all" || t.priority === fPri) && (fSts === "all" || t.status === fSts));
  const fm = members.filter(m => !mSrch || m.name.toLowerCase().includes(mSrch.toLowerCase()) || m.email.toLowerCase().includes(mSrch.toLowerCase()));
  const tog = (id) => setNT(p => ({ ...p, assignedTo: p.assignedTo.includes(id) ? p.assignedTo.filter(x => x !== id) : [...p.assignedTo, id] }));
  const addTask = async () => {
    if (!nt.title.trim()) return;
    const fa = mode === "team" ? members.map(m => m.id) : nt.assignedTo;
    await addDoc(TC(), {
      title: nt.title,
      description: nt.description,
      deadline: nt.deadline || null,
      priority: nt.priority,
      category: nt.category || "",
      assignedTo: fa,
      teamId: user.teamId || `team_${user.id}`,
      managerId: user.id,  // Always Firebase UID — persists across logouts
      comments: [],
      attachments: [],
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const prefs = loadPrefs();
    if (prefs.taskAssigned) {
      for (const uid of fa) {
        await addDoc(NC(), { type: "taskAssigned", message: `${user.name} assigned you "${nt.title}"`, time: serverTimestamp(), read: false, userId: uid });
        if (prefs.emailTaskUpdate) { const m = members.find(x => x.id === uid); if (m?.email) sendEmail({ toEmail: m.email, toName: m.name, fromName: user.name, subject: `New task: ${nt.title}`, message: `${user.name} assigned you "${nt.title}". Deadline: ${nt.deadline || "Not set"}.` }); }
      }
    }
    setNT({ title: "", description: "", deadline: "", priority: "medium", assignedTo: [], category: "" });
    setMode("team"); setShow(false);
  };
  const inp = { width: "100%", padding: "10px 14px", background: ib, border: `1px solid ${ibr}`, borderRadius: 8, color: tp, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ color: tp, fontSize: 22, fontWeight: 800 }}>{user.role === "manager" ? "All Tasks" : "My Tasks"}</h2>
        {user.role === "manager" && <button onClick={() => setShow(s => !s)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: show ? `${C.teal}18` : `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: show ? `1px solid ${C.teal}` : "none", borderRadius: 10, cursor: "pointer", color: show ? C.teal : "#fff", fontWeight: 600, fontSize: 14 }}>
          <Icon name={show ? "x" : "plus"} size={16} color={show ? C.teal : "#fff"} />{show ? "Cancel" : "Add Task"}
        </button>}
      </div>
      {show && (
        <div style={{ background: bg, borderRadius: 18, padding: "24px", marginBottom: 24, border: `1px solid ${C.teal}40`, boxShadow: "0 4px 32px rgba(13,191,191,0.10)" }}>
          <div style={{ color: tp, fontWeight: 800, fontSize: 16, marginBottom: 20 }}>New Task</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><label style={{ color: ts, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Title *</label><input value={nt.title} onChange={e => setNT({ ...nt, title: e.target.value })} placeholder="Task title" style={inp} /></div>
            <div><label style={{ color: ts, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Category</label><input value={nt.category} onChange={e => setNT({ ...nt, category: e.target.value })} placeholder="e.g. Engineering" style={inp} /></div>
          </div>
          <div style={{ marginBottom: 14 }}><label style={{ color: ts, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Description</label><textarea value={nt.description} onChange={e => setNT({ ...nt, description: e.target.value })} rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.55 }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div><label style={{ color: ts, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Deadline</label><input type="date" value={nt.deadline} onChange={e => setNT({ ...nt, deadline: e.target.value })} style={inp} /></div>
            <div><label style={{ color: ts, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Priority</label>
              <div style={{ display: "flex", gap: 8 }}>{[{ v: "low", c: C.success }, { v: "medium", c: C.warning }, { v: "high", c: C.danger }].map(p => <button key={p.v} onClick={() => setNT({ ...nt, priority: p.v })} style={{ flex: 1, padding: "10px 4px", borderRadius: 8, border: `1.5px solid ${nt.priority === p.v ? p.c : ibr}`, background: nt.priority === p.v ? `${p.c}20` : ib, color: nt.priority === p.v ? p.c : ts, fontWeight: nt.priority === p.v ? 700 : 500, fontSize: 12, cursor: "pointer" }}>{p.v.charAt(0).toUpperCase() + p.v.slice(1)}</button>)}</div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${dv}`, paddingTop: 20, marginBottom: 20 }}>
            <label style={{ color: ts, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 12, textTransform: "uppercase" }}>Assign To</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              {[{ id: "team", icon: "team", label: "Entire Team", sub: `${members.length} members`, ac: C.teal }, { id: "specific", icon: "user", label: "Specific People", sub: mode === "specific" && nt.assignedTo.length > 0 ? `${nt.assignedTo.length} selected` : "Pick individuals", ac: C.blue }].map(m => (
                <button key={m.id} onClick={() => { setMode(m.id); if (m.id === "team") setNT(p => ({ ...p, assignedTo: [] })); }}
                  style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, border: `2px solid ${mode === m.id ? m.ac : ibr}`, background: mode === m.id ? `${m.ac}15` : ib, cursor: "pointer" }}>
                  <Icon name={m.icon} size={18} color={mode === m.id ? m.ac : ts} />
                  <div style={{ textAlign: "left" }}><div style={{ color: mode === m.id ? m.ac : tp, fontWeight: 700, fontSize: 13 }}>{m.label}</div><div style={{ color: ts, fontSize: 11 }}>{m.sub}</div></div>
                  {mode === m.id && <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: m.ac, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={11} color="#fff" /></div>}
                </button>
              ))}
            </div>
            {mode === "team" && members.length > 0 && (
              <div style={{ padding: "12px 14px", background: `${C.teal}08`, borderRadius: 10, border: `1px solid ${C.teal}25` }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ color: ts, fontSize: 12 }}>Assigning to:</span>
                  {members.map(m => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: `${C.teal}18`, borderRadius: 20 }}><Av photoUrl={m.photoUrl} name={m.name} size={18} /><span style={{ color: C.teal, fontSize: 12, fontWeight: 600 }}>{m.name.split(" ")[0]}</span></div>)}
                </div>
              </div>
            )}
            {mode === "specific" && (
              <div>
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={14} color={C.midGrey} /></div>
                  <input value={mSrch} onChange={e => setMS(e.target.value)} placeholder="Search members..." style={{ ...inp, paddingLeft: 32 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {fm.length === 0 ? <p style={{ color: ts, fontSize: 13 }}>No members found.</p> : fm.map(m => {
                    const sel = nt.assignedTo.includes(m.id);
                    return <button key={m.id} onClick={() => tog(m.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${sel ? C.blue : ibr}`, background: sel ? `${C.blue}12` : ib, cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}><Av photoUrl={m.photoUrl} name={m.name} size={36} />{sel && <div style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: C.blue, border: `2px solid ${bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={8} color="#fff" /></div>}</div>
                      <div style={{ flex: 1 }}><div style={{ color: sel ? C.blue : tp, fontWeight: sel ? 700 : 500, fontSize: 14 }}>{m.name}</div><div style={{ color: ts, fontSize: 12 }}>{m.email}</div></div>
                      <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel ? C.blue : ibr}`, background: sel ? C.blue : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{sel && <Icon name="check" size={11} color="#fff" />}</div>
                    </button>;
                  })}
                  {members.length > 1 && <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={() => setNT(p => ({ ...p, assignedTo: members.map(m => m.id) }))} style={{ flex: 1, padding: "8px", background: "transparent", border: `1px solid ${ibr}`, borderRadius: 8, cursor: "pointer", color: ts, fontSize: 12, fontWeight: 600 }}>Select All</button>
                    <button onClick={() => setNT(p => ({ ...p, assignedTo: [] }))} style={{ flex: 1, padding: "8px", background: "transparent", border: `1px solid ${ibr}`, borderRadius: 8, cursor: "pointer", color: ts, fontSize: 12, fontWeight: 600 }}>Clear</button>
                  </div>}
                  {nt.assignedTo.length === 0 && <div style={{ color: C.warning, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon name="alertTriangle" size={13} color={C.warning} /> Select at least one person</div>}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={addTask} disabled={!nt.title.trim() || (mode === "specific" && nt.assignedTo.length === 0)} style={{ flex: 1, padding: "12px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14, opacity: (!nt.title.trim() || (mode === "specific" && nt.assignedTo.length === 0)) ? 0.5 : 1 }}>
              Create Task
            </button>
            <button onClick={() => { setShow(false); setNT({ title: "", description: "", deadline: "", priority: "medium", assignedTo: [], category: "" }); setMode("team"); }} style={{ padding: "12px 22px", background: ib, border: `1px solid ${ibr}`, borderRadius: 10, cursor: "pointer", color: ts, fontWeight: 600 }}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={15} color={C.midGrey} /></div>
          <input value={search} onChange={e => setSrch(e.target.value)} placeholder="Search tasks..." style={{ width: "100%", padding: "10px 14px 10px 36px", background: bg, border: `1px solid ${ibr}`, borderRadius: 10, color: tp, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "low", "medium", "high"].map(p => <button key={p} onClick={() => setFP(p)} style={{ padding: "8px 14px", background: fPri === p ? `${C.teal}22` : bg, border: `1px solid ${fPri === p ? C.teal : ibr}`, borderRadius: 10, cursor: "pointer", color: fPri === p ? C.teal : ts, fontSize: 13, fontWeight: fPri === p ? 700 : 400, textTransform: "capitalize" }}>{p}</button>)}
        </div>
        <select value={fSts} onChange={e => setFS(e.target.value)} style={{ padding: "8px 14px", background: bg, border: `1px solid ${ibr}`, borderRadius: 10, color: tp, fontSize: 13, outline: "none" }}>
          <option value="all">All Status</option><option value="pending">Pending</option><option value="ongoing">In Progress</option><option value="completed">Completed</option>
        </select>
      </div>
      <div style={{ color: ts, fontSize: 13, marginBottom: 14 }}>{filt.length} task{filt.length !== 1 ? "s" : ""}</div>
      {filt.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: ts }}><Icon name="tasks" size={48} color={C.midGrey} /><p style={{ marginTop: 16 }}>No tasks found</p></div>
        : filt.map(t => <TaskCard key={t.id} task={t} me={user} members={members} canEdit={user.role === "manager"} darkMode={darkMode} />)}
    </div>
  );
}

function Chat({ user, teamId, members, darkMode }) {
  const [msgs, setMsgs] = useState([]);
  const [txt, setTxt] = useState("");
  const [load, setLoad] = useState(true);
  const bot = useRef(null);
  const bg = darkMode ? "#112240" : "#fff";
  const bdr = darkMode ? "rgba(255,255,255,0.08)" : C.softGrey;
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  useEffect(() => {
    if (!teamId) { setLoad(false); return; }
    const q = query(collection(db, "chats", teamId, "messages"), orderBy("createdAt"));
    const u = onSnapshot(q, snap => { setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoad(false); setTimeout(() => bot.current?.scrollIntoView({ behavior: "smooth" }), 100); });
    return () => u();
  }, [teamId]);
  const send = async () => {
    if (!txt.trim() || !teamId) return;
    const mentions = [...(txt.matchAll(/@(\w+)/g))].map(m => m[1].toLowerCase());
    await addDoc(collection(db, "chats", teamId, "messages"), { text: txt.trim(), userId: user.id, userName: user.name, userPhoto: user.photoUrl || null, createdAt: serverTimestamp(), mentions });
    for (const m of members) {
      if (mentions.some(mn => m.name.toLowerCase().includes(mn)) && m.id !== user.id) {
        await addDoc(NC(), { type: "mention", message: `${user.name} mentioned you in chat`, time: serverTimestamp(), read: false, userId: m.id });
      }
    }
    setTxt("");
  };
  if (!teamId) return <div style={{ textAlign: "center", padding: 80, color: ts }}><Icon name="chat" size={48} color={C.midGrey} /><p style={{ marginTop: 16 }}>Join a team to access chat.</p></div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 400 }}>
      <h2 style={{ color: tp, fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Team Chat</h2>
      <div style={{ flex: 1, overflowY: "auto", background: bg, borderRadius: 16, border: `1px solid ${bdr}`, padding: "16px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
        {load ? <div style={{ textAlign: "center", color: ts, padding: 40 }}>Loading...</div> :
          msgs.length === 0 ? <div style={{ textAlign: "center", color: ts, padding: 40, opacity: 0.6 }}>No messages yet. Say hello! 👋</div> :
          msgs.map(m => {
            const isMe = m.userId === user.id;
            const hl = (m.mentions || []).some(mn => user.name.toLowerCase().includes(mn));
            return <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexDirection: isMe ? "row-reverse" : "row" }}>
              {!isMe && <Av photoUrl={m.userPhoto} name={m.userName} size={32} />}
              <div style={{ maxWidth: "70%" }}>
                {!isMe && <div style={{ color: ts, fontSize: 11, marginBottom: 3 }}>{m.userName} · {ago(m.createdAt)}</div>}
                <div style={{ padding: "10px 14px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isMe ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : (hl ? `${C.warning}15` : (darkMode ? "#1A3358" : C.offWhite)), color: isMe ? "#fff" : tp, fontSize: 14, lineHeight: 1.5, border: hl ? `1px solid ${C.warning}40` : "none" }}>
                  {m.text.split(/(@\w+)/g).map((part, i) => part.startsWith("@") ? <span key={i} style={{ background: isMe ? "rgba(255,255,255,0.2)" : `${C.teal}25`, borderRadius: 4, padding: "1px 4px", fontWeight: 600, color: isMe ? "#fff" : C.teal }}>{part}</span> : part)}
                </div>
                {isMe && <div style={{ color: ts, fontSize: 11, marginTop: 3, textAlign: "right" }}>{ago(m.createdAt)}</div>}
              </div>
            </div>;
          })}
        <div ref={bot} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <input value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} placeholder="Type a message... use @name to mention" style={{ flex: 1, padding: "12px 14px", background: bg, border: `1px solid ${bdr}`, borderRadius: 12, color: tp, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        <button onClick={send} style={{ padding: "12px 20px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 12, cursor: "pointer" }}><Icon name="send" size={18} color="#fff" /></button>
      </div>
      <div style={{ color: ts, fontSize: 11, marginTop: 6, textAlign: "center" }}>Use @name to mention teammates · Enter to send</div>
    </div>
  );
}

function TeamMgmt({ user, invitations, setInvitations, members, setMembers, darkMode }) {
  const [tab, setTab] = useState("members");
  const [email, setEml] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [srch, setSrch] = useState("");
  const [sent, setSent] = useState(() => { try { const v = localStorage.getItem("fs_si_" + user.id); return v ? JSON.parse(v) : []; } catch { return []; } });
  const [ai, setAi] = useState("");
  const [aiL, setAiL] = useState(false);
  const [rmv, setRmv] = useState(null);
  const prefs = loadPrefs();
  const bg = darkMode ? "#112240" : "#fff";
  const bdr = darkMode ? "rgba(255,255,255,0.10)" : C.softGrey;
  const ib = darkMode ? "#0A1628" : C.offWhite;
  const ibr = darkMode ? "rgba(255,255,255,0.14)" : "#C8D8EC";
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const dv = darkMode ? "rgba(255,255,255,0.07)" : C.softGrey;
  const fm = members.filter(m => !srch || m.name.toLowerCase().includes(srch.toLowerCase()) || m.email.toLowerCase().includes(srch.toLowerCase()));
  const ve = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const sendInvite = async () => {
    setErr(""); setOk("");
    const e = email.trim().toLowerCase();
    if (!e) { setErr("Enter an email address."); return; }
    if (!ve(e)) { setErr("Invalid email address."); return; }
    if (members.find(m => m.email === e)) { setErr("This person is already on your team!"); return; }
    setBusy(true);
    const teamId = user.teamId || `team_${user.id}`;
    const invMsg = msg.trim() || "Join my team on FlowSync!";
    const inv = { id: `i${Date.now()}`, email: e, name: e.split("@")[0], message: invMsg, status: "pending", sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), emailSent: false };
    // Save to Firestore (with timeout so it doesn't hang)
    try {
      const firestorePromise = addDoc(IC(), { managerId: user.id, managerName: user.name, managerEmail: user.email, teamId, recipientEmail: e, status: "pending", message: invMsg, time: serverTimestamp() });
      const timeout = new Promise((_, reject) => setTimeout(() => reject("timeout"), 8000));
      await Promise.race([firestorePromise, timeout]);
    } catch (err) {
      if (err === "timeout") { setErr("Connection slow. Invite saved locally — they will see it next time."); }
      // Continue anyway — save locally below
    }
    // Always save locally regardless of Firestore result
    if (prefs.emailInvite) {
      try { inv.emailSent = await sendEmail({ toEmail: e, toName: inv.name, fromName: user.name, subject: `${user.name} invited you to join FlowSync`, message: invMsg }); } catch {}
    }
    const upd = [inv, ...sent]; setSent(upd);
    try { localStorage.setItem("fs_si_" + user.id, JSON.stringify(upd)); } catch {}
    setOk(`✅ Invite sent to ${e}! ${prefs.emailInvite ? (inv.emailSent ? "📧 Email delivered." : "⚠️ Email needs EmailJS setup.") : ""}`);
    setEml(""); setMsg(""); setBusy(false);
  };

  const removeMember = async (id) => {
    setRmv(id);
    setTimeout(async () => { await updateDoc(doc(db, "users", id), { teamId: null }); setMembers(p => p.filter(m => m.id !== id)); setRmv(null); }, 300);
  };

  const getAi = async () => {
    setAiL(true);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 200, messages: [{ role: "user", content: `Give a 2-sentence practical tip for manager ${user.name} with ${members.length} member(s). Be specific and actionable.` }] }) });
      const d = await r.json(); setAi(d.content[0].text);
    } catch { setAi("Clear ownership and realistic deadlines are the foundation of a productive team."); }
    setAiL(false);
  };

  const tb = (id) => ({ padding: "9px 20px", background: tab === id ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : (darkMode ? "rgba(255,255,255,0.05)" : C.offWhite), border: `1px solid ${tab === id ? "transparent" : ibr}`, borderRadius: 10, cursor: "pointer", color: tab === id ? "#fff" : ts, fontWeight: tab === id ? 700 : 500, fontSize: 13 });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ color: tp, fontSize: 22, fontWeight: 800 }}>My Team</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTab("members")} style={tb("members")}>👥 Members ({members.length})</button>
          <button onClick={() => setTab("invite")} style={tb("invite")}>✉️ Invite</button>
          <button onClick={() => setTab("sent")} style={tb("sent")}>📬 Sent ({sent.length})</button>
        </div>
      </div>
      <div style={{ background: `${C.teal}08`, borderRadius: 14, padding: "14px 18px", border: `1px solid ${C.teal}25`, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}><Icon name="star" size={18} color={C.teal} />{ai ? <p style={{ color: ts, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{ai}</p> : <span style={{ color: ts, fontSize: 13 }}>Get an AI tip for managing your team.</span>}</div>
        <button onClick={getAi} disabled={aiL} style={{ padding: "8px 16px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600, opacity: aiL ? 0.7 : 1, flexShrink: 0 }}>{aiL ? "Thinking…" : "Get Tip ✨"}</button>
      </div>

      {tab === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={15} color={C.midGrey} /></div>
            <input value={srch} onChange={e => setSrch(e.target.value)} placeholder="Search members..." style={{ width: "100%", padding: "10px 14px 10px 36px", background: bg, border: `1px solid ${bdr}`, borderRadius: 10, color: tp, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ background: bg, borderRadius: 16, border: `1px solid ${bdr}`, overflow: "hidden" }}>
            {fm.length === 0 ? <div style={{ textAlign: "center", padding: "48px 24px" }}><Icon name="team" size={40} color={C.midGrey} /><p style={{ color: ts, marginTop: 12, fontSize: 14 }}>{srch ? "No members match." : "No team members yet."}</p></div>
              : fm.map((m, i) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: i < fm.length - 1 ? `1px solid ${dv}` : "none", opacity: rmv === m.id ? 0.4 : 1, transition: "opacity 0.3s" }}>
                  <Av photoUrl={m.photoUrl} name={m.name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: tp, fontWeight: 700, fontSize: 14 }}>{m.name}</div><div style={{ color: ts, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Icon name="mail" size={11} color={ts} />{m.email}</div></div>
                  <Badge label="Active" bg={`${C.success}22`} color={C.success} />
                  <button onClick={() => removeMember(m.id)} style={{ padding: "6px 10px", background: `${C.danger}15`, border: `1px solid ${C.danger}30`, borderRadius: 8, cursor: "pointer", color: C.danger, fontSize: 12, fontWeight: 600 }}>Remove</button>
                </div>
              ))}
          </div>
        </div>
      )}

      {tab === "invite" && (
        <div style={{ background: bg, borderRadius: 16, border: `1px solid ${bdr}`, padding: "24px", maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${C.teal}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="mail" size={18} color={C.teal} /></div>
            <div><div style={{ color: tp, fontWeight: 700, fontSize: 15 }}>Invite via Email</div><div style={{ color: ts, fontSize: 12 }}>Send invitation to any email address</div></div>
          </div>
          <label style={{ color: ts, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Email Address *</label>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Icon name="mail" size={15} color={C.midGrey} /></div>
            <input value={email} onChange={e => { setEml(e.target.value); setErr(""); setOk(""); }} onKeyDown={e => e.key === "Enter" && sendInvite()} placeholder="colleague@gmail.com" style={{ width: "100%", padding: "11px 14px 11px 38px", background: ib, border: `1px solid ${err ? C.danger : ok ? C.success : ibr}`, borderRadius: 10, color: tp, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
          <label style={{ color: ts, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Personal Message (optional)</label>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Hi! Join my team on FlowSync..." rows={3} style={{ width: "100%", padding: "10px 14px", background: ib, border: `1px solid ${ibr}`, borderRadius: 10, color: tp, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: 14, lineHeight: 1.5 }} />
          {err && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: `${C.danger}12`, border: `1px solid ${C.danger}30`, borderRadius: 8, marginBottom: 14 }}><Icon name="x" size={14} color={C.danger} /><span style={{ color: C.danger, fontSize: 13 }}>{err}</span></div>}
          {ok && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: `${C.success}12`, border: `1px solid ${C.success}30`, borderRadius: 8, marginBottom: 14 }}><Icon name="check" size={14} color={C.success} /><span style={{ color: C.success, fontSize: 13 }}>{ok}</span></div>}
          <button onClick={sendInvite} disabled={busy} style={{ width: "100%", padding: "12px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1 }}>
            <Icon name="send" size={16} color="#fff" />{busy ? "Sending..." : "Send Invitation"}
          </button>
        </div>
      )}

      {tab === "sent" && (
        <div style={{ background: bg, borderRadius: 16, border: `1px solid ${bdr}`, overflow: "hidden" }}>
          {sent.length === 0 ? <div style={{ textAlign: "center", padding: "60px 24px" }}><Icon name="send" size={40} color={C.midGrey} /><p style={{ color: ts, marginTop: 14, fontSize: 14 }}>No invitations sent yet.</p></div>
            : sent.map((inv, i) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 20px", borderBottom: i < sent.length - 1 ? `1px solid ${dv}` : "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{inv.name.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: tp, fontWeight: 600, fontSize: 14 }}>{inv.name}</div>
                  <div style={{ color: ts, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Icon name="mail" size={11} color={ts} />{inv.email}</div>
                  {inv.message && <div style={{ color: ts, fontSize: 12, fontStyle: "italic", marginTop: 2, opacity: 0.8 }}>"{inv.message}"</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <Badge label={inv.emailSent ? "Email sent ✅" : "Stored"} bg={`${C.teal}20`} color={C.teal} />
                  <span style={{ color: C.midGrey, fontSize: 11 }}>{inv.sentAt}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Analytics({ user, tasks, members, darkMode }) {
  const mt = tasks.filter(t => t.managerId === user.id);
  const don = mt.filter(t => t.status === "completed").length;
  const ong = mt.filter(t => t.status === "ongoing").length;
  const pen = mt.filter(t => t.status === "pending").length;
  const bp = { high: mt.filter(t => t.priority === "high").length, medium: mt.filter(t => t.priority === "medium").length, low: mt.filter(t => t.priority === "low").length };
  const rate = mt.length ? Math.round((don / mt.length) * 100) : 0;
  const od = mt.filter(t => isOver(t.deadline) && t.status !== "completed").length;
  const [ai, setAi] = useState("");
  const [aiL, setAiL] = useState(false);
  const bg = darkMode ? "#112240" : "#fff";
  const bdr = darkMode ? "rgba(255,255,255,0.08)" : C.softGrey;
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;

  const getAi = async () => {
    setAiL(true);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, messages: [{ role: "user", content: `Analyze: Total:${mt.length} Done:${don} Active:${ong} Pending:${pen} Overdue:${od} High:${bp.high} Team:${members.length} Rate:${rate}%. Give 3 actionable insights in 3 sentences.` }] }) });
      const d = await r.json(); setAi(d.content[0].text);
    } catch { setAi("Focus on overdue tasks first, then high-priority items to maximize team impact."); }
    setAiL(false);
  };

  const exportReport = () => {
    const txt = `FlowSync Report\n${new Date().toLocaleDateString()}\nTeam: ${user.name} (${members.length} members)\nTotal:${mt.length} Done:${don}(${rate}%) Active:${ong} Pending:${pen} Overdue:${od}\n\nAI Insight:\n${ai || "Run analysis first."}`;
    const b = new Blob([txt], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "flowsync-report.txt"; a.click(); URL.revokeObjectURL(u);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ color: tp, fontSize: 22, fontWeight: 800 }}>Analytics</h2>
        <button onClick={exportReport} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: `${C.blue}15`, border: `1px solid ${C.blue}30`, borderRadius: 10, cursor: "pointer", color: C.blue, fontSize: 13, fontWeight: 600 }}>
          <Icon name="export" size={15} color={C.blue} /> Export Report
        </button>
      </div>
      {od > 0 && <div style={{ background: `${C.danger}10`, border: `1px solid ${C.danger}35`, borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}><Icon name="alertTriangle" size={18} color={C.danger} /><span style={{ color: C.danger, fontSize: 14, fontWeight: 600 }}>{od} overdue task{od > 1 ? "s" : ""} need attention</span></div>}
      <div style={{ background: `linear-gradient(135deg, ${C.navyM}, ${C.blue})`, borderRadius: 20, padding: "32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, width: 200, height: 200, borderRadius: "50%", background: `${C.teal}18` }} />
        <div style={{ position: "relative" }}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Overall Completion Rate</div>
          <div style={{ fontSize: 64, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 12 }}>{rate}<span style={{ fontSize: 28 }}>%</span></div>
          <PBar value={rate} max={100} color={C.teal} />
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 8 }}>{don} of {mt.length} tasks completed</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[{ label: "By Priority", items: [{ label: "High", value: bp.high, color: C.danger }, { label: "Medium", value: bp.medium, color: C.warning }, { label: "Low", value: bp.low, color: C.success }] }, { label: "By Status", items: [{ label: "Completed", value: don, color: C.success }, { label: "In Progress", value: ong, color: C.teal }, { label: "Pending", value: pen, color: C.warning }] }].map(sec => (
          <div key={sec.label} style={{ background: bg, borderRadius: 16, padding: "20px", border: `1px solid ${bdr}` }}>
            <div style={{ color: ts, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{sec.label}</div>
            {sec.items.map(item => (<div key={item.label} style={{ marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: ts, fontSize: 13 }}>{item.label}</span><span style={{ color: item.color, fontWeight: 700, fontSize: 13 }}>{item.value}</span></div><PBar value={item.value} max={Math.max(mt.length, 1)} color={item.color} /></div>))}
          </div>
        ))}
        <div style={{ background: bg, borderRadius: 16, padding: "20px", border: `1px solid ${bdr}` }}>
          <div style={{ color: ts, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Team Performance</div>
          {members.length === 0 ? <p style={{ color: ts, fontSize: 13 }}>No team data yet</p> : members.map(m => {
            const mT = mt.filter(t => (t.assignedTo || []).includes(m.id));
            const mD = mT.filter(t => t.status === "completed").length;
            return <div key={m.id} style={{ marginBottom: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}><Av photoUrl={m.photoUrl} name={m.name} size={24} /><span style={{ color: tp, fontSize: 12, fontWeight: 600, flex: 1 }}>{m.name.split(" ")[0]}</span><span style={{ color: C.teal, fontSize: 12, fontWeight: 700 }}>{mT.length ? Math.round((mD / mT.length) * 100) : 0}%</span></div><PBar value={mD} max={Math.max(mT.length, 1)} /></div>;
          })}
        </div>
      </div>
      <div style={{ background: `${C.teal}08`, borderRadius: 16, padding: "20px", border: `1px solid ${C.teal}30` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ai ? 12 : 0, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="zap" size={18} color={C.teal} /><span style={{ color: tp, fontWeight: 700, fontSize: 14 }}>AI Insights</span></div>
          <button onClick={getAi} disabled={aiL} style={{ padding: "8px 18px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600, opacity: aiL ? 0.7 : 1 }}>{aiL ? "Analyzing…" : "Analyze ✨"}</button>
        </div>
        {ai && <p style={{ color: ts, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{ai}</p>}
      </div>
    </div>
  );
}

function EmployeeInbox({ user, setUser, invitations, setInvitations, setNotifications, darkMode }) {
  const myInvites = invitations.filter(i => (i.employeeId === user.id || i.recipientEmail === user.email) && i.status === "pending");
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const bg = darkMode ? C.navyL : "#fff";
  const bdr = darkMode ? "rgba(255,255,255,0.08)" : C.softGrey;

  const handleInvite = async (invId, action) => {
    const inv = invitations.find(i => i.id === invId);
    if (!inv) return;
    await updateDoc(doc(db, "invitations", invId), { status: action });
    setInvitations(prev => prev.map(i => i.id === invId ? { ...i, status: action } : i));
    if (action === "accepted") {
      const teamId = inv.teamId || `team_${inv.managerId}`;
      await updateDoc(doc(db, "users", user.id), { teamId });
      setUser(prev => ({ ...prev, teamId }));
      const prefs = loadPrefs();
      if (prefs.inviteAccepted) {
        await addDoc(NC(), { type: "inviteAccepted", message: `${user.name} accepted your team invitation! 🎉`, time: serverTimestamp(), read: false, userId: inv.managerId });
      }
      try {
        const teamRef = doc(db, "teams", teamId);
        const teamDoc = await getDoc(teamRef);
        if (teamDoc.exists()) { await updateDoc(teamRef, { members: arrayUnion({ id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl || null }) }); }
        else { await setDoc(teamRef, { id: teamId, managerId: inv.managerId, managerName: inv.managerName, members: [{ id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl || null }] }); }
      } catch (e) { console.error("Team update error:", e); }
    }
    await addDoc(NC(), { type: "invite_response", message: action === "accepted" ? `You joined ${inv.managerName}'s team! 🎉` : `You declined the invitation from ${inv.managerName}`, time: serverTimestamp(), read: false, userId: user.id });
  };

  return (
    <div>
      <h2 style={{ color: tp, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Inbox</h2>
      {myInvites.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, background: bg, borderRadius: 16, border: `1px solid ${bdr}` }}>
          <Icon name="inbox" size={48} color={C.midGrey} />
          <p style={{ color: ts, marginTop: 16 }}>No pending invitations</p>
        </div>
      ) : myInvites.map(inv => (
        <div key={inv.id} style={{ background: bg, borderRadius: 16, padding: "20px", marginBottom: 16, border: `1px solid ${C.teal}30`, boxShadow: "0 2px 12px rgba(13,191,191,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="mail" size={20} color="#fff" /></div>
            <div><div style={{ color: tp, fontWeight: 700, fontSize: 15 }}>Team Invitation</div><div style={{ color: ts, fontSize: 13 }}>from {inv.managerName} · {ago(inv.time)}</div></div>
          </div>
          <p style={{ color: ts, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>"{inv.message}"</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => handleInvite(inv.id, "accepted")} style={{ flex: 1, padding: "10px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", fontWeight: 600, fontSize: 14 }}>✓ Accept</button>
            <button onClick={() => handleInvite(inv.id, "rejected")} style={{ flex: 1, padding: "10px", background: `${C.danger}18`, border: `1px solid ${C.danger}44`, borderRadius: 10, cursor: "pointer", color: C.danger, fontWeight: 600, fontSize: 14 }}>✗ Decline</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotifsPanel({ user, notifications, setNotifications, darkMode }) {
  const myN = [...notifications].sort((a, b) => { const ta = a.time?.toDate ? a.time.toDate() : new Date(a.time || 0); const tb = b.time?.toDate ? b.time.toDate() : new Date(b.time || 0); return tb - ta; });
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const bg = darkMode ? C.navyL : "#fff";
  const bdr = darkMode ? "rgba(255,255,255,0.08)" : C.softGrey;
  const iconMap = { task_update: "edit", task_complete: "check", invitation: "mail", inviteReceived: "mail", taskAssigned: "tasks", invite_response: "check", inviteAccepted: "check", taskStatusChange: "activity", extensionRequest: "extend", mention: "at", deadline: "clock" };
  const colorMap = { task_update: C.blue, task_complete: C.success, invitation: C.teal, inviteReceived: C.teal, taskAssigned: C.warning, invite_response: C.success, inviteAccepted: C.success, taskStatusChange: C.blue, extensionRequest: C.warning, mention: C.purple, deadline: C.danger };

  const markAllRead = async () => {
    for (const n of myN.filter(n => !n.read)) { await updateDoc(doc(db, "notifications", n.id), { read: true }); }
    setNotifications(prev => prev.map(n => n.userId === user.id ? { ...n, read: true } : n));
  };
  const markRead = async (id) => {
    await updateDoc(doc(db, "notifications", id), { read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ color: tp, fontSize: 22, fontWeight: 800 }}>Notifications</h2>
        <button onClick={markAllRead} style={{ padding: "8px 16px", background: `${C.teal}18`, border: `1px solid ${C.teal}44`, borderRadius: 8, cursor: "pointer", color: C.teal, fontSize: 13, fontWeight: 600 }}>Mark all read</button>
      </div>
      {myN.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, background: bg, borderRadius: 16, border: `1px solid ${bdr}` }}><Icon name="bell" size={48} color={C.midGrey} /><p style={{ color: ts, marginTop: 16 }}>No notifications</p></div>
      ) : myN.map(n => (
        <div key={n.id} onClick={() => markRead(n.id)} style={{ background: bg, borderRadius: 14, padding: "16px 20px", marginBottom: 12, border: `1px solid ${n.read ? bdr : C.teal + "44"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, opacity: n.read ? 0.7 : 1, transition: "all 0.2s" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${colorMap[n.type] || C.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={iconMap[n.type] || "bell"} size={18} color={colorMap[n.type] || C.blue} /></div>
          <div style={{ flex: 1 }}><div style={{ color: tp, fontSize: 14, fontWeight: n.read ? 400 : 600, marginBottom: 3 }}>{n.message}</div><div style={{ color: C.midGrey, fontSize: 12 }}>{ago(n.time)}</div></div>
          {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  );
}

function ActivityLog({ user, tasks, darkMode }) {
  const myT = tasks.filter(t => (t.assignedTo || []).includes(user.id));
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const bg = darkMode ? C.navyL : "#fff";
  const bdr = darkMode ? "rgba(255,255,255,0.08)" : C.softGrey;
  const acts = myT.flatMap(t => [
    { id: `a-${t.id}-a`, type: "assigned", text: `Assigned to "${t.title}"`, time: t.createdAt, color: C.blue },
    ...(t.comments || []).map(c => ({ id: `a-${c.id}`, type: "comment", text: `Commented on "${t.title}": "${c.text}"`, time: c.time, color: C.teal })),
    ...(t.status !== "pending" ? [{ id: `a-${t.id}-s`, type: "status", text: `Moved "${t.title}" to ${slbl(t.status)}`, time: t.updatedAt || t.createdAt, color: scol(t.status) }] : []),
  ]).sort((a, b) => { const ta = a.time?.toDate ? a.time.toDate() : new Date(a.time || 0); const tb = b.time?.toDate ? b.time.toDate() : new Date(b.time || 0); return tb - ta; });
  return (
    <div>
      <h2 style={{ color: tp, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Activity Log</h2>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: `linear-gradient(to bottom, ${C.teal}, ${C.blue}44)`, borderRadius: 1 }} />
        {acts.length === 0 ? <p style={{ color: ts, fontSize: 14, paddingLeft: 48 }}>No activity yet.</p>
          : acts.map(a => (
            <div key={a.id} style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${a.color}18`, border: `2px solid ${a.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                <Icon name={a.type === "assigned" ? "tasks" : a.type === "comment" ? "comment" : "check"} size={16} color={a.color} />
              </div>
              <div style={{ background: bg, borderRadius: 12, padding: "12px 16px", flex: 1, border: `1px solid ${bdr}` }}>
                <div style={{ color: tp, fontSize: 13, marginBottom: 4 }}>{a.text}</div>
                <div style={{ color: C.midGrey, fontSize: 11 }}>{ago(a.time)}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function ProfileSection({ user, setUser, tasks, darkMode }) {
  const [editName, setEN] = useState(user.name);
  const [editBio, setEB] = useState(user.bio || "");
  const [editPhone, setEP] = useState(user.phone || "");
  const [editDept, setED] = useState(user.department || "");
  const [editLoc, setEL] = useState(user.location || "");
  const [photoUrl, setPhoto] = useState(user.photoUrl || null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDrag] = useState(false);
  const [uploading, setUpl] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const fileRef = useRef(null);
  const bg = darkMode ? "#112240" : "#fff";
  const ib = darkMode ? "#0A1628" : C.offWhite;
  const ibr = darkMode ? "rgba(255,255,255,0.14)" : "#C8D8EC";
  const bdr = darkMode ? "rgba(255,255,255,0.10)" : C.softGrey;
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const dv = darkMode ? "rgba(255,255,255,0.07)" : C.softGrey;
  const myT = tasks.filter(t => (t.assignedTo || []).includes(user.id) || t.managerId === user.id);
  const done = myT.filter(t => t.status === "completed").length;
  const ong = myT.filter(t => t.status === "ongoing").length;
  const rate = myT.length ? Math.round((done / myT.length) * 100) : 0;

  const handlePhoto = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    // Step 1: Show preview INSTANTLY using base64 (no waiting)
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setPhoto(base64);
      setUser(prev => ({ ...prev, photoUrl: base64 }));
      try { localStorage.setItem("fs_photo_" + user.id, base64); } catch {}
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      // Step 2: Upload to Firebase Storage in background
      setUpl(true);
      try {
        const r = sRef(storage, `profiles/${user.id}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        // Replace base64 with permanent URL
        setPhoto(url);
        setUser(prev => ({ ...prev, photoUrl: url }));
        await updateDoc(doc(db, "users", user.id), { photoUrl: url });
        try { localStorage.setItem("fs_user_cache", JSON.stringify({ ...user, photoUrl: url })); } catch {}
      } catch {
        // base64 already saved above, Firebase Storage upload failed silently
      }
      setUpl(false);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    const updated = { name: editName.trim(), avatar: ini(editName.trim()), bio: editBio, phone: editPhone, department: editDept, location: editLoc, photoUrl };
    // Update state immediately
    setUser(prev => {
      const newUser = { ...prev, ...updated };
      try { localStorage.setItem("fs_user_cache", JSON.stringify(newUser)); } catch {}
      return newUser;
    });
    setSaved(true); setTimeout(() => setSaved(false), 3000);
    // Save to Firestore in background
    try { await updateDoc(doc(db, "users", user.id), updated); } catch {}
  };

  const updatePref = (key, val) => { const u = { ...prefs, [key]: val }; setPrefs(u); savePrefs(u); setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const inp = { width: "100%", padding: "11px 14px", background: ib, border: `1px solid ${ibr}`, borderRadius: 10, color: tp, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.2s" };
  const lbl = { color: ts, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 };

  return (
    <div>
      <h2 style={{ color: tp, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>My Profile</h2>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: bg, borderRadius: 20, border: `1px solid ${bdr}`, overflow: "hidden" }}>
            <div style={{ height: 90, background: `linear-gradient(135deg, ${C.navyM}, ${C.blue}, ${C.teal})`, position: "relative" }}><div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} /></div>
            <div style={{ padding: "0 24px 24px", position: "relative" }}>
              <div style={{ position: "relative", display: "inline-block", marginTop: -44, marginBottom: 14 }}>
                <div onClick={() => fileRef.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); handlePhoto(e.dataTransfer.files[0]); }}
                  style={{ width: 88, height: 88, borderRadius: "50%", cursor: "pointer", position: "relative", border: `3px solid ${dragging ? C.teal : (darkMode ? "#112240" : "#fff")}`, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", overflow: "hidden", transition: "all 0.2s" }}>
                  {photoUrl ? <img src={photoUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: "#fff" }}>{ini(editName)}</div>}
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}><Icon name="edit" size={20} color="#fff" /></div>
                </div>
                <div style={{ position: "absolute", bottom: 3, right: 3, width: 14, height: 14, borderRadius: "50%", background: C.success, border: `2px solid ${bg}` }} />
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handlePhoto(e.target.files[0])} />
              <div style={{ color: tp, fontWeight: 800, fontSize: 18, marginBottom: 2 }}>{editName || user.name}</div>
              <div style={{ color: C.teal, fontSize: 13, fontWeight: 600, textTransform: "capitalize", marginBottom: 4 }}>{user.role}</div>
              <div style={{ color: ts, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Icon name="mail" size={12} color={ts} />{user.email}</div>
              {editDept && <div style={{ color: ts, fontSize: 12, marginTop: 3 }}>{editDept}</div>}
              {editLoc && <div style={{ color: ts, fontSize: 12, marginTop: 3 }}>{editLoc}</div>}
              <div style={{ marginTop: 14, padding: "10px 14px", background: dragging ? `${C.teal}15` : `${C.blue}10`, borderRadius: 10, border: `1.5px dashed ${dragging ? C.teal : ibr}`, textAlign: "center", cursor: "pointer" }} onClick={() => fileRef.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); handlePhoto(e.dataTransfer.files[0]); }}>
                <div style={{ color: dragging ? C.teal : ts, fontSize: 12 }}>{uploading ? "Uploading to Firebase..." : dragging ? "Drop to upload 📸" : "Click or drag photo here"}</div>
              </div>
              {photoUrl && <button onClick={async () => { setPhoto(null); setUser(prev => ({ ...prev, photoUrl: null })); updateDoc(doc(db, "users", user.id), { photoUrl: null }).catch(() => {}); }} style={{ width: "100%", marginTop: 8, padding: "7px", background: `${C.danger}12`, border: `1px solid ${C.danger}30`, borderRadius: 8, cursor: "pointer", color: C.danger, fontSize: 12, fontWeight: 600 }}>Remove Photo</button>}
            </div>
          </div>
          <div style={{ background: bg, borderRadius: 16, border: `1px solid ${bdr}`, padding: "20px" }}>
            <div style={{ color: tp, fontWeight: 700, fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Icon name="analytics" size={16} color={C.teal} /> Task Stats</div>
            {[{ label: "Total Tasks", value: myT.length, color: C.blue }, { label: "Completed", value: done, color: C.success }, { label: "In Progress", value: ong, color: C.teal }, { label: "Completion Rate", value: `${rate}%`, color: rate > 70 ? C.success : rate > 40 ? C.warning : C.danger }].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${dv}` }}>
                <span style={{ color: ts, fontSize: 13 }}>{s.label}</span><span style={{ color: s.color, fontWeight: 700, fontSize: 14 }}>{s.value}</span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: ts, fontSize: 12 }}>Progress</span><span style={{ color: C.teal, fontWeight: 700, fontSize: 12 }}>{rate}%</span></div><PBar value={rate} max={100} /></div>
          </div>
        </div>
        <div style={{ background: bg, borderRadius: 20, border: `1px solid ${bdr}`, padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div><div style={{ color: tp, fontWeight: 800, fontSize: 17 }}>Edit Profile</div><div style={{ color: ts, fontSize: 13, marginTop: 2 }}>Saved to Firestore · syncs everywhere</div></div>
            {saved && <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", background: `${C.success}15`, border: `1px solid ${C.success}40`, borderRadius: 10 }}><Icon name="check" size={15} color={C.success} /><span style={{ color: C.success, fontSize: 13, fontWeight: 600 }}>Saved!</span></div>}
          </div>
          <div style={{ background: `${C.teal}08`, border: `1px solid ${C.teal}25`, borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
            <div style={{ color: tp, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Account Information</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ label: "User ID", value: user.id?.slice(0, 12) + "..." }, { label: "Role", value: user.role }, { label: "Email", value: user.email }, { label: "Team", value: user.teamId || "Not assigned" }].map(i => (
                <div key={i.label}><div style={{ color: ts, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{i.label}</div><div style={{ color: tp, fontSize: 13, fontWeight: 500 }}>{i.value}</div></div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div><label style={lbl}>Full Name *</label><input value={editName} onChange={e => setEN(e.target.value)} placeholder="Your full name" style={inp} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = ibr} /></div>
            <div><label style={lbl}>Phone</label><input value={editPhone} onChange={e => setEP(e.target.value)} placeholder="+1 (555) 000-0000" style={inp} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = ibr} /></div>
            <div><label style={lbl}>Department</label><input value={editDept} onChange={e => setED(e.target.value)} placeholder="e.g. Engineering" style={inp} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = ibr} /></div>
            <div><label style={lbl}>Location</label><input value={editLoc} onChange={e => setEL(e.target.value)} placeholder="City, Country" style={inp} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = ibr} /></div>
          </div>
          <div style={{ marginBottom: 24 }}><label style={lbl}>Bio</label><textarea value={editBio} onChange={e => setEB(e.target.value)} rows={4} placeholder="Tell your team about yourself..." style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = ibr} /></div>
          <div style={{ height: 1, background: dv, marginBottom: 24 }} />
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: tp, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Notification Preferences</div>
            {[{ key: "inviteReceived", label: "Team Invitations", desc: "When you get invited to a team" }, { key: "taskAssigned", label: "Task Assigned", desc: "When a task is assigned to you" }, { key: "taskStatusChange", label: "Status Updates", desc: "When task status changes" }, { key: "emailInvite", label: "Email on Invite", desc: "Send real email when inviting" }, { key: "deadlineReminder", label: "Deadline Reminders", desc: "Alert 24h before deadline" }].map(p => (
              <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${dv}` }}>
                <div><div style={{ color: tp, fontSize: 13, fontWeight: 600 }}>{p.label}</div><div style={{ color: ts, fontSize: 12 }}>{p.desc}</div></div>
                <Toggle on={prefs[p.key]} onChange={v => updatePref(p.key, v)} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={saveProfile} style={{ flex: 1, padding: "13px", background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`, border: "none", borderRadius: 12, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon name="check" size={17} color="#fff" /> Save Changes
            </button>
            <button onClick={() => { setEN(user.name); setEB(user.bio || ""); setEP(user.phone || ""); setED(user.department || ""); setEL(user.location || ""); setPhoto(user.photoUrl || null); }} style={{ padding: "13px 22px", background: ib, border: `1px solid ${ibr}`, borderRadius: 12, cursor: "pointer", color: ts, fontWeight: 600 }}>Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ user, setUser, onLogout, darkMode }) {
  const [sec, setSec] = useState("main");
  const [delPw, setDelPw] = useState("");
  const [delErr, setDelErr] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [pSaved, setPSaved] = useState(false);
  const bg = darkMode ? "#112240" : "#fff"; const bdr = darkMode ? "rgba(255,255,255,0.10)" : C.softGrey;
  const ib = darkMode ? "#0A1628" : C.offWhite; const ibr = darkMode ? "rgba(255,255,255,0.14)" : "#C8D8EC";
  const tp = darkMode ? "#E8F0FF" : C.navy; const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const dv = darkMode ? "rgba(255,255,255,0.07)" : C.softGrey;
  const CONF = "Delete@" + (user.name.split(" ")[0] || "User") + "123";
  const updatePref = (key, val) => { const u = { ...prefs, [key]: val }; setPrefs(u); savePrefs(u); setPSaved(true); setTimeout(() => setPSaved(false), 2000); };

  const handleDelete = async () => {
    setDelErr("");
    if (!delPw) { setDelErr("Enter the confirmation password."); return; }
    if (delPw !== CONF) { setDelErr("Incorrect password."); return; }
    try {
      const tSnap = await import("firebase/firestore").then(({ getDocs, query, collection, where }) => getDocs(query(collection(db, "tasks"), where("managerId", "==", user.id))));
      for (const d of tSnap.docs) await deleteDoc(d.ref);
      const nSnap = await import("firebase/firestore").then(({ getDocs, query, collection, where }) => getDocs(query(collection(db, "notifications"), where("userId", "==", user.id))));
      for (const d of nSnap.docs) await deleteDoc(d.ref);
      await deleteDoc(doc(db, "users", user.id));
    } catch {}
    Object.keys(localStorage).filter(k => k.startsWith("fs_")).forEach(k => localStorage.removeItem(k));
    setDone(true);
    setTimeout(() => { try { signOut(auth); } catch {} setUser(null); }, 2000);
  };

  if (done) return <div style={{ textAlign: "center", padding: "80px 24px" }}><div style={{ fontSize: 48, marginBottom: 16 }}>👋</div><h2 style={{ color: tp, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Account Deleted</h2><p style={{ color: ts, fontSize: 14 }}>All data removed. Redirecting...</p></div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        {sec !== "main" && <button onClick={() => { setSec(sec === "deleteconfirm" ? "yourinfo" : "main"); setDelErr(""); setDelPw(""); }} style={{ background: darkMode ? "rgba(255,255,255,0.06)" : C.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tp} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>}
        <h2 style={{ color: tp, fontSize: 22, fontWeight: 800 }}>{{ main: "Settings", yourinfo: "Your Info", notifications: "Notifications", deleteconfirm: "Delete Account" }[sec] || "Settings"}</h2>
      </div>

      {sec === "main" && (
        <div style={{ background: bg, borderRadius: 16, border: `1px solid ${bdr}`, overflow: "hidden" }}>
          {[{ id: "yourinfo", icon: "user", label: "Your Info", desc: "Account details & team", color: C.blue }, { id: "notifications", icon: "bell", label: "Notifications", desc: "In-app & email alerts", color: C.teal }].map(item => (
            <button key={item.id} onClick={() => setSec(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "transparent", border: "none", borderBottom: `1px solid ${dv}`, cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.04)" : "#f8faff"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={item.icon} size={18} color={item.color} /></div>
              <div style={{ flex: 1 }}><div style={{ color: tp, fontWeight: 600, fontSize: 14 }}>{item.label}</div><div style={{ color: ts, fontSize: 12 }}>{item.desc}</div></div>
              <Icon name="chevronRight" size={16} color={ts} />
            </button>
          ))}
          <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => e.currentTarget.style.background = `${C.danger}08`}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${C.danger}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="logout" size={18} color={C.danger} /></div>
            <div style={{ flex: 1 }}><div style={{ color: C.danger, fontWeight: 600, fontSize: 14 }}>Sign Out</div><div style={{ color: ts, fontSize: 12 }}>Log out of FlowSync</div></div>
          </button>
        </div>
      )}

      {sec === "yourinfo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: bg, borderRadius: 16, border: `1px solid ${bdr}`, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${dv}` }}>
              <Av photoUrl={user.photoUrl} name={user.name} size={56} />
              <div><div style={{ color: tp, fontWeight: 800, fontSize: 17 }}>{user.name}</div><div style={{ color: C.teal, fontSize: 13, textTransform: "capitalize" }}>{user.role}</div><div style={{ color: ts, fontSize: 12 }}>{user.email}</div></div>
            </div>
            {[{ label: "User ID", value: user.id }, { label: "Email", value: user.email }, { label: "Role", value: user.role }, { label: "Team", value: user.teamId || "Not assigned" }, { label: "Department", value: user.department || "—" }, { label: "Location", value: user.location || "—" }].map(i => (
              <div key={i.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${dv}` }}>
                <span style={{ color: ts, fontSize: 13 }}>{i.label}</span><span style={{ color: tp, fontSize: 13, fontWeight: 500, maxWidth: "60%", textAlign: "right", wordBreak: "break-all" }}>{i.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: `${C.teal}08`, borderRadius: 14, border: `1px solid ${C.teal}25`, padding: "16px 20px" }}>
            <div style={{ color: tp, fontWeight: 600, fontSize: 14, marginBottom: 6 }}>☁️ Cloud Storage Active</div>
            <div style={{ color: ts, fontSize: 13, lineHeight: 1.7 }}>Your data is stored in Firebase Firestore and syncs across all devices automatically.</div>
          </div>
          <button onClick={() => setSec("deleteconfirm")} style={{ width: "100%", padding: "14px", background: `${C.danger}10`, border: `1px solid ${C.danger}40`, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Icon name="trash" size={18} color={C.danger} /><span style={{ color: C.danger, fontWeight: 700, fontSize: 15 }}>Delete My Account</span>
          </button>
        </div>
      )}

      {sec === "notifications" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {pSaved && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: `${C.success}12`, border: `1px solid ${C.success}35`, borderRadius: 12 }}><Icon name="check" size={15} color={C.success} /><span style={{ color: C.success, fontSize: 13, fontWeight: 600 }}>Preferences saved</span></div>}
          {[{ title: "In-App Notifications", icon: "bell", color: C.teal, prefs: [{ key: "inviteReceived", label: "Team Invitations", desc: "When someone invites you" }, { key: "inviteAccepted", label: "Invite Accepted", desc: "When your invite is accepted" }, { key: "taskAssigned", label: "Task Assigned", desc: "When a task is assigned to you" }, { key: "taskStatusChange", label: "Status Updates", desc: "When task status changes" }, { key: "deadlineReminder", label: "Deadline Reminders", desc: "24h before task due date" }] }, { title: "Email Notifications", icon: "mail", color: C.blue, prefs: [{ key: "emailInvite", label: "Email on Invite", desc: "Send email when inviting" }, { key: "emailTaskUpdate", label: "Email on Task Update", desc: "Email on task changes" }] }].map(section => (
            <div key={section.title} style={{ background: bg, borderRadius: 16, border: `1px solid ${bdr}`, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${dv}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${section.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={section.icon} size={18} color={section.color} /></div>
                <div style={{ color: tp, fontWeight: 700, fontSize: 14 }}>{section.title}</div>
              </div>
              {section.prefs.map((p, i) => (
                <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < section.prefs.length - 1 ? `1px solid ${dv}` : "none" }}>
                  <div style={{ flex: 1 }}><div style={{ color: tp, fontSize: 13, fontWeight: 600 }}>{p.label}</div><div style={{ color: ts, fontSize: 12 }}>{p.desc}</div></div>
                  <Toggle on={prefs[p.key]} onChange={v => updatePref(p.key, v)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {sec === "deleteconfirm" && (
        <div>
          <div style={{ background: `${C.danger}10`, border: `1px solid ${C.danger}40`, borderRadius: 16, padding: "20px", marginBottom: 20, display: "flex", gap: 14 }}>
            <Icon name="alertTriangle" size={24} color={C.danger} />
            <div><div style={{ color: C.danger, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>This action cannot be undone</div><div style={{ color: ts, fontSize: 13, lineHeight: 1.6 }}>This will delete your account, all tasks, notifications, and data from Firestore.</div></div>
          </div>
          <div style={{ background: bg, borderRadius: 16, border: `1px solid ${bdr}`, padding: "24px" }}>
            <div style={{ background: `${C.blue}10`, border: `1px solid ${C.blue}25`, borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ color: ts, fontSize: 12, marginBottom: 4 }}>Your confirmation password:</div>
              <div style={{ color: C.teal, fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>{CONF}</div>
            </div>
            <label style={{ color: ts, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>Enter confirmation password</label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input type={showPw ? "text" : "password"} value={delPw} onChange={e => { setDelPw(e.target.value); setDelErr(""); }} placeholder="Enter to confirm" style={{ width: "100%", padding: "12px 44px 12px 14px", background: ib, border: `1px solid ${delErr ? C.danger : ibr}`, borderRadius: 10, color: tp, fontSize: 14, outline: "none", boxSizing: "border-box" }} onKeyDown={e => e.key === "Enter" && handleDelete()} />
              <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}><Icon name={showPw ? "eyeOff" : "eye"} size={16} color={ts} /></button>
            </div>
            {delErr && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: `${C.danger}12`, border: `1px solid ${C.danger}30`, borderRadius: 8, marginBottom: 16 }}><Icon name="x" size={14} color={C.danger} /><span style={{ color: C.danger, fontSize: 13 }}>{delErr}</span></div>}
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleDelete} style={{ flex: 1, padding: "13px", background: C.danger, border: "none", borderRadius: 12, cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14 }}>Yes, Delete Everything</button>
              <button onClick={() => { setSec("yourinfo"); setDelPw(""); setDelErr(""); }} style={{ padding: "13px 20px", background: ib, border: `1px solid ${ibr}`, borderRadius: 12, cursor: "pointer", color: ts, fontWeight: 600 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUserRaw] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => { try { return JSON.parse(localStorage.getItem("fs_dark") || "false"); } catch { return false; } });
  const [activeTab, setActiveTabRaw] = useState("dashboard");
  const [tabHistory, setTabHistory] = useState(["dashboard"]);
  const [tasks, setTasks] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap";
    link.rel = "stylesheet"; document.head.appendChild(link);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    // Instantly restore from localStorage so there's no delay
    try {
      const cached = localStorage.getItem("fs_user_cache");
      if (cached) {
        const u = JSON.parse(cached);
        setUserRaw(u);
        setAuthLoading(false); // show app immediately
      }
    } catch {}

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", fbUser.uid));
          if (userDoc.exists()) {
            // Full Firestore data — includes teamId, bio, role, everything
            const u = { ...userDoc.data(), id: fbUser.uid };
            setUserRaw(u);
            localStorage.setItem("fs_user_cache", JSON.stringify(u));
          } else {
            // User in Firebase Auth but not Firestore — show role selector
            // Keep cached version if exists
            const cached = localStorage.getItem("fs_user_cache");
            if (cached) {
              try {
                const cp = JSON.parse(cached);
                if (cp.id === fbUser.uid) setUserRaw(cp);
              } catch {}
            }
          }
        } catch {
          // Firestore failed — keep cached version (already set above)
        }
      } else {
        // Logged out
        try {
          const s = localStorage.getItem("fs_admin");
          if (s) {
            setUserRaw({ id: "admin", name: "Admin", email: ADMIN_EMAIL, avatar: "AD", role: "admin", teamId: null });
          } else {
            // Only clear cache on explicit logout (not on network errors)
            setUserRaw(null);
          }
        } catch {}
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || user.role === "admin") return;
    const unsubs = [];

    // Tasks — manager sees own tasks, employee sees assigned tasks
    try {
      const tq = user.role === "manager"
        ? query(TC(), where("managerId", "==", user.id))
        : query(TC(), where("assignedTo", "array-contains", user.id));
      unsubs.push(onSnapshot(tq, snap => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => console.error("Tasks listener error:", err.message)));
    } catch (e) { console.error("Tasks setup error:", e); }

    // Notifications
    try {
      const nq = query(NC(), where("userId", "==", user.id), orderBy("time", "desc"));
      unsubs.push(onSnapshot(nq, snap => {
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => {
        // If index missing, try without orderBy
        try {
          const nq2 = query(NC(), where("userId", "==", user.id));
          const u2 = onSnapshot(nq2, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
          unsubs.push(u2);
        } catch {}
      }));
    } catch {}

    // Invitations
    try {
      const iq = user.role === "manager"
        ? query(IC(), where("managerId", "==", user.id))
        : query(IC(), where("recipientEmail", "==", user.email));
      unsubs.push(onSnapshot(iq, snap => {
        setInvitations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => console.error("Invitations error:", err.message)));
    } catch {}

    // Team members — load if teamId exists
    if (user.teamId) {
      try {
        const mq = query(collection(db, "users"), where("teamId", "==", user.teamId));
        unsubs.push(onSnapshot(mq, snap => {
          setTeamMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.id !== user.id));
        }, err => console.error("Team members error:", err.message)));
      } catch {}
    } else {
      setTeamMembers([]);
    }

    return () => unsubs.forEach(u => { try { u(); } catch {} });
  }, [user?.id, user?.teamId, user?.role]);

  useEffect(() => {
    if (!user || user.role !== "manager") return;
    const prefs = loadPrefs();
    if (!prefs.deadlineReminder) return;
    const check = () => {
      const now = Date.now();
      tasks.forEach(async t => {
        if (t.status === "completed" || t.reminderSent) return;
        const dt = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline || 0);
        if ((dt - now) / (1000 * 60 * 60 * 24) <= 1 && dt > new Date(now - 86400000)) {
          await updateDoc(doc(db, "tasks", t.id), { reminderSent: true });
          await addDoc(NC(), { type: "deadline", message: `⏰ "${t.title}" is due in less than 24 hours!`, time: serverTimestamp(), read: false, userId: user.id });
        }
      });
    };
    check();
    const iv = setInterval(check, 60 * 60 * 1000);
    return () => clearInterval(iv);
  }, [tasks, user?.id]);

  const setUser = (u) => {
    setUserRaw(u);
    if (u) {
      // Always persist full user to localStorage — survives refresh and re-login
      try { localStorage.setItem("fs_user_cache", JSON.stringify(u)); } catch {}
      if (u.id !== "admin") {
        // Sync to Firestore silently — keeps data consistent across devices
        const firestoreUpdate = {
          name: u.name,
          photoUrl: u.photoUrl || null,
          avatar: u.avatar || ini(u.name),
          teamId: u.teamId || null,
        };
        if (u.bio !== undefined) firestoreUpdate.bio = u.bio;
        if (u.phone !== undefined) firestoreUpdate.phone = u.phone;
        if (u.department !== undefined) firestoreUpdate.department = u.department;
        if (u.location !== undefined) firestoreUpdate.location = u.location;
        try { updateDoc(doc(db, "users", u.id), firestoreUpdate).catch(() => {}); } catch {}
      }
    } else {
      try { localStorage.removeItem("fs_user_cache"); localStorage.removeItem("fs_admin"); } catch {}
    }
  };

  const toggleDark = (v) => { setDarkMode(v); try { localStorage.setItem("fs_dark", JSON.stringify(v)); } catch {}; };

  const setActiveTab = (tab) => {
    setActiveTabRaw(tab);
    setTabHistory(prev => { const next = prev[prev.length - 1] === tab ? prev : [...prev, tab]; return next.slice(-10); });
    window.history.pushState({ tab }, "", window.location.pathname);
  };

  useEffect(() => {
    const handlePop = () => {
      setTabHistory(prev => {
        if (prev.length <= 1) { setActiveTabRaw("dashboard"); return ["dashboard"]; }
        const newH = prev.slice(0, -1); const pt = newH[newH.length - 1]; setActiveTabRaw(pt);
        window.history.pushState({ tab: pt }, "", window.location.pathname); return newH;
      });
    };
    window.addEventListener("popstate", handlePop);
    window.history.pushState({ tab: "dashboard" }, "", window.location.pathname);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const handleLogout = () => {
    try { signOut(auth); } catch {}
    // Clear ALL cached data on explicit logout
    try {
      localStorage.removeItem("fs_admin");
      localStorage.removeItem("fs_user_cache");
      localStorage.removeItem("fs_dark");
      localStorage.removeItem("fs_np");
    } catch {}
    setUserRaw(null);
    setTasks([]); setInvitations([]); setNotifications([]); setTeamMembers([]);
    setActiveTabRaw("dashboard");
    setTabHistory(["dashboard"]);
  };

  const bg = darkMode ? C.navy : C.offWhite;
  const tp = darkMode ? "#E8F0FF" : C.navy;
  const ts = darkMode ? "#7BAAD0" : C.darkGrey;
  const bdr = darkMode ? "rgba(255,255,255,0.08)" : C.softGrey;
  const unread = notifications.filter(n => !n.read).length;
  const desktopW = sidebarCollapsed ? 64 : 240;
  const showBackBtn = tabHistory.length > 1 && activeTab !== "dashboard";
  const tabNames = { tasks: "Tasks", kanban: "Progress", team: "My Team", chat: "Team Chat", analytics: "Analytics", notifications: "Notifications", profile: "Profile", settings: "Settings", mytasks: "My Tasks", inbox: "Inbox", activity: "Activity" };

  if (authLoading) return <Loader msg="Restoring your session..." />;
  if (!user) return <AuthScreen onLogin={u => { setUser(u); setActiveTabRaw("dashboard"); setTabHistory(["dashboard"]); }} />;
  if (user.role === "admin") return <AdminDash onLogout={() => { try { signOut(auth); } catch {} localStorage.removeItem("fs_admin"); setUserRaw(null); }} />;

  const renderContent = () => {
    if (user.role === "manager") {
      switch (activeTab) {
        case "dashboard":     return <MgrDash user={user} tasks={tasks} members={teamMembers} darkMode={darkMode} />;
        case "tasks":         return <TaskList user={user} tasks={tasks} members={teamMembers} darkMode={darkMode} />;
        case "kanban":        return <ProgBoard user={user} tasks={tasks} members={teamMembers} darkMode={darkMode} />;
        case "team":          return <TeamMgmt user={user} invitations={invitations} setInvitations={setInvitations} members={teamMembers} setMembers={setTeamMembers} darkMode={darkMode} />;
        case "chat":          return <Chat user={user} teamId={user.teamId} members={teamMembers} darkMode={darkMode} />;
        case "analytics":     return <Analytics user={user} tasks={tasks} members={teamMembers} darkMode={darkMode} />;
        case "notifications": return <NotifsPanel user={user} notifications={notifications} setNotifications={setNotifications} darkMode={darkMode} />;
        case "profile":       return <ProfileSection user={user} setUser={setUser} tasks={tasks} darkMode={darkMode} />;
        case "settings":      return <SettingsPage user={user} setUser={setUser} onLogout={handleLogout} darkMode={darkMode} />;
        default: return null;
      }
    } else {
      switch (activeTab) {
        case "dashboard":
          return (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ color: tp, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>My Workspace</h1>
                <p style={{ color: ts, fontSize: 14 }}>Welcome back, {user.name.split(" ")[0]} 👋</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[{ label: "My Tasks", value: tasks.length, icon: "tasks", color: C.blue }, { label: "Completed", value: tasks.filter(t => t.status === "completed").length, icon: "check", color: C.success }, { label: "In Progress", value: tasks.filter(t => t.status === "ongoing").length, icon: "activity", color: C.teal }, { label: "Invites", value: invitations.filter(i => i.status === "pending").length, icon: "mail", color: C.warning }].map(s => (
                  <div key={s.label} style={{ background: darkMode ? C.navyL : "#fff", borderRadius: 16, padding: "20px", border: `1px solid ${bdr}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    <div style={{ width: 38, height: 38, background: `${s.color}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Icon name={s.icon} size={18} color={s.color} /></div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                    <div style={{ color: tp, fontWeight: 600, fontSize: 13 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <TaskList user={user} tasks={tasks} members={teamMembers} darkMode={darkMode} />
            </div>
          );
        case "mytasks":       return <TaskList user={user} tasks={tasks} members={teamMembers} darkMode={darkMode} />;
        case "chat":          return <Chat user={user} teamId={user.teamId} members={teamMembers} darkMode={darkMode} />;
        case "inbox":         return <EmployeeInbox user={user} setUser={setUser} invitations={invitations} setInvitations={setInvitations} setNotifications={setNotifications} darkMode={darkMode} />;
        case "activity":      return <ActivityLog user={user} tasks={tasks} darkMode={darkMode} />;
        case "notifications": return <NotifsPanel user={user} notifications={notifications} setNotifications={setNotifications} darkMode={darkMode} />;
        case "profile":       return <ProfileSection user={user} setUser={setUser} tasks={tasks} darkMode={darkMode} />;
        case "settings":      return <SettingsPage user={user} setUser={setUser} onLogout={handleLogout} darkMode={darkMode} />;
        default: return null;
      }
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: bg, fontFamily: "'DM Sans', sans-serif", transition: "background 0.3s" }}>
      <Sidebar user={user} activeTab={activeTab} setActiveTab={setActiveTab} darkMode={darkMode} setDarkMode={toggleDark} onLogout={handleLogout} unread={unread} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} isMobile={isMobile} />
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : desktopW, minHeight: "100vh", display: "flex", flexDirection: "column", transition: "margin-left 0.25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 16px" : "14px 32px", background: darkMode ? C.navyL : "#fff", borderBottom: `1px solid ${bdr}`, position: "sticky", top: 0, zIndex: 50, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {showBackBtn ? (
              <button onClick={() => setTabHistory(prev => { const newH = prev.slice(0, -1); setActiveTabRaw(newH[newH.length - 1] || "dashboard"); return newH; })} style={{ background: darkMode ? "rgba(255,255,255,0.08)" : C.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tp} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            ) : (
              <img src="/logo.png" alt="FS" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            )}
            <span style={{ color: tp, fontWeight: 800, fontSize: isMobile ? 16 : 17 }}>{showBackBtn ? (tabNames[activeTab] || "FlowSync") : "FlowSync"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => toggleDark(!darkMode)} style={{ background: darkMode ? "rgba(255,255,255,0.08)" : C.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name={darkMode ? "sun" : "moon"} size={16} color={tp} /></button>
            {unread > 0 && <button onClick={() => setActiveTab("notifications")} style={{ position: "relative", background: darkMode ? "rgba(255,255,255,0.08)" : C.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Icon name="bell" size={16} color={tp} />
              <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: C.danger, border: `1.5px solid ${darkMode ? C.navyL : "#fff"}` }} />
            </button>}
            {isMobile && <button onClick={() => setMobileMenuOpen(o => !o)} style={{ background: darkMode ? "rgba(255,255,255,0.08)" : C.softGrey, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name={mobileMenuOpen ? "x" : "menu"} size={18} color={tp} /></button>}
          </div>
        </div>
        <div style={{ flex: 1, padding: isMobile ? "20px 16px" : "28px 36px", maxWidth: 1100, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
