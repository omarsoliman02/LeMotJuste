// Applique thème et contraste avant le premier rendu (pas de flash clair/sombre).
// Fichier séparé (plutôt qu'un <script> inline) pour permettre une CSP stricte en prod :
// script-src 'self' — aucun script inline autorisé.
document.documentElement.dataset.theme =
  localStorage.getItem("lemotjuste-theme") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
if (localStorage.getItem("lemotjuste-contrast") === "1") {
  document.documentElement.dataset.contrast = "high";
}
