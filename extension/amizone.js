/* global chrome */
const DATE_RE = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i;
const TIME_RE = /\b(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\b/;
const ROOM_RE = /\b[A-Z]{1,4}\d(?:-[A-Z0-9]+)?\b/;
const CODE_RE = /\b[A-Z]{2,8}\d{2,4}\b/;

const clean = (s) => s.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
const norm = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function cleanSubjectName(value) {
  return clean(String(value || ""))
    .replace(/\s+\d{1,3}(?:\.\d+)?%\s*(?:\(\s*\d+\s*\/\s*\d+\s*\))?\s*$/i, "")
    .replace(/\s+\(\s*\)\s*$/g, "")
    .trim();
}

function parseDate(text) {
  const m = text.match(DATE_RE);
  if (!m) return null;
  const d = new Date(m[0]);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseAttendance() {
  const result = [];
  const text = document.body.innerText || "";
  const lines = text.split(/\n+/).map(clean).filter(Boolean);

  // Amizone commonly renders a course line followed by a percentage/ratio line:
  // CSE205 | Programming in Python
  // 96.36% (53/55)
  for (let i = 0; i < lines.length; i++) {
    const codeMatch = lines[i].match(new RegExp(`^(${CODE_RE.source})\\s*\\|?\\s*(.+)$`, "i"));
    if (!codeMatch) continue;
    const code = codeMatch[1].toUpperCase();
    let name = cleanSubjectName(codeMatch[2]);
    if (!name || name.length > 160) continue;

    let ratio = lines[i].match(/(?:\(\s*)?(\d+)\s*\/\s*(\d+)(?:\s*\))?/);
    if (!ratio) {
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const match = lines[j].match(/(?:\(\s*)?(\d+)\s*\/\s*(\d+)(?:\s*\))?/);
        if (match && Number(match[2]) > 0) { ratio = match; break; }
      }
    }
    if (!ratio) continue;

    const item = { code, name, attended: Number(ratio[1]), conducted: Number(ratio[2]) };
    const existing = result.find((x) => x.code === code);
    if (existing) Object.assign(existing, item);
    else result.push(item);
  }

  // Fallback for alternate layouts where course code and ratio share a DOM subtree.
  if (!result.length) {
    document.querySelectorAll("body *").forEach((el) => {
      if (el.children.length > 8) return;
      const text = clean(el.innerText || "");
      const code = text.match(CODE_RE)?.[0];
      const ratio = text.match(/(?:\(\s*)?(\d+)\s*\/\s*(\d+)(?:\s*\))?/);
      if (code && ratio && text.length < 250) {
        const name = cleanSubjectName(text.replace(code, "").replace(ratio[0], ""));
        const existing = result.find((x) => x.code === code);
        if (!existing) result.push({ code, name, attended: Number(ratio[1]), conducted: Number(ratio[2]) });
      }
    });
  }
  return result;
}

function parseClasses(attendance) {
  const attendanceByName = attendance.map((x) => ({ ...x, n: norm(x.name) }));
  const classes = [];
  const date = parseDate(document.body.innerText || "");
  if (!date) return classes;

  document.querySelectorAll("body *").forEach((el) => {
    if (el.children.length > 6) return;
    const text = clean(el.innerText || "");
    const time = text.match(TIME_RE);
    if (!time || text.length < 15 || text.length > 600) return;

    const lines = (el.innerText || "").split(/\n+/).map(clean).filter(Boolean);
    const timeIndex = lines.findIndex((x) => TIME_RE.test(x));
    const details = lines.filter((x, i) => i !== timeIndex && !TIME_RE.test(x));
    const room = details.find((x) => ROOM_RE.test(x))?.match(ROOM_RE)?.[0] || "";
    const withoutRoom = details.filter((x) => x !== room);
    const faculty = withoutRoom.filter((x) => /\[[0-9]+\]/.test(x) || /\bDr\.?\b|\bProf\.?\b|\bMr\.?\b|\bMs\.?\b/i.test(x)).join(" ");
    const titleCandidates = withoutRoom.filter((x) => !/\[[0-9]+\]/.test(x) && !/\bDr\.?\b|\bProf\.?\b|\bMr\.?\b|\bMs\.?\b/i.test(x));
    const title = titleCandidates.sort((a, b) => a.length - b.length)[0] || details[0] || "";
    if (!title) return;

    let matched = attendanceByName.find((x) => norm(title) === x.n);
    if (!matched) matched = attendanceByName.find((x) => norm(title).includes(x.n) || x.n.includes(norm(title)));

    const key = `${date}|${time[1]}|${time[2]}|${matched?.code || title}`;
    if (classes.some((x) => x.key === key)) return;
    classes.push({
      key,
      date,
      startTime: time[1],
      endTime: time[2],
      title,
      subjectCode: matched?.code || "",
      subjectName: matched?.name || title,
      faculty,
      room
    });
  });
  return classes;
}

function snapshot() {
  const attendance = parseAttendance();
  return {
    version: 1,
    source: "amizone",
    capturedAt: new Date().toISOString(),
    attendance,
    classes: parseClasses(attendance),
    page: location.href
  };
}

let last = "";
function sync(force = false) {
  const payload = snapshot();
  const signature = JSON.stringify(payload);
  if (!force && signature === last) return;
  last = signature;
  chrome.runtime.sendMessage({ type: "AMIZONE_SNAPSHOT", payload });
}

sync();
const observer = new MutationObserver(() => sync());
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
setInterval(sync, 30000);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "CAPTURE_AMIZONE_NOW") sync(true);
});
