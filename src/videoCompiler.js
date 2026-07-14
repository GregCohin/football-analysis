import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

let ffmpegInstance = null;
let ffmpegLoadingPromise = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;
  ffmpegLoadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();
  return ffmpegLoadingPromise;
}

function formatFFmpegTime(seconds) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(5, "0")}`;
}

function mergeOverlappingClips(centers, videoDuration, padding) {
  const raw = centers
    .map((c) => ({ start: Math.max(0, c - padding), end: Math.min(videoDuration, c + padding) }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const clip of raw) {
    const last = merged[merged.length - 1];
    if (last && clip.start <= last.end) {
      last.end = Math.max(last.end, clip.end);
    } else {
      merged.push({ ...clip });
    }
  }
  return merged;
}

/**
 * Génère une compilation vidéo à partir d'une liste d'instants (secondes) tagués.
 * Chaque instant devient un clip de ±5 secondes ; les clips qui se chevauchent
 * sont fusionnés pour éviter les répétitions.
 *
 * @param {File} videoFile - le fichier vidéo source (celui sélectionné par l'utilisateur)
 * @param {number[]} clipCenters - les instants (en secondes) autour desquels découper
 * @param {number} videoDuration - durée totale de la vidéo source, pour ne pas dépasser les bords
 * @param {(progress: {phase: string, pct: number}) => void} onProgress
 * @returns {Promise<Blob>} la vidéo compilée, au format mp4
 */
export async function generateCompilation(videoFile, clipCenters, videoDuration, onProgress) {
  onProgress({ phase: "chargement du moteur vidéo", pct: 2 });
  const ffmpeg = await getFFmpeg();

  const inputName = "source_input.mp4";
  onProgress({ phase: "lecture du fichier source", pct: 8 });
  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

  const merged = mergeOverlappingClips(clipCenters, videoDuration || Infinity, 5);
  const clipFiles = [];

  for (let i = 0; i < merged.length; i++) {
    const { start, end } = merged[i];
    const outName = `clip_${i}.mp4`;
    await ffmpeg.exec([
      "-i", inputName,
      "-ss", formatFFmpegTime(start),
      "-to", formatFFmpegTime(end),
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
      "-c:a", "aac",
      outName,
    ]);
    clipFiles.push(outName);
    onProgress({ phase: `découpage des clips (${i + 1}/${merged.length})`, pct: 10 + Math.round(((i + 1) / merged.length) * 75) });
  }

  const listContent = clipFiles.map((f) => `file '${f}'`).join("\n");
  await ffmpeg.writeFile("list.txt", listContent);

  onProgress({ phase: "assemblage final", pct: 90 });
  await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "output.mp4"]);

  const data = await ffmpeg.readFile("output.mp4");
  onProgress({ phase: "terminé", pct: 100 });

  try {
    await ffmpeg.deleteFile(inputName);
    for (const f of clipFiles) await ffmpeg.deleteFile(f);
    await ffmpeg.deleteFile("list.txt");
    await ffmpeg.deleteFile("output.mp4");
  } catch (e) {
    // nettoyage non bloquant : si ça échoue, la mémoire sera de toute façon
    // libérée à la prochaine navigation
  }

  return new Blob([data.buffer], { type: "video/mp4" });
}
