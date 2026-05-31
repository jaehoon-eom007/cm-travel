import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const DEVICE_ID = "shared";
const LS_TRIPS = "tp6_trips";

const PALETTE = [
  { bg:"linear-gradient(135deg,#667eea,#764ba2)", ac:"#667eea" },
  { bg:"linear-gradient(135deg,#f093fb,#f5576c)", ac:"#f5576c" },
  { bg:"linear-gradient(135deg,#4facfe,#00f2fe)", ac:"#4facfe" },
  { bg:"linear-gradient(135deg,#43e97b,#38f9d7)", ac:"#43e97b" },
  { bg:"linear-gradient(135deg,#fa709a,#fee140)", ac:"#fa709a" },
  { bg:"linear-gradient(135deg,#a18cd1,#fbc2eb)", ac:"#a18cd1" },
  { bg:"linear-gradient(135deg,#fda085,#f6d365)", ac:"#fda085" },
  { bg:"linear-gradient(135deg,#89f7fe,#66a6ff)", ac:"#66a6ff" },
];
const DAY_COLORS = ["#FF6B6B","#FF9F43","#FFC312","#A3CB38","#1DD1A1","#00D2D3","#54A0FF","#5F27CD","#FF9FF3","#FF6348"];
const EMOJIS = ["✈️","🗺️","🏖️","🏔️","🌸","🗼","🗽","🎌","🏝️","🌏","🎡","🏯"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

function addDays(base, n) {
  if (!base) return "";
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}
function recalc(days) {
  if (!days[0]?.date) return days;
  return days.map((d,i) => ({ ...d, date: i===0 ? days[0].date : addDays(days[0].date, i) }));
}
function makeDay(idx, date="") {
  return { id:uid(), date, title:"", schedule:[], photos:[], memo:"{}", color:DAY_COLORS[idx%DAY_COLORS.length] };
}
function makeTrip(colorIdx=0) {
  return { id:uid(), title:"새 여행", emoji:EMOJIS[Math.floor(Math.random()*EMOJIS.length)], colorIdx, days:[makeDay(0)], memo:"{}", createdAt:new Date().toISOString() };
}
const fmt  = s => s ? new Date(s+"T12:00:00").toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"}) : "";
const fmts = s => s ? new Date(s+"T12:00:00").toLocaleDateString("ko-KR",{year:"numeric",month:"short",day:"numeric"}) : "";

// 메모 JSON 파싱
function parseMemo(memo) {
  if (!memo) return {};
  try { return typeof memo === "object" ? memo : JSON.parse(memo); }
  catch { return { "일반": String(memo) }; }
}

async function dbSave(trips) {
  if (!supabase) return { ok:false, msg:"Supabase 미설정" };
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from("travel_data").upsert({ id:DEVICE_ID, trips:JSON.stringify(trips), updated_at:now });
    if (error) throw error;
    return { ok:true, msg:"☁️ 저장됨", savedAt:now };
  } catch(e) { return { ok:false, msg:"❌ "+e.message }; }
}
async function dbLoad() {
  if (!supabase) return { ok:false, data:null, serverAt:null };
  try {
    const { data, error } = await supabase.from("travel_data").select("trips,updated_at").eq("id",DEVICE_ID);
    if (error) throw error;
    if (!data || data.length === 0) return { ok:true, data:null, serverAt:null };
    return { ok:true, data:JSON.parse(data[0].trips), serverAt:data[0].updated_at };
  } catch(e) { return { ok:false, data:null, serverAt:null }; }
}

function exportHTML(trip) {
  const ac = PALETTE[trip.colorIdx||0].ac;
  const days = trip.days.map((d,i) => {
    const items = (d.schedule||[]).map(s =>
      `<li>${s.time?`<b>${s.time}</b> `:""}${s.text}${s.done?" ✓":""}${s.memo?`<p style="color:#888;font-size:12px;margin:2px 0">${s.memo}</p>`:""}</li>`
    ).join("");
    const memoObj = parseMemo(d.memo);
    const memoText = Object.entries(memoObj).filter(([,v])=>v.trim()).map(([k,v])=>`<p><b>[${k}]</b> ${v.replace(/\n/g,"<br>")}</p>`).join("");
    return `<div class="day"><h2>Day ${i+1}${d.date?` · ${fmt(d.date)}`:""}${d.title?` — ${d.title}`:""}</h2>${items?`<ul>${items}</ul>`:""}${memoText}</div>`;
  }).join("");
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${trip.emoji} ${trip.title}</title><style>body{font-family:'Apple SD Gothic Neo',sans-serif;max-width:680px;margin:0 auto;padding:20px;background:#f9fafb;color:#2d3748}h1{color:${ac}}.day{background:#fff;border-radius:12px;padding:18px;margin:14px 0;border-left:4px solid ${ac}}h2{font-size:16px;margin:0 0 10px}ul{margin:0;padding-left:20px;line-height:2.2}</style></head><body><h1>${trip.emoji} ${trip.title}</h1>${days}</body></html>`;
  Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([html],{type:"text/html"})),download:trip.title+".html"}).click();
}

