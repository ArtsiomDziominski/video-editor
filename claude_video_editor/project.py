"""Файл проекта .vproj — один zip со всем, что нужно для пересборки ролика.

Внутри:
  project.json          — шаблон, сценарий, тексты на экране, сдвиги событий, выбранные дубли, громкость эффектов
  voice/voice.wav       — образец голоса для клонирования
  voice/lines/          — все дубли озвучки (line_N_takeK.wav), готовые фразы (line_N.wav), lines.json, takes.json
Папка build/ (звук, превью) в файл не сохраняется — это кэш, он пересобирается.
"""
import hashlib
import json
import os
import shutil
import zipfile
from pathlib import Path

WORK_ROOT = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "claude_video_editor" / "work"


def workdir_for(path):
    path = Path(path).resolve()
    return WORK_ROOT / f"{path.stem}-{hashlib.md5(str(path).encode()).hexdigest()[:8]}"


def open_project(path):
    """Распаковывает .vproj в рабочую папку и возвращает её."""
    path = Path(path).resolve()
    work = workdir_for(path)
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():  # без выхода за пределы рабочей папки
            target = (work / name).resolve()
            if not str(target).startswith(str(work.resolve())):
                raise ValueError(f"недопустимый путь в архиве: {name}")
        z.extractall(work)
    if not (work / "project.json").exists():
        raise ValueError("в файле нет project.json — это не проект редактора")
    return work


def save_project(work, path):
    """Собирает рабочую папку обратно в .vproj (атомарно: сначала во временный файл)."""
    path = Path(path)
    tmp = path.with_suffix(".vproj.tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(Path(work).rglob("*")):
            rel = f.relative_to(work)
            if f.is_file() and rel.parts[0] != "build" and "_old" not in rel.parts:
                z.write(f, rel.as_posix())
    os.replace(tmp, path)


def read_json(work):
    return json.loads((Path(work) / "project.json").read_text(encoding="utf-8"))


def write_json(work, project):
    (Path(work) / "project.json").write_text(json.dumps(project, ensure_ascii=False, indent=1), encoding="utf-8")


def pack(path, project, voice_wav, lines_dir):
    """Новый .vproj из готовых частей: проекта, образца голоса и папки с озвучкой."""
    path = Path(path)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("project.json", json.dumps(project, ensure_ascii=False, indent=1))
        z.write(voice_wav, "voice/voice.wav")
        for f in sorted(Path(lines_dir).glob("*")):
            if f.is_file() and (f.suffix in (".wav", ".json")) and not f.name.startswith("ref_"):
                z.write(f, f"voice/lines/{f.name}")
