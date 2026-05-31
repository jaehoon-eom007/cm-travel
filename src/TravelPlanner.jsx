import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase ────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// 모든 기기가 같은 ID 사용 → 어느 기기에서든 같은 데이터 공유
const DEVICE_ID = "shared";

// ─── 상수 ────────────────────────────────────────────────────
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

// ─── 유틸 ────────────────────────────────────────────────────
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
  return { id:uid(), date, title:"", schedule:[], photos:[], memo:"", color:DAY_COLORS[idx % DAY_COLORS.length] };
}
function makeTrip(colorIdx=0) {
  return { id:uid(), title:"새 여행", emoji:EMOJIS[Math.floor(Math.random()*EMOJIS.length)], colorIdx, days:[makeDay(0)], memo:"", createdAt:new Date().toISOString() };
}
const fmt  = s => s ? new Date(s+"T12:00:00").toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"}) : "";
const fmts = s => s ? new Date(s+"T12:00:00").toLocaleDateString("ko-KR",{year:"numeric",month:"short",day:"numeric"}) : "";

// ─── DB 함수 ─────────────────────────────────────────────────
async function dbSave(trips) {
  if (!supabase) return { ok:false, msg:"Supabase 미설정" };
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("travel_data")
      .upsert({ id: DEVICE_ID, trips: JSON.stringify(trips), updated_at: now });
    if (error) throw error;
    return { ok:true, msg:"☁️ 저장됨", savedAt: now };
  } catch(e) {
    return { ok:false, msg:"❌ 저장 실패: " + e.message };
  }
}

async function dbLoad() {
  if (!supabase) return { ok:false, data:null, serverAt:null };
  try {
    const { data, error } = await supabase
      .from("travel_data")
      .select("trips, updated_at")
      .eq("id", DEVICE_ID);
    if (error) throw error;
    if (!data || data.length === 0) return { ok:true, data:null, serverAt:null };
    return { ok:true, data: JSON.parse(data[0].trips), serverAt: data[0].updated_at };
  } catch(e) {
    console.error("dbLoad error:", e);
    return { ok:false, data:null, serverAt:null };
  }
}

// ─── 내보내기 ────────────────────────────────────────────────
function exportHTML(trip) {
  const ac = PALETTE[trip.colorIdx||0].ac;
  const days = trip.days.map((d,i) => {
    const items = (d.schedule||[]).map(s =>
      `<li>${s.time?`<b>${s.time}</b> `:""}${s.text}${s.done?" ✓":""}${s.memo?`<p style="color:#888;font-size:12px;margin:2px 0">${s.memo}</p>`:""}</li>`
    ).join("");
    return `<div class="day"><h2>Day ${i+1}${d.date?` · ${fmt(d.date)}`:""}${d.title?` — ${d.title}`:""}</h2>${items?`<ul>${items}</ul>`:""}${d.memo?`<p class="memo">${d.memo.replace(/\n/g,"<br>")}</p>`:""}</div>`;
  }).join("");
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${trip.emoji} ${trip.title}</title><style>body{font-family:'Apple SD Gothic Neo',sans-serif;max-width:680px;margin:0 auto;padding:20px;background:#f9fafb;color:#2d3748}h1{color:${ac}}.day{background:#fff;border-radius:12px;padding:18px;margin:14px 0;border-left:4px solid ${ac}}h2{font-size:16px;margin:0 0 10px}ul{margin:0;padding-left:20px;line-height:2.2}.memo{color:#666;font-size:13px;border-top:1px solid #f0f0f0;padding-top:8px;margin-top:8px}</style></head><body><h1>${trip.emoji} ${trip.title}</h1>${days}</body></html>`;
  Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([html],{type:"text/html"})),download:trip.title+".html"}).click();
}

