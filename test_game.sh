USER="testeur_$RANDOM"

PID=$(curl -s -X POST localhost:8080/api/players -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\"}" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')

echo "joueur=$USER  playerId=$PID"

RESP=$(curl -s -X POST localhost:8080/api/games -H 'Content-Type: application/json' \
  -d "{\"playerId\":$PID}")

GID=$(echo "$RESP" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
LEN=$(echo "$RESP" | sed -n 's/.*"wordLength":\([0-9]*\).*/\1/p')

echo "gameId=$GID  longueur=$LEN"

for w in $(awk -v L=$LEN 'length($0)==L' game-service/src/main/resources/dictionnaire.txt); do
  OUT=$(curl -s -X POST localhost:8080/api/games/$GID/guess \
    -H 'Content-Type: application/json' -d "{\"word\":\"$w\"}")

  echo "  $w -> $(echo "$OUT" | sed -n 's/.*"status":"\([A-Z_]*\)".*/\1/p')"

  echo "$OUT" | grep -q '"status":"IN_PROGRESS"' || break
done

echo "--- scores du joueur ---"
curl -s "localhost:8080/api/scores?playerId=$PID"
echo

echo "--- warning eventuel ---"
docker compose logs game-service | grep "Score non enregistré" || echo "(aucun warning, parfait)"
