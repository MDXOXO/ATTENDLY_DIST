import { supabase } from "./supabase";

function cleanImportedSubjectName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+\d{1,3}(?:\.\d+)?%\s*(?:\(\s*\d+\s*\/\s*\d+\s*\))?\s*$/i, "")
    .replace(/\s+\(\s*\)\s*$/g, "")
    .trim();
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function saveProfile(user, name) {
  return run(supabase.from("profiles").upsert({
    id: user.id,
    name: name || user.user_metadata?.name || "",
    email: user.email,
  }));
}

export async function createSemester(userId, semester) {
  return run(supabase.from("semesters").insert({
    user_id: userId,
    course: semester.course,
    semester: semester.semester,
    start_date: semester.startDate,
    end_date: semester.endDate,
    target_attendance: 75,
  }).select().single());
}

export async function updateSemester(id, semester) {
  return run(supabase.from("semesters").update({
    course: semester.course,
    semester: semester.semester,
    start_date: semester.startDate,
    end_date: semester.endDate,
  }).eq("id", id).select().single());
}

export async function saveSubjects(semesterId, subjects) {
  if (!subjects.length) return [];
  return run(supabase.from("subjects").upsert(subjects.map((s) => ({
    id: s.id,
    semester_id: semesterId,
    name: s.name,
    credits: s.credits === null || s.credits === undefined || s.credits === "" ? null : Number(s.credits),
    course_code: s.courseCode || null,
    source: s.source || "manual",
  }))).select());
}

export async function saveTimetable(subjects, timetable) {
  const subjectIds = subjects.map((subject) => subject.id).filter(Boolean);
  if (!subjectIds.length) return [];
  await run(supabase.from("timetable").delete().in("subject_id", subjectIds));
  const rows = [];
  for (const subject of subjects) {
    for (const [day, count] of Object.entries(timetable[subject.id] || {})) {
      const value = Number(count) || 0;
      if (value > 0) rows.push({ subject_id: subject.id, day, class_count: value });
    }
  }
  if (!rows.length) return [];
  return run(supabase.from("timetable").insert(rows).select());
}

export async function saveHolidays(semesterId, holidays) {
  await run(supabase.from("holidays").delete().eq("semester_id", semesterId));
  if (!holidays.length) return [];
  return run(supabase.from("holidays").insert(holidays.map((h) => ({
    semester_id: semesterId,
    date: h.date,
    name: h.name || "Holiday",
  })).filter((h, i, arr) => arr.findIndex((x) => x.date === h.date) === i).sort((a, b) => a.date.localeCompare(b.date))).select());
}

export async function saveWorkingDays(semesterId, workingDays) {
  await run(supabase.from("working_days").delete().eq("semester_id", semesterId));
  if (!workingDays.length) return [];
  return run(supabase.from("working_days").insert(workingDays.map((day) => ({
    semester_id: semesterId,
    day,
  }))).select());
}

export async function loadSpecialWorkingDays(semesterId) {
  return (await run(supabase.from("special_working_days").select("*").eq("semester_id", semesterId).order("date", { ascending: true }))) || [];
}

export async function saveSpecialWorkingDays(semesterId, days) {
  await run(supabase.from("special_working_days").delete().eq("semester_id", semesterId));
  if (!days.length) return [];
  return run(supabase.from("special_working_days").insert(days.map((item) => ({
    semester_id: semesterId,
    date: item.date,
    name: item.name || "Special working day",
  })).filter((item, index, arr) => arr.findIndex((x) => x.date === item.date) === index).sort((a, b) => a.date.localeCompare(b.date))).select());
}

export async function loadSemester(userId) {
  return run(supabase.from("semesters").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle());
}

export async function loadSubjects(semesterId) {
  return (await run(supabase.from("subjects").select("*").eq("semester_id", semesterId).order("created_at", { ascending: true }))) || [];
}

export async function loadTimetable(subjectIds) {
  if (!subjectIds.length) return {};
  const rows = await run(supabase.from("timetable").select("*").in("subject_id", subjectIds));
  return (rows || []).reduce((acc, row) => {
    acc[row.subject_id] ??= {};
    acc[row.subject_id][row.day] = row.class_count;
    return acc;
  }, {});
}

