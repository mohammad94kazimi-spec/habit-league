// ============================================================
// چالش عادت‌ها — منطق اصلی اپ (وانیلا جاوااسکریپت، بدون فریم‌ورک)
// ============================================================

const cfg = window.APP_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const el = (id) => document.getElementById(id);
const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (n) => String(n).replace(/[0-9]/g, (d) => faDigits[d]);

// ---------- تاریخ شمسی (الگوریتم jalaali استاندارد) ----------
function div(a, b) { return ~~(a / b); }
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; }
  let jm, jd;
  if (days < 186) { jm = 1 + div(days, 31); jd = 1 + (days % 31); }
  else { jm = 7 + div(days - 186, 30); jd = 1 + ((days - 186) % 30); }
  return [jy, jm, jd];
}
const JALALI_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
function formatJalaliToday() {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return `${toFa(jd)} ${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`;
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

// ---------- وضعیت کلی اپ ----------
const state = {
  user: null,
  profile: null,
  league: null,
  habits: [],
  entriesByHabit: {}, // habit_id -> {today: row|null, yesterday: row|null}
  todos: [],
  leaderboard: [],
  activeTab: "today",
};

function showScreen(name) {
  ["auth", "onboard", "main"].forEach((s) => el(`screen-${s}`).classList.add("hidden"));
  el(`screen-${name}`).classList.remove("hidden");
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
  if (state.activeTab === "todos") renderTodos();
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

function renderToday() {
  el("today-date").textContent = formatJalaliToday();
  const wrap = el("today-list");
  wrap.innerHTML = "";
  if (!state.habits.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">🌱</div>هنوز عادتی اضافه نکردی.<br>از تب «عادت‌ها» یکی بساز.</div>`;
    return;
  }
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

el("today-list").addEventListener("click", async (e) => {
  const btn = e.target.closest(".check-btn");
  if (!btn) return;
  const habitId = btn.dataset.habit;
  const success = btn.dataset.success === "true";
  btn.closest(".check-buttons").querySelectorAll(".check-btn").forEach((b) => b.classList.add("disabled"));
  const { error } = await sb.rpc("record_entry", { p_habit_id: habitId, p_date: todayISO(), p_success: success });
  if (error) { alert(error.message); }
  await loadHabits();
  renderToday();
});

// ============================================================
// رندر: مدیریت عادت‌ها
// ============================================================
el("add-habit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = el("habit-title-input").value.trim();
  const kind = el("habit-kind-input").value;
  if (!title) return;
  const { error } = await sb.from("habits").insert({
    user_id: state.user.id,
    league_id: state.league ? state.league.id : null,
    title, kind,
  });
  if (error) { alert(error.message); return; }
  el("habit-title-input").value = "";
  await loadHabits();
  renderHabitsList();
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
  await sb.from("habits").update({ archived: true }).eq("id", btn.dataset.archive);
  await loadHabits();
  renderHabitsList();
});

// ============================================================
// رندر: کارهای شخصی
// ============================================================
el("add-todo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = el("todo-title-input").value.trim();
  if (!title) return;
  const { error } = await sb.from("todos").insert({ user_id: state.user.id, title });
  if (error) { alert(error.message); return; }
  el("todo-title-input").value = "";
  await loadTodos();
  renderTodos();
});

function renderTodos() {
  const wrap = el("todos-list");
  wrap.innerHTML = "";
  if (!state.todos.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">📋</div>کاری ثبت نشده.</div>`;
    return;
  }
  state.todos.forEach((t) => {
    const row = document.createElement("div");
    row.className = `todo-row ${t.done ? "done" : ""}`;
    row.innerHTML = `
      <button class="todo-check" data-toggle="${t.id}">${t.done ? "✓" : ""}</button>
      <div class="todo-title">${escapeHtml(t.title)}</div>
      <button class="icon-btn" data-remove="${t.id}">✕</button>`;
    wrap.appendChild(row);
  });
}

el("todos-list").addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest("[data-toggle]");
  const removeBtn = e.target.closest("[data-remove]");
  if (toggleBtn) {
    const t = state.todos.find((x) => x.id === toggleBtn.dataset.toggle);
    await sb.from("todos").update({ done: !t.done }).eq("id", t.id);
  } else if (removeBtn) {
    await sb.from("todos").delete().eq("id", removeBtn.dataset.remove);
  } else {
    return;
  }
  await loadTodos();
  renderTodos();
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
  const { data: { user } } = await sb.auth.getUser();
  state.user = user;
  if (!user) { showScreen("auth"); return; }

  await loadLeague();
  if (!state.league) {
    showScreen("onboard");
    return;
  }
  await Promise.all([loadHabits(), loadTodos(), loadLeaderboard()]);
  showScreen("main");
  renderTabs();
}

sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") bootstrapAfterAuth();
  if (event === "SIGNED_OUT") { state.user = null; renderAuth(); showScreen("auth"); }
});

renderAuth();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
