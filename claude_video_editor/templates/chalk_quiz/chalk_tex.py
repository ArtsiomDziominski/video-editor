"""Текстуры доски и мела для шаблона «Квиз на школьной доске» — считаются один раз за процесс."""
import cv2
import numpy as np

W, H = 1080, 1920


def noise(sigma, shape=(H, W), sd=0):
    r = np.random.default_rng(sd).normal(0, 1, shape).astype(np.float32)
    if sigma:
        r = cv2.GaussianBlur(r, (0, 0), sigma)
    return r / (r.std() + 1e-6)


def make_board(W=W, H=H, light_x=900):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = np.array((50, 70, 33), np.float32) + (cv2.resize(noise(6, (H // 8, W // 8), 1), (W, H)) * 3.0
                                                + noise(0.6, (H, W), sd=2) * 2.2)[..., None]
    haze = np.zeros((H, W), np.float32)                  # разводы стёртого мела — дуги губки
    r = np.random.default_rng(4)
    for _ in range(9):
        a0 = r.uniform(0, 360)
        cv2.ellipse(haze, (int(r.uniform(0, W)), int(r.uniform(0, H))),
                    (int(r.uniform(180, 520)), int(r.uniform(90, 400))), r.uniform(0, 180), a0, a0 + r.uniform(60, 160),
                    1.0, int(r.uniform(30, 90)), cv2.LINE_AA)
    haze = cv2.GaussianBlur(haze, (0, 0), 18) * (0.6 + 0.4 * np.clip(noise(3, (H, W), sd=5) * 0.5 + 0.5, 0, 1))
    img += haze[..., None] * np.array((9, 11, 9), np.float32)
    light = np.exp(-(((xx - light_x) / 900) ** 2 + ((yy - 250) / 1300) ** 2))   # тёплый свет из окна справа сверху
    img += light[..., None] * np.array((8, 24, 40), np.float32)
    vig = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2)
    img *= (1 - 0.35 * np.clip(vig - 0.35, 0, 1))[..., None]
    return img


BOARD = make_board()
GRAIN = np.clip(0.55 + 0.30 * noise(0.5, sd=7) + 0.18 * noise(1.5, sd=8), 0, 1)      # зерно мела
PRESS = np.clip(0.88 + 0.12 * noise(14, sd=9), 0.6, 1).astype(np.float32)           # нажим
DISS = np.clip(0.5 + 0.22 * noise(2.5, sd=10) + 0.1 * noise(0.8, sd=11), 0, 1)      # порядок рассыпания в пыль
STREAK = np.clip(0.5 + 0.5 * cv2.GaussianBlur(noise(0, sd=12), (0, 0), sigmaX=2.0, sigmaY=30) * 2.5, 0, 1)
_hatch = np.zeros((H, W), np.uint8)
for _c in range(-H, W + H, 9):                              # штриховка мелом под 45°, привязана к доске
    cv2.line(_hatch, (_c, H), (_c + H, 0), 255, 3, cv2.LINE_AA)
HATCH = _hatch.astype(np.float32) / 255


_land = None


def landscape(w=1920, h=1080):
    """Доска и полосы губки для горизонтального кадра (YouTube 16:9) — по запросу, один раз."""
    global _land
    if _land is None:
        streak = np.clip(0.5 + 0.5 * cv2.GaussianBlur(noise(0, (h, w), sd=13), (0, 0), sigmaX=2.0, sigmaY=30) * 2.5, 0, 1)
        _land = (make_board(w, h, light_x=1500), streak.astype(np.float32))
    return _land
