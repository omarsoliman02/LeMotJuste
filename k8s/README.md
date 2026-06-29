# k8s — À FAIRE

Manifests Kubernetes pour un déploiement local sur **MiniKube** :

- `Deployment` + `Service` pour postgres, player-service, game-service, score-service, gateway ;
- `ConfigMap` / variables d'environnement (URLs des bases, URIs Feign) ;
- `Secret` pour les identifiants Postgres ;
- éventuellement un `Ingress` exposant la gateway.

À rédiger dans un prompt séparé, une fois les trois services en place.
