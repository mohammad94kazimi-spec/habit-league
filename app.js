// ============================================================
// چالش عادت‌ها — منطق اصلی اپ (وانیلا جاوااسکریپت، بدون فریم‌ورک)
// ============================================================

const cfg = window.APP_CONFIG;

// ---------- شبکه: timeout + تشخیص «به سرور وصل نیستم» ----------
// مرورگر وقتی وای‌فای وصله خودش رو «آنلاین» می‌دونه، حتی اگه اینترنت فیلتر باشه.
// پس خودمون از روی نتیجه‌ی درخواست‌ها می‌فهمیم سرور در دسترسه یا نه.
const net = { reachable: true };
function setReachable(v) {
  if (net.reachable === v) return;
  net.reachable = v;
  updateSyncBadge();
  if (v) onReconnected();
}
async function timeoutFetch(input, init) {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  const ms = url.includes("/storage/v1/") ? 120000 : url.includes("/auth/v1/") ? 20000 : 12000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const outer = init && init.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  try {
    const res = await fetch(input, { ...(init || {}), signal: ctrl.signal });
    // Service Worker وقتی شبکه جواب نده نسخه‌ی ذخیره‌شده رو با این هدر برمی‌گردونه
    if (res.headers.get("x-sw-cache") === "1") setReachable(false);
    else if (res.status >= 502 && res.status <= 504) setReachable(false);
    else setReachable(true);
    return res;
  } catch (err) {
    setReachable(false);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { global: { fetch: timeoutFetch } });

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
const FULL_WEEKDAY_NAMES = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];

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
// تاریخ «محلی» یک زمان‌مهر (مثل completed_at). تاریخ UTC برای ایران (UTC+۳:۳۰) درست نیست:
// کاری که ساعت ۰۱:۳۰ انجام بشه با UTC به روز قبل می‌رفت.
function localISODate(ts) {
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

// ---------- تولید تاریخ‌های آینده برای کارهای دوره‌ای ----------
function isoToJalali(iso) {
  const [gy, gm, gd] = iso.split("-").map(Number);
  return gregorianToJalali(gy, gm, gd);
}
function addDaysISO(iso, n) {
  const [jy, jm, jd] = isoToJalali(iso);
  const [ny, nm, nd] = d2j(j2d(jy, jm, jd) + n);
  return jalaliToISO(ny, nm, nd);
}
function startOfWeekISO(iso) {
  const [jy, jm, jd] = isoToJalali(iso);
  const wd = jalaliWeekday(jy, jm, jd); // 0=شنبه
  const [ny, nm, nd] = d2j(j2d(jy, jm, jd) - wd);
  return jalaliToISO(ny, nm, nd);
}
// تعداد کل نمونه‌ها = count (شامل اولین). برای الگوی هفتگی، اولین نمونه اولین روزِ انتخاب‌شده‌ی هفته
// در/بعد از تاریخ پایه است (اگه تاریخ پایه خودش اون روز هفته باشه، همون اولین نمونه می‌شه).
function generateRecurrenceDates(baseISO, type, opts, count) {
  const dates = [];
  const [jy0, jm0, jd0] = isoToJalali(baseISO);
  const baseJdn = j2d(jy0, jm0, jd0);
  if (type === "daily") {
    for (let i = 0; i < count; i++) {
      const [jy, jm, jd] = d2j(baseJdn + i);
      dates.push(jalaliToISO(jy, jm, jd));
    }
  } else if (type === "every_n") {
    const n = Math.max(2, opts.n || 2);
    for (let i = 0; i < count; i++) {
      const [jy, jm, jd] = d2j(baseJdn + i * n);
      dates.push(jalaliToISO(jy, jm, jd));
    }
  } else if (type === "weekly") {
    const weekdays = opts.weekdays && opts.weekdays.length ? opts.weekdays : [jalaliWeekday(jy0, jm0, jd0)];
    const maxOffset = count * 7 + 14;
    for (let offset = 0; dates.length < count && offset <= maxOffset; offset++) {
      const [jy, jm, jd] = d2j(baseJdn + offset);
      if (weekdays.includes(jalaliWeekday(jy, jm, jd))) dates.push(jalaliToISO(jy, jm, jd));
    }
  } else if (type === "monthly") {
    for (let i = 0; i < count; i++) {
      let jy = jy0, jm = jm0 + i;
      while (jm > 12) { jm -= 12; jy += 1; }
      const len = jalaliMonthLength(jy, jm);
      dates.push(jalaliToISO(jy, jm, Math.min(jd0, len)));
    }
  }
  return dates;
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
  entriesByHabit: {}, // habit_id -> { "YYYY-MM-DD": row } (فقط دیروز و امروز)
  todos: [],
  categories: [],
  todoFilter: "all", // "all" | "none" | category id
  leaderboard: [],
  leaderboardAt: 0,
  dayISO: "",       // روزی که صفحه براش ساخته شده؛ برای تشخیص عوض‌شدن روز
  booted: false,
  activeTab: "today",
  weekStartISO: "",
  donutRange: 30, // 7 | 30 | 90 | "all"
  heatmapYear: 0,
};

function showScreen(name) {
  ["auth", "onboard", "main"].forEach((s) => el(`screen-${s}`).classList.add("hidden"));
  el(`screen-${name}`).classList.remove("hidden");
}

// ============================================================
// آفلاین: صف تغییرات محلی + همگام‌سازی + ذخیره‌ی محلی وضعیت
// ============================================================
const OUTBOX_KEY = "habit_league_outbox_v1";
const FAILED_KEY = "habit_league_failed_v1";
// صف و ناموفق‌ها برای هر کاربر جدا نگه داشته می‌شن تا با ورود کاربر دیگر روی همین گوشی قاطی نشن
const outboxKey = () => (state.user ? `${OUTBOX_KEY}:${state.user.id}` : OUTBOX_KEY);
const failedKey = () => (state.user ? `${FAILED_KEY}:${state.user.id}` : FAILED_KEY);
function readList(key) {
  try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeList(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
}
function loadOutbox() {
  const list = readList(outboxKey());
  let touched = false;
  list.forEach((it) => { if (!it.qid) { it.qid = crypto.randomUUID(); touched = true; } });
  if (touched) writeList(outboxKey(), list);
  return list;
}
function saveOutbox(arr) { writeList(outboxKey(), arr); }
function queueWrite(entry) {
  const outbox = loadOutbox();
  outbox.push({ ...entry, qid: crypto.randomUUID() });
  saveOutbox(outbox);
  updateSyncBadge();
}
function removeFromOutbox(qid) { saveOutbox(loadOutbox().filter((it) => it.qid !== qid)); }
function loadFailed() { return readList(failedKey()); }
function recordFailure(item, error) {
  const list = loadFailed();
  list.push({ table: item.table || item.fnName, kind: item.kind, message: (error && error.message) || String(error), at: Date.now() });
  writeList(failedKey(), list.slice(-30));
}
// صف نسخه‌های قبلی (بدون پسوند کاربر) به صف همین کاربر منتقل می‌شه
function migrateLegacyOutbox() {
  const legacy = readList(OUTBOX_KEY);
  if (!legacy.length) { try { localStorage.removeItem(OUTBOX_KEY); } catch {} return; }
  saveOutbox(loadOutbox().concat(legacy));
  try { localStorage.removeItem(OUTBOX_KEY); } catch {}
}

function toast(msg, ms = 4500) {
  const t = el("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.add("hidden"), ms);
}

function updateSyncBadge() {
  const badge = el("sync-badge");
  if (!badge) return;
  const n = loadOutbox().length;
  const failed = loadFailed().length;
  let text = "";
  if (!navigator.onLine) text = n ? `📴 آفلاین — ${toFa(n)} مورد در انتظار همگام‌سازی` : "📴 حالت آفلاین";
  else if (!net.reachable) text = n ? `📴 به سرور وصل نیستی — ${toFa(n)} مورد در انتظار` : "📴 به سرور وصل نیستی — داده‌های ذخیره‌شده نمایش داده می‌شن";
  else if (n) text = `🔄 در حال همگام‌سازی (${toFa(n)} مورد)`;
  if (failed) text += `${text ? " · " : ""}⚠ ${toFa(failed)} تغییر ناموفق (لمس کن)`;
  badge.textContent = text;
  badge.classList.toggle("hidden", !text);
  badge.classList.toggle("has-failed", failed > 0);
}
el("sync-badge").addEventListener("click", () => {
  const failed = loadFailed();
  if (!failed.length) return;
  alert("این تغییرات آفلاین روی سرور اعمال نشدن (مثلاً چون مورد مربوطه حذف شده بود):\n" +
    failed.map((f) => `• ${f.table} (${f.kind}): ${f.message}`).join("\n"));
  writeList(failedKey(), []);
  updateSyncBadge();
});

// خطای «موقتی» یعنی مشکل از اتصال/سروره نه از خودِ درخواست؛ باید بعداً دوباره امتحان بشه
function isTransientError(res) {
  const err = res && res.error;
  if (!err) return false;
  const status = typeof res.status === "number" ? res.status : (typeof err.status === "number" ? err.status : null);
  if (status !== null) {
    return status === 0 || status === 408 || status === 429 || (status >= 500 && status <= 504) || (status >= 520 && status <= 527);
  }
  const msg = `${err.name || ""} ${err.message || ""}`.toLowerCase();
  return /failed to fetch|networkerror|network error|load failed|abort|timeout|timed out|fetch failed/.test(msg);
}

// نوشتن‌های در حال ارسال؛ برای اینکه تازه‌سازی همزمان اون‌ها رو از صفحه پاک نکنه
const inflightOps = [];

// تلاش برای ارسال مستقیم به سرور؛ اگه آفلاین/سرور در دسترس نبود یا قبلاً چیزی در صف مونده
// (برای حفظ ترتیب)، در صف محلی ذخیره می‌شه. فقط خطاهای واقعی سرور به کاربر نشون داده می‌شن.
async function attemptOrQueue(networkCall, queueEntry) {
  inflightOps.push(queueEntry);
  try {
    if (!navigator.onLine || !net.reachable || loadOutbox().length > 0) {
      queueWrite(queueEntry);
      syncOutbox();
      return { queued: true };
    }
    let res;
    try {
      res = await networkCall();
    } catch (err) {
      queueWrite(queueEntry);
      return { queued: true };
    }
    if (res && res.error) {
      if (isTransientError(res)) {
        queueWrite(queueEntry);
        return { queued: true };
      }
      return { ok: false, error: res.error };
    }
    return { ok: true };
  } finally {
    const i = inflightOps.indexOf(queueEntry);
    if (i !== -1) inflightOps.splice(i, 1);
    schedulePersist();
  }
}

// شرط‌های تطبیق یک عملیات صف‌شده: یا یک ستون/مقدار ساده، یا چند شرط (matches)
function applyMatches(query, item) {
  if (item.matches) item.matches.forEach(([col, val]) => { query = query.eq(col, val); });
  else query = query.eq(item.matchColumn, item.matchValue);
  return query;
}

// اجرای یک آیتم صف. درج‌ها «upsert بدون تغییر در صورت تکراری» هستن تا اگه بار اول به سرور
// رسیده بود ولی جوابش گم شد، تکرارشون خطای شناسه‌ی تکراری نده و صف رو گیر نندازه.
async function runQueued(item) {
  if (item.kind === "insert") {
    const opts = { onConflict: "id", ignoreDuplicates: true };
    let res = await sb.from(item.table).upsert(item.payload, opts);
    if (res.error && res.error.code === "23503" && item.table === "todos") {
      // دسته‌بندی‌ای که کار بهش اشاره می‌کرد دیگه نیست؛ کار رو «بدون دسته» ذخیره کن
      const strip = (r) => ({ ...r, category_id: null });
      res = await sb.from("todos").upsert(Array.isArray(item.payload) ? item.payload.map(strip) : strip(item.payload), opts);
    }
    return res;
  }
  if (item.kind === "update") return applyMatches(sb.from(item.table).update(item.payload), item);
  if (item.kind === "delete") return applyMatches(sb.from(item.table).delete(), item);
  if (item.kind === "rpc") return sb.rpc(item.fnName, item.fnArgs);
  return { error: { message: "عملیات ناشناخته" }, status: 400 };
}

let syncingOutbox = false;
async function syncOutbox() {
  updateSyncBadge();
  if (syncingOutbox || !navigator.onLine || !state.user) return;
  syncingOutbox = true;
  let changed = false;
  let newFailures = 0;
  try {
    for (;;) {
      // هر دور صف از نو خونده می‌شه تا چیزی که وسط همگام‌سازی اضافه شده گم نشه
      const outbox = loadOutbox();
      if (!outbox.length) break;
      const item = outbox[0];
      let res;
      try { res = await runQueued(item); } catch (err) { res = { error: { message: String(err) }, status: 0 }; }
      if (res && res.error) {
        if (isTransientError(res)) break;      // اتصال نیست؛ ترتیب حفظ می‌شه و بعداً ادامه می‌دیم
        recordFailure(item, res.error);        // خطای دائمی: کنار گذاشته می‌شه تا بقیه‌ی صف گیر نکنه
        newFailures++;
      }
      removeFromOutbox(item.qid);
      changed = true;
    }
  } finally {
    syncingOutbox = false;
  }
  updateSyncBadge();
  if (newFailures) toast(`⚠ ${toFa(newFailures)} تغییر آفلاین روی سرور اعمال نشد. نشان بالای صفحه رو لمس کن.`, 7000);
  if (changed) {
    await refreshAllFromServer();
    renderTabs();
  }
}

// ---------- اعمال دوباره‌ی عملیات صف‌شده روی وضعیت محلی ----------
// وضعیت محلی همیشه = آخرین داده‌ی سرور + تغییراتِ هنوز-ارسال‌نشده. همه‌ی عملیات idempotent هستن.
function rowMatches(row, item) {
  if (item.matches) return item.matches.every(([c, v]) => row[c] === v);
  return row[item.matchColumn] === item.matchValue;
}
function listForTable(table) {
  return table === "todos" ? state.todos : table === "habits" ? state.habits : table === "categories" ? state.categories : null;
}
function applyOpToState(item) {
  if (item.kind === "rpc") {
    if (item.fnName === "record_entry") {
      const { p_habit_id, p_date, p_success } = item.fnArgs;
      const habit = state.habits.find((h) => h.id === p_habit_id);
      if (habit) setEntry(habit.id, p_date, computeEntry(habit, p_date, p_success));
    }
    return;
  }
  const list = listForTable(item.table);
  if (!list) return;
  if (item.kind === "insert") {
    (Array.isArray(item.payload) ? item.payload : [item.payload]).forEach((r) => {
      if (!list.some((x) => x.id === r.id)) list.push({ ...r });
    });
  } else if (item.kind === "update") {
    list.forEach((r) => { if (rowMatches(r, item)) Object.assign(r, item.payload); });
    if (item.table === "habits" && item.payload.archived === true) {
      const keep = list.filter((r) => !r.archived);
      list.length = 0;
      keep.forEach((r) => list.push(r));
    }
  } else if (item.kind === "delete") {
    const keep = list.filter((r) => !rowMatches(r, item));
    list.length = 0;
    keep.forEach((r) => list.push(r));
    if (item.table === "categories") state.todos.forEach((t) => { if (t.category_id === item.matchValue) t.category_id = null; });
  }
}
function applyOutboxToState(ops) { (ops || []).forEach(applyOpToState); }

// ---------- ذخیره‌ی محلی وضعیت (IndexedDB) ----------
const IDB_NAME = "habit_league_db";
const IDB_STORE = "kv";
function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB در دسترس نیست")); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const r = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
const snapshotKey = (uid) => `snapshot:${uid}`;
let persistTimer = null;
function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(saveSnapshotNow, 400);
}
async function saveSnapshotNow() {
  if (!state.user || !state.league || !state.booted) return;
  try {
    await idbSet(snapshotKey(state.user.id), {
      v: 1, savedAt: Date.now(),
      league: state.league, habits: state.habits, categories: state.categories, todos: state.todos,
      entriesByHabit: state.entriesByHabit, leaderboard: state.leaderboard, leaderboardAt: state.leaderboardAt,
    });
  } catch (err) { /* ذخیره‌ی محلی بهترین‌تلاشه */ }
}
async function loadSnapshot(uid) {
  try { const snap = await idbGet(snapshotKey(uid)); return snap && snap.v === 1 ? snap : null; } catch { return null; }
}
function hydrateFromSnapshot(snap) {
  state.league = snap.league;
  state.habits = snap.habits || [];
  state.categories = snap.categories || [];
  state.todos = snap.todos || [];
  state.entriesByHabit = snap.entriesByHabit || {};
  state.leaderboard = snap.leaderboard || [];
  state.leaderboardAt = snap.leaderboardAt || 0;
}

// ---------- اتصال دوباره / تیک دوره‌ای ----------
function onReconnected() {
  if (!state.user || !state.league) return;
  syncOutbox().then(() => refreshAllFromServer()).then(() => renderTabs());
}
async function probeServer() {
  try { await sb.from("categories").select("id").limit(1); } catch (err) { /* وضعیت از روی timeoutFetch ثبت می‌شه */ }
}
function checkDayRollover() {
  const t = todayISO();
  if (!state.user || !state.dayISO || state.dayISO === t) return;
  state.dayISO = t;
  renderTabs();
  refreshAllFromServer().then(() => renderTabs());
}
let lastLeaderboardTry = 0;
async function periodicTick() {
  checkDayRollover();
  if (!state.user) return;
  if (navigator.onLine && !net.reachable) await probeServer();
  await syncOutbox();
  if (state.activeTab === "league" && !document.hidden && Date.now() - lastLeaderboardTry > 45000) refreshLeaderboard();
}
window.addEventListener("online", periodicTick);
window.addEventListener("offline", updateSyncBadge);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  checkDayRollover();
  syncOutbox();
  if (state.activeTab === "league") refreshLeaderboard();
});
setInterval(periodicTick, 25000);

