import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────
const STORAGE_KEY = "travel_planner_v2";
const SHEET_URL_KEY = "travel_planner_sheet_url";

const TRIP_COLORS = [
  { bg: "linear-gradient(135deg,#667eea,#764ba2)", accent: "#667eea", label: "보라" },
  { bg: "linear-gradient(135deg,#f093fb,#f5576c)", accent: "#f5576c", label: "핑크" },
  { bg: "linear-gradient(135deg,#4facfe,#00f2fe)", accent: "#4facfe", label: "파랑" },
  { bg: "linear-gradient(135deg,#43e97b,#38f9d7)", accent: "#43e97b", label: "초록" },
  { bg: "linear-gradient(135deg,#fa709a,#fee140)", accent: "#fa709a", label: "석양" },
  { bg: "linear-gradient(135deg,#a18cd1,#fbc2eb)", accent: "#a18cd1", label: "라벤더" },
  { bg: "linear-gradient(135deg,#fda085,#f6d365)", accent: "#fda085", label: "오렌지" },
  { bg: "linear-gradient(135deg,#89f7fe,#66a6ff)", accent: "#66a6ff", label: "하늘" },
];

const DAY_COLORS = [
  "#FF6B6B","#FF9F43","#FFC312","#A3CB38","#1DD1A1",
  "#00D2D3","#54A0FF","#5F27CD","#FF9FF3","#FF6348",
];

const TRIP_EMOJIS = ["✈️","🗺️","🏖️","🏔️","🌸","🗼","🗽","🎌","🏝️","🌏","🎡","🏯"];

