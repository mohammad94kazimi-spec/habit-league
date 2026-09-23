// ============================================================
// چالش عادت‌ها — منطق اصلی اپ (وانیلا جاوااسکریپت، بدون فریم‌ورک)
// ============================================================

const cfg = window.APP_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const el = (id) => document.getElementById(id);
const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (n) => String(n).replace(/[0-9]/g, (d) => faDigits[d]);

// ---------- تاریخ شمسی (الگوریتم jalCal مبتنی بر آرایه‌ی breaks — دقیق، تست‌شده) ----------
function div(a, b) { return Math.floor(a / b); }
function mod(a, b) { return a - Math.floor(a / b) * b; }

const JALALI_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy) {
  const bl = JALALI_BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = JALALI_BREAKS[0];
  let jump = 0;
  let i = 1;
  for (; i < bl; i++) {
    const jm = JALALI_BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

// تاریخ میلادی (proleptic Gregorian) <-> شماره‌ی روز پیوسته (JDN)
function g2d(gy, gm, gd) {
  const a = div(14 - gm, 12);
  const y = gy + 4800 - a;
  const m = gm + 12 * a - 3;
  return gd + div(153 * m + 2, 5) + 365 * y + div(y, 4) - div(y, 100) + div(y, 400) - 32045;
}
function d2g(jdn) {
  const a = jdn + 32044;
  const b = div(4 * a + 3, 146097);
  const c = a - div(146097 * b, 4);
  const d = div(4 * c + 3, 1461);
  const e = c - div(1461 * d, 4);
  const m = div(5 * e + 2, 153);
  const gd = e - div(153 * m + 2, 5) + 1;
  const gm = m + 3 - 12 * div(m, 10);
  const gy = 100 * b + d - 4800 + div(m, 10);
  return [gy, gm, gd];
}
function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn) {
  const gy = d2g(jdn)[0];
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm, jd;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return [jy, jm, jd];
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return [jy, jm, jd];
}
function gregorianToJalali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
function jalaliToGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
function isLeapJalaliYear(jy) { return jalCal(jy).leap === 0; }
function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}
function jalaliWeekday(jy, jm, jd) {
  // 0 = شنبه ... 6 = جمعه
  const jdn = j2d(jy, jm, jd);
  return mod(jdn + 2, 7); // ۱ فروردین‌های شناخته‌شده با این افست به شنبه/جمعه درست می‌نشینند
}

const JALALI_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const WEEKDAY_LABELS = ["ش","ی","د","س","چ","پ","ج"];

