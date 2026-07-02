# Guide Kubernetes — « Le Mot Juste »

Ce guide explique comment déployer toute la stack sur **MiniKube** et comment
dérouler une démo complète devant l'enseignant. Les manifests eux-mêmes sont dans
[`k8s/`](../k8s/) (détails techniques fichier par fichier dans
[`k8s/README.md`](../k8s/README.md)) ; ce document est le mode d'emploi + les schémas.

---

## 1. Pourquoi Kubernetes ici

Docker Compose (`docker compose up`) suffit pour développer en local. Kubernetes est
utilisé en plus pour montrer, sur le même projet, ce que gagne une architecture
microservices en orchestration : redémarrage automatique d'un service qui plante
(self-healing), montée en charge indépendante d'un service (`kubectl scale`), et
configuration externalisée (`ConfigMap` / `Secret`) au lieu de variables codées en dur.
Rien ne change dans le code des services : ce sont les **mêmes images Docker** que
pour `docker compose`.

---

## 2. Vue d'ensemble du cluster

```
                                MiniKube (1 nœud)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  Namespace : lemotjuste                                               │
 │                                                                        │
 │   Secret            ConfigMap           ConfigMap                     │
 │  postgres-secret     postgres-init        app-config                  │
 │  (user/password)   (crée les 3 bases)  (URLs Feign + routage)         │
 │        │                  │                    │                      │
 │        ▼                  ▼                    ▼                      │
 │  ┌───────────────────────────────────┐   ┌──────────────────────┐     │
 │  │ Pod postgres                       │   │ Pod player-service    │     │
 │  │  (Deployment, 1 replica)           │◀──┤ (Deployment)          │     │
 │  │  PVC 1Gi ── /var/lib/postgresql    │   └──────────────────────┘     │
 │  └───────────────────────────────────┘            ▲                   │
 │        ▲              ▲              ▲             │ Feign             │
 │        │ JPA          │ JPA          │ JPA   ┌──────────────────────┐  │
 │        │              │              │       │ Pod game-service      │  │
 │        │              │              └───────┤ (Deployment)          │  │
 │        │              │                      └──────────┬───────────┘  │
 │        │              │                                 │ Feign         │
 │        │        ┌─────┴────────────┐          ┌─────────▼───────────┐  │
 │        │        │ Pod score-service│◀─────────┤ Service score-service│  │
 │        │        │ (Deployment)     │          └──────────────────────┘  │
 │        │        └──────────────────┘                                   │
 │        │                                                                │
 │  Service postgres (ClusterIP) — DNS interne « postgres »                │
 │                                                                          │
 │  ┌────────────────────────────────────────────────────────────────┐    │
 │  │ Pod gateway (Deployment)                                        │    │
 │  │  routes /api/players, /api/games, /api/scores                   │    │
 │  └───────────────────────────┬────────────────────────────────────┘    │
 │                               │                                         │
 │            Service gateway : NodePort 30080  (+ Ingress optionnel)      │
 └───────────────────────────────┼─────────────────────────────────────────┘
                                  │
                       minikube service gateway --url
                                  │
                         ┌────────▼─────────┐
                         │  Frontend (hors   │
                         │  cluster) : ./serve.sh
                         │  → http://localhost:5500
                         └───────────────────┘
```

Chaque `Deployment` (sauf `postgres` et `gateway`) démarre avec un **`initContainer`**
`wait-for-postgres` qui bloque tant que `postgres:5432` ne répond pas — évite les
`CrashLoopBackOff` au premier démarrage. Les sondes `readiness`/`liveness` sont de
simples vérifications TCP sur le port du service.

---

## 3. Cheminement d'une requête (exemple : proposer un mot)

```
Navigateur                 gateway (30080)        game-service        player-service   score-service      postgres
    │  POST /api/games/1/guess │                       │                    │                │              │
    ├──────────────────────────▶ route Path=/api/games/**                   │                │              │
    │                          ├──────────────────────▶│                    │                │              │
    │                          │                       │  (partie déjà      │                │              │
    │                          │                       │   chargée en base) │                │              │
    │                          │                       ├───────────────────────────────────────────────────▶│ SELECT game
    │                          │                       │                    │                │              │
    │                          │                       │  calcul lettre par lettre (2 passes, en mémoire)     │
    │                          │                       │                    │                │              │
    │                          │                       │  si partie terminée : Feign          │              │
    │                          │                       ├───────────────────────────────────▶│ POST /api/scores
    │                          │                       │                    │                ├─────────────▶│ INSERT score
    │                          │◀──────────────────────┤ GuessResponse (letters, status, ...) │              │
    │◀─────────────────────────┤                       │                    │                │              │
```

Le DNS interne du cluster résout `postgres`, `player-service`, `score-service` et
`game-service` directement par leur nom de `Service` Kubernetes — c'est ce que
contient la `ConfigMap` `app-config` (URLs `http://<service>:<port>`).