// انجام‌شده/نشده‌ی یک کار را (خوش‌بینانه + با پشتیبانی آفلاین) تغییر می‌دهد
async function writeTodoDone(todo, doneVal) {
  const prevDone = todo.done;
  const prevCompletedAt = todo.completed_at;
  todo.done = doneVal;
  todo.completed_at = doneVal ? new Date().toISOString() : null;
  renderTodos();
  renderCompletedTodos();
  renderTodayTasks();
  renderTodoCalendar();
  if (currentDayModalIso && !el("day-tasks-overlay").classList.contains("hidden")) openDayTasks(currentDayModalIso);
  const result = await attemptOrQueue(
    () => sb.from("todos").update({ done: doneVal, completed_at: todo.completed_at }).eq("id", todo.id),
    { kind: "update", table: "todos", payload: { done: doneVal, completed_at: todo.completed_at }, matchColumn: "id", matchValue: todo.id }
  );
  if (!result.ok && !result.queued) {
    todo.done = prevDone;
    todo.completed_at = prevCompletedAt;
    alert(result.error.message);
    renderTodos();
    renderCompletedTodos();
    renderTodayTasks();
    renderTodoCalendar();
  }
}

// ---------- بستن مودال‌ها با Esc ----------
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!el("todo-modal-overlay").classList.contains("hidden")) { closeTodoModal(); return; }
  if (!el("day-tasks-overlay").classList.contains("hidden")) { el("day-tasks-overlay").classList.add("hidden"); return; }
  if (!el("category-manage-overlay").classList.contains("hidden")) { closeCategoryManage(); return; }
});

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
    if (state.activeTab === "league") refreshLeaderboard(); // جدول امتیاز همیشه موقع باز کردن تب تازه می‌شه
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
  if (state.activeTab === "todos") { renderFilterChips(); renderTodos(); renderCompletedTodos(); }
  if (state.activeTab === "league") renderLeague();
  if (state.activeTab === "stats") renderStats();
}

