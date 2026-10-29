@echo off
rem Редактор роликов: двойной клик — открыть последний проект; перетащите .vproj на этот файл — открыть его.
chcp 65001 >nul
cd /d "%~dp0"
py -X utf8 -m vizavi_editor.app %*
if errorlevel 1 pause