// ─── Helpers ──────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}
function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}
function newTrip(overrides = {}) {
  return {
    id: generateId(),
    title: "새 여행",
    emoji: TRIP_EMOJIS[Math.floor(Math.random() * TRIP_EMOJIS.length)],
    colorIdx: 0,
    days: [newDay(0)],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
function newDay(idx) {
  return {
    id: generateId(),
    date: "",
    title: "",
    schedule: [],
    photos: [],
    memo: "",
    color: DAY_COLORS[idx % DAY_COLORS.length],
  };
}

// ─── Google Sheets ────────────────────────────────────────────────────
async function syncToSheet(url, data) {
  if (!url) return { ok: false, error: "URL 없음" };
  try {
    await fetch(url, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", data: JSON.stringify(data) }),
    });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}
async function loadFromSheet(url) {
  if (!url) return null;
  try {
    const r = await fetch(url + "?action=load");
    const j = await r.json();
    return j.data ? JSON.parse(j.data) : null;
  } catch { return null; }
}

// ─── Export ───────────────────────────────────────────────────────────
function exportTripHTML(trip) {
  const color = TRIP_COLORS[trip.colorIdx || 0].accent;
  const days = trip.days.map((day, i) => {
    const items = (day.schedule || []).map(s =>
      `<li>${s.time ? `<b>${s.time}</b> ` : ""}${s.text}${s.done ? " ✓" : ""}</li>`
    ).join("");
    const memo = day.memo ? `<p class="memo">${day.memo.replace(/\n/g,"<br>")}</p>` : "";
    return `<div class="day">
  <h2>Day ${i+1}${day.date ? ` · ${formatDate(day.date)}` : ""}${day.title ? ` — ${day.title}` : ""}</h2>
  ${items ? `<ul>${items}</ul>` : ""}${memo}
</div>`;
  }).join("\n");
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${trip.emoji} ${trip.title}</title>
<style>
body{font-family:'Apple SD Gothic Neo',sans-serif;max-width:680px;margin:0 auto;padding:20px 16px;color:#2d3748;background:#f9fafb}
h1{color:${color};font-size:26px}
.day{background:#fff;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid ${color}}
h2{color:#2d3748;font-size:17px;margin:0 0 12px}
ul{margin:0;padding-left:20px;line-height:2.2;color:#4a5568}
.memo{color:#666;font-size:14px;line-height:1.8;margin:12px 0 0;border-top:1px solid #f0f0f0;padding-top:12px}
</style></head><body>
<h1>${trip.emoji} ${trip.title}</h1>
<p style="color:#999;font-size:13px">${trip.days.length}일 여행</p>
${days}
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = trip.title + ".html"; a.click();
  URL.revokeObjectURL(url);
}
function exportAllJSON(trips) {
  const blob = new Blob([JSON.stringify({ trips }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "all_travels.json"; a.click();
  URL.revokeObjectURL(url);
}

// ─── Inline style helpers ─────────────────────────────────────────────
const S = {
  btn: (bg, extra = {}) => ({
    padding: "9px 16px", background: bg, border: "none", borderRadius: 10,
    color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", ...extra,
  }),
  circle: (bg) => ({
    width: 36, height: 36, borderRadius: "50%", background: bg,
    border: "none", color: "#fff", fontSize: 22, cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  }),
  ghost: (extra = {}) => ({
    background: "none", border: "none", color: "#bbb", cursor: "pointer",
    fontSize: 14, padding: "0 2px", ...extra,
  }),
  input: (extra = {}) => ({
    border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "9px 12px",
    fontSize: 14, outline: "none", background: "#fff", ...extra,
  }),
  hdr: () => ({
    background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 10,
    color: "#fff", width: 36, height: 36, cursor: "pointer", fontSize: 16,
    display: "flex", alignItems: "center", justifyContent: "center",
  }),
};

// ─── PhotoGrid ────────────────────────────────────────────────────────
function PhotoGrid({ photos, onAdd, onDelete }) {
  const fileRef = useRef();
  const handleFiles = (files) => {
    Array.from(files).forEach(f => {
      if (!f.type.startsWith("image/")) return;
      const r = new FileReader();
      r.onload = e => onAdd({ id: generateId(), src: e.target.result, name: f.name });
      r.readAsDataURL(f);
    });
  };
  useEffect(() => {
    const h = e => {
      for (const item of (e.clipboardData?.items || [])) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          const r = new FileReader();
          r.onload = ev => onAdd({ id: generateId(), src: ev.target.result, name: "클립보드" });
          r.readAsDataURL(blob);
        }
      }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [onAdd]);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => fileRef.current.click()} style={S.btn("#54A0FF")}>📁 사진 업로드</button>
        <button onClick={() => alert("Ctrl+V / ⌘+V 로 클립보드 이미지를 붙여넣기 하세요")} style={S.btn("#A3CB38")}>📋 클립보드</button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={e => handleFiles(e.target.files)} />
      </div>
      {photos.length === 0
        ? <div style={{ textAlign: "center", color: "#ccc", padding: "32px 0", fontSize: 13 }}>사진을 추가해보세요 📷</div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
            {photos.map(p => (
              <div key={p.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden" }}>
                <img src={p.src} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => onDelete(p.id)} style={{
                  position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)",
                  border: "none", borderRadius: "50%", width: 22, height: 22,
                  color: "#fff", cursor: "pointer", fontSize: 11,
                }}>✕</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ─── Memo ─────────────────────────────────────────────────────────────
function Memo({ value, onChange }) {
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder="메모를 자유롭게 입력하세요..."
        style={{
          width: "100%", minHeight: 160, border: "1.5px solid #e2e8f0",
          borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 1.8,
          resize: "vertical", outline: "none", boxSizing: "border-box",
          fontFamily: "inherit", color: "#2d3748", background: "#fafafa",
        }} />
    </div>
  );
}

// ─── Schedule ─────────────────────────────────────────────────────────
function Schedule({ items, onChange, accent }) {
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onChange([...items, { id: generateId(), time, text: text.trim(), done: false }]);
    setText(""); setTime("");
  };
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={S.input({ width: 100, flexShrink: 0 })} />
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder="일정 추가..."
          style={S.input({ flex: 1 })} />
        <button onClick={add} style={S.circle(accent || "#667eea")}>+</button>
      </div>
      {items.length === 0
        ? <div style={{ textAlign: "center", color: "#ccc", padding: "24px 0", fontSize: 13 }}>일정을 추가해보세요 🗓</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: item.done ? "#f0fff4" : "#fff",
                border: "1px solid " + (item.done ? "#9ae6b4" : "#e2e8f0"),
                borderRadius: 10, padding: "10px 12px",
              }}>
                <button onClick={() => onChange(items.map(i => i.id === item.id ? { ...i, done: !i.done } : i))}
                  style={{
                    width: 22, height: 22, borderRadius: "50%", border: "2px solid",
                    borderColor: item.done ? "#38a169" : "#cbd5e0",
                    background: item.done ? "#38a169" : "transparent",
                    cursor: "pointer", flexShrink: 0, color: "#fff", fontSize: 11,
                  }}>{item.done ? "✓" : ""}</button>
                {item.time && <span style={{ fontSize: 12, color: accent || "#667eea", fontWeight: 600, minWidth: 42 }}>{item.time}</span>}
                <span style={{
                  flex: 1, fontSize: 14, color: "#2d3748",
                  textDecoration: item.done ? "line-through" : "none",
                  opacity: item.done ? 0.5 : 1,
                }}>{item.text}</span>
                <button onClick={() => onChange(items.filter(i => i.id !== item.id))} style={S.ghost()}>✕</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ─── TripCard (Home) ──────────────────────────────────────────────────
function TripCard({ trip, onOpen, onDelete }) {
  const col = TRIP_COLORS[trip.colorIdx || 0];
  const firstDate = trip.days.find(d => d.date)?.date;
  const lastDate = [...trip.days].reverse().find(d => d.date)?.date;
  const totalSchedule = trip.days.reduce((n, d) => n + (d.schedule?.length || 0), 0);
  const totalPhotos = trip.days.reduce((n, d) => n + (d.photos?.length || 0), 0);

  return (
    <div style={{
      borderRadius: 18, overflow: "hidden", marginBottom: 14,
      boxShadow: "0 4px 20px rgba(0,0,0,0.10)", cursor: "pointer",
    }} onClick={() => onOpen(trip.id)}>
      {/* Gradient header */}
      <div style={{ background: col.bg, padding: "20px 18px 16px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 32, marginBottom: 4 }}>{trip.emoji}</div>
            <h2 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>{trip.title}</h2>
            {firstDate && (
              <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                {formatDateShort(firstDate)}{lastDate && lastDate !== firstDate ? ` ~ ${formatDateShort(lastDate)}` : ""}
              </p>
            )}
          </div>
          <button onClick={e => { e.stopPropagation(); if (confirm("이 여행을 삭제할까요?")) onDelete(trip.id); }}
            style={{ background: "rgba(0,0,0,0.2)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 8px", cursor: "pointer", fontSize: 13 }}>
            🗑
          </button>
        </div>
      </div>
      {/* Stats footer */}
      <div style={{ background: "#fff", padding: "12px 18px", display: "flex", gap: 16 }}>
        <span style={{ fontSize: 13, color: "#667eea", fontWeight: 600 }}>📅 {trip.days.length}일</span>
        <span style={{ fontSize: 13, color: "#999" }}>🗓 {totalSchedule}개 일정</span>
        <span style={{ fontSize: 13, color: "#999" }}>📷 {totalPhotos}장</span>
      </div>
    </div>
  );
}

// ─── TripDetail ───────────────────────────────────────────────────────
function TripDetail({ trip, onUpdate, onBack }) {
  const [activeDay, setActiveDay] = useState(0);
  const [activeTab, setActiveTab] = useState("schedule");
  const [editingTitle, setEditingTitle] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const col = TRIP_COLORS[trip.colorIdx || 0];
  const cur = trip.days[activeDay] || trip.days[0];

  const updateTrip = (patch) => onUpdate({ ...trip, ...patch });

  const updateDay = useCallback((idx, patch) => {
    const nd = [...trip.days];
    nd[idx] = { ...nd[idx], ...patch };
    if ("date" in patch && idx === 0 && nd[0].date) {
      for (let i = 1; i < nd.length; i++) {
        nd[i] = { ...nd[i], date: addDays(nd[0].date, i) };
      }
    }
    onUpdate({ ...trip, days: nd });
  }, [trip, onUpdate]);

  const addDay = () => {
    const last = trip.days[trip.days.length - 1];
    const nextDate = last.date ? addDays(last.date, 1) : "";
    const nd = [...trip.days, { ...newDay(trip.days.length), date: nextDate }];
    onUpdate({ ...trip, days: nd });
    setActiveDay(nd.length - 1);
  };

  const removeDay = (idx) => {
    if (trip.days.length === 1) return;
    const nd = trip.days.filter((_, i) => i !== idx);
    onUpdate({ ...trip, days: nd });
    setActiveDay(Math.min(activeDay, nd.length - 1));
  };

  const copyShareLink = () => {
    const data = btoa(encodeURIComponent(JSON.stringify({
      trip: { ...trip, days: trip.days.map(d => ({ ...d, photos: [] })) }
    })));
    const url = location.href.split("?")[0] + "?share=" + data;
    navigator.clipboard.writeText(url).then(() => alert("링크 복사 완료! (사진 제외)"));
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", fontFamily: "inherit", background: "#f7f8fc" }}>
      {/* Header */}
      <div style={{ background: col.bg, padding: "16px 16px 0", position: "relative" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={onBack} style={S.hdr()}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => {
                const emojis = TRIP_EMOJIS;
                const cur = emojis.indexOf(trip.emoji);
                updateTrip({ emoji: emojis[(cur + 1) % emojis.length] });
              }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>
                {trip.emoji}
              </button>
              {editingTitle
                ? <input autoFocus value={trip.title}
                    onChange={e => updateTrip({ title: e.target.value })}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
                    style={{
                      background: "rgba(255,255,255,0.2)", border: "none",
                      borderBottom: "2px solid #fff", color: "#fff", fontSize: 18,
                      fontWeight: 700, outline: "none", borderRadius: 0, padding: "2px 4px", flex: 1,
                    }} />
                : <h1 onClick={() => setEditingTitle(true)}
                    style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>
                    {trip.title} <span style={{ fontSize: 13, opacity: 0.7 }}>✏️</span>
                  </h1>
              }
            </div>
            <p style={{ margin: "3px 0 0", color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
              {trip.days.length}일 여행
              {trip.days[0].date ? " · " + formatDateShort(trip.days[0].date) + " 출발" : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowColorPicker(!showColorPicker)} style={S.hdr()}>🎨</button>
            <button onClick={() => setShowExport(!showExport)} style={S.hdr()}>↗</button>
          </div>
        </div>

        {/* Color picker */}
        {showColorPicker && (
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 14, padding: 12, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {TRIP_COLORS.map((c, i) => (
              <button key={i} onClick={() => { updateTrip({ colorIdx: i }); setShowColorPicker(false); }}
                style={{
                  width: 36, height: 36, borderRadius: "50%", border: trip.colorIdx === i ? "3px solid #fff" : "3px solid transparent",
                  background: c.bg, cursor: "pointer",
                }} />
            ))}
          </div>
        )}

        {/* Export panel */}
        {showExport && (
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <p style={{ margin: "0 0 10px", color: "#fff", fontSize: 13, fontWeight: 600 }}>📤 내보내기 / 공유</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={copyShareLink} style={S.btn("rgba(255,255,255,0.25)")}>🔗 공유 링크 복사</button>
              <button onClick={() => exportTripHTML(trip)} style={S.btn("rgba(255,255,255,0.25)")}>📄 HTML 저장</button>
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(trip, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = trip.title + ".json"; a.click();
              }} style={S.btn("rgba(255,255,255,0.25)")}>💾 JSON 백업</button>
            </div>
          </div>
        )}

        {/* Day tabs */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
          {trip.days.map((day, i) => {
            const active = activeDay === i;
            return (
              <button key={day.id} onClick={() => setActiveDay(i)}
                style={{
                  flexShrink: 0, padding: "7px 14px", borderRadius: 20,
                  border: "2px solid " + (active ? "#fff" : "rgba(255,255,255,0.35)"),
                  background: active ? "rgba(255,255,255,0.25)" : "transparent",
                  color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s",
                }}>
                Day {i + 1}
                {day.date && (
                  <span style={{ display: "block", fontSize: 10, fontWeight: 400, opacity: 0.85 }}>
                    {new Date(day.date + "T00:00:00").toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                  </span>
                )}
              </button>
            );
          })}
          <button onClick={addDay}
            style={{
              flexShrink: 0, padding: "7px 14px", borderRadius: 20,
              border: "2px dashed rgba(255,255,255,0.4)", background: "transparent",
              color: "#fff", fontSize: 18, cursor: "pointer",
            }}>+</button>
        </div>
      </div>

      {/* Day content card */}
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", marginTop: -4, minHeight: "calc(100vh - 260px)" }}>
        {/* Day header */}
        <div style={{ padding: "16px 16px 0", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: cur.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input type="date" value={cur.date}
                  onChange={e => updateDay(activeDay, { date: e.target.value })}
                  style={{ border: "none", outline: "none", fontSize: 13, color: col.accent, fontWeight: 600, background: "transparent" }} />
                {activeDay === 0 && cur.date && (
                  <span style={{ fontSize: 10, color: "#bbb" }}>← 설정 시 이후 날짜 자동 업데이트</span>
                )}
              </div>
              <input value={cur.title} onChange={e => updateDay(activeDay, { title: e.target.value })}
                placeholder="이 날의 테마 (예: 도쿄 탐방 🗼)"
                style={{ border: "none", outline: "none", fontSize: 16, fontWeight: 600, color: "#2d3748", width: "100%", background: "transparent", marginTop: 2 }} />
            </div>
            {trip.days.length > 1 && (
              <button onClick={() => removeDay(activeDay)} style={S.ghost({ fontSize: 18 })}>🗑</button>
            )}
          </div>
          {/* Sub-tabs */}
          <div style={{ display: "flex" }}>
            {[["schedule","📅 일정"],["photos","🖼 사진"],["memo","📝 메모"]].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{
                  flex: 1, padding: "10px 0", border: "none", background: "none",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  color: activeTab === key ? col.accent : "#bbb",
                  borderBottom: "2px solid " + (activeTab === key ? col.accent : "transparent"),
                  transition: "all 0.2s",
                }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ paddingTop: 16 }}>
          {activeTab === "schedule" && (
            <Schedule items={cur.schedule} accent={col.accent}
              onChange={v => updateDay(activeDay, { schedule: v })} />
          )}
          {activeTab === "photos" && (
            <PhotoGrid photos={cur.photos || []}
              onAdd={p => updateDay(activeDay, { photos: [...(cur.photos || []), p] })}
              onDelete={id => updateDay(activeDay, { photos: (cur.photos || []).filter(p => p.id !== id) })} />
          )}
          {activeTab === "memo" && (
            <Memo value={cur.memo} onChange={v => updateDay(activeDay, { memo: v })} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Home (Trip List) ─────────────────────────────────────────────────
function Home({ trips, onOpen, onAdd, onDelete, sheetUrl, setSheetUrl }) {
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const importRef = useRef();

  const handleSync = async (data) => {
    if (!sheetUrl) { alert("Google Sheets URL을 먼저 설정해주세요."); return; }
    setSyncStatus("동기화 중...");
    const r = await syncToSheet(sheetUrl, { trips: data });
    setSyncStatus(r.ok ? "✅ 저장 완료!" : "❌ " + r.error);
    setTimeout(() => setSyncStatus(""), 3000);
  };

  const handleLoad = async (setCb) => {
    if (!sheetUrl) return;
    setSyncStatus("불러오는 중...");
    const d = await loadFromSheet(sheetUrl);
    if (d?.trips) { setCb(d.trips); setSyncStatus("✅ 불러오기 완료!"); }
    else setSyncStatus("❌ 데이터 없음");
    setTimeout(() => setSyncStatus(""), 3000);
  };

  const importJSON = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.trips) { alert(`${d.trips.length}개 여행을 가져왔습니다.`); window._importTrips(d.trips); }
        else if (d.id && d.days) { alert("여행 1개를 가져왔습니다."); window._importTrips([...trips, d]); }
      } catch { alert("올바른 JSON 파일이 아닙니다."); }
    };
    r.readAsText(f);
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", fontFamily: "inherit", background: "#f7f8fc" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#667eea,#764ba2)", padding: "28px 18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 700 }}>✈️ 여행 기록</h1>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
              {trips.length}개의 여행
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowSettings(!showSettings)} style={S.hdr()}>⚙️</button>
          </div>
        </div>

        {showSettings && (
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 14, padding: 14, marginTop: 14 }}>
            <p style={{ margin: "0 0 8px", color: "#fff", fontSize: 13, fontWeight: 600 }}>🔗 Google Sheets 연동</p>
            <input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)}
              placeholder="Apps Script 웹앱 URL"
              style={{ ...S.input(), width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={() => handleSync(trips)} style={S.btn("#38a169")}>☁️ 전체 저장</button>
              <button onClick={() => handleLoad((t) => window._setTrips(t))} style={S.btn("#3182ce")}>📥 불러오기</button>
            </div>
            {syncStatus && <p style={{ margin: "0 0 8px", color: "#fff", fontSize: 13 }}>{syncStatus}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => exportAllJSON(trips)} style={S.btn("#9f7aea")}>💾 전체 JSON 저장</button>
              <button onClick={() => importRef.current.click()} style={S.btn("#ed8936")}>📂 JSON 가져오기</button>
              <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={importJSON} />
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Apps Script 코드 보기</summary>
              <pre style={{ fontSize: 10, background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 6, overflowX: "auto", marginTop: 6, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>{`const SS = SpreadsheetApp.getActiveSpreadsheet();
const SH = SS.getSheetByName("Sheet1") || SS.getActiveSheet();
function doGet(e){
  const d=SH.getRange("A1").getValue();
  return ContentService.createTextOutput(JSON.stringify({data:d})).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e){
  const b=JSON.parse(e.postData.contents);
  if(b.action==="save") SH.getRange("A1").setValue(b.data);
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
}`}</pre>
            </details>
          </div>
        )}
      </div>

      {/* Trip list */}
      <div style={{ padding: "16px 16px 100px" }}>
        {trips.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌏</div>
              <p style={{ fontSize: 15, margin: 0 }}>아직 여행 기록이 없어요</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>아래 + 버튼으로 추가해보세요!</p>
            </div>
          : trips.map(trip => (
              <TripCard key={trip.id} trip={trip} onOpen={onOpen} onDelete={onDelete} />
            ))
        }
      </div>

      {/* FAB */}
      <button onClick={onAdd}
        style={{
          position: "fixed", bottom: 28, right: "50%", transform: "translateX(50%)",
          maxWidth: 56, width: 56, height: 56, borderRadius: "50%",
          background: "linear-gradient(135deg,#667eea,#764ba2)",
          border: "none", color: "#fff", fontSize: 28, cursor: "pointer",
          boxShadow: "0 6px 24px rgba(102,126,234,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}>+</button>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────
export default function App() {
  const [trips, setTrips] = useState([]);
  const [openTripId, setOpenTripId] = useState(null);
  const [sheetUrl, setSheetUrl] = useState("");

  // Expose to window for settings panel callbacks
  window._setTrips = setTrips;
  window._importTrips = (t) => setTrips(t);

  // localStorage persistence
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setTrips(JSON.parse(s));
      const su = localStorage.getItem(SHEET_URL_KEY);
      if (su) setSheetUrl(su);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trips)); } catch {}
  }, [trips]);

  useEffect(() => {
    try { if (sheetUrl) localStorage.setItem(SHEET_URL_KEY, sheetUrl); } catch {}
  }, [sheetUrl]);

  // Shared plan from URL
  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search).get("share");
      if (p) {
        const d = JSON.parse(decodeURIComponent(atob(p)));
        if (d.trip) {
          const imported = { ...d.trip, id: generateId(), title: d.trip.title + " (공유됨)" };
          setTrips(prev => {
            const already = prev.find(t => t.title === imported.title);
            if (already) return prev;
            return [...prev, imported];
          });
          setOpenTripId(imported.id);
        }
      }
    } catch {}
  }, []);

  const addTrip = () => {
    const t = newTrip({ colorIdx: trips.length % TRIP_COLORS.length });
    setTrips(prev => [...prev, t]);
    setOpenTripId(t.id);
  };

  const updateTrip = useCallback((updated) => {
    setTrips(prev => prev.map(t => t.id === updated.id ? updated : t));
  }, []);

  const deleteTrip = (id) => {
    setTrips(prev => prev.filter(t => t.id !== id));
    if (openTripId === id) setOpenTripId(null);
  };

  const openTrip = trips.find(t => t.id === openTripId);

  if (openTrip) {
    return (
      <TripDetail
        trip={openTrip}
        onUpdate={updateTrip}
        onBack={() => setOpenTripId(null)}
      />
    );
  }

  return (
    <Home
      trips={trips}
      onOpen={setOpenTripId}
      onAdd={addTrip}
      onDelete={deleteTrip}
      sheetUrl={sheetUrl}
      setSheetUrl={setSheetUrl}
    />
  );
}