const S = {
  btn:   (bg,ex={}) => ({padding:"9px 16px",background:bg,border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",...ex}),
  circ:  (bg)       => ({width:36,height:36,borderRadius:"50%",background:bg,border:"none",color:"#fff",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}),
  input: (ex={})    => ({border:"1.5px solid #e2e8f0",borderRadius:10,padding:"9px 12px",fontSize:14,outline:"none",background:"#fff",...ex}),
  hdr:   ()         => ({background:"rgba(255,255,255,0.18)",border:"none",borderRadius:10,color:"#fff",width:36,height:36,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}),
  ghost: (ex={})    => ({background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:14,padding:"0 2px",...ex}),
};

// ─── MemoPanel (탭별 메모 + 접기/펴기) ───────────────────────
function MemoPanel({ memo, onChange, ac, tabs, collapsible=false, defaultOpen=true }) {
  const [open,      setOpen]      = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const memoObj = parseMemo(memo);
  const cur = memoObj[activeTab] || "";
  const update = (val) => onChange(JSON.stringify({ ...memoObj, [activeTab]: val }));
  const hasDot = (tab) => !!(memoObj[tab]?.trim()) && tab !== activeTab;

  return (
    <div>
      {collapsible && (
        <button onClick={() => setOpen(!open)}
          style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#f7f8fc", border:"1.5px solid #e2e8f0", borderRadius:open?"12px 12px 0 0":12, padding:"10px 14px", cursor:"pointer", marginBottom:0 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#555" }}>
            📝 메모 {Object.values(memoObj).some(v=>v.trim()) ? "✓" : ""}
          </span>
          <span style={{ fontSize:16, color:"#bbb", transform:open?"rotate(180deg)":"none", transition:"transform 0.2s" }}>▾</span>
        </button>
      )}
      {open && (
        <div style={{ border:"1.5px solid #e2e8f0", borderTop: collapsible ? "none" : "1.5px solid #e2e8f0", borderRadius: collapsible ? "0 0 12px 12px" : 12, overflow:"hidden" }}>
          {/* 탭 */}
          <div style={{ display:"flex", background:"#f7f8fc", borderBottom:"1px solid #e2e8f0" }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                style={{ flex:1, padding:"8px 4px", border:"none", background:activeTab===t?"#fff":"transparent", fontSize:12, fontWeight:600, cursor:"pointer", color:activeTab===t?ac:"#aaa", borderBottom:activeTab===t?`2px solid ${ac}`:"2px solid transparent", position:"relative" }}>
                {t}
                {hasDot(t) && <span style={{ position:"absolute", top:4, right:4, width:5, height:5, borderRadius:"50%", background:ac }} />}
              </button>
            ))}
          </div>
          <textarea value={cur} onChange={e => update(e.target.value)}
            placeholder={`${activeTab} 메모를 입력하세요...`}
            style={{ width:"100%", minHeight:110, border:"none", padding:12, fontSize:14, lineHeight:1.8, resize:"vertical", outline:"none", boxSizing:"border-box", fontFamily:"inherit", color:"#2d3748", background:"#fff" }} />
        </div>
      )}
    </div>
  );
}