function formatJalaliToday() {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return `${toFa(jd)} ${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`;
}
function isoToJalaliLabel(iso) {
  if (!iso) return "";
  const [gy, gm, gd] = iso.split("-").map(Number);
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  return `${toFa(jd)} ${JALALI_MONTHS[jm - 1]}`;
}
function jalaliToISO(jy, jm, jd) {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return `${gy.toString().padStart(4, "0")}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}
function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

// ---------- دسته‌بندی کارها (پیش‌فرض‌هایی که فقط برای کاربر تازه ساخته می‌شن) ----------
const DEFAULT_CATEGORIES = [
  { label: "کاری", color: "#5B8DEF" },
  { label: "شخصی", color: "#4FA37A" },
  { label: "خانه", color: "#E3A33B" },
  { label: "سلامت", color: "#C4573F" },
  { label: "مالی", color: "#9B7EDE" },
];
const UNCATEGORIZED = { id: null, label: "بدون دسته", color: "#8A8578" };
function categoryById(id) {
  if (!id) return UNCATEGORIZED;
  return state.categories.find((c) => c.id === id) || UNCATEGORIZED;
}

// ---------- وضعیت کلی اپ ----------
const state = {
  user: null,
  profile: null,
  league: null,
  habits: [],
  entriesByHabit: {}, // habit_id -> {today: row|null, yesterday: row|null}
  todos: [],
  categories: [],
  todoFilter: "all", // "all" | "none" | category id
  leaderboard: [],
  activeTab: "today",
};

function showScreen(name) {
  ["auth", "onboard", "main"].forEach((s) => el(`screen-${s}`).classList.add("hidden"));
  el(`screen-${name}`).classList.remove("hidden");
}

// ============================================================
// آفلاین: صف تغییرات محلی + همگام‌سازی خودکار وقتی اینترنت برگرده
// ============================================================
const OUTBOX_KEY = "habit_league_outbox_v1";
function loadOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch { return []; }
}
function saveOutbox(arr) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(arr)); } catch {}
}
function queueWrite(entry) {
  const outbox = loadOutbox();
  outbox.push(entry);
  saveOutbox(outbox);
  updateSyncBadge();
}
function updateSyncBadge() {
  const badge = el("sync-badge");
  if (!badge) return;
  const n = loadOutbox().length;
  if (!navigator.onLine) {
    badge.textContent = n ? `📴 آفلاین — ${toFa(n)} مورد در انتظار همگام‌سازی` : "📴 حالت آفلاین";
    badge.classList.remove("hidden");
  } else if (n) {
    badge.textContent = `🔄 در حال همگام‌سازی (${toFa(n)} مورد)`;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// تلاش برای ارسال مستقیم به سرور؛ اگه آفلاینی یا شبکه قطع شد، در صف محلی ذخیره می‌کنه
// تا وقتی اینترنت برگرده. اگه خطا واقعاً از سمت سرور باشه (نه قطعی شبکه)، صف نمی‌شه.
async function attemptOrQueue(networkCall, queueEntry) {
  if (!navigator.onLine) {
    queueWrite(queueEntry);
    return { queued: true };
  }
  try {
    const { error } = await networkCall();
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (err) {
    queueWrite(queueEntry);
    return { queued: true };
  }
}

let syncingOutbox = false;
async function syncOutbox() {
  updateSyncBadge();
  if (syncingOutbox || !navigator.onLine || !state.user) return;
  syncingOutbox = true;
  let outbox = loadOutbox();
  let changed = false;
  while (outbox.length) {
    const item = outbox[0];
    try {
      let error;
      if (item.kind === "insert") ({ error } = await sb.from(item.table).insert(item.payload));
      else if (item.kind === "update") ({ error } = await sb.from(item.table).update(item.payload).eq(item.matchColumn, item.matchValue));
      else if (item.kind === "delete") ({ error } = await sb.from(item.table).delete().eq(item.matchColumn, item.matchValue));
      else if (item.kind === "rpc") ({ error } = await sb.rpc(item.fnName, item.fnArgs));
      if (error) throw error;
      outbox.shift();
      changed = true;
    } catch (err) {
      console.error("sync: item failed, retrying later", err);
      break;
    }
  }
  saveOutbox(outbox);
  syncingOutbox = false;
  updateSyncBadge();
  if (changed) {
    await Promise.all([loadHabits(), loadCategories(), loadTodos(), loadLeaderboard()]);
    renderTabs();
  }
}
window.addEventListener("online", syncOutbox);
window.addEventListener("offline", updateSyncBadge);
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncOutbox(); });
setInterval(syncOutbox, 25000);

// انجام‌شده/نشده‌ی یک کار را (خوش‌بینانه + با پشتیبانی آفلاین) تغییر می‌دهد
async function writeTodoDone(todo, doneVal) {
  const prev = todo.done;
  todo.done = doneVal;
  renderTodos();
  renderTodayTasks();
  renderTodoCalendar();
  if (currentDayModalIso && !el("day-tasks-overlay").classList.contains("hidden")) openDayTasks(currentDayModalIso);
  const result = await attemptOrQueue(
    () => sb.from("todos").update({ done: doneVal }).eq("id", todo.id),
    { kind: "update", table: "todos", payload: { done: doneVal }, matchColumn: "id", matchValue: todo.id }
  );
  if (!result.ok && !result.queued) {
    todo.done = prev;
    alert(result.error.message);
    renderTodos();
    renderTodayTasks();
    renderTodoCalendar();
  }
}

// ============================================================
// احراز هویت
// ============================================================
let authMode = "login"; // یا "signup"

function renderAuth() {
  el("auth-title").textContent = authMode === "login" ? "خوش اومدی" : "بساز حساب کاربری";
  el("auth-name-field").classList.toggle("hidden", authMode === "login");
  el("auth-submit").textContent = authMode === "login" ? "ورود" : "ساخت حساب";
  el("auth-toggle").textContent = authMode === "login" ? "حساب نداری؟ بساز" : "قبلاً حساب ساختی؟ وارد شو";
  el("auth-error").textContent = "";
}

el("auth-toggle").addEventListener("click", () => {
  authMode = authMode === "login" ? "signup" : "login";
  renderAuth();
});

el("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = el("auth-email").value.trim();
  const password = el("auth-password").value;
  const name = el("auth-name").value.trim();
  el("auth-error").textContent = "";
  el("auth-submit").disabled = true;
  try {
    if (authMode === "signup") {
      const { error } = await sb.auth.signUp({
        email, password,
        options: { data: { display_name: name || email.split("@")[0] } },
      });
      if (error) throw error;
      el("auth-error").style.color = "var(--teal)";
      el("auth-error").textContent = "ثبت‌نام شد! اگر تایید ایمیل فعال باشد، ایمیلت را چک کن.";
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    el("auth-error").style.color = "var(--clay)";
    el("auth-error").textContent = err.message || "خطایی رخ داد";
  } finally {
    el("auth-submit").disabled = false;
  }
});

el("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
});

// ============================================================
// انتخاب/ساخت لیگ
// ============================================================
el("create-league-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = el("league-name-input").value.trim();
  if (!name) return;
  el("onboard-error").textContent = "";
  try {
    const { error } = await sb.rpc("create_league", { p_name: name });
    if (error) throw error;
    await bootstrapAfterAuth();
  } catch (err) {
    el("onboard-error").textContent = err.message;
  }
});

el("join-league-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = el("league-code-input").value.trim();
  if (!code) return;
  el("onboard-error").textContent = "";
  try {
    const { error } = await sb.rpc("join_league", { p_code: code });
    if (error) throw error;
    await bootstrapAfterAuth();
  } catch (err) {
    el("onboard-error").textContent = err.message;
  }
});

// ============================================================
// تب‌ها
// ============================================================
document.querySelectorAll(".bottom-nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.activeTab = btn.dataset.tab;
    renderTabs();
  });
});

function renderTabs() {
  document.querySelectorAll(".bottom-nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === state.activeTab)
  );
  document.querySelectorAll(".tab-panel").forEach((p) =>
    p.classList.toggle("hidden", p.dataset.panel !== state.activeTab)
  );
  if (state.activeTab === "today") renderToday();
  if (state.activeTab === "habits") renderHabitsList();
  if (state.activeTab === "todos") { renderFilterChips(); renderTodos(); }
  if (state.activeTab === "league") renderLeague();
}

// ============================================================
// بارگذاری داده‌ها
// ============================================================
async function loadHabits() {
  const { data, error } = await sb
    .from("habits")
    .select("*")
    .eq("user_id", state.user.id)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return; }
  state.habits = data || [];

  const ids = state.habits.map((h) => h.id);
  state.entriesByHabit = {};
  if (ids.length) {
    const { data: entries } = await sb
      .from("daily_entries")
      .select("*")
      .in("habit_id", ids)
      .gte("entry_date", isoDaysAgo(1));
    (entries || []).forEach((row) => {
      state.entriesByHabit[row.habit_id] = state.entriesByHabit[row.habit_id] || {};
      if (row.entry_date === todayISO()) state.entriesByHabit[row.habit_id].today = row;
      if (row.entry_date === isoDaysAgo(1)) state.entriesByHabit[row.habit_id].yesterday = row;
    });
  }
}

async function loadCategories() {
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return; }
  if (!data.length) {
    await sb.from("categories").insert(
      DEFAULT_CATEGORIES.map((c) => ({ user_id: state.user.id, label: c.label, color: c.color }))
    );
    const { data: seeded } = await sb
      .from("categories")
      .select("*")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: true });
    state.categories = seeded || [];
    return;
  }
  state.categories = data;
}

async function loadTodos() {
  const { data, error } = await sb
    .from("todos")
    .select("*")
    .eq("user_id", state.user.id)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  state.todos = data || [];
}

async function loadLeague() {
  const { data: members } = await sb
    .from("league_members")
    .select("league_id")
    .eq("user_id", state.user.id)
    .limit(1);
  if (!members || !members.length) { state.league = null; return; }
  const leagueId = members[0].league_id;
  const { data: league } = await sb.from("leagues").select("*").eq("id", leagueId).single();
  state.league = league;
}

async function loadLeaderboard() {
  if (!state.league) return;
  const { data, error } = await sb
    .from("league_leaderboard")
    .select("*")
    .eq("league_id", state.league.id)
    .order("total_points", { ascending: false });
  if (error) { console.error(error); return; }
  state.leaderboard = data || [];
}

// ============================================================
// رندر: امروز
// ============================================================
function streakFor(habit) {
  const e = state.entriesByHabit[habit.id] || {};
  if (e.today) return e.today.streak;
  if (e.yesterday && e.yesterday.success) return e.yesterday.streak;
  return 0;
}

// ---------- تقویم ماهانه‌ی کارها (در صفحه‌ی امروز) ----------
const todoCalState = { jy: 0, jm: 0 };
let currentDayModalIso = null;

function initTodoCalToCurrentMonth() {
  const now = new Date();
  const [jy, jm] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  todoCalState.jy = jy;
  todoCalState.jm = jm;
}

function renderTodoCalendar() {
  el("todo-cal-month-label").textContent = `${JALALI_MONTHS[todoCalState.jm - 1]} ${toFa(todoCalState.jy)}`;
  const grid = el("todo-cal-grid");
  grid.innerHTML = "";
  WEEKDAY_LABELS.forEach((w) => {
    const h = document.createElement("div");
    h.className = "cal-weekday";
    h.textContent = w;
    grid.appendChild(h);
  });
  const firstWeekday = jalaliWeekday(todoCalState.jy, todoCalState.jm, 1);
  for (let i = 0; i < firstWeekday; i++) grid.appendChild(document.createElement("div"));

  const byDate = {};
  state.todos.forEach((t) => {
    if (!t.due_date) return;
    (byDate[t.due_date] = byDate[t.due_date] || []).push(t);
  });

  const len = jalaliMonthLength(todoCalState.jy, todoCalState.jm);
  const todayIso = todayISO();
  for (let d = 1; d <= len; d++) {
    const iso = jalaliToISO(todoCalState.jy, todoCalState.jm, d);
    const dayTodos = byDate[iso] || [];
    const cats = [...new Set(dayTodos.map((t) => t.category_id || "none"))].slice(0, 5);
    const dots = cats.map((cid) => `<span class="cal-dot" style="background:${(cid === "none" ? UNCATEGORIZED : categoryById(cid)).color}"></span>`).join("");
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day cal-day-mini" + (iso === todayIso ? " today" : "");
    cell.innerHTML = `<span>${toFa(d)}</span><span class="cal-dots">${dots}</span>`;
    cell.addEventListener("click", () => openDayTasks(iso));
    grid.appendChild(cell);
  }
}
el("todo-cal-prev").addEventListener("click", () => {
  todoCalState.jm -= 1;
  if (todoCalState.jm < 1) { todoCalState.jm = 12; todoCalState.jy -= 1; }
  renderTodoCalendar();
});
el("todo-cal-next").addEventListener("click", () => {
  todoCalState.jm += 1;
  if (todoCalState.jm > 12) { todoCalState.jm = 1; todoCalState.jy += 1; }
  renderTodoCalendar();
});

function openDayTasks(iso) {
  currentDayModalIso = iso;
  el("day-tasks-title").textContent = isoToJalaliLabel(iso);
  const wrap = el("day-tasks-list");
  wrap.innerHTML = "";
  const dayTodos = state.todos.filter((t) => t.due_date === iso);
  if (!dayTodos.length) {
    wrap.innerHTML = `<div class="empty-state">کاری برای این روز ثبت نشده.</div>`;
    el("day-tasks-overlay").classList.remove("hidden");
    return;
  }
  const groups = {};
  dayTodos.forEach((t) => {
    const key = t.category_id || "none";
    (groups[key] = groups[key] || []).push(t);
  });
  Object.keys(groups).forEach((key) => {
    const cat = key === "none" ? UNCATEGORIZED : categoryById(key);
    const section = document.createElement("div");
    section.style.marginBottom = "10px";
    const label = document.createElement("div");
    label.className = "cat-pill";
    label.style.cssText = `background:${cat.color}22; color:${cat.color}; margin-bottom:6px; display:inline-block;`;
    label.textContent = cat.label;
    section.appendChild(label);
    groups[key].forEach((t) => {
      const row = document.createElement("div");
      row.className = `todo-row ${t.done ? "done" : ""}`;
      row.innerHTML = `
        <button class="todo-check" data-day-toggle="${t.id}">${t.done ? "✓" : ""}</button>
        <div class="todo-body">
          <div class="todo-title">${escapeHtml(t.title)}</div>
          <div class="todo-meta"><span class="priority-pill">${"★".repeat(t.priority)}${"☆".repeat(5 - t.priority)}</span></div>
        </div>`;
      section.appendChild(row);
    });
    wrap.appendChild(section);
  });
  el("day-tasks-overlay").classList.remove("hidden");
}
el("day-tasks-close").addEventListener("click", () => el("day-tasks-overlay").classList.add("hidden"));
el("day-tasks-overlay").addEventListener("click", (e) => {
  if (e.target.id === "day-tasks-overlay") el("day-tasks-overlay").classList.add("hidden");
});
el("day-tasks-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-day-toggle]");
  if (!btn) return;
  const t = state.todos.find((x) => x.id === btn.dataset.dayToggle);
  if (t) await writeTodoDone(t, !t.done);
});

function renderToday() {
  el("today-date").textContent = formatJalaliToday();
  renderTodoCalendar();
  renderTodayTasks();
  const wrap = el("today-list");
  wrap.innerHTML = "";
  if (!state.habits.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">🌱</div>هنوز عادتی اضافه نکردی.<br>از تب «عادت‌ها» یکی بساز.</div>`;
  } else {
    state.habits.forEach((h) => {
      const todayEntry = (state.entriesByHabit[h.id] || {}).today;
      const row = document.createElement("div");
      row.className = "habit-row";
      row.innerHTML = `
        <div class="habit-info">
          <div class="habit-title">${escapeHtml(h.title)}</div>
          <div class="habit-meta">
            <span class="kind-pill ${h.kind === "build" ? "kind-build" : "kind-break"}">${h.kind === "build" ? "ایجاد عادت" : "ترک عادت"}</span>
            <span class="streak">🔥 ${toFa(streakFor(h))} روز</span>
          </div>
        </div>
        <div class="check-buttons">
          <button class="check-btn on-yes ${todayEntry && todayEntry.success ? "selected" : ""}" data-habit="${h.id}" data-success="true">✓</button>
          <button class="check-btn on-no ${todayEntry && !todayEntry.success ? "selected" : ""}" data-habit="${h.id}" data-success="false">✕</button>
        </div>`;
      wrap.appendChild(row);
    });
  }
}

