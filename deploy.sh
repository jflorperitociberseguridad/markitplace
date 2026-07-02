#!/usr/bin/env bash
#
# deploy.sh — Despliegue de MarkItPlace en un solo comando
# Uso:
#   ./deploy.sh "mensaje del commit"
#   ./deploy.sh          (usa un mensaje con fecha automática)
#
# Hace: build  ->  reinicio PM2  ->  commit  ->  push a GitHub
# Se detiene si el build falla (no reinicia ni publica algo roto).

set -e  # aborta ante cualquier error

# ─── Configuración ───────────────────────────────────────────────
PROJECT_DIR="/var/www/markitplace"
PM2_NAME="markitplace"

# Mensaje de commit: primer argumento, o fecha automática si no se pasa
COMMIT_MSG="${1:-Actualización $(date '+%Y-%m-%d %H:%M')}"

# ─── Colores para los mensajes ───────────────────────────────────
AZUL='\033[0;34m'; VERDE='\033[0;32m'; ROJO='\033[0;31m'; NC='\033[0m'
paso() { echo -e "${AZUL}==> $1${NC}"; }
ok()   { echo -e "${VERDE}✓ $1${NC}"; }
err()  { echo -e "${ROJO}✗ $1${NC}"; }

cd "$PROJECT_DIR" || { err "No se encuentra $PROJECT_DIR"; exit 1; }

# ─── 1) Build ────────────────────────────────────────────────────
paso "Compilando el frontend (npm run build)..."
if npm run build; then
  ok "Build completado"
else
  err "El build ha fallado. No se reinicia ni se publica nada."
  exit 1
fi

# ─── 2) Reinicio PM2 ─────────────────────────────────────────────
paso "Reiniciando el proceso PM2 '$PM2_NAME'..."
pm2 restart "$PM2_NAME"
ok "Proceso reiniciado"

# ─── 3) Commit + push a GitHub ───────────────────────────────────
paso "Publicando cambios en GitHub..."
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$COMMIT_MSG"
  git push
  ok "Cambios publicados: \"$COMMIT_MSG\""
else
  echo "  (No hay cambios que publicar en git)"
fi

echo ""
ok "Despliegue terminado."