// ─── PhotoViewer (전체화면 뷰어) ─────────────────────────────
function PhotoViewer({ photos, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  useEffect(() => {
    const h = e => {
      if (e.key === "ArrowRight") setIdx(i => Math.min(i+1, photos.length-1));
      if (e.key === "ArrowLeft")  setIdx(i => Math.max(i-1, 0));
      if (e.key === "Escape")     onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [photos.length, onClose]);

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:1000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      {/* 닫기 */}
      <button onClick={onClose} style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:40, height:40, color:"#fff", fontSize:20, cursor:"pointer" }}>✕</button>

      {/* 사진 */}
      <img src={photos[idx].src} alt={photos[idx].name}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth:"92vw", maxHeight:"78vh", objectFit:"contain", borderRadius:10 }} />

      {/* 이름 */}
      <p style={{ color:"rgba(255,255,255,0.6)", fontSize:13, marginTop:12 }}>{photos[idx].name}</p>

      {/* 이전/다음 버튼 */}
      <div style={{ display:"flex", gap:16, marginTop:8 }}>
        <button onClick={e => { e.stopPropagation(); setIdx(i => Math.max(i-1,0)); }}
          disabled={idx===0}
          style={{ padding:"8px 20px", border:"none", borderRadius:20, background:idx===0?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.25)", color:"#fff", fontSize:14, cursor:idx===0?"default":"pointer" }}>◀ 이전</button>
        <span style={{ color:"rgba(255,255,255,0.5)", fontSize:13, lineHeight:"36px" }}>{idx+1} / {photos.length}</span>
        <button onClick={e => { e.stopPropagation(); setIdx(i => Math.min(i+1, photos.length-1)); }}
          disabled={idx===photos.length-1}
          style={{ padding:"8px 20px", border:"none", borderRadius:20, background:idx===photos.length-1?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.25)", color:"#fff", fontSize:14, cursor:idx===photos.length-1?"default":"pointer" }}>다음 ▶</button>
      </div>
    </div>
  );
}

// ─── PhotoGrid ───────────────────────────────────────────────
function PhotoGrid({ photos, onAdd, onDel }) {
  const ref = useRef();
  const [viewIdx, setViewIdx] = useState(null);

  const read = files => Array.from(files).forEach(f => {
    if (!f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = e => onAdd({ id:uid(), src:e.target.result, name:f.name });
    r.readAsDataURL(f);
  });
  useEffect(() => {
    const h = e => {
      for (const it of (e.clipboardData?.items||[]))
        if (it.type.startsWith("image/")) {
          const r = new FileReader();
          r.onload = ev => onAdd({ id:uid(), src:ev.target.result, name:"클립보드" });
          r.readAsDataURL(it.getAsFile());
        }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [onAdd]);

  return (
    <div style={{ padding:"0 16px 16px" }}>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <button onClick={() => ref.current.click()} style={S.btn("#54A0FF")}>📁 사진 업로드</button>
        <button onClick={() => alert("Ctrl+V / ⌘+V 로 클립보드 이미지 붙여넣기")} style={S.btn("#A3CB38")}>📋 클립보드</button>
        <input ref={ref} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e => read(e.target.files)} />
      </div>
      {photos.length === 0
        ? <p style={{ textAlign:"center", color:"#ccc", padding:"24px 0", fontSize:13 }}>사진을 추가해보세요 📷</p>
        : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:6 }}>
            {photos.map((p,i) => (
              <div key={p.id} style={{ position:"relative", aspectRatio:"1", borderRadius:10, overflow:"hidden", cursor:"pointer" }}>
                <img src={p.src} alt={p.name}
                  onClick={() => setViewIdx(i)}
                  style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                <button onClick={e => { e.stopPropagation(); onDel(p.id); }}
                  style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,0.5)", border:"none", borderRadius:"50%", width:22, height:22, color:"#fff", cursor:"pointer", fontSize:11 }}>✕</button>
              </div>
            ))}
          </div>
      }
      {viewIdx !== null && (
        <PhotoViewer photos={photos} startIdx={viewIdx} onClose={() => setViewIdx(null)} />
      )}
    </div>
  );
}

