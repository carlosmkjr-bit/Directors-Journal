import { useState, useEffect, useRef, useCallback } from "react";

const SEASONS = {
  spring: { label: "Spring", glyph: "✦", color: "#7eb87a", bg: "#f4f9f0", bgCard: "rgba(126,184,122,0.06)" },
  summer: { label: "Summer", glyph: "◈", color: "#c9892a", bg: "#fdf6ec", bgCard: "rgba(201,137,42,0.06)" },
  autumn: { label: "Autumn", glyph: "◆", color: "#b05030", bg: "#faf1ea", bgCard: "rgba(176,80,48,0.06)" },
  winter: { label: "Winter", glyph: "❄", color: "#4a7fa0", bg: "#f0f4f8", bgCard: "rgba(74,127,160,0.06)" },
};

function getSeason(m) {
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}
function fmtDate(d) { return d.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
function fmtTime(d) { return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }
function weekLabel(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `Week ${wk}, ${d.getFullYear()}`;
}

const INTEGRATION_QUESTIONS = [
  "What did I know before I could explain it?",
  "Where did I override myself?",
  "What needs redesign instead of more effort?",
];

const DAILY_FIELDS = [
  { key: "state", label: "Current State", sub: "Right now, I feel…", placeholder: "Describe your present state without editing it…", icon: "○", rows: 3 },
  { key: "decisions", label: "Key Decisions", sub: "What was resolved or moved forward?", placeholder: "Key decisions, important interactions, tension and clarity points…", icon: "⬡", rows: 4 },
  { key: "breakthroughs", label: "Creative Breakthroughs & Challenges", sub: "What shifted or resisted?", placeholder: "Creative breakthroughs, unexpected obstacles, leadership reflections…", icon: "◇", rows: 4 },
  { key: "questions", label: "Emerging Questions", sub: "What will guide tomorrow?", placeholder: "The questions that will shape the next creative direction…", icon: "→", rows: 3 },
];

const WEEKLY_SECTIONS = [
  { num: "1", key: "w_state", label: "Current State", sub: "Right now, I feel…", placeholder: "Describe your present state without editing it…", rows: 3, icon: "○" },
  { num: "2", key: "w_happened", label: "What Actually Happened", sub: "Key decisions · Important interactions · Tension / clarity points", placeholder: "Narrate the week honestly. What actually happened, beyond the agenda?", rows: 5, icon: "⬡" },
  { num: "3", key: "w_embodied", label: "Embodied Signals", sub: "When did you feel open · contracted · energized · depleted?", placeholder: "Trace the body's arc through the week. What triggered each state?", rows: 5, icon: "◇" },
  { num: "4", key: "w_structural", label: "Structural Observations", sub: "What supported you · drained energy · held as a boundary · collapsed?", placeholder: "Look at the structures around you — systems, people, rhythms. What served, what cost?", rows: 5, icon: "⬡" },
  { num: "6", key: "w_principle", label: "Principle", sub: "This week taught me that…", placeholder: "Complete the sentence with something you could not have written at the start of the week.", rows: 3, icon: "◈" },
  { num: "7", key: "w_adjustment", label: "One Adjustment", sub: "One thing to simplify, stop, protect, or redesign.", placeholder: "One specific, actionable change. Not a list — just one.", rows: 2, icon: "→" },
];

const INIT_DAILY = { state: "", decisions: "", breakthroughs: "", questions: "", notes: "" };
const INIT_WEEKLY = { w_state: "", w_happened: "", w_embodied: "", w_structural: "", w_iq: "", w_principle: "", w_adjustment: "", w_closing: "" };



// Safari-compatible voice hook
// Safari doesn't support continuous=true reliably, so we use non-continuous
// and restart automatically after each result until user stops
function useVoice(onResult) {
  const [listening, setListening] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const recRef = useRef(null);
  const activeKeyRef = useRef(null);
  const listeningRef = useRef(false);

  const SR = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const supported = !!SR;

  const startRec = useCallback((key) => {
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; // Safari-safe
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript)
        .join(" ");
      if (transcript) onResult(key, transcript);
    };
    rec.onend = () => {
      // Auto-restart if still meant to be listening (Safari stops after silence)
      if (listeningRef.current && activeKeyRef.current === key) {
        try { startRec(key); } catch(e) { /* ignore */ }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        listeningRef.current = false;
        setListening(false);
        setActiveKey(null);
      }
      // On other errors (network, aborted) just let onend handle restart
    };
    try {
      rec.start();
      recRef.current = rec;
    } catch(e) { /* already started */ }
  }, [SR, onResult]);

  const start = useCallback((key) => {
    if (!supported) return;
    if (recRef.current) { try { recRef.current.abort(); } catch(e) {} }
    activeKeyRef.current = key;
    listeningRef.current = true;
    setListening(true);
    setActiveKey(key);
    startRec(key);
  }, [supported, startRec]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    activeKeyRef.current = null;
    if (recRef.current) { try { recRef.current.abort(); } catch(e) {} recRef.current = null; }
    setListening(false);
    setActiveKey(null);
  }, []);

  const toggle = useCallback((key) => {
    if (listeningRef.current && activeKeyRef.current === key) { stop(); } else { start(key); }
  }, [start, stop]);

  return { listening, activeKey, toggle, stop, supported };
}

