---
id: getting-started
title: Erste Schritte
language: de
---

# Erste Schritte

maptoy kann XYZ-Map-Sets speichern und über den Leaflet-Renderer anzeigen. Es ist
absichtlich kein öffentlicher Tile-Provider vorkonfiguriert: Lege unter **Map Sets**
eine Quelle an und wähle sie anschließend unter **Map** aus. Provider-URLs bleiben
serverseitig; der Browser lädt Tiles über relative maptoy-API-URLs.

## Docker-Datenverzeichnis

Kopiere `.env.example` nach `.env`, trage mit `MAPTOY_DATA_DIR` ein
Hostverzeichnis ein und lege es vor dem Compose-Start an. Die Vorgabe verwendet:

```sh
cp .env.example .env
mkdir -p .data
docker compose up --build
```

Compose bind-mountet dieses Hostverzeichnis im Container nach `/data`. Darin liegt
die SQLite-Datenbank als `maptoy.sqlite`; spätere Tile-Archive und Exporte verwenden
dasselbe vom Host kontrollierte Verzeichnis. maptoy verwendet für persistente
Anwendungsdaten kein von Docker verwaltetes benanntes oder anonymes Volume. Das
Verzeichnis muss für UID `1000`, den nicht privilegierten Containerbenutzer,
beschreibbar sein.

## Entwicklungsbefehle

Führe in der Entwicklungs-Shell einmal `pnpm install` aus. `pnpm start` baut und
startet die Anwendung; `pnpm check` führt Formatierung, Linting, Builds, Typprüfung
und Tests aus.

Der Server verwendet standardmäßig Port `4004`. Ein Reverse Proxy kann maptoy
unter einem Unterpfad veröffentlichen, wenn er diesen Präfix vor dem Weiterleiten
entfernt. Anwendungsrouten, Assets, die generierte HTML-Basis und API-Aufrufe bleiben
relativ zur öffentlichen Einstiegs-URL.

Unter [Map Sets](docs/de/map-sets) findest du Details zu Konfiguration,
Secret-Referenzen, Provider-Tests und Netzwerksicherheit.