function renderTodayTasks() {
  const wrap = el("today-tasks-list");
  const iso = todayISO();
  const list = state.todos.filter((t) => t.due_date === iso).sort((a, b) => b.priority - a.priority);
  wrap.innerHTML = "";
  if (!list.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:20px 10px;">کاری برای امروز ثبت نشده.</div>`;
    return;
  }
  list.forEach((t) => {
    const cat = categoryById(t.category_id);
    const row = document.createElement("div");
    row.className = `todo-row ${t.done ? "done" : ""}`;
    row.dataset.id = t.id;
    row.innerHTML = `
      <button class="todo-check" data-today-toggle="${t.id}">${t.done ? "✓" : ""}</button>
      <div class="todo-body">
        <div class="todo-title">${escapeHtml(t.title)}</div>
        <div class="todo-meta">
          <span class="cat-pill" style="background:${cat.color}22; color:${cat.color};">${cat.label}</span>
          <span class="priority-pill">${"★".repeat(t.priority)}${"☆".repeat(5 - t.priority)}</span>
        </div>
      </div>`;
    wrap.appendChild(row);
  });
}
el("today-tasks-list").addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest("[data-today-toggle]");
  if (toggleBtn) {
    const t = state.todos.find((x) => x.id === toggleBtn.dataset.todayToggle);
    await writeTodoDone(t, !t.done);
    return;
  }
  const row = e.target.closest(".todo-row");
  if (row) {
    const t = state.todos.find((x) => x.id === row.dataset.id);
    if (t) openEditTodoModal(t);
  }
});

