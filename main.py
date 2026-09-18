#!/usr/bin/env python3
"""
Lance un serveur local pour l'un des sites statiques de ce dépôt.

Aucune dépendance à installer : uniquement la bibliothèque standard de
Python (déjà présente si `python`/`python3` fonctionne). Les sites eux-mêmes
n'ont pas de gestionnaire de paquets (pas de package.json/requirements.txt) :
leur seule dépendance externe (Supabase JS pour salon-odette) est chargée
directement depuis une CDN dans le HTML — voir README.md pour le détail.

Usage :
    python main.py                     → menu de choix interactif
    python main.py salon-odette        → lance directement ce site
    python main.py site-odette2        → nouveau parcours de réservation (v2)
    python main.py vitrine-de-quartier
"""
import functools
import http.server
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8000

# Dossier → fichier HTML à ouvrir en premier dans ce dossier.
SITES = {
    "salon-odette": "salon-odette-demo.html",
    "site-odette2": "site-odette2.html",
    "vitrine-de-quartier": "vitrine-de-quartier.html",
}


def choose_site():
    names = list(SITES)
    print("Sites disponibles :")
    for i, name in enumerate(names, 1):
        print(f"  {i}. {name}")
    choice = input(f"Quel site lancer ? (numéro ou nom) [1-{len(names)}, défaut 1] ").strip() or "1"
    if choice in SITES:
        return choice
    try:
        return names[int(choice) - 1]
    except (ValueError, IndexError):
        sys.exit("Choix invalide.")


def main():
    site = sys.argv[1] if len(sys.argv) > 1 else choose_site()
    if site not in SITES:
        sys.exit(f"Site inconnu : {site!r}. Choix possibles : {', '.join(SITES)}")

    entry_file = SITES[site]
    if not (ROOT / site / entry_file).exists():
        sys.exit(f"Fichier introuvable : {ROOT / site / entry_file}")

    # Sert tout le dépôt (pas juste le dossier du site choisi) : site-odette2/ a des liens
    # qui sortent de son propre dossier vers ../salon-odette/ (espace coiffeur, version
    # originale) — un serveur scopé à un seul dossier casserait ces liens en 404.
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    try:
        # ThreadingHTTPServer, pas TCPServer : un navigateur charge le HTML puis les .js/.css
        # via plusieurs connexions en parallèle — un serveur mono-thread les traite une par une
        # et peut sembler bloqué le temps que la première requête (ou un onglet resté ouvert)
        # libère la connexion.
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    except OSError:
        sys.exit(
            f"Le port {PORT} est déjà utilisé — un serveur tourne peut-être déjà "
            f"(fermez-le, ou changez PORT dans main.py)."
        )

    with httpd:
        url = f"http://127.0.0.1:{PORT}/{site}/{entry_file}"
        print(f"Serveur lancé sur {url}  (Ctrl+C pour arrêter)")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nArrêt du serveur.")


if __name__ == "__main__":
    main()
