#!/bin/bash
# Remet le robot en mode essais après une enquête (sans relancer le robot).
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
if [ -f tests/enquete.json ]; then
  git rm -q tests/enquete.json
  git -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -m "Fin d'enquête : robot remis en mode essais [skip ci]"
  git -c push.negotiate=true push -q origin HEAD:labo 2>&1 | tail -1
  echo "Robot remis en mode essais."
else
  echo "Déjà en mode essais."
fi
