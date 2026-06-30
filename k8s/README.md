# Déploiement Kubernetes / MiniKube

Manifests pour déployer « Le Mot Juste » sur un cluster local MiniKube.

## Contenu

| Fichier | Rôle |
|---------|------|
| `namespace.yaml` | namespace `lemotjuste` |
| `postgres-secret.yaml` | `Secret` : identifiants Postgres |
| `postgres-init-configmap.yaml` | `ConfigMap` : crée les 3 bases (motus_players/games/scores) |
| `app-config.yaml` | `ConfigMap` : URLs inter-services (Feign + routage gateway) |
| `postgres.yaml` | `PVC` + `Deployment` + `Service` PostgreSQL |
| `player-service.yaml` / `game-service.yaml` / `score-service.yaml` | `Deployment` + `Service` (ClusterIP) |
| `gateway.yaml` | `Deployment` + `Service` **NodePort 30080** (point d'entrée) |
| `ingress.yaml` | `Ingress` optionnel (`lemotjuste.local`) |
| `kustomization.yaml` | regroupe tout, injecte le namespace, ordonne l'application |

Chaque service attend Postgres via un `initContainer` (`wait-for-postgres`) ; les sondes
`readiness`/`liveness` sont en TCP sur le port du service.

## Prérequis

```bash
minikube start
```

## 1. Construire les images dans le démon Docker de MiniKube

Le plus simple : builder directement dans MiniKube (pas de registry, pas de push) —

```bash
eval $(minikube docker-env)     # cible le démon Docker de MiniKube
docker compose build            # construit les 4 images lemotjuste-*
eval $(minikube docker-env -u)  # (optionnel) revenir au démon local
```

> Alternative si les images sont déjà construites localement :
> `minikube image load lemotjuste-player-service:latest` (idem game/score/gateway).
> Les Deployments utilisent `imagePullPolicy: IfNotPresent` → l'image locale est réutilisée.

## 2. Déployer

```bash
kubectl apply -k k8s/
kubectl get pods -n lemotjuste -w      # attendre que tout soit Running/Ready
```

## 3. Accéder à l'application

```bash
# ouvre la gateway (NodePort) dans le navigateur, ou affiche l'URL :
minikube service gateway -n lemotjuste --url

# test rapide (remplacer <url> par l'URL ci-dessus)
curl -s -X POST <url>/api/players -H 'Content-Type: application/json' -d '{"username":"alice"}'
curl -s -X POST <url>/api/games   -H 'Content-Type: application/json' -d '{"playerId":1}'
```

Pour le **frontend** : lancer `./serve.sh` à la racine et viser la gateway MiniKube via
`http://localhost:5500/?api=<url>`.

### Ingress (optionnel)

```bash
minikube addons enable ingress
kubectl apply -f k8s/ingress.yaml
echo "$(minikube ip)  lemotjuste.local" | sudo tee -a /etc/hosts
# puis http://lemotjuste.local/api/players
```

## Nettoyage

```bash
kubectl delete -k k8s/          # supprime tout le namespace et ses ressources
```

## Notes

- Valider les manifests sans cluster : `kubectl kustomize k8s/` (rendu) ou
  `kubectl apply -k k8s/ --dry-run=client`.
- Postgres utilise un `PersistentVolumeClaim` (1Gi) via la StorageClass par défaut de MiniKube ;
  `kubectl delete -k` ne supprime pas le PVC si on veut conserver les données — le retirer
  manuellement avec `kubectl delete pvc postgres-pvc -n lemotjuste` au besoin.