el("today-list").addEventListener("click", async (e) => {
  const btn = e.target.closest(".check-btn");
  if (!btn) return;
  const habitId = btn.dataset.habit;
  const success = btn.dataset.success === "true";
  const date = todayISO();
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return;
  const existing = state.entriesByHabit[habitId] || {};
  const prevToday = existing.today;
  const prevStreak = existing.yesterday && existing.yesterday.success ? existing.yesterday.streak : 0;
  let newStreak, points;
  if (success) {
    newStreak = prevStreak + 1;
    points = habit.base_points + (newStreak % habit.streak_bonus_every === 0 ? habit.streak_bonus_points : 0);
  } else {
    newStreak = 0;
    points = -habit.penalty_points;
  }
  state.entriesByHabit[habitId] = existing;
  state.entriesByHabit[habitId].today = { habit_id: habitId, entry_date: date, success, streak: newStreak, points };
  renderToday();
  const result = await attemptOrQueue(
    () => sb.rpc("record_entry", { p_habit_id: habitId, p_date: date, p_success: success }),
    { kind: "rpc", fnName: "record_entry", fnArgs: { p_habit_id: habitId, p_date: date, p_success: success } }
  );
  if (!result.ok && !result.queued) {
    state.entriesByHabit[habitId].today = prevToday;
    alert(result.error.message);
    renderToday();
  }
});

