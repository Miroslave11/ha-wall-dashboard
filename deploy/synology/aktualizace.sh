#!/bin/sh
# Automatická aktualizace HA Wall Dashboardu na Synology.
# Stáhne nejnovější image z GitHubu (ghcr.io) a když je nový, restartuje kontejner.
# Spouštět jako root z Plánovače úloh DSM (návod: NAVOD.md), např. každou noc:
#   sh /volume1/docker/ha-wall-dashboard/aktualizace.sh
# Tablet se po aktualizaci obnoví sám do 10 minut (kontroluje /version.txt).

set -u
cd "$(dirname "$0")" || exit 1
# Plánovač úloh má okleštěnou PATH, docker na Synology je v /usr/local/bin
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

LOG=aktualizace.log
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# Container Manager (DSM 7.2+) má "docker compose", starší Docker balíček "docker-compose"
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  log "CHYBA: nenalezen docker compose ani docker-compose"
  exit 1
fi

if [ ! -f config.local.json ]; then
  log "CHYBA: chybí config.local.json vedle docker-compose.yml"
  exit 1
fi

running_image() {
  docker inspect --format '{{.Image}}' ha-wall-dashboard 2>/dev/null
}

before=$(running_image)
if ! $COMPOSE pull --quiet >> "$LOG" 2>&1; then
  log "CHYBA: stažení image se nepovedlo (internet, ghcr.io?) – běží dál stávající verze"
  exit 1
fi
$COMPOSE up -d >> "$LOG" 2>&1
after=$(running_image)

if [ "$before" != "$after" ]; then
  version=$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' ha-wall-dashboard 2>/dev/null)
  log "Aktualizováno na verzi ${version:-?}"
  # staré verze image smazat, ať nezabírají místo
  docker image prune -f >> "$LOG" 2>&1
else
  log "Bez změny (nejnovější verze už běží)"
fi

# log udržovat krátký
tail -n 300 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
