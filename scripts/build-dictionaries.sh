#!/usr/bin/env bash
#
# Génère les deux listes de mots de game-service à partir de sources lexicales publiques.
#
#   - mots-valides.txt   : TOUS les mots français valides (dictionnaire Hunspell / Dicollecte),
#                          utilisés pour valider une proposition.
#   - dictionnaire.txt   : les mots-mystères, = mots les plus fréquents (OpenSubtitles) qui sont
#                          aussi de vrais mots du dictionnaire → des solutions courantes et justes.
#
# Tous les mots sont passés en minuscules, sans accents (œ→oe, æ→ae), lettres a-z uniquement,
# de longueur 4 à 10, dédoublonnés. game-service re-normalise de toute façon au chargement.
#
# Sources (licences libres, citées dans le rapport) :
#   - https://github.com/words/an-array-of-french-words  (Hunspell FR, ~336k mots)
#   - https://github.com/hermitdave/FrequencyWords        (fréquences OpenSubtitles 2018)
#
# Usage :  ./scripts/build-dictionaries.sh
# Réglages (variables d'env) : ANSWERS_MAX (def. 5000), MIN_LEN (4), MAX_LEN (10)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/game-service/src/main/resources"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ANSWERS_MAX="${ANSWERS_MAX:-5000}"
MIN_LEN="${MIN_LEN:-4}"
MAX_LEN="${MAX_LEN:-10}"

HUNSPELL_URL="https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json"
FREQ_URL="https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt"

echo "→ Téléchargement des sources…"
curl -fsSL "$HUNSPELL_URL" -o "$TMP/hunspell.json"
curl -fsSL "$FREQ_URL"     -o "$TMP/freq.txt"

echo "→ Génération des listes (longueur $MIN_LEN-$MAX_LEN, mots-mystères ≤ $ANSWERS_MAX)…"
ANSWERS_MAX="$ANSWERS_MAX" MIN_LEN="$MIN_LEN" MAX_LEN="$MAX_LEN" \
TMP="$TMP" OUT="$OUT" python3 - <<'PY'
import json, os, re, unicodedata

tmp, out = os.environ["TMP"], os.environ["OUT"]
min_len, max_len = int(os.environ["MIN_LEN"]), int(os.environ["MAX_LEN"])
answers_max = int(os.environ["ANSWERS_MAX"])

def norm(w):
    w = w.strip().lower().replace("œ", "oe").replace("æ", "ae")
    w = unicodedata.normalize("NFD", w)
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return w

def keep(w):
    return re.fullmatch(r"[a-z]+", w) is not None and min_len <= len(w) <= max_len

# 1) Tous les mots valides (Hunspell)
valid = {n for w in json.load(open(tmp + "/hunspell.json")) if keep(n := norm(w))}

# 2) Mots-mystères : fréquence décroissante (OpenSubtitles) ∩ vrais mots
answers, seen = [], set()
for line in open(tmp + "/freq.txt", encoding="utf-8"):
    parts = line.split()
    if not parts:
        continue
    n = norm(parts[0])
    if keep(n) and n in valid and n not in seen:
        seen.add(n)
        answers.append(n)
        if len(answers) >= answers_max:
            break

with open(out + "/mots-valides.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(sorted(valid)) + "\n")
with open(out + "/dictionnaire.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(sorted(answers)) + "\n")

print(f"   mots-valides.txt : {len(valid)} mots")
print(f"   dictionnaire.txt : {len(answers)} mots-mystères")
PY

echo "✓ Terminé. Fichiers écrits dans $OUT"