// ============================================================
// بارگذاری داده‌ها
// ============================================================
// هر loader در صورت خطا state فعلی (مثلاً نسخه‌ی ذخیره‌شده) رو دست‌نخورده می‌ذاره و false برمی‌گردونه.
async function loadHabits() {
  const { data, error } = await sb
    .from("habits")
    .select("*")
    .eq("user_id", state.user.id)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return false; }
  const habits = data || [];
  const entries = {};
  const ids = habits.map((h) => h.id);
  if (ids.length) {
    const r = await sb
      .from("daily_entries")
      .select("*")
      .in("habit_id", ids)
      .gte("entry_date", addDaysISO(todayISO(), -1));
    if (r.error) { console.error(r.error); return false; }
    (r.data || []).forEach((row) => {
      (entries[row.habit_id] = entries[row.habit_id] || {})[row.entry_date] = row;
    });
  }
  state.habits = habits;
  state.entriesByHabit = entries;
  return true;
}

async function loadCategories() {
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return false; }
  if (!data.length) {
    await sb.from("categories").insert(
      DEFAULT_CATEGORIES.map((c) => ({ user_id: state.user.id, label: c.label, color: c.color }))
    );
    const seeded = await sb
      .from("categories")
      .select("*")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: true });
    if (seeded.error) { console.error(seeded.error); return false; }
    state.categories = seeded.data || [];
    return true;
  }
  state.categories = data;
  return true;
}

async function loadTodos() {
  const { data, error } = await sb
    .from("todos")
    .select("*")
    .eq("user_id", state.user.id)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return false; }
  state.todos = data || [];
  return true;
}

// "ok" | "none" (عضو هیچ لیگی نیست) | "error" (به سرور نرسیدیم؛ state دست‌نخورده می‌مونه)
async function loadLeague() {
  const m = await sb.from("league_members").select("league_id").eq("user_id", state.user.id).limit(1);
  if (m.error) { console.error(m.error); return "error"; }
  if (!m.data || !m.data.length) { state.league = null; return "none"; }
  const l = await sb.from("leagues").select("*").eq("id", m.data[0].league_id).single();
  if (l.error) { console.error(l.error); return "error"; }
  state.league = l.data;
  return "ok";
}

async function loadLeaderboard() {
  if (!state.league) return true;
  const { data, error } = await sb
    .from("league_leaderboard")
    .select("*")
    .eq("league_id", state.league.id)
    .order("total_points", { ascending: false });
  if (error) { console.error(error); return false; }
  state.leaderboard = data || [];
  if (net.reachable) state.leaderboardAt = Date.now(); // اگه از کشِ آفلاین اومده باشه «تازه» حساب نمی‌شه
  return true;
}

// همه‌ی داده‌ها رو از سرور می‌گیره و بعد تغییراتِ هنوز-ارسال‌نشده (صف + در حال ارسال) رو روش اعمال می‌کنه
let refreshing = null;
function refreshAllFromServer() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      if (!state.user || !state.league) return false;
      const results = await Promise.all([loadHabits(), loadCategories(), loadTodos(), loadLeaderboard()]);
      applyOutboxToState(loadOutbox().concat(inflightOps));
      schedulePersist();
      return results.every(Boolean);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// فقط جدول امتیازها (تب لیگ)
async function refreshLeaderboard() {
  if (!state.league || !state.user) return false;
  lastLeaderboardTry = Date.now();
  const ok = await loadLeaderboard();
  if (ok) schedulePersist();
  if (state.activeTab === "league") renderLeague();
  return ok;
}