// ─── 스타일 헬퍼 ─────────────────────────────────────────────
const S = {
  btn:   (bg,ex={}) => ({padding:"9px 16px",background:bg,border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",...ex}),
  circ:  (bg)       => ({width:36,height:36,borderRadius:"50%",background:bg,border:"none",color:"#fff",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}),
  input: (ex={})    => ({border:"1.5px solid #e2e8f0",borderRadius:10,padding:"9px 12px",fontSize:14,outline:"none",background:"#fff",...ex}),
  hdr:   ()         => ({background:"rgba(255,255,255,0.18)",border:"none",borderRadius:10,color:"#fff",width:36,height:36,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}),
  ghost: (ex={})    => ({background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:14,padding:"0 2px",...ex}),
};

// ─── PhotoGrid ───────────────────────────────────────────────
function PhotoGrid({ photos, onAdd, onDel }) {
  const ref = useRef();
  const read = files => Array.from(files).forEach(f => {
    if (!f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = e => onAdd({id:uid(), src:e.target.result, name:f.name});
    r.readAsDataURL(f);
  });
  useEffect(() => {
    const h = e => {
      for (const it of (e.clipboardData?.items || []))
        if (it.type.startsWith("image/")) {
          const r = new FileReader();
          r.onload = ev => onAdd({id:uid(), src:ev.target.result, name:"클립보드"});
          r.readAsDataURL(it.getAsFile());
        }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [onAdd]);

  return (
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>ref.current.click()} style={S.btn("#54A0FF")}>📁 사진 업로드</button>
        <button onClick={()=>alert("Ctrl+V / ⌘+V 로 클립보드 이미지 붙여넣기")} style={S.btn("#A3CB38")}>📋 클립보드</button>
        <input ref={ref} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>read(e.target.files)} />
      </div>
      {photos.length === 0
        ? <p style={{textAlign:"center",color:"#ccc",padding:"24px 0",fontSize:13}}>사진을 추가해보세요 📷</p>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:6}}>
            {photos.map(p => (
              <div key={p.id} style={{position:"relative",aspectRatio:"1",borderRadius:10,overflow:"hidden"}}>
                <img src={p.src} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                <button onClick={()=>onDel(p.id)} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:22,height:22,color:"#fff",cursor:"pointer",fontSize:11}}>✕</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ─── ScheduleItem ────────────────────────────────────────────
function ScheduleItem({ item, idx, total, ac, onChange, onDel, onMove }) {
  const [editing, setEditing] = useState(false);
  const [et,  setEt]  = useState(item.text);
  const [eti, setEti] = useState(item.time);
  const save = () => {
    if (!et.trim()) return;
    onChange({...item, text:et.trim(), time:eti});
    setEditing(false);
  };
  return (
    <div style={{background:item.done?"#f0fff4":"#fff",border:"1px solid "+(item.done?"#9ae6b4":"#e2e8f0"),borderRadius:12,overflow:"hidden"}}>
      {editing ? (
        <div style={{padding:"10px 12px"}}>
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <input type="time" value={eti} onChange={e=>setEti(e.target.value)} style={S.input({width:100,flexShrink:0,fontSize:13})} />
            <input value={et} onChange={e=>setEt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} autoFocus style={S.input({flex:1,fontSize:13})} />
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>{setEditing(false);setEt(item.text);setEti(item.time);}}
              style={{padding:"5px 14px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",fontSize:12,cursor:"pointer",color:"#888"}}>취소</button>
            <button onClick={save}
              style={{padding:"5px 14px",border:"none",borderRadius:8,background:ac,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:600}}>저장</button>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
            <button onClick={()=>onMove(idx,-1)} disabled={idx===0}
              style={{width:20,height:18,border:"none",borderRadius:4,cursor:idx===0?"default":"pointer",background:idx===0?"#f0f0f0":"#e8eaf6",color:idx===0?"#ccc":ac,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>▲</button>
            <button onClick={()=>onMove(idx,1)} disabled={idx===total-1}
              style={{width:20,height:18,border:"none",borderRadius:4,cursor:idx===total-1?"default":"pointer",background:idx===total-1?"#f0f0f0":"#e8eaf6",color:idx===total-1?"#ccc":ac,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>▼</button>
          </div>
          <button onClick={()=>onChange({...item,done:!item.done})}
            style={{width:22,height:22,borderRadius:"50%",border:"2px solid",borderColor:item.done?"#38a169":"#cbd5e0",background:item.done?"#38a169":"transparent",cursor:"pointer",flexShrink:0,color:"#fff",fontSize:11}}>{item.done?"✓":""}</button>
          {item.time && <span style={{fontSize:12,color:ac,fontWeight:600,minWidth:42,flexShrink:0}}>{item.time}</span>}
          <span style={{flex:1,fontSize:14,color:"#2d3748",textDecoration:item.done?"line-through":"none",opacity:item.done?0.5:1}}>{item.text}</span>
          <button onClick={()=>{setEditing(true);setEt(item.text);setEti(item.time);}}
            style={{background:"#f0f4ff",border:"none",borderRadius:8,padding:"3px 8px",fontSize:11,color:ac,cursor:"pointer",fontWeight:600,flexShrink:0}}>✏️</button>
          <button onClick={onDel} style={S.ghost()}>✕</button>
        </div>
      )}
      <div style={{borderTop:"1px solid #f5f5f5",padding:"2px 12px 8px"}}>
        <textarea value={item.memo||""} onChange={e=>onChange({...item,memo:e.target.value})}
          placeholder="메모 입력..." rows={item.memo ? 3 : 1}
          style={{width:"100%",border:"none",padding:"6px 4px",fontSize:12,lineHeight:1.7,resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit",color:"#666",background:"transparent"}}
          onFocus={e=>{e.target.rows=3; Object.assign(e.target.style,{background:"#fafafa",border:"1.5px solid #e2e8f0",borderRadius:"8px",padding:"8px 10px"});}}
          onBlur={e=>{e.target.rows=item.memo?3:1; Object.assign(e.target.style,{background:"transparent",border:"none",padding:"6px 4px"});}} />
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
    onChange([...items, {id:uid(), time, text:text.trim(), done:false, memo:""}]);
    setText(""); setTime("");
  };
  const move = (idx, dir) => {
    const a = [...items], t = idx+dir;
    if (t < 0 || t >= a.length) return;
    [a[idx], a[t]] = [a[t], a[idx]];
    onChange(a);
  };
  return (
    <div style={{padding:"0 16px 16px"}}>
      {/* 일정 목록 */}
      {items.length === 0
        ? <p style={{textAlign:"center",color:"#ccc",padding:"24px 0",fontSize:13}}>아래에서 일정을 추가해보세요 🗓</p>
        : <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {items.map((it,i) => (
              <ScheduleItem key={it.id} item={it} idx={i} total={items.length} ac={ac}
                onChange={u => onChange(items.map(x => x.id===it.id ? u : x))}
                onDel={() => onChange(items.filter(x => x.id!==it.id))}
                onMove={move} />
            ))}
          </div>
      }
      {/* 입력창 - 하단 */}
      <div style={{display:"flex",gap:8,alignItems:"center",borderTop:"1.5px solid #f0f0f0",paddingTop:12}}>
        <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={S.input({width:100,flexShrink:0})} />
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="일정 추가..." style={S.input({flex:1})} />
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
    <div style={{marginBottom:28}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
        <div style={{flexShrink:0,background:ac,borderRadius:14,padding:"6px 14px",textAlign:"center",minWidth:60}}>
          <div style={{color:"rgba(255,255,255,0.8)",fontSize:10,fontWeight:600}}>Day</div>
          <div style={{color:"#fff",fontSize:20,fontWeight:700,lineHeight:1}}>{dayIdx+1}</div>
        </div>
        <div style={{flex:1}}>
          <input type="date" value={day.date} onChange={e=>set({date:e.target.value})}
            style={{border:"none",outline:"none",fontSize:14,color:ac,fontWeight:700,background:"transparent",display:"block",marginBottom:2}} />
          {dayIdx===0 && day.date && <span style={{fontSize:10,color:"#bbb"}}>Day 1 설정 시 이후 날짜 자동 업데이트</span>}
          <input value={day.title} onChange={e=>set({title:e.target.value})}
            placeholder="이 날의 테마 (예: 버킹엄 투어 🏰)"
            style={{border:"none",outline:"none",fontSize:15,fontWeight:600,color:"#2d3748",width:"100%",background:"transparent"}} />
        </div>
        {showRemove && <button onClick={()=>onRemove(dayIdx)} style={S.ghost({fontSize:18})}>🗑</button>}
      </div>
      <div style={{display:"flex",background:"#f0f2f8",borderRadius:12,padding:4,marginBottom:12}}>
        {[["schedule","📅 일정"],["photos","🖼 사진"],["memo","📝 메모"]].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)}
            style={{flex:1,padding:"8px 0",border:"none",borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer",
              background:tab===k?"#fff":"transparent",color:tab===k?ac:"#aaa",
              boxShadow:tab===k?"0 1px 6px rgba(0,0,0,0.08)":"none",transition:"all 0.15s"}}>{l}</button>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        {tab==="schedule" && <Schedule items={day.schedule} ac={ac} onChange={v=>set({schedule:v})} />}
        {tab==="photos"   && <PhotoGrid photos={day.photos||[]} onAdd={p=>set({photos:[...(day.photos||[]),p]})} onDel={id=>set({photos:(day.photos||[]).filter(p=>p.id!==id)})} />}
        {tab==="memo"     && (
          <div style={{padding:"0 16px 16px"}}>
            <textarea value={day.memo} onChange={e=>set({memo:e.target.value})} placeholder="메모를 자유롭게 입력하세요..."
              style={{width:"100%",minHeight:120,border:"1.5px solid #e2e8f0",borderRadius:10,padding:12,fontSize:14,lineHeight:1.8,resize:"vertical",outline:"none",boxSizing:"border-box",fontFamily:"inherit",color:"#2d3748",background:"#fafafa"}} />
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
    return {...t, days: "date" in patch ? recalc(nd) : nd};
  }));
  const addDay = () => setTrips(prev => prev.map(t => {
    if (t.id !== tripId) return t;
    const base = t.days[0]?.date, newIdx = t.days.length;
    return {...t, days: [...t.days, makeDay(newIdx, base ? addDays(base, newIdx) : "")]};
  }));
  const removeDay = dayIdx => setTrips(prev => prev.map(t => {
    if (t.id !== tripId || t.days.length <= 1) return t;
    return {...t, days: recalc(t.days.filter((_,i) => i!==dayIdx))};
  }));
  const copyLink = () => {
    const d = btoa(encodeURIComponent(JSON.stringify({trip:{...trip,days:trip.days.map(d=>({...d,photos:[]}))}})));
    navigator.clipboard.writeText(location.href.split("?")[0]+"?share="+d).then(()=>alert("링크 복사 완료!"));
  };

  return (
    <div style={{minHeight:"100vh",background:"#f7f8fc",fontFamily:"inherit"}}>
      <div style={{background:col.bg,padding:"16px 20px 20px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:760,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.hdr()}>←</button>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>{const e=EMOJIS; upTrip({emoji:e[(e.indexOf(trip.emoji)+1)%e.length]});}}
                  style={{background:"none",border:"none",fontSize:22,cursor:"pointer"}}>{trip.emoji}</button>
                {editTitle
                  ? <input autoFocus value={trip.title} onChange={e=>upTrip({title:e.target.value})}
                      onBlur={()=>setEditTitle(false)} onKeyDown={e=>e.key==="Enter"&&setEditTitle(false)}
                      style={{background:"rgba(255,255,255,0.2)",border:"none",borderBottom:"2px solid #fff",color:"#fff",fontSize:18,fontWeight:700,outline:"none",padding:"2px 4px",flex:1,borderRadius:0}} />
                  : <h1 onClick={()=>setEditTitle(true)} style={{margin:0,color:"#fff",fontSize:18,fontWeight:700,cursor:"pointer"}}>
                      {trip.title} <span style={{fontSize:13,opacity:0.7}}>✏️</span>
                    </h1>
                }
              </div>
              <p style={{margin:"2px 0 0",color:"rgba(255,255,255,0.75)",fontSize:12}}>
                {trip.days.length}일 여행{trip.days[0].date ? " · "+fmts(trip.days[0].date)+" 출발" : ""}
              </p>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setShowColor(!showColor)} style={S.hdr()}>🎨</button>
              <button onClick={()=>setShowExport(!showExport)} style={S.hdr()}>↗</button>
            </div>
          </div>
          {showColor && (
            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:14,padding:12,marginTop:12,display:"flex",gap:10,flexWrap:"wrap"}}>
              {PALETTE.map((c,i) => (
                <button key={i} onClick={()=>{upTrip({colorIdx:i});setShowColor(false);}}
                  style={{width:36,height:36,borderRadius:"50%",border:trip.colorIdx===i?"3px solid #fff":"3px solid transparent",background:c.bg,cursor:"pointer"}} />
              ))}
            </div>
          )}
          {showExport && (
            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:14,padding:14,marginTop:12}}>
              <p style={{margin:"0 0 10px",color:"#fff",fontSize:13,fontWeight:600}}>📤 내보내기 / 공유</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={copyLink} style={S.btn("rgba(255,255,255,0.25)")}>🔗 공유 링크</button>
                <button onClick={()=>exportHTML(trip)} style={S.btn("rgba(255,255,255,0.25)")}>📄 HTML 저장</button>
                <button onClick={()=>Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([JSON.stringify(trip,null,2)],{type:"application/json"})),download:trip.title+".json"}).click()}
                  style={S.btn("rgba(255,255,255,0.25)")}>💾 JSON</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{maxWidth:760,margin:"0 auto",padding:"24px 16px 100px"}}>
        {/* 여행 전체 메모 */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{flexShrink:0,background:col.ac,borderRadius:14,padding:"6px 14px",textAlign:"center"}}>
              <div style={{color:"rgba(255,255,255,0.8)",fontSize:10,fontWeight:600}}>전체</div>
              <div style={{color:"#fff",fontSize:16,fontWeight:700,lineHeight:1}}>📝</div>
            </div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#2d3748"}}>여행 전체 메모</div>
              <div style={{fontSize:12,color:"#aaa"}}>여행 전반에 대한 메모를 남겨보세요</div>
            </div>
          </div>
          <div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",padding:"12px 16px"}}>
            <textarea
              value={trip.memo||""}
              onChange={e=>upTrip({memo:e.target.value})}
              placeholder="예산, 준비물, 주의사항, 숙소 정보 등 여행 전체에 대한 메모를 입력하세요..."
              style={{width:"100%",minHeight:100,border:"none",outline:"none",fontSize:14,lineHeight:1.8,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit",color:"#2d3748",background:"transparent"}}
            />
          </div>
        </div>

        {trip.days.map((day,i) => (
          <DaySection key={day.id} day={day} dayIdx={i} ac={col.ac}
            onUpdate={upDay} onRemove={removeDay} showRemove={trip.days.length>1} />
        ))}
        <button onClick={addDay}
          style={{width:"100%",padding:"14px",border:"2px dashed #d0d7de",borderRadius:16,background:"transparent",color:"#aaa",fontSize:15,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          + Day {trip.days.length+1} 추가
          {trip.days[0].date && <span style={{fontSize:13,color:"#bbb"}}>({fmts(addDays(trip.days[0].date, trip.days.length))})</span>}
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
    <div style={{borderRadius:18,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,0.10)",cursor:"pointer"}} onClick={()=>onOpen(trip.id)}>
      <div style={{background:col.bg,padding:"20px 18px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:32,marginBottom:4}}>{trip.emoji}</div>
            <h2 style={{margin:0,color:"#fff",fontSize:18,fontWeight:700}}>{trip.title}</h2>
            {first && <p style={{margin:"4px 0 0",color:"rgba(255,255,255,0.8)",fontSize:12}}>{fmts(first)}{last&&last!==first?` ~ ${fmts(last)}`:""}</p>}
          </div>
          <button onClick={e=>{e.stopPropagation();if(confirm("이 여행을 삭제할까요?"))onDel(trip.id);}}
            style={{background:"rgba(0,0,0,0.2)",border:"none",borderRadius:8,color:"#fff",padding:"4px 8px",cursor:"pointer",fontSize:13}}>🗑</button>
        </div>
      </div>
      <div style={{background:"#fff",padding:"12px 18px",display:"flex",gap:16}}>
        <span style={{fontSize:13,color:"#667eea",fontWeight:600}}>📅 {trip.days.length}일</span>
        <span style={{fontSize:13,color:"#999"}}>🗓 {nSch}개</span>
        <span style={{fontSize:13,color:"#999"}}>📷 {nPic}장</span>
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
    <div style={{minHeight:"100vh",background:"#f7f8fc",fontFamily:"inherit"}}>
      <div style={{background:"linear-gradient(135deg,#667eea,#764ba2)",padding:"28px 20px 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h1 style={{margin:0,color:"#fff",fontSize:26,fontWeight:700}}>✈️ 여행 기록</h1>
              <p style={{margin:"4px 0 0",color:"rgba(255,255,255,0.75)",fontSize:13}}>{trips.length}개의 여행</p>
            </div>
            <button onClick={()=>setShowSettings(!showSettings)} style={S.hdr()}>⚙️</button>
          </div>

          {showSettings && (
            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:14,padding:14,marginTop:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:supabase?"#48bb78":"#fc8181",flexShrink:0}} />
                <p style={{margin:0,color:"#fff",fontSize:13,fontWeight:600}}>
                  {supabase ? "✅ Supabase 연결됨" : "⚠️ Supabase 미연결"}
                </p>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={handleSave} disabled={!supabase||syncing} style={S.btn(supabase?"#38a169":"#a0aec0")}>
                  {syncing ? "..." : "☁️ 저장"}
                </button>
                <button onClick={handleLoad} disabled={!supabase||syncing} style={S.btn(supabase?"#3182ce":"#a0aec0")}>
                  {syncing ? "..." : "📥 불러오기"}
                </button>
                <button onClick={()=>Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([JSON.stringify({trips},null,2)],{type:"application/json"})),download:"travels.json"}).click()}
                  style={S.btn("#9f7aea")}>💾 JSON 저장</button>
                <button onClick={()=>importRef.current.click()} style={S.btn("#ed8936")}>📂 JSON 가져오기</button>
                <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importJSON} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 16px 100px"}}>
        {trips.length === 0
          ? <div style={{textAlign:"center",padding:"80px 0",color:"#bbb"}}>
              <div style={{fontSize:56,marginBottom:16}}>🌏</div>
              <p style={{fontSize:16,margin:0}}>아직 여행 기록이 없어요</p>
              <p style={{fontSize:13,marginTop:6}}>아래 + 버튼으로 추가해보세요!</p>
            </div>
          : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
              {trips.map(t => (
                <TripCard key={t.id} trip={t} onOpen={onOpen}
                  onDel={id => setTrips(prev => prev.filter(x => x.id!==id))} />
              ))}
            </div>
        }
      </div>

      <button onClick={()=>{const t=makeTrip(trips.length%PALETTE.length);setTrips(prev=>[...prev,t]);onOpen(t.id);}}
        style={{position:"fixed",bottom:28,right:28,width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#667eea,#764ba2)",border:"none",color:"#fff",fontSize:28,cursor:"pointer",boxShadow:"0 6px 24px rgba(102,126,234,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>+</button>
    </div>
  );
}

// ─── App (자동 동기화) ────────────────────────────────────────
export default function App() {
  const [trips,   setTrips]   = useState([]);
  const [openId,  setOpenId]  = useState(null);
  const [toastMsg,setToastMsg]= useState("");

  // 토스트 메시지
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }, []);

  // 편집 여부 추적 (자동저장 트리거용)
  const editedRef  = useRef(false);
  // 마지막 서버 저장 시각
  const savedAtRef = useRef(localStorage.getItem("tp_saved_at") || "");
  // 자동저장 타이머
  const saveTimerRef = useRef(null);

  // ── 최초 로드 ──
  useEffect(() => {
    // 1) 로컬 데이터 먼저 보여주기 (빠른 렌더링용)
    try {
      const s = localStorage.getItem(LS_TRIPS);
      if (s) setTrips(JSON.parse(s));
    } catch {}

    // 2) 서버가 연결됐으면 무조건 서버 데이터 우선
    if (!supabase) return;
    dbLoad().then(r => {
      console.log("[Sync] dbLoad result:", r);
      if (!r.ok) { console.error("[Sync] load failed"); return; }
      if (!r.data) { console.log("[Sync] no server data yet"); return; }
      // 서버 데이터가 있으면 무조건 적용 (로컬보다 서버 우선)
      console.log("[Sync] applying server data, serverAt:", r.serverAt);
      setTrips(r.data);
      savedAtRef.current = r.serverAt;
      localStorage.setItem("tp_saved_at", r.serverAt);
      localStorage.setItem(LS_TRIPS, JSON.stringify(r.data));
    });
  }, []);

  // ── trips 변경 시: 로컬 저장 + 편집 중이면 2초 후 자동 서버 저장 ──
  useEffect(() => {
    // 로컬 저장
    try { localStorage.setItem(LS_TRIPS, JSON.stringify(trips)); } catch {}

    // 편집이 아니면(초기 로드 등) 자동저장 스킵
    if (!editedRef.current) return;

    // 기존 타이머 취소 후 새 타이머
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const r = await dbSave(trips);
      if (r.ok) {
        savedAtRef.current = r.savedAt;
        toast("☁️ 자동 저장됨");
      }
    }, 2000);
  }, [trips]);

  // ── 30초마다 서버 체크 → 다른 기기에서 편집했으면 업데이트 ──
  useEffect(() => {
    if (!supabase) return;
    const interval = setInterval(async () => {
      // 현재 편집 중이면 스킵 (덮어씌우기 방지)
      if (editedRef.current) return;
      const r = await dbLoad();
      if (!r.ok || !r.data) return;
      const serverAt = r.serverAt;
      const localAt  = savedAtRef.current;
      if (!localAt || new Date(serverAt) > new Date(localAt)) {
        setTrips(r.data);
        savedAtRef.current = serverAt;
        localStorage.setItem("tp_saved_at", serverAt);
        toast("🔄 다른 기기의 최신 데이터로 업데이트됨");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // 편집 감지용 setTrips 래퍼
  const setTripsEdited = useCallback((val) => {
    editedRef.current = true;
    setTrips(val);
    // 5초 후 편집 플래그 해제 (자동 동기화 재개)
    setTimeout(() => { editedRef.current = false; }, 5000);
  }, []);

  // 공유 링크 처리
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
        ? <TripDetail tripId={openId} trips={trips} setTrips={setTripsEdited} onBack={()=>setOpenId(null)} />
        : <Home trips={trips} setTrips={setTripsEdited} onOpen={setOpenId} toast={toast} />
      }
      {/* 토스트 */}
      {toastMsg && (
        <div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.75)",color:"#fff",padding:"10px 20px",borderRadius:20,fontSize:13,fontWeight:600,zIndex:999,whiteSpace:"nowrap",pointerEvents:"none"}}>
          {toastMsg}
        </div>
      )}
    </>
  );
}
