# Déploiement production (VM + Caddy)

L'app tourne en public sur **https://lemotjuste.duckdns.org** (DNS DuckDNS → IP
publique de la VM). Caddy est le seul point d'entrée Internet ; tout le reste
(gateway, services, Postgres) n'écoute qu'en local.

## Principe

- **Caddy** (installé en paquet système, pas en conteneur) sert `frontend/`
  en statique directement depuis le repo, et reverse-proxy `/api/**` vers la
  gateway (`localhost:8080`). Même origine que le frontend → pas besoin de CORS
  entre navigateur et gateway.
- **`docker compose up --build -d`** (voir racine du repo) fait tourner
  Postgres + les 3 services + la gateway, avec `restart: unless-stopped` pour
  survivre à un reboot de la VM.
- Le pare-feu (iptables / règles Oracle Cloud) n'autorise que 22 (SSH), 80 et
  443 en entrée : les ports 8080–8083 des conteneurs ne sont **pas** joignables
  depuis Internet même si `docker-compose.yml` les publie sur l'hôte (utile
  seulement pour du debug en local/SSH/Tailscale).

## Installation (déjà faite sur la VM actuelle, gardé ici pour mémoire)

```bash
# Runtime
sudo apt-get install -y docker.io docker-compose-v2 acl
sudo usermod -aG docker $USER   # puis se reconnecter

# App
cd /home/ubuntu/LeMotJuste
docker compose up --build -d

# Caddy doit pouvoir lire frontend/ alors que $HOME est en 750 (VM partagée
# avec d'autres projets) : on donne un accès ciblé au seul user `caddy`,
# plutôt que d'ouvrir tout $HOME.
sudo setfacl -m u:caddy:x /home/ubuntu
sudo setfacl -m u:caddy:x /home/ubuntu/LeMotJuste
sudo setfacl -R -m u:caddy:rX /home/ubuntu/LeMotJuste/frontend
sudo setfacl -d -m u:caddy:rX /home/ubuntu/LeMotJuste/frontend   # ACL par défaut pour les futurs fichiers

# Config Caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Mettre à jour après un `git pull`

- Frontend (HTML/CSS/JS) : rien à faire, Caddy le sert en direct depuis le repo.
- Backend (les 4 services Spring) : `docker compose up --build -d` pour
  reconstruire les images modifiées.
- Si `deploy/Caddyfile` change : `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
  && sudo systemctl reload caddy`.

## Notes

- La VM utilise aussi Tailscale — ne pas toucher à `iptables`/aux règles
  `ts-input`/`ts-forward` gérées par Tailscale.
- Le domaine DuckDNS a un TTL court (60s) et ses nameservers répondent parfois
  `SERVFAIL` en round-robin ; c'est normal, Caddy retente automatiquement le
  renouvellement de certificat en cas d'échec ponctuel.
