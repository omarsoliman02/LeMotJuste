#!/usr/bin/env bash
# Sert la page de demo (dossier frontend) directement a la racine du serveur,
# pour ouvrir http://localhost:5500 sans tomber sur l'arborescence du projet.
# Usage : ./serve.sh [port]   (port 5500 par defaut)
cd "$(dirname "$0")/frontend" && exec python3 -m http.server "${1:-5500}"
