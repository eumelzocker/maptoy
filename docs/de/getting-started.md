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

Kopiere `.env.example` nach `.env`, trage mit `MAPTOY_STORAGE_DATA_DIR` ein
Hostverzeichnis ein und lege es vor dem Compose-Start an. Die Vorgabe verwendet:

```sh
cp .env.example .env
mkdir -p .data/logs
docker compose up --build
```

Laufzeitvariablen folgen `MAPTOY_<DOMÄNE>_<EIGENSCHAFT>`. Die aktuellen Domänen
sind `SERVER`, `STORAGE`, `LOGGING`, `TILES`, `LAYERS`, `JOBS`, `DOWNLOADS` und
`PHOTOS`; bei
Provider-Secrets bildet der Providername die Domäne. Frühere Variablennamen werden
nicht unterstützt.

Für den Fotokatalog verweist `MAPTOY_PHOTOS_DIR` auf ein vorhandenes
Hostverzeichnis. Die normale Compose-Datei bindet es automatisch read-only ein;
eine zusätzliche Compose-Datei oder ein besonderer Startbefehl ist nicht nötig.

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

`MAPTOY_TILES_MAX_BYTES` begrenzt sowohl Providerantworten als auch den Raw-Body der
Tile-Seeding-Route. Das Uploadlimit gilt routenspezifisch und verkleinert nicht die
zulässige Größe von Map-Set-JSON oder anderen API-Requests.

Abgeschlossene, fehlgeschlagene und abgebrochene Jobs bleiben standardmäßig 30 Tage
erhalten. `MAPTOY_JOBS_RETENTION_DAYS` konfiguriert diese Frist,
`MAPTOY_JOBS_ERROR_HISTORY_LIMIT` die begrenzte Diagnosehistorie je Job. Die
Bereinigung läuft beim Start und stündlich; ein vertrauenswürdiger Betreiber kann
dieselbe Regel mit `POST api/jobs/cleanup` auslösen. Wartende, laufende und pausierte
Jobs werden nie durch die Aufbewahrungsregel entfernt.

Die Aufnahmeprüfung für Batch-Downloads warnt standardmäßig ab 10.000 ausgewählten
Tiles und blockiert oberhalb von 100.000. Diese Schwellen konfigurieren
`MAPTOY_DOWNLOADS_WARNING_TILE_COUNT` und `MAPTOY_DOWNLOADS_MAX_TILE_COUNT`;
beide sind auf höchstens 1.000.000 Tiles begrenzt. Zusätzlich gelten die im Map Set
konfigurierten Request-, Retry-, Tages- und Speichergrenzen.

## Traffic-Logs

*maptoy* protokolliert Client/API-Traffic und Backend/Tile-Provider-Traffic getrennt
als JSON Lines. Compose bind-mountet das mit `MAPTOY_LOGGING_DIR` konfigurierte
gemeinsame Verzeichnis. Standardmäßig liegt es unterhalb von
`MAPTOY_STORAGE_DATA_DIR`, darf aber auf einen anderen Hostpfad zeigen. *maptoy*
legt darin bei Bedarf die Unterverzeichnisse `api` und `provider` an. Die aktiven
Dateien heißen `api-traffic.log` und `provider-traffic.log`.

`MAPTOY_LOGGING_TRAFFIC_MAX_BYTES` begrenzt die Größe jeder Datei vor der Rotation.
`MAPTOY_LOGGING_TRAFFIC_MAX_FILES` bestimmt je Traffic-Typ die Gesamtzahl der
aufbewahrten Dateien einschließlich der aktiven Datei. Authentifizierungsheader,
Cookies und übliche geheime Query-Parameter werden redigiert. Das gemeinsame
Logverzeichnis muss vor dem Compose-Start existieren und für UID `1000`
beschreibbar sein. Aufrufe des Liveness-Endpunkts `api/health` werden unabhängig
von ihrer Herkunft nicht im API-Traffic-Log erfasst; Docker prüft den Endpunkt
weiterhin und stellt den Containerzustand bereit.

Der Readiness-Endpunkt prüft die Datenbank sowie fortlaufend die Schreibbarkeit des
Anwendungsdatenverzeichnisses und beider automatisch angelegten
Traffic-Log-Unterverzeichnisse. Außerhalb von `MAPTOY_STORAGE_DATA_DIR`
konfigurierte Traffic-Logs gehören nicht zum Backup der fachlichen Anwendungsdaten
und müssen nur separat gesichert werden, wenn diese begrenzten Betriebsprotokolle
erhalten bleiben sollen.

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
