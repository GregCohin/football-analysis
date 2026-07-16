import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Play, Pause, ArrowLeft, X, Download, Video as VideoIcon, Film, Menu, Home, Target, Users, Trophy, BarChart, ClipboardList, FileText, Eye, Search, Activity } from "lucide-react";
import { generateCompilation } from "./videoCompiler";

const EVENT_CATEGORIES = [
  {
    id: "offensif",
    label: "Offensif",
    events: [
      { key: "passe_ok", label: "Passe réussie", hotkey: "A", positive: true },
      { key: "passe_ko", label: "Passe manquée", hotkey: "Z", positive: false },
      { key: "controle_ok", label: "Contrôle réussi", hotkey: "H", positive: true },
      { key: "controle_ko", label: "Contrôle manqué", hotkey: "L", positive: false },
      { key: "centre_ok", label: "Centre réussi", hotkey: "C", positive: true },
      { key: "centre_ko", label: "Centre manqué", hotkey: "V", positive: false },
      { key: "dribble_ok", label: "Dribble réussi", hotkey: "D", positive: true },
      { key: "dribble_ko", label: "Dribble raté", hotkey: "F", positive: false },
      { key: "tir_cadre", label: "Tir cadré", hotkey: "E", positive: true },
      { key: "tir_hc", label: "Tir non cadré", hotkey: "R", positive: false },
      { key: "but", label: "But", hotkey: "B", positive: true },
    ],
  },
  {
    id: "defensif",
    label: "Défensif & transition",
    events: [
      { key: "recup", label: "Récupération", hotkey: "Q", positive: true },
      { key: "perte", label: "Perte de balle", hotkey: "S", positive: false },
      { key: "tacle_ok", label: "Tacle réussi", hotkey: "T", positive: true },
      { key: "tacle_ko", label: "Tacle manqué", hotkey: "G", positive: false },
      { key: "interception", label: "Interception", hotkey: "I", positive: true },
      { key: "degagement", label: "Dégagement", hotkey: "M", positive: true },
      { key: "duel_ok", label: "Duel aérien gagné", hotkey: "U", positive: true },
      { key: "duel_ko", label: "Duel aérien perdu", hotkey: "J", positive: false },
    ],
  },
  {
    id: "gardien",
    label: "Gardien",
    events: [
      { key: "gardien_arret_ok", label: "Arrêt réussi", hotkey: "1", positive: true },
      { key: "gardien_arret_ko", label: "Arrêt manqué", hotkey: "2", positive: false },
      { key: "gardien_sortie_ok", label: "Sortie aérienne réussie", hotkey: "3", positive: true },
      { key: "gardien_sortie_ko", label: "Sortie aérienne manquée", hotkey: "4", positive: false },
      { key: "gardien_relance_ok", label: "Relance réussie", hotkey: "5", positive: true },
      { key: "gardien_relance_ko", label: "Relance manquée", hotkey: "6", positive: false },
      { key: "gardien_duel_ok", label: "Duel gardien gagné", hotkey: "7", positive: true },
      { key: "gardien_duel_ko", label: "Duel gardien perdu", hotkey: "8", positive: false },
    ],
  },
  {
    id: "discipline",
    label: "Discipline & CPA",
    events: [
      { key: "faute_commise", label: "Faute commise", hotkey: "X", positive: false },
      { key: "faute_subie", label: "Faute subie", hotkey: "W", positive: true },
      { key: "corner", label: "Corner", hotkey: "O", positive: true },
      { key: "hors_jeu", label: "Hors-jeu", hotkey: "N", positive: false },
      { key: "carton_jaune", label: "Carton jaune", hotkey: "Y", positive: false },
      { key: "carton_rouge", label: "Carton rouge", hotkey: "K", positive: false },
    ],
  },
];

const ALL_EVENTS = EVENT_CATEGORIES.flatMap((c) => c.events);
const EVENT_MAP = Object.fromEntries(ALL_EVENTS.map((e) => [e.key, e]));

const SECTIONS = [
  { key: "accueil", label: "Accueil", icon: Home },
  { key: "gameplan", label: "Projet de jeu", icon: Target },
  { key: "squad", label: "Effectifs", icon: Users },
  { key: "competitions", label: "Compétitions", icon: Trophy },
  { key: "stats", label: "Statistiques", icon: BarChart },
  { key: "sessions", label: "Séance", icon: ClipboardList },
  { key: "studio", label: "Studio", icon: VideoIcon },
  { key: "reports", label: "Rapports de matchs", icon: FileText },
  { key: "observation", label: "Observation", icon: Eye },
  { key: "scouting", label: "Scouting", icon: Search },
  { key: "videotheque", label: "Vidéothèque", icon: Film },
  { key: "medical", label: "Suivi médical", icon: Activity },
];