// ============================================================
// رندر: مدیریت عادت‌ها
// ============================================================
el("add-habit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = el("habit-title-input").value.trim();
  const kind = el("habit-kind-input").value;
  if (!title) return;
  const newHabit = {
    id: crypto.randomUUID(),
    user_id: state.user.id,
    league_id: state.league ? state.league.id : null,
    title, kind,
    base_points: 1, penalty_points: 1, streak_bonus_every: 7, streak_bonus_points: 3,
    archived: false, created_at: new Date().toISOString(),
  };
  state.habits.push(newHabit);
  el("habit-title-input").value = "";
  renderHabitsList();
  const result = await attemptOrQueue(
    () => sb.from("habits").insert(newHabit),
    { kind: "insert", table: "habits", payload: newHabit }
  );
  if (!result.ok && !result.queued) {
    state.habits = state.habits.filter((h) => h.id !== newHabit.id);
    alert(result.error.message);
    renderHabitsList();
  }
});

function renderHabitsList() {
  const wrap = el("habits-manage-list");
  wrap.innerHTML = "";
  if (!state.habits.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">✍️</div>هنوز عادتی نساختی.</div>`;
    return;
  }
  state.habits.forEach((h) => {
    const row = document.createElement("div");
    row.className = "habit-row";
    row.innerHTML = `
      <div class="habit-info">
        <div class="habit-title">${escapeHtml(h.title)}</div>
        <div class="habit-meta">
          <span class="kind-pill ${h.kind === "build" ? "kind-build" : "kind-break"}">${h.kind === "build" ? "ایجاد عادت" : "ترک عادت"}</span>
        </div>
      </div>
      <button class="icon-btn" data-archive="${h.id}" title="بایگانی">🗑</button>`;
    wrap.appendChild(row);
  });
}

el("habits-manage-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-archive]");
  if (!btn) return;
  if (!confirm("این عادت بایگانی شود؟ سابقه‌ی امتیازش حفظ می‌ماند.")) return;
  const habit = state.habits.find((h) => h.id === btn.dataset.archive);
  if (!habit) return;
  state.habits = state.habits.filter((h) => h.id !== habit.id);
  renderHabitsList();
  const result = await attemptOrQueue(
    () => sb.from("habits").update({ archived: true }).eq("id", habit.id),
    { kind: "update", table: "habits", payload: { archived: true }, matchColumn: "id", matchValue: habit.id }
  );
  if (!result.ok && !result.queued) {
    state.habits.push(habit);
    alert(result.error.message);
    renderHabitsList();
  }
});

// ============================================================
// رندر: کارهای شخصی
// ============================================================
el("add-todo-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = el("todo-title-input").value.trim();
  if (!title) return;
  openTodoModal(title);
});

function renderFilterChips() {
  const wrap = el("todo-filter-chips");
  wrap.innerHTML = "";
  const makeChip = (id, label, color) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter-chip" + (state.todoFilter === id ? " selected" : "");
    if (color) chip.style.setProperty("--chip-color", color);
    chip.textContent = label;
    chip.addEventListener("click", () => { state.todoFilter = id; renderTodos(); renderFilterChips(); });
    wrap.appendChild(chip);
  };
  makeChip("all", "همه");
  state.categories.forEach((c) => makeChip(c.id, c.label, c.color));
  makeChip("none", UNCATEGORIZED.label, UNCATEGORIZED.color);
}

function renderTodos() {
  const wrap = el("todos-list");
  wrap.innerHTML = "";
  let list = state.todos;
  if (state.todoFilter === "none") list = list.filter((t) => !t.category_id);
  else if (state.todoFilter !== "all") list = list.filter((t) => t.category_id === state.todoFilter);

  if (!list.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">📋</div>کاری ثبت نشده.</div>`;
    return;
  }
  const sorted = [...list].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority; // اهمیت بیشتر، بالاتر
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
  });
  sorted.forEach((t) => {
    const cat = categoryById(t.category_id);
    const row = document.createElement("div");
    row.className = `todo-row ${t.done ? "done" : ""}`;
    row.dataset.id = t.id;
    row.innerHTML = `
      <button class="todo-check" data-toggle="${t.id}">${t.done ? "✓" : ""}</button>
      <div class="todo-body">
        <div class="todo-title">${escapeHtml(t.title)}</div>
        <div class="todo-meta">
          <span class="cat-pill" style="background:${cat.color}22; color:${cat.color};">${cat.label}</span>
          <span class="priority-pill">${"★".repeat(t.priority)}${"☆".repeat(5 - t.priority)}</span>
          ${t.due_date ? `<span class="todo-date">${isoToJalaliLabel(t.due_date)}</span>` : `<span class="todo-date">بدون تاریخ</span>`}
        </div>
      </div>`;
    wrap.appendChild(row);
  });
}

