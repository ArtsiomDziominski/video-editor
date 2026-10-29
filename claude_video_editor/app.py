"""Claude Видеоредактор: локальный сервер + страница в браузере.

python -m claude_video_editor.app [проект.vproj] [--port 8765] [--no-browser]

Всё работает на этом компьютере: превью кадров, переозвучка фраз (VoxCPM2 + Whisper на видеокарте),
сборка звука и MP4. Готовое видео кладётся рядом с файлом проекта.
"""
import importlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import traceback
import webbrowser
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .project import WORK_ROOT, open_project, read_json, save_project, write_json

HERE = Path(__file__).resolve().parent
ENGINE = HERE / "engine" / "voiceover.py"
RECENT = WORK_ROOT.parent / "recent.json"


class State:
    def __init__(self):
        self.path = None            # открытый .vproj
        self.work = None            # его рабочая папка
        self.modules = None         # (audio, video) шаблона
        self.version = 0            # растёт при каждой правке — сбрасывает кэш превью
        self.loaded_version = -1
        self.render_lock = threading.Lock()
        self.job = dict(name=None, running=False, progress=None, log=deque(maxlen=400), error=None, done_at=0)
        self.template_error = None
        self.dirty = False

    # ---------- проект ----------

    def open(self, path):
        path = Path(path).expanduser().resolve()
        if self.job["running"]:
            raise RuntimeError("дождитесь окончания задачи")
        self.work = open_project(path)
        self.path = path
        self.version += 1
        self.dirty = False
        recent = [str(path)] + [p for p in load_recent() if p != str(path)]
        RECENT.parent.mkdir(parents=True, exist_ok=True)
        RECENT.write_text(json.dumps(recent[:10], ensure_ascii=False), encoding="utf-8")
        if not (self.work / "build" / "audio.wav").exists():
            self.run_job("Сборка звука", [self.audio_cmd()])

    def project(self):
        return read_json(self.work)

    def template_dir(self):
        return HERE / "templates" / self.project()["template"]

    def env(self):
        out = self.path.parent / self.project().get("output", self.path.stem + ".mp4")
        return {**os.environ, "VPROJ_DIR": str(self.work), "VPROJ_OUT": str(out), "PYTHONIOENCODING": "utf-8"}

    def audio_cmd(self):
        return [sys.executable, "-X", "utf8", str(self.template_dir() / "audio.py")]

    def video_cmd(self):
        return [sys.executable, "-X", "utf8", str(self.template_dir() / "video.py")]

    def output_path(self):
        return self.path.parent / self.project().get("output", self.path.stem + ".mp4")

    def update(self, data):
        """Правки из редактора. Изменённый текст фразы снимает её старые дубли — нужна переозвучка."""
        pr = self.project()
        for key in ("texts", "offsets", "sfx_gain", "title", "output", "format"):
            if key in data:
                pr[key] = data[key]
        if "script" in data:
            lines_dir = self.work / "voice" / "lines"
            for i, (old, new) in enumerate(zip(pr["script"], data["script"]), 1):
                if old["text"] != new["text"]:
                    old_dir = lines_dir / "_old" / time.strftime("%Y%m%d-%H%M%S")
                    old_dir.mkdir(parents=True, exist_ok=True)
                    for f in lines_dir.glob(f"line_{i}_take*.wav"):
                        shutil.move(str(f), old_dir / f.name)
                    pr.get("forced_takes", {}).pop(str(i), None)
                old["text"], old["emotion"] = new["text"], new["emotion"]
        write_json(self.work, pr)
        self.version += 1
        self.dirty = True

    def save(self, path=None):
        if path:
            self.path = Path(path).expanduser().resolve()
        save_project(self.work, self.path)
        self.dirty = False

    # ---------- шаблон и превью ----------

    def modules_now(self):
        """Шаблон перезагружается после каждой правки (текстуры доски живут в отдельном модуле и не пересчитываются)."""
        if self.loaded_version != self.version:
            os.environ["VPROJ_DIR"] = str(self.work)
            tdir = str(self.template_dir())
            if tdir not in sys.path:
                sys.path.insert(0, tdir)
            try:
                if self.modules is None:
                    audio = importlib.import_module("audio")
                    video = importlib.import_module("video")
                else:
                    audio = importlib.reload(self.modules[0])
                    video = importlib.reload(self.modules[1])
                self.modules = (audio, video)
                self.template_error = None
            except Exception:
                self.template_error = traceback.format_exc(limit=3)
                self.modules = None
            self.loaded_version = self.version
        return self.modules

    def frame_jpeg(self, t):
        import cv2
        width = 960 if self.project().get("format") == "16:9" else 540
        with self.render_lock:
            mods = self.modules_now()
            if mods is None:
                raise RuntimeError(self.template_error or "шаблон не загрузился")
            img = mods[1].render_frame(max(0.0, min(t, mods[1].DURATION - 1 / mods[1].FPS)))
        img = cv2.resize(img, (width, int(width * img.shape[0] / img.shape[1])), interpolation=cv2.INTER_AREA)
        return cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 86])[1].tobytes()

    def timeline(self):
        with self.render_lock:
            mods = self.modules_now()
        if mods is None:
            return dict(error=self.template_error)
        A, V = mods
        names = ["Крючок", "Сцена 2", "Отсчёт", "Ответ", "Правило", "Петля"]
        return dict(
            duration=V.DURATION, fps=V.FPS,
            scenes=[dict(name=names[k] if k < len(names) else f"Сцена {k + 1}", start=a, end=b)
                    for k, (a, b) in enumerate(zip(A.CUTS, A.CUTS[1:]))],
            lines=[dict(start=a, end=a + ln["duration"], text=ln["text"], scene=ln["scene"])
                   for a, ln in zip(A.VOICE_AT, A.LINES)],
            events=[dict(e, t=e["base"] + e["offset"]) for e in A.TIMELINE],
            missing=A.MISSING)

    def voice_status(self):
        lines_dir = self.work / "voice" / "lines"
        lines = json.loads((lines_dir / "lines.json").read_text(encoding="utf-8"))
        takes = json.loads((lines_dir / "takes.json").read_text(encoding="utf-8")) if (lines_dir / "takes.json").exists() else {}
        out = []
        for i, sc in enumerate(self.project()["script"], 1):
            ln = lines[i - 1] if i - 1 < len(lines) else None
            files = sorted(lines_dir.glob(f"line_{i}_take*.wav"), key=lambda f: int(re.findall(r"take(\d+)", f.name)[0]))
            rep = {t["take"]: t for t in takes.get(str(i), {}).get("takes", [])}
            out.append(dict(
                i=i, scene=sc["scene"], emotion=sc["emotion"], text=sc["text"],
                stale=ln is None or ln["text"] != sc["text"], chosen=ln["take"] if ln else None,
                heard=ln["heard"] if ln else "", forced=self.project().get("forced_takes", {}).get(str(i)),
                takes=[dict(take=int(re.findall(r"take(\d+)", f.name)[0]), file=f"voice/lines/{f.name}",
                            **{k: v for k, v in rep.get(int(re.findall(r"take(\d+)", f.name)[0]), {}).items() if k != "take"})
                       for f in files]))
        return out

    # ---------- задачи ----------

    def write_voice_inputs(self):
        pr = self.project()
        vdir = self.work / "voice"
        rows = ["# сцена | эмоция | фраза — собрано редактором из project.json"]
        rows += [f"{s['scene']} | {s['emotion']} | {s['text']}" for s in pr["script"]]
        (vdir / "script.txt").write_text("\n".join(rows) + "\n", encoding="utf-8")
        (vdir / "profile.json").write_text(json.dumps(pr["voice"], ensure_ascii=False), encoding="utf-8")
        (vdir / "lines" / "forced.json").write_text(json.dumps(pr.get("forced_takes", {})), encoding="utf-8")

    def voice_cmd(self, only, extra=False):
        cmd = [sys.executable, "-X", "utf8", str(ENGINE), "voice/script.txt", "voice/lines"]
        if extra:
            cmd.append(",".join(map(str, only)))  # дополнительные дубли для этих фраз
        return cmd + ["--voice", "voice/profile.json", "--only", ",".join(map(str, only))]

    def run_job(self, name, cmds):
        if self.job["running"]:
            raise RuntimeError(f"уже идёт: {self.job['name']}")
        job = self.job
        job.update(name=name, running=True, progress=None, error=None)
        job["log"].clear()

        def work():
            try:
                for cmd in cmds:
                    job["log"].append("$ " + " ".join(Path(c).name if os.sep in c or "/" in c else c for c in cmd))
                    proc = subprocess.Popen(cmd, cwd=self.work, env=self.env(), stdout=subprocess.PIPE,
                                            stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
                    for line in proc.stdout:
                        for part in line.replace("\r", "\n").split("\n"):
                            part = part.rstrip()
                            if not part or "it/s]" in part or "s/it]" in part:
                                continue
                            m = re.search(r"кадр (\d+)/(\d+)", part)
                            if m:
                                job["progress"] = int(m.group(1)) / int(m.group(2))
                            job["log"].append(part)
                    if proc.wait() != 0:
                        raise RuntimeError(f"команда завершилась с кодом {proc.returncode}")
                job["progress"] = 1.0
            except Exception as e:
                job["error"] = str(e)
                job["log"].append("ОШИБКА: " + str(e))
            finally:
                job["running"] = False
                job["done_at"] = time.time()
                self.version += 1  # новая озвучка/звук → таймлайн пересчитать

        threading.Thread(target=work, daemon=True).start()


def load_recent():
    try:
        return json.loads(RECENT.read_text(encoding="utf-8"))
    except Exception:
        return []


S = State()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def send_file(self, path, ctype):
        """Файлы с поддержкой Range — чтобы плеер в браузере мог перематывать."""
        size = path.stat().st_size
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng and (m := re.match(r"bytes=(\d*)-(\d*)", rng)):
            start = int(m.group(1) or 0)
            end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Cache-Control", "no-store")
        if rng:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (ConnectionResetError, BrokenPipeError):
                    return
                left -= len(chunk)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/":
                return self.send(200, (HERE / "ui.html").read_bytes(), "text/html; charset=utf-8")
            if u.path == "/api/state":
                st = dict(open=S.work is not None, recent=load_recent(), job={**S.job, "log": list(S.job["log"])[-60:]},
                          version=S.version, dirty=S.dirty)
                if S.work:
                    out = S.output_path()
                    st.update(path=str(S.path), project=S.project(), output=str(out), has_output=out.exists(),
                              output_mtime=out.stat().st_mtime if out.exists() else 0,
                              has_audio=(S.work / "build" / "audio.wav").exists())
                return self.send(200, st)
            if not S.work:
                return self.send(409, dict(error="проект не открыт"))
            if u.path == "/api/timeline":
                return self.send(200, S.timeline())
            if u.path == "/api/voice":
                return self.send(200, S.voice_status())
            if u.path == "/api/frame":
                return self.send(200, S.frame_jpeg(float(q.get("t", 0))), "image/jpeg")
            if u.path == "/api/file":
                rel = q.get("path", "")
                f = (S.work / rel).resolve()
                if not str(f).startswith(str(S.work.resolve())) or not f.is_file():
                    return self.send(404, dict(error="нет файла"))
                return self.send_file(f, "audio/wav" if f.suffix == ".wav" else "application/octet-stream")
            if u.path == "/api/output":
                out = S.output_path()
                return self.send_file(out, "video/mp4") if out.exists() else self.send(404, dict(error="ещё не собрано"))
            self.send(404, dict(error="нет такого адреса"))
        except Exception as e:
            self.send(500, dict(error=str(e), trace=traceback.format_exc(limit=4)))

    def do_POST(self):
        u = urlparse(self.path)
        try:
            d = self.body()
            if u.path == "/api/open":
                S.open(d["path"])
                return self.send(200, dict(ok=True))
            if not S.work:
                return self.send(409, dict(error="проект не открыт"))
            if u.path == "/api/update":
                S.update(d)
                return self.send(200, dict(ok=True, version=S.version))
            if u.path == "/api/save":
                S.save(d.get("path"))
                return self.send(200, dict(ok=True, path=str(S.path)))
            if u.path == "/api/take":  # выбрать дубль вручную и пересобрать фразу
                pr = S.project()
                pr.setdefault("forced_takes", {})[str(d["line"])] = int(d["take"])
                write_json(S.work, pr)
                S.dirty = True
                S.write_voice_inputs()
                S.run_job(f"Дубль {d['take']} для фразы {d['line']}", [S.voice_cmd([d["line"]]), S.audio_cmd()])
                return self.send(200, dict(ok=True))
            if u.path == "/api/revoice":
                S.write_voice_inputs()
                lines = [int(x) for x in d["lines"]]
                S.run_job("Озвучка фраз " + ", ".join(map(str, lines)),
                          [S.voice_cmd(lines, extra=d.get("extra", False)), S.audio_cmd()])
                S.dirty = True
                return self.send(200, dict(ok=True))
            if u.path == "/api/audio":
                S.run_job("Сборка звука", [S.audio_cmd()])
                return self.send(200, dict(ok=True))
            if u.path == "/api/render":
                S.run_job("Сборка MP4", [S.audio_cmd(), S.video_cmd()])
                return self.send(200, dict(ok=True))
            self.send(404, dict(error="нет такого адреса"))
        except Exception as e:
            self.send(500, dict(error=str(e)))


def main():
    args = sys.argv[1:]
    port = 8765
    if "--port" in args:
        k = args.index("--port")
        port = int(args[k + 1])
        del args[k:k + 2]
    browser = "--no-browser" not in args
    args = [a for a in args if a != "--no-browser"]
    if args:
        S.open(args[0])
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"Редактор открыт: {url}  (Ctrl+C — выйти)", flush=True)
    if browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