// ============================================================
// رندر: امروز
// ============================================================
// ثبت‌های عادت‌ها با «تاریخ» کلید می‌خورن (نه «امروز/دیروز»)، پس با عوض‌شدن روز خودبه‌خود درست می‌مونن
function entryOn(habitId, iso) {
  const m = state.entriesByHabit[habitId];
  return m ? m[iso] || null : null;
}
function setEntry(habitId, iso, row) {
  (state.entriesByHabit[habitId] = state.entriesByHabit[habitId] || {})[iso] = row;
}
function clearEntry(habitId, iso) {
  if (state.entriesByHabit[habitId]) delete state.entriesByHabit[habitId][iso];
}
// همون محاسبه‌ی تابع record_entry در دیتابیس (برای نمایش فوریِ خوش‌بینانه)
function computeEntry(habit, iso, success) {
  const prev = entryOn(habit.id, addDaysISO(iso, -1));
  const prevStreak = prev && prev.success ? prev.streak : 0;
  let streak, points;
  if (success) {
    streak = prevStreak + 1;
    points = habit.base_points + (streak % habit.streak_bonus_every === 0 ? habit.streak_bonus_points : 0);
  } else {
    streak = 0;
    points = -habit.penalty_points;
  }
  return { habit_id: habit.id, entry_date: iso, success, streak, points };
}
function streakFor(habit) {
  const t = entryOn(habit.id, todayISO());
  if (t) return t.streak;
  const y = entryOn(habit.id, addDaysISO(todayISO(), -1));
  return y && y.success ? y.streak : 0;
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
    const allDone = dayTodos.length > 0 && dayTodos.every((t) => t.done);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day cal-day-mini" + (iso === todayIso ? " today" : "") + (allDone ? " cal-day-complete" : "");
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
      row.dataset.id = t.id;
      if (t.description) row.title = t.description;
      row.innerHTML = `
        <button class="todo-check" data-day-toggle="${t.id}">${t.done ? "✓" : ""}</button>
        <div class="todo-body">
          <div class="todo-title">${escapeHtml(t.title)}</div>
          <div class="todo-meta"><span class="priority-pill">${"★".repeat(t.priority)}${"☆".repeat(5 - t.priority)}</span>${audioBadge(t)}</div>
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
  if (btn) {
    const t = state.todos.find((x) => x.id === btn.dataset.dayToggle);
    if (t) await writeTodoDone(t, !t.done);
    return;
  }
  const row = e.target.closest(".todo-row");
  if (row) {
    const t = state.todos.find((x) => x.id === row.dataset.id);
    if (t) {
      // مودال ویرایش باید روی صفحه بیاد، پس مودال لیست روز بسته می‌شه
      el("day-tasks-overlay").classList.add("hidden");
      openEditTodoModal(t);
    }
  }
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
      const todayEntry = entryOn(h.id, todayISO());
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
    if (t.description) row.title = t.description;
    row.innerHTML = `
      <button class="todo-check" data-today-toggle="${t.id}">${t.done ? "✓" : ""}</button>
      <div class="todo-body">
        <div class="todo-title">${escapeHtml(t.title)}</div>
        <div class="todo-meta">
          <span class="cat-pill" style="background:${cat.color}22; color:${cat.color};">${cat.label}</span>
          <span class="priority-pill">${"★".repeat(t.priority)}${"☆".repeat(5 - t.priority)}</span>
          ${t.due_time ? `<span class="todo-date">${toFa(t.due_time.split(":")[0])}:${toFa(t.due_time.split(":")[1])}</span>` : ""}
          ${audioBadge(t)}
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
  const prevEntry = entryOn(habitId, date);
  setEntry(habitId, date, computeEntry(habit, date, success));
  renderToday();
  const result = await attemptOrQueue(
    () => sb.rpc("record_entry", { p_habit_id: habitId, p_date: date, p_success: success }),
    { kind: "rpc", fnName: "record_entry", fnArgs: { p_habit_id: habitId, p_date: date, p_success: success } }
  );
  if (!result.ok && !result.queued) {
    if (prevEntry) setEntry(habitId, date, prevEntry); else clearEntry(habitId, date);
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

function formatDueLabel(t) {
  if (!t.due_date) return "بدون تاریخ";
  let label = isoToJalaliLabel(t.due_date);
  if (t.due_time) {
    const [h, m] = t.due_time.split(":");
    label += `، ${toFa(h)}:${toFa(m)}`;
  }
  return label;
}

// نشان کوچک برای کارهایی که فایل صوتی ضمیمه دارن
function audioBadge(t) {
  return t.audio_path ? `<span class="todo-date" title="${escapeHtml(t.audio_name || "فایل صوتی")}">🎧</span>` : "";
}

function renderTodos() {
  const wrap = el("todos-list");
  wrap.innerHTML = "";
  const cutoff = addDaysISO(todayISO(), 6); // نهایت ۷ روز آینده (امروز تا ۶ روز بعد) + کارهای عقب‌افتاده و بدون‌تاریخ
  let list = state.todos.filter((t) => !t.done);
  if (state.todoFilter === "none") list = list.filter((t) => !t.category_id);
  else if (state.todoFilter !== "all") list = list.filter((t) => t.category_id === state.todoFilter);

  // از هر کار دوره‌ای فقط نزدیک‌ترین نمونه‌ی انجام‌نشده نشون داده می‌شه تا لیست شلوغ نشه
  const firstOfGroup = new Map();
  list.forEach((t) => {
    if (!t.recurrence_group) return;
    const cur = firstOfGroup.get(t.recurrence_group);
    if (!cur || (t.due_date || "9999") < (cur.due_date || "9999")) firstOfGroup.set(t.recurrence_group, t);
  });
  list = list.filter((t) => !t.recurrence_group || firstOfGroup.get(t.recurrence_group) === t);
  list = list.filter((t) => !t.due_date || t.due_date <= cutoff);

  if (!list.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">📋</div>کاری ثبت نشده.</div>`;
    return;
  }
  const sorted = [...list].sort((a, b) => {
    if (!a.due_date && !b.due_date) return b.priority - a.priority;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    return b.priority - a.priority; // در یک تاریخ یکسان، اهمیت بیشتر بالاتر
  });
  sorted.forEach((t) => {
    const cat = categoryById(t.category_id);
    const more = t.recurrence_group
      ? state.todos.filter((x) => x.recurrence_group === t.recurrence_group && !x.done).length - 1
      : 0;
    const row = document.createElement("div");
    row.className = `todo-row ${t.done ? "done" : ""}`;
    row.dataset.id = t.id;
    if (t.description) row.title = t.description;
    row.innerHTML = `
      <button class="todo-check" data-toggle="${t.id}">${t.done ? "✓" : ""}</button>
      <div class="todo-body">
        <div class="todo-title">${escapeHtml(t.title)}</div>
        <div class="todo-meta">
          <span class="cat-pill" style="background:${cat.color}22; color:${cat.color};">${cat.label}</span>
          <span class="priority-pill">${"★".repeat(t.priority)}${"☆".repeat(5 - t.priority)}</span>
          <span class="todo-date">${formatDueLabel(t)}</span>
          ${t.recurrence_group ? `<span class="todo-date">🔁${more > 0 ? ` ${toFa(more)} تکرار دیگر` : ""}</span>` : ""}
          ${audioBadge(t)}
        </div>
      </div>`;
    wrap.appendChild(row);
  });
}

function renderCompletedTodos() {
  const completed = state.todos.filter((t) => t.done).sort((a, b) => {
    const av = a.completed_at || "", bv = b.completed_at || "";
    return av < bv ? 1 : av > bv ? -1 : 0;
  });
  el("completed-section-title").textContent = `کارهای انجام‌شده (${toFa(completed.length)})`;
  const wrap = el("completed-todos-list");
  wrap.innerHTML = "";
  if (!completed.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:16px 10px;">هنوز کاری انجام نشده.</div>`;
    return;
  }
  completed.forEach((t) => {
    const cat = categoryById(t.category_id);
    const row = document.createElement("div");
    row.className = "todo-row completed-row done";
    row.dataset.id = t.id;
    if (t.description) row.title = t.description;
    row.innerHTML = `
      <button class="todo-check" data-toggle="${t.id}">✓</button>
      <div class="todo-body">
        <div class="todo-title">${escapeHtml(t.title)}</div>
        <div class="todo-meta">
          <span class="cat-pill" style="background:${cat.color}22; color:${cat.color};">${cat.label}</span>
          ${t.completed_at ? `<span class="completed-date">انجام شد: ${isoToJalaliLabel(localISODate(t.completed_at))}</span>` : ""}
          ${audioBadge(t)}
        </div>
      </div>`;
    wrap.appendChild(row);
  });
}
el("completed-toggle-btn").addEventListener("click", () => {
  const wrap = el("completed-todos-list");
  const nowHidden = wrap.classList.toggle("hidden");
  el("completed-toggle-btn").textContent = nowHidden ? "نمایش" : "پنهان کردن";
});
el("completed-todos-list").addEventListener("click", async (e) => {
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

// ---------- مودال افزودن/ویرایش کار: دسته‌بندی + اهمیت + تاریخ و زمان شمسی (اختیاری) ----------
const todoModalState = {
  editingId: null, categoryId: null, hasDate: false, selectedISO: "", priority: 3, calJY: 0, calJM: 0,
  hasTime: false, timeHour: 9, timeMinute: 0,
  scope: "single", // "single" | "all" (فقط موقع ویرایش یک کار دوره‌ای)
  recurring: false, recurType: "daily", recurWeekdays: [], recurN: 2, recurCount: 8,
  hasDescription: false,
  audioFile: null,      // فایلی که توی همین مودال انتخاب شده و هنوز آپلود نشده
  audioExisting: null,  // {path, name} فایل ضمیمه‌ی فعلیِ کار (موقع ویرایش)
  audioRemoved: false,  // کاربر فایل فعلی رو حذف کرده
};

// ---------- فایل صوتی ضمیمه ----------
const AUDIO_BUCKET = "task-audio";
const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MIME_BY_EXT = {
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg",
  oga: "audio/ogg", opus: "audio/ogg", webm: "audio/webm", amr: "audio/amr", "3gp": "audio/3gpp", flac: "audio/flac",
};
let audioPreviewUrl = null;
let audioRenderToken = 0;

function fileExt(name) {
  return ((name || "").split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
}
function stopAudioPreview() {
  const player = el("audio-player");
  try { player.pause(); } catch (e) { /* ignore */ }
  player.removeAttribute("src");
  if (audioPreviewUrl) { URL.revokeObjectURL(audioPreviewUrl); audioPreviewUrl = null; }
}

async function renderAudioField() {
  const token = ++audioRenderToken;
  const cur = el("audio-current"), nameEl = el("audio-name"), player = el("audio-player"), note = el("audio-note");
  stopAudioPreview();
  player.classList.add("hidden");
  note.classList.add("hidden");
  const f = todoModalState.audioFile;
  const ex = todoModalState.audioExisting;
  if (f) {
    cur.classList.remove("hidden");
    nameEl.textContent = f.name;
    audioPreviewUrl = URL.createObjectURL(f);
    player.src = audioPreviewUrl;
    player.classList.remove("hidden");
    el("audio-pick-btn").textContent = "🎧 جایگزینی فایل صوتی";
  } else if (ex && !todoModalState.audioRemoved) {
    cur.classList.remove("hidden");
    nameEl.textContent = ex.name || "فایل صوتی";
    el("audio-pick-btn").textContent = "🎧 جایگزینی فایل صوتی";
    if (!navigator.onLine) {
      note.textContent = "پخش فایل فقط وقتی آنلاین باشی ممکنه.";
      note.classList.remove("hidden");
      return;
    }
    try {
      const { data, error } = await sb.storage.from(AUDIO_BUCKET).createSignedUrl(ex.path, 3600);
      if (token !== audioRenderToken) return; // در این فاصله مودال عوض شده
      if (error || !data) throw error || new Error("no url");
      player.src = data.signedUrl;
      player.classList.remove("hidden");
    } catch (err) {
      if (token !== audioRenderToken) return;
      note.textContent = "بارگذاری فایل صوتی ناموفق بود.";
      note.classList.remove("hidden");
    }
  } else {
    cur.classList.add("hidden");
    el("audio-pick-btn").textContent = "🎧 افزودن فایل صوتی";
  }
  el("audio-record-btn").textContent = (f || (ex && !todoModalState.audioRemoved)) ? "🎙 ضبط مجدد" : "🎙 ضبط صدا";
}

// ---------- ضبط مستقیم صدا (MediaRecorder) ----------
const rec = { recorder: null, stream: null, chunks: [], bytes: 0, startedAt: 0, timer: null, mime: "", cancelled: false, stopPromise: null };

function recorderSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}
function pickRecorderMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((m) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(m)) || "";
}
function fmtTimer(sec) {
  const t = Math.floor(sec);
  return toFa(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
}
function renderRecordingUI() {
  const active = !!rec.recorder;
  el("audio-recording").classList.toggle("hidden", !active);
  el("audio-actions").classList.toggle("hidden", active);
}

async function startRecording() {
  if (rec.recorder) return;
  if (!recorderSupported()) { alert("این مرورگر ضبط صدا رو پشتیبانی نمی‌کنه."); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert("دسترسی به میکروفون داده نشد. از تنظیمات مرورگر، اجازه‌ی میکروفون رو برای این سایت فعال کن.");
    return;
  }
  const mime = pickRecorderMime();
  let recorder;
  try {
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    alert("شروع ضبط ممکن نشد.");
    return;
  }
  rec.recorder = recorder;
  rec.stream = stream;
  rec.chunks = [];
  rec.bytes = 0;
  rec.cancelled = false;
  rec.mime = recorder.mimeType || mime || "audio/webm";
  rec.startedAt = Date.now();

  recorder.ondataavailable = (e) => {
    if (!e.data || !e.data.size) return;
    rec.chunks.push(e.data);
    rec.bytes += e.data.size;
    if (rec.bytes >= AUDIO_MAX_BYTES * 0.95 && recorder.state === "recording") {
      recorder.stop(); // به سقف حجم رسیدیم
      setTimeout(() => alert("ضبط به سقف ۱۰ مگابایت رسید و متوقف شد."), 0);
    }
  };
  rec.stopPromise = new Promise((resolve) => {
    recorder.onstop = () => {
      clearInterval(rec.timer);
      rec.timer = null;
      rec.stream.getTracks().forEach((t) => t.stop()); // میکروفون آزاد می‌شه
      const cancelled = rec.cancelled;
      const mimeType = rec.mime.split(";")[0];
      const blob = new Blob(rec.chunks, { type: mimeType });
      rec.recorder = null;
      rec.stream = null;
      rec.chunks = [];
      renderRecordingUI();
      if (cancelled || !blob.size) { resolve(null); return; }
      const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
      const d = new Date();
      const name = `ضبط صدا ${toFa(String(d.getHours()).padStart(2, "0"))}:${toFa(String(d.getMinutes()).padStart(2, "0"))}.${ext}`;
      const file = new File([blob], name, { type: mimeType });
      if (file.size > AUDIO_MAX_BYTES) { alert("حجم فایل ضبط‌شده بیشتر از ۱۰ مگابایته."); resolve(null); return; }
      todoModalState.audioFile = file;
      renderAudioField();
      resolve(file);
    };
  });
  recorder.start(1000);
  el("audio-rec-timer").textContent = fmtTimer(0);
  rec.timer = setInterval(() => { el("audio-rec-timer").textContent = fmtTimer((Date.now() - rec.startedAt) / 1000); }, 500);
  renderRecordingUI();
}
function stopRecording() {
  if (!rec.recorder) return Promise.resolve(null);
  const p = rec.stopPromise;
  if (rec.recorder.state !== "inactive") rec.recorder.stop();
  return p;
}
function cancelRecording() {
  if (!rec.recorder) return;
  rec.cancelled = true;
  if (rec.recorder.state !== "inactive") rec.recorder.stop();
}
el("audio-record-btn").addEventListener("click", startRecording);
el("audio-rec-stop").addEventListener("click", stopRecording);
el("audio-rec-cancel").addEventListener("click", cancelRecording);
if (!recorderSupported()) el("audio-record-btn").classList.add("hidden");

el("audio-pick-btn").addEventListener("click", () => el("audio-file-input").click());
el("audio-file-input").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = ""; // تا انتخاب دوباره‌ی همون فایل هم کار کنه
  if (!f) return;
  const looksAudio = (f.type || "").startsWith("audio/") || !!AUDIO_MIME_BY_EXT[fileExt(f.name)];
  if (!looksAudio) { alert("فقط فایل صوتی (مثل mp3، m4a، wav) قابل ضمیمه‌ست."); return; }
  if (f.size > AUDIO_MAX_BYTES) { alert("حجم فایل صوتی نباید بیشتر از ۱۰ مگابایت باشه."); return; }
  todoModalState.audioFile = f;
  renderAudioField();
});
el("audio-remove-btn").addEventListener("click", () => {
  if (todoModalState.audioFile) todoModalState.audioFile = null;
  else if (todoModalState.audioExisting) todoModalState.audioRemoved = true;
  renderAudioField();
});

async function uploadTaskAudio(file, folderId) {
  const path = `${state.user.id}/${folderId}/${crypto.randomUUID()}.${fileExt(file.name) || "audio"}`;
  const contentType = file.type || AUDIO_MIME_BY_EXT[fileExt(file.name)] || "audio/mpeg";
  const { error } = await sb.storage.from(AUDIO_BUCKET).upload(path, file, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

// فایل‌هایی که دیگه هیچ کاری بهشون اشاره نمی‌کنه از Storage پاک می‌شن (بهترین‌تلاش، آنلاین)
async function removeOrphanAudio(paths) {
  const orphans = [...new Set((paths || []).filter(Boolean))].filter((pth) => !state.todos.some((t) => t.audio_path === pth));
  if (!orphans.length || !navigator.onLine) return;
  try { await sb.storage.from(AUDIO_BUCKET).remove(orphans); } catch (err) { console.error("audio cleanup failed", err); }
}

function populateTimeSelects() {
  const hourSel = el("time-hour-select");
  const minSel = el("time-minute-select");
  if (!hourSel.options.length) {
    hourSel.innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${toFa(String(h).padStart(2, "0"))}</option>`).join("");
  }
  if (!minSel.options.length) {
    minSel.innerHTML = Array.from({ length: 12 }, (_, i) => i * 5)
      .map((m) => `<option value="${m}">${toFa(String(m).padStart(2, "0"))}</option>`).join("");
  }
}

function openTodoModal(title) {
  const now = new Date();
  const [jy, jm] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  todoModalState.editingId = null;
  todoModalState.categoryId = state.categories.length ? state.categories[0].id : null;
  todoModalState.hasDate = false;
  todoModalState.selectedISO = todayISO();
  todoModalState.priority = 3;
  todoModalState.calJY = jy;
  todoModalState.calJM = jm;
  todoModalState.hasTime = false;
  todoModalState.timeHour = 9;
  todoModalState.timeMinute = 0;
  todoModalState.recurring = false;
  todoModalState.recurType = "daily";
  todoModalState.recurWeekdays = [];
  todoModalState.recurN = 2;
  todoModalState.recurCount = 8;
  todoModalState.hasDescription = false;
  cancelRecording();
  todoModalState.audioFile = null;
  todoModalState.audioExisting = null;
  todoModalState.audioRemoved = false;
  el("todo-modal-heading").textContent = "کار تازه";
  el("todo-modal-title-input").value = title;
  el("todo-modal-save").textContent = "ذخیره کار";
  el("todo-modal-delete").classList.add("hidden");
  el("todo-title-input").value = "";
  el("recurring-field").classList.remove("hidden");
  el("todo-recurring-toggle").checked = false;
  el("recurrence-options").classList.add("hidden");
  el("recurrence-count-input").value = 8;
  el("recurrence-n-input").value = 2;
  el("recurrence-type").value = "daily";
  el("recurrence-weekdays").classList.add("hidden");
  el("recurrence-n-wrap").classList.add("hidden");
  todoModalState.scope = "single";
  el("series-scope-field").classList.add("hidden");
  el("series-scope-select").value = "single";
  el("todo-desc-toggle").checked = false;
  el("todo-desc-wrap").classList.add("hidden");
  el("todo-desc-input").value = "";
  populateTimeSelects();
  renderAudioField();
  renderScopeUI();
  renderCategoryGrid();
  renderPriorityPicker();
  renderDateToggle();
  renderCalendar();
  renderRecurrenceWeekdays();
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
  todoModalState.hasTime = !!todo.due_time;
  if (todo.due_time) {
    const [h, m] = todo.due_time.split(":").map(Number);
    todoModalState.timeHour = h;
    todoModalState.timeMinute = m;
  } else {
    todoModalState.timeHour = 9;
    todoModalState.timeMinute = 0;
  }
  todoModalState.recurring = false;
  todoModalState.hasDescription = !!todo.description;
  cancelRecording();
  todoModalState.audioFile = null;
  todoModalState.audioExisting = todo.audio_path ? { path: todo.audio_path, name: todo.audio_name } : null;
  todoModalState.audioRemoved = false;
  el("todo-modal-heading").textContent = "ویرایش کار";
  el("todo-modal-title-input").value = todo.title;
  el("todo-modal-save").textContent = "بروزرسانی کار";
  el("todo-modal-delete").classList.remove("hidden");
  // کارهای دوره‌ای فقط موقع ساخت تعریف می‌شن، نه موقع ویرایش یک نمونه
  el("recurring-field").classList.add("hidden");
  el("todo-desc-toggle").checked = todoModalState.hasDescription;
  el("todo-desc-wrap").classList.toggle("hidden", !todoModalState.hasDescription);
  el("todo-desc-input").value = todo.description || "";
  todoModalState.scope = "single";
  const isSeries = !!todo.recurrence_group && !todo.done;
  el("series-scope-field").classList.toggle("hidden", !isSeries);
  el("series-scope-select").value = "single";
  if (isSeries) {
    const n = state.todos.filter((t) => t.recurrence_group === todo.recurrence_group && !t.done).length;
    el("series-scope-select").options[1].textContent = `همه‌ی تکرارهای انجام‌نشده (${toFa(n)} کار)`;
  }
  populateTimeSelects();
  el("time-hour-select").value = String(todoModalState.timeHour);
  el("time-minute-select").value = String(todoModalState.timeMinute - (todoModalState.timeMinute % 5));
  renderAudioField();
  renderScopeUI();
  renderCategoryGrid();
  renderPriorityPicker();
  renderDateToggle();
  renderCalendar();
  el("todo-modal-overlay").classList.remove("hidden");
}

function closeTodoModal() {
  el("todo-modal-overlay").classList.add("hidden");
  cancelRecording();
  stopAudioPreview();
}
el("todo-modal-close").addEventListener("click", closeTodoModal);
el("todo-modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "todo-modal-overlay") closeTodoModal();
});

el("todo-modal-delete").addEventListener("click", async () => {
  if (!todoModalState.editingId) return;
  const current = state.todos.find((t) => t.id === todoModalState.editingId);

  if (todoModalState.scope === "all" && current && current.recurrence_group) {
    const gid = current.recurrence_group;
    const targets = state.todos.filter((t) => t.recurrence_group === gid && !t.done);
    if (!confirm(`همه‌ی ${toFa(targets.length)} تکرارِ انجام‌نشده‌ی این کار دوره‌ای حذف بشن؟ (کارهای انجام‌شده می‌مونن)`)) return;
    const ids = new Set(targets.map((t) => t.id));
    state.todos = state.todos.filter((t) => !ids.has(t.id));
    closeTodoModal();
    renderTodos(); renderCompletedTodos(); renderTodayTasks(); renderTodoCalendar();
    const res = await attemptOrQueue(
      () => sb.from("todos").delete().eq("recurrence_group", gid).eq("done", false),
      { kind: "delete", table: "todos", matches: [["recurrence_group", gid], ["done", false]] }
    );
    if (!res.ok && !res.queued) {
      state.todos.push(...targets);
      alert(res.error.message);
      renderTodos(); renderCompletedTodos(); renderTodayTasks(); renderTodoCalendar();
    } else {
      removeOrphanAudio(targets.map((t) => t.audio_path));
    }
    return;
  }

  if (!confirm("این کار حذف بشه؟")) return;
  const id = todoModalState.editingId;
  const removed = state.todos.find((t) => t.id === id);
  state.todos = state.todos.filter((t) => t.id !== id);
  closeTodoModal();
  renderTodos();
  renderCompletedTodos();
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
    renderCompletedTodos();
    renderTodayTasks();
    renderTodoCalendar();
  } else if (removed) {
    removeOrphanAudio([removed.audio_path]);
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
  // وقتی تغییرات روی «همه‌ی تکرارها» اعمال می‌شه، تاریخ هر نمونه جدا می‌مونه؛ فقط زمان مشترکه
  const seriesAll = todoModalState.scope === "all";
  el("hasdate-label").classList.toggle("hidden", seriesAll);
  el("todo-hasdate-toggle").checked = todoModalState.hasDate;
  el("cal-section").classList.toggle("hidden", seriesAll || !todoModalState.hasDate);
  el("hastime-label").classList.toggle("hidden", !(seriesAll || todoModalState.hasDate));
  if (!seriesAll && !todoModalState.hasDate) {
    todoModalState.hasTime = false;
    el("todo-hastime-toggle").checked = false;
  }
  renderTimeToggle();
}
// برچسب دکمه‌ها بر اساس دامنه‌ی تغییرات (فقط همین کار / همه‌ی تکرارها)
function renderScopeUI() {
  const all = todoModalState.scope === "all";
  if (todoModalState.editingId) {
    el("todo-modal-save").textContent = all ? "بروزرسانی همه‌ی تکرارها" : "بروزرسانی کار";
    el("todo-modal-delete").textContent = all ? "حذف همه‌ی تکرارهای انجام‌نشده" : "حذف کار";
  }
}
el("series-scope-select").addEventListener("change", (e) => {
  todoModalState.scope = e.target.value;
  renderScopeUI();
  renderDateToggle();
});
el("todo-hasdate-toggle").addEventListener("change", (e) => {
  todoModalState.hasDate = e.target.checked;
  todoModalState.selectedISO = todoModalState.hasDate ? (todoModalState.selectedISO || todayISO()) : "";
  if (!todoModalState.hasDate && todoModalState.recurring) {
    // بدون تاریخ نمی‌شه دوره‌ای بود چون به تاریخ پایه نیاز داره
    todoModalState.recurring = false;
    el("todo-recurring-toggle").checked = false;
    el("recurrence-options").classList.add("hidden");
  }
  renderDateToggle();
  renderCalendar();
});

function renderTimeToggle() {
  el("todo-hastime-toggle").checked = todoModalState.hasTime;
  el("time-section").classList.toggle("hidden", !todoModalState.hasTime);
}
el("todo-hastime-toggle").addEventListener("change", (e) => {
  todoModalState.hasTime = e.target.checked;
  renderTimeToggle();
});
el("time-hour-select").addEventListener("change", (e) => {
  todoModalState.timeHour = parseInt(e.target.value, 10);
});
el("time-minute-select").addEventListener("change", (e) => {
  todoModalState.timeMinute = parseInt(e.target.value, 10);
});

// ---------- کار دوره‌ای ----------
function renderRecurrenceWeekdays() {
  const wrap = el("recurrence-weekdays");
  wrap.innerHTML = "";
  WEEKDAY_LABELS.forEach((label, idx) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cat-chip" + (todoModalState.recurWeekdays.includes(idx) ? " selected" : "");
    chip.style.setProperty("--chip-color", "#3E6FE0");
    chip.textContent = label;
    chip.addEventListener("click", () => {
      const i = todoModalState.recurWeekdays.indexOf(idx);
      if (i === -1) todoModalState.recurWeekdays.push(idx);
      else todoModalState.recurWeekdays.splice(i, 1);
      renderRecurrenceWeekdays();
    });
    wrap.appendChild(chip);
  });
}
el("todo-recurring-toggle").addEventListener("change", (e) => {
  todoModalState.recurring = e.target.checked;
  el("recurrence-options").classList.toggle("hidden", !todoModalState.recurring);
  if (todoModalState.recurring && !todoModalState.hasDate) {
    // دوره‌ای بودن به تاریخ پایه نیاز داره
    todoModalState.hasDate = true;
    todoModalState.selectedISO = todayISO();
    renderDateToggle();
    renderCalendar();
  }
});
el("recurrence-type").addEventListener("change", (e) => {
  todoModalState.recurType = e.target.value;
  el("recurrence-weekdays").classList.toggle("hidden", todoModalState.recurType !== "weekly");
  el("recurrence-n-wrap").classList.toggle("hidden", todoModalState.recurType !== "every_n");
});
el("recurrence-n-input").addEventListener("input", (e) => {
  todoModalState.recurN = parseInt(e.target.value, 10) || 2;
});
el("recurrence-count-input").addEventListener("input", (e) => {
  todoModalState.recurCount = Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 1));
});

// ---------- توضیحات ----------
el("todo-desc-toggle").addEventListener("change", (e) => {
  todoModalState.hasDescription = e.target.checked;
  el("todo-desc-wrap").classList.toggle("hidden", !todoModalState.hasDescription);
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
  if (rec.recorder) await stopRecording();
  const description = todoModalState.hasDescription ? el("todo-desc-input").value.trim() : null;
  const payload = {
    title,
    category_id: todoModalState.categoryId,
    priority: todoModalState.priority,
    due_date: todoModalState.hasDate ? todoModalState.selectedISO : null,
    due_time: (todoModalState.hasDate && todoModalState.hasTime)
      ? `${String(todoModalState.timeHour).padStart(2, "0")}:${String(todoModalState.timeMinute).padStart(2, "0")}`
      : null,
    description: description || null,
  };

  // شناسه‌ها از قبل ساخته می‌شن تا فایل صوتی توی پوشه‌ی درست آپلود بشه
  const beingEdited = todoModalState.editingId ? state.todos.find((t) => t.id === todoModalState.editingId) : null;
  const seriesAll = !!(beingEdited && todoModalState.scope === "all" && beingEdited.recurrence_group);
  const isRecurringCreate = !todoModalState.editingId && todoModalState.recurring && todoModalState.hasDate;
  const newGroupId = isRecurringCreate ? crypto.randomUUID() : null;
  const singleNewId = !todoModalState.editingId && !isRecurringCreate ? crypto.randomUUID() : null;

  let audioPatch = null; // فیلدهای صوتی که باید توی دیتابیس عوض بشن
  if (todoModalState.audioFile) {
    if (!navigator.onLine) { alert("برای ضمیمه کردن فایل صوتی باید آنلاین باشی."); return; }
    const folderId = seriesAll ? beingEdited.recurrence_group : isRecurringCreate ? newGroupId : beingEdited ? beingEdited.id : singleNewId;
    const saveBtn = el("todo-modal-save");
    const oldLabel = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = "در حال آپلود فایل صوتی…";
    try {
      const path = await uploadTaskAudio(todoModalState.audioFile, folderId);
      audioPatch = { audio_path: path, audio_name: todoModalState.audioFile.name };
    } catch (err) {
      alert("آپلود فایل صوتی ناموفق بود: " + (err && err.message ? err.message : err));
      return;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = oldLabel;
    }
  } else if (todoModalState.audioRemoved) {
    audioPatch = { audio_path: null, audio_name: null };
  }
  if (audioPatch) Object.assign(payload, audioPatch);
  const newAudioPath = audioPatch && audioPatch.audio_path ? audioPatch.audio_path : null;

  if (todoModalState.editingId && todoModalState.scope === "all") {
    // تغییر یک‌جا برای همه‌ی تکرارهای انجام‌نشده‌ی این کار دوره‌ای (تاریخ هر نمونه دست‌نخورده می‌مونه)
    const todo = state.todos.find((t) => t.id === todoModalState.editingId);
    if (!todo || !todo.recurrence_group) { closeTodoModal(); return; }
    const gid = todo.recurrence_group;
    const seriesPayload = {
      title,
      category_id: todoModalState.categoryId,
      priority: todoModalState.priority,
      due_time: todoModalState.hasTime
        ? `${String(todoModalState.timeHour).padStart(2, "0")}:${String(todoModalState.timeMinute).padStart(2, "0")}`
        : null,
      description: description || null,
    };
    if (audioPatch) Object.assign(seriesPayload, audioPatch);
    const targets = state.todos.filter((t) => t.recurrence_group === gid && !t.done);
    const prevs = targets.map((t) => ({ t, prev: { ...t } }));
    targets.forEach((t) => Object.assign(t, seriesPayload));
    closeTodoModal();
    renderTodos(); renderCompletedTodos(); renderTodayTasks(); renderTodoCalendar();
    const result = await attemptOrQueue(
      () => sb.from("todos").update(seriesPayload).eq("recurrence_group", gid).eq("done", false),
      { kind: "update", table: "todos", payload: seriesPayload, matches: [["recurrence_group", gid], ["done", false]] }
    );
    if (!result.ok && !result.queued) {
      prevs.forEach(({ t, prev }) => Object.assign(t, prev));
      alert(result.error.message);
      renderTodos(); renderCompletedTodos(); renderTodayTasks(); renderTodoCalendar();
      removeOrphanAudio([newAudioPath]);
    } else if (audioPatch) {
      removeOrphanAudio(prevs.map(({ prev }) => prev.audio_path));
    }
  } else if (todoModalState.editingId) {
    const todo = state.todos.find((t) => t.id === todoModalState.editingId);
    if (!todo) { closeTodoModal(); return; }
    const prev = { ...todo };
    Object.assign(todo, payload);
    closeTodoModal();
    renderTodos(); renderCompletedTodos(); renderTodayTasks(); renderTodoCalendar();
    const result = await attemptOrQueue(
      () => sb.from("todos").update(payload).eq("id", todo.id),
      { kind: "update", table: "todos", payload, matchColumn: "id", matchValue: todo.id }
    );
    if (!result.ok && !result.queued) {
      Object.assign(todo, prev);
      alert(result.error.message);
      renderTodos(); renderCompletedTodos(); renderTodayTasks(); renderTodoCalendar();
      removeOrphanAudio([newAudioPath]);
    } else if (audioPatch) {
      removeOrphanAudio([prev.audio_path]);
    }
  } else {
    const common = { user_id: state.user.id, done: false, completed_at: null, ...payload };
    let newRows;
    if (todoModalState.recurring && todoModalState.hasDate) {
      const groupId = newGroupId;
      // مقادیر را مستقیم از خود فرم می‌خوانیم تا هیچ‌وقت با state قدیمی ناسازگار نشن
      const recurType = el("recurrence-type").value;
      const recurCount = Math.min(365, Math.max(1, parseInt(el("recurrence-count-input").value, 10) || 1));
      const recurN = Math.max(2, parseInt(el("recurrence-n-input").value, 10) || 2);
      const allDates = generateRecurrenceDates(
        todoModalState.selectedISO,
        recurType,
        { weekdays: todoModalState.recurWeekdays, n: recurN },
        recurCount
      );
      newRows = allDates.map((iso) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        recurrence_group: groupId,
        ...common,
        due_date: iso,
      }));
    } else {
      newRows = [{ id: singleNewId, created_at: new Date().toISOString(), recurrence_group: null, ...common }];
    }
    state.todos.push(...newRows);
    closeTodoModal();
    renderTodos(); renderCompletedTodos(); renderTodayTasks(); renderTodoCalendar();
    const result = await attemptOrQueue(
      () => sb.from("todos").insert(newRows),
      { kind: "insert", table: "todos", payload: newRows }
    );
    if (!result.ok && !result.queued) {
      const ids = new Set(newRows.map((r) => r.id));
      state.todos = state.todos.filter((t) => !ids.has(t.id));
      alert(result.error.message);
      renderTodos(); renderCompletedTodos(); renderTodayTasks(); renderTodoCalendar();
      removeOrphanAudio([newAudioPath]);
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
  const at = state.leaderboardAt;
  const hhmm = at ? new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  el("league-updated-at").textContent = at
    ? `آخرین به‌روزرسانی: ${toFa(hhmm)}${net.reachable ? "" : " — آفلاین، داده‌ی ذخیره‌شده"}`
    : (net.reachable ? "" : "آفلاین — هنوز داده‌ای ذخیره نشده");
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

el("league-refresh-btn").addEventListener("click", async () => {
  const btn = el("league-refresh-btn");
  btn.disabled = true;
  await refreshLeaderboard();
  btn.disabled = false;
});

el("copy-code-btn").addEventListener("click", () => {
  navigator.clipboard.writeText(state.league.invite_code);
  el("copy-code-btn").textContent = "کپی شد!";
  setTimeout(() => (el("copy-code-btn").textContent = "کپی کد دعوت"), 1500);
});

// ============================================================
// رندر: آمار
// ============================================================

// روزهایی که برای هر کدوم لیست کارها و وضعیت انجام‌شدن ثبت شده
function todosByDueDate() {
  const byDate = {};
  state.todos.forEach((t) => {
    if (!t.due_date) return;
    (byDate[t.due_date] = byDate[t.due_date] || []).push(t);
  });
  return byDate;
}
function isPerfectDay(iso, byDate) {
  const list = byDate[iso];
  return !!(list && list.length && list.every((t) => t.done));
}

function computeStreaks() {
  const byDate = todosByDueDate();
  const dates = Object.keys(byDate).sort();
  if (!dates.length) return { current: 0, best: 0, perfectCount: 0 };
  const perfectCount = dates.filter((d) => isPerfectDay(d, byDate)).length;
  const earliestJdn = j2d(...isoToJalali(dates[0]));
  const todayJdn = j2d(...isoToJalali(todayISO()));
  let run = 0, best = 0;
  const runEndingAt = {};
  for (let jdn = earliestJdn; jdn <= todayJdn; jdn++) {
    const [jy, jm, jd] = d2j(jdn);
    const iso = jalaliToISO(jy, jm, jd);
    run = isPerfectDay(iso, byDate) ? run + 1 : 0;
    runEndingAt[iso] = run;
    if (run > best) best = run;
  }
  let current = runEndingAt[todayISO()] || 0;
  if (current === 0) current = runEndingAt[addDaysISO(todayISO(), -1)] || 0;
  return { current, best, perfectCount };
}

function mostProductiveDay() {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  state.todos.forEach((t) => {
    if (!t.done || !t.completed_at) return;
    const iso = localISODate(t.completed_at);
    const [jy, jm, jd] = isoToJalali(iso);
    counts[jalaliWeekday(jy, jm, jd)] += 1;
  });
  const max = Math.max(...counts);
  if (max === 0) return null;
  return FULL_WEEKDAY_NAMES[counts.indexOf(max)];
}

function renderStatCards() {
  const completedTotal = state.todos.filter((t) => t.done).length;
  const { current, best, perfectCount } = computeStreaks();
  const myPoints = state.leaderboard.find((r) => r.user_id === state.user.id);
  const cards = [
    { value: toFa(completedTotal), label: "کارهای تکمیل‌شده" },
    { value: toFa(perfectCount), label: "روزهای بی‌نقص" },
    { value: toFa(current), label: "استریک فعلی" },
    { value: toFa(best), label: "بهترین استریک" },
    { value: toFa(myPoints ? myPoints.total_points : 0), label: "مجموع امتیاز لیگ" },
  ];
  const wrap = el("stat-cards");
  wrap.innerHTML = "";
  cards.forEach((c) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div>`;
    wrap.appendChild(card);
  });
}

function renderWeekChart() {
  const start = state.weekStartISO;
  const end = addDaysISO(start, 6);
  el("week-label").textContent = `${isoToJalaliLabel(start)} تا ${isoToJalaliLabel(end)}`;
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysISO(start, i));
  const completedCounts = days.map((iso) =>
    state.todos.filter((t) => t.done && t.completed_at && localISODate(t.completed_at) === iso).length
  );
  const dueCounts = days.map((iso) => state.todos.filter((t) => t.due_date === iso).length);
  const max = Math.max(...completedCounts, 1);

  const wrap = el("week-bar-chart");
  wrap.innerHTML = "";
  days.forEach((iso, i) => {
    const count = completedCounts[i];
    const col = document.createElement("div");
    col.className = "bar-col";
    col.innerHTML = `
      <span class="bar-count">${count ? toFa(count) : ""}</span>
      <div class="bar-fill ${count ? "" : "zero"}" style="height:${count ? Math.max(6, (count / max) * 100) : 3}%;"></div>
      <span class="bar-day-label">${WEEKDAY_LABELS[i]}</span>`;
    wrap.appendChild(col);
  });

  const totalWeek = completedCounts.reduce((s, n) => s + n, 0);
  el("week-message").textContent =
    totalWeek === 0 ? "هنوز کاری این هفته انجام نشده." : totalWeek < 5 ? "هفته‌ی آرومی بود." : "این هفته پربار بود 🎉";

  const totalDue = dueCounts.reduce((s, n) => s + n, 0);
  el("week-completion-rate").textContent = totalDue ? `${toFa(Math.round((totalWeek / totalDue) * 100))}٪` : "--";

  const best = mostProductiveDay();
  el("most-productive-day-line").textContent = best ? `پربارترین روزت: ${best}‌ها` : "";
}
el("week-prev").addEventListener("click", () => {
  state.weekStartISO = addDaysISO(state.weekStartISO, -7);
  renderWeekChart();
});
el("week-next").addEventListener("click", () => {
  state.weekStartISO = addDaysISO(state.weekStartISO, 7);
  renderWeekChart();
});

function renderDonutRangeChips() {
  const wrap = el("donut-range-chips");
  wrap.innerHTML = "";
  [["7", "۷ روز"], ["30", "۳۰ روز"], ["90", "۹۰ روز"], ["all", "همه"]].forEach(([val, label]) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter-chip" + (String(state.donutRange) === val ? " selected" : "");
    chip.textContent = label;
    chip.addEventListener("click", () => {
      state.donutRange = val === "all" ? "all" : parseInt(val, 10);
      renderDonutRangeChips();
      renderDonut();
    });
    wrap.appendChild(chip);
  });
}

function renderDonut() {
  const cutoff = state.donutRange === "all" ? null : addDaysISO(todayISO(), -(state.donutRange - 1));
  const done = state.todos.filter((t) => {
    if (!t.done || !t.completed_at) return false;
    const iso = localISODate(t.completed_at);
    return cutoff ? iso >= cutoff : true;
  });
  const byCat = {};
  done.forEach((t) => {
    const key = t.category_id || "none";
    byCat[key] = (byCat[key] || 0) + 1;
  });
  const rows = Object.keys(byCat)
    .map((key) => ({ cat: key === "none" ? UNCATEGORIZED : categoryById(key), count: byCat[key] }))
    .sort((a, b) => b.count - a.count);
  const total = done.length;

  const donutEl = el("donut-chart");
  const legendEl = el("donut-legend");
  legendEl.innerHTML = "";
  if (!total) {
    donutEl.style.background = "var(--line)";
    donutEl.innerHTML = `<div class="donut-total">۰</div>`;
    legendEl.innerHTML = `<div class="empty-state" style="padding:6px 0;">کاری در این بازه انجام نشده.</div>`;
    return;
  }
  let acc = 0;
  const stops = rows.map((r) => {
    const start = (acc / total) * 360;
    acc += r.count;
    const end = (acc / total) * 360;
    return `${r.cat.color} ${start}deg ${end}deg`;
  });
  donutEl.style.background = `conic-gradient(${stops.join(",")})`;
  donutEl.innerHTML = `<div class="donut-total">${toFa(total)}</div>`;
  rows.forEach((r) => {
    const row = document.createElement("div");
    row.className = "donut-legend-row";
    row.innerHTML = `
      <span class="donut-dot" style="background:${r.cat.color};"></span>
      <span class="donut-legend-label">${r.cat.label}</span>
      <span class="donut-legend-count">${toFa(r.count)}</span>`;
    legendEl.appendChild(row);
  });
}

function renderHeatmapYearOptions() {
  const sel = el("heatmap-year-select");
  const yearsWithData = new Set(
    state.todos.filter((t) => t.done && t.completed_at).map((t) => isoToJalali(localISODate(t.completed_at))[0])
  );
  yearsWithData.add(isoToJalali(todayISO())[0]);
  const years = [...yearsWithData].sort((a, b) => b - a);
  sel.innerHTML = years.map((y) => `<option value="${y}" ${y === state.heatmapYear ? "selected" : ""}>${toFa(y)}</option>`).join("");
}
el("heatmap-year-select").addEventListener("change", (e) => {
  state.heatmapYear = parseInt(e.target.value, 10);
  renderHeatmap();
});

function renderHeatmap() {
  const jy = state.heatmapYear;
  const counts = {};
  state.todos.forEach((t) => {
    if (!t.done || !t.completed_at) return;
    const iso = localISODate(t.completed_at);
    counts[iso] = (counts[iso] || 0) + 1;
  });

  const startWd = jalaliWeekday(jy, 1, 1);
  const yearLen = isLeapJalaliYear(jy) ? 366 : 365;

  const weekdaysEl = el("heatmap-weekdays");
  weekdaysEl.innerHTML = WEEKDAY_LABELS.map((w) => `<span>${w}</span>`).join("");

  const gridEl = el("heatmap-grid");
  gridEl.innerHTML = "";
  for (let i = 0; i < startWd; i++) {
    const filler = document.createElement("div");
    gridEl.appendChild(filler);
  }
  const monthStartCol = new Array(13).fill(0);
  let dayJm = 1, dayJd = 1;
  for (let dayIndex = 0; dayIndex < yearLen; dayIndex++) {
    const len = jalaliMonthLength(jy, dayJm);
    if (dayJd === 1) monthStartCol[dayJm] = Math.floor((startWd + dayIndex) / 7);
    const iso = jalaliToISO(jy, dayJm, dayJd);
    const count = counts[iso] || 0;
    const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : 3;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `heat-cell heat-${level}`;
    cell.title = `${toFa(dayJd)} ${JALALI_MONTHS[dayJm - 1]} ${toFa(jy)} — ${count ? toFa(count) + " کار" : "بدون فعالیت"}`;
    cell.addEventListener("click", () => {
      el("heatmap-detail").textContent = `${toFa(dayJd)} ${JALALI_MONTHS[dayJm - 1]} ${toFa(jy)}: ${count ? toFa(count) + " کار انجام شد" : "فعالیتی ثبت نشده"}`;
    });
    gridEl.appendChild(cell);
    dayJd++;
    if (dayJd > len) { dayJd = 1; dayJm++; }
  }

  const totalCols = Math.ceil((startWd + yearLen) / 7);
  const cellPx = 14; // 11px + 3px gap
  const monthsEl = el("heatmap-months");
  monthsEl.innerHTML = "";
  for (let m = 1; m <= 12; m++) {
    const nextStart = m < 12 ? monthStartCol[m + 1] : totalCols;
    const span = Math.max(1, nextStart - monthStartCol[m]);
    const label = document.createElement("span");
    label.style.width = `${span * cellPx}px`;
    label.textContent = JALALI_MONTHS[m - 1].slice(0, 3);
    monthsEl.appendChild(label);
  }
  el("heatmap-detail").textContent = "";
}

function renderStats() {
  renderStatCards();
  renderWeekChart();
  renderDonutRangeChips();
  renderDonut();
  renderHeatmapYearOptions();
  renderHeatmap();
}

// ============================================================
// راه‌اندازی
// ============================================================
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ---------- کاربر فعلی (حتی وقتی آفلاینی و توکن منقضی شده) ----------
// getSession وقتی توکن منقضی شده و اینترنت نیست، نشست رو null برمی‌گردونه (تست شد) ولی نشست
// هنوز در localStorage هست و به‌محض اتصال خودکار تمدید می‌شه. پس از همون‌جا کاربر رو می‌خونیم.
function readStoredUser() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const v = JSON.parse(localStorage.getItem(k));
        if (v && v.user && v.user.id) return v.user;
      }
    }
  } catch (err) { /* ignore */ }
  return null;
}
async function resolveUser() {
  let session = null, error = null;
  try {
    const r = await sb.auth.getSession();
    session = r.data && r.data.session;
    error = r.error;
  } catch (err) { error = err; }
  if (session) return session.user;
  const networkIssue = !navigator.onLine || (error && isTransientError({ error, status: error.status }));
  return networkIssue ? readStoredUser() : null;
}

