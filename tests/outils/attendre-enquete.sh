#!/bin/bash
# Attend le résultat du robot pour la dernière enquête envoyée, puis le copie.
# Usage (depuis le dépôt, branche labo, juste après le push de tests/enquete.json) :
#   bash tests/outils/attendre-enquete.sh            -> copie dans /home/claude/enquete/
#   bash tests/outils/attendre-enquete.sh DOSSIER
# Le résultat est dans la branche « essais », À LA RACINE : enquete.json, vignettes.json, journal-enquete.txt
# (pas dans resultats/). Le robot écrit en 1re ligne de LISEZMOI.txt « commit testé : <sha> ».
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
OUT=${1:-/home/claude/enquete}; mkdir -p "$OUT"
ATTENDU=$(git rev-parse HEAD)
TESTE=""
for i in $(seq 1 24); do
  git fetch -q --depth 1 origin essais:refs/remotes/origin/essais 2>/dev/null
  TESTE=$(git show origin/essais:LISEZMOI.txt 2>/dev/null | sed -n 's/^commit testé : //p' | head -1)
  if [ "$TESTE" = "$ATTENDU" ]; then
    git show origin/essais:enquete.json > "$OUT/enquete.json"
    git show origin/essais:vignettes.json > "$OUT/vignettes.json" 2>/dev/null || echo "{}" > "$OUT/vignettes.json"
    git show origin/essais:journal-enquete.txt 2>/dev/null | grep -E "^recherche|^terminé|code de sortie" | cut -c1-200
    echo "PRÊT : $OUT/enquete.json et $OUT/vignettes.json"
    exit 0
  fi
  sleep 25
done
echo "PAS PRÊT après 10 minutes (attendu : ${ATTENDU:0:7}, dernier testé : ${TESTE:0:7})."
echo "Ne pas relancer en boucle : le dire à Steve et continuer avec les recherches web."
exit 1
