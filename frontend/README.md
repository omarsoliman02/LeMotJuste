# frontend — À FAIRE

Page statique de démo (HTML + JS vanilla) qui appelle **uniquement la gateway**
(`http://localhost:8080`) pour :

- créer / sélectionner un joueur (`/api/players`) ;
- démarrer une partie (`/api/games`) ;
- soumettre des propositions et afficher la grille Motus (lettres bien / mal placées) ;
- afficher l'historique et le classement (`/api/scores`).

À implémenter dans un prompt séparé, une fois game-service et score-service prêts.