// Recording banner
function RecordingBanner({ listening, stop }) {
  if (!listening) return null;
  return (
    <div style={{
      position:"fixed",top:0,left:0,right:0,zIndex:9999,
      background:"#e53e3e",color:"white",padding:"12px 24px",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      fontFamily:"'Jost',sans-serif",fontSize:"13px",fontWeight:500,
      letterSpacing:".05em",boxShadow:"0 2px 12px rgba(229,62,62,0.4)"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{width:10,height:10,borderRadius:"50%",background:"white",display:"inline-block",animation:"blink 1s infinite"}}/>
        RECORDING — speak now
      </div>
      <button onClick={stop} style={{
        background:"rgba(255,255,255,0.25)",border:"1px solid rgba(255,255,255,0.5)",
        color:"white",padding:"5px 14px",borderRadius:"2px",cursor:"pointer",
        fontFamily:"'Jost',sans-serif",fontSize:"11px",letterSpacing:".1em",fontWeight:600
      }}>■ STOP</button>
    </div>
  );
}

// Mic button component
function MicBtn({ fieldKey, activeKey, listening, toggle, color }) {
  const isActive = listening && activeKey === fieldKey;
  return (
    <button
      className={`mic-btn${isActive ? " mic-active" : ""}`}
      onClick={() => toggle(fieldKey)}
      title={isActive ? "Stop recording" : "Speak to type"}
      style={{ "--mic-color": isActive ? "#e53e3e" : color }}
    >
      {isActive ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9a7 7 0 0 0 14 0h2a9 9 0 0 1-8 8.94V23h-2v-2.06A9 9 0 0 1 3 12h2z"/></svg>
      )}
    </button>
  );
}

