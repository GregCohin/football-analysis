import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Play, Pause, ArrowLeft, X, Download, Video as VideoIcon } from "lucide-react";

const EVENT_CATEGORIES = [
  {
    id: "offensif",
    label: "Offensif",
    events: [
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
  const [activeTab, setActiveTab] = useState("journal");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMatchForm, setNewMatchForm] = useState({ name: "", opponent: "", date: todayIso() });
  const [lastTagFlash, setLastTagFlash] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const videoRef = useRef(null);
  const currentMatchRef = useRef(null);
  currentMatchRef.current = currentMatch;

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
    };
    writeMatch(match);
    persistIndexUpdate(match);
    setCurrentMatch(match);
    setVideoUrl(null);
    setVideoDuration(0);
    setCurrentTime(0);
    setActiveTeam("us");
    setActiveTab("journal");
    setScreen("tagging");
    setShowNewForm(false);
    setNewMatchForm({ name: "", opponent: "", date: todayIso() });
    setSaveStatus("saved");
  }

  function openMatch(summary) {
    try {
      const raw = localStorage.getItem(matchStorageKey(summary.id));
      const match = raw ? JSON.parse(raw) : { ...summary, tags: [] };
      setCurrentMatch(match);
      setVideoUrl(null);
      setVideoDuration(0);
      setCurrentTime(0);
      setActiveTab("journal");
      setScreen("tagging");
      setSaveStatus("saved");
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
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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
    saveStatus, activeTab, setActiveTab, handleFile, togglePlay, seekTo, nudge,
    addTag, removeTag, setTagPlayer, exportMatch, goHome, stats, chartData, lastTagFlash,
    videoError, setVideoError, videoLoading, setVideoLoading,
  } = props;

  const fileInputRef = useRef(null);

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

      <div className="tagging-grid">
        <div className="main-col">
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
            <TimelinePulse tags={match.tags} duration={videoDuration} currentTime={currentTime} onSeek={seekTo} />
          )}

          <div className="tabs">
            <button className={`tab ${activeTab === "journal" ? "active" : ""}`} onClick={() => setActiveTab("journal")}>Journal ({match.tags.length})</button>
            <button className={`tab ${activeTab === "stats" ? "active" : ""}`} onClick={() => setActiveTab("stats")}>Statistiques</button>
          </div>

          {activeTab === "journal" && (
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
          )}

          {activeTab === "stats" && stats && (
            <div className="stats-panel">
              <div className="ratio-grid">
                <RatioCard label="Précision de passe" us={stats.passPct.us} opp={stats.passPct.opp} />
                <RatioCard label="Tirs cadrés" us={stats.shotPct.us} opp={stats.shotPct.opp} />
                <RatioCard label="Tacles réussis" us={stats.tacklePct.us} opp={stats.tacklePct.opp} />
                <RatioCard label="Duels aériens" us={stats.duelPct.us} opp={stats.duelPct.opp} />
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#26362C" vertical={false} />
                    <XAxis dataKey="name" stroke="#8FA599" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis stroke="#8FA599" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#182A21", border: "1px solid #26362C", borderRadius: 6, color: "#EEF3EC" }} />
                    <Bar dataKey="Nous" fill="#E3B23C" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Adversaire" fill="#D6483F" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="side-col">
          <div className="team-toggle">
            <button className={`team-btn us ${activeTeam === "us" ? "active" : ""}`} onClick={() => setActiveTeam("us")}>NOUS</button>
            <button className={`team-btn opp ${activeTeam === "opp" ? "active" : ""}`} onClick={() => setActiveTeam("opp")}>ADVERSAIRE</button>
          </div>
          <div className="hint">Astuce : Tab pour changer d'équipe, Espace pour lecture/pause</div>

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
      </div>
    </div>
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

function TimelinePulse({ tags, duration, currentTime, onSeek }) {
  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(pct * duration);
  }
  return (
    <div className="pulse-track" onClick={handleClick}>
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

  .tagging-grid { display: grid; grid-template-columns: 1fr 340px; gap: 18px; padding: 18px; flex: 1; min-height: 0; }
  @media (max-width: 860px) { .tagging-grid { grid-template-columns: 1fr; } }

  .video-placeholder { position: relative; background: var(--surface); border: 1px dashed var(--line); border-radius: 10px; padding: 48px 20px; text-align: center; color: var(--ink-muted); display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .video-wrap { position: relative; background: black; border-radius: 10px; overflow: hidden; }
  .video-wrap video { width: 100%; display: block; max-height: 46vh; }
  .video-status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; color: var(--ink-muted); font-size: 13px; line-height: 1.5; background: rgba(13,21,18,0.88); }
  .video-status.error { color: var(--crimson); }

  .video-controls { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .btn-play { width: 40px; height: 40px; border-radius: 50%; padding: 0; }
  .time-code { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--ink-muted); margin-left: auto; }
  .video-controls select { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; font-size: 12px; }

  .pulse-track { position: relative; height: 34px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; margin-top: 12px; cursor: pointer; }
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

  .event-category-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); font-weight: 700; margin: 10px 0 6px; }
  .event-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .event-btn { position: relative; text-align: left; background: var(--surface); border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 9px 10px 9px 26px; font-size: 12px; font-weight: 500; transition: border-color 0.12s ease; }
  .event-btn.pos:hover { border-color: var(--gold); }
  .event-btn.neg:hover { border-color: var(--crimson); }
  .event-btn.disabled { opacity: 0.4; cursor: not-allowed; }
  .event-hotkey { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--ink-muted); font-weight: 800; }
`;