---

## 4. Déploiement pas à pas

### 4.1 Prérequis

```bash
minikube start
kubectl config current-context   # doit afficher "minikube"
```

### 4.2 Construire les images dans le démon Docker de MiniKube

MiniKube a son propre démon Docker, séparé de celui de la machine hôte : il faut lui
donner les images (pas de registry à configurer pour la démo).

```bash
eval $(minikube docker-env)      # bascule le terminal vers le démon Docker de MiniKube
docker compose build             # construit les 4 images lemotjuste-*
eval $(minikube docker-env -u)   # revient au démon local (optionnel)
```

### 4.3 Déployer

```bash
kubectl apply -k k8s/
kubectl get pods -n lemotjuste -w
```

Attendre que tous les pods passent à `Running` / `1/1 Ready` (Ctrl+C pour sortir du
`-w`). Ordre attendu : `postgres` d'abord (les autres attendent via l'`initContainer`),
puis `player-service`/`score-service`, puis `game-service`, puis `gateway`.

### 4.4 Accéder à l'application

```bash
minikube service gateway -n lemotjuste --url
# ex. http://192.168.49.2:30080
```

```bash
GW=$(minikube service gateway -n lemotjuste --url)
curl -s -X POST $GW/api/players -H 'Content-Type: application/json' -d '{"username":"demo"}'
curl -s -X POST $GW/api/games   -H 'Content-Type: application/json' -d '{"playerId":1,"wordLength":6}'
```

Frontend (reste hors cluster, page statique) :

```bash
./serve.sh
# puis ouvrir http://localhost:5500/?api=<url gateway ci-dessus>
```

### 4.5 Ingress (optionnel, pour une URL propre type `lemotjuste.local`)

```bash
minikube addons enable ingress
kubectl apply -f k8s/ingress.yaml
echo "$(minikube ip)  lemotjuste.local" | sudo tee -a /etc/hosts
# puis http://lemotjuste.local/?api=http://lemotjuste.local
```

---

## 5. Script de démo pour le prof (≈ 5 minutes)

1. **Montrer le cluster qui tourne** :
   ```bash
   kubectl get pods -n lemotjuste
   kubectl get svc -n lemotjuste
   ```
2. **Jouer une partie en direct** via le frontend (`./serve.sh`, `?api=<url gateway>`) :
   créer un joueur, choisir une **taille de grille**, jouer jusqu'à la fin, ouvrir **Stats**
   puis la **vue Admin** (mot de passe `motus-admin`) pour montrer le classement et les
   parties/scores agrégés côté cluster, filtrables par joueur et par période.
3. **Montrer le self-healing** : tuer un pod et regarder Kubernetes le recréer seul.
   ```bash
   kubectl delete pod -n lemotjuste -l app=game-service
   kubectl get pods -n lemotjuste -w    # un nouveau pod apparaît en quelques secondes
   ```
   Rejouer un coup juste après pour montrer que l'API répond de nouveau (le
   `Service` a redirigé le trafic vers le nouveau pod automatiquement).
4. **Montrer la scalabilité indépendante d'un service** :
   ```bash
   kubectl scale deployment game-service -n lemotjuste --replicas=3
   kubectl get pods -n lemotjuste -l app=game-service
   ```
5. **Logs en direct** (utile si une question porte sur le debug) :
   ```bash
   kubectl logs -n lemotjuste -l app=game-service -f
   ```
6. **Nettoyage en fin de démo** :
   ```bash
   kubectl delete -k k8s/
   minikube stop
   ```

---

## 6. Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| Pod en `ImagePullBackOff` | Image construite dans le mauvais démon Docker | Refaire `eval $(minikube docker-env)` puis `docker compose build` |
| Pod en `Init:0/1` qui ne bouge plus | Postgres pas encore prêt | `kubectl logs -n lemotjuste <pod> -c wait-for-postgres` ; attendre le readiness de `postgres` |
| `curl` renvoie `Connection refused` sur l'URL `minikube service` | Gateway pas encore `Ready` | `kubectl get pods -n lemotjuste` puis `kubectl describe pod <gateway-pod> -n lemotjuste` |
| Frontend affiche « Service injoignable » | Mauvais `?api=` ou CORS | Vérifier l'URL renvoyée par `minikube service gateway --url` ; le CORS global est déjà ouvert (`allowed-origins: "*"`) côté gateway |
| Valider les manifests sans cluster | — | `kubectl kustomize k8s/` (rendu) ou `kubectl apply -k k8s/ --dry-run=client` |

---

## 7. Nettoyage complet

```bash
kubectl delete -k k8s/                              # supprime Deployments/Services/ConfigMaps/Secret
kubectl delete pvc postgres-pvc -n lemotjuste        # si on veut aussi effacer les données Postgres
minikube stop                                        # ou `minikube delete` pour repartir de zéro
```