export default function CulturalJournal() {
  const now = new Date();
  const sk = getSeason(now.getMonth());
  const season = SEASONS[sk];

  const [view, setView] = useState("daily");
  const [daily, setDaily] = useState(INIT_DAILY);
  const [weekly, setWeekly] = useState(INIT_WEEKLY);
  const [selectedIQ, setSelectedIQ] = useState(null);
  const [entries, setEntries] = useState(() => { try { return JSON.parse(localStorage.getItem("cj_e2") || "[]"); } catch { return []; } });
  const [saved, setSaved] = useState(false);
  const [time, setTime] = useState(fmtTime(new Date()));
  const [archiveFilter, setArchiveFilter] = useState("all");
  const [importMsg, setImportMsg] = useState("");
  const importRef = useRef();

  const handleVoiceResult = useCallback((key, transcript) => {
    if (DAILY_FIELDS.find(f => f.key === key) || key === "notes") {
      setDaily(d => ({ ...d, [key]: (d[key] ? d[key] + " " : "") + transcript }));
    } else {
      setWeekly(w => ({ ...w, [key]: (w[key] ? w[key] + " " : "") + transcript }));
    }
  }, []);

  const { listening, activeKey, toggle, stop, supported } = useVoice(handleVoiceResult);

  useEffect(() => { const t = setInterval(() => setTime(fmtTime(new Date())), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { try { localStorage.setItem("cj_e2", JSON.stringify(entries)); } catch {} }, [entries]);

  function saveDaily() {
    if (Object.values(daily).every(v => !v)) return;
    setEntries(e => [{ ...daily, type: "daily", id: Date.now(), date: fmtDate(new Date()), time: fmtTime(new Date()), season: sk }, ...e]);
    setDaily(INIT_DAILY); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }
  function saveWeekly() {
    const payload = { ...weekly, w_iq: selectedIQ };
    if (Object.values(payload).every(v => !v)) return;
    setEntries(e => [{ ...payload, type: "weekly", id: Date.now(), date: fmtDate(new Date()), time: fmtTime(new Date()), season: sk, week: weekLabel(new Date()) }, ...e]);
    setWeekly(INIT_WEEKLY); setSelectedIQ(null); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }
  function del(id) { setEntries(e => e.filter(x => x.id !== id)); }

  function handleExport() {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `directors-journal-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error();
        setEntries(prev => {
          const existingIds = new Set(prev.map(x => x.id));
          const newEntries = imported.filter(x => !existingIds.has(x.id));
          return [...newEntries, ...prev];
        });
        setImportMsg(`✦ ${imported.length} entries imported`);
        setTimeout(() => setImportMsg(""), 3000);
      } catch {
        setImportMsg("Import failed — invalid file");
        setTimeout(() => setImportMsg(""), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const filtered = archiveFilter === "all" ? entries : entries.filter(e => e.type === archiveFilter);
  const c = season.color;

  return (
    <div style={{ minHeight: "100vh", background: season.bg, fontFamily: "'Jost', sans-serif", color: "#2a2320", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .jh{border-bottom:1px solid rgba(0,0,0,0.08);padding:28px 48px 20px;background:rgba(255,255,255,0.52);display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;}
        .jh-inst{font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:${c};margin-bottom:5px;opacity:.9;}
        .jh-title{font-family:'Jost',sans-serif;font-size:26px;font-weight:500;color:#1a1816;letter-spacing:.02em;line-height:1.2;}
        .jh-meta{text-align:right;font-size:13px;line-height:1.9;color:#7a6e68;}
        .season-badge{display:inline-flex;align-items:center;gap:6px;font-family:'Jost',sans-serif;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:${c};border:1px solid ${c}50;padding:3px 10px;border-radius:2px;margin-top:5px;}
        .nav{display:flex;padding:0 48px;border-bottom:1px solid rgba(0,0,0,0.07);background:rgba(255,255,255,0.38);}
        .nt{font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;padding:13px 22px 11px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:#8a7e78;transition:all .2s;}
        .nt:hover{color:#2a2320;}
        .nt.active{color:${c};border-bottom-color:${c};background:rgba(255,255,255,0.55);}
        .main{flex:1;padding:40px 48px 70px;max-width:820px;width:100%;margin:0 auto;}
        .datestamp{display:flex;align-items:center;gap:14px;margin-bottom:38px;}
        .ds-line{flex:1;height:1px;background:linear-gradient(to right,${c}44,transparent);}
        .ds-text{font-size:13px;color:#7a6e68;white-space:nowrap;}
        .ds-glyph{color:${c};font-size:15px;}
        .section-num{font-family:'Jost',sans-serif;font-size:9px;letter-spacing:.22em;color:${c}88;margin-bottom:2px;}
        .fb{margin-bottom:38px;}
        .fl{display:flex;align-items:center;gap:10px;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${c};margin-bottom:4px;}
        .fl-icon{font-size:14px;opacity:.75;}
        .fl-div{flex:1;height:1px;background:${c}28;}
        .fl-sub{font-size:13px;color:#8a7e78;margin-bottom:11px;line-height:1.5;font-weight:300;}
        .textarea-wrap{position:relative;}
        textarea{width:100%;background:rgba(255,255,255,0.58);border:1px solid rgba(0,0,0,0.09);border-radius:3px;padding:14px 44px 14px 17px;font-family:'Jost',sans-serif;font-size:15px;line-height:1.78;color:#2a2320;resize:vertical;transition:border-color .2s,box-shadow .2s;outline:none;font-weight:300;}
        textarea:focus{border-color:${c}80;box-shadow:0 0 0 3px ${c}12;background:rgba(255,255,255,0.85);}
        textarea::placeholder{color:#b0a49e;}
        .mic-btn{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--mic-color);background:white;color:var(--mic-color);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;padding:0;}
        .mic-btn:hover{background:var(--mic-color);color:white;}
        .mic-active{background:var(--mic-color) !important;color:white !important;box-shadow:0 0 0 4px var(--mic-color,#7eb87a)22,0 0 12px var(--mic-color,#7eb87a)44;animation:pulse 1.2s infinite;}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 4px var(--mic-color)22;}50%{box-shadow:0 0 0 8px var(--mic-color)11;}}
        .voice-hint{font-size:11px;color:#b0a49e;margin-top:5px;font-weight:300;}
        .iq-label{font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${c};margin-bottom:4px;display:flex;align-items:center;gap:10px;}
        .iq-sub{font-size:13px;color:#8a7e78;margin-bottom:14px;font-weight:300;}
        .iq-options{display:flex;flex-direction:column;gap:8px;margin-bottom:10px;}
        .iq-opt{display:flex;align-items:flex-start;gap:12px;padding:13px 16px;background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.08);border-radius:3px;cursor:pointer;transition:border-color .2s,background .2s;font-size:14px;line-height:1.55;color:#3a322e;font-weight:300;}
        .iq-opt:hover{background:rgba(255,255,255,0.8);border-color:${c}55;}
        .iq-opt.selected{background:${season.bgCard};border-color:${c}90;color:#1a1816;}
        .iq-radio{width:14px;height:14px;border-radius:50%;border:1.5px solid ${c}80;flex-shrink:0;margin-top:3px;display:flex;align-items:center;justify-content:center;transition:background .15s;}
        .iq-radio.sel{background:${c};border-color:${c};}
        .iq-radio.sel::after{content:'';width:5px;height:5px;border-radius:50%;background:white;}
        .closing-label{font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#9a8e88;margin-bottom:4px;display:block;}
        .closing-sub{font-size:13px;color:#a09488;margin-bottom:11px;font-weight:300;}
        .closing-divider{width:48px;height:1px;background:${c}40;margin:32px 0 28px;}
        .save-row{display:flex;align-items:center;justify-content:space-between;margin-top:6px;flex-wrap:wrap;gap:12px;}
        .save-note{font-size:13px;color:#9a8e88;font-weight:300;}
        .save-btn{font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;background:${c};color:white;border:none;padding:11px 30px;cursor:pointer;border-radius:2px;transition:opacity .2s,transform .15s;font-weight:500;}
        .save-btn:hover{opacity:.87;transform:translateY(-1px);}
        .save-btn:active{transform:translateY(0);}
        .saved-flash{font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${c};animation:fadeIn .3s ease;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
        .af-row{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center;justify-content:space-between;}
        .af-filters{display:flex;gap:8px;flex-wrap:wrap;}
        .af-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
        .af-btn{font-family:'Jost',sans-serif;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;background:none;border:1px solid rgba(0,0,0,0.12);padding:6px 16px;border-radius:2px;cursor:pointer;color:#8a7e78;transition:all .2s;}
        .af-btn:hover{color:#2a2320;border-color:rgba(0,0,0,0.25);}
        .af-btn.active{background:${c};color:white;border-color:${c};}
        .action-btn{font-family:'Jost',sans-serif;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;padding:6px 16px;border-radius:2px;cursor:pointer;transition:all .2s;font-weight:500;}
        .export-btn{background:${c};color:white;border:1px solid ${c};}
        .export-btn:hover{opacity:.85;}
        .import-btn{background:none;border:1px solid ${c};color:${c};}
        .import-btn:hover{background:${c}14;}
        .import-msg{font-size:12px;color:${c};font-weight:500;letter-spacing:.05em;animation:fadeIn .3s ease;}
        .archive-divider{height:1px;background:rgba(0,0,0,0.06);margin-bottom:24px;}
        .ec{background:rgba(255,255,255,0.65);border:1px solid rgba(0,0,0,0.08);border-radius:4px;padding:26px 30px 22px;margin-bottom:26px;position:relative;transition:box-shadow .2s;}
        .ec:hover{box-shadow:0 4px 18px rgba(0,0,0,0.07);}
        .ec-stripe{position:absolute;top:0;left:0;bottom:0;width:3px;border-radius:4px 0 0 4px;}
        .ec-type{font-family:'Jost',sans-serif;font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:#a09488;margin-bottom:6px;}
        .ec-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:8px;}
        .ec-date{font-family:'Jost',sans-serif;font-size:11px;letter-spacing:.13em;text-transform:uppercase;}
        .ec-time{font-size:12px;color:#9a8e88;font-weight:300;}
        .ec-sec{margin-bottom:14px;}
        .ec-sec-title{font-family:'Jost',sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#a09488;margin-bottom:4px;}
        .ec-sec-body{font-size:14px;line-height:1.72;color:#3a322e;white-space:pre-wrap;font-weight:300;}
        .del-btn{position:absolute;top:18px;right:18px;background:none;border:none;font-size:16px;color:#c0b4ae;cursor:pointer;padding:4px;line-height:1;transition:color .2s;}
        .del-btn:hover{color:#b05030;}
        .empty{text-align:center;padding:80px 24px;color:#9a8e88;font-size:15px;font-weight:300;}
        @media(max-width:640px){.jh{padding:18px 18px 14px;}.nav{padding:0 18px;}.main{padding:26px 18px 50px;}.jh-title{font-size:21px;}.af-row{flex-direction:column;align-items:flex-start;}}
      `}</style>

      <RecordingBanner listening={listening} stop={stop} />
      <div className="jh">
        <div>
          <div className="jh-inst">Secretariat · Cultural Affairs</div>
          <div className="jh-title">Director's Journal</div>
          <div className="season-badge"><span>{season.glyph}</span><span>{season.label} {now.getFullYear()}</span></div>
        </div>
        <div className="jh-meta"><div>{fmtDate(now)}</div><div>{time}</div></div>
      </div>

      <div className="nav">
        {[["daily","Daily Entry"],["weekly","Weekly Integration"],["archive",`Archive${entries.length ? ` (${entries.length})` : ""}`]].map(([k,l]) => (
          <button key={k} className={`nt${view===k?" active":""}`} onClick={() => { setView(k); setSaved(false); }}>{l}</button>
        ))}
      </div>

      <div className="main">
        {view === "daily" && (<>
          <div className="datestamp">
            <span className="ds-glyph">{season.glyph}</span>
            <span className="ds-text">{fmtDate(now)} · {time}</span>
            <span className="ds-line" />
          </div>
          {DAILY_FIELDS.map(f => (
            <div className="fb" key={f.key}>
              <div className="fl"><span className="fl-icon">{f.icon}</span><span>{f.label}</span><span className="fl-div"/></div>
              <div className="fl-sub">{f.sub}</div>
              <div className="textarea-wrap">
                <textarea rows={f.rows} placeholder={f.placeholder} value={daily[f.key]} onChange={e => setDaily(d => ({...d,[f.key]:e.target.value}))} />
                {supported && <MicBtn fieldKey={f.key} activeKey={activeKey} listening={listening} toggle={toggle} color={c} />}
              </div>
              {listening && activeKey === f.key && <div className="voice-hint">● Recording… tap mic to stop</div>}
            </div>
          ))}
          <div className="fb">
            <span className="closing-label">Additional Notes</span>
            <div className="closing-sub">Anything else that belongs in the record…</div>
            <div className="textarea-wrap">
              <textarea rows={3} placeholder="Further observations, impressions, fragments…" value={daily.notes} onChange={e => setDaily(d => ({...d,notes:e.target.value}))} />
              {supported && <MicBtn fieldKey="notes" activeKey={activeKey} listening={listening} toggle={toggle} color={c} />}
            </div>
            {listening && activeKey === "notes" && <div className="voice-hint">● Recording… tap mic to stop</div>}
          </div>
          <div className="save-row">
            {saved ? <span className="saved-flash">✦ Entry Recorded</span> : <span className="save-note">Entries are stored locally.</span>}
            <button className="save-btn" onClick={saveDaily}>Commit to Record</button>
          </div>
        </>)}

        {view === "weekly" && (<>
          <div className="datestamp">
            <span className="ds-glyph">{season.glyph}</span>
            <span className="ds-text">{weekLabel(now)} · {fmtDate(now)}</span>
            <span className="ds-line" />
          </div>
          {WEEKLY_SECTIONS.map(s => (
            <div className="fb" key={s.key}>
              <div className="section-num">{s.num}</div>
              <div className="fl"><span className="fl-icon">{s.icon}</span><span>{s.label}</span><span className="fl-div"/></div>
              <div className="fl-sub">{s.sub}</div>
              <div className="textarea-wrap">
                <textarea rows={s.rows} placeholder={s.placeholder} value={weekly[s.key]} onChange={e => setWeekly(w => ({...w,[s.key]:e.target.value}))} />
                {supported && <MicBtn fieldKey={s.key} activeKey={activeKey} listening={listening} toggle={toggle} color={c} />}
              </div>
              {listening && activeKey === s.key && <div className="voice-hint">● Recording… tap mic to stop</div>}
            </div>
          ))}
          <div className="fb">
            <div className="section-num">5</div>
            <div className="iq-label"><span className="fl-icon">◈</span><span>Integration Question</span><span className="fl-div"/></div>
            <div className="iq-sub">Choose one question to sit with.</div>
            <div className="iq-options">
              {INTEGRATION_QUESTIONS.map((q, i) => (
                <div key={i} className={`iq-opt${selectedIQ===q?" selected":""}`} onClick={() => setSelectedIQ(selectedIQ===q?null:q)}>
                  <div className={`iq-radio${selectedIQ===q?" sel":""}`}/>
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="closing-divider"/>
          <div className="fb">
            <span className="closing-label">Closing</span>
            <div className="closing-sub">Any final reflection to seal this week's record.</div>
            <div className="textarea-wrap">
              <textarea rows={3} placeholder="How do you leave this week behind and step into the next one?…" value={weekly.w_closing} onChange={e => setWeekly(w => ({...w,w_closing:e.target.value}))} />
              {supported && <MicBtn fieldKey="w_closing" activeKey={activeKey} listening={listening} toggle={toggle} color={c} />}
            </div>
            {listening && activeKey === "w_closing" && <div className="voice-hint">● Recording… tap mic to stop</div>}
          </div>
          <div className="save-row">
            {saved ? <span className="saved-flash">✦ Week Recorded</span> : <span className="save-note">Stored locally in your browser.</span>}
            <button className="save-btn" onClick={saveWeekly}>Seal the Week</button>
          </div>
        </>)}

        {view === "archive" && (<>
          <div className="af-row">
            <div className="af-filters">
              {[["all","All"],["daily","Daily"],["weekly","Weekly"]].map(([k,l]) => (
                <button key={k} className={`af-btn${archiveFilter===k?" active":""}`} onClick={() => setArchiveFilter(k)}>{l}</button>
              ))}
            </div>
            <div className="af-actions">
              {importMsg && <span className="import-msg">{importMsg}</span>}
              <button className="action-btn import-btn" onClick={() => importRef.current.click()}>↑ Import</button>
              <button className="action-btn export-btn" onClick={handleExport}>↓ Export</button>
              <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImport} />
            </div>
          </div>
          <div className="archive-divider"/>
          {filtered.length === 0
            ? <div className="empty">No entries in this view yet.</div>
            : filtered.map(e => {
              const s = SEASONS[e.season] || season;
              const isWeekly = e.type === "weekly";
              const sectionDefs = isWeekly
                ? [{key:"w_state",label:"Current State"},{key:"w_happened",label:"What Actually Happened"},{key:"w_embodied",label:"Embodied Signals"},{key:"w_structural",label:"Structural Observations"},{key:"w_iq",label:"Integration Question"},{key:"w_principle",label:"Principle"},{key:"w_adjustment",label:"One Adjustment"},{key:"w_closing",label:"Closing"}]
                : [{key:"state",label:"Current State"},{key:"decisions",label:"Key Decisions"},{key:"breakthroughs",label:"Creative Breakthroughs & Challenges"},{key:"questions",label:"Emerging Questions"},{key:"notes",label:"Additional Notes"}];
              return (
                <div className="ec" key={e.id}>
                  <div className="ec-stripe" style={{background:s.color}}/>
                  <button className="del-btn" onClick={() => del(e.id)}>×</button>
                  <div className="ec-type">{isWeekly ? `Weekly Integration · ${e.week||""}` : "Daily Entry"}</div>
                  <div className="ec-meta">
                    <span className="ec-date" style={{color:s.color}}>{e.date}</span>
                    <span className="ec-time">{e.time} · {s.label}</span>
                  </div>
                  {sectionDefs.map(sd => e[sd.key] ? (
                    <div className="ec-sec" key={sd.key}>
                      <div className="ec-sec-title">{sd.label}</div>
                      <div className="ec-sec-body">{e[sd.key]}</div>
                    </div>
                  ) : null)}
                </div>
              );
            })
          }
        </>)}
      </div>
    </div>
  );
}
