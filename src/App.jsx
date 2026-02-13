import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CATEGORIES = [
  {
    name: "Home",
    color: "#06B6D4",
    habits: [
      { id: "h1", name: "Kitchen reset", subtitle: "dishes, counters, stovetop", icon: "🍳", color: "#06B6D4" },
      { id: "h2", name: "Bathroom clean", icon: "🚿", color: "#06B6D4" },
      { id: "h3", name: "Floors swept/vacuumed", icon: "🧹", color: "#06B6D4" },
      { id: "h4", name: "Clutter cleared", icon: "📦", color: "#06B6D4" },
      { id: "h5", name: "Laundry kept up", icon: "👕", color: "#06B6D4" },
      { id: "h6", name: "Trash", icon: "🗑️", color: "#06B6D4" },
      { id: "h7", name: "Storage organizing goal", icon: "🗄️", color: "#06B6D4", hasField: true, fieldPlaceholder: "Today's organizing goal..." },
    ]
  },
  {
    name: "Health",
    color: "#E85D3A",
    habits: [
      { id: "w1", name: "Exercise (45 min)", icon: "🏋️", color: "#E85D3A", hasField: true, fieldPlaceholder: "Type: run, lift, yoga..." },
      { id: "w2", name: "Meal prep/cooking", icon: "🥗", color: "#E85D3A" },
      { id: "w3", name: "Sleep on schedule", icon: "💤", color: "#E85D3A" },
    ]
  },
  {
    name: "Career",
    color: "#8B5CF6",
    habits: [
      { id: "c1", name: "LinkedIn engagement", icon: "💬", color: "#8B5CF6" },
      { id: "c2", name: "LinkedIn post/share", icon: "📣", color: "#8B5CF6" },
      { id: "c3", name: "Learning (45 min)", icon: "📖", color: "#8B5CF6", hasField: true, fieldPlaceholder: "Topic: course, article..." },
      { id: "c4", name: "Applications sent", icon: "📨", color: "#8B5CF6", hasField: true, fieldPlaceholder: "# sent or company names..." },
      { id: "c5", name: "Portfolio/side project", icon: "🧑‍💻", color: "#8B5CF6" },
    ]
  },
  {
    name: "Finance",
    color: "#10B981",
    habits: [
      { id: "f1", name: "Budget check (weekly)", icon: "💰", color: "#10B981" },
    ]
  }
];

const ALL_HABITS = CATEGORIES.flatMap(c => c.habits);

// ── Persistence helpers ──
const STORAGE_KEYS = {
  completions: "ht_completions",
  fields: "ht_fields",
  notes: "ht_notes",
};

function loadJSON(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJSON(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ── Date helpers ──
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getWeekStart(d) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0,0,0,0);
  return r;
}

function getMonthDays(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function parseDate(dk) {
  const [y, m, d] = dk.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Components ──
function MiniBar({ value, max, color, height = 60 }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ width: 18, height, background: "rgba(255,255,255,0.06)", borderRadius: 9, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ width: "100%", height: `${pct}%`, background: color, borderRadius: 9, transition: "height 0.5s cubic-bezier(.4,0,.2,1)", minHeight: pct > 0 ? 4 : 0 }} />
      </div>
    </div>
  );
}

function CircleProgress({ value, max, size = 80, stroke = 6, color = "#E85D3A", children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)" }} />
      {children && <g style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>{children}</g>}
    </svg>
  );
}