el("todos-list").addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest("[data-toggle]");
  if (toggleBtn) {
    const t = state.todos.find((x) => x.id === toggleBtn.dataset.toggle);
    if (t) await writeTodoDone(t, !t.done);
    return;
  }
  const row = e.target.closest(".todo-row");
  if (row) {
    const t = state.todos.find((x) => x.id === row.dataset.id);
    if (t) openEditTodoModal(t);
  }
});

// ---------- مودال افزودن/ویرایش کار: دسته‌بندی + اهمیت + تاریخ شمسی (اختیاری) ----------
const todoModalState = { editingId: null, categoryId: null, hasDate: true, selectedISO: "", priority: 3, calJY: 0, calJM: 0 };

function openTodoModal(title) {
  const now = new Date();
  const [jy, jm] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  todoModalState.editingId = null;
  todoModalState.categoryId = state.categories.length ? state.categories[0].id : null;
  todoModalState.hasDate = true;
  todoModalState.selectedISO = todayISO();
  todoModalState.priority = 3;
  todoModalState.calJY = jy;
  todoModalState.calJM = jm;
  el("todo-modal-heading").textContent = "کار تازه";
  el("todo-modal-title-input").value = title;
  el("todo-modal-save").textContent = "ذخیره کار";
  el("todo-modal-delete").classList.add("hidden");
  el("todo-title-input").value = "";
  renderCategoryGrid();
  renderPriorityPicker();
  renderDateToggle();
  renderCalendar();
  el("todo-modal-overlay").classList.remove("hidden");
}

function openEditTodoModal(todo) {
  const baseDate = todo.due_date ? todo.due_date.split("-").map(Number) : null;
  const now = new Date();
  const [jy, jm] = baseDate
    ? gregorianToJalali(baseDate[0], baseDate[1], baseDate[2])
    : gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  todoModalState.editingId = todo.id;
  todoModalState.categoryId = todo.category_id;
  todoModalState.hasDate = !!todo.due_date;
  todoModalState.selectedISO = todo.due_date || todayISO();
  todoModalState.priority = todo.priority;
  todoModalState.calJY = jy;
  todoModalState.calJM = jm;
  el("todo-modal-heading").textContent = "ویرایش کار";
  el("todo-modal-title-input").value = todo.title;
  el("todo-modal-save").textContent = "بروزرسانی کار";
  el("todo-modal-delete").classList.remove("hidden");
  renderCategoryGrid();
  renderPriorityPicker();
  renderDateToggle();
  renderCalendar();
  el("todo-modal-overlay").classList.remove("hidden");
}

function closeTodoModal() {
  el("todo-modal-overlay").classList.add("hidden");
}
el("todo-modal-close").addEventListener("click", closeTodoModal);
el("todo-modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "todo-modal-overlay") closeTodoModal();
});

el("todo-modal-delete").addEventListener("click", async () => {
  if (!todoModalState.editingId) return;
  if (!confirm("این کار حذف بشه؟")) return;
  const id = todoModalState.editingId;
  const removed = state.todos.find((t) => t.id === id);
  state.todos = state.todos.filter((t) => t.id !== id);
  closeTodoModal();
  renderTodos();
  renderTodayTasks();
  renderTodoCalendar();
  const result = await attemptOrQueue(
    () => sb.from("todos").delete().eq("id", id),
    { kind: "delete", table: "todos", matchColumn: "id", matchValue: id }
  );
  if (!result.ok && !result.queued && removed) {
    state.todos.push(removed);
    alert(result.error.message);
    renderTodos();
    renderTodayTasks();
    renderTodoCalendar();
  }
});


function renderCategoryGrid() {
  const wrap = el("todo-category-grid");
  wrap.innerHTML = "";
  state.categories.forEach((c) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cat-chip" + (todoModalState.categoryId === c.id ? " selected" : "");
    chip.style.setProperty("--chip-color", c.color);
    chip.textContent = c.label;
    chip.addEventListener("click", () => {
      todoModalState.categoryId = c.id;
      renderCategoryGrid();
    });
    wrap.appendChild(chip);
  });
  const manageBtn = document.createElement("button");
  manageBtn.type = "button";
  manageBtn.className = "cat-chip manage";
  manageBtn.textContent = "⚙ مدیریت دسته‌ها";
  manageBtn.addEventListener("click", openCategoryManage);
  wrap.appendChild(manageBtn);
}

function renderPriorityPicker() {
  const wrap = el("todo-priority-picker");
  wrap.innerHTML = "";
  for (let p = 1; p <= 5; p++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "priority-btn" + (p <= todoModalState.priority ? " on" : "");
    btn.textContent = "★";
    btn.addEventListener("click", () => {
      todoModalState.priority = p;
      renderPriorityPicker();
    });
    wrap.appendChild(btn);
  }
}

