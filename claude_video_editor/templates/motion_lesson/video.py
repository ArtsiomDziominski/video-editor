"""Шаблон «Моушен-урок»: кадры рисует холст в Chromium (stage.js + episode<номер>.js), здесь сборка.

python video.py                 — MP4: кадры считают несколько браузеров, каждый свой кусок, потом склейка со звуком
python video.py 12 30.5 41      — контактный лист build/sheet.png
python video.py --seq 12.0 0.5  — плотная последовательность build/seq.png
"""
import json
import os
import re
import shutil
import subprocess
import sys

import cv2
import imageio_ffmpeg
import numpy as np

import audio as A
import beats as B
import stage_host
from audio import LINES, VOICE_AT, norm

W, H = 1920, 1080
FPS = int(A.PROJECT.get("fps", 60))
VIDEO_OUT = os.environ.get("VPROJ_OUT", str(A.BUILD / "video.mp4"))
AUDIO = A.OUT + ".wav"
DURATION = round(A.DURATION * FPS) / FPS
TEXTS = {**B.TEXT_DEFAULTS, **A.PROJECT.get("texts", {})}
TEXT_TRACK = B.TEXT_TRACK
WORKERS = min(8, max(1, (os.cpu_count() or 4) // 2))

# ---------- субтитры: собираются здесь, рисует stage.js ----------

ROW = 27
SUB_STEMS = [
    ("yellow", ("вероятност", "риск", "план")),
    ("green", ("рост", "роста")),
    ("red", ("падени", "защит")),
]


def word_color(w):
    n = norm(w)
    return next((col for col, stems in SUB_STEMS if n.startswith(stems)), "white")


def build_subs():
    chunks = []
    for li, ln in enumerate(LINES):
        disp = []
        for tok in ln["text"].split():
            if tok == "—" and disp:
                disp[-1] += " —"
            else:
                disp.append(tok)
        if len(disp) != len(ln["words"]):
            continue
        timed = []
        for d, (_, s, _) in zip(disp, ln["words"]):
            shown = re.sub(r"(?<=[а-яё])[А-ЯЁ]", lambda m: m.group(0).lower(), d).replace("прабои", "пробои")
            timed.append(dict(word=shown, t=VOICE_AT[li] + s, color=word_color(d)))
        groups, rows = [], [[]]
        for tk in timed:
            row = rows[-1]
            if row and sum(len(x["word"]) + 1 for x in row) + len(tk["word"]) > ROW:
                if len(rows) == 3:
                    groups.append(rows)
                    rows = [[]]
                else:
                    rows.append([])
            rows[-1].append(tk)
            if tk["word"][-1] in ".?!…":
                groups.append(rows)
                rows = [[]]
        if rows[0]:
            groups.append(rows)
        for rows in groups:
            chunks.append(dict(line=li, start=rows[0][0]["t"] - 0.05, rows=rows, line_end=VOICE_AT[li] + ln["duration"]))
    for k, c in enumerate(chunks):
        nxt = chunks[k + 1] if k + 1 < len(chunks) else None
        c["end"] = nxt["start"] if nxt else c["line_end"] + 0.5
        if nxt and nxt["line"] != c["line"]:
            c["end"] = min(c["line_end"] + 0.35, nxt["start"])
    return chunks


def stage_data():
    episode = A.PROJECT.get("episode", 3)
    files = sorted(p.name for p in stage_host.HTML.parent.glob(f"episode{episode}*.js"))
    return dict(ev=B.EV, text=TEXTS, cuts=A.CUTS, dur=DURATION, fps=FPS, names=A.SCENE_NAMES, files=files,
                subs=build_subs() if A.PROJECT.get("subtitles", True) else [], custom=A.PROJECT.get("custom_texts", []),
                title=A.PROJECT.get("title", ""))


STAGE = stage_host.stage()
STAGE.load(stage_data())


def render_frame(t):
    img = cv2.imdecode(np.frombuffer(STAGE.jpeg(t), np.uint8), cv2.IMREAD_COLOR)
    return img


# ---------- сборка ----------

def encode_cmd(out):
    return [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-r", str(FPS),
            "-i", "-", "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "medium",
            "-crf", "18", "-profile:v", "high", "-g", str(FPS * 2), "-r", str(FPS), str(out)]


def render_segment(k0, k1, out):
    proc = subprocess.Popen(encode_cmd(out), stdin=subprocess.PIPE)
    for k in range(k0, k1):
        proc.stdin.write(STAGE.jpeg(k / FPS))
        if (k - k0) % 30 == 29:
            print("+30", flush=True)
    proc.stdin.close()
    if proc.wait():
        raise RuntimeError("ffmpeg не собрал кусок")


def render_all():
    total = round(DURATION * FPS)
    seg_dir = A.BUILD / "segments"
    shutil.rmtree(seg_dir, ignore_errors=True)
    seg_dir.mkdir()
    edges = [total * k // WORKERS for k in range(WORKERS + 1)]
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    procs = [subprocess.Popen([sys.executable, "-X", "utf8", __file__, "--segment", str(a), str(b), str(seg_dir / f"{k:02}.mp4")],
                              stdout=subprocess.PIPE, text=True, encoding="utf-8", env=env)
             for k, (a, b) in enumerate(zip(edges, edges[1:]))]
    # счётчик общий: куски идут параллельно, редактор видит кадры всего ролика
    import threading
    done, lock = [0], threading.Lock()

    def follow(p):
        for row in p.stdout:
            if row.startswith("+30"):
                with lock:
                    done[0] += 30
                    print(f"кадр {done[0]}/{total}", flush=True)

    threads = [threading.Thread(target=follow, args=(p,), daemon=True) for p in procs]
    for th in threads:
        th.start()
    if any(p.wait() for p in procs):
        raise RuntimeError("кусок видео не собрался")
    for th in threads:
        th.join()
    names = seg_dir / "list.txt"
    names.write_text("".join(f"file '{k:02}.mp4'\n" for k in range(WORKERS)), encoding="utf-8")
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(names),
                    "-i", AUDIO, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-t", f"{DURATION:.4f}", "-movflags", "+faststart", VIDEO_OUT], check=True)
    shutil.rmtree(seg_dir, ignore_errors=True)
    print("готово:", VIDEO_OUT)


def render_clip(t0, dur, out):
    """Короткий кусок со звуком: проверить движение, не собирая весь ролик."""
    tmp = str(A.BUILD / "clip.mp4")
    render_segment(round(t0 * FPS), round((t0 + dur) * FPS), tmp)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", tmp, "-ss", str(t0), "-t", str(dur), "-i", AUDIO,
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], check=True)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--segment":
        render_segment(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
        return
    if len(sys.argv) > 1 and sys.argv[1] == "--clip":
        render_clip(float(sys.argv[2]), float(sys.argv[3]), sys.argv[4])
        return
    print("главы:", " | ".join(f"{a:.1f}" for a in A.CUTS[:-1]), f"→ {DURATION:.1f} с, событий {len(B.EV)}")
    out = A.BUILD
    if len(sys.argv) > 1 and sys.argv[1] == "--seq":
        t0, dur, step = float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]) if len(sys.argv) > 4 else 1 / FPS
        times = [t0 + k * step for k in range(int(round(dur / step)))]
        tiles = [cv2.resize(render_frame(tt), (384, 216), interpolation=cv2.INTER_AREA) for tt in times]
        for tile, tt in zip(tiles, times):
            cv2.putText(tile, f"{tt:.2f}", (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 5)
        cv2.imwrite(str(out / "seq.png"), np.vstack([np.hstack(tiles[i:i + 5]) for i in range(0, len(tiles), 5)]))
        return
    if len(sys.argv) > 1:
        tiles = [cv2.resize(render_frame(float(a)), (640, 360), interpolation=cv2.INTER_AREA) for a in sys.argv[1:]]
        for tile, a in zip(tiles, sys.argv[1:]):
            cv2.putText(tile, a, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 3)
        cv2.imwrite(str(out / "sheet.png"), np.vstack([np.hstack(tiles[i:i + 3]) for i in range(0, len(tiles), 3)]))
        return
    render_all()


if __name__ == "__main__":
    main()
