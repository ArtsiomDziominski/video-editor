"""Chromium с холстом: Playwright живёт в своём потоке, а render зовут из любого.

Модуль не перезагружается редактором, поэтому браузер переживает правки проекта.
"""
import base64
import queue
import threading
from pathlib import Path

HTML = Path(__file__).with_name("stage.html")


class Stage:
    def __init__(self):
        self.jobs = queue.Queue()
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport=dict(width=1920, height=1080))
            while True:
                fn, args, box = self.jobs.get()
                try:
                    box.put((True, fn(page, *args)))
                except Exception as e:
                    box.put((False, e))

    def _call(self, fn, *args):
        box = queue.Queue()
        self.jobs.put((fn, args, box))
        ok, res = box.get()
        if not ok:
            raise res
        return res

    def load(self, data):
        """Перечитать страницу: правки stage.js применяются без перезапуска браузера."""
        def go(page, data):
            page.goto(HTML.as_uri())
            page.evaluate("d => init(d)", data)
        self._call(go, data)

    def jpeg(self, t, quality=0.96):
        def go(page, t, quality):
            url = page.evaluate("([t, q]) => shot(t, q)", [t, quality])
            return base64.b64decode(url.split(",", 1)[1])
        return self._call(go, t, quality)


STAGE = None


def stage():
    global STAGE
    if STAGE is None:
        STAGE = Stage()
    return STAGE