// ── Main App ──
export default function HabitTracker() {
  const [completions, setCompletions] = useState(() => loadJSON(STORAGE_KEYS.completions));
  const [fieldValues, setFieldValues] = useState(() => loadJSON(STORAGE_KEYS.fields));
  const [notes, setNotes] = useState(() => loadJSON(STORAGE_KEYS.notes));
  const [today] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [view, setView] = useState("today");
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [showData, setShowData] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef(null);

  const todayKey = dateKey(today);
  const habits = ALL_HABITS;

  // ── Persist on change ──
  useEffect(() => { saveJSON(STORAGE_KEYS.completions, completions); }, [completions]);
  useEffect(() => { saveJSON(STORAGE_KEYS.fields, fieldValues); }, [fieldValues]);
  useEffect(() => { saveJSON(STORAGE_KEYS.notes, notes); }, [notes]);

  // ── Toast helper ──
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ── Core actions ──
  const toggleCompletion = useCallback((habitId, dk) => {
    setCompletions(prev => {
      const key = `${dk}:${habitId}`;
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  const isCompleted = useCallback((habitId, dk) => {
    return !!completions[`${dk}:${habitId}`];
  }, [completions]);

  const setField = useCallback((habitId, dk, value) => {
    setFieldValues(prev => ({ ...prev, [`${dk}:${habitId}`]: value }));
  }, []);

  const getField = useCallback((habitId, dk) => {
    return fieldValues[`${dk}:${habitId}`] || "";
  }, [fieldValues]);

  const setNote = useCallback((dk, field, value) => {
    setNotes(prev => ({ ...prev, [`${dk}:${field}`]: value }));
  }, []);

  const getNote = useCallback((dk, field) => {
    return notes[`${dk}:${field}`] || "";
  }, [notes]);

  // ── Export / Import ──
  const exportData = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      completions,
      fieldValues,
      notes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habit-tracker-backup-${dateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Data exported successfully!");
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.completions) setCompletions(data.completions);
        if (data.fieldValues) setFieldValues(data.fieldValues);
        if (data.notes) setNotes(data.notes);
        showToast("Data imported successfully!");
      } catch {
        showToast("Error: Invalid backup file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Streaks ──
  const getStreak = useCallback((habitId) => {
    let streak = 0;
    let d = new Date(today);
    while (true) {
      const dk = dateKey(d);
      if (isCompleted(habitId, dk)) {
        streak++;
        d = addDays(d, -1);
      } else if (dk === todayKey) {
        d = addDays(d, -1);
      } else {
        break;
      }
    }
    return streak;
  }, [today, todayKey, isCompleted]);

  // ── History lookup ──
  const historyDayData = useMemo(() => {
    if (!historyDate) return null;
    const dk = historyDate;
    const d = parseDate(dk);
    return {
      date: d,
      key: dk,
      label: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      categories: CATEGORIES.map(cat => ({
        ...cat,
        habits: cat.habits.map(h => ({
          ...h,
          completed: isCompleted(h.id, dk),
          fieldValue: getField(h.id, dk),
        }))
      })),
      winNote: getNote(dk, "win"),
      focusNote: getNote(dk, "focus"),
    };
  }, [historyDate, isCompleted, getField, getNote]);

  // ── Aggregated data ──
  const todayCount = useMemo(() => habits.filter(h => isCompleted(h.id, todayKey)).length, [habits, isCompleted, todayKey]);

  const weekData = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(selectedWeekStart, i);
      const dk = dateKey(d);
      const completed = habits.filter(h => isCompleted(h.id, dk)).length;
      days.push({ date: d, key: dk, completed, dayName: DAYS[d.getDay()], dayNum: d.getDate(), isToday: dk === todayKey });
    }
    return days;
  }, [selectedWeekStart, habits, isCompleted, todayKey]);

  const monthData = useMemo(() => {
    const { year, month } = selectedMonth;
    const totalDays = getMonthDays(year, month);
    const days = [];
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dk = dateKey(d);
      const completed = habits.filter(h => isCompleted(h.id, dk)).length;
      days.push({ date: d, key: dk, completed, dayNum: i, isToday: dk === todayKey, dayOfWeek: d.getDay() });
    }
    return days;
  }, [selectedMonth, habits, isCompleted, todayKey]);

  const weeklyByCategory = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      habits: cat.habits.map(h => {
        let count = 0;
        for (let i = 0; i < 7; i++) {
          if (isCompleted(h.id, dateKey(addDays(selectedWeekStart, i)))) count++;
        }
        return { ...h, count };
      })
    }));
  }, [selectedWeekStart, isCompleted]);

  const monthlyHabitBreakdown = useMemo(() => {
    const { year, month } = selectedMonth;
    const totalDays = getMonthDays(year, month);
    return CATEGORIES.map(cat => ({
      ...cat,
      habits: cat.habits.map(h => {
        let count = 0;
        for (let i = 1; i <= totalDays; i++) {
          if (isCompleted(h.id, dateKey(new Date(year, month, i)))) count++;
        }
        return { ...h, count, total: totalDays };
      })
    }));
  }, [selectedMonth, isCompleted]);

  // ── Active days count ──
  const totalActiveDays = useMemo(() => {
    const days = new Set();
    Object.keys(completions).forEach(k => {
      if (completions[k]) {
        const dk = k.split(":")[0];
        days.add(dk);
      }
    });
    return days.size;
  }, [completions]);

  // ── UI helpers ──
  const navBtn = (label, v) => (
    <button onClick={() => setView(v)} style={{
      padding: "8px 16px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
      background: view === v ? "rgba(232,93,58,0.15)" : "transparent",
      color: view === v ? "#E85D3A" : "rgba(255,255,255,0.45)", transition: "all 0.2s", whiteSpace: "nowrap"
    }}>{label}</button>
  );

  const arrowBtn = (label, onClick) => (
    <button onClick={onClick} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.5)", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>{label}</button>
  );

  const cardStyle = { padding: 20, borderRadius: 20, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 };
  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 16 };

  return (
    <div style={{
      minHeight: "100vh", background: "#0C0C0F",
      fontFamily: "'DM Sans', 'SF Pro Display', -apple-system, sans-serif",
      color: "#F0EDE8", padding: "0 0 40px 0",
      backgroundImage: "radial-gradient(ellipse at 20% 0%, rgba(232,93,58,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(139,92,246,0.04) 0%, transparent 60%)"
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999,
          padding: "10px 24px", borderRadius: 12, background: "rgba(16,185,129,0.9)", color: "#fff",
          fontSize: 13, fontWeight: 600, backdropFilter: "blur(10px)",
          animation: "fadeSlideIn 0.3s ease both"
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ padding: "32px 24px 0", maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Daily Rituals</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, background: "linear-gradient(135deg, #F0EDE8, rgba(232,93,58,0.8))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Habit Tracker
            </h1>
          </div>
          <div style={{ position: "relative" }}>
            <CircleProgress value={todayCount} max={habits.length} size={56} stroke={4} color="#E85D3A">
              <text x="28" y="28" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 800, fill: "#F0EDE8" }}>
                {todayCount}/{habits.length}
              </text>
            </CircleProgress>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
            {totalActiveDays} day{totalActiveDays !== 1 ? "s" : ""} tracked
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 99, padding: 4, marginBottom: 28, border: "1px solid rgba(255,255,255,0.06)", overflow: "auto" }}>
          {navBtn("Today", "today")}
          {navBtn("Weekly", "weekly")}
          {navBtn("Monthly", "monthly")}
          {navBtn("History", "history")}
          {navBtn("⚙", "settings")}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 24px" }}>

        {/* ═══ TODAY VIEW ═══ */}
        {view === "today" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {CATEGORIES.map((cat, ci) => (
              <div key={cat.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 3, height: 16, borderRadius: 2, background: cat.color }} />
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: cat.color }}>{cat.name}</div>
                  <div style={{ flex: 1, height: 1, background: `${cat.color}15` }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)" }}>
                    {cat.habits.filter(h => isCompleted(h.id, todayKey)).length}/{cat.habits.length}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cat.habits.map((h, i) => {
                    const done = isCompleted(h.id, todayKey);
                    const streak = getStreak(h.id);
                    return (
                      <div key={h.id} style={{ animation: `fadeSlideIn 0.4s cubic-bezier(.4,0,.2,1) ${(ci * 0.1) + (i * 0.04)}s both` }}>
                        <div onClick={() => toggleCompletion(h.id, todayKey)} style={{
                          display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer",
                          borderRadius: h.hasField ? "14px 14px 0 0" : 14,
                          background: done ? `linear-gradient(135deg, ${h.color}15, ${h.color}08)` : "rgba(255,255,255,0.025)",
                          border: `1px solid ${done ? h.color + "28" : "rgba(255,255,255,0.06)"}`,
                          borderBottom: h.hasField ? `1px solid ${done ? h.color + "15" : "rgba(255,255,255,0.03)"}` : undefined,
                          transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                            background: done ? h.color + "20" : "rgba(255,255,255,0.04)", fontSize: 18, transition: "all 0.3s", flexShrink: 0
                          }}>{h.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: done ? "#F0EDE8" : "rgba(255,255,255,0.65)" }}>{h.name}</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                              {h.subtitle && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{h.subtitle}</span>}
                              {streak > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: h.color, background: h.color + "15", padding: "1px 6px", borderRadius: 99 }}>🔥 {streak}d</span>}
                            </div>
                          </div>
                          <div style={{
                            width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                            background: done ? h.color : "transparent", border: done ? "none" : "2px solid rgba(255,255,255,0.12)",
                            transition: "all 0.3s cubic-bezier(.4,0,.2,1)", fontSize: 13, color: "#fff", flexShrink: 0
                          }}>
                            {done && "✓"}
                          </div>
                        </div>
                        {h.hasField && (
                          <div style={{
                            padding: "0 18px 12px",
                            background: done ? `linear-gradient(135deg, ${h.color}08, ${h.color}04)` : "rgba(255,255,255,0.015)",
                            border: `1px solid ${done ? h.color + "28" : "rgba(255,255,255,0.06)"}`,
                            borderTop: "none", borderRadius: "0 0 14px 14px",
                          }}>
                            <input
                              value={getField(h.id, todayKey)}
                              onChange={e => setField(h.id, todayKey, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder={h.fieldPlaceholder}
                              style={{
                                width: "100%", padding: "8px 12px", borderRadius: 8,
                                border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)",
                                color: "#F0EDE8", fontSize: 12, outline: "none", fontFamily: "inherit",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Notes */}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: "#F59E0B" }} />
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "#F59E0B" }}>Notes</div>
                <div style={{ flex: 1, height: 1, background: "rgba(245,158,11,0.1)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#F59E0B", display: "block", marginBottom: 6 }}>🏆 Win today</label>
                  <textarea value={getNote(todayKey, "win")} onChange={e => setNote(todayKey, "win", e.target.value)}
                    placeholder="What's one thing that made today a win?" rows={2}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#F0EDE8", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#F59E0B", display: "block", marginBottom: 6 }}>🎯 Tomorrow's focus</label>
                  <textarea value={getNote(todayKey, "focus")} onChange={e => setNote(todayKey, "focus", e.target.value)}
                    placeholder="Top priority for tomorrow..." rows={2}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#F0EDE8", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ WEEKLY VIEW ═══ */}
        {view === "weekly" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              {arrowBtn("← Prev", () => setSelectedWeekStart(addDays(selectedWeekStart, -7)))}
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
                {selectedWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {addDays(selectedWeekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              {arrowBtn("Next →", () => setSelectedWeekStart(addDays(selectedWeekStart, 7)))}
            </div>

            <div style={cardStyle}>
              <div style={sectionLabel}>Daily Completions</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
                {weekData.map(d => (
                  <div key={d.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: d.completed > 0 ? "#F0EDE8" : "rgba(255,255,255,0.25)" }}>{d.completed}</div>
                    <MiniBar value={d.completed} max={habits.length} color={d.isToday ? "#E85D3A" : "rgba(232,93,58,0.5)"} height={80} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: d.isToday ? "#E85D3A" : "rgba(255,255,255,0.3)" }}>{d.dayName}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{d.dayNum}</div>
                  </div>
                ))}
              </div>
            </div>

            {weeklyByCategory.map(cat => (
              <div key={cat.name} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: cat.color }} />
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: cat.color }}>{cat.name}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {cat.habits.map(h => (
                    <div key={h.id}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 15 }}>{h.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{h.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: h.color }}>{h.count}/7</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${(h.count / 7) * 100}%`, background: `linear-gradient(90deg, ${h.color}, ${h.color}aa)`, borderRadius: 99, transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        {weekData.map(d => {
                          const done = isCompleted(h.id, d.key);
                          return (
                            <div key={d.key} onClick={() => toggleCompletion(h.id, d.key)} style={{
                              flex: 1, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                              background: done ? h.color + "28" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${done ? h.color + "35" : "rgba(255,255,255,0.05)"}`,
                              cursor: "pointer", fontSize: 10, color: done ? h.color : "rgba(255,255,255,0.2)", fontWeight: 700, transition: "all 0.2s"
                            }}>{done ? "✓" : d.dayName[0]}</div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ MONTHLY VIEW ═══ */}
        {view === "monthly" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              {arrowBtn("← Prev", () => setSelectedMonth(p => { const m = p.month - 1; return m < 0 ? { year: p.year - 1, month: 11 } : { ...p, month: m }; }))}
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{MONTHS[selectedMonth.month]} {selectedMonth.year}</div>
              {arrowBtn("Next →", () => setSelectedMonth(p => { const m = p.month + 1; return m > 11 ? { year: p.year + 1, month: 0 } : { ...p, month: m }; }))}
            </div>

            <div style={cardStyle}>
              <div style={sectionLabel}>Completion Heatmap</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
                {DAYS.map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)", padding: "4px 0" }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {Array.from({ length: monthData[0]?.dayOfWeek || 0 }).map((_, i) => <div key={`e${i}`} />)}
                {monthData.map(d => {
                  const pct = habits.length > 0 ? d.completed / habits.length : 0;
                  const intensity = pct === 0 ? 0 : pct < 0.25 ? 0.2 : pct < 0.5 ? 0.4 : pct < 0.75 ? 0.6 : pct < 1 ? 0.8 : 1;
                  return (
                    <div key={d.key} onClick={() => { setHistoryDate(d.key); setView("history"); }} style={{
                      aspectRatio: "1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      background: intensity > 0 ? `rgba(232,93,58,${intensity * 0.6})` : "rgba(255,255,255,0.03)",
                      border: d.isToday ? "2px solid #E85D3A" : "1px solid rgba(255,255,255,0.04)",
                      fontSize: 11, fontWeight: d.isToday ? 700 : 500,
                      color: d.isToday ? "#E85D3A" : intensity > 0.5 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)"
                    }}>{d.dayNum}</div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Tap a day to view details</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Less</span>
                  {[0, 0.2, 0.5, 0.75, 1].map((v, i) => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 4, background: v === 0 ? "rgba(255,255,255,0.03)" : `rgba(232,93,58,${v * 0.6})` }} />
                  ))}
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>More</span>
                </div>
              </div>
            </div>

            {monthlyHabitBreakdown.map(cat => (
              <div key={cat.name} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: cat.color }} />
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: cat.color }}>{cat.name}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
                  {cat.habits.map(h => {
                    const pct = Math.round((h.count / h.total) * 100);
                    return (
                      <div key={h.id} style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <CircleProgress value={h.count} max={h.total} size={56} stroke={4} color={h.color}>
                          <text x="28" y="28" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fontWeight: 800, fill: h.color }}>{pct}%</text>
                        </CircleProgress>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15 }}>{h.icon}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{h.name}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{h.count}/{h.total} days</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {cat.habits.map(h => {
                    const pct = h.total > 0 ? (h.count / h.total) * 100 : 0;
                    return (
                      <div key={h.id}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13 }}>{h.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>{h.name}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: h.color }}>{Math.round(pct)}%</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${h.color}, ${h.color}80)`, borderRadius: 99, transition: "width 0.6s cubic-bezier(.4,0,.2,1)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ HISTORY VIEW ═══ */}
        {view === "history" && (
          <div>
            <div style={cardStyle}>
              <div style={sectionLabel}>Look Up a Day</div>
              <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)", color: "#F0EDE8", fontSize: 14, outline: "none", fontFamily: "inherit",
                  colorScheme: "dark"
                }}
              />
            </div>

            {historyDayData && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F0EDE8", marginBottom: 16 }}>{historyDayData.label}</div>
                <div style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#E85D3A" }}>
                      {historyDayData.categories.flatMap(c => c.habits).filter(h => h.completed).length}/{habits.length}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>habits completed</div>
                  </div>
                </div>

                {historyDayData.categories.map(cat => {
                  const catDone = cat.habits.filter(h => h.completed).length;
                  if (catDone === 0 && cat.habits.every(h => !h.fieldValue)) return null;
                  return (
                    <div key={cat.name} style={cardStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 3, height: 14, borderRadius: 2, background: cat.color }} />
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: cat.color }}>{cat.name}</div>
                        <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{catDone}/{cat.habits.length}</div>
                      </div>
                      {cat.habits.map(h => (
                        <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontSize: 15 }}>{h.icon}</span>
                          <span style={{ flex: 1, fontSize: 13, color: h.completed ? "#F0EDE8" : "rgba(255,255,255,0.3)" }}>{h.name}</span>
                          {h.fieldValue && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.fieldValue}</span>}
                          <span style={{ fontSize: 14, color: h.completed ? "#10B981" : "rgba(255,255,255,0.15)" }}>{h.completed ? "✓" : "—"}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {(historyDayData.winNote || historyDayData.focusNote) && (
                  <div style={cardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: "#F59E0B" }} />
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#F59E0B" }}>Notes</div>
                    </div>
                    {historyDayData.winNote && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B", marginBottom: 4 }}>🏆 Win</div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{historyDayData.winNote}</div>
                      </div>
                    )}
                    {historyDayData.focusNote && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B", marginBottom: 4 }}>🎯 Focus</div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{historyDayData.focusNote}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ SETTINGS VIEW ═══ */}
        {view === "settings" && (
          <div>
            <div style={cardStyle}>
              <div style={sectionLabel}>Data Management</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
                Your data is saved automatically in your browser. Export regularly to keep a backup you can import on any device.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={exportData} style={{
                  padding: "14px 20px", borderRadius: 12, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)",
                  color: "#10B981", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center"
                }}>
                  📥 Export Backup (JSON)
                </button>
                <button onClick={() => fileInputRef.current?.click()} style={{
                  padding: "14px 20px", borderRadius: 12, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)",
                  color: "#3B82F6", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center"
                }}>
                  📤 Import Backup
                </button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionLabel}>Danger Zone</div>
              <button onClick={() => {
                if (window.confirm("Are you sure? This will permanently delete ALL your habit data.")) {
                  setCompletions({});
                  setFieldValues({});
                  setNotes({});
                  localStorage.removeItem(STORAGE_KEYS.completions);
                  localStorage.removeItem(STORAGE_KEYS.fields);
                  localStorage.removeItem(STORAGE_KEYS.notes);
                  showToast("All data cleared");
                }
              }} style={{
                padding: "14px 20px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
                color: "#EF4444", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%"
              }}>
                🗑 Clear All Data
              </button>
            </div>

            <div style={{ ...cardStyle, background: "rgba(255,255,255,0.015)" }}>
              <div style={sectionLabel}>Stats</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#E85D3A" }}>{totalActiveDays}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Days Tracked</div>
                </div>
                <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#8B5CF6" }}>{Object.values(completions).filter(Boolean).length}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Total Check-offs</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        button:hover { filter: brightness(1.15); }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        textarea:focus, input:focus { border-color: rgba(255,255,255,0.15) !important; }
      `}</style>
    </div>
  );
}
