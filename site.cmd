@echo off
rem Raccourci : "site odette2", "site odette" ou "site vitrine" lance le serveur local (voir main.py).
where python >nul 2>nul && (python "%~dp0main.py" %*) || (py "%~dp0main.py" %*)
