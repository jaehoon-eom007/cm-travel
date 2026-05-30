import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "travel_planner_v2";
const SHEET_URL_KEY = "travel_planner_sheet_url";

const TRIP_COLORS = [
  { bg: "linear-gradient(135deg,#667eea,#764ba2)", accent: "#667eea" },
  { bg: "linear-gradient(135deg,#f093fb,#f5576c)", accent: "#f5576c" },
  { bg: "linear-gradient(135deg,#4facfe,#00f2fe)", accent: "#4facfe" },
  { bg: "linear-gradient(135deg,#43e97b,#38f9d7)", accent: "#43e97b" },
  { bg: "linear-gradient(135deg,#fa709a,#fee140)", accent: "#fa709a" },
  { bg: "linear-gradient(135deg,#a18cd1,#fbc2eb)", accent: "#a18cd1" },
  { bg: "linear-gradient(135deg,#fda085,#f6d365)", accent: "#fda085" },
  { bg: "linear-gradient(135deg,#89f7fe,#66a6ff)", accent: "#66a6ff" },
];
const DAY_COLORS = ["#FF6B6B","#FF9F43","#FFC312","#A3CB38","#1DD1A1","#00D2D3","#54A0FF","#5F27CD","#FF9FF3","#FF6348"];
const TRIP_EMOJIS = ["✈️","🗺️","🏖️","🏔️","🌸","🗼","🗽","🎌","🏝️","🌏","🎡","🏯"];

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function addDays(dateStr, n) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}
function formatDateShort(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}
function newDay(idx) {
  return { id: generateId(), date: "", title: "", schedule: [], photos: [], memo: "", color: DAY_COLORS[idx % DAY_COLORS.length] };
}
function newTrip(overrides = {}) {
  return {
    id: generateId(), title: "새 여행",
    emoji: TRIP_EMOJIS[Math.floor(Math.random() * TRIP_EMOJIS.length)],
    colorIdx: 0, days: [newDay(0)], createdAt: new Date().toISOString(), ...overrides,
  };
}

const S = {
  btn: (bg, extra = {}) => ({ padding: "9px 16px", background: bg, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", ...extra }),
  circle: (bg) => ({ width: 36, height: 36, borderRadius: "50%", background: bg, border: "none", color: "#fff", fontSize: 22, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }),
  ghost: (extra = {}) => ({ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 14, padding: "0 2px", ...extra }),
  input: (extra = {}) => ({ border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none", background: "#fff", ...extra }),
  hdr: () => ({ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 10, color: "#fff", width: 36, height: 36, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }),
};

function TripDetail({ trip, onUpdate, onBack }) {
  const [days, setDays] = useState(trip.days);
  const [activeDay, setActiveDay] = useState(0);
  const [activeTab, setActiveTab] = useState("schedule");
  const [tripTitle, setTripTitle] = useState(trip.title);
  const [tripEmoji, setTripEmoji] = useState(trip.emoji);
  const [tripColorIdx, setTripColorIdx] = useState(trip.colorIdx || 0);

  const sync = (newDays, meta = {}) => {
    onUpdate({ ...trip, title: meta.title ?? tripTitle, emoji: meta.emoji ?? tripEmoji, colorIdx: meta.colorIdx ?? tripColorIdx, days: newDays });
  };

  // 날짜 재계산 로직
  const reindexDates = (dayList) => {
    let lastDate = dayList[0].date;
    return dayList.map((d, i) => {
      if (i === 0) return d;
      const newDate = addDays(lastDate, 1);
      lastDate = newDate;
      return { ...d, date: newDate };
    });
  };

  const setDay = (idx, patch) => {
    setDays(prev => {
      let nd = prev.map((d, i) => i === idx ? { ...d, ...patch } : d);
      if ("date" in patch && nd[0].date) nd = reindexDates(nd);
      sync(nd);
      return nd;
    });
  };

  const addDay = () => {
    setDays(prev => {
      const lastDay = prev[prev.length - 1];
      const nextDate = lastDay.date ? addDays(lastDay.date, 1) : "";
      const nd = [...prev, { ...newDay(prev.length), date: nextDate }];
      sync(nd);
      setActiveDay(nd.length - 1);
      return nd;
    });
  };

  const removeDay = (idx) => {
    if (days.length === 1) return;
    setDays(prev => {
      let nd = prev.filter((_, i) => i !== idx);
      if (nd[0].date) nd = reindexDates(nd);
      sync(nd);
      setActiveDay(a => Math.min(a, nd.length - 1));
      return nd;
    });
  };

  const col = TRIP_COLORS[tripColorIdx];
  const cur = days[activeDay] || days[0];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fc" }}>
      <div style={{ background: col.bg, padding: "16px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <button onClick={onBack} style={S.hdr()}>←</button>
          <h1 style={{ color: "#fff" }}>{tripEmoji} {tripTitle}</h1>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {days.map((day, i) => (
              <button key={day.id} onClick={() => setActiveDay(i)} 
                style={{ padding: "7px 14px", borderRadius: 20, border: activeDay === i ? "2px solid #fff" : "none", background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                Day {i + 1}
              </button>
            ))}
            <button onClick={addDay} style={{ background: "transparent", border: "1px dashed #fff", color: "#fff", borderRadius: 20, padding: "7px 14px" }}>+</button>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "20px auto", padding: 16 }}>
        <input type="date" value={cur.date} onChange={e => setDay(activeDay, { date: e.target.value })} style={S.input()} />
        {/* 나머지 컴포넌트 렌더링 생략 (기존 로직 사용) */}
      </div>
    </div>
  );
}

export default function App() {
  const [trips, setTrips] = useState([]);
  const [openTripId, setOpenTripId] = useState(null);

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) setTrips(JSON.parse(s));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  }, [trips]);

  const addTrip = () => {
    const t = newTrip();
    setTrips([...trips, t]);
    setOpenTripId(t.id);
  };

  const updateTrip = useCallback((updated) => {
    setTrips(prev => prev.map(t => t.id === updated.id ? updated : t));
  }, []);

  const openTrip = trips.find(t => t.id === openTripId);
  if (openTrip) return <TripDetail trip={openTrip} onUpdate={updateTrip} onBack={() => setOpenTripId(null)} />;
  
  return (
    <div>
      {trips.map(t => <div key={t.id} onClick={() => setOpenTripId(t.id)}>{t.title}</div>)}
      <button onClick={addTrip}>여행 추가</button>
    </div>
  );
}