const MATCHES_INDEX_KEY = "tf_matches_index";
const matchStorageKey = (id) => `tf_match_${id}`;

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function formatDateFr(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function downloadCSV(filename, rows) {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          return /[,"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readIndex() {
  try {
    const raw = localStorage.getItem(MATCHES_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeIndex(list) {
  try {
    localStorage.setItem(MATCHES_INDEX_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error("Erreur de sauvegarde de l'index", e);
    return false;
  }
}

function writeMatch(match) {
  try {
    localStorage.setItem(matchStorageKey(match.id), JSON.stringify(match));
    return true;
  } catch (e) {
    console.error("Erreur de sauvegarde du match", e);
    return false;
  }
}

function computeRatingSuggestions(match) {
  const byPlayer = {};
  match.tags.forEach((t) => {
    if (!t.player) return;
    const key = `${t.team}_${t.player}`;
    if (!byPlayer[key]) byPlayer[key] = { pos: 0, neg: 0, but: 0, rouge: 0, jaune: 0, arret: 0 };
    const ev = EVENT_MAP[t.eventKey];
    if (ev.positive) byPlayer[key].pos++; else byPlayer[key].neg++;
    if (t.eventKey === "but") byPlayer[key].but++;
    if (t.eventKey === "carton_rouge") byPlayer[key].rouge++;
    if (t.eventKey === "carton_jaune") byPlayer[key].jaune++;
    if (t.eventKey === "gardien_arret_ok") byPlayer[key].arret++;
  });

  const players = {};
  Object.entries(byPlayer).forEach(([key, d]) => {
    const total = d.pos + d.neg;
    const ratio = total > 0 ? d.pos / total : 0.5;
    let score = 5 + (ratio - 0.5) * 6;
    score += d.but * 1.2 - d.rouge * 2.5 - d.jaune * 0.6 + d.arret * 0.4;
    players[key] = Math.max(0, Math.min(10, Math.round(score * 2) / 2));
  });

  const teamAgg = { us: { pos: 0, neg: 0, but: 0 }, opp: { pos: 0, neg: 0, but: 0 } };
  match.tags.forEach((t) => {
    const ev = EVENT_MAP[t.eventKey];
    if (ev.positive) teamAgg[t.team].pos++; else teamAgg[t.team].neg++;
    if (t.eventKey === "but") teamAgg[t.team].but++;
  });
  function teamStatScore(team, other) {
    const totalT = teamAgg[team].pos + teamAgg[team].neg;
    const totalO = teamAgg[other].pos + teamAgg[other].neg;
    const ratioT = totalT > 0 ? teamAgg[team].pos / totalT : 0.5;
    const ratioO = totalO > 0 ? teamAgg[other].pos / totalO : 0.5;
    const s = 5 + (ratioT - ratioO) * 5 + (teamAgg[team].but - teamAgg[other].but) * 0.8;
    return Math.max(0, Math.min(10, Math.round(s * 2) / 2));
  }

  const teamPlayerAvg = { us: null, opp: null };
  ["us", "opp"].forEach((team) => {
    const scores = Object.entries(players)
      .filter(([k]) => k.startsWith(`${team}_`))
      .map(([, v]) => v);
    if (scores.length > 0) {
      teamPlayerAvg[team] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 2) / 2;
    }
  });

  return {
    players,
    team: { us: teamStatScore("us", "opp"), opp: teamStatScore("opp", "us") },
    teamPlayerAvg,
  };
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [section, setSection] = useState("accueil");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [matches, setMatches] = useState([]);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [roster, setRoster] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeTeam, setActiveTeam] = useState("us");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMatchForm, setNewMatchForm] = useState({ name: "", opponent: "", date: todayIso(), assignments: {} });
  const [lastTagFlash, setLastTagFlash] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [pendingPlayerTag, setPendingPlayerTag] = useState(null);
  const [compilationJob, setCompilationJob] = useState(null);
  const [compilations, setCompilations] = useState([]);

  const videoRef = useRef(null);
  const videoFileRef = useRef(null);
  const currentMatchRef = useRef(null);
  currentMatchRef.current = currentMatch;
  const pendingTimeoutRef = useRef(null);

  useEffect(() => {
    setMatches(readIndex());
    setMatchesLoaded(true);
  }, []);

  useEffect(() => {
    if (section !== "studio") return;
    try {
      const raw = localStorage.getItem("tf_roster");
      setRoster(raw ? JSON.parse(raw) : []);
    } catch (e) {
      setRoster([]);
    }
  }, [section]);

  function persistIndexUpdate(match) {
    setMatches((prev) => {
      const summary = { id: match.id, name: match.name, opponent: match.opponent, date: match.date, tagCount: match.tags.length, closed: !!match.closed };
      const idx = prev.findIndex((m) => m.id === match.id);
      const next = idx >= 0 ? [...prev.slice(0, idx), summary, ...prev.slice(idx + 1)] : [summary, ...prev];
      writeIndex(next);
      return next;
    });
  }

  function updateMatch(updater) {
    setCurrentMatch((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      const ok = writeMatch(next);
      setSaveStatus(ok ? "saved" : "error");
      persistIndexUpdate(next);
      return next;
    });
  }

  function setMatchClosed(closed) {
    updateMatch((m) => ({ ...m, closed }));
  }

  function createMatch() {
    const name = newMatchForm.name.trim() || `Match du ${formatDateFr(newMatchForm.date || todayIso())}`;
    const match = {
      id: newId(),
      name,
      opponent: newMatchForm.opponent.trim() || "Adversaire",
      date: newMatchForm.date || todayIso(),
      tags: [],
      possession: [],
      ratings: {},
      closed: false,
      playerAssignments: { ...newMatchForm.assignments },
    };
    writeMatch(match);
    persistIndexUpdate(match);
    setCurrentMatch(match);
    setVideoUrl(null);
    setVideoDuration(0);
    setCurrentTime(0);
    setActiveTeam("us");
    setScreen("tagging");
    setShowNewForm(false);
    setNewMatchForm({ name: "", opponent: "", date: todayIso(), assignments: {} });
    setSaveStatus("saved");
    setCompilations([]);
  }

  function importMatchesFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const imported = list.map((m) => ({
          id: m.id || newId(),
          name: m.name || "Match importé",
          opponent: m.opponent || "Adversaire",
          date: m.date || todayIso(),
          tags: m.tags || [],
          possession: m.possession || [],
          ratings: m.ratings || {},
          closed: !!m.closed,
        }));
        imported.forEach((m) => writeMatch(m));
        setMatches((prev) => {
          const map = new Map(prev.map((s) => [s.id, s]));
          imported.forEach((m) => {
            map.set(m.id, { id: m.id, name: m.name, opponent: m.opponent, date: m.date, tagCount: m.tags.length, closed: m.closed });
          });
          const next = Array.from(map.values());
          writeIndex(next);
          return next;
        });
        alert(`${imported.length} match${imported.length > 1 ? "s" : ""} importé${imported.length > 1 ? "s" : ""} avec succès.`);
      } catch (err) {
        alert("Le fichier n'a pas pu être importé (JSON invalide).");
      }
    };
    reader.readAsText(file);
  }

  function openMatch(summary, targetScreen) {
    try {
      const raw = localStorage.getItem(matchStorageKey(summary.id));
      const parsed = raw ? JSON.parse(raw) : { ...summary, tags: [] };
      const match = { ...parsed, tags: parsed.tags || [], possession: parsed.possession || [], ratings: parsed.ratings || {}, closed: !!parsed.closed, playerAssignments: parsed.playerAssignments || {} };
      setCurrentMatch(match);
      setVideoUrl(null);
      setVideoDuration(0);
      setCurrentTime(0);
      setScreen(targetScreen || "tagging");
      setSaveStatus("saved");
      setCompilations([]);
    } catch (e) {
      alert("Impossible de charger ce match (données corrompues).");
    }
  }

  function setPlayerAssignments(assignments) {
    updateMatch((m) => ({ ...m, playerAssignments: assignments }));
  }

  function deleteMatch(summary, e) {
    e.stopPropagation();
    if (!confirm(`Supprimer "${summary.name}" ? Cette action est définitive.`)) return;
    localStorage.removeItem(matchStorageKey(summary.id));
    const next = matches.filter((m) => m.id !== summary.id);
    writeIndex(next);
    setMatches(next);
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    videoFileRef.current = file;
    setVideoError(null);
    setVideoLoading(true);
    setVideoUrl(URL.createObjectURL(file));
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }

  function seekTo(t) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, t), videoDuration || t);
    setCurrentTime(v.currentTime);
  }

  function nudge(delta) {
    seekTo((videoRef.current ? videoRef.current.currentTime : currentTime) + delta);
  }

  function addTag(eventKey) {
    if (!currentMatchRef.current || !videoRef.current) return;
    const t = videoRef.current.currentTime;
    const tag = { id: newId(), time: t, eventKey, team: activeTeam, player: "" };
    updateMatch((m) => ({ ...m, tags: [...m.tags, tag].sort((a, b) => a.time - b.time) }));
    setLastTagFlash(tag.id);
    setTimeout(() => setLastTagFlash((cur) => (cur === tag.id ? null : cur)), 500);
    setPendingPlayerTag({ tagId: tag.id, team: activeTeam });
    clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = setTimeout(() => {
      setPendingPlayerTag((cur) => (cur && cur.tagId === tag.id ? null : cur));
    }, 5000);
  }

  function assignPendingPlayer(num) {
    if (!pendingPlayerTag) return;
    setTagPlayer(pendingPlayerTag.tagId, String(num));
    clearTimeout(pendingTimeoutRef.current);
    setPendingPlayerTag(null);
  }

  function dismissPendingPlayer() {
    clearTimeout(pendingTimeoutRef.current);
    setPendingPlayerTag(null);
  }

  function setPossession(team) {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    updateMatch((m) => {
      const poss = m.possession || [];
      const last = poss[poss.length - 1];
      if (last && last.end == null && last.team === team) return m; // déjà actif, rien à faire
      const closed = poss.map((p, i) => (i === poss.length - 1 && p.end == null ? { ...p, end: t } : p));
      return { ...m, possession: [...closed, { team, start: t, end: null }] };
    });
  }

  function removeTag(tagId) {
    updateMatch((m) => ({ ...m, tags: m.tags.filter((t) => t.id !== tagId) }));
  }

  function setTagPlayer(tagId, player) {
    updateMatch((m) => ({ ...m, tags: m.tags.map((t) => (t.id === tagId ? { ...t, player } : t)) }));
  }

  function setTeamRating(team, coachScore, comment) {
    updateMatch((m) => ({
      ...m,
      ratings: { ...(m.ratings || {}), team: { ...((m.ratings && m.ratings.team) || {}), [team]: { coachScore, comment } } },
    }));
  }

  function setPlayerRating(key, coachScore, comment) {
    updateMatch((m) => ({
      ...m,
      ratings: { ...(m.ratings || {}), players: { ...((m.ratings && m.ratings.players) || {}), [key]: { coachScore, comment } } },
    }));
  }

  function exportMatch() {
    if (!currentMatch) return;
    const blob = new Blob([JSON.stringify(currentMatch, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentMatch.name.replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function runCompilation(key, label, clipCenters) {
    if (!videoFileRef.current || compilationJob || clipCenters.length === 0) return;
    setCompilationJob({ key, label, phase: "chargement du moteur vidéo", pct: 0 });
    try {
      const blob = await generateCompilation(videoFileRef.current, clipCenters, videoDuration, (p) => {
        setCompilationJob({ key, label, phase: p.phase, pct: p.pct });
      });
      const url = URL.createObjectURL(blob);
      setCompilations((prev) => [{ id: newId(), key, label, url, size: blob.size, count: clipCenters.length }, ...prev]);
    } catch (e) {
      alert("La génération a échoué : " + (e && e.message ? e.message : "erreur inconnue"));
    } finally {
      setCompilationJob(null);
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (screen !== "tagging") return;
      const tagName = (e.target && e.target.tagName) || "";
      if (tagName === "INPUT" || tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); return; }
      if (e.key === "Tab") { e.preventDefault(); setActiveTeam((p) => (p === "us" ? "opp" : "us")); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-5); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(5); return; }
      const upper = e.key.toUpperCase();
      const found = ALL_EVENTS.find((ev) => ev.hotkey === upper);
      if (found) addTag(found.key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, activeTeam, videoDuration]);

  return (
    <div className="app-root">
      <style>{CSS}</style>

      {!sidebarOpen && (
        <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">
          <Menu size={18} />
        </button>
      )}

      {sidebarOpen && (
        <>
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
          <div className="sidebar-drawer">
            <div className="sidebar-header">
              <span className="sidebar-brand">Football Analysis</span>
              <button className="icon-btn" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu"><X size={16} /></button>
            </div>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  className={`sidebar-item ${section === s.key ? "active" : ""}`}
                  onClick={() => { setSection(s.key); setSidebarOpen(false); }}
                >
                  <Icon size={16} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {section === "accueil" && (
        <PlaceholderScreen title="Accueil" description="Vue d'ensemble : prochains matchs, dernières notes, raccourcis vers ce qui est en cours." />
      )}
      {section === "gameplan" && (
        <PlaceholderScreen title="Projet de jeu" description="Formalise les principes de ton projet de jeu, phase par phase, pour qu'ils nourrissent la notation et les séances." />
      )}
      {section === "squad" && <RosterScreen matches={matches} />}
      {section === "competitions" && (
        <PlaceholderScreen title="Compétitions" description="Suivi des championnats et coupes disputés, classements et calendriers." />
      )}
      {section === "stats" && <StatsScreen matches={matches} />}
      {section === "sessions" && (
        <PlaceholderScreen title="Séance" description="Génération de séances d'entraînement adaptées à ton projet de jeu et au prochain adversaire." />
      )}
      {section === "reports" && (
        <PlaceholderScreen title="Rapports de matchs" description="Synthèse partageable d'un match : statistiques, notes et moments clés en un seul document." />
      )}
      {section === "observation" && (
        <PlaceholderScreen title="Observation" description="Rapports de forces/faiblesses sur les adversaires à venir, à partir des matchs observés." />
      )}
      {section === "scouting" && (
        <PlaceholderScreen title="Scouting" description="Notation des joueurs adverses selon ton projet de jeu, en vue d'un recrutement." />
      )}
      {section === "videotheque" && (
        <PlaceholderScreen title="Vidéothèque" description="Toutes les compilations générées, organisées et retrouvables au même endroit." />
      )}
      {section === "medical" && (
        <PlaceholderScreen title="Suivi médical" description="État de forme, blessures en cours et réathlétisation par joueur." />
      )}

      {section === "studio" && (
        <>
          {screen === "home" && (
            <HomeScreen
              matches={matches}
              matchesLoaded={matchesLoaded}
              showNewForm={showNewForm}
              setShowNewForm={setShowNewForm}
              newMatchForm={newMatchForm}
              setNewMatchForm={setNewMatchForm}
              createMatch={createMatch}
              openMatch={openMatch}
              deleteMatch={deleteMatch}
              importMatchesFile={importMatchesFile}
              roster={roster}
            />
          )}
          {screen === "rating" && currentMatch && (
            <RatingScreen
              match={currentMatch}
              setTeamRating={setTeamRating}
              setPlayerRating={setPlayerRating}
              goHome={() => setScreen("home")}
              goTagging={() => setScreen("tagging")}
              setMatchClosed={setMatchClosed}
              saveStatus={saveStatus}
            />
          )}
          {screen === "tagging" && currentMatch && (
            <TaggingScreen
              match={currentMatch}
              videoUrl={videoUrl}
              videoRef={videoRef}
              videoDuration={videoDuration}
              setVideoDuration={setVideoDuration}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              playbackRate={playbackRate}
              setPlaybackRate={setPlaybackRate}
              activeTeam={activeTeam}
              setActiveTeam={setActiveTeam}
              saveStatus={saveStatus}
              handleFile={handleFile}
              togglePlay={togglePlay}
              seekTo={seekTo}
              nudge={nudge}
              addTag={addTag}
              removeTag={removeTag}
              setTagPlayer={setTagPlayer}
          exportMatch={exportMatch}
          goHome={() => setScreen("home")}
          lastTagFlash={lastTagFlash}
          videoError={videoError}
          setVideoError={setVideoError}
          videoLoading={videoLoading}
          setVideoLoading={setVideoLoading}
          pendingPlayerTag={pendingPlayerTag}
          assignPendingPlayer={assignPendingPlayer}
          dismissPendingPlayer={dismissPendingPlayer}
          setPossession={setPossession}
          runCompilation={runCompilation}
          compilationJob={compilationJob}
          compilations={compilations}
          goRating={() => setScreen("rating")}
          roster={roster}
          setPlayerAssignments={setPlayerAssignments}
          setMatchClosed={setMatchClosed}
        />
      )}
        </>
      )}
    </div>
  );
}

function PlayerAssignmentEditor({ roster, assignments, setAssignments }) {
  if (roster.length === 0) {
    return <p className="assignment-empty-note">Aucun joueur dans l'effectif pour l'instant — ajoutes-en depuis l'onglet Effectifs, ou continue sans association (numéros bruts, comme avant).</p>;
  }
  const numberByRosterId = {};
  Object.entries(assignments).forEach(([num, rid]) => { numberByRosterId[rid] = num; });

  function setNumberFor(rosterId, num) {
    const next = { ...assignments };
    Object.keys(next).forEach((k) => { if (next[k] === rosterId) delete next[k]; });
    if (num) next[num] = rosterId;
    setAssignments(next);
  }

  return (
    <div className="assignment-editor">
      <div className="radar-range-label">Associer un numéro à chaque joueur pour ce match (optionnel)</div>
      <div className="assignment-list">
        {roster.map((p) => (
          <div className="assignment-row" key={p.id}>
            <span className="assignment-name">{p.name} <span className="assignment-position">({p.position})</span></span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="N°"
              className="assignment-number-input"
              value={numberByRosterId[p.id] || ""}
              onChange={(e) => setNumberFor(p.id, e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeScreen({ matches, matchesLoaded, showNewForm, setShowNewForm, newMatchForm, setNewMatchForm, createMatch, openMatch, deleteMatch, importMatchesFile, roster }) {
  const importInputRef = useRef(null);
  return (
    <div className="home">
      <header className="home-header">
        <div className="eyebrow">Assistant coaching</div>
        <h1>Studio</h1>
        <p className="subtitle">Repère chaque action pendant le match, les statistiques se construisent toutes seules.</p>
      </header>

      {!showNewForm && (
        <div className="home-actions-row">
          <button className="btn btn-primary btn-large" onClick={() => setShowNewForm(true)}>
            + Nouveau match
          </button>
          <button className="btn btn-ghost btn-large" onClick={() => importInputRef.current && importInputRef.current.click()}>
            Importer un/des match(s) JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) importMatchesFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {showNewForm && (
        <div className="new-match-card">
          <label>
            Nom du match
            <input
              type="text"
              placeholder="ex. J24 - vs FC Rival"
              value={newMatchForm.name}
              onChange={(e) => setNewMatchForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Adversaire
            <input
              type="text"
              placeholder="FC Rival"
              value={newMatchForm.opponent}
              onChange={(e) => setNewMatchForm((f) => ({ ...f, opponent: e.target.value }))}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={newMatchForm.date}
              onChange={(e) => setNewMatchForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <PlayerAssignmentEditor
            roster={roster}
            assignments={newMatchForm.assignments}
            setAssignments={(a) => setNewMatchForm((f) => ({ ...f, assignments: a }))}
          />
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setShowNewForm(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={createMatch}>Commencer le tagging</button>
          </div>
        </div>
      )}

      <div className="match-list">
        {matchesLoaded && matches.length === 0 && (
          <div className="empty-state">Aucun match enregistré. Crée ton premier match pour commencer à taguer une vidéo.</div>
        )}
        {matches.map((m) => (
          <div className="match-card" key={m.id} onClick={() => openMatch(m)}>
            <div className="match-card-main">
              <div className="match-card-name">{m.name} {m.closed && <span className="closed-badge-inline">✓ clôturé</span>}</div>
              <div className="match-card-meta">vs {m.opponent} · {formatDateFr(m.date)}</div>
            </div>
            <div className="match-card-side">
              <span className="tag-count">{m.tagCount || 0} actions</span>
              <button className="btn btn-ghost btn-small" onClick={(e) => { e.stopPropagation(); openMatch(m, "rating"); }}>Noter</button>
              <button className="icon-btn" onClick={(e) => deleteMatch(m, e)} title="Supprimer" aria-label="Supprimer le match">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function summarizeMatchForStats(match) {
  const suggestions = computeRatingSuggestions(match);
  const goals = { us: 0, opp: 0 };
  match.tags.forEach((t) => { if (t.eventKey === "but") goals[t.team]++; });

  let possUs = null;
  if (match.possession && match.possession.length > 0) {
    const dur = { us: 0, opp: 0, neutral: 0 };
    match.possession.forEach((p) => {
      const end = p.end != null ? p.end : p.start;
      dur[p.team] += Math.max(0, end - p.start);
    });
    const total = dur.us + dur.opp + dur.neutral;
    possUs = total > 0 ? Math.round((dur.us / total) * 100) : null;
  }

  const teamRatings = (match.ratings && match.ratings.team) || {};
  return {
    id: match.id,
    name: match.name,
    opponent: match.opponent,
    date: match.date,
    goalsUs: goals.us,
    goalsOpp: goals.opp,
    possUs,
    teamSuggestUs: suggestions.team.us,
    teamAvgUs: suggestions.teamPlayerAvg.us,
    teamCoachUs: teamRatings.us && teamRatings.us.coachScore != null ? teamRatings.us.coachScore : null,
    tagCount: match.tags.length,
  };
}

function getAllPlayersEver(allMatches) {
  const seen = new Map();
  allMatches.forEach((match) => {
    const inThisMatch = new Set();
    match.tags.forEach((t) => { if (t.player && t.team === "us") inThisMatch.add(`${t.team}_${t.player}`); });
    inThisMatch.forEach((key) => {
      if (!seen.has(key)) {
        const idx = key.indexOf("_");
        seen.set(key, { team: key.slice(0, idx), player: key.slice(idx + 1), matchCount: 0 });
      }
      seen.get(key).matchCount++;
    });
  });
  return Array.from(seen.values()).sort((a, b) => b.matchCount - a.matchCount);
}

function getPlayerHistory(allMatches, team, player) {
  const key = `${team}_${player}`;
  return allMatches
    .map((match) => {
      const tagsForPlayer = match.tags.filter((t) => t.team === team && t.player === player);
      const rating = match.ratings && match.ratings.players && match.ratings.players[key];
      if (tagsForPlayer.length === 0 && !rating) return null;
      const suggestions = computeRatingSuggestions(match);
      return {
        matchId: match.id,
        matchName: match.name,
        date: match.date,
        actions: tagsForPlayer.length,
        suggestion: tagsForPlayer.length > 0 ? suggestions.players[key] : null,
        coachScore: rating && rating.coachScore != null ? rating.coachScore : null,
        comment: rating ? rating.comment : "",
      };
    })
    .filter(Boolean);
}

const POSITIONS = ["Gardien", "Défenseur", "Milieu", "Attaquant"];

function computePlayerUsageByRosterId(allFullMatches) {
  const map = {};
  allFullMatches.forEach((m) => {
    const assignments = m.playerAssignments || {};
    const seenInMatch = new Set();
    m.tags.forEach((t) => {
      if (t.team !== "us" || !t.player) return;
      const rosterId = assignments[t.player];
      if (!rosterId) return;
      if (!map[rosterId]) map[rosterId] = { matchCount: 0, totalActions: 0 };
      map[rosterId].totalActions++;
      seenInMatch.add(rosterId);
    });
    seenInMatch.forEach((rid) => { map[rid].matchCount++; });
  });
  return map;
}

function RosterScreen({ matches }) {
  const [roster, setRoster] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", position: "Attaquant", birthDate: "", notes: "" });
  const [allFullMatches, setAllFullMatches] = useState([]);
  const importInputRef = useRef(null);

  function importRosterFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        setRoster((prev) => {
          const merged = [...prev];
          list.forEach((p) => {
            const entry = { id: p.id || newId(), name: p.name || "Sans nom", position: p.position || "Attaquant", birthDate: p.birthDate || "", notes: p.notes || "" };
            const idx = merged.findIndex((m) => m.id === entry.id);
            if (idx >= 0) merged[idx] = entry; else merged.push(entry);
          });
          try {
            localStorage.setItem("tf_roster", JSON.stringify(merged));
          } catch (err) {
            alert("La sauvegarde a échoué.");
          }
          return merged;
        });
        alert(`${list.length} joueur${list.length > 1 ? "s" : ""} importé${list.length > 1 ? "s" : ""} dans l'effectif.`);
      } catch (err) {
        alert("Le fichier n'a pas pu être importé (JSON invalide).");
      }
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tf_roster");
      setRoster(raw ? JSON.parse(raw) : []);
    } catch (e) {
      setRoster([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const full = matches
      .map((m) => {
        try {
          const raw = localStorage.getItem(matchStorageKey(m.id));
          return raw ? JSON.parse(raw) : null;
        } catch (e) {
          return null;
        }
      })
      .filter((m) => m && m.closed);
    setAllFullMatches(full);
  }, [matches]);

  const usageMap = useMemo(() => computePlayerUsageByRosterId(allFullMatches), [allFullMatches]);

  function persist(next) {
    setRoster(next);
    try {
      localStorage.setItem("tf_roster", JSON.stringify(next));
    } catch (e) {
      alert("La sauvegarde a échoué.");
    }
  }

  function openNewForm() {
    setForm({ name: "", position: "Attaquant", birthDate: "", notes: "" });
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(p) {
    setForm({ name: p.name || "", position: p.position || "Attaquant", birthDate: p.birthDate || "", notes: p.notes || "" });
    setEditingId(p.id);
    setShowForm(true);
  }

  function savePlayer() {
    if (!form.name.trim()) {
      alert("Le nom est obligatoire.");
      return;
    }
    if (editingId) {
      persist(roster.map((p) => (p.id === editingId ? { ...p, ...form } : p)));
    } else {
      persist([...roster, { id: newId(), ...form }]);
    }
    setShowForm(false);
  }

  function deletePlayer(id) {
    if (!confirm("Supprimer cette fiche de l'effectif ? (les données déjà taguées et les associations déjà faites dans Studio ne sont pas affectées)")) return;
    persist(roster.filter((p) => p.id !== id));
  }

  const sorted = [...roster].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <div className="stats-screen">
      <div className="stats-screen-header">
        <div className="eyebrow">Assistant coaching</div>
        <h1>Effectifs</h1>
        <p className="subtitle">Les fiches de tes joueurs, par nom — le numéro se choisit match par match dans Studio, puisqu'il peut changer.</p>
      </div>

      {!showForm && (
        <div className="home-actions-row" style={{ marginBottom: 20 }}>
          <button className="btn btn-primary btn-large" onClick={openNewForm}>
            + Ajouter un joueur
          </button>
          <button className="btn btn-ghost btn-large" onClick={() => importInputRef.current && importInputRef.current.click()}>
            Importer un/des joueur(s) JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) importRosterFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {showForm && (
        <div className="new-match-card">
          <label>
            Nom
            <input type="text" placeholder="ex. Martin Dubois" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label>
            Poste
            <select value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}>
              {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
            </select>
          </label>
          <label>
            Date de naissance (optionnel)
            <input type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
          </label>
          <label>
            Notes (optionnel)
            <input type="text" placeholder="ex. capitaine, revient de blessure..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={savePlayer}>Enregistrer</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {loaded && sorted.length === 0 && !showForm && (
        <div className="empty-state">Aucun joueur enregistré pour l'instant — ajoute ta première fiche.</div>
      )}

      <div className="roster-grid">
        {sorted.map((p) => {
          const usage = usageMap[p.id];
          return (
            <div className="roster-card" key={p.id}>
              <div className="roster-card-info">
                <div className="roster-card-name">{p.name}</div>
                <div className="roster-card-position">{p.position}</div>
                {p.birthDate && <div className="roster-card-meta">Né(e) le {formatDateFr(p.birthDate)}</div>}
                {p.notes && <div className="roster-card-meta">{p.notes}</div>}
                <div className="roster-card-usage">
                  {usage ? `${usage.matchCount} match${usage.matchCount > 1 ? "s" : ""} · ${usage.totalActions} actions taguées` : "Pas encore associé à un numéro sur un match clôturé"}
                </div>
              </div>
              <div className="roster-card-actions">
                <button className="btn btn-ghost btn-small" onClick={() => openEditForm(p)}>Modifier</button>
                <button className="icon-btn" onClick={() => deletePlayer(p.id)} aria-label="Supprimer"><X size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaceholderScreen({ title, description }) {
  return (
    <div className="placeholder-screen">
      <div className="eyebrow">Assistant coaching</div>
      <h1>{title}</h1>
      <p className="subtitle">{description}</p>
      <div className="placeholder-badge">Bientôt disponible</div>
    </div>
  );
}

function buildCollectiveComparison(closedMatches) {
  const last5 = closedMatches.slice(-5);
  const rows = ALL_EVENTS.map((ev) => {
    const matchValues = last5.map((m) => m.tags.filter((t) => t.eventKey === ev.key && t.team === "us").length);
    const allValues = closedMatches.map((m) => m.tags.filter((t) => t.eventKey === ev.key && t.team === "us").length);
    const avg = (arr) => (arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
    return { event: ev, matchValues, avgLast5: avg(matchValues), avgAll: avg(allValues) };
  });
  return { last5, rows };
}

function buildIndividualComparison(closedMatches, team, player) {
  const matchesWithPlayer = closedMatches.filter((m) => m.tags.some((t) => t.team === team && t.player === player));
  const last5 = matchesWithPlayer.slice(-5);
  const rows = ALL_EVENTS.map((ev) => {
    const matchValues = last5.map((m) => m.tags.filter((t) => t.eventKey === ev.key && t.team === team && t.player === player).length);
    const allValues = matchesWithPlayer.map((m) => m.tags.filter((t) => t.eventKey === ev.key && t.team === team && t.player === player).length);
    const avg = (arr) => (arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
    return { event: ev, matchValues, avgLast5: avg(matchValues), avgAll: avg(allValues) };
  });
  return { last5, rows, totalMatches: matchesWithPlayer.length };
}

function BarCell({ value, max, color }) {
  const pct = max > 0 ? Math.max(value > 0 ? 6 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar-cell-wrap">
      <div className="bar-cell-track">
        <div className="bar-cell-fill" style={{ height: `${pct}%`, background: color || "var(--gold)" }} />
      </div>
      <span className="bar-cell-num">{value}</span>
    </div>
  );
}

function rowMax(values) {
  return values.reduce((m, v) => (v > m ? v : m), 0);
}

const RADAR_AXES = [
  { key: "passes", label: "Passes", events: ["passe_ok", "passe_ko", "centre_ok", "centre_ko"] },
  { key: "technique", label: "Technique", events: ["controle_ok", "controle_ko", "dribble_ok", "dribble_ko"] },
  { key: "finition", label: "Finition", events: ["tir_cadre", "tir_hc", "but"] },
  { key: "defense", label: "Défense", events: ["recup", "tacle_ok", "tacle_ko", "interception", "degagement", "duel_ok", "duel_ko"] },
  { key: "discipline", label: "Discipline", events: ["faute_commise", "faute_subie", "carton_jaune", "carton_rouge", "hors_jeu"] },
];

const GK_RADAR_AXES = [
  { key: "arrets", label: "Arrêts", events: ["gardien_arret_ok", "gardien_arret_ko"] },
  { key: "sorties", label: "Sorties", events: ["gardien_sortie_ok", "gardien_sortie_ko"] },
  { key: "relances", label: "Relances", events: ["gardien_relance_ok", "gardien_relance_ko"] },
  { key: "duelsgk", label: "Duels", events: ["gardien_duel_ok", "gardien_duel_ko"] },
];

function computeRadarValues(tags, axes) {
  return axes.map((axis) => {
    let pos = 0, total = 0;
    tags.forEach((t) => {
      if (!axis.events.includes(t.eventKey)) return;
      total++;
      if (EVENT_MAP[t.eventKey].positive) pos++;
    });
    return { axis: axis.label, value: total > 0 ? Math.round((pos / total) * 100) : 0, hasData: total > 0 };
  });
}

function resolveScopeMatches(matches, config) {
  if (config.mode === "last5") return matches.slice(-5);
  if (config.mode === "custom") return matches.filter((m) => config.matchIds.includes(m.id));
  return matches;
}

function gatherPlayerTagsForConfig(allMatches, team, player, config) {
  const matchesWithPlayer = allMatches.filter((m) => m.tags.some((t) => t.team === team && t.player === player));
  const scope = resolveScopeMatches(matchesWithPlayer, config);
  return scope.flatMap((m) => m.tags.filter((t) => t.team === team && t.player === player));
}

function gatherTeamTagsForConfig(allMatches, team, config) {
  const scope = resolveScopeMatches(allMatches, config);
  return scope.flatMap((m) => m.tags.filter((t) => t.team === team));
}

function isGoalkeeper(allMatches, team, player) {
  return allMatches.some((m) => m.tags.some((t) => t.team === team && t.player === player && t.eventKey.startsWith("gardien_")));
}

function detectTrend(series) {
  const vals = series.filter((v) => v.value != null);
  if (vals.length < 3) return null;
  const [a, b, c] = vals.slice(-3);
  if (a.value < b.value && b.value < c.value) return { direction: "hausse", date: c.date, matchName: c.matchName };
  if (a.value > b.value && b.value > c.value) return { direction: "baisse", date: c.date, matchName: c.matchName };
  return null;
}

function detectSustainedDeviation(series) {
  const vals = series.filter((v) => v.value != null);
  if (vals.length < 4) return null;
  const avg = vals.reduce((a, v) => a + v.value, 0) / vals.length;
  const last3 = vals.slice(-3);
  const ref = last3[2];
  if (last3.every((v) => v.value < avg)) return { direction: "sous", avg: Math.round(avg * 10) / 10, date: ref.date, matchName: ref.matchName };
  if (last3.every((v) => v.value > avg)) return { direction: "au-dessus de", avg: Math.round(avg * 10) / 10, date: ref.date, matchName: ref.matchName };
  return null;
}

function detectRecord(series) {
  const vals = series.filter((v) => v.value != null);
  if (vals.length < 2) return null;
  const last = vals[vals.length - 1];
  const prevVals = vals.slice(0, -1).map((v) => v.value);
  if (last.value > Math.max(...prevVals)) return { type: "meilleur", value: last.value, date: last.date, matchName: last.matchName };
  if (last.value < Math.min(...prevVals)) return { type: "pire", value: last.value, date: last.date, matchName: last.matchName };
  return null;
}

function signalsForSeries(series, scope, metricLabel) {
  const out = [];
  const trend = detectTrend(series);
  if (trend) out.push({ scope, positive: trend.direction === "hausse", text: `${metricLabel} en ${trend.direction} depuis 3 matchs`, date: trend.date, matchName: trend.matchName });
  const dev = detectSustainedDeviation(series);
  if (dev) out.push({ scope, positive: dev.direction === "au-dessus de", text: `${metricLabel} ${dev.direction} la moyenne perso (${dev.avg}/10) depuis 3 matchs`, date: dev.date, matchName: dev.matchName });
  const rec = detectRecord(series);
  if (rec) out.push({ scope, positive: rec.type === "meilleur", text: `${rec.type === "meilleur" ? "Meilleur" : "Pire"} score jamais enregistré pour ${metricLabel.toLowerCase()} (${rec.value}/10)`, date: rec.date, matchName: rec.matchName });
  return out;
}

function generateAllSignals(matchSummaries, allFullMatches, allPlayers, roster) {
  const signals = [];
  signals.push(...signalsForSeries(matchSummaries.map((m) => ({ value: m.teamSuggestUs, date: m.date, matchName: m.name })), "Équipe", "Suggestion"));
  signals.push(...signalsForSeries(matchSummaries.map((m) => ({ value: m.teamCoachUs, date: m.date, matchName: m.name })), "Équipe", "Note du coach"));
  allPlayers.forEach((p) => {
    const hist = getPlayerHistory(allFullMatches, p.team, p.player);
    const label = rosterDisplayLabel(p.player, roster);
    signals.push(...signalsForSeries(hist.map((h) => ({ value: h.suggestion, date: h.date, matchName: h.matchName })), label, "Suggestion"));
    signals.push(...signalsForSeries(hist.map((h) => ({ value: h.coachScore, date: h.date, matchName: h.matchName })), label, "Note du coach"));
  });
  return signals.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function computeProfileStability(allFullMatches) {
  const perMatchRadar = allFullMatches.map((m) => {
    const tags = m.tags.filter((t) => t.team === "us");
    const values = computeRadarValues(tags, RADAR_AXES);
    let bestIdx = 0;
    values.forEach((v, i) => { if (v.value > values[bestIdx].value) bestIdx = i; });
    return { matchName: m.name, values, dominantAxis: RADAR_AXES[bestIdx].label };
  });

  const axisStability = RADAR_AXES.map((axis, i) => {
    const vals = perMatchRadar.map((m) => m.values[i].value);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;
    return { axis: axis.label, min, max, spread: max - min };
  }).sort((a, b) => a.spread - b.spread);

  const dominantCounts = {};
  RADAR_AXES.forEach((a) => { dominantCounts[a.label] = 0; });
  perMatchRadar.forEach((m) => { dominantCounts[m.dominantAxis]++; });

  return { axisStability, dominantCounts, matchCount: perMatchRadar.length };
}

function suggestionToColor(score) {
  const t = Math.max(0, Math.min(1, score / 10));
  const c1 = [214, 72, 63];
  const c2 = [227, 178, 60];
  const rgb = c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function resultLetter(goalsUs, goalsOpp) {
  if (goalsUs > goalsOpp) return "V";
  if (goalsUs < goalsOpp) return "D";
  return "N";
}

function computeSquadUsage(allFullMatches, allPlayers) {
  return allPlayers
    .map((p) => {
      let totalActions = 0;
      allFullMatches.forEach((m) => {
        totalActions += m.tags.filter((t) => t.team === p.team && t.player === p.player).length;
      });
      return {
        player: p.player,
        matchCount: p.matchCount,
        totalActions,
        avgPerMatch: p.matchCount > 0 ? Math.round((totalActions / p.matchCount) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.matchCount - a.matchCount || b.totalActions - a.totalActions);
}

function computeSeasonHighlights(matchSummaries, allFullMatches, allPlayers) {
  if (matchSummaries.length === 0) return null;

  const sorted = [...matchSummaries].sort((a, b) => b.teamSuggestUs - a.teamSuggestUs);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  let streakType = null;
  let streakCount = 0;
  for (let i = matchSummaries.length - 1; i >= 0; i--) {
    const m = matchSummaries[i];
    const isWin = m.goalsUs > m.goalsOpp;
    if (streakType === null) {
      streakType = isWin ? "victoires" : "sans victoire";
      streakCount = 1;
    } else if ((streakType === "victoires") === isWin) {
      streakCount++;
    } else break;
  }

  let mostConsistent = null;
  let lowestStdev = Infinity;
  allPlayers.forEach((p) => {
    const hist = getPlayerHistory(allFullMatches, p.team, p.player);
    const suggs = hist.map((h) => h.suggestion).filter((v) => v != null);
    if (suggs.length < 3) return;
    const avg = suggs.reduce((a, b) => a + b, 0) / suggs.length;
    const variance = suggs.reduce((a, v) => a + (v - avg) ** 2, 0) / suggs.length;
    const stdev = Math.sqrt(variance);
    if (stdev < lowestStdev) {
      lowestStdev = stdev;
      mostConsistent = { player: p.player, avg: Math.round(avg * 10) / 10, matches: suggs.length };
    }
  });

  return { best, worst, streakType, streakCount, mostConsistent };
}

function RadarRangeControl({ config, setConfig, allMatches, label }) {
  return (
    <div className="radar-range-control">
      {label && <div className="radar-range-label">{label}</div>}
      <div className="range-filter-actions">
        <button className={`range-preset-btn ${config.mode === "all" ? "active-preset" : ""}`} onClick={() => setConfig({ ...config, mode: "all" })}>Moyenne d'ensemble</button>
        <button className={`range-preset-btn ${config.mode === "last5" ? "active-preset" : ""}`} onClick={() => setConfig({ ...config, mode: "last5" })}>5 derniers matchs</button>
        <button className={`range-preset-btn ${config.mode === "custom" ? "active-preset" : ""}`} onClick={() => setConfig({ ...config, mode: "custom" })}>1 ou plusieurs matchs</button>
      </div>
      {config.mode === "custom" && (
        <div className="multi-select-list radar-match-list">
          {allMatches.length === 0 && <div className="empty-state">Aucun match clôturé.</div>}
          {allMatches.slice().reverse().map((m) => (
            <label key={m.id} className="multi-select-item">
              <input
                type="checkbox"
                checked={config.matchIds.includes(m.id)}
                onChange={() => {
                  const next = config.matchIds.includes(m.id) ? config.matchIds.filter((x) => x !== m.id) : [...config.matchIds, m.id];
                  setConfig({ ...config, matchIds: next });
                }}
              />
              {m.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function withResolvedIdentities(allFullMatches, roster) {
  if (!roster || roster.length === 0) return allFullMatches;
  const rosterById = {};
  roster.forEach((r) => { rosterById[r.id] = r; });

  return allFullMatches.map((m) => {
    const assignments = m.playerAssignments || {};
    const resolveToken = (num) => {
      const rid = assignments[num];
      return rid && rosterById[rid] ? `R${rid}` : num;
    };
    const newTags = m.tags.map((t) => {
      if (t.team !== "us" || !t.player) return t;
      const token = resolveToken(t.player);
      return token === t.player ? t : { ...t, player: token };
    });
    let newRatingsPlayers = m.ratings && m.ratings.players;
    if (newRatingsPlayers) {
      const remapped = {};
      Object.entries(newRatingsPlayers).forEach(([key, val]) => {
        const idx = key.indexOf("_");
        const kTeam = key.slice(0, idx);
        const kNum = key.slice(idx + 1);
        if (kTeam === "us") {
          const token = resolveToken(kNum);
          remapped[`us_${token}`] = val;
        } else {
          remapped[key] = val;
        }
      });
      newRatingsPlayers = remapped;
    }
    return { ...m, tags: newTags, ratings: { ...m.ratings, players: newRatingsPlayers || {} } };
  });
}

function rosterDisplayLabel(playerToken, roster) {
  if (typeof playerToken === "string" && playerToken.startsWith("R")) {
    const id = playerToken.slice(1);
    const r = roster.find((x) => x.id === id);
    if (r) return r.name;
  }
  return `n°${playerToken}`;
}

function StatsScreen({ matches }) {
  const [rawFullMatches, setRawFullMatches] = useState([]);
  const [roster, setRoster] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPlayerKey, setSelectedPlayerKey] = useState("");
  const [statsSubTab, setStatsSubTab] = useState("collectif");
  const [compareMatchIds, setCompareMatchIds] = useState([]);
  const [comparePlayerKeys, setComparePlayerKeys] = useState([]);
  const [radarMainConfig, setRadarMainConfig] = useState({ mode: "all", matchIds: [] });
  const [radarCompareWith, setRadarCompareWith] = useState("");
  const [radarCompareConfig, setRadarCompareConfig] = useState({ mode: "all", matchIds: [] });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tf_roster");
      setRoster(raw ? JSON.parse(raw) : []);
    } catch (e) {
      setRoster([]);
    }
  }, []);

  useEffect(() => {
    const full = matches
      .map((m) => {
        try {
          const raw = localStorage.getItem(matchStorageKey(m.id));
          return raw ? JSON.parse(raw) : null;
        } catch (e) {
          return null;
        }
      })
      .filter((m) => m && m.closed)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    setRawFullMatches(full);
    setLoaded(true);
  }, [matches]);

  // allFullMatches : version résolue (identité joueur via effectif + associations) — toutes les
  // fonctions de cette page qui suivent opèrent dessus, exactement comme avant l'ajout de l'effectif.
  const allFullMatches = useMemo(() => withResolvedIdentities(rawFullMatches, roster), [rawFullMatches, roster]);

  const matchSummaries = useMemo(() => allFullMatches.map(summarizeMatchForStats), [allFullMatches]);
  const allPlayers = useMemo(() => getAllPlayersEver(allFullMatches), [allFullMatches]);
  const [selTeam, selPlayer] = selectedPlayerKey ? [selectedPlayerKey.slice(0, selectedPlayerKey.indexOf("_")), selectedPlayerKey.slice(selectedPlayerKey.indexOf("_") + 1)] : [null, null];
  const playerHistory = useMemo(
    () => (selTeam ? getPlayerHistory(allFullMatches, selTeam, selPlayer) : []),
    [allFullMatches, selTeam, selPlayer]
  );
  const [teamRadarMainConfig, setTeamRadarMainConfig] = useState({ mode: "all", matchIds: [] });
  const [teamRadarCompareEnabled, setTeamRadarCompareEnabled] = useState(false);
  const [teamRadarCompareConfig, setTeamRadarCompareConfig] = useState({ mode: "last5", matchIds: [] });
  const teamRadarChartData = useMemo(() => {
    const mainTags = gatherTeamTagsForConfig(allFullMatches, "us", teamRadarMainConfig);
    const mainValues = computeRadarValues(mainTags, RADAR_AXES);
    let compareValues = null;
    if (teamRadarCompareEnabled) {
      const compareTags = gatherTeamTagsForConfig(allFullMatches, "us", teamRadarCompareConfig);
      compareValues = computeRadarValues(compareTags, RADAR_AXES);
    }
    return RADAR_AXES.map((axis, i) => ({
      axis: axis.label,
      main: mainValues[i].value,
      compare: compareValues ? compareValues[i].value : undefined,
    }));
  }, [allFullMatches, teamRadarMainConfig, teamRadarCompareEnabled, teamRadarCompareConfig]);

  const profileStability = useMemo(() => computeProfileStability(allFullMatches), [allFullMatches]);
  const squadUsage = useMemo(() => computeSquadUsage(allFullMatches, allPlayers), [allFullMatches, allPlayers]);
  const seasonHighlights = useMemo(
    () => computeSeasonHighlights(matchSummaries, allFullMatches, allPlayers),
    [matchSummaries, allFullMatches, allPlayers]
  );

  const collectiveComparison = useMemo(() => buildCollectiveComparison(allFullMatches), [allFullMatches]);
  const individualComparison = useMemo(
    () => (selTeam ? buildIndividualComparison(allFullMatches, selTeam, selPlayer) : null),
    [allFullMatches, selTeam, selPlayer]
  );
  const playerOverallAvg = useMemo(() => {
    const sugg = playerHistory.map((h) => h.suggestion).filter((v) => v != null);
    const coach = playerHistory.map((h) => h.coachScore).filter((v) => v != null);
    const avg = (arr) => (arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
    return { suggestion: avg(sugg), coachScore: avg(coach) };
  }, [playerHistory]);

  const selectedIsGoalkeeper = selTeam ? isGoalkeeper(allFullMatches, selTeam, selPlayer) : false;
  const radarAxesUsed = selectedIsGoalkeeper ? GK_RADAR_AXES : RADAR_AXES;
  const radarMainValues = useMemo(() => {
    if (!selTeam) return null;
    const tags = gatherPlayerTagsForConfig(allFullMatches, selTeam, selPlayer, radarMainConfig);
    return computeRadarValues(tags, radarAxesUsed);
  }, [allFullMatches, selTeam, selPlayer, radarMainConfig, selectedIsGoalkeeper]);

  const radarCompareValues = useMemo(() => {
    if (!radarCompareWith || !selTeam) return null;
    if (radarCompareWith === "team_us") {
      const tags = gatherTeamTagsForConfig(allFullMatches, "us", radarCompareConfig);
      return computeRadarValues(tags, radarAxesUsed);
    }
    const idx = radarCompareWith.indexOf("_");
    const cTeam = radarCompareWith.slice(0, idx);
    const cPlayer = radarCompareWith.slice(idx + 1);
    const tags = gatherPlayerTagsForConfig(allFullMatches, cTeam, cPlayer, radarCompareConfig);
    return computeRadarValues(tags, radarAxesUsed);
  }, [allFullMatches, radarCompareWith, radarCompareConfig, radarAxesUsed, selTeam]);

  const radarChartData = useMemo(() => {
    if (!radarMainValues) return [];
    return radarAxesUsed.map((axis, i) => ({
      axis: axis.label,
      main: radarMainValues[i].value,
      compare: radarCompareValues ? radarCompareValues[i].value : undefined,
    }));
  }, [radarMainValues, radarCompareValues, radarAxesUsed]);

  const allSignals = useMemo(
    () => generateAllSignals(matchSummaries, allFullMatches, allPlayers, roster),
    [matchSummaries, allFullMatches, allPlayers, roster]
  );
  const teamSignals = useMemo(() => allSignals.filter((s) => s.scope === "Équipe"), [allSignals]);
  const individualSignals = useMemo(() => allSignals.filter((s) => s.scope !== "Équipe"), [allSignals]);
  const currentPlayerLabel = selTeam ? `${rosterDisplayLabel(selPlayer, roster)} (${selTeam === "us" ? "Nous" : "Adversaire"})` : null;

  function toggleMatchCompare(id) {
    setCompareMatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function togglePlayerCompare(key) {
    setComparePlayerKeys((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  const selectedMatchesForCompare = useMemo(
    () => allFullMatches.filter((m) => compareMatchIds.includes(m.id)),
    [allFullMatches, compareMatchIds]
  );
  const matchCompareRows = useMemo(() => {
    if (selectedMatchesForCompare.length < 2) return [];
    return ALL_EVENTS.map((ev) => ({
      event: ev,
      values: selectedMatchesForCompare.map((m) => m.tags.filter((t) => t.eventKey === ev.key && t.team === "us").length),
    }));
  }, [selectedMatchesForCompare]);

  const selectedPlayersForCompare = useMemo(
    () => comparePlayerKeys.map((key) => {
      const idx = key.indexOf("_");
      return { key, team: key.slice(0, idx), player: key.slice(idx + 1) };
    }),
    [comparePlayerKeys]
  );
  const playerCompareRows = useMemo(() => {
    if (selectedPlayersForCompare.length < 2) return [];
    const perPlayerMatches = selectedPlayersForCompare.map((p) =>
      allFullMatches.filter((m) => m.tags.some((t) => t.team === p.team && t.player === p.player))
    );
    return ALL_EVENTS.map((ev) => ({
      event: ev,
      values: selectedPlayersForCompare.map((p, i) => {
        const counts = perPlayerMatches[i].map((m) => m.tags.filter((t) => t.eventKey === ev.key && t.team === p.team && t.player === p.player).length);
        return counts.length > 0 ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : 0;
      }),
    }));
  }, [selectedPlayersForCompare, allFullMatches]);

  function downloadCollectiveComparison() {
    const { last5, rows } = collectiveComparison;
    const header = ["Action", ...last5.map((m) => m.name), `Moyenne ${last5.length} derniers`, `Moyenne ensemble (${allFullMatches.length})`];
    const csvRows = [header, ...rows.map((r) => [r.event.label, ...r.matchValues, r.avgLast5, r.avgAll])];
    downloadCSV("comparaison_collective.csv", csvRows);
  }

  function downloadIndividualComparison() {
    if (!individualComparison) return;
    const { last5, rows } = individualComparison;
    const header = ["Action", ...last5.map((m) => m.name), `Moyenne ${last5.length} derniers`, `Moyenne ensemble (${individualComparison.totalMatches})`];
    const csvRows = [header, ...rows.map((r) => [r.event.label, ...r.matchValues, r.avgLast5, r.avgAll])];
    const safeName = rosterDisplayLabel(selPlayer, roster).replace(/[^a-zA-Z0-9]+/g, "_");
    downloadCSV(`comparaison_${safeName}.csv`, csvRows);
  }

  return (
    <div className="stats-screen">
      <div className="stats-screen-header">
        <div className="eyebrow">Assistant coaching</div>
        <h1>Statistiques</h1>
        <p className="subtitle">L'évolution de l'équipe et de chaque joueur à travers tous les matchs clôturés.</p>
      </div>

      {matchSummaries.length > 0 && (
        <div className="tabs">
          <button className={`tab ${statsSubTab === "collectif" ? "active" : ""}`} onClick={() => setStatsSubTab("collectif")}>Collectif</button>
          <button className={`tab ${statsSubTab === "individuel" ? "active" : ""}`} onClick={() => setStatsSubTab("individuel")}>Individuel</button>
          <button className={`tab ${statsSubTab === "comparematch" ? "active" : ""}`} onClick={() => setStatsSubTab("comparematch")}>Comparaison match</button>
          <button className={`tab ${statsSubTab === "compareplayer" ? "active" : ""}`} onClick={() => setStatsSubTab("compareplayer")}>Comparaison joueur</button>
          <button className={`tab ${statsSubTab === "signaux" ? "active" : ""}`} onClick={() => setStatsSubTab("signaux")}>Signaux{allSignals.length > 0 ? ` (${allSignals.length})` : ""}</button>
        </div>
      )}

      {!loaded && <div className="empty-state">Chargement…</div>}
      {loaded && matchSummaries.length === 0 && (
        <div className="empty-state">Aucun match clôturé pour l'instant — clôture un match depuis Studio une fois son tagging terminé pour le voir apparaître ici.</div>
      )}

      {matchSummaries.length > 0 && statsSubTab === "collectif" && (
        <>
          {seasonHighlights && (
            <div className="comparison-summary-row highlights-row">
              <div className="comparison-summary-card">
                <h4>Meilleur match</h4>
                <div>{seasonHighlights.best.name}</div>
                <div>Suggestion : {seasonHighlights.best.teamSuggestUs}/10</div>
              </div>
              <div className="comparison-summary-card">
                <h4>Pire match</h4>
                <div>{seasonHighlights.worst.name}</div>
                <div>Suggestion : {seasonHighlights.worst.teamSuggestUs}/10</div>
              </div>
              <div className="comparison-summary-card">
                <h4>Série en cours</h4>
                <div>{seasonHighlights.streakCount} {seasonHighlights.streakType} de suite</div>
              </div>
              <div className="comparison-summary-card">
                <h4>Joueur le plus régulier</h4>
                {seasonHighlights.mostConsistent ? (
                  <>
                    <div>{rosterDisplayLabel(seasonHighlights.mostConsistent.player, roster)}</div>
                    <div>Moy. {seasonHighlights.mostConsistent.avg}/10 sur {seasonHighlights.mostConsistent.matches} matchs</div>
                  </>
                ) : (
                  <div>Pas encore assez de matchs par joueur</div>
                )}
              </div>
            </div>
          )}

          <div className="panel-heading">Évolution de l'équipe (Nous)</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={matchSummaries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26362C" />
                <XAxis dataKey="name" stroke="#8FA599" fontSize={10} />
                <YAxis domain={[0, 10]} stroke="#8FA599" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#182A21", border: "1px solid #26362C", borderRadius: 6, color: "#EEF3EC" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="teamSuggestUs" name="Suggestion" stroke="#E3B23C" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="teamAvgUs" name="Moyenne joueurs" stroke="#8FA599" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="teamCoachUs" name="Note du coach" stroke="#D6483F" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="table-scroll">
            <table className="stat-table">
              <thead>
                <tr><th>Match</th><th>Date</th><th>Score</th><th>Possession</th><th>Suggestion</th><th>Moy. joueurs</th><th>Note coach</th></tr>
              </thead>
              <tbody>
                {matchSummaries.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{formatDateFr(s.date)}</td>
                    <td>{s.goalsUs} - {s.goalsOpp}</td>
                    <td>{s.possUs != null ? `${s.possUs}%` : "—"}</td>
                    <td>{s.teamSuggestUs}/10</td>
                    <td>{s.teamAvgUs != null ? `${s.teamAvgUs}/10` : "—"}</td>
                    <td>{s.teamCoachUs != null ? `${s.teamCoachUs}/10` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel-heading" style={{ marginTop: 20, marginBottom: 8 }}>Profil radar collectif (Nous)</div>
          <RadarRangeControl config={teamRadarMainConfig} setConfig={setTeamRadarMainConfig} allMatches={allFullMatches} label="Période du profil principal" />

          <label className="radar-compare-toggle">
            <input type="checkbox" checked={teamRadarCompareEnabled} onChange={(e) => setTeamRadarCompareEnabled(e.target.checked)} />
            Comparer avec une autre période
          </label>
          {teamRadarCompareEnabled && (
            <RadarRangeControl config={teamRadarCompareConfig} setConfig={setTeamRadarCompareConfig} allMatches={allFullMatches} label="Période de comparaison" />
          )}

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={teamRadarChartData} outerRadius="70%">
                <PolarGrid stroke="#26362C" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#8FA599", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#8FA599", fontSize: 9 }} />
                <Tooltip contentStyle={{ background: "#182A21", border: "1px solid #26362C", borderRadius: 6, color: "#EEF3EC" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Radar name="Profil principal" dataKey="main" stroke="#E3B23C" fill="#E3B23C" fillOpacity={0.35} />
                {teamRadarCompareEnabled && <Radar name="Comparaison" dataKey="compare" stroke="#D6483F" fill="#D6483F" fillOpacity={0.2} />}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-heading" style={{ marginTop: 20 }}>Stabilité du profil de jeu</div>
          <p className="radar-note">Écart entre le match le plus fort et le plus faible sur chaque axe (calculé match par match, pas en moyenne) — plus l'écart est petit, plus l'axe est stable d'un match à l'autre.</p>
          <div className="table-scroll">
            <table className="stat-table">
              <thead><tr><th>Axe</th><th>Min</th><th>Max</th><th>Écart</th></tr></thead>
              <tbody>
                {profileStability.axisStability.map((a) => (
                  <tr key={a.axis}>
                    <td>{a.axis}</td>
                    <td>{a.min}%</td>
                    <td>{a.max}%</td>
                    <td>{a.spread} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dominant-axis-row">
            {Object.entries(profileStability.dominantCounts).sort((a, b) => b[1] - a[1]).map(([axis, count]) => (
              <span key={axis} className="dominant-axis-chip">{axis} : {count}/{profileStability.matchCount}</span>
            ))}
          </div>

          <div className="range-filter-header" style={{ marginTop: 20 }}>
            <div className="panel-heading" style={{ marginBottom: 0 }}>Comparaison collective (Nous) — toutes les statistiques</div>
            <button className="btn btn-ghost btn-small" onClick={downloadCollectiveComparison}><Download size={12} /> CSV</button>
          </div>
          <div className="table-scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>Action</th>
                  {collectiveComparison.last5.map((m) => <th key={m.id}>{m.name}</th>)}
                  <th className="col-us">Moy. {collectiveComparison.last5.length} derniers</th>
                  <th className="col-us">Moy. ensemble ({allFullMatches.length})</th>
                </tr>
              </thead>
              <tbody>
                {collectiveComparison.rows.map((r) => {
                  const max = rowMax([...r.matchValues, r.avgLast5, r.avgAll]);
                  return (
                    <tr key={r.event.key}>
                      <td>{r.event.label}</td>
                      {r.matchValues.map((v, i) => <td key={i}><BarCell value={v} max={max} /></td>)}
                      <td><BarCell value={r.avgLast5} max={max} color="var(--ink-muted)" /></td>
                      <td><BarCell value={r.avgAll} max={max} color="var(--crimson)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="panel-heading" style={{ marginTop: 20 }}>Utilisation du groupe</div>
          <div className="table-scroll">
            <table className="stat-table">
              <thead><tr><th>Joueur</th><th>Matchs</th><th>Actions totales</th><th>Moy. par match</th></tr></thead>
              <tbody>
                {squadUsage.map((p) => (
                  <tr key={p.player}>
                    <td>{rosterDisplayLabel(p.player, roster)}</td>
                    <td>{p.matchCount}</td>
                    <td>{p.totalActions}</td>
                    <td>{p.avgPerMatch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {matchSummaries.length > 0 && statsSubTab === "individuel" && (
        <>
          <div className="panel-heading">Choisir un joueur</div>
          <select className="player-select" value={selectedPlayerKey} onChange={(e) => setSelectedPlayerKey(e.target.value)}>
            <option value="">Choisir un joueur…</option>
            {allPlayers.map((p) => (
              <option key={`${p.team}_${p.player}`} value={`${p.team}_${p.player}`}>
                {rosterDisplayLabel(p.player, roster)} — {p.matchCount} match{p.matchCount > 1 ? "s" : ""}
              </option>
            ))}
          </select>

          {selectedPlayerKey && playerHistory.length > 0 && (
            <>
              <div className="panel-heading" style={{ marginTop: 16 }}>Évolution du joueur</div>
              {(playerOverallAvg.suggestion != null || playerOverallAvg.coachScore != null) && (
                <div className="player-avg-summary">
                  {playerOverallAvg.suggestion != null && <span>Moyenne suggestion (ensemble) : <strong>{playerOverallAvg.suggestion}/10</strong></span>}
                  {playerOverallAvg.coachScore != null && <span>Moyenne note du coach (ensemble) : <strong>{playerOverallAvg.coachScore}/10</strong></span>}
                </div>
              )}
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={playerHistory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#26362C" />
                    <XAxis dataKey="matchName" stroke="#8FA599" fontSize={10} />
                    <YAxis domain={[0, 10]} stroke="#8FA599" fontSize={10} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#182A21", border: "1px solid #26362C", borderRadius: 6, color: "#EEF3EC" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {playerOverallAvg.suggestion != null && (
                      <ReferenceLine y={playerOverallAvg.suggestion} stroke="#E3B23C" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Moy. ${playerOverallAvg.suggestion}`, fontSize: 9, fill: "#E3B23C", position: "insideTopLeft" }} />
                    )}
                    {playerOverallAvg.coachScore != null && (
                      <ReferenceLine y={playerOverallAvg.coachScore} stroke="#D6483F" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Moy. ${playerOverallAvg.coachScore}`, fontSize: 9, fill: "#D6483F", position: "insideBottomLeft" }} />
                    )}
                    <Line type="monotone" dataKey="suggestion" name="Suggestion" stroke="#E3B23C" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="coachScore" name="Note du coach" stroke="#D6483F" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="table-scroll" style={{ marginTop: 12 }}>
                <table className="stat-table">
                  <thead><tr><th>Match</th><th>Date</th><th>Actions</th><th>Suggestion</th><th>Note coach</th></tr></thead>
                  <tbody>
                    {playerHistory.map((h) => (
                      <tr key={h.matchId}>
                        <td>{h.matchName}</td>
                        <td>{formatDateFr(h.date)}</td>
                        <td>{h.actions}</td>
                        <td>{h.suggestion != null ? `${h.suggestion}/10` : "—"}</td>
                        <td>{h.coachScore != null ? `${h.coachScore}/10` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {selectedPlayerKey && radarMainValues && (
            <>
              <div className="panel-heading" style={{ marginTop: 20, marginBottom: 8 }}>
                Profil radar{selectedIsGoalkeeper ? " — Gardien" : ""}
              </div>
              <RadarRangeControl config={radarMainConfig} setConfig={setRadarMainConfig} allMatches={allFullMatches} label="Période du profil principal" />

              <select className="player-select" value={radarCompareWith} onChange={(e) => setRadarCompareWith(e.target.value)}>
                <option value="">Comparer avec… (optionnel)</option>
                <option value="team_us">Moyenne de l'équipe (Nous)</option>
                {allPlayers.filter((p) => `${p.team}_${p.player}` !== selectedPlayerKey).map((p) => (
                  <option key={`${p.team}_${p.player}`} value={`${p.team}_${p.player}`}>
                    {rosterDisplayLabel(p.player, roster)}
                  </option>
                ))}
              </select>
              {radarCompareWith && (
                <RadarRangeControl config={radarCompareConfig} setConfig={setRadarCompareConfig} allMatches={allFullMatches} label="Période de comparaison" />
              )}
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarChartData} outerRadius="70%">
                    <PolarGrid stroke="#26362C" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "#8FA599", fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#8FA599", fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: "#182A21", border: "1px solid #26362C", borderRadius: 6, color: "#EEF3EC" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Radar name={currentPlayerLabel} dataKey="main" stroke="#E3B23C" fill="#E3B23C" fillOpacity={0.35} />
                    {radarCompareValues && (
                      <Radar
                        name={radarCompareWith === "team_us" ? "Nous (moyenne)" : rosterDisplayLabel(radarCompareWith.slice(radarCompareWith.indexOf("_") + 1), roster)}
                        dataKey="compare"
                        stroke="#D6483F"
                        fill="#D6483F"
                        fillOpacity={0.2}
                      />
                    )}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="radar-note">Chaque axe est le taux de réussite (0-100%) des actions liées, sur la période choisie. Un axe à 0 sans repère signifie qu'aucune action de ce type n'a encore été taguée.</p>
            </>
          )}

          {individualComparison && (
            <>
              <div className="range-filter-header" style={{ marginTop: 20 }}>
                <div className="panel-heading" style={{ marginBottom: 0 }}>Comparaison individuelle — toutes les statistiques</div>
                <button className="btn btn-ghost btn-small" onClick={downloadIndividualComparison}><Download size={12} /> CSV</button>
              </div>
              <div className="table-scroll">
                <table className="stat-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      {individualComparison.last5.map((m) => <th key={m.id}>{m.name}</th>)}
                      <th className="col-us">Moy. {individualComparison.last5.length} derniers</th>
                      <th className="col-us">Moy. ensemble ({individualComparison.totalMatches})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {individualComparison.rows.map((r) => {
                      const max = rowMax([...r.matchValues, r.avgLast5, r.avgAll]);
                      return (
                        <tr key={r.event.key}>
                          <td>{r.event.label}</td>
                          {r.matchValues.map((v, i) => <td key={i}><BarCell value={v} max={max} /></td>)}
                          <td><BarCell value={r.avgLast5} max={max} color="var(--ink-muted)" /></td>
                          <td><BarCell value={r.avgAll} max={max} color="var(--crimson)" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {matchSummaries.length > 0 && statsSubTab === "comparematch" && (
        <>
          <div className="panel-heading">Choisir 2 matchs ou plus à comparer</div>
          <div className="multi-select-list">
            {allFullMatches.slice().reverse().map((m) => (
              <label key={m.id} className="multi-select-item">
                <input type="checkbox" checked={compareMatchIds.includes(m.id)} onChange={() => toggleMatchCompare(m.id)} />
                {m.name} — {formatDateFr(m.date)} (vs {m.opponent})
              </label>
            ))}
          </div>

          {selectedMatchesForCompare.length < 2 && <div className="empty-state">Sélectionne au moins 2 matchs pour afficher la comparaison.</div>}

          {selectedMatchesForCompare.length >= 2 && (
            <>
              <div className="comparison-summary-row">
                {selectedMatchesForCompare.map((m) => {
                  const s = summarizeMatchForStats(m);
                  return (
                    <div className="comparison-summary-card" key={m.id}>
                      <h4>{m.name}</h4>
                      <div>{formatDateFr(m.date)} · vs {m.opponent}</div>
                      <div>Score : {s.goalsUs} - {s.goalsOpp}</div>
                      <div>Possession : {s.possUs != null ? `${s.possUs}%` : "—"}</div>
                      <div>Suggestion : {s.teamSuggestUs}/10</div>
                    </div>
                  );
                })}
              </div>
              <div className="table-scroll">
                <table className="stat-table">
                  <thead>
                    <tr><th>Action</th>{selectedMatchesForCompare.map((m) => <th key={m.id}>{m.name}</th>)}</tr>
                  </thead>
                  <tbody>
                    {matchCompareRows.map((r) => {
                      const max = rowMax(r.values);
                      return (
                        <tr key={r.event.key}>
                          <td>{r.event.label}</td>
                          {r.values.map((v, i) => <td key={i}><BarCell value={v} max={max} /></td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {matchSummaries.length > 0 && statsSubTab === "compareplayer" && (
        <>
          <div className="panel-heading">Choisir 2 joueurs ou plus à comparer</div>
          <div className="multi-select-list">
            {allPlayers.map((p) => {
              const key = `${p.team}_${p.player}`;
              return (
                <label key={key} className="multi-select-item">
                  <input type="checkbox" checked={comparePlayerKeys.includes(key)} onChange={() => togglePlayerCompare(key)} />
                  <span className={`team-dot ${p.team}`} /> {rosterDisplayLabel(p.player, roster)} — {p.matchCount} match{p.matchCount > 1 ? "s" : ""}
                </label>
              );
            })}
          </div>

          {selectedPlayersForCompare.length < 2 && <div className="empty-state">Sélectionne au moins 2 joueurs pour afficher la comparaison (moyennes par match).</div>}

          {selectedPlayersForCompare.length >= 2 && (
            <>
              <div className="comparison-summary-row">
                {selectedPlayersForCompare.map((p) => {
                  const hist = getPlayerHistory(allFullMatches, p.team, p.player);
                  const sugg = hist.map((h) => h.suggestion).filter((v) => v != null);
                  const coach = hist.map((h) => h.coachScore).filter((v) => v != null);
                  const avg = (arr) => (arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
                  return (
                    <div className="comparison-summary-card" key={p.key}>
                      <h4>{rosterDisplayLabel(p.player, roster)}</h4>
                      <div>{hist.length} match{hist.length > 1 ? "s" : ""}</div>
                      <div>Moy. suggestion : {avg(sugg) != null ? `${avg(sugg)}/10` : "—"}</div>
                      <div>Moy. note coach : {avg(coach) != null ? `${avg(coach)}/10` : "—"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="table-scroll">
                <table className="stat-table">
                  <thead>
                    <tr><th>Action (moyenne/match)</th>{selectedPlayersForCompare.map((p) => <th key={p.key}>{rosterDisplayLabel(p.player, roster)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {playerCompareRows.map((r) => {
                      const max = rowMax(r.values);
                      return (
                        <tr key={r.event.key}>
                          <td>{r.event.label}</td>
                          {r.values.map((v, i) => <td key={i}><BarCell value={v} max={max} /></td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {matchSummaries.length > 0 && statsSubTab === "signaux" && (
        <>
          {allSignals.length === 0 && (
            <div className="empty-state">Rien à signaler pour l'instant — les signaux apparaissent à partir de 3-4 matchs clôturés pour une même équipe ou un même joueur.</div>
          )}
          {allSignals.length > 0 && (
            <>
              <div className="panel-heading">Signaux équipe</div>
              {teamSignals.length === 0 && <div className="empty-state">Rien à signaler pour l'équipe pour l'instant.</div>}
              {teamSignals.length > 0 && (
                <div className="signals-box signals-box-full">
                  {teamSignals.map((s, i) => (
                    <div key={i} className={`signal-item ${s.positive ? "positive" : "negative"}`}>
                      {s.text}
                      <span className="signal-date">détecté le {formatDateFr(s.date)} · {s.matchName}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="panel-heading" style={{ marginTop: 20 }}>Signaux individuels</div>
              {individualSignals.length === 0 && <div className="empty-state">Rien à signaler côté joueurs pour l'instant.</div>}
              {individualSignals.length > 0 && (
                <div className="signals-box signals-box-full">
                  {individualSignals.map((s, i) => (
                    <div key={i} className={`signal-item ${s.positive ? "positive" : "negative"}`}>
                      <span className="signal-scope">{s.scope}</span> — {s.text}
                      <span className="signal-date">détecté le {formatDateFr(s.date)} · {s.matchName}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function RatingScreen({ match, setTeamRating, setPlayerRating, goHome, goTagging, saveStatus, setMatchClosed }) {
  const suggestions = useMemo(() => computeRatingSuggestions(match), [match.tags]);
  const [newPlayerNum, setNewPlayerNum] = useState({ us: "", opp: "" });

  const combinedPlayers = useMemo(() => {
    const seen = new Map();
    match.tags.forEach((t) => {
      if (!t.player) return;
      const key = `${t.team}_${t.player}`;
      if (!seen.has(key)) seen.set(key, { team: t.team, player: t.player, total: 0 });
      seen.get(key).total++;
    });
    const ratingsPlayers = (match.ratings && match.ratings.players) || {};
    Object.keys(ratingsPlayers).forEach((key) => {
      if (seen.has(key)) return;
      const [team, player] = [key.slice(0, key.indexOf("_")), key.slice(key.indexOf("_") + 1)];
      seen.set(key, { team, player, total: 0 });
    });
    return Array.from(seen.values()).sort((a, b) => b.total - a.total);
  }, [match.tags, match.ratings]);

  function addManualPlayer(team) {
    const num = (newPlayerNum[team] || "").replace(/[^0-9]/g, "");
    if (!num) return;
    const key = `${team}_${num}`;
    const existing = (match.ratings && match.ratings.players && match.ratings.players[key]) || null;
    if (!existing) setPlayerRating(key, null, "");
    setNewPlayerNum((prev) => ({ ...prev, [team]: "" }));
  }

  function downloadRatings() {
    const rows = [["Équipe", "Joueur", "Suggestion", "Moyenne joueurs", "Note du coach", "Commentaire"]];
    ["us", "opp"].forEach((team) => {
      const teamLabel = team === "us" ? "Nous" : "Adversaire";
      const tRating = (match.ratings && match.ratings.team && match.ratings.team[team]) || null;
      rows.push([
        teamLabel,
        "Équipe (ensemble)",
        suggestions.team[team],
        suggestions.teamPlayerAvg[team] != null ? suggestions.teamPlayerAvg[team] : "",
        tRating && tRating.coachScore != null ? tRating.coachScore : "",
        tRating ? tRating.comment : "",
      ]);
      combinedPlayers.filter((p) => p.team === team).forEach((p) => {
        const key = `${p.team}_${p.player}`;
        const r = (match.ratings && match.ratings.players && match.ratings.players[key]) || null;
        rows.push([
          teamLabel,
          `n°${p.player}`,
          p.total > 0 ? suggestions.players[key] : "",
          "",
          r && r.coachScore != null ? r.coachScore : "",
          r ? r.comment : "",
        ]);
      });
    });
    downloadCSV(`${match.name.replace(/\s+/g, "_")}_notations.csv`, rows);
  }

  return (
    <div className="tagging">
      <div className="topbar">
        <button className="icon-btn" onClick={goHome} aria-label="Retour"><ArrowLeft size={16} /></button>
        <div className="topbar-title">
          <div className="topbar-name">{match.name}</div>
          <div className="topbar-meta">vs {match.opponent}</div>
        </div>
        <SaveIndicator status={saveStatus} />
        {match.closed ? (
          <button className="btn btn-ghost btn-small closed-badge" onClick={() => setMatchClosed(false)}>✓ Clôturé — rouvrir</button>
        ) : (
          <button className="btn btn-primary btn-small" onClick={() => setMatchClosed(true)}>Clôturer le match</button>
        )}
        <button className="btn btn-ghost btn-small" onClick={downloadRatings}><Download size={13} /> CSV</button>
        <button className="btn btn-ghost btn-small" onClick={goTagging}>Retour au tagging</button>
      </div>

      <div className="rating-content">
        <p className="rating-explainer">
          La <strong>suggestion</strong> est calculée automatiquement à partir des actions taguées et ne change jamais toute seule. La <strong>note du coach</strong> est un champ à part, entièrement libre — c'est celle-là qui reflète ton propre ressenti.
        </p>

        <div className="rating-columns">
          {["us", "opp"].map((team) => (
            <RatingColumn
              key={team}
              team={team}
              match={match}
              suggestions={suggestions}
              players={combinedPlayers.filter((p) => p.team === team)}
              setTeamRating={setTeamRating}
              setPlayerRating={setPlayerRating}
              newPlayerNum={newPlayerNum[team]}
              setNewPlayerNum={(v) => setNewPlayerNum((prev) => ({ ...prev, [team]: v }))}
              addManualPlayer={() => addManualPlayer(team)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RatingColumn({ team, match, suggestions, players, setTeamRating, setPlayerRating, newPlayerNum, setNewPlayerNum, addManualPlayer }) {
  const teamLabel = team === "us" ? "Nous" : "Adversaire";
  const teamRating = (match.ratings && match.ratings.team && match.ratings.team[team]) || null;

  return (
    <div className="rating-column">
      <h3 className={`rating-column-title ${team}`}>{teamLabel}</h3>

      <div className={`rating-card team-rating-card ${team}`}>
        <div className="rating-card-header">
          <span className="rating-card-title">Équipe — {teamLabel}</span>
        </div>
        <div className="rating-values-row">
          <div className="rating-value-block">
            <span className="rating-value-label">Suggestion</span>
            <span className="rating-value-suggestion">{suggestions.team[team]}/10</span>
          </div>
          <div className="rating-value-block">
            <span className="rating-value-label">Moyenne joueurs</span>
            <span className="rating-value-suggestion">{suggestions.teamPlayerAvg[team] != null ? `${suggestions.teamPlayerAvg[team]}/10` : "—"}</span>
          </div>
          <div className="rating-value-block">
            <span className="rating-value-label">Note du coach</span>
            <input
              type="number" min={0} max={10} step={0.5}
              placeholder="—"
              value={teamRating && teamRating.coachScore != null ? teamRating.coachScore : ""}
              onChange={(e) => setTeamRating(team, e.target.value === "" ? null : Number(e.target.value), teamRating ? teamRating.comment : "")}
            />
          </div>
        </div>
        <textarea
          className="rating-comment"
          placeholder="Commentaire sur la prestation collective..."
          value={teamRating ? teamRating.comment : ""}
          onChange={(e) => setTeamRating(team, teamRating ? teamRating.coachScore : null, e.target.value)}
        />
      </div>

      <div className="panel-heading">Notation individuelle — {teamLabel}</div>
      {players.length === 0 && (
        <div className="empty-state">Aucun joueur pour l'instant. Tague une action ou ajoute un numéro manuellement ci-dessous.</div>
      )}
      <div className="player-rating-list">
        {players.map((p) => {
          const key = `${p.team}_${p.player}`;
          const rating = (match.ratings && match.ratings.players && match.ratings.players[key]) || null;
          const hasActions = p.total > 0;
          const suggestion = suggestions.players[key];
          return (
            <div className="rating-card player-rating-card" key={key}>
              <div className="rating-card-header">
                <span className={`team-dot ${team}`} />
                <span className="rating-card-title">n°{p.player} <span className="rating-card-sub">({p.total} action{p.total !== 1 ? "s" : ""})</span></span>
              </div>
              <div className="rating-values-row">
                <div className="rating-value-block">
                  <span className="rating-value-label">Suggestion</span>
                  <span className="rating-value-suggestion">{hasActions ? `${suggestion}/10` : "—"}</span>
                </div>
                <div className="rating-value-block">
                  <span className="rating-value-label">Note du coach</span>
                  <input
                    type="number" min={0} max={10} step={0.5}
                    placeholder="—"
                    disabled={!hasActions}
                    value={rating && rating.coachScore != null ? rating.coachScore : ""}
                    onChange={(e) => setPlayerRating(key, e.target.value === "" ? null : Number(e.target.value), rating ? rating.comment : "")}
                  />
                </div>
              </div>
              <input
                className="rating-comment-inline"
                placeholder={hasActions ? "Commentaire (optionnel)" : "Ex. présent, n'a pas joué..."}
                value={rating ? rating.comment : ""}
                onChange={(e) => setPlayerRating(key, rating ? rating.coachScore : null, e.target.value)}
              />
            </div>
          );
        })}
      </div>
      <div className="add-player-row">
        <input
          type="text" inputMode="numeric" placeholder="N° joueur"
          value={newPlayerNum}
          onChange={(e) => setNewPlayerNum(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
          onKeyDown={(e) => e.key === "Enter" && addManualPlayer()}
        />
        <button className="btn btn-ghost btn-small" onClick={addManualPlayer}>+ Ajouter un joueur</button>
      </div>
    </div>
  );
}

function TaggingScreen(props) {
  const {
    match, videoUrl, videoRef, videoDuration, setVideoDuration, currentTime, setCurrentTime,
    isPlaying, setIsPlaying, playbackRate, setPlaybackRate, activeTeam, setActiveTeam,
    saveStatus, handleFile, togglePlay, seekTo, nudge,
    addTag, removeTag, setTagPlayer, exportMatch, goHome, lastTagFlash,
    videoError, setVideoError, videoLoading, setVideoLoading,
    pendingPlayerTag, assignPendingPlayer, dismissPendingPlayer, setPossession,
    runCompilation, compilationJob, compilations, goRating, setMatchClosed, roster, setPlayerAssignments,
  } = props;
  const [showComposition, setShowComposition] = useState(false);

  function resolveName(number, team) {
    if (team && team !== "us") return null;
    const rid = match.playerAssignments && match.playerAssignments[number];
    if (rid) {
      const p = roster.find((r) => r.id === rid);
      if (p) return p.name;
    }
    return null;
  }
  const fileInputRef = useRef(null);
  const [statsRange, setStatsRange] = useState([0, 0]);
  useEffect(() => {
    if (videoDuration > 0 && statsRange[1] === 0) {
      setStatsRange([0, videoDuration]);
    }
  }, [videoDuration]); // eslint-disable-line react-hooks/exhaustive-deps
  const rangeEnd = statsRange[1] || videoDuration || 0;

  const possessionTeam = match.possession && match.possession.length > 0 ? match.possession[match.possession.length - 1].team : null;
  const possDurations = { us: 0, opp: 0, neutral: 0 };
  (match.possession || []).forEach((p) => {
    const end = p.end != null ? p.end : currentTime;
    const clippedStart = Math.max(p.start, statsRange[0]);
    const clippedEnd = Math.min(end, rangeEnd);
    possDurations[p.team] += Math.max(0, clippedEnd - clippedStart);
  });
  const possTotal = possDurations.us + possDurations.opp + possDurations.neutral;
  const possPct = (v) => (possTotal > 0 ? Math.round((v / possTotal) * 100) : 0);

  const collectiveTimes = useMemo(() => {
    const map = {};
    match.tags.forEach((t) => {
      if (t.time < statsRange[0] || t.time > rangeEnd) return;
      const key = `${t.eventKey}::${t.team}`;
      (map[key] || (map[key] = [])).push(t.time);
    });
    return map;
  }, [match.tags, statsRange, rangeEnd]);

  const individualColumns = useMemo(() => {
    const seen = new Map();
    match.tags.forEach((t) => {
      if (!t.player) return;
      if (t.time < statsRange[0] || t.time > rangeEnd) return;
      const key = `${t.team}_${t.player}`;
      if (!seen.has(key)) seen.set(key, { team: t.team, player: t.player, total: 0 });
      seen.get(key).total++;
    });
    return Array.from(seen.values()).sort((a, b) => b.total - a.total);
  }, [match.tags, statsRange, rangeEnd]);
  const individualColumnsUs = individualColumns.filter((c) => c.team === "us");
  const individualColumnsOpp = individualColumns.filter((c) => c.team === "opp");

  const individualTimes = useMemo(() => {
    const map = {};
    match.tags.forEach((t) => {
      if (!t.player) return;
      if (t.time < statsRange[0] || t.time > rangeEnd) return;
      const key = `${t.eventKey}::${t.team}_${t.player}`;
      (map[key] || (map[key] = [])).push(t.time);
    });
    return map;
  }, [match.tags, statsRange, rangeEnd]);

  function downloadCollectiveTable() {
    const rows = [["Action", "Nous", "Adversaire"]];
    ALL_EVENTS.forEach((ev) => {
      rows.push([
        ev.label,
        (collectiveTimes[`${ev.key}::us`] || []).length,
        (collectiveTimes[`${ev.key}::opp`] || []).length,
      ]);
    });
    downloadCSV(`${match.name.replace(/\s+/g, "_")}_stats_collectives.csv`, rows);
  }

  function downloadIndividualTable(columns, teamKey, teamLabel) {
    const rows = [["Action", ...columns.map((c) => `n°${c.player}`)]];
    ALL_EVENTS.forEach((ev) => {
      rows.push([
        ev.label,
        ...columns.map((c) => (individualTimes[`${ev.key}::${teamKey}_${c.player}`] || []).length),
      ]);
    });
    downloadCSV(`${match.name.replace(/\s+/g, "_")}_stats_${teamLabel}.csv`, rows);
  }

  return (
    <div className="tagging">
      <div className="topbar">
        <button className="icon-btn" onClick={goHome} aria-label="Retour"><ArrowLeft size={16} /></button>
        <div className="topbar-title">
          <div className="topbar-name">{match.name}</div>
          <div className="topbar-meta">vs {match.opponent}</div>
        </div>
        <SaveIndicator status={saveStatus} />
        {match.closed ? (
          <button className="btn btn-ghost btn-small closed-badge" onClick={() => setMatchClosed(false)}>✓ Clôturé — rouvrir</button>
        ) : (
          <button className="btn btn-primary btn-small" onClick={() => setMatchClosed(true)}>Clôturer le match</button>
        )}
        <button className="btn btn-ghost btn-small" onClick={() => setShowComposition((v) => !v)}>Composition</button>
        <button className="btn btn-ghost btn-small" onClick={goRating}>Noter le match</button>
        <button className="btn btn-ghost btn-small" onClick={exportMatch}><Download size={13} /> Exporter</button>
      </div>

      {showComposition && (
        <div className="compile-progress-float composition-panel">
          <div className="range-filter-header" style={{ marginBottom: 8 }}>
            <div className="panel-heading" style={{ marginBottom: 0 }}>Composition pour ce match</div>
            <button className="icon-btn" onClick={() => setShowComposition(false)} aria-label="Fermer"><X size={16} /></button>
          </div>
          <PlayerAssignmentEditor
            roster={roster}
            assignments={match.playerAssignments || {}}
            setAssignments={setPlayerAssignments}
          />
        </div>
      )}

      {compilationJob && (
        <div className="compile-progress-float">
          <div className="compile-progress-label">{compilationJob.label} — {compilationJob.phase}</div>
          <div className="compile-progress-bar"><div style={{ width: `${compilationJob.pct}%` }} /></div>
        </div>
      )}

      <div className="top-row">
        <div className="video-section">
          {!videoUrl && (
            <div className="video-placeholder">
              <VideoIcon size={32} />
              <p>Charge la vidéo de ce match pour commencer à taguer.</p>
              <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                Choisir la vidéo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFile}
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", left: -9999 }}
              />
            </div>
          )}
          {videoUrl && (
            <div className="video-wrap">
              <video
                ref={videoRef}
                src={videoUrl}
                onLoadedMetadata={(e) => { setVideoDuration(e.target.duration); setVideoLoading(false); }}
                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setVideoLoading(true)}
                onCanPlay={() => setVideoLoading(false)}
                onError={(e) => {
                  setVideoLoading(false);
                  const el = e.target;
                  setVideoError((el.error && el.error.code) || "inconnu");
                }}
              />
              {videoLoading && !videoError && <div className="video-status">Chargement de la vidéo…</div>}
              {videoError && (
                <div className="video-status error">
                  Ce fichier ne semble pas lisible (code erreur {String(videoError)}). Essaie un autre fichier ou reconvertis-le en MP4/H.264.
                </div>
              )}
            </div>
          )}

          {videoUrl && (
            <div className="video-controls">
              <button className="icon-btn" onClick={() => nudge(-5)} aria-label="Reculer 5 secondes">-5s</button>
              <button className="btn btn-primary btn-play" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Lecture"}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button className="icon-btn" onClick={() => nudge(5)} aria-label="Avancer 5 secondes">+5s</button>
              <span className="time-code">{formatTime(currentTime)} / {formatTime(videoDuration)}</span>
              <select
                value={playbackRate}
                onChange={(e) => {
                  const r = parseFloat(e.target.value);
                  setPlaybackRate(r);
                  if (videoRef.current) videoRef.current.playbackRate = r;
                }}
              >
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
            </div>
          )}

          {videoUrl && videoDuration > 0 && (
            <TimelinePulse tags={match.tags} possession={match.possession} duration={videoDuration} currentTime={currentTime} onSeek={seekTo} />
          )}
        </div>

        <div className="selectors-col">
          {pendingPlayerTag && (
            <div className={`player-picker ${pendingPlayerTag.team}`}>
              <div className="player-picker-label">
                Quel joueur ? <span className="player-picker-team">{pendingPlayerTag.team === "us" ? "Nous" : "Adversaire"}</span>
              </div>
              <div className="player-picker-grid">
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
                  const name = pendingPlayerTag.team === "us" ? resolveName(String(n), "us") : null;
                  return (
                    <button key={n} className="player-picker-btn" onClick={() => assignPendingPlayer(n)}>
                      {n}
                      {name && <span className="player-picker-name">{name}</span>}
                    </button>
                  );
                })}
              </div>
              <button className="player-picker-skip" onClick={dismissPendingPlayer}>Passer</button>
            </div>
          )}

          <div className="selectors-header">
            <div className="team-toggle">
              <button className={`team-btn us ${activeTeam === "us" ? "active" : ""}`} onClick={() => setActiveTeam("us")}>NOUS</button>
              <button className={`team-btn opp ${activeTeam === "opp" ? "active" : ""}`} onClick={() => setActiveTeam("opp")}>ADVERSAIRE</button>
            </div>

            <div className="possession-block">
              <div className="event-category-label">Possession</div>
              <div className="possession-toggle">
                <button className={`poss-btn us ${possessionTeam === "us" ? "active" : ""} ${!videoUrl ? "disabled" : ""}`} onClick={() => videoUrl && setPossession("us")} disabled={!videoUrl}>Nous</button>
                <button className={`poss-btn neutral ${possessionTeam === "neutral" ? "active" : ""} ${!videoUrl ? "disabled" : ""}`} onClick={() => videoUrl && setPossession("neutral")} disabled={!videoUrl}>Neutre</button>
                <button className={`poss-btn opp ${possessionTeam === "opp" ? "active" : ""} ${!videoUrl ? "disabled" : ""}`} onClick={() => videoUrl && setPossession("opp")} disabled={!videoUrl}>Adv.</button>
              </div>
              {possTotal > 0 && (
                <div className="possession-readout">
                  <span className="us">{formatTime(possDurations.us)} · {possPct(possDurations.us)}%</span>
                  <span className="neutral">{formatTime(possDurations.neutral)} · {possPct(possDurations.neutral)}%</span>
                  <span className="opp">{formatTime(possDurations.opp)} · {possPct(possDurations.opp)}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="event-categories-stack">
            {EVENT_CATEGORIES.map((cat) => (
              <div className="event-category" key={cat.id}>
                <div className="event-category-label">{cat.label}</div>
                <div className="event-grid">
                  {cat.events.map((ev) => (
                    <button
                      key={ev.key}
                      className={`event-btn ${ev.positive ? "pos" : "neg"} ${!videoUrl ? "disabled" : ""}`}
                      onClick={() => videoUrl && addTag(ev.key)}
                      disabled={!videoUrl}
                    >
                      <span className="event-hotkey">{ev.hotkey}</span>
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="hint">Tab : équipe · Espace : lecture/pause</div>
        </div>
      </div>

      <div className="below-row">
        <div className="panel-section journal-section">
          <div className="panel-heading">Journal ({match.tags.length})</div>
          <div className="journal">
            {match.tags.length === 0 && <div className="empty-state">Aucune action taguée pour l'instant.</div>}
            {match.tags.slice().reverse().map((t) => {
              const ev = EVENT_MAP[t.eventKey];
              return (
                <div key={t.id} className={`journal-row ${lastTagFlash === t.id ? "flash" : ""}`}>
                  <button className="journal-time" onClick={() => seekTo(t.time)}>{formatTime(t.time)}</button>
                  <span className={`team-dot ${t.team}`} />
                  <span className={`journal-label ${ev.positive ? "pos" : "neg"}`}>{ev.label}</span>
                  <input
                    className="player-input"
                    placeholder="n°"
                    value={t.player}
                    onChange={(e) => setTagPlayer(t.id, e.target.value)}
                  />
                  {resolveName(t.player, t.team) && <span className="journal-player-name">{resolveName(t.player, t.team)}</span>}
                  <button className="icon-btn" onClick={() => removeTag(t.id)} aria-label="Supprimer cette action">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {videoDuration > 0 && (
          <div className="panel-section">
            <div className="range-filter-header">
              <div className="panel-heading" style={{ marginBottom: 0 }}>Période analysée (possession + tableaux)</div>
              <div className="range-filter-actions">
                <button className="range-preset-btn" onClick={() => setStatsRange([0, videoDuration / 2])}>1ère mi-temps</button>
                <button className="range-preset-btn" onClick={() => setStatsRange([videoDuration / 2, videoDuration])}>2nde mi-temps</button>
                <button className="range-preset-btn" onClick={() => setStatsRange([0, videoDuration])}>Tout le match</button>
              </div>
            </div>
            <div className="range-filter-values">{formatTime(statsRange[0])} – {formatTime(rangeEnd)}</div>
            <div className="dual-range">
              <div
                className="dual-range-fill"
                style={{ left: `${(statsRange[0] / videoDuration) * 100}%`, right: `${100 - (rangeEnd / videoDuration) * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={Math.floor(videoDuration)}
                value={Math.floor(statsRange[0])}
                onChange={(e) => setStatsRange([Math.min(Number(e.target.value), rangeEnd), rangeEnd])}
              />
              <input
                type="range"
                min={0}
                max={Math.floor(videoDuration)}
                value={Math.floor(rangeEnd)}
                onChange={(e) => setStatsRange([statsRange[0], Math.max(Number(e.target.value), statsRange[0])])}
              />
            </div>
          </div>
        )}

        {possTotal > 0 && (
          <div className="panel-section">
            <div className="panel-heading">Possession</div>
            <div className="possession-summary">
              <div className="possession-bar">
                {possPct(possDurations.us) > 0 && <div className="possession-seg us" style={{ width: `${possPct(possDurations.us)}%` }} />}
                {possPct(possDurations.neutral) > 0 && <div className="possession-seg neutral" style={{ width: `${possPct(possDurations.neutral)}%` }} />}
                {possPct(possDurations.opp) > 0 && <div className="possession-seg opp" style={{ width: `${possPct(possDurations.opp)}%` }} />}
              </div>
              <div className="possession-legend">
                <span><i className="dot us" />Nous {possPct(possDurations.us)}%</span>
                <span><i className="dot neutral" />Neutre {possPct(possDurations.neutral)}%</span>
                <span><i className="dot opp" />Adversaire {possPct(possDurations.opp)}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="panel-section">
          <div className="range-filter-header">
            <div className="panel-heading" style={{ marginBottom: 0 }}>Statistiques collectives — Nous vs Adversaire</div>
            <button className="btn btn-ghost btn-small" onClick={downloadCollectiveTable}><Download size={12} /> CSV</button>
          </div>
          <div className="table-scroll">
            <table className="stat-table">
              <thead>
                <tr><th>Action</th><th className="col-us">Nous</th><th className="col-opp">Adversaire</th></tr>
              </thead>
              <tbody>
                {ALL_EVENTS.map((ev) => (
                  <tr key={ev.key}>
                    <td>{ev.label}</td>
                    <td>
                      <CompileCell
                        times={collectiveTimes[`${ev.key}::us`] || []}
                        cellKey={`${ev.key}::us`}
                        label={`${ev.label} — Nous`}
                        compilationJob={compilationJob}
                        compilations={compilations}
                        onRun={runCompilation}
                      />
                    </td>
                    <td>
                      <CompileCell
                        times={collectiveTimes[`${ev.key}::opp`] || []}
                        cellKey={`${ev.key}::opp`}
                        label={`${ev.label} — Adversaire`}
                        compilationJob={compilationJob}
                        compilations={compilations}
                        onRun={runCompilation}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {individualColumnsUs.length > 0 && (
          <div className="panel-section">
            <div className="range-filter-header">
              <div className="panel-heading" style={{ marginBottom: 0 }}>Statistiques individuelles — Nous</div>
              <button className="btn btn-ghost btn-small" onClick={() => downloadIndividualTable(individualColumnsUs, "us", "individuelles_nous")}><Download size={12} /> CSV</button>
            </div>
            <div className="table-scroll">
              <table className="stat-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    {individualColumnsUs.map((col) => (
                      <th key={col.player} className="col-us">{resolveName(col.player, "us") || `n°${col.player}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_EVENTS.map((ev) => (
                    <tr key={ev.key}>
                      <td>{ev.label}</td>
                      {individualColumnsUs.map((col) => {
                        const key = `${ev.key}::us_${col.player}`;
                        return (
                          <td key={key}>
                            <CompileCell
                              times={individualTimes[key] || []}
                              cellKey={key}
                              label={`${ev.label} — n°${col.player} (Nous)`}
                              compilationJob={compilationJob}
                              compilations={compilations}
                              onRun={runCompilation}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {individualColumnsOpp.length > 0 && (
          <div className="panel-section">
            <div className="range-filter-header">
              <div className="panel-heading" style={{ marginBottom: 0 }}>Statistiques individuelles — Adversaire</div>
              <button className="btn btn-ghost btn-small" onClick={() => downloadIndividualTable(individualColumnsOpp, "opp", "individuelles_adversaire")}><Download size={12} /> CSV</button>
            </div>
            <div className="table-scroll">
              <table className="stat-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    {individualColumnsOpp.map((col) => (
                      <th key={col.player} className="col-opp">n°{col.player}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_EVENTS.map((ev) => (
                    <tr key={ev.key}>
                      <td>{ev.label}</td>
                      {individualColumnsOpp.map((col) => {
                        const key = `${ev.key}::opp_${col.player}`;
                        return (
                          <td key={key}>
                            <CompileCell
                              times={individualTimes[key] || []}
                              cellKey={key}
                              label={`${ev.label} — n°${col.player} (Adversaire)`}
                              compilationJob={compilationJob}
                              compilations={compilations}
                              onRun={runCompilation}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompileCell({ times, cellKey, label, compilationJob, compilations, onRun }) {
  if (!times || times.length === 0) return <span className="stat-cell-empty">—</span>;
  const existing = compilations.find((c) => c.key === cellKey);
  const isRunning = compilationJob && compilationJob.key === cellKey;
  return (
    <span className="stat-cell">
      <span className="stat-cell-count">{times.length}</span>
      {existing && (
        <a className="compile-icon ready" href={existing.url} download={`${label.replace(/\s+/g, "_")}.mp4`} title="Télécharger la compilation" onClick={(e) => e.stopPropagation()}>
          <Download size={11} />
        </a>
      )}
      {!existing && !isRunning && (
        <button className="compile-icon" disabled={!!compilationJob} onClick={() => onRun(cellKey, label, times)} title="Générer la compilation vidéo">
          <Film size={11} />
        </button>
      )}
      {isRunning && <span className="compile-icon spinning" title={compilationJob.phase}>⋯</span>}
    </span>
  );
}

function SaveIndicator({ status }) {
  const label = status === "error" ? "Erreur de sauvegarde" : "Enregistré";
  return <span className={`save-indicator ${status}`}>{label}</span>;
}

function RatioCard({ label, us, opp }) {
  return (
    <div className="ratio-card">
      <div className="ratio-label">{label}</div>
      <div className="ratio-values">
        <span className="ratio-us">{us === null ? "—" : `${us}%`}</span>
        <span className="ratio-sep">vs</span>
        <span className="ratio-opp">{opp === null ? "—" : `${opp}%`}</span>
      </div>
    </div>
  );
}

function TimelinePulse({ tags, possession, duration, currentTime, onSeek }) {
  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(pct * duration);
  }
  return (
    <div className="pulse-track" onClick={handleClick}>
      {(possession || []).map((p, i) => {
        const end = p.end != null ? p.end : currentTime;
        const left = (p.start / duration) * 100;
        const width = Math.max(0, ((end - p.start) / duration) * 100);
        return <div key={i} className={`pulse-band ${p.team}`} style={{ left: `${left}%`, width: `${width}%` }} />;
      })}
      <div className="pulse-progress" style={{ width: `${(currentTime / duration) * 100}%` }} />
      {tags.map((t) => {
        const ev = EVENT_MAP[t.eventKey];
        return (
          <div
            key={t.id}
            className={`pulse-tick ${t.team} ${ev.positive ? "pos" : "neg"}`}
            style={{ left: `${(t.time / duration) * 100}%` }}
            title={`${formatTime(t.time)} · ${ev.label}`}
          />
        );
      })}
      <div className="pulse-playhead" style={{ left: `${(currentTime / duration) * 100}%` }} />
    </div>
  );
}

const CSS = `
  :root {
    --bg: #0D1512;
    --surface: #182A21;
    --line: #26362C;
    --ink: #EEF3EC;
    --ink-muted: #8FA599;
    --gold: #E3B23C;
    --gold-ink: #2A2007;
    --crimson: #D6483F;
  }
  html, body { background: var(--bg); }
  .app-root { background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; }
  .app-root * { box-sizing: border-box; }
  .app-root button { font-family: inherit; cursor: pointer; }
  .app-root input, .app-root select { font-family: inherit; }
  .app-root button:focus-visible, .app-root input:focus-visible, .app-root select:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .app-root * { transition: none !important; animation: none !important; } }

  .menu-toggle-btn { position: fixed; top: 14px; left: 14px; z-index: 50; background: var(--surface); border: 1px solid var(--line); color: var(--ink); width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .menu-toggle-btn:hover { border-color: var(--gold); }
  .sidebar-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 40; }
  .sidebar-drawer { position: fixed; top: 0; left: 0; bottom: 0; width: 230px; background: #131C17; border-right: 1px solid var(--line); z-index: 45; display: flex; flex-direction: column; padding: 14px 0; overflow-y: auto; }
  .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 0 14px 14px; margin-bottom: 6px; border-bottom: 1px solid var(--line); }
  .sidebar-brand { font-size: 11px; font-weight: 700; color: var(--gold); text-transform: uppercase; letter-spacing: 0.05em; }
  .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: var(--ink-muted); font-size: 13px; background: transparent; border: none; width: 100%; text-align: left; }
  .sidebar-item:hover { background: var(--surface); color: var(--ink); }
  .sidebar-item.active { background: var(--gold); color: var(--gold-ink); font-weight: 700; }
  .stats-screen { padding: 24px 24px 48px; max-width: 1000px; margin: 0 auto; }
  .stats-screen-header { margin-bottom: 20px; }
  .player-select { width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 8px 10px; font-size: 12px; margin-bottom: 8px; }
  .bar-cell-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px 0; }
  .bar-cell-track { height: 42px; width: 22px; display: flex; align-items: flex-end; background: rgba(255,255,255,0.03); border-radius: 3px; overflow: hidden; }
  .bar-cell-fill { width: 100%; border-radius: 2px 2px 0 0; min-height: 2px; opacity: 0.85; }
  .bar-cell-num { font-size: 10px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .multi-select-list { display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px; margin-bottom: 12px; }
  .multi-select-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 12px; color: var(--ink); border-radius: 5px; }
  .multi-select-item:hover { background: var(--bg); }
  .comparison-summary-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .comparison-summary-card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  .comparison-summary-card h4 { margin: 0 0 6px; font-size: 12px; font-weight: 700; }
  .comparison-summary-card div { font-size: 11px; color: var(--ink-muted); margin-bottom: 2px; }
  .highlights-row { margin-bottom: 20px; }
  .form-calendar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
  .form-calendar-cell { width: 34px; height: 34px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #17231B; cursor: default; }
  .dominant-axis-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 20px; }
  .dominant-axis-chip { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 5px 12px; font-size: 11px; color: var(--ink-muted); }
  .player-avg-summary { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; color: var(--ink-muted); margin-bottom: 10px; }
  .player-avg-summary strong { color: var(--ink); }
  .signals-box { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
  .signals-box-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-muted); font-weight: 700; margin-bottom: 2px; }
  .signal-item { font-size: 12px; padding: 6px 10px; border-radius: 6px; background: var(--bg); border-left: 3px solid var(--ink-muted); }
  .signal-item.positive { border-left-color: var(--gold); color: var(--ink); }
  .signal-item.negative { border-left-color: var(--crimson); color: var(--ink); }
  .signal-scope { font-weight: 700; }
  .signal-date { display: block; font-size: 10px; color: var(--ink-muted); margin-top: 2px; font-style: italic; }
  .signals-box-full { margin-bottom: 0; }
  .range-preset-btn.active-preset { background: var(--gold); color: var(--gold-ink); border-color: var(--gold); }
  .radar-note { font-size: 11px; color: var(--ink-muted); line-height: 1.5; margin-top: 8px; max-width: 560px; }
  .radar-range-control { margin-bottom: 10px; }
  .radar-range-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-muted); font-weight: 700; margin-bottom: 5px; }
  .radar-match-list { max-height: 160px; margin-top: 6px; margin-bottom: 0; }
  .radar-compare-toggle { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink); margin: 4px 0 10px; cursor: pointer; }
  .placeholder-screen { max-width: 560px; margin: 80px auto; padding: 0 24px; text-align: center; }
  .placeholder-screen h1 { font-size: 26px; font-weight: 800; margin: 0 0 10px; }
  .placeholder-badge { display: inline-block; margin-top: 16px; background: var(--surface); border: 1px solid var(--line); color: var(--ink-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; padding: 6px 14px; border-radius: 20px; }
  .closed-badge { border-color: var(--gold); color: var(--gold); }
  .closed-badge-inline { font-size: 10px; font-weight: 700; color: var(--gold); background: rgba(227,178,60,0.14); padding: 2px 7px; border-radius: 10px; margin-left: 6px; vertical-align: middle; }

  .home { padding: 32px 28px 40px; max-width: 720px; margin: 0 auto; }
  .home-header { margin-bottom: 24px; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: var(--gold); font-weight: 700; margin-bottom: 6px; }
  .home-header h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 8px; }
  .subtitle { color: var(--ink-muted); font-size: 14px; margin: 0; max-width: 46ch; }

  .btn { border: none; border-radius: 6px; padding: 10px 16px; font-size: 14px; font-weight: 600; transition: transform 0.1s ease, opacity 0.15s ease; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .btn:active { transform: scale(0.98); }
  .btn-primary { background: var(--gold); color: var(--gold-ink); }
  .btn-primary:hover { opacity: 0.9; }
  .btn-ghost { background: transparent; color: var(--ink-muted); border: 1px solid var(--line); }
  .btn-ghost:hover { color: var(--ink); border-color: var(--ink-muted); }
  .btn-large { padding: 14px 22px; font-size: 15px; }
  .home-actions-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }
  .btn-small { padding: 6px 12px; font-size: 12px; }

  .new-match-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 20px; margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
  .new-match-card label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--ink-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .new-match-card input { background: var(--bg); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 9px 10px; font-size: 14px; font-weight: 400; text-transform: none; letter-spacing: normal; }
  .new-match-card select { background: var(--bg); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 9px 10px; font-size: 14px; font-weight: 400; text-transform: none; letter-spacing: normal; }
  .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

  .roster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .roster-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; display: flex; gap: 14px; align-items: flex-start; }
  .roster-card-number { width: 40px; height: 40px; border-radius: 8px; background: var(--bg); border: 1px solid var(--gold); color: var(--gold); font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .roster-card-info { flex: 1; min-width: 0; }
  .roster-card-name { font-weight: 700; font-size: 14px; }
  .roster-card-position { font-size: 11px; color: var(--gold); font-weight: 600; margin-top: 2px; }
  .roster-card-meta { font-size: 11px; color: var(--ink-muted); margin-top: 3px; }
  .roster-card-usage { font-size: 10px; color: var(--ink-muted); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line); }
  .roster-card-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
  .assignment-editor { margin-top: 4px; }
  .assignment-empty-note { font-size: 12px; color: var(--ink-muted); margin-top: 4px; }
  .assignment-list { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; margin-top: 6px; }
  .assignment-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; }
  .assignment-name { font-size: 13px; color: var(--ink); }
  .assignment-position { font-size: 11px; color: var(--ink-muted); font-weight: 400; }
  .assignment-number-input { width: 48px; background: var(--surface); border: 1px solid var(--line); color: var(--gold); font-weight: 800; text-align: center; border-radius: 6px; padding: 6px; font-size: 13px; }

  .match-list { margin-top: 24px; display: flex; flex-direction: column; gap: 10px; }
  .empty-state { color: var(--ink-muted); font-size: 13px; padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: 8px; }
  .match-card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: border-color 0.15s ease; }
  .match-card:hover { border-color: var(--gold); }
  .match-card-name { font-weight: 700; font-size: 14px; }
  .match-card-meta { color: var(--ink-muted); font-size: 12px; margin-top: 2px; }
  .match-card-side { display: flex; align-items: center; gap: 12px; }
  .tag-count { font-size: 11px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }

  .icon-btn { background: transparent; border: 1px solid var(--line); color: var(--ink-muted); border-radius: 6px; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  .icon-btn:hover { color: var(--ink); border-color: var(--ink-muted); }

  .tagging { display: flex; flex-direction: column; min-height: 100vh; }
  .topbar { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
  .topbar-title { flex: 1; }
  .topbar-name { font-weight: 700; font-size: 14px; }
  .topbar-meta { font-size: 11px; color: var(--ink-muted); }
  .save-indicator { font-size: 11px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .save-indicator.error { color: var(--crimson); }

  .tagging-grid { display: none; }
  .top-row {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 18px;
    padding: 18px 18px 0;
  }
  @media (max-width: 1000px) {
    .top-row { grid-template-columns: 1fr; }
  }
  .below-row {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px 18px 32px;
  }
  .video-section { min-width: 0; }
  .selectors-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .selectors-header { display: flex; flex-direction: column; gap: 10px; }
  .event-categories-stack { display: flex; flex-direction: column; gap: 8px; }
  .compile-progress-float { margin: 10px 18px 0; background: var(--surface); border: 1px solid var(--gold); border-radius: 8px; padding: 8px 12px; }
  .panel-heading { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); font-weight: 700; margin-bottom: 8px; }
  .journal-section { max-width: 640px; }

  .video-placeholder { position: relative; background: var(--surface); border: 1px dashed var(--line); border-radius: 10px; padding: 48px 20px; text-align: center; color: var(--ink-muted); display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .video-wrap { position: relative; background: black; border-radius: 10px; overflow: hidden; }
  .video-wrap video { width: 100%; display: block; max-height: 46vh; }
  .video-status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; color: var(--ink-muted); font-size: 13px; line-height: 1.5; background: rgba(13,21,18,0.88); }
  .video-status.error { color: var(--crimson); }

  .video-controls { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .btn-play { width: 40px; height: 40px; border-radius: 50%; padding: 0; }
  .time-code { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--ink-muted); margin-left: auto; }
  .video-controls select { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; font-size: 12px; }

  .pulse-track { position: relative; height: 34px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; margin-top: 12px; cursor: pointer; overflow: hidden; }
  .pulse-band { position: absolute; top: 0; bottom: 0; opacity: 0.28; }
  .pulse-band.us { background: var(--gold); }
  .pulse-band.opp { background: var(--crimson); }
  .pulse-band.neutral { background: var(--ink-muted); }
  .pulse-progress { position: absolute; top: 0; left: 0; bottom: 0; background: rgba(227,178,60,0.12); border-right: 1px solid var(--gold); }
  .pulse-tick { position: absolute; top: 6px; width: 3px; height: 22px; border-radius: 2px; transform: translateX(-50%); }
  .pulse-tick.us.pos { background: var(--gold); }
  .pulse-tick.us.neg { background: var(--gold); opacity: 0.4; }
  .pulse-tick.opp.pos { background: var(--crimson); }
  .pulse-tick.opp.neg { background: var(--crimson); opacity: 0.4; }
  .pulse-playhead { position: absolute; top: -2px; width: 2px; height: 38px; background: var(--ink); transform: translateX(-50%); pointer-events: none; }

  .tabs { display: flex; gap: 4px; margin-top: 18px; border-bottom: 1px solid var(--line); }
  .tab { background: transparent; border: none; color: var(--ink-muted); padding: 8px 4px; margin-right: 18px; font-size: 13px; font-weight: 600; border-bottom: 2px solid transparent; }
  .tab.active { color: var(--ink); border-bottom-color: var(--gold); }

  .journal { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
  .journal-row { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; }
  .journal-row.flash { border-color: var(--gold); }
  .journal-time { background: transparent; border: none; color: var(--ink); font-variant-numeric: tabular-nums; font-size: 12px; font-weight: 700; width: 44px; text-align: left; }
  .team-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .team-dot.us { background: var(--gold); }
  .team-dot.opp { background: var(--crimson); }
  .journal-label { flex: 1; font-size: 13px; }
  .journal-label.neg { color: var(--ink-muted); }
  .player-input { width: 44px; background: var(--bg); border: 1px solid var(--line); color: var(--ink); border-radius: 4px; padding: 4px 6px; font-size: 12px; text-align: center; }
  .journal-player-name { font-size: 11px; color: var(--gold); max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .player-picker-btn { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .player-picker-name { font-size: 8px; font-weight: 400; color: var(--ink-muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .composition-panel { max-height: 70vh; overflow-y: auto; max-width: 420px; }

  .stats-panel { margin-top: 14px; }
  .possession-summary { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
  .possession-bar { display: flex; height: 14px; border-radius: 4px; overflow: hidden; margin: 8px 0 10px; background: var(--bg); }
  .possession-seg.us { background: var(--gold); }
  .possession-seg.opp { background: var(--crimson); }
  .possession-seg.neutral { background: var(--ink-muted); }
  .possession-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: var(--ink-muted); }
  .possession-legend .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; }
  .possession-legend .dot.us { background: var(--gold); }
  .possession-legend .dot.opp { background: var(--crimson); }
  .possession-legend .dot.neutral { background: var(--ink-muted); }
  .player-stats { margin-top: 18px; }
  .player-stat-row { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; font-size: 12px; }
  .player-stat-num { font-weight: 800; color: var(--gold); width: 40px; }
  .player-stat-count { flex: 1; color: var(--ink); }
  .player-stat-pos { color: var(--ink-muted); }
  .ratio-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
  .ratio-card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
  .ratio-label { font-size: 11px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .ratio-values { display: flex; align-items: baseline; gap: 8px; font-variant-numeric: tabular-nums; }
  .ratio-us { color: var(--gold); font-size: 20px; font-weight: 800; }
  .ratio-opp { color: var(--crimson); font-size: 20px; font-weight: 800; }
  .ratio-sep { color: var(--ink-muted); font-size: 11px; }
  .chart-wrap { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 6px; }

  .side-col { display: flex; flex-direction: column; gap: 14px; }
  .team-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .team-btn { padding: 12px 8px; border-radius: 8px; font-weight: 800; font-size: 13px; letter-spacing: 0.03em; border: 1px solid var(--line); background: var(--surface); color: var(--ink-muted); }
  .team-btn.us.active { background: var(--gold); color: var(--gold-ink); border-color: var(--gold); }
  .team-btn.opp.active { background: var(--crimson); color: #2A0F0D; border-color: var(--crimson); }
  .hint { font-size: 11px; color: var(--ink-muted); text-align: center; }

  .player-picker { background: var(--surface); border: 1px solid var(--gold); border-radius: 8px; padding: 10px; animation: pop-in 0.15s ease; }
  .player-picker.opp { border-color: var(--crimson); }
  .player-picker-label { font-size: 12px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
  .player-picker-team { color: var(--gold); }
  .player-picker.opp .player-picker-team { color: var(--crimson); }
  .player-picker-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
  .player-picker-btn { background: var(--bg); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 8px 0; font-size: 12px; font-weight: 700; }
  .player-picker-btn:hover { border-color: var(--gold); }
  .player-picker.opp .player-picker-btn:hover { border-color: var(--crimson); }
  .player-picker-skip { display: block; width: 100%; text-align: center; background: transparent; border: none; color: var(--ink-muted); font-size: 11px; margin-top: 8px; padding: 4px; }
  .player-picker-skip:hover { color: var(--ink); }
  @keyframes pop-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

  .possession-block { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
  .possession-block .event-category-label { margin: 0 0 8px; }
  .possession-toggle { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
  .poss-btn { padding: 8px 4px; border-radius: 6px; font-weight: 700; font-size: 11px; letter-spacing: 0.02em; border: 1px solid var(--line); background: var(--bg); color: var(--ink-muted); }
  .poss-btn.us.active { background: var(--gold); color: var(--gold-ink); border-color: var(--gold); }
  .poss-btn.opp.active { background: var(--crimson); color: #2A0F0D; border-color: var(--crimson); }
  .poss-btn.neutral.active { background: var(--ink-muted); color: var(--bg); border-color: var(--ink-muted); }
  .poss-btn.disabled { opacity: 0.4; cursor: not-allowed; }
  .possession-readout { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; font-size: 11px; font-variant-numeric: tabular-nums; }
  .possession-readout .us { color: var(--gold); }
  .possession-readout .opp { color: var(--crimson); }
  .possession-readout .neutral { color: var(--ink-muted); }

  .event-category-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); font-weight: 700; margin: 6px 0 5px; }
  .event-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .event-btn { position: relative; text-align: left; background: var(--surface); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 6px 6px 6px 20px; font-size: 10px; line-height: 1.25; font-weight: 500; transition: border-color 0.12s ease; }
  .event-btn.pos:hover { border-color: var(--gold); }
  .event-btn.neg:hover { border-color: var(--crimson); }
  .event-btn.disabled { opacity: 0.4; cursor: not-allowed; }
  .event-hotkey { position: absolute; left: 5px; top: 50%; transform: translateY(-50%); font-size: 9px; color: var(--ink-muted); font-weight: 800; }

  .compile-progress { background: var(--surface); border: 1px solid var(--gold); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
  .compile-progress-label { font-size: 11px; color: var(--ink); margin-bottom: 6px; }
  .compile-progress-bar { height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; }
  .compile-progress-bar > div { height: 100%; background: var(--gold); transition: width 0.2s ease; }

  .table-scroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }

  .range-filter-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  .range-filter-actions { display: flex; gap: 6px; }
  .range-preset-btn { background: var(--surface); border: 1px solid var(--line); color: var(--ink-muted); border-radius: 6px; padding: 4px 10px; font-size: 10px; font-weight: 600; }
  .range-preset-btn:hover { border-color: var(--gold); color: var(--ink); }
  .range-filter-values { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--gold); font-weight: 700; margin-bottom: 8px; }
  .dual-range { position: relative; height: 24px; }
  .dual-range-fill { position: absolute; top: 10px; height: 4px; background: var(--gold); border-radius: 2px; }
  .dual-range input[type="range"] { position: absolute; top: 0; left: 0; width: 100%; margin: 0; background: transparent; -webkit-appearance: none; pointer-events: none; }
  .dual-range input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: var(--line); border-radius: 2px; }
  .dual-range input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; pointer-events: auto; width: 16px; height: 16px; border-radius: 50%; background: var(--gold); border: 2px solid var(--bg); cursor: pointer; margin-top: -6px; }
  .dual-range input[type="range"]::-moz-range-track { height: 4px; background: var(--line); border-radius: 2px; }
  .dual-range input[type="range"]::-moz-range-thumb { pointer-events: auto; width: 14px; height: 14px; border-radius: 50%; background: var(--gold); border: 2px solid var(--bg); cursor: pointer; }
  .stat-table { border-collapse: collapse; width: 100%; font-size: 12px; white-space: nowrap; }
  .stat-table th, .stat-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--line); }
  .stat-table thead th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-muted); font-weight: 700; position: sticky; top: 0; background: var(--surface); }
  .stat-table th.col-us { color: var(--gold); }
  .stat-table th.col-opp { color: var(--crimson); }
  .stat-table tbody tr:last-child td { border-bottom: none; }
  .stat-table tbody tr:hover { background: rgba(227,178,60,0.05); }
  .stat-cell { display: inline-flex; align-items: center; gap: 6px; }
  .stat-cell-count { font-variant-numeric: tabular-nums; font-weight: 700; }
  .stat-cell-empty { color: var(--ink-muted); }
  .compile-icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; background: transparent; border: 1px solid var(--line); color: var(--ink-muted); }
  .compile-icon:hover { border-color: var(--gold); color: var(--ink); }
  .compile-icon.ready { border-color: var(--gold); color: var(--gold); }
  .compile-icon:disabled { opacity: 0.35; cursor: not-allowed; }
  .compile-icon.spinning { font-size: 13px; border-style: dashed; }

  .rating-content { max-width: 1100px; margin: 0 auto; padding: 24px 18px 40px; }
  .rating-explainer { font-size: 12px; color: var(--ink-muted); line-height: 1.6; margin: 0 0 20px; max-width: 720px; }
  .rating-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
  @media (max-width: 900px) { .rating-columns { grid-template-columns: 1fr; } }
  .rating-column-title { font-size: 15px; font-weight: 800; margin: 0 0 12px; }
  .rating-column-title.us { color: var(--gold); }
  .rating-column-title.opp { color: var(--crimson); }
  .rating-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .team-rating-card.us { border-color: var(--gold); }
  .team-rating-card.opp { border-color: var(--crimson); }
  .rating-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .rating-card-title { font-weight: 700; font-size: 13px; flex: 1; }
  .rating-card-sub { font-weight: 400; color: var(--ink-muted); font-size: 11px; }
  .rating-values-row { display: flex; gap: 16px; margin-bottom: 10px; }
  .rating-value-block { display: flex; flex-direction: column; gap: 4px; }
  .rating-value-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-muted); font-weight: 700; }
  .rating-value-suggestion { font-size: 16px; font-weight: 800; color: var(--ink-muted); }
  .rating-values-row input[type="number"] { width: 60px; background: var(--bg); border: 1px solid var(--line); color: var(--gold); font-weight: 800; font-size: 16px; text-align: center; border-radius: 6px; padding: 5px; }
  .rating-values-row input[type="number"]:disabled { opacity: 0.3; cursor: not-allowed; }
  .rating-comment { width: 100%; min-height: 56px; background: var(--bg); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 8px 10px; font-size: 12px; font-family: inherit; resize: vertical; }
  .rating-comment-inline { width: 100%; background: var(--bg); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 6px 10px; font-size: 12px; font-family: inherit; }
  .player-rating-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
  .add-player-row { display: flex; gap: 8px; }
  .add-player-row input { width: 90px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 6px 10px; font-size: 12px; }
`;