let bootstrapPromise = null;
function bootstrapAfterAuth() {
  if (!bootstrapPromise) bootstrapPromise = doBootstrap().finally(() => { bootstrapPromise = null; });
  return bootstrapPromise;
}

async function doBootstrap() {
  const user = await resolveUser();
  state.user = user;
  if (!user) { state.booted = false; showScreen("auth"); return; }
  migrateLegacyOutbox();

  state.dayISO = todayISO();
  initTodoCalToCurrentMonth();
  state.weekStartISO = startOfWeekISO(todayISO());
  state.heatmapYear = isoToJalali(todayISO())[0];

  // اول نسخه‌ی ذخیره‌شده + تغییرات صف‌شده رو فوری نشون می‌دیم (حتی آفلاین)، بعد از سرور تازه می‌کنیم
  let shown = false;
  const snap = await loadSnapshot(user.id);
  if (snap && snap.league) {
    hydrateFromSnapshot(snap);
    applyOutboxToState(loadOutbox());
    state.booted = true;
    showScreen("main");
    renderTabs();
    updateSyncBadge();
    shown = true;
  }

  const lg = await loadLeague();
  if (lg === "none") { state.booted = false; showScreen("onboard"); return; }
  if (lg === "error") {
    if (!shown) {
      showScreen("onboard");
      el("onboard-error").textContent = "برای اولین ورود باید به سرور وصل بشی. اتصال برقرار نشد؛ چند لحظه‌ی دیگه خودکار دوباره تلاش می‌کنم.";
      setTimeout(bootstrapAfterAuth, 10000);
    }
    return;
  }
  el("onboard-error").textContent = "";
  state.booted = true;
  await refreshAllFromServer();
  if (!shown) showScreen("main");
  renderTabs();
  updateSyncBadge();
  syncOutbox();
}

function resetState() {
  clearTimeout(persistTimer);
  Object.assign(state, {
    user: null, league: null, habits: [], categories: [], todos: [], entriesByHabit: {},
    leaderboard: [], leaderboardAt: 0, booted: false, dayISO: "",
  });
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") { resetState(); renderAuth(); showScreen("auth"); return; }
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
    // برگشتن به اپ هم گاهی SIGNED_IN می‌ده؛ اگه همون کاربر قبلاً وارد شده، دوباره از اول بالا نمیاریم
    if (state.booted && session && session.user && state.user && session.user.id === state.user.id) return;
    bootstrapAfterAuth();
  }
});

renderAuth();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
