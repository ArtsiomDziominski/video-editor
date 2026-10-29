"""Распознавание русской речи Whisper'ом с таймингами слов.

py asr.py file.wav [file2.wav ...]
"""
import json
import sys

import librosa
import torch
from transformers import pipeline

MODEL = "openai/whisper-large-v3-turbo"

_asr = None


def transcribe(path, words=True):
    global _asr
    if _asr is None:
        _asr = pipeline("automatic-speech-recognition", model=MODEL, torch_dtype=torch.float16, device="cuda:0")
    audio, _ = librosa.load(path, sr=16000)
    out = _asr(audio, return_timestamps="word" if words else True,
               generate_kwargs={"language": "russian", "task": "transcribe"})
    return out["text"].strip(), [(c["text"].strip(), *c["timestamp"]) for c in out["chunks"]]


if __name__ == "__main__":
    for p in sys.argv[1:]:
        text, chunks = transcribe(p)
        print(p, "->", text)
        print(json.dumps(chunks, ensure_ascii=False))