// ─── ScheduleItem ────────────────────────────────────────────
function ScheduleItem({ item, idx, total, ac, onChange, onDel, onMove }) {
  const [editing, setEditing] = useState(false);
  const [et,  setEt]  = useState(item.text);
  const [eti, setEti] = useState(item.time);
  const save = () => { if (!et.trim()) return; onChange({...item,text:et.trim(),time:eti}); setEditing(false); };
  return (
    <div style={{ background:item.done?"#f0fff4":"#fff", border:"1px solid "+(item.done?"#9ae6b4":"#e2e8f0"), borderRadius:12, overflow:"hidden" }}>
      {editing ? (
        <div style={{ padding:"10px 12px" }}>
          <div style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
            <input type="time" value={eti} onChange={e=>setEti(e.target.value)} style={S.input({width:100,flexShrink:0,fontSize:13})} />
            <input value={et} onChange={e=>setEt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} autoFocus style={S.input({flex:1,fontSize:13})} />
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={() => { setEditing(false); setEt(item.text); setEti(item.time); }}
              style={{ padding:"5px 14px", border:"1px solid #e2e8f0", borderRadius:8, background:"#fff", fontSize:12, cursor:"pointer", color:"#888" }}>취소</button>
            <button onClick={save}
              style={{ padding:"5px 14px", border:"none", borderRadius:8, background:ac, color:"#fff", fontSize:12, cursor:"pointer", fontWeight:600 }}>저장</button>
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
            <button onClick={() => onMove(idx,-1)} disabled={idx===0}
              style={{ width:20,height:18,border:"none",borderRadius:4,cursor:idx===0?"default":"pointer",background:idx===0?"#f0f0f0":"#e8eaf6",color:idx===0?"#ccc":ac,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0 }}>▲</button>
            <button onClick={() => onMove(idx,1)} disabled={idx===total-1}
              style={{ width:20,height:18,border:"none",borderRadius:4,cursor:idx===total-1?"default":"pointer",background:idx===total-1?"#f0f0f0":"#e8eaf6",color:idx===total-1?"#ccc":ac,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0 }}>▼</button>
          </div>
          <button onClick={() => onChange({...item,done:!item.done})}
            style={{ width:22,height:22,borderRadius:"50%",border:"2px solid",borderColor:item.done?"#38a169":"#cbd5e0",background:item.done?"#38a169":"transparent",cursor:"pointer",flexShrink:0,color:"#fff",fontSize:11 }}>{item.done?"✓":""}</button>
          {item.time && <span style={{ fontSize:12, color:ac, fontWeight:600, minWidth:42, flexShrink:0 }}>{item.time}</span>}
          <span style={{ flex:1, fontSize:14, color:"#2d3748", textDecoration:item.done?"line-through":"none", opacity:item.done?0.5:1 }}>{item.text}</span>
          <button onClick={() => { setEditing(true); setEt(item.text); setEti(item.time); }}
            style={{ background:"#f0f4ff", border:"none", borderRadius:8, padding:"3px 8px", fontSize:11, color:ac, cursor:"pointer", fontWeight:600, flexShrink:0 }}>✏️</button>
          <button onClick={onDel} style={S.ghost()}>✕</button>
        </div>
      )}
      {/* 일정 메모 */}
      <div style={{ borderTop:"1px solid #f5f5f5", padding:"1px 10px 6px" }}>
        <textarea value={item.memo||""} onChange={e => onChange({...item,memo:e.target.value})}
          placeholder="메모 입력..." rows={item.memo ? 3 : 1}
          style={{ width:"100%", border:"none", padding:"6px 4px", fontSize:12, lineHeight:1.7, resize:"none", outline:"none", boxSizing:"border-box", fontFamily:"inherit", color:"#666", background:"transparent" }}
          onFocus={e => { e.target.rows=3; Object.assign(e.target.style,{background:"#fafafa",border:"1.5px solid #e2e8f0",borderRadius:"8px",padding:"8px 10px"}); }}
          onBlur={e  => { e.target.rows=item.memo?3:1; Object.assign(e.target.style,{background:"transparent",border:"none",padding:"6px 4px"}); }} />
      </div>
    </div>
  );
}

// ─── Schedule ────────────────────────────────────────────────
function Schedule({ items, ac, onChange }) {
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onChange([...items, { id:uid(), time, text:text.trim(), done:false, memo:"" }]);
    setText(""); setTime("");
  };
  const move = (idx, dir) => {
    const a = [...items], t = idx+dir;
    if (t < 0 || t >= a.length) return;
    [a[idx], a[t]] = [a[t], a[idx]];
    onChange(a);
  };
  return (
    <div style={{ padding:"0 16px 16px" }}>
      {/* 일정 목록 (위) */}
      {items.length === 0
        ? <p style={{ textAlign:"center", color:"#ccc", padding:"24px 0 12px", fontSize:13 }}>아래에서 일정을 추가해보세요 🗓</p>
        : <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {items.map((it,i) => (
              <ScheduleItem key={it.id} item={it} idx={i} total={items.length} ac={ac}
                onChange={u => onChange(items.map(x => x.id===it.id ? u : x))}
                onDel={() => onChange(items.filter(x => x.id!==it.id))}
                onMove={move} />
            ))}
          </div>
      }
      {/* 입력창 (아래) - 한 줄 */}
      <div style={{ display:"flex", gap:6, alignItems:"center", borderTop:"1.5px solid #f0f0f0", paddingTop:12 }}>
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ ...S.input(), width:88, flexShrink:0, fontSize:13, padding:"9px 6px" }} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==="Enter"&&add()}
          placeholder="일정 추가..." style={S.input({flex:1, minWidth:0})} />
        <button onClick={add} style={S.circ(ac||"#667eea")}>+</button>
      </div>
    </div>
  );
}