function renderDateToggle() {
  el("todo-nodate-toggle").checked = !todoModalState.hasDate;
  el("cal-section").classList.toggle("disabled", !todoModalState.hasDate);
}
el("todo-nodate-toggle").addEventListener("change", (e) => {
  todoModalState.hasDate = !e.target.checked;
  todoModalState.selectedISO = todoModalState.hasDate ? todayISO() : "";
  renderDateToggle();
  renderCalendar();
});

function renderCalendar() {
  const { calJY, calJM } = todoModalState;
  el("cal-month-label").textContent = `${JALALI_MONTHS[calJM - 1]} ${toFa(calJY)}`;
  const grid = el("cal-grid");
  grid.innerHTML = "";
  WEEKDAY_LABELS.forEach((w) => {
    const h = document.createElement("div");
    h.className = "cal-weekday";
    h.textContent = w;
    grid.appendChild(h);
  });
  const firstWeekday = jalaliWeekday(calJY, calJM, 1);
  for (let i = 0; i < firstWeekday; i++) {
    grid.appendChild(document.createElement("div"));
  }
  const len = jalaliMonthLength(calJY, calJM);
  const todayIso = todayISO();
  for (let d = 1; d <= len; d++) {
    const iso = jalaliToISO(calJY, calJM, d);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day";
    if (iso === todoModalState.selectedISO) cell.classList.add("selected");
    if (iso === todayIso) cell.classList.add("today");
    cell.textContent = toFa(d);
    cell.disabled = !todoModalState.hasDate;
    cell.addEventListener("click", () => {
      todoModalState.selectedISO = iso;
      renderCalendar();
    });
    grid.appendChild(cell);
  }
}

el("cal-prev").addEventListener("click", () => {
  todoModalState.calJM -= 1;
  if (todoModalState.calJM < 1) { todoModalState.calJM = 12; todoModalState.calJY -= 1; }
  renderCalendar();
});
el("cal-next").addEventListener("click", () => {
  todoModalState.calJM += 1;
  if (todoModalState.calJM > 12) { todoModalState.calJM = 1; todoModalState.calJY += 1; }
  renderCalendar();
});

el("todo-modal-save").addEventListener("click", async () => {
  const title = el("todo-modal-title-input").value.trim();
  if (!title) { alert("عنوان کار را بنویس"); return; }
  const payload = {
    title,
    category_id: todoModalState.categoryId,
    priority: todoModalState.priority,
    due_date: todoModalState.hasDate ? todoModalState.selectedISO : null,
  };
  if (todoModalState.editingId) {
    const todo = state.todos.find((t) => t.id === todoModalState.editingId);
    if (!todo) { closeTodoModal(); return; }
    const prev = { ...todo };
    Object.assign(todo, payload);
    closeTodoModal();
    renderTodos(); renderTodayTasks(); renderTodoCalendar();
    const result = await attemptOrQueue(
      () => sb.from("todos").update(payload).eq("id", todo.id),
      { kind: "update", table: "todos", payload, matchColumn: "id", matchValue: todo.id }
    );
    if (!result.ok && !result.queued) {
      Object.assign(todo, prev);
      alert(result.error.message);
      renderTodos(); renderTodayTasks(); renderTodoCalendar();
    }
  } else {
    const newTodo = { id: crypto.randomUUID(), user_id: state.user.id, done: false, created_at: new Date().toISOString(), ...payload };
    state.todos.push(newTodo);
    closeTodoModal();
    renderTodos(); renderTodayTasks(); renderTodoCalendar();
    const result = await attemptOrQueue(
      () => sb.from("todos").insert(newTodo),
      { kind: "insert", table: "todos", payload: newTodo }
    );
    if (!result.ok && !result.queued) {
      state.todos = state.todos.filter((t) => t.id !== newTodo.id);
      alert(result.error.message);
      renderTodos(); renderTodayTasks(); renderTodoCalendar();
    }
  }
});

// ---------- مدیریت دسته‌بندی‌ها (افزودن/ویرایش/حذف) ----------
function openCategoryManage() {
  renderCategoryManageList();
  el("category-manage-overlay").classList.remove("hidden");
}
function closeCategoryManage() {
  el("category-manage-overlay").classList.add("hidden");
  // اگه داخل مودال افزودن کار بودیم، لیست دسته‌ها رو تازه کن
  if (!el("todo-modal-overlay").classList.contains("hidden")) renderCategoryGrid();
}
el("category-manage-close").addEventListener("click", closeCategoryManage);
el("category-manage-overlay").addEventListener("click", (e) => {
  if (e.target.id === "category-manage-overlay") closeCategoryManage();
});
el("manage-categories-btn").addEventListener("click", openCategoryManage);

function renderCategoryManageList() {
  const wrap = el("category-manage-list");
  wrap.innerHTML = "";
  state.categories.forEach((c) => {
    const row = document.createElement("div");
    row.className = "cat-manage-row";
    row.innerHTML = `
      <input type="color" value="${c.color}" data-color="${c.id}" />
      <input type="text" value="${escapeHtml(c.label)}" data-label="${c.id}" />
      <button class="icon-btn" data-del-cat="${c.id}">🗑</button>`;
    wrap.appendChild(row);
  });
}