export async function loadHolidays(semesterId) {
  return (await run(supabase.from("holidays").select("*").eq("semester_id", semesterId).order("date", { ascending: true }))) || [];
}

export async function loadWorkingDays(semesterId) {
  const rows = await run(supabase.from("working_days").select("day").eq("semester_id", semesterId));
  return (rows || []).map((r) => r.day);
}

export async function loadAttendance(subjectIds) {
  if (!subjectIds.length) return [];
  return (await run(supabase.from("attendance_records").select("*").in("subject_id", subjectIds).order("date", { ascending: true }))) || [];
}

export async function saveAttendanceRecord({ subjectId, date, sessionNumber, status }) {
  return run(supabase.from("attendance_records").upsert({
    subject_id: subjectId,
    date,
    session_number: sessionNumber,
    status,
  }, { onConflict: "subject_id,date,session_number" }).select().single());
}

export async function deleteAttendanceRecord(id) {
  return run(supabase.from("attendance_records").delete().eq("id", id));
}

export async function loadClassSessions(semesterId) {
  return (await run(supabase.from("class_sessions").select("*").eq("semester_id", semesterId).order("session_date", { ascending: true }).order("start_time", { ascending: true }))) || [];
}

export async function loadLatestAmizoneSnapshot(semesterId) {
  return run(
    supabase.from("amizone_attendance_snapshots")
      .select("*")
      .eq("semester_id", semesterId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
}

export async function syncAmizoneSnapshot(semesterId, snapshot) {
  const attendance = Array.isArray(snapshot?.attendance) ? snapshot.attendance : [];
  const classes = Array.isArray(snapshot?.classes) ? snapshot.classes : [];

  const existing = await loadSubjects(semesterId);
  const byCode = new Map(existing.filter((s) => s.course_code).map((s) => [s.course_code.toUpperCase(), s]));
  const byName = new Map(existing.map((s) => [String(s.name || "").trim().toLowerCase(), s]));

  for (const item of attendance) {
    const code = String(item.code || "").trim().toUpperCase();
    const name = cleanImportedSubjectName(item.name || code || "Imported subject");
    if (!code && !name) continue;
    const current = byCode.get(code) || byName.get(name.toLowerCase());
    const payload = {
      semester_id: semesterId,
      name,
      course_code: code || current?.course_code || null,
      credits: current?.credits ?? null,
      source: "amizone",
    };
    if (current) {
      await run(supabase.from("subjects").update(payload).eq("id", current.id));
    } else {
      const created = await run(supabase.from("subjects").insert(payload).select().single());
      byCode.set(code, created);
      byName.set(name.toLowerCase(), created);
    }
  }

  const refreshedSubjects = await loadSubjects(semesterId);
  const subjectByCode = new Map(refreshedSubjects.filter((s) => s.course_code).map((s) => [s.course_code.toUpperCase(), s]));
  const subjectByName = new Map(refreshedSubjects.map((s) => [String(s.name || "").trim().toLowerCase(), s]));

  const sessionRows = classes.map((item) => {
    const code = String(item.subjectCode || "").trim().toUpperCase();
    const name = cleanImportedSubjectName(item.subjectName || item.title || "");
    const subject = subjectByCode.get(code) || subjectByName.get(name.toLowerCase());
    if (!subject || !item.date || !item.startTime) return null;
    const sourceKey = String(item.key || `${item.date}|${item.startTime}|${item.endTime}|${code || name}`);
    return {
      semester_id: semesterId,
      subject_id: subject.id,
      session_date: item.date,
      start_time: item.startTime,
      end_time: item.endTime || null,
      room: item.room || null,
      faculty: item.faculty || null,
      source: "amizone",
      source_key: sourceKey,
      status: "scheduled",
    };
  }).filter(Boolean);

  if (sessionRows.length) {
    await run(supabase.from("class_sessions").upsert(sessionRows, { onConflict: "semester_id,source_key" }));
  }

  await run(supabase.from("amizone_attendance_snapshots").insert({
    semester_id: semesterId,
    source_url: snapshot.page || "https://s.amizone.net/",
    payload: snapshot,
  }));

  return {
    subjects: refreshedSubjects,
    importedClasses: sessionRows.length,
    importedAttendanceSubjects: attendance.length,
    syncedAt: snapshot.capturedAt || new Date().toISOString(),
  };
}
