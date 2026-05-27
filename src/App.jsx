import { useState, useEffect } from "react";

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

  function exportEntries() {
    const dataStr = JSON.stringify(entries, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `director-journal-backup-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importEntries() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (Array.isArray(imported)) {
            setEntries(imported);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          } else {
            alert("Invalid file format. Please use a previously exported journal backup.");
          }
        } catch (err) {
          alert("Error reading file. Make sure it's a valid JSON backup.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
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
        textarea{width:100%;background:rgba(255,255,255,0.58);border:1px solid rgba(0,0,0,0.09);border-radius:3px;padding:14px 17px;font-family:'Jost',sans-serif;font-size:15px;line-height:1.78;color:#2a2320;resize:vertical;transition:border-color .2s,box-shadow .2s;outline:none;font-weight:300;}
        textarea:focus{border-color:${c}80;box-shadow:0 0 0 3px ${c}12;background:rgba(255,255,255,0.85);}
        textarea::placeholder{color:#b0a49e;}
        .iq-label{font-family:'Jost',sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${c};margin-bottom:4px;display:flex;align-items:center;gap:10px;}
        .iq-sub{font-size:13px;color:#8a7e78;margin-bottom:14px;font-weight:300;}
        .iq-options{display:flex;flex-direction:column;gap:8px;margin-bottom:10px;}
        .iq-opt{display:flex;align-items:flex-start;gap:12px;padding:13px 16px;background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.08);border-radius:3px;cursor:pointer;transition:border-color .2s,background .2s;font-size:14px;line-height:1.55;color:#3a322e;font-weight:300;}
        .iq-opt:hover{background:rgba(255,255,255,0.8);border-color:${c}55;}
        .iq-opt.selected{background:${season.bgCard};border-color:${c}90;color:#1a1816;}
        .iq-radio{width:14px;height:14px;border-radius:50%;border:1.5px solid ${c}80;flex-shrink:0;margin-top:3px;display:flex;align-items:center
