"""События урока: когда что происходит. Общие для звука (audio.py) и видео (stage.js).

Рисует холст в браузере (stage.js и episode<номер>.js), здесь только время, надписи и звуки.
Каждое событие привязано к слову озвучки (W_) — если фраза изменится, событие поедет за словом.
События попадают в редактор: их можно сдвигать по времени, а надписи — править.
"""
from pathlib import Path

import audio as A
from audio import at, start, word_t

EV = {}             # имя события → время, его читает stage.js
SOUND_EVENTS = []   # (время, звук, параметр, что происходит)
TEXT_DEFAULTS = {}  # ключ надписи → текст по умолчанию (в проекте можно переписать)
TEXT_TRACK = []     # дорожка «Тексты на экране» в редакторе


def W_(scene, stem, nth=0, d=0.0):
    return word_t(scene, stem, nth) + d


def ev(ch, key, t, label=None, sound=None, arg=0):
    """Событие главы: попадает на таймлайн редактора и, если задан звук, в микс."""
    t = at(f"{ch}:{key}", label or key, t)
    EV[key] = t
    if sound:
        SOUND_EVENTS.append((t, sound, arg, label or key))
    return t


def tx(ch, key, default, t, label=None, sound=None, arg=0):
    """Надпись: текст правится в редакторе, время — как у события."""
    TEXT_DEFAULTS[key] = default
    name = (label or default).replace("\n", " ")
    ev(ch, key, t, name, sound, arg)
    TEXT_TRACK.append((key, None, name, f"{ch}:{key}"))


EPISODE = Path(__file__).with_name(f"episode{A.PROJECT.get('episode', 3)}.py")
exec(compile(EPISODE.read_text(encoding="utf-8"), str(EPISODE), "exec"))

for s in range(2, A.N_SCENES + 1):
    SOUND_EVENTS.append((start(s) - 0.42, "whoosh", 0.5, f"шторка — глава {s - 1}"))
    SOUND_EVENTS.append((start(s) - 0.02, "clunk", 0, ""))
