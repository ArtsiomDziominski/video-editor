@echo off
rem Claude Видеоредактор: двойной клик — открыть последний проект в своём окне; перетащите .vproj на этот файл — открыть его.
chcp 65001 >nul
cd /d "%~dp0"
start "" pyw -X utf8 -m claude_video_editor.app %*
