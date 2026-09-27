/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import TimetableSetup from "./components/TimetableSetup";
import HolidaysSetup from "./components/HolidaysSetup";
import SubjectsSetup from "./components/SubjectsSetup";
import Dashboard from "./components/Dashboard";
import {
  saveProfile, createSemester, updateSemester, saveSubjects, saveTimetable,
  saveHolidays, saveWorkingDays, loadSemester, loadSubjects, loadTimetable,
  loadHolidays, loadWorkingDays, loadSpecialWorkingDays, loadAttendance, saveAttendanceRecord, loadClassSessions, loadLatestAmizoneSnapshot, syncAmizoneSnapshot,
} from "./lib/attendanceDb";
import "./App.css";

const EMPTY_SEMESTER = { course: "", semester: "", startDate: "", endDate: "" };
const DEFAULT_WORKING_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [semesterId, setSemesterId] = useState(null);
  const [semester, setSemester] = useState(EMPTY_SEMESTER);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [workingDays, setWorkingDays] = useState(DEFAULT_WORKING_DAYS);
  const [specialWorkingDays, setSpecialWorkingDays] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [classSessions, setClassSessions] = useState([]);
  const [amizoneSnapshot, setAmizoneSnapshot] = useState(null);
  const [syncingAmizone, setSyncingAmizone] = useState(false);
  const [amizoneExtensionReady, setAmizoneExtensionReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data.session?.user ?? null);
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) {
      setStep(0);
      setSemesterId(null);
      setSemester(EMPTY_SEMESTER);
      setSubjects([]);
      setTimetable({});
      setHolidays([]);
      setWorkingDays(DEFAULT_WORKING_DAYS);
      setSpecialWorkingDays([]);
      setAttendanceRecords([]);
      setClassSessions([]);
      setAmizoneSnapshot(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setDataLoading(true);
      setError("");
      try {
        await saveProfile(user, user.user_metadata?.name || "");
        const saved = await loadSemester(user.id);
        if (cancelled) return;
        if (!saved) {
          setStep(0);
          return;
        }
        const savedSubjects = await loadSubjects(saved.id);
        const ids = savedSubjects.map((s) => s.id);
        const [tt, hs, wd, swd, ar] = await Promise.all([
          loadTimetable(ids), loadHolidays(saved.id), loadWorkingDays(saved.id), loadSpecialWorkingDays(saved.id), loadAttendance(ids),
        ]);
        let cs = [];
        let snapshot = null;
        try { cs = await loadClassSessions(saved.id); } catch (e) { console.warn("Amizone class-session tables are not installed yet.", e); }
        try { snapshot = await loadLatestAmizoneSnapshot(saved.id); } catch (e) { console.warn("Amizone snapshot table is not installed yet.", e); }
        if (cancelled) return;
        setSemesterId(saved.id);
        setSemester({ course: saved.course || "", semester: String(saved.semester || ""), startDate: saved.start_date || "", endDate: saved.end_date || "" });
        setSubjects(savedSubjects.map((s) => ({ id: s.id, name: s.name, credits: s.credits, courseCode: s.course_code || "", expectedClasses: s.credits == null ? null : Number(s.credits) * 15 })));
        setTimetable(tt);
        setHolidays(hs);
        setWorkingDays(wd.length ? wd : DEFAULT_WORKING_DAYS);
        setSpecialWorkingDays(swd);
        setAttendanceRecords(ar);
        setClassSessions(cs);
        setAmizoneSnapshot(snapshot);
        setStep(5);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e.message || "Could not load your saved data.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const handleLogout = async () => { await supabase.auth.signOut(); };

  useEffect(() => {
    function handleAmizoneMessage(event) {
      if (event.source !== window || event.data?.source !== "ATTENDLY_AMIZONE_EXTENSION") return;
      if (event.data?.type === "ATTENDLY_EXTENSION_READY") {
        setAmizoneExtensionReady(true);
        return;
      }
      if (event.data?.type === "AMIZONE_SYNC_STARTED") {
        setError("Requesting the latest data from Amizone…");
        return;
      }
      if (event.data?.type === "AMIZONE_SYNC_ERROR") {
        setSyncingAmizone(false);
        setError(event.data.message || "Amizone sync failed. Make sure the Amizone tab is open and logged in.");
        return;
      }
      if (event.data?.type !== "AMIZONE_SNAPSHOT") return;
      const snapshot = event.data?.payload;
      if (!snapshot || !user || !semesterId) return;
      setSyncingAmizone(true);
      window.clearTimeout(window.__attendlyAmizoneSyncTimeout);
      syncAmizoneSnapshot(semesterId, snapshot)
        .then(async (result) => {
          setAmizoneSnapshot({ captured_at: result.syncedAt, payload: snapshot });
          setClassSessions(await loadClassSessions(semesterId));
          setSubjects(result.subjects.map((s) => ({ id: s.id, name: s.name, credits: s.credits, courseCode: s.course_code, expectedClasses: s.credits == null ? null : Number(s.credits) * 15 })));
          setError(`Amizone synced: ${result.importedClasses} classes and ${result.importedAttendanceSubjects} subjects.`);
        })
        .catch((e) => setError(e.message || "Amizone sync failed. Run the sync SQL migration first."))
        .finally(() => setSyncingAmizone(false));
    }
    window.addEventListener("message", handleAmizoneMessage);
    return () => {
      window.clearTimeout(window.__attendlyAmizoneSyncTimeout);
      window.removeEventListener("message", handleAmizoneMessage);
    };
  }, [user, semesterId]);

  const requestAmizoneSync = () => {
    if (!user || !semesterId) return;
    setSyncingAmizone(true);
    setError(
      amizoneExtensionReady
        ? "Requesting the latest data from Amizone…"
        : "Attendly's browser extension is not connected. Load the extension, keep Amizone open and logged in, then try again."
    );
    window.postMessage({ source: "ATTENDLY_WEB", type: "REQUEST_AMIZONE_SYNC" }, "*");
    window.clearTimeout(window.__attendlyAmizoneSyncTimeout);
    window.__attendlyAmizoneSyncTimeout = window.setTimeout(() => {
      setSyncingAmizone(false);
      setError("No Amizone response. Make sure the Attendly extension is installed/reloaded, Amizone is open in another tab, and you are logged in to Amizone.");
    }, 8000);
  };

  const handleSemesterSubmit = async (e) => {
    e.preventDefault();
    if (!semester.course || !semester.semester || !semester.startDate || !semester.endDate) return setError("Please fill in every semester field.");
    if (semester.endDate < semester.startDate) return setError("Semester end date cannot be before the start date.");
    try {
      setError("");
      const saved = semesterId ? await updateSemester(semesterId, semester) : await createSemester(user.id, semester);
      setSemesterId(saved.id);
      setStep(2);
    } catch (e) { setError(e.message || "Could not save the semester."); }
  };

  const handleSubjectsContinue = async () => {
    if (!subjects.length) return setError("Add at least one subject.");
    try { setError(""); await saveSubjects(semesterId, subjects); setStep(3); }
    catch (e) { setError(e.message || "Could not save subjects."); }
  };

  const handleTimetableContinue = async () => {
    try { setError(""); await saveTimetable(subjects, timetable); setStep(4); }
    catch (e) { setError(e.message || "Could not save timetable."); }
  };

  const handleCalendarContinue = async () => {
    try { setError(""); await saveHolidays(semesterId, holidays); await saveWorkingDays(semesterId, workingDays); setStep(5); }
    catch (e) { setError(e.message || "Could not save calendar settings."); }
  };

  const handleAttendance = async (record) => {
    try {
      const saved = await saveAttendanceRecord(record);
      setAttendanceRecords((current) => {
        const exists = current.findIndex((r) => r.id === saved.id || (r.subject_id === saved.subject_id && r.date === saved.date && r.session_number === saved.session_number));
        if (exists === -1) return [...current, saved].sort((a, b) => `${a.date}-${a.session_number}`.localeCompare(`${b.date}-${b.session_number}`));
        const next = [...current]; next[exists] = saved; return next;
      });
    } catch (e) { setError(e.message || "Could not save attendance."); }
  };

  if (authLoading) return <LoadingScreen text="Checking your account…" />;
  if (window.location.pathname === "/reset-password") return <ResetPassword />;
  if (!user) return <Auth onLogin={setUser} />;
  if (dataLoading) return <LoadingScreen text="Syncing your Attendly data…" />;

  return (
    <div className="app-shell">
      {error && <div className="global-error"><span>{error}</span><button onClick={() => setError("")}>×</button></div>}
      {step === 0 && <LandingPage onStart={() => setStep(1)} />}
      {step === 1 && <SemesterSetup semester={semester} onChange={(e) => setSemester((s) => ({ ...s, [e.target.name]: e.target.value }))} onSubmit={handleSemesterSubmit} onBack={() => setStep(0)} />}
      {step === 2 && <SubjectsSetup subjects={subjects} setSubjects={setSubjects} onContinue={handleSubjectsContinue} onBack={() => setStep(1)} />}
      {step === 3 && <TimetableSetup subjects={subjects} timetable={timetable} setTimetable={setTimetable} onContinue={handleTimetableContinue} onBack={() => setStep(2)} />}
      {step === 4 && <HolidaysSetup holidays={holidays} setHolidays={setHolidays} workingDays={workingDays} setWorkingDays={setWorkingDays} specialWorkingDays={specialWorkingDays} setSpecialWorkingDays={setSpecialWorkingDays} onContinue={handleCalendarContinue} onBack={() => setStep(3)} />}
      {step === 5 && <Dashboard semester={semester} subjects={subjects} timetable={timetable} holidays={holidays} workingDays={workingDays} specialWorkingDays={specialWorkingDays} attendanceRecords={attendanceRecords} classSessions={classSessions} amizoneSnapshot={amizoneSnapshot} syncingAmizone={syncingAmizone} amizoneExtensionReady={amizoneExtensionReady} onSyncAmizone={requestAmizoneSync} onAttendance={handleAttendance} onEditSemester={() => setStep(1)} onEditSubjects={() => setStep(2)} onEditTimetable={() => setStep(3)} onEditHolidays={() => setStep(4)} onLogout={handleLogout} />}
    </div>
  );
}

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return <main className="auth-page"><div className="auth-card">
    <div className="brand"><div className="brand-icon">A</div><span>Attendly</span></div>
    <h1>Choose a new password</h1>
    <p>Set a new password for your Attendly account.</p>
    <form onSubmit={async (e) => {
      e.preventDefault(); setError(""); setMessage("");
      if (password.length < 6) return setError("Password must be at least 6 characters.");
      if (password !== confirm) return setError("Passwords do not match.");
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (updateError) setError(updateError.message);
      else { setMessage("Password updated. You can return to Attendly."); window.history.replaceState({}, "", "/"); }
    }}>
      <label>New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
      <label>Confirm password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>
      {error && <div className="auth-error">{error}</div>}
      {message && <div className="auth-message">{message}</div>}
      <button className="primary-button auth-submit" disabled={loading}>{loading ? "Updating…" : "Update password"}</button>
    </form>
  </div></main>;
}

function LoadingScreen({ text }) { return <main className="auth-page"><div className="auth-card"><div className="brand"><div className="brand-icon">A</div><span>Attendly</span></div><div className="spinner" /><p>{text}</p></div></main>; }
function LandingPage({ onStart }) { return <main className="landing"><Nav /><section className="hero"><div className="eyebrow">BUILT FOR AMITY STUDENTS</div><h1>Your attendance,<br /><span>decoded.</span></h1><p>Track attendance, understand your timetable, and know exactly how much leave you can take before it becomes a problem.</p><button className="primary-button" onClick={onStart}>Start planning <span>→</span></button></section><section className="feature-grid"><Feature n="01" t="Live schedule ready" d="Build around your timetable today, or import supported Amizone classes with the browser extension." /><Feature n="02" t="75% intelligence" d="See safe skips, recovery classes and projected attendance instead of doing the maths yourself." /><Feature n="03" t="Historical truth" d="Attendance is stored class-by-class, so timetable changes never rewrite your past." /></section></main>; }
function Nav() { return <nav className="navbar"><Brand /><div className="nav-note"><span className="live-dot" /> attendance intelligence</div></nav>; }
function Brand() { return <div className="brand"><div className="brand-icon">A</div><span>Attendly</span></div>; }
function Feature({ n, t, d }) { return <div className="feature-card"><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></div>; }
function SemesterSetup({ semester, onChange, onSubmit, onBack }) { return <main className="setup-page"><Nav /><div className="setup-container"><div className="setup-heading"><div className="eyebrow">SEMESTER SETUP · 01 / 04</div><h1>Tell us about your semester.</h1><p>This creates the academic container for your timetable and attendance history.</p></div><form className="setup-card" onSubmit={onSubmit}><Field label="Course / Program"><input name="course" value={semester.course} onChange={onChange} placeholder="B.Tech Artificial Intelligence" /></Field><Field label="Semester"><select name="semester" value={semester.semester} onChange={onChange}><option value="">Select semester</option>{Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>Semester {i + 1}</option>)}</select></Field><div className="date-grid"><Field label="Semester starts"><input type="date" name="startDate" value={semester.startDate} onChange={onChange} /></Field><Field label="Semester ends"><input type="date" name="endDate" value={semester.endDate} onChange={onChange} /></Field></div><button className="primary-button full" type="submit">Continue <span>→</span></button></form><button className="back-button" onClick={onBack}>← Back</button></div></main>; }
function Field({ label, children }) { return <label className="form-group"><span>{label}</span>{children}</label>; }
export default App;
