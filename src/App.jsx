import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Play, Pause, ArrowLeft, X, Download, Video as VideoIcon, Film } from "lucide-react";
import { generateCompilation } from "./videoCompiler";

const EVENT_CATEGORIES = [
  {
    id: "offensif",
    label: "Offensif",
    events: [
      { key: "controle_ok", label: "Contrôle réussi", hotkey: "H", positive: true },
      { key: "controle_ko", label: "Contrôle manqué", hotkey: "L", positive: false },
      { key: "passe_ok", label: "Passe réussie", hotkey: "A", positive: true },
      { key: "passe_ko", label: "Passe manquée", hotkey: "Z", positive: false },
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
      { key: "duel_ok", label: "Duel aérien gagné", hotkey: "U", positive: true },
      { key: "duel_ko", label: "Duel aérien perdu", hotkey: "J", positive: false },
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

export default function App() {
  const [screen, setScreen] = useState("home");
  const [matches, setMatches] = useState([]);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeTeam, setActiveTeam] = useState("us");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMatchForm, setNewMatchForm] = useState({ name: "", opponent: "", date: todayIso() });
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

  function persistIndexUpdate(match) {
    setMatches((prev) => {
      const summary = { id: match.id, name: match.name, opponent: match.opponent, date: match.date, tagCount: match.tags.length };
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

  function createMatch() {
    const name = newMatchForm.name.trim() || `Match du ${formatDateFr(newMatchForm.date || todayIso())}`;
    const match = {
      id: newId(),
      name,
      opponent: newMatchForm.opponent.trim() || "Adversaire",
      date: newMatchForm.date || todayIso(),
      tags: [],
      possession: [],
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
    setNewMatchForm({ name: "", opponent: "", date: todayIso() });
    setSaveStatus("saved");
    setCompilations([]);
  }

  function openMatch(summary) {
    try {
      const raw = localStorage.getItem(matchStorageKey(summary.id));
      const parsed = raw ? JSON.parse(raw) : { ...summary, tags: [] };
      const match = { ...parsed, tags: parsed.tags || [], possession: parsed.possession || [] };
      setCurrentMatch(match);
      setVideoUrl(null);
      setVideoDuration(0);
      setCurrentTime(0);
      setScreen("tagging");
      setSaveStatus("saved");
      setCompilations([]);
    } catch (e) {
      alert("Impossible de charger ce match (données corrompues).");
    }
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

  const stats = useMemo(() => {
    if (!currentMatch) return null;
    const byTeam = { us: {}, opp: {} };
    ALL_EVENTS.forEach((ev) => { byTeam.us[ev.key] = 0; byTeam.opp[ev.key] = 0; });
    currentMatch.tags.forEach((t) => {
      if (byTeam[t.team] && byTeam[t.team][t.eventKey] !== undefined) byTeam[t.team][t.eventKey]++;
    });
    const pct = (made, missed) => {
      const total = made + missed;
      return total === 0 ? null : Math.round((made / total) * 100);
    };
    return {
      byTeam,
      controlePct: { us: pct(byTeam.us.controle_ok, byTeam.us.controle_ko), opp: pct(byTeam.opp.controle_ok, byTeam.opp.controle_ko) },
      passPct: { us: pct(byTeam.us.passe_ok, byTeam.us.passe_ko), opp: pct(byTeam.opp.passe_ok, byTeam.opp.passe_ko) },
      shotPct: { us: pct(byTeam.us.tir_cadre, byTeam.us.tir_hc), opp: pct(byTeam.opp.tir_cadre, byTeam.opp.tir_hc) },
      tacklePct: { us: pct(byTeam.us.tacle_ok, byTeam.us.tacle_ko), opp: pct(byTeam.opp.tacle_ok, byTeam.opp.tacle_ko) },
      duelPct: { us: pct(byTeam.us.duel_ok, byTeam.us.duel_ko), opp: pct(byTeam.opp.duel_ok, byTeam.opp.duel_ko) },
    };
  }, [currentMatch]);

  const chartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Tirs cadrés", Nous: stats.byTeam.us.tir_cadre, Adversaire: stats.byTeam.opp.tir_cadre },
      { name: "Buts", Nous: stats.byTeam.us.but, Adversaire: stats.byTeam.opp.but },
      { name: "Pertes de balle", Nous: stats.byTeam.us.perte, Adversaire: stats.byTeam.opp.perte },
      { name: "Récupérations", Nous: stats.byTeam.us.recup, Adversaire: stats.byTeam.opp.recup },
      { name: "Fautes", Nous: stats.byTeam.us.faute_commise, Adversaire: stats.byTeam.opp.faute_commise },
      { name: "Corners", Nous: stats.byTeam.us.corner, Adversaire: stats.byTeam.opp.corner },
    ];
  }, [stats]);

  return (
    <div className="app-root">
      <style>{CSS}</style>
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
          stats={stats}
          chartData={chartData}
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
        />
      )}
    </div>
  );
}

function HomeScreen({ matches, matchesLoaded, showNewForm, setShowNewForm, newMatchForm, setNewMatchForm, createMatch, openMatch, deleteMatch }) {
  return (
    <div className="home">
      <header className="home-header">
        <div className="eyebrow">Assistant coaching</div>
        <h1>Football Analysis</h1>
        <p className="subtitle">Repère chaque action pendant le match, les statistiques se construisent toutes seules.</p>
      </header>

      {!showNewForm && (
        <button className="btn btn-primary btn-large" onClick={() => setShowNewForm(true)}>
          + Nouveau match
        </button>
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
              <div className="match-card-name">{m.name}</div>
              <div className="match-card-meta">vs {m.opponent} · {formatDateFr(m.date)}</div>
            </div>
            <div className="match-card-side">
              <span className="tag-count">{m.tagCount || 0} actions</span>
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

function TaggingScreen(props) {
  const {
    match, videoUrl, videoRef, videoDuration, setVideoDuration, currentTime, setCurrentTime,
    isPlaying, setIsPlaying, playbackRate, setPlaybackRate, activeTeam, setActiveTeam,
    saveStatus, handleFile, togglePlay, seekTo, nudge,
    addTag, removeTag, setTagPlayer, exportMatch, goHome, chartData, lastTagFlash,
    videoError, setVideoError, videoLoading, setVideoLoading,
    pendingPlayerTag, assignPendingPlayer, dismissPendingPlayer, setPossession,
    runCompilation, compilationJob, compilations,
  } = props;

  const fileInputRef = useRef(null);
  const possessionTeam = match.possession && match.possession.length > 0 ? match.possession[match.possession.length - 1].team : null;
  const possDurations = { us: 0, opp: 0, neutral: 0 };
  (match.possession || []).forEach((p) => {
    const end = p.end != null ? p.end : currentTime;
    possDurations[p.team] += Math.max(0, end - p.start);
  });
  const possTotal = possDurations.us + possDurations.opp + possDurations.neutral;
  const possPct = (v) => (possTotal > 0 ? Math.round((v / possTotal) * 100) : 0);

  const collectiveTimes = useMemo(() => {
    const map = {};
    match.tags.forEach((t) => {
      const key = `${t.eventKey}::${t.team}`;
      (map[key] || (map[key] = [])).push(t.time);
    });
    return map;
  }, [match.tags]);

  const individualColumns = useMemo(() => {
    const seen = new Map();
    match.tags.forEach((t) => {
      if (!t.player) return;
      const key = `${t.team}_${t.player}`;
      if (!seen.has(key)) seen.set(key, { team: t.team, player: t.player, total: 0 });
      seen.get(key).total++;
    });
    return Array.from(seen.values()).sort((a, b) => b.total - a.total);
  }, [match.tags]);

  const individualTimes = useMemo(() => {
    const map = {};
    match.tags.forEach((t) => {
      if (!t.player) return;
      const key = `${t.eventKey}::${t.team}_${t.player}`;
      (map[key] || (map[key] = [])).push(t.time);
    });
    return map;
  }, [match.tags]);

  return (
    <div className="tagging">
      <div className="topbar">
        <button className="icon-btn" onClick={goHome} aria-label="Retour"><ArrowLeft size={16} /></button>
        <div className="topbar-title">
          <div className="topbar-name">{match.name}</div>
          <div className="topbar-meta">vs {match.opponent}</div>
        </div>
        <SaveIndicator status={saveStatus} />
        <button className="btn btn-ghost btn-small" onClick={exportMatch}><Download size={13} /> Exporter</button>
      </div>

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
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <button key={n} className="player-picker-btn" onClick={() => assignPendingPlayer(n)}>{n}</button>
                ))}
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
                  <button className="icon-btn" onClick={() => removeTag(t.id)} aria-label="Supprimer cette action">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

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
          <div className="panel-heading">Tendance du match</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26362C" vertical={false} />
                <XAxis dataKey="name" stroke="#8FA599" fontSize={10} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#8FA599" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#182A21", border: "1px solid #26362C", borderRadius: 6, color: "#EEF3EC" }} />
                <Bar dataKey="Nous" fill="#E3B23C" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Adversaire" fill="#D6483F" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-heading">Statistiques collectives — Nous vs Adversaire</div>
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

        {individualColumns.length > 0 && (
          <div className="panel-section">
            <div className="panel-heading">Statistiques individuelles</div>
            <div className="table-scroll">
              <table className="stat-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    {individualColumns.map((col) => (
                      <th key={`${col.team}_${col.player}`}><span className={`team-dot ${col.team}`} /> n°{col.player}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_EVENTS.map((ev) => (
                    <tr key={ev.key}>
                      <td>{ev.label}</td>
                      {individualColumns.map((col) => {
                        const key = `${ev.key}::${col.team}_${col.player}`;
                        return (
                          <td key={key}>
                            <CompileCell
                              times={individualTimes[key] || []}
                              cellKey={key}
                              label={`${ev.label} — n°${col.player} (${col.team === "us" ? "Nous" : "Adversaire"})`}
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
  .btn-small { padding: 6px 12px; font-size: 12px; }

  .new-match-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 20px; margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
  .new-match-card label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--ink-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .new-match-card input { background: var(--bg); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 9px 10px; font-size: 14px; font-weight: 400; text-transform: none; letter-spacing: normal; }
  .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

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
  .event-categories-stack { display: flex; flex-direction: column; gap: 10px; }
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

  .event-category-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); font-weight: 700; margin: 10px 0 6px; }
  .event-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .event-btn { position: relative; text-align: left; background: var(--surface); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 8px 8px 8px 22px; font-size: 11px; line-height: 1.3; font-weight: 500; transition: border-color 0.12s ease; }
  .event-btn.pos:hover { border-color: var(--gold); }
  .event-btn.neg:hover { border-color: var(--crimson); }
  .event-btn.disabled { opacity: 0.4; cursor: not-allowed; }
  .event-hotkey { position: absolute; left: 6px; top: 50%; transform: translateY(-50%); font-size: 9px; color: var(--ink-muted); font-weight: 800; }

  .compile-progress { background: var(--surface); border: 1px solid var(--gold); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
  .compile-progress-label { font-size: 11px; color: var(--ink); margin-bottom: 6px; }
  .compile-progress-bar { height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; }
  .compile-progress-bar > div { height: 100%; background: var(--gold); transition: width 0.2s ease; }

  .table-scroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
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
`;
