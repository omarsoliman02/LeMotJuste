# Déploiement production (VM + Caddy)

L'app tourne en public sur **https://lemotjuste.duckdns.org** (DNS DuckDNS → IP
publique de la VM). Caddy est le seul point d'entrée Internet ; tout le reste
(gateway, services, Postgres) n'écoute qu'en local.

## Principe

- **Caddy** (installé en paquet système, pas en conteneur) sert `frontend/`
  en statique directement depuis le repo, et reverse-proxy `/api/**` vers la
  gateway du cluster **Kubernetes** (NodePort `192.168.49.2:30080`, cf.
  [`../docs/kubernetes-guide.md`](../docs/kubernetes-guide.md)). Même origine que le
  frontend → pas besoin de CORS entre navigateur et gateway.
- Le backend (Postgres + les 3 services + la gateway) tourne sur le cluster
  **Minikube** de la VM. Minikube ne redémarre pas seul au reboot : relancer
  `minikube start` si le site renvoie 502. Alternative : la stack **Docker Compose**
  (`docker compose up -d`, `restart: unless-stopped`) — pour l'utiliser comme backend,
  remettre `reverse_proxy localhost:8080` dans le `Caddyfile`.
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
  Attention : c'est **instantané en prod** — ne pousser le frontend qu'avec un backend
  compatible, et bumper ensemble le `?v=` d'`index.html` et le `CACHE` de `sw.js`.
- Backend (les 4 services Spring) : reconstruire les images dans le démon Docker de
  Minikube (`eval $(minikube docker-env) && docker compose build`), puis
  `minikube kubectl -- apply -k k8s/` et, si les images seules ont changé,
  `minikube kubectl -- rollout restart deployment -n lemotjuste`. Les déploiements
  sont en 2 réplicas avec rolling update sans coupure. (En backend Docker Compose :
  `docker compose up --build -d`.)
- **Avant toute migration de schéma** (ddl-auto: update) : sauvegarder les 3 bases —
  `minikube kubectl -- exec -n lemotjuste deploy/postgres -- pg_dump -U motus --clean --if-exists <db>`
  pour `motus_players`, `motus_games`, `motus_scores` (dumps existants dans
  `/home/ubuntu/lemotjuste-backups/`).
- **Mémoire Minikube** : le conteneur est limité à 12 Go (`docker update --memory=12g
  --memory-swap=12g minikube`, persistant au stop/start). En dessous (~6 Go), les
  8 pods JVM + le monitoring font s'effondrer le nœud en page-cache thrash (iowait,
  apiserver en timeout, gateway en 500). Après un éventuel `minikube delete`,
  la valeur est reprise de `minikube config` (memory 12288).
- Si `deploy/Caddyfile` change : `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
  && sudo systemctl reload caddy`.

## Notes

- La VM utilise aussi Tailscale — ne pas toucher à `iptables`/aux règles
  `ts-input`/`ts-forward` gérées par Tailscale.
- Le domaine DuckDNS a un TTL court (60s) et ses nameservers répondent parfois
  `SERVFAIL` en round-robin ; c'est normal, Caddy retente automatiquement le
  renouvellement de certificat en cas d'échec ponctuel.