el("category-manage-list").addEventListener("change", async (e) => {
  const colorInput = e.target.closest("[data-color]");
  const labelInput = e.target.closest("[data-label]");
  let cat, payload;
  if (colorInput) {
    cat = state.categories.find((c) => c.id === colorInput.dataset.color);
    payload = { color: colorInput.value };
  } else if (labelInput) {
    const val = labelInput.value.trim();
    if (!val) return;
    cat = state.categories.find((c) => c.id === labelInput.dataset.label);
    payload = { label: val };
  } else {
    return;
  }
  if (!cat) return;
  const prev = { ...cat };
  Object.assign(cat, payload);
  renderFilterChips();
  renderTodos();
  renderTodayTasks();
  renderTodoCalendar();
  const result = await attemptOrQueue(
    () => sb.from("categories").update(payload).eq("id", cat.id),
    { kind: "update", table: "categories", payload, matchColumn: "id", matchValue: cat.id }
  );
  if (!result.ok && !result.queued) {
    Object.assign(cat, prev);
    alert(result.error.message);
    renderCategoryManageList();
    renderFilterChips();
    renderTodos();
  }
});

el("category-manage-list").addEventListener("click", async (e) => {
  const delBtn = e.target.closest("[data-del-cat]");
  if (!delBtn) return;
  if (!confirm("این دسته‌بندی حذف بشه؟ کارهای این دسته «بدون دسته» می‌شن.")) return;
  const id = delBtn.dataset.delCat;
  const removed = state.categories.find((c) => c.id === id);
  state.categories = state.categories.filter((c) => c.id !== id);
  state.todos.forEach((t) => { if (t.category_id === id) t.category_id = null; });
  renderCategoryManageList();
  renderFilterChips();
  renderTodos();
  renderTodayTasks();
  renderTodoCalendar();
  const result = await attemptOrQueue(
    () => sb.from("categories").delete().eq("id", id),
    { kind: "delete", table: "categories", matchColumn: "id", matchValue: id }
  );
  if (!result.ok && !result.queued && removed) {
    state.categories.push(removed);
    alert(result.error.message);
    renderCategoryManageList();
    renderFilterChips();
  }
});

el("category-add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = el("category-add-label").value.trim();
  const color = el("category-add-color").value;
  if (!label) return;
  const newCat = { id: crypto.randomUUID(), user_id: state.user.id, label, color, created_at: new Date().toISOString() };
  state.categories.push(newCat);
  el("category-add-label").value = "";
  renderCategoryManageList();
  renderFilterChips();
  const result = await attemptOrQueue(
    () => sb.from("categories").insert(newCat),
    { kind: "insert", table: "categories", payload: newCat }
  );
  if (!result.ok && !result.queued) {
    state.categories = state.categories.filter((c) => c.id !== newCat.id);
    alert(result.error.message);
    renderCategoryManageList();
    renderFilterChips();
  }
});

// ============================================================
// رندر: لیگ / جدول امتیازات
// ============================================================
function renderLeague() {
  if (!state.league) return;
  el("league-name").textContent = state.league.name;
  el("league-code").textContent = state.league.invite_code;
  const wrap = el("leaderboard-list");
  wrap.innerHTML = "";
  state.leaderboard.forEach((row, i) => {
    const isMe = row.user_id === state.user.id;
    const line = document.createElement("div");
    line.className = `leader-row ${isMe ? "me" : ""}`;
    line.innerHTML = `
      <div class="rank">${toFa(i + 1)}</div>
      <div class="leader-name">${escapeHtml(row.display_name)}${isMe ? " (خودت)" : ""}</div>
      <div class="leader-points">${toFa(row.total_points)}</div>`;
    wrap.appendChild(line);
  });
}

el("copy-code-btn").addEventListener("click", () => {
  navigator.clipboard.writeText(state.league.invite_code);
  el("copy-code-btn").textContent = "کپی شد!";
  setTimeout(() => (el("copy-code-btn").textContent = "کپی کد دعوت"), 1500);
});

// ============================================================
// راه‌اندازی
// ============================================================
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function bootstrapAfterAuth() {
  // getSession می‌خونه از localStorage و برخلاف getUser نیازی به شبکه نداره —
  // یعنی وقتی آفلاینی هم می‌تونی با نشست قبلی وارد اپ بشی.
  const { data: { session } } = await sb.auth.getSession();
  const user = session ? session.user : null;
  state.user = user;
  if (!user) { showScreen("auth"); return; }

  try {
    await loadLeague();
  } catch (err) {
    console.error("loadLeague failed (احتمالاً آفلاین):", err);
  }
  if (!state.league) {
    if (navigator.onLine) { showScreen("onboard"); return; }
    // آفلاین و بدون لیگ ذخیره‌شده در کش: نمی‌تونیم onboarding آفلاین انجام بدیم
    showScreen("onboard");
    el("onboard-error").textContent = "برای ساخت یا پیوستن به لیگ، اول یک‌بار باید آنلاین باشی.";
    return;
  }
  try {
    await Promise.all([loadHabits(), loadCategories(), loadTodos(), loadLeaderboard()]);
  } catch (err) {
    console.error("بارگذاری داده‌ها ناموفق بود (احتمالاً آفلاین):", err);
  }
  initTodoCalToCurrentMonth();
  showScreen("main");
  renderTabs();
  updateSyncBadge();
  syncOutbox();
}

sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") bootstrapAfterAuth();
  if (event === "SIGNED_OUT") { state.user = null; renderAuth(); showScreen("auth"); }
});

renderAuth();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
