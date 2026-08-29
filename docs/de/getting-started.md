---
id: getting-started
title: Erste Schritte
language: de
---

# Erste Schritte

*maptoy* kann XYZ-Map-Sets speichern und über den Leaflet-Renderer anzeigen. Startet
der Server mit einer leeren `map_sets`-Tabelle, legt er automatisch ein
**OpenTopoMap**-Map-Set an. Diese Vorgabe benötigt keine Zugangsdaten, enthält die
CC-BY-SA-Attribution von OpenTopoMap sowie die Attribution der
OpenStreetMap-Mitwirkenden und verlinkt die Informationsseite des Providers.
Bestehende Map Sets bleiben unverändert. Löschst du alle Map Sets, wird OpenTopoMap
beim nächsten Serverstart erneut angelegt.

Unter **Map Sets** kannst du Quellen prüfen, bearbeiten, duplizieren, löschen oder
neu anlegen und sie anschließend unter **Map** auswählen. Prüfe vor einer Nutzung
der Vorgabe über kleinere Erkundungsabrufe hinaus die verlinkten
Providerinformationen. Provider-URLs bleiben serverseitig; der Browser lädt Tiles
über relative *maptoy*-API-URLs.

## Docker-Datenverzeichnis

Kopiere `.env.example` nach `.env`, trage mit `MAPTOY_DATA_DIR` ein
Hostverzeichnis ein und lege es vor dem Compose-Start an. Die Vorgabe verwendet:

```sh
cp .env.example .env
mkdir -p .data/logs/api .data/logs/provider
docker compose up --build
```

Compose bind-mountet dieses Hostverzeichnis im Container nach `/data`. Darin liegt
die SQLite-Datenbank als `maptoy.sqlite`; spätere Tile-Archive und Exporte verwenden
dasselbe vom Host kontrollierte Verzeichnis. *maptoy* verwendet für persistente
Anwendungsdaten kein von Docker verwaltetes benanntes oder anonymes Volume. Das
Verzeichnis muss für UID `1000`, den nicht privilegierten Containerbenutzer,
beschreibbar sein.

SQLite-Schema-Version 4 ist die produktive Baseline von *maptoy*. Neue Installationen
legen zuerst diese Baseline an und wenden danach jede nummerierte Migration an,
einschließlich der Revisionsherkunft aus Version 5. Die Versionen 1 bis 3 waren
ausschließlich Entwicklungsschemas und sind keine unterstützten Upgradequellen;
produktive Datenbanken vor Version 4 existieren nicht.

`MAPTOY_MAX_TILE_BYTES` begrenzt sowohl Providerantworten als auch den Raw-Body der
Tile-Seeding-Route. Das Uploadlimit gilt routenspezifisch und verkleinert nicht die
zulässige Größe von Map-Set-JSON oder anderen API-Requests.

## Traffic-Logs

maptoy protokolliert Client/API-Traffic und Backend/Tile-Provider-Traffic getrennt
als JSON Lines. Compose bind-mountet die mit `MAPTOY_API_TRAFFIC_LOG_DIR` und
`MAPTOY_PROVIDER_TRAFFIC_LOG_DIR` konfigurierten Verzeichnisse. Standardmäßig
liegen sie unterhalb von `MAPTOY_DATA_DIR`; beide dürfen aber auf beliebige andere
Hostpfade zeigen. Die aktiven Dateien heißen `api-traffic.log` und
`provider-traffic.log`.

`MAPTOY_TRAFFIC_LOG_MAX_BYTES` begrenzt die Größe jeder Datei vor der Rotation.
`MAPTOY_TRAFFIC_LOG_MAX_FILES` bestimmt je Traffic-Typ die Gesamtzahl der
aufbewahrten Dateien einschließlich der aktiven Datei. Authentifizierungsheader,
Cookies und übliche geheime Query-Parameter werden redigiert. Die
Logverzeichnisse müssen vor dem Compose-Start existieren und für UID `1000`
beschreibbar sein. Aufrufe des Liveness-Endpunkts `api/health` werden unabhängig
von ihrer Herkunft nicht im API-Traffic-Log erfasst; Docker prüft den Endpunkt
weiterhin und stellt den Containerzustand bereit.

Der Readiness-Endpunkt prüft die Datenbank sowie fortlaufend die Schreibbarkeit des
Anwendungsdatenverzeichnisses und beider Traffic-Log-Verzeichnisse. Außerhalb von
`MAPTOY_DATA_DIR` konfigurierte Traffic-Logs gehören nicht zum Backup der fachlichen
Anwendungsdaten und müssen nur separat gesichert werden, wenn diese begrenzten
Betriebsprotokolle erhalten bleiben sollen.

## Entwicklungsbefehle

Führe in der Entwicklungs-Shell einmal `pnpm install` aus. `pnpm start` baut und
startet die Anwendung; `pnpm check` führt Formatierung, Linting, Builds, Typprüfung
und Tests aus.

Der Server verwendet standardmäßig Port `4004`. Ein Reverse Proxy kann *maptoy*
unter einem Unterpfad veröffentlichen, wenn er diesen Präfix vor dem Weiterleiten
entfernt. Anwendungsrouten, Assets, die generierte HTML-Basis und API-Aufrufe bleiben
relativ zur öffentlichen Einstiegs-URL.

Unter [Map Sets](docs/de/map-sets) findest du Details zu Konfiguration,
Secret-Referenzen, Provider-Tests und Netzwerksicherheit.
