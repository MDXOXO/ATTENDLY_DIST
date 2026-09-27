import { useEffect, useMemo, useState } from "react";
import { calculateAttendance, getAdditionalAbsencesAllowed, getRecoveryClassesNeeded, formatPercent } from "../utils/attendance";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function localDateString(date = new Date()) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function dateRange(start, end) {
  const out = []; const d = new Date(`${start}T00:00:00`); const e = new Date(`${end}T00:00:00`);
  while (d <= e) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function fmtDate(value, opts = { day: "numeric", month: "short" }) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", opts); }
function fmtDateTime(value) { if (!value) return "recently"; return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }

function buildSessions({ semester, subjects, timetable, holidays, workingDays, specialWorkingDays = [], throughDate }) {
  if (!semester.startDate || !semester.endDate) return [];
  const end = throughDate < semester.endDate ? throughDate : semester.endDate;
  const holidayDates = new Set(holidays.map((h) => h.date));
  const specialDates = new Set(specialWorkingDays.map((item) => item.date));
  const dates = dateRange(semester.startDate, end);
  const sessions = [];
  for (const date of dates) {
    const dateStr = localDateString(date); const day = DAYS[date.getDay()];
    if ((!workingDays.includes(day) && !specialDates.has(dateStr)) || holidayDates.has(dateStr)) continue;
    for (const subject of subjects) {
      const count = Number(timetable[subject.id]?.[day] || 0);
      for (let n = 1; n <= count; n++) sessions.push({ key: `${subject.id}_${dateStr}_${n}`, subjectId: subject.id, date: dateStr, sessionNumber: n });
    }
  }
  return sessions;
}

export default function Dashboard({ semester, subjects, timetable, holidays, workingDays, specialWorkingDays = [], attendanceRecords, classSessions, amizoneSnapshot, syncingAmizone, amizoneExtensionReady, onSyncAmizone, onAttendance, onEditSemester, onEditSubjects, onEditTimetable, onEditHolidays, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [selectedDate, setSelectedDate] = useState(localDateString());
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const recordsMap = useMemo(() => new Map(attendanceRecords.map((r) => [`${r.subject_id}_${r.date}_${r.session_number}`, r])), [attendanceRecords]);
  const generatedSessions = useMemo(() => buildSessions({ semester, subjects, timetable, holidays, workingDays, specialWorkingDays, throughDate: localDateString() }), [semester, subjects, timetable, holidays, workingDays, specialWorkingDays]);
  const importedSessions = useMemo(() => {
    const ordered = [...(classSessions || [])].sort((a, b) =>
      `${a.session_date}|${a.start_time || ""}|${a.id}`.localeCompare(`${b.session_date}|${b.start_time || ""}|${b.id}`)
    );
    const counters = new Map();
    return ordered.map((s) => {
      const group = `${s.subject_id}|${s.session_date}`;
      const sessionNumber = (counters.get(group) || 0) + 1;
      counters.set(group, sessionNumber);
      return {
        key: `${s.subject_id}_${s.session_date}_${sessionNumber}`,
        sourceKey: s.source_key || s.id,
        subjectId: s.subject_id,
        date: s.session_date,
        sessionNumber,
        startTime: s.start_time,
        endTime: s.end_time,
        room: s.room,
        faculty: s.faculty,
        source: s.source,
        status: s.status,
      };
    });
  }, [classSessions]);
  const sessions = importedSessions.length ? importedSessions : generatedSessions;
  const stats = useMemo(() => {
    const result = {};
    for (const s of subjects) result[s.id] = { conducted: 0, attended: 0, absent: 0 };

    const imported = amizoneSnapshot?.payload?.attendance || [];
    for (const item of imported) {
      const subject = subjects.find((s) => (s.courseCode || s.course_code || "").toUpperCase() === String(item.code || "").toUpperCase())
        || subjects.find((s) => String(s.name || "").trim().toLowerCase() === String(item.name || "").trim().toLowerCase());
      if (!subject) continue;
      result[subject.id] = {
        conducted: Number(item.conducted || 0),
        attended: Number(item.attended || 0),
        absent: Math.max(0, Number(item.conducted || 0) - Number(item.attended || 0)),
      };
    }

    if (!imported.length) {
      for (const record of attendanceRecords) {
        const x = result[record.subject_id];
        if (!x) continue;
        x.conducted++;
        if (record.status === "present") x.attended++; else x.absent++;
      }
      return result;
    }

    const snapshotTime = amizoneSnapshot?.captured_at || amizoneSnapshot?.payload?.capturedAt;
    const snapshotDay = snapshotTime ? new Date(snapshotTime).toISOString().slice(0, 10) : null;
    for (const record of attendanceRecords) {
      // Amizone already contributes historical attendance up to the snapshot date.
      // Only add manually marked sessions after that snapshot to avoid double-counting.
      if (snapshotDay && record.date <= snapshotDay) continue;
      const x = result[record.subject_id];
      if (!x) continue;
      x.conducted++;
      if (record.status === "present") x.attended++; else x.absent++;
    }
    return result;
  }, [subjects, attendanceRecords, amizoneSnapshot]);
  const total = Object.values(stats).reduce((a, x) => ({ conducted: a.conducted + x.conducted, attended: a.attended + x.attended, absent: a.absent + x.absent }), { conducted: 0, attended: 0, absent: 0 });
  const overall = calculateAttendance(total.attended, total.conducted);
  const todaySessions = useMemo(() => sessions.filter((s) => s.date === selectedDate), [sessions, selectedDate]);
  const unmarked = todaySessions.filter((s) => !recordsMap.has(s.key));

  async function mark(session, status) { await onAttendance({ subjectId: session.subjectId, date: session.date, sessionNumber: session.sessionNumber, status }); }

  return <main className="dashboard-page">
    <header className="dashboard-top"><div><div className="brand"><div className="brand-icon">A</div><span>Attendly</span></div><p>{semester.course} · Semester {semester.semester}</p></div><div className="top-actions"><InstallButton /><button className="sync-button" onClick={onSyncAmizone} disabled={syncingAmizone}>{syncingAmizone ? "Syncing…" : "Sync Amizone"}</button><button className="ghost-button" onClick={onEditTimetable}>Timetable</button><button className="ghost-button" onClick={onLogout}>Log out</button></div></header>
    <div className="dashboard-container">
      <section className="welcome-row"><div><span className="eyebrow">ATTENDANCE DASHBOARD</span><h1>Your attendance, decoded.</h1><p>Target: 75% · {semester.startDate && fmtDate(semester.startDate, { day: "numeric", month: "short", year: "numeric" })} → {semester.endDate && fmtDate(semester.endDate, { day: "numeric", month: "short", year: "numeric" })}</p><div className="sync-status">{amizoneSnapshot ? `Amizone synced ${fmtDateTime(amizoneSnapshot.captured_at || amizoneSnapshot.payload?.capturedAt)}` : "Amizone not synced yet"} · {amizoneExtensionReady ? "Extension connected" : "Extension not connected"}</div></div><div className={`overall-ring ${overall < 75 ? "danger" : ""}`}><strong>{formatPercent(overall)}</strong><span>overall</span></div></section>
      <section className="metric-grid"><Metric label="Conducted" value={total.conducted} note="marked classes" /><Metric label="Present" value={total.attended} note="attended" /><Metric label="Absent" value={total.absent} note="missed" /><Metric label="Safe skips" value={getAdditionalAbsencesAllowed(total.attended, total.conducted)} note="overall" /></section>
      <nav className="dashboard-tabs"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button><button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Classes</button><button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>Calendar</button><button className={tab === "simulator" ? "active" : ""} onClick={() => setTab("simulator")}>What if?</button></nav>
      {tab === "overview" && <Overview subjects={subjects} stats={stats} subjectMap={subjectMap} onOpen={() => setTab("today")} />}
      {tab === "today" && <Classes sessions={todaySessions} subjectMap={subjectMap} recordsMap={recordsMap} selectedDate={selectedDate} setSelectedDate={setSelectedDate} mark={mark} unmarked={unmarked} />}
      {tab === "calendar" && <Calendar sessions={sessions} recordsMap={recordsMap} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
      {tab === "simulator" && <Simulator subjects={subjects} stats={stats} />}
      <section className="settings-strip"><button onClick={onEditSemester}>Semester</button><button onClick={onEditSubjects}>Subjects</button><button onClick={onEditTimetable}>Timetable</button><button onClick={onEditHolidays}>Holidays & working days</button></section>
    </div>
  </main>;
}

function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible || !deferredPrompt) return null;

  return <button className="install-button" onClick={async () => {
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
    setVisible(false);
  }}>Install App</button>;
}

function Metric({ label, value, note }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function Overview({ subjects, stats, subjectMap, onOpen }) { return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SUBJECT HEALTH</span><h2>Where you stand</h2></div><button className="text-button" onClick={onOpen}>Mark classes →</button></div><div className="subject-list">{subjects.map((s) => { const x = stats[s.id] || { conducted: 0, attended: 0, absent: 0 }; const pct = calculateAttendance(x.attended, x.conducted); const safe = getAdditionalAbsencesAllowed(x.attended, x.conducted); const recovery = getRecoveryClassesNeeded(x.attended, x.conducted); return <div className="subject-row" key={s.id}><div className="subject-name"><span className={`status-pill ${pct >= 75 ? "safe" : "risk"}`} /> <div><strong>{subjectMap[s.id].name}</strong><small>{x.attended} present · {x.absent} absent · {x.conducted} marked</small></div></div><div className="subject-progress"><div className="progress-track"><span style={{ width: `${Math.min(100, pct)}%` }} /></div><strong>{formatPercent(pct)}</strong></div><div className="subject-action">{pct >= 75 ? `${safe} safe skip${safe === 1 ? "" : "s"}` : `${recovery} to recover`}</div></div>; })}</div></section>; }

function Classes({ sessions, subjectMap, recordsMap, selectedDate, setSelectedDate, mark, unmarked }) { return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CLASS LOG</span><h2>Mark attendance</h2></div><input className="date-picker" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>{unmarked.length > 0 && <div className="notice">{unmarked.length} class{unmarked.length === 1 ? "" : "es"} are waiting for attendance.</div>}<div className="class-list">{sessions.length ? sessions.map((s) => { const r = recordsMap.get(s.key); return <div className="class-row" key={s.key}><div><strong>{subjectMap[s.subjectId]?.name}</strong><small>{fmtDate(s.date)} · {s.startTime ? `${s.startTime}–${s.endTime || ""}` : `Session ${s.sessionNumber}`}{s.room ? ` · ${s.room}` : ""}{s.source === "amizone" ? " · Amizone" : ""}</small></div>{r ? <div className={`marked ${r.status}`}>{r.status === "present" ? "Present" : "Absent"}</div> : <div className="attendance-buttons"><button className="present" onClick={() => mark(s, "present")}>Present</button><button className="absent" onClick={() => mark(s, "absent")}>Absent</button></div>}</div>; }) : <Empty text="No scheduled classes for this date." />}</div></section>; }

function Calendar({ sessions, recordsMap, selectedDate, setSelectedDate }) { const days = useMemo(() => { const unique = [...new Set(sessions.map((s) => s.date))]; return unique.sort().slice(-31); }, [sessions]); return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">HISTORY</span><h2>Attendance calendar</h2></div></div><div className="calendar-grid">{days.map((date) => { const daySessions = sessions.filter((s) => s.date === date); const marked = daySessions.filter((s) => recordsMap.has(s.key)); const present = marked.filter((s) => recordsMap.get(s.key)?.status === "present").length; const absent = marked.filter((s) => recordsMap.get(s.key)?.status === "absent").length; const state = marked.length === 0 ? "pending" : absent ? "bad" : marked.length < daySessions.length ? "partial" : "good"; return <button className={`calendar-day ${state} ${selectedDate === date ? "selected" : ""}`} key={date} onClick={() => setSelectedDate(date)}><strong>{new Date(`${date}T00:00:00`).getDate()}</strong><span>{present}P · {absent}A</span></button>; })}</div><p className="calendar-help">Select a date, then open <b>Classes</b> to edit its sessions.</p></section>; }

function Simulator({ subjects, stats }) { const [addAbsences, setAddAbsences] = useState(1); return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">WHAT IF?</span><h2>If I miss the next classes…</h2></div><div className="sim-control"><button onClick={() => setAddAbsences((v) => Math.max(1, v - 1))}>−</button><strong>{addAbsences}</strong><button onClick={() => setAddAbsences((v) => v + 1)}>+</button></div></div><div className="simulation-list">{subjects.map((s) => { const x = stats[s.id] || { conducted: 0, attended: 0 }; const projected = calculateAttendance(x.attended, x.conducted + addAbsences); return <div className="simulation-row" key={s.id}><div><strong>{s.name}</strong><small>{formatPercent(calculateAttendance(x.attended, x.conducted))} now</small></div><strong className={projected >= 75 ? "safe-text" : "danger-text"}>{formatPercent(projected)}</strong></div>; })}</div><p className="calendar-help">This is a simulation only. It does not change your saved attendance.</p></section>; }
function Empty({ text }) { return <div className="empty-state">{text}</div>; }