// ─── DaySection ──────────────────────────────────────────────
function DaySection({ day, dayIdx, ac, onUpdate, onRemove, showRemove }) {
  const [tab, setTab] = useState("schedule");
  const set = patch => onUpdate(dayIdx, patch);
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
        <div style={{ flexShrink:0, background:ac, borderRadius:14, padding:"6px 14px", textAlign:"center", minWidth:60 }}>
          <div style={{ color:"rgba(255,255,255,0.8)", fontSize:10, fontWeight:600 }}>Day</div>
          <div style={{ color:"#fff", fontSize:20, fontWeight:700, lineHeight:1 }}>{dayIdx+1}</div>
        </div>
        <div style={{ flex:1 }}>
          <input type="date" value={day.date} onChange={e => set({date:e.target.value})}
            style={{ border:"none", outline:"none", fontSize:14, color:ac, fontWeight:700, background:"transparent", display:"block", marginBottom:2 }} />
          {dayIdx===0 && day.date && <span style={{ fontSize:10, color:"#bbb" }}>Day 1 설정 시 이후 날짜 자동 업데이트</span>}
          <input value={day.title} onChange={e => set({title:e.target.value})}
            placeholder="이 날의 테마 (예: 버킹엄 투어 🏰)"
            style={{ border:"none", outline:"none", fontSize:15, fontWeight:600, color:"#2d3748", width:"100%", background:"transparent" }} />
        </div>
        {showRemove && <button onClick={() => onRemove(dayIdx)} style={S.ghost({fontSize:18})}>🗑</button>}
      </div>
      {/* 탭 */}
      <div style={{ display:"flex", background:"#f0f2f8", borderRadius:12, padding:4, marginBottom:12 }}>
        {[["schedule","📅 일정"],["photos","🖼 사진"],["memo","📝 메모"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ flex:1, padding:"8px 0", border:"none", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer",
              background:tab===k?"#fff":"transparent", color:tab===k?ac:"#aaa",
              boxShadow:tab===k?"0 1px 6px rgba(0,0,0,0.08)":"none", transition:"all 0.15s" }}>{l}</button>
        ))}
      </div>
      <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
        {tab==="schedule" && <Schedule items={day.schedule} ac={ac} onChange={v => set({schedule:v})} />}
        {tab==="photos"   && <PhotoGrid photos={day.photos||[]} onAdd={p => set({photos:[...(day.photos||[]),p]})} onDel={id => set({photos:(day.photos||[]).filter(p=>p.id!==id)})} />}
        {tab==="memo"     && (
          <div style={{ padding:"12px 16px 16px" }}>
            <MemoPanel
              memo={day.memo}
              onChange={v => set({memo:v})}
              ac={ac}
              tabs={["일반","숙소","식당","교통","기타"]}
              collapsible={false}
              defaultOpen={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TripDetail ──────────────────────────────────────────────
function TripDetail({ tripId, trips, setTrips, onBack }) {
  const trip = trips.find(t => t.id===tripId);
  const col  = PALETTE[trip.colorIdx||0];
  const [showExport, setShowExport] = useState(false);
  const [showColor,  setShowColor]  = useState(false);
  const [editTitle,  setEditTitle]  = useState(false);

  const upTrip = patch => setTrips(prev => prev.map(t => t.id===tripId ? {...t,...patch} : t));
  const upDay  = (dayIdx, patch) => setTrips(prev => prev.map(t => {
    if (t.id !== tripId) return t;
    const nd = t.days.map((d,i) => i===dayIdx ? {...d,...patch} : d);
    return {...t, days:"date" in patch ? recalc(nd) : nd};
  }));
  const addDay = () => setTrips(prev => prev.map(t => {
    if (t.id !== tripId) return t;
    const base = t.days[0]?.date, ni = t.days.length;
    return {...t, days:[...t.days, makeDay(ni, base ? addDays(base,ni) : "")]};
  }));
  const removeDay = di => setTrips(prev => prev.map(t => {
    if (t.id!==tripId || t.days.length<=1) return t;
    return {...t, days:recalc(t.days.filter((_,i)=>i!==di))};
  }));
  const copyLink = () => {
    const d = btoa(encodeURIComponent(JSON.stringify({trip:{...trip,days:trip.days.map(d=>({...d,photos:[]}))}})));
    navigator.clipboard.writeText(location.href.split("?")[0]+"?share="+d).then(()=>alert("링크 복사 완료!"));
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f7f8fc", fontFamily:"inherit" }}>
      <div style={{ background:col.bg, padding:"16px 20px 20px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:760, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={S.hdr()}>←</button>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={() => { const e=EMOJIS; upTrip({emoji:e[(e.indexOf(trip.emoji)+1)%e.length]}); }}
                  style={{ background:"none", border:"none", fontSize:22, cursor:"pointer" }}>{trip.emoji}</button>
                {editTitle
                  ? <input autoFocus value={trip.title} onChange={e=>upTrip({title:e.target.value})}
                      onBlur={()=>setEditTitle(false)} onKeyDown={e=>e.key==="Enter"&&setEditTitle(false)}
                      style={{ background:"rgba(255,255,255,0.2)", border:"none", borderBottom:"2px solid #fff", color:"#fff", fontSize:18, fontWeight:700, outline:"none", padding:"2px 4px", flex:1, borderRadius:0 }} />
                  : <h1 onClick={()=>setEditTitle(true)} style={{ margin:0, color:"#fff", fontSize:18, fontWeight:700, cursor:"pointer" }}>
                      {trip.title} <span style={{ fontSize:13, opacity:0.7 }}>✏️</span>
                    </h1>
                }
              </div>
              <p style={{ margin:"2px 0 0", color:"rgba(255,255,255,0.75)", fontSize:12 }}>
                {trip.days.length}일 여행{trip.days[0].date ? " · "+fmts(trip.days[0].date)+" 출발" : ""}
              </p>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>setShowColor(!showColor)} style={S.hdr()}>🎨</button>
              <button onClick={()=>setShowExport(!showExport)} style={S.hdr()}>↗</button>
            </div>
          </div>
          {showColor && (
            <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:14, padding:12, marginTop:12, display:"flex", gap:10, flexWrap:"wrap" }}>
              {PALETTE.map((c,i) => (
                <button key={i} onClick={() => { upTrip({colorIdx:i}); setShowColor(false); }}
                  style={{ width:36, height:36, borderRadius:"50%", border:trip.colorIdx===i?"3px solid #fff":"3px solid transparent", background:c.bg, cursor:"pointer" }} />
              ))}
            </div>
          )}
          {showExport && (
            <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:14, padding:14, marginTop:12 }}>
              <p style={{ margin:"0 0 10px", color:"#fff", fontSize:13, fontWeight:600 }}>📤 내보내기 / 공유</p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button onClick={copyLink} style={S.btn("rgba(255,255,255,0.25)")}>🔗 공유 링크</button>
                <button onClick={()=>exportHTML(trip)} style={S.btn("rgba(255,255,255,0.25)")}>📄 HTML 저장</button>
                <button onClick={()=>Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([JSON.stringify(trip,null,2)],{type:"application/json"})),download:trip.title+".json"}).click()}
                  style={S.btn("rgba(255,255,255,0.25)")}>💾 JSON</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:760, margin:"0 auto", padding:"24px 16px 100px" }}>
        {/* 여행 전체 메모 (접기/펴기) */}
        <div style={{ marginBottom:28, background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <MemoPanel
            memo={trip.memo}
            onChange={v => upTrip({memo:v})}
            ac={col.ac}
            tabs={["전체","예산","준비물","숙소","기타"]}
            collapsible={true}
            defaultOpen={false}
          />
        </div>

        {/* Day 별 섹션 */}
        {trip.days.map((day,i) => (
          <DaySection key={day.id} day={day} dayIdx={i} ac={col.ac}
            onUpdate={upDay} onRemove={removeDay} showRemove={trip.days.length>1} />
        ))}

        <button onClick={addDay}
          style={{ width:"100%", padding:"14px", border:"2px dashed #d0d7de", borderRadius:16, background:"transparent", color:"#aaa", fontSize:15, cursor:"pointer", fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          + Day {trip.days.length+1} 추가
          {trip.days[0].date && <span style={{ fontSize:13, color:"#bbb" }}>({fmts(addDays(trip.days[0].date, trip.days.length))})</span>}
        </button>
      </div>
    </div>
  );
}

// ─── TripCard ────────────────────────────────────────────────
function TripCard({ trip, onOpen, onDel }) {
  const col   = PALETTE[trip.colorIdx||0];
  const first = trip.days.find(d=>d.date)?.date;
  const last  = [...trip.days].reverse().find(d=>d.date)?.date;
  const nSch  = trip.days.reduce((n,d)=>n+(d.schedule?.length||0),0);
  const nPic  = trip.days.reduce((n,d)=>n+(d.photos?.length||0),0);
  return (
    <div style={{ borderRadius:18, overflow:"hidden", boxShadow:"0 4px 20px rgba(0,0,0,0.10)", cursor:"pointer" }} onClick={() => onOpen(trip.id)}>
      <div style={{ background:col.bg, padding:"20px 18px 16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:32, marginBottom:4 }}>{trip.emoji}</div>
            <h2 style={{ margin:0, color:"#fff", fontSize:18, fontWeight:700 }}>{trip.title}</h2>
            {first && <p style={{ margin:"4px 0 0", color:"rgba(255,255,255,0.8)", fontSize:12 }}>{fmts(first)}{last&&last!==first?` ~ ${fmts(last)}`:""}</p>}
          </div>
          <button onClick={e=>{e.stopPropagation();if(confirm("이 여행을 삭제할까요?"))onDel(trip.id);}}
            style={{ background:"rgba(0,0,0,0.2)", border:"none", borderRadius:8, color:"#fff", padding:"4px 8px", cursor:"pointer", fontSize:13 }}>🗑</button>
        </div>
      </div>
      <div style={{ background:"#fff", padding:"12px 18px", display:"flex", gap:16 }}>
        <span style={{ fontSize:13, color:"#667eea", fontWeight:600 }}>📅 {trip.days.length}일</span>
        <span style={{ fontSize:13, color:"#999" }}>🗓 {nSch}개</span>
        <span style={{ fontSize:13, color:"#999" }}>📷 {nPic}장</span>
      </div>
    </div>
  );
}

// ─── Home ────────────────────────────────────────────────────
function Home({ trips, setTrips, onOpen, toast }) {
  const [showSettings, setShowSettings] = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  const importRef = useRef();

  const handleSave = async () => {
    setSyncing(true);
    const r = await dbSave(trips);
    setSyncing(false);
    toast(r.msg);
  };
  const handleLoad = async () => {
    setSyncing(true);
    const r = await dbLoad();
    setSyncing(false);
    if (r.ok && r.data) { setTrips(r.data); toast("✅ 불러오기 완료!"); }
    else if (r.ok)      toast("저장된 데이터가 없어요");
    else                toast("❌ 불러오기 실패");
  };
  const importJSON = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.trips) { setTrips(d.trips); toast(`${d.trips.length}개 여행 가져오기 완료`); }
      } catch { toast("JSON 파일 오류"); }
    };
    r.readAsText(f);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f7f8fc", fontFamily:"inherit" }}>
      <div style={{ background:"linear-gradient(135deg,#667eea,#764ba2)", padding:"28px 20px 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <h1 style={{ margin:0, color:"#fff", fontSize:26, fontWeight:700 }}>✈️ 여행 기록</h1>
              <p style={{ margin:"4px 0 0", color:"rgba(255,255,255,0.75)", fontSize:13 }}>{trips.length}개의 여행</p>
            </div>
            <button onClick={() => setShowSettings(!showSettings)} style={S.hdr()}>⚙️</button>
          </div>
          {showSettings && (
            <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:14, padding:14, marginTop:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:supabase?"#48bb78":"#fc8181", flexShrink:0 }} />
                <p style={{ margin:0, color:"#fff", fontSize:13, fontWeight:600 }}>
                  {supabase ? "✅ Supabase 연결됨" : "⚠️ Supabase 미연결"}
                </p>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button onClick={handleSave} disabled={!supabase||syncing} style={S.btn(supabase?"#38a169":"#a0aec0")}>
                  {syncing ? "..." : "☁️ 저장"}
                </button>
                <button onClick={handleLoad} disabled={!supabase||syncing} style={S.btn(supabase?"#3182ce":"#a0aec0")}>
                  {syncing ? "..." : "📥 불러오기"}
                </button>
                <button onClick={() => Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([JSON.stringify({trips},null,2)],{type:"application/json"})),download:"travels.json"}).click()}
                  style={S.btn("#9f7aea")}>💾 JSON 저장</button>
                <button onClick={() => importRef.current.click()} style={S.btn("#ed8936")}>📂 JSON 가져오기</button>
                <input ref={importRef} type="file" accept=".json" style={{ display:"none" }} onChange={importJSON} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"20px 16px 100px" }}>
        {trips.length === 0
          ? <div style={{ textAlign:"center", padding:"80px 0", color:"#bbb" }}>
              <div style={{ fontSize:56, marginBottom:16 }}>🌏</div>
              <p style={{ fontSize:16, margin:0 }}>아직 여행 기록이 없어요</p>
              <p style={{ fontSize:13, marginTop:6 }}>아래 + 버튼으로 추가해보세요!</p>
            </div>
          : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
              {trips.map(t => (
                <TripCard key={t.id} trip={t} onOpen={onOpen} onDel={id => setTrips(prev => prev.filter(x => x.id!==id))} />
              ))}
            </div>
        }
      </div>

      <button onClick={() => { const t=makeTrip(trips.length%PALETTE.length); setTrips(prev=>[...prev,t]); onOpen(t.id); }}
        style={{ position:"fixed", bottom:28, right:28, width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,#667eea,#764ba2)", border:"none", color:"#fff", fontSize:28, cursor:"pointer", boxShadow:"0 6px 24px rgba(102,126,234,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>+</button>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────
export default function App() {
  const [trips,    setTrips]    = useState([]);
  const [openId,   setOpenId]   = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }, []);

  const editedRef    = useRef(false);
  const savedAtRef   = useRef(localStorage.getItem("tp_saved_at") || "");
  const saveTimerRef = useRef(null);

  // 최초 로드
  useEffect(() => {
    try { const s = localStorage.getItem(LS_TRIPS); if (s) setTrips(JSON.parse(s)); } catch {}
    if (!supabase) return;
    dbLoad().then(r => {
      if (!r.ok || !r.data) return;
      setTrips(r.data);
      savedAtRef.current = r.serverAt;
      localStorage.setItem("tp_saved_at", r.serverAt);
      localStorage.setItem(LS_TRIPS, JSON.stringify(r.data));
    });
  }, []);

  // trips 변경 → 로컬 저장 + 편집 시 2초 후 서버 저장
  useEffect(() => {
    try { localStorage.setItem(LS_TRIPS, JSON.stringify(trips)); } catch {}
    if (!editedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const r = await dbSave(trips);
      if (r.ok) { savedAtRef.current = r.savedAt; toast("☁️ 자동 저장됨"); }
    }, 2000);
  }, [trips]);

  // 30초마다 서버 체크
  useEffect(() => {
    if (!supabase) return;
    const id = setInterval(async () => {
      if (editedRef.current) return;
      const r = await dbLoad();
      if (!r.ok || !r.data) return;
      if (!savedAtRef.current || new Date(r.serverAt) > new Date(savedAtRef.current)) {
        setTrips(r.data);
        savedAtRef.current = r.serverAt;
        localStorage.setItem("tp_saved_at", r.serverAt);
        toast("🔄 최신 데이터로 업데이트됨");
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // 편집 감지 래퍼
  const setTripsEdited = useCallback((val) => {
    editedRef.current = true;
    setTrips(val);
    setTimeout(() => { editedRef.current = false; }, 5000);
  }, []);

  // 공유 링크
  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search).get("share");
      if (!p) return;
      const { trip } = JSON.parse(decodeURIComponent(atob(p)));
      if (!trip) return;
      const imported = {...trip, id:uid(), title:trip.title+" (공유됨)"};
      setTrips(prev => prev.some(t=>t.title===imported.title) ? prev : [...prev, imported]);
      setOpenId(imported.id);
    } catch {}
  }, []);

  return (
    <>
      {openId && trips.find(t=>t.id===openId)
        ? <TripDetail tripId={openId} trips={trips} setTrips={setTripsEdited} onBack={() => setOpenId(null)} />
        : <Home trips={trips} setTrips={setTripsEdited} onOpen={setOpenId} toast={toast} />
      }
      {toastMsg && (
        <div style={{ position:"fixed", bottom:100, left:"50%", transform:"translateX(-50%)", background:"rgba(0,0,0,0.75)", color:"#fff", padding:"10px 20px", borderRadius:20, fontSize:13, fontWeight:600, zIndex:999, whiteSpace:"nowrap", pointerEvents:"none" }}>
          {toastMsg}
        </div>
      )}
    </>
  );
}
