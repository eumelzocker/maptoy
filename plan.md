# Projektplan: maptoy

## 1. Zielbild

`maptoy` wird eine selbst gehostete Docker-Anwendung für den privaten Gebrauch. Sie stellt frei konfigurierbare Kartenquellen in einer Weboberfläche dar, speichert abgerufene Kartenkacheln mit dauerhaft nachvollziehbarer Revisionshistorie, unterstützt kontrollierte Batch-Downloads und erzeugt exportierbare Kartenbilder mit optionaler Projektion und erweiterbaren Zusatzlayern. Eine in die Weboberfläche integrierte, mehrsprachige Dokumentation erklärt Anwendung, API und kartografische Grundlagen unmittelbar in der jeweils installierten Version.

Frontend und Backend werden über denselben HTTP-Port ausgeliefert. Alle maptoy-eigenen URLs sind relativ zur öffentlichen Einstiegs-URL, damit die Anwendung sowohl unter einer Domain-Wurzel als auch unter einem Reverse-Proxy-Unterpfad funktioniert. Externe URLs sind ausschließlich für ausdrücklich konfigurierte Provider und Dokumentationsreferenzen zulässig.

Die Codebasis, technische Bezeichner und Benutzeroberfläche sind englischsprachig. Die integrierte Dokumentation ist auf Englisch vollständig; deutsche, thailändische und optionale weitere Lokalisierungen fallen bei fehlenden Inhalten kontrolliert auf Englisch zurück. Projektplanung und die Zusammenarbeit mit dem KI-Assistenten erfolgen auf Deutsch.

## 2. Annahmen und Leitentscheidungen

- Die erste Version ist eine Single-User-Anwendung ohne Benutzerverwaltung.
- Die Anwendung läuft zunächst als einzelner Container und benötigt keine externen Cloud-Dienste.
- Persistente Daten liegen in einem eingebundenen Datenverzeichnis.
- SQLite verwaltet Metadaten, Konfigurationen und Jobs; Tile-Dateien und Exporte liegen als Dateien im Datenverzeichnis.
- Auswahl und Nutzung einer Kartenquelle erfolgen in Eigenverantwortung des Nutzers. maptoy verlinkt Nutzungsbedingungen und dokumentiert konfigurierbare technische Limits, bewertet oder erzwingt aber nicht, ob Caching, Batch-Abrufe oder Exporte rechtlich beziehungsweise vertraglich zulässig sind.
- Anbieterbedingungen können sich ändern. Der Nutzer muss sie eigenständig prüfen und Map Sets, Limits sowie Nutzung entsprechend anpassen; die mitgelieferte Dokumentation ist keine Rechtsberatung und keine Garantie für Zulässigkeit.
- Eine `Map Set`-Konfiguration beschreibt Kartenquelle, Renderer-Adapter, Darstellung, Cache-Regeln und zugeordnete Layer; echte Server-Secrets werden nur per Environment referenziert und nicht im Klartext in Map Sets gespeichert.
- Die erste Version konzentriert sich auf Raster-Tiles nach dem XYZ-Schema. Vector Tiles und WMTS-Sonderfälle sind mögliche spätere Erweiterungen.
- Die Kartenansicht verwendet eine Frontend-Adapter-Schnittstelle. v1.0 implementiert ausschließlich den Leaflet-/XYZ-Adapter; ein späterer Adapter für die Google Maps JavaScript API und weitere Karten-APIs ist architektonisch vorgesehen, aber ausdrücklich nicht Bestandteil von v1.0.
- Provider- und Renderer-Fähigkeiten wie interaktive Anzeige, Tile-Cache, Batch-Download, Export und Layer-Unterstützung werden getrennt ausgewiesen und nicht für jeden Adapter vorausgesetzt.
- Zusatzlayer verwenden eine allgemeine Plugin-Architektur. Track- und Bildlayer sind die Referenzimplementierungen und verwenden dieselben fachlichen Daten in interaktiver Karte und Bitmapexport.
- v1.0 lädt ausschließlich vertrauenswürdige Layer-Plugins, die beim Build beziehungsweise Deployment registriert werden. Installation oder Upload beliebigen ausführbaren Plugin-Codes über die Weboberfläche ist nicht vorgesehen.
- Das Backend dient gleichzeitig als API, Tile-Proxy und statischer Webserver für das gebaute Frontend.
- Länger laufende Downloads und Exporte werden als persistente Jobs ausgeführt, sodass Status, Fortschritt, Abbruch und Fehler nachvollziehbar sind.
- Die Dokumentationsquellen liegen versioniert im Repository, werden beim Frontend-Build validiert und zusammen mit der Anwendung ausgeliefert. Sie benötigen zur Anzeige keine externe Dokumentationsplattform.
- Englisch ist die obligatorische und vollständige Dokumentationssprache. Jede veröffentlichte Seite besitzt eine stabile sprachunabhängige ID; Deutsch, Thai und optionale weitere Sprachen können seitenweise auf die englische Fassung zurückfallen.

## 3. Umfang

### 3.1 Muss-Funktionen der ersten nutzbaren Version

- Map Sets anlegen, bearbeiten, validieren, duplizieren und löschen
- Rasterkarten im Vue-/Leaflet-Frontend anzeigen
- Tiles über das Backend laden und lokal cachen
- sämtliche inhaltlich unterschiedlichen Tile-Revisionen dauerhaft nachvollziehbar speichern
- aktuelle, historische, zeitbezogene oder als Snapshot benannte Cache-Stände auswählen und vergleichen
- Cache-Abdeckung für ein Gebiet und Zoomstufen sichtbar machen
- Batch-Downloads für Gebiet und Zoomstufen planen, starten, beobachten, pausieren beziehungsweise abbrechen und erneut versuchen
- vertrauenswürdige Layer-Plugins registrieren, konfigurieren und im XYZ-Renderer sowie im Export verwenden
- Track- und Bildlayer als vollständige Referenz-Plugins einschließlich GPS-getaggter Bilder bereitstellen
- Kartenbilder aus Kartenausschnitt, Größe, Projektion und optionalen Plugin-Layern erzeugen
- integrierte, über die Hauptnavigation erreichbare Dokumentation mit vollständiger englischer Fassung, Deutsch, Thai, Fallback, Suche, Sprachwechsel und externen Referenzlinks
- Konfiguration über Environment und `.env` für die Entwicklung
- Persistenz über Docker-Volumes
- Betrieb hinter einem Reverse-Proxy unter `/` oder einem Unterpfad
- Health- und Readiness-Endpunkte für den Containerbetrieb

### 3.2 Bewusst nicht Teil der ersten Version

- Mehrbenutzerbetrieb, Rollen und öffentliche Freigabelinks
- Synchronisation zwischen mehreren maptoy-Instanzen
- Vollwertiges GIS mit Feature-Editing oder räumlicher Datenbank
- Allgemeine Unterstützung aller proprietären Kartenprotokolle
- konkrete Implementierung eines Google-Maps-, Vector-Tile- oder sonstigen alternativen Frontend-Adapters
- Installation nicht vertrauenswürdiger oder zur Laufzeit hochgeladener Plugins über die Weboberfläche
- Native Desktop- oder Mobile-App
- Verteilter Job-Worker oder horizontale Skalierung

## 4. Technische Architektur

```text
Browser
  -> Vue SPA + map-renderer adapter registry
       |-> Leaflet/XYZ adapter (v1)
       |-> future adapters, e.g. Google Maps JavaScript API (not in v1)
       |-> layer-plugin registry
  -> relative requests to the public maptoy entry URL
Node.js HTTP server (one port)
  -> serves Vue SPA including bundled documentation
  -> REST API
  -> tile proxy/cache
  -> job control and export download
       |-> SQLite metadata
       |-> filesystem: tiles, layer assets, temporary files, exports
       |-> configured external tile providers
```

### 4.1 Empfohlener Stack

- Laufzeit: aktuelle Node.js-LTS-Version, im Lockfile und Nix-Flake festgelegt
- Sprache: TypeScript mit strikter Typprüfung
- Monorepo: pnpm Workspaces
- Backend: Fastify mit Schema-Validierung und strukturiertem Logging
- Frontend: Vue 3, Vite, Vue Router, Pinia sowie Leaflet hinter einer maptoy-eigenen Renderer-Adapter-Schnittstelle
- Styling: modernes Pure CSS ohne Utility-CSS-Framework; zentrale Design-Tokens und gemeinsame Basis-/Layoutregeln statt wiederholter Einzelwerte
- Dokumentation: Markdown-basierte Inhalte, beim Build in sichere Vue-kompatible Seiten und einen lokalen Suchindex umgewandelt
- Verträge: gemeinsam genutzte TypeScript-Typen und Laufzeitschemas, zum Beispiel mit TypeBox oder Zod
- API-Referenz: aus den Backend-Schemas erzeugte OpenAPI-Spezifikation, eingebettet in die Dokumentationsoberfläche
- Datenbank: SQLite mit Migrationen über die in Node.js 24 enthaltene `node:sqlite`-API gemäß [ADR 0005](docs/internal/adr/0005-use-node-sqlite-for-metadata.md)
- Bildverarbeitung: `sharp` für Dekodierung, Komposition und PNG/JPEG/WebP-Ausgabe
- Projektionen: `proj4` für Koordinatenberechnungen und die GDAL-CLI für Raster-Reprojektionen; zunächst `EPSG:3857`, `EPSG:4326` und `EPSG:25833`
- Erweiterbarkeit: typisierte SDK-Verträge und Registries für Frontend-Renderer-Adapter und Layer-Plugins
- Qualität: Biome für Formatierung und Linting, TypeScript für Typprüfung, Vitest für Unit-/Integrationstests, Playwright für wenige kritische End-to-End-Tests, Bruno Collection für API-Tests
- Entwicklungsumgebung: Nix Flake und direnv
- Auslieferung: mehrstufiges Dockerfile mit reproduzierbarem Produktions-Build

Der technische Spike ist abgeschlossen. Die Aufgabenverteilung, initialen Exportgrenzen und Messgrundlagen stehen in [ADR 0004](docs/internal/adr/0004-use-gdal-for-raster-reprojection.md).

### 4.2 Monorepo-Struktur

```text
maptoy/
├── apps/
│   ├── server/              # API, Tile-Cache, Jobs, statische Auslieferung
│   └── web/                 # Vue-3-Anwendung und Adapter-/Plugin-Registrierung
├── packages/
│   ├── contracts/           # API-Schemas, DTOs und gemeinsame Typen
│   ├── config/              # Environment-Schema und gemeinsame Defaults
│   ├── map-core/            # Tile-Mathematik, Gebiete, Projektionen
│   ├── map-adapter-sdk/     # Verträge und Tests für Frontend-Renderer-Adapter
│   └── layer-plugin-sdk/    # Manifest, Schemas und Hooks für Zusatzlayer
├── adapters/
│   └── leaflet-xyz/         # einziger in v1 implementierter Kartenadapter
├── plugins/
│   ├── track-layer/         # GPX-/GeoJSON-Referenz-Plugin
│   └── image-layer/         # GPS-/Bounds-Bild-Referenz-Plugin
├── docs/
│   ├── en/                  # vollständige, obligatorische Dokumentation
│   ├── de/                  # deutsche Lokalisierung mit Englisch-Fallback
│   ├── th/                  # thailändische Lokalisierung mit Englisch-Fallback
│   ├── assets/              # gemeinsam verwendete, lokale Bilder und Beispiele
│   └── internal/            # ADRs und nicht in der App veröffentlichte Projektdokumente
├── tests/                   # übergreifende Testdaten und E2E-Tests
│   └── bruno/               # Bruno Collection für API-Testing
├── flake.nix
├── .env.example
├── biome.json
├── pnpm-workspace.yaml
└── Dockerfile
```

Nur tatsächlich gemeinsam verwendeter Code gehört in ein Package. Job-Ausführung, HTTP-Zugriffe und Dateisystemlogik bleiben im Server, um unnötige Abstraktionen zu vermeiden.

### 4.3 Erweiterungsarchitektur

#### Frontend-Renderer-Adapter

Die Vue-Anwendung greift nicht direkt aus fachlichen Komponenten auf Leaflet zu. Ein `MapRendererAdapter` kapselt mindestens Erzeugung und Zerstörung der Karte, Viewport und Zoom, Ereignisse, Basiskarte, Layer-Anbindung, Screenspace-/Geo-Koordinaten sowie verfügbare Fähigkeiten. Ein Adapter-Manifest enthält stabile ID, Version, kompatible SDK-Version, Konfigurationsschema und Capability-Flags.

Der in v1.0 enthaltene Adapter `leaflet-xyz` bildet das bestehende XYZ-, Cache- und Exportmodell vollständig ab. Ein kleiner Fake-Adapter dient ausschließlich Vertragstests und beweist, dass zentrale UI-Komponenten nicht von Leaflet-Klassen abhängen. Für Google Maps wird in v1.0 weder Abhängigkeit noch Loader noch API-Key-Konfiguration ausgeliefert; die dokumentierte Adaptergrenze berücksichtigt jedoch, dass ein späterer Adapter clientseitig laden kann und möglicherweise weder Tile-Cache noch Batch-Download oder Serverexport anbietet.

#### Layer-Plugins

Ein `LayerPlugin` besteht aus einem gemeinsamen Manifest und nach Bedarf aus drei Teilen:

- **Shared:** Plugin-ID und -Version, kompatible SDK-Version, versioniertes Daten- und Konfigurationsschema, Capability-Flags und Migrationsfunktionen
- **Frontend:** Import-/Editor-Komponenten, interaktive Darstellung über die neutrale Kartenadapter-Schnittstelle, Legende und optionale Detailansichten
- **Server:** sichere Datei- und Metadatenverarbeitung, Validierung, Vorschaubilder sowie Rendering-Hook für Kartenexporte

Die Registry wird beim Build aus explizit zugelassenen Paketen erzeugt. Ein Plugin erhält nur den benötigten Kontext statt direkten Zugriff auf Fastify, Pinia, Datenbank oder beliebige Dateipfade. Persistente Layer-Instanzen speichern Plugin-ID, Schema-Version und validierte Konfiguration. Fehlt ein Plugin nach einem Upgrade, bleiben seine Daten erhalten, der Layer wird jedoch deaktiviert und mit einer verständlichen Diagnose angezeigt.

Die Referenz-Plugins definieren die Mindestqualität der Schnittstelle:

- `track-layer`: Import von GPX und GeoJSON, normalisierte Geometrie, Linien-/Punktstil, interaktive Anzeige und Export
- `image-layer`: sichere Bilddekodierung, EXIF-Ausrichtung, optionale GPS-Extraktion, explizite Punktkoordinate oder geografische Bounds, Vorschaubild, Marker-/Popup-Anzeige und Export

Die Plugin-Schnittstelle wird für v1 semantisch versioniert und durch Contract-Tests abgesichert. Eine öffentliche Plugin-Distribution, dynamische Codeinstallation oder langfristige Binärkompatibilitätsgarantie ist damit noch nicht verbunden.

## 5. Fachliches Modell

### 5.1 Map Set

Ein Map Set enthält mindestens:

- stabile ID und frei wählbaren Anzeigenamen
- Typ der Quelle, zunächst `xyz-raster`
- URL-Template mit Platzhaltern wie `{z}`, `{x}`, `{y}` und optional `{s}`
- Referenzen auf Secrets, zum Beispiel `${MAPTOY_OSM_API_KEY}`, aber keine gespeicherten Secret-Werte
- Attribution, Anbieter-/Nutzungsbedingungen-URL, optional eigene Notizen und Zeitpunkt der letzten Nutzerprüfung
- erlaubte minimale und maximale Zoomstufe
- Tile-Größe, Dateiformat und optional Subdomains
- Header wie ein aussagekräftiger User-Agent, soweit vom Anbieter verlangt
- Quellprojektion, standardmäßig Web Mercator (`EPSG:3857`)
- Standardmittelpunkt und Standardzoom
- ID des Frontend-Renderer-Adapters, in v1 ausschließlich `leaflet-xyz`
- effektive Capability-Flags des Quellen-/Renderer-Paars
- Cache-Policy mit maximalem Alter und optionalem Speicherwarn-/Aufnahmelimit
- Download-Policy mit Requests pro Sekunde, Parallelität, Retry-Limit und optionaler täglicher Obergrenze
- optionale Standard-Layer-Instanzen und Darstellungsparameter

Die Anwendung validiert URL-Templates, Wertebereiche und Secret-Referenzen vor dem Speichern. Eine Testfunktion ruft genau ein Tile ab und zeigt Status, Content-Type und Attribution an. Hinweise, Notizen oder ein Prüfdatum zu Nutzungsbedingungen sind rein informativ und werden von maptoy nicht als rechtliche Freigabe interpretiert.

### 5.2 Tile-Revisionen und Cache-Snapshots

Ein Map Set bildet die stabile Grenze einer Kartenquelle. Sobald seine erste Tile-Revision gespeichert wurde, dürfen die für Abruf oder Interpretation der Tile-Bytes relevanten Felder nicht mehr geändert werden: Quelltyp, URL-Template, Header, Subdomains, Tile-Größe, Format und Quellprojektion. Für eine andere Quelle wird das Map Set dupliziert. Metadaten, Startausschnitt, Zoomgrenzen, Capabilities sowie Cache- und Download-Regeln bleiben editierbar. Eine Rotation des Werts einer per Environment referenzierten Secret-Variable ändert die gespeicherte Map-Set-Konfiguration nicht.

Ein **logisches Tile** wird durch Map Set und Koordinate `(z, x, y)` identifiziert. Zu einem logischen Tile können beliebig viele unveränderliche **Tile-Revisionen** gehören. Eine Tile-Revision enthält mindestens:

- stabile Revisions-ID und Bezug zum logischen Tile
- kryptografischen Content-Hash, Dateiformat, Content-Type, Byte-Größe und Dateipfad
- `firstSeenAt`, `lastSeenAt`, `lastValidatedAt` und zeitliche Gültigkeit innerhalb der bekannten Historie
- soweit vorhanden `ETag`, `Last-Modified` und relevante, redigierte Provider-Metadaten
- Status der Inhaltsprüfung und Kennzeichnung als aktuell ausgewählte Revision

Der Content-Hash bezieht sich auf die tatsächlich gespeicherten Bytes. Entspricht eine Validierung weiterhin der aktuell ausgewählten Revision, entsteht weder eine doppelte Datei noch eine neue Revision; stattdessen werden `lastSeenAt` und `lastValidatedAt` aktualisiert. Wechselt der Inhalt, entsteht ein neuer Revisionsdatensatz. War derselbe Hash bereits früher vorhanden, wird die vorhandene Content-Datei wiederverwendet, aber eine neue zeitliche Revision angelegt, damit auch eine Folge wie `A → B → A` vollständig nachvollziehbar bleibt. Alle früheren Revisionen bleiben erhalten.

Empfohlener Dateipfad ohne separates Versionssegment im Verzeichnisbaum:

```text
data/tiles/<map-set-id>/<z>/<x>/<y>.<content-hash>.<ext>
```

Die Datenbank ordnet logische Tiles, sämtliche Revisionen und die jeweils aktuelle Revision zu. Identische Inhalte dürfen dieselbe Datei innerhalb des Map Sets referenzieren. Tile-Dateien werden zunächst temporär geschrieben, geprüft und danach atomar an den hashbasierten Zielort verschoben. Fehlerantworten oder unerwartete Dateitypen werden nicht als gültige Revisionen abgelegt.

Die Aktualisierungsstrategie wird pro Abruf beziehungsweise Job explizit gewählt:

- `auto` – vorhandene Revision verwenden und erst nach Überschreiten des Höchstalters beim Provider validieren
- `force` – unabhängig vom Alter eine Provider-Validierung anfordern
- `cache-only` – ausschließlich vorhandene Daten verwenden und keinen Provider kontaktieren

Bei einer Validierung nutzt das Backend nach Möglichkeit `If-None-Match` oder `If-Modified-Since`. Eine `304`-Antwort aktualisiert nur den Validierungszeitpunkt. Eine erfolgreiche Inhaltsantwort wird vollständig geprüft und gehasht, bevor entschieden wird, ob bereits dieselbe oder eine neue Revision vorliegt. Provider-Rate-Limits, zentral konfigurierte Parallelität und `Retry-After` gelten auch bei erzwungenen Prüfungen.

Ein **Cache-Snapshot** ist eine benannte, unveränderliche Auswahl konkreter Tile-Revisionen für ein Map Set. Snapshots ermöglichen reproduzierbare Anzeige, Exporte und Vergleiche. Ohne Snapshot kann ein Stand als `current` oder zeitbezogen als jeweils jüngste bekannte Revision bis zu einem Zeitpunkt ausgewählt werden.

Historische Tile-Revisionen werden nicht automatisch gelöscht. Speicherwarn- oder Aufnahmelimits dürfen warnen beziehungsweise neue Abrufe blockieren, aber keine Historie stillschweigend bereinigen. Eine Löschung ist nur als ausdrückliche, bestätigte Nutzeraktion zulässig und muss aktuelle Revisionen sowie Snapshot-Referenzen schützen. Eine Content-Datei darf erst entfernt werden, wenn keine Tile-Revision mehr auf ihren Hash verweist. Automatisch bereinigt werden dürfen lediglich eindeutig temporäre, beschädigte oder nach einem abgebrochenen Schreibvorgang nie registrierte Dateien.

Cache-Statistiken unterscheiden mindestens logische Tiles, aktuelle Revisionen, historische Revisionen, Snapshots und gesamten Speicherbedarf. Vergleiche liefern zunächst geänderte, identische, hinzugekommene und fehlende Tiles anhand von Revision und Hash; optionale visuelle Differenzbilder können als Vergleichsjob erzeugt werden.

### 5.3 Gebiete und Download-Jobs

Ein Download-Gebiet besteht in der ersten Version aus einem Rechteck in WGS84. Polygone können später ergänzt werden. Vor dem Start berechnet das Backend die betroffenen Tile-Koordinaten pro Zoomstufe, entfernt Duplikate und erstellt eine Kostenschätzung.

Ein Job speichert:

- Typ (`tile-download`, `map-export`, später weitere Typen)
- Eingabeparameter als validiertes, versioniertes JSON
- Status `queued`, `running`, `paused`, `completed`, `failed` oder `cancelled`
- Gesamtzahl, erledigte, übersprungene und fehlgeschlagene Einheiten
- Erstellungs-, Start-, Aktualisierungs- und Endzeitpunkt
- letzten Fehler und begrenzte Fehlerhistorie
- Referenz auf Ergebnisdateien

Jobs müssen nach einem Prozessneustart konsistent fortsetzbar oder als unterbrochen erkennbar sein. Ein einzelner Tile-Fehler beendet nicht automatisch den gesamten Batch. Retries verwenden exponentielles Backoff und respektieren `Retry-After`.

### 5.4 Layer-Plugins und Layer-Instanzen

Eine Layer-Instanz ist eine persistente Verwendung eines registrierten Plugins und enthält:

- stabile ID, Anzeigename und Plugin-ID
- Plugin- und Schema-Version
- Map-Set-Zuordnung oder Kennzeichnung als wiederverwendbarer Layer
- validierte, pluginabhängige Konfiguration
- Sichtbarkeit, Reihenfolge, Deckkraft und gegebenenfalls zoombasierte Grenzen
- Referenzen auf verwaltete Assets statt frei zusammengesetzter Dateipfade
- Erstellungs-/Änderungszeitpunkt und Migrationsstatus

Assets können über Frontend und API hochgeladen werden. Der Server vergibt eine Asset-ID und einen kontrollierten Speicherort; der ursprüngliche Dateiname bleibt nur als Metadatum erhalten. Uploads durchlaufen Größen-, Inhalts- und Pluginvalidierung sowie gegebenenfalls Bilddekodierung, Hashbildung, EXIF-Verarbeitung und Vorschaubilderzeugung. Die Layer-Instanz referenziert anschließend ausschließlich die Asset-ID. Uploadstatus und Fehler bleiben als `pending`, `ready` oder `failed` nachvollziehbar.

Der Server führt vor dem Speichern und nach Plugin-Upgrades die zum Manifest passende Validierung aus. Plugin-Migrationen sind schrittweise, deterministisch und vorab sicherbar. Layerdaten werden nicht gelöscht, wenn das zugehörige Plugin temporär fehlt oder inkompatibel ist.

Das Track-Plugin importiert GPX und GeoJSON, bewahrt sinnvolle Quellmetadaten auf und speichert eine normalisierte Geometrie für Darstellung und Export. Das Bild-Plugin unterstützt GPS-getaggte Bilder als Punktlayer mit Vorschaubild sowie Bilder mit expliziten geografischen Bounds als flächige Overlays. GPS-Koordinaten aus EXIF werden vor Übernahme angezeigt und können korrigiert oder entfernt werden.

### 5.5 Kartenexporte

Ein Exportauftrag enthält:

- Map Set sowie Auswahlmodus `current`, `snapshot`, `asOf` oder explizite Tile-Revisionen
- Kartengebiet oder Mittelpunkt plus Maßstab
- Ausgabegröße in Pixeln; optional DPI und physische Größe
- Ausgabeformat `png`, `jpeg` oder `webp`
- Zielprojektion aus der initialen Allowlist `EPSG:3857`, `EPSG:4326` und `EPSG:25833`; standardmäßig höchstens 4096², konfigurierbar bis maximal 8192² Pixel
- Verhalten bei fehlenden Tiles: abbrechen, transparent darstellen oder online nachladen
- ausgewählte Layer-Instanzen mit Reihenfolge, Deckkraft und exportbezogener Konfiguration

Der XYZ-Renderer bestimmt die benötigten Tiles, lädt sie bevorzugt aus dem gewählten Cache, setzt sie in der Quellprojektion zusammen, transformiert bei Bedarf und ruft danach die Server-Rendering-Hooks der ausgewählten Layer-Plugins auf. Maßstabsleiste und Attribution bleiben Bestandteile des Kernrenderers. Attribution muss im Ergebnis optional sichtbar und in den Exportmetadaten nachvollziehbar sein. Adapter ohne Capability `serverExport` dürfen keinen solchen Exportauftrag starten.

## 6. API-Entwurf

Alle Endpunkte liegen relativ unter `api/`; keine Antwort darf absolute interne Hostnamen voraussetzen.

### 6.1 System

- `GET api/health` – einfacher Liveness-Check
- `GET api/ready` – prüft Datenbank und Schreibbarkeit der Datenverzeichnisse
- `GET api/config/public` – ausschließlich ungefährliche Frontend-Konfiguration
- `GET api/openapi.json` – zur laufenden Serverversion passende OpenAPI-Spezifikation ohne interne oder geheime Konfigurationswerte
- `GET api/map-renderers` – registrierte Frontend-Adapter und ihre Capability-Flags
- `GET api/layer-plugins` – registrierte Layer-Plugins, Versionen, Schemas und Fähigkeiten

### 6.2 Map Sets

- `GET api/map-sets`
- `POST api/map-sets`
- `GET api/map-sets/:id`
- `PATCH api/map-sets/:id`
- `DELETE api/map-sets/:id`
- `POST api/map-sets/:id/test`
- `GET api/map-sets/:id/tiles/:z/:x/:y` – Auswahl über `current`, `snapshot`, `asOf` oder Revisions-ID; Aktualisierung über `refresh=auto|force|cache-only`

### 6.3 Cache und Abdeckung

- `GET api/map-sets/:id/tile-revisions?z=:z&x=:x&y=:y`
- `DELETE api/map-sets/:id/tile-revisions/:tileRevisionId` – nur explizit und nur ohne aktuelle/Snapshot-Referenz
- `GET api/map-sets/:id/cache/stats`
- `GET api/map-sets/:id/cache-snapshots`
- `POST api/map-sets/:id/cache-snapshots`
- `GET api/map-sets/:id/cache-snapshots/:snapshotId`
- `DELETE api/map-sets/:id/cache-snapshots/:snapshotId` – löscht die Auswahl, nicht automatisch deren Tile-Revisionen
- `POST api/map-sets/:id/cache/compare` – Hash-/Metadatenvergleich zweier Snapshots, Zeitstände oder Revisionsauswahlen
- `POST api/map-sets/:id/coverage/query` – aggregierte Abdeckung für Gebiet, Zoom und gewählten Stand

Die Abdeckungs- und Vergleichsantworten sollen nicht Millionen Einzelkacheln an den Browser übertragen. Je nach Zoom liefern sie aggregierte Rasterzellen, Bounding-Boxes oder zusammengefasste GeoJSON-Flächen. Eine optionale Liste einzelner Änderungen wird paginiert.

### 6.4 Layer

- `GET api/layers`
- `POST api/layers`
- `GET api/layers/:id`
- `PATCH api/layers/:id`
- `DELETE api/layers/:id`
- `POST api/layers/:id/assets` – pluginvalidierter `multipart/form-data`-Upload mit Größenlimit und Statusantwort
- `GET api/layers/:id/assets/:assetId` – kontrollierte Auslieferung beziehungsweise Vorschaubild

Die API bleibt generisch und verzweigt anhand der registrierten Plugin-ID in dessen Schemas und Hooks. Es gibt in v1.0 keinen Endpunkt zum Installieren oder Hochladen von Plugin-Code.

### 6.5 Jobs und Exporte

- `POST api/download-jobs/estimate`
- `POST api/download-jobs`
- `GET api/jobs`
- `GET api/jobs/:id`
- `POST api/jobs/:id/pause`
- `POST api/jobs/:id/resume`
- `POST api/jobs/:id/cancel`
- `POST api/export-jobs/estimate`
- `POST api/export-jobs`
- `GET api/exports/:id/download`
- `DELETE api/exports/:id`

Für den Fortschritt genügt zunächst Polling. Server-Sent Events können später ergänzt werden, wenn die Oberfläche dadurch spürbar besser wird.

## 7. Frontend-Konzept

### 7.1 Hauptansichten

1. **Map** – ausgewähltes Map Set im aktiven Renderer-Adapter, Layer-Steuerung, Koordinatenanzeige und Navigation.
2. **Map Sets** – Übersicht, Editor, Validierung und Testabruf.
3. **Cache** – Tile-Historie, Snapshots, aktuelle/historische Speicherbelegung und ausdrücklich bestätigte Löschaktionen.
4. **Coverage** – Übersichtskarte mit farblicher Cache-Abdeckung sowie Auswahl und Vergleich von aktuellem Stand, Snapshot oder Zeitpunkt.
5. **Downloads** – Gebietsauswahl auf der Karte, Schätzung, Terms-/Limit- und Verantwortungshinweise sowie Jobfortschritt.
6. **Layers** – Plugin-Auswahl, Import, Konfiguration, Reihenfolge, Sichtbarkeit und Asset-Verwaltung.
7. **Exports** – Ausschnitt, Projektion, Ausgabeparameter, Plugin-Layer, Vorschau und Ergebnisdownload.
8. **Jobs** – gemeinsame Historie mit Fehlerdetails und Wiederaufnahmeaktionen.
9. **Documentation** – mehrsprachige Hilfe, API-Referenz, Provider-, Adapter-, Plugin- und Projektionsinformationen, Glossar und Fehlersuche.

### 7.2 Bedienprinzipien

- Vor großen Downloads oder Exporten werden Tile-Anzahl, geschätztes Datenvolumen und relevante Provider-Limits angezeigt.
- Destruktive Aktionen wie das Löschen einer Tile-Revision, eines Snapshots oder eines gesamten Map Sets erfordern eine eindeutige Bestätigung; referenzierte Revisionen sind geschützt.
- Fehler nennen Map Set, Jobphase und eine handlungsorientierte Ursache, ohne Secrets oder vollständige signierte URLs anzuzeigen.
- Die Coverage-Ansicht unterscheidet vorhanden, fehlend, veraltet und aktuell in Bearbeitung.
- Nicht unterstützte Funktionen werden anhand der Adapter-/Provider-Capabilities deaktiviert und mit einer Begründung versehen.
- Plugin-Editoren erscheinen innerhalb einer einheitlichen Layer-Oberfläche und dürfen Navigation, globale Stores oder andere Plugins nicht direkt manipulieren.
- Formulare verwenden gemeinsame Schemas, damit Frontend- und Backend-Validierung übereinstimmen.
- Wiederkehrende Farben, Abstände, Typografie, Radien, Schatten und Zustände werden als zentrale CSS Custom Properties beziehungsweise gemeinsame CSS-Primitives definiert. Komponentenspezifische Regeln bleiben bei der jeweiligen Komponente oder Domäne; eine einzige anwachsende globale Stylesheet-Datei ist ebenso zu vermeiden wie kopierte Einzelregeln.
- Views komponieren kleine, klar verantwortliche und wiederverwendbare Vue-Komponenten. Wiederkehrende Interaktionsmuster wie Buttons, Felder, Panels, Statusanzeigen, Toolbars und Bestätigungsdialoge erhalten gemeinsame Basiskomponenten statt dupliziertem Markup und Verhalten.
- Datenzugriff, fachliche Zustandslogik, Darstellung und komplexe Interaktionen werden frühzeitig in Stores, Composables und Komponenten getrennt. Dateien, die mehrere unabhängige Verantwortlichkeiten sammeln, werden aufgeteilt, bevor daraus schwer testbare God-Files entstehen.
- Die SPA verwendet relative Assets und API-Aufrufe. Der Server setzt anhand der internen Routentiefe eine relative Dokumentbasis, die der Router übernimmt.

### 7.3 Integrierte Dokumentation

Die Dokumentation ist ein fester Teil der SPA und über die Hauptnavigation sowie kontextbezogene Hilfelinks erreichbar. Ein Hilfelink aus einem Map-Set-, Layer-, Download- oder Exportformular öffnet direkt den passenden Abschnitt. Dokumentationsrouten, Bilder, sprachbezogene Suchindizes und die API-Spezifikation funktionieren auch unter einem Reverse-Proxy-Unterpfad.

**Inhaltsbereiche**

- **App-Handbuch:** Schnellstart, Navigation und vollständige Anleitungen für Map Sets, Tile-Revisionen, Snapshots, Vergleiche, Coverage, Downloads, Jobs, Layer-Plugins und Exporte
- **API:** authentizitätsgetreue OpenAPI-Referenz, Request-/Response-Beispiele, Fehlercodes, relative URL-Nutzung und Versionshinweise
- **Map-Provider:** Konfigurationsfelder, URL-Templates, Attribution, Header, API-Schlüssel, Rate-Limits, technische Cache-/Export-Fähigkeiten sowie Links zu offiziellen Nutzungsbedingungen und Provider-Dokumentationen
- **Erweiterungen:** Renderer-Adapter- und Layer-Plugin-Verträge, Capability-Modell, Referenz-Plugins, Versionskompatibilität und klarer Hinweis, dass Google Maps in v1.0 noch nicht implementiert ist
- **Projektionen:** unterstützte EPSG-Codes, typische Einsatzfälle, Grenzen, Quell-/Zielprojektion und Auswirkungen der Reprojektion
- **Glossar:** Abkürzungen und Begriffe wie XYZ, EPSG, WGS84, Web Mercator, Tile, Bounds, GPX, GeoJSON, DPI und SSRF
- **Betrieb und Fehlersuche:** Environment-Variablen, Docker-Volume, Reverse-Proxy, Backup/Restore, Migrationen, Logs und typische Fehlerszenarien
- **Sicherheit und Verantwortung:** Secret-Verwaltung, Netzwerkzugriffe und klare Eigenverantwortung des Nutzers für Prüfung und Einhaltung der jeweils aktuellen Provider-Nutzungsbedingungen; keine Rechtsberatung oder Zulässigkeitsgarantie durch maptoy
- **Version und Änderungen:** App-Version, Dokumentationsversion und Link zum zugehörigen Changelog

**Darstellung und Navigation**

- globaler Sprachumschalter mindestens für `English`, `Deutsch` und `ไทย`; optionale Sprachen werden aus einem Sprachmanifest ergänzt
- die Sprachwahl wird lokal gespeichert und bleibt beim Wechsel möglichst auf derselben Seite und Überschrift
- Standardauswahl anhand der Browsersprache; fehlt eine lokalisierte Seite, wird die englische Fassung mit sichtbarem Fallback-Hinweis angezeigt
- Inhaltsverzeichnis, Breadcrumbs, Vor/Zurück-Navigation, stabile Überschriftenanker und kopierbare Deep Links
- lokale Volltextsuche mindestens für Englisch und Deutsch; Thai-Suche wird nur aktiviert, wenn eine ausreichend zuverlässige Segmentierung mit vertretbarem Aufwand umgesetzt werden kann
- ist Thai-Suche deaktiviert, zeigt die Oberfläche dies ausdrücklich an und bietet die englische Suche an; thailändische Inhalte, Navigation und Englisch-Fallback bleiben davon unberührt
- Codebeispiele mit Kopierfunktion und klarer Kennzeichnung von Platzhaltern und Secrets
- externe Links sind als solche gekennzeichnet, öffnen sicher ohne Zugriff auf den Ursprungstab und ersetzen keine für den Grundbetrieb erforderlichen lokalen Inhalte
- zugängliche semantische Struktur, Tastaturnavigation und aussagekräftige Alternativtexte für Abbildungen

**Pflege und technische Regeln**

- Markdown-Dateien besitzen Frontmatter mit stabiler Dokument-ID, Sprache, Titel, Reihenfolge und optionalen Suchbegriffen.
- Englisch muss für jede veröffentlichte Dokument-ID vollständig vorhanden sein; der Build schlägt bei fehlender englischer Fassung oder doppelter ID fehl.
- Lokalisierte Fassungen verwenden dieselbe Dokument-ID und stabile Abschnitts-IDs. Fehlende deutsche, thailändische oder weitere Übersetzungen sind zulässig und werden in einem Übersetzungsstatusbericht ausgewiesen.
- Internes Markdown beziehungsweise daraus erzeugtes HTML wird sanitisiert.
- Die API-Referenz wird aus den gemeinsam genutzten API-Schemas erzeugt; handgeschriebene Anleitungen ergänzen sie um konkrete Workflows.
- Externe Provider-Links enthalten ein Datum der letzten inhaltlichen Prüfung. Die Dokumentation weist darauf hin, dass die aktuellen Bedingungen des Anbieters maßgeblich sind.
- Screenshots werden sparsam eingesetzt; bevorzugt werden versionsrobuste Texte, UI-Bezeichner und kleine Diagramme.
- Dokumentationsänderungen gehören zur Definition of Done jedes betroffenen Features und werden zusammen mit dem Code reviewed.

## 8. Konfiguration und Betrieb

### 8.1 Environment-Konfiguration

Alle Variablen erhalten das Präfix `MAPTOY_`. Eine `.env.example` dokumentiert mindestens:

```dotenv
MAPTOY_HOST=0.0.0.0
MAPTOY_PORT=4004
MAPTOY_DATA_DIR=./.data
MAPTOY_LOG_LEVEL=info
MAPTOY_MAX_CONCURRENT_JOBS=1
MAPTOY_MAX_EXPORT_PIXELS=100000000
MAPTOY_TEMP_DIR=${MAPTOY_DATA_DIR}/tmp
# Provider-specific secrets, for example:
# MAPTOY_EXAMPLE_API_KEY=
```

Beim Start wird die gesamte Konfiguration validiert. Fehlerhafte oder fehlende Pflichtwerte führen zu einer klaren Fehlermeldung. Konfigurationsschemata unterscheiden `server-secret`, `public-client` und `public`. Das Backend gibt echte Server-Secrets weder an das Frontend noch in Logs oder Jobparameter weiter. Die Kategorie `public-client` ist als Adapter-Vertrag vorgesehen, wird in v1.0 aber von keinem ausgelieferten Adapter benötigt.

`MAPTOY_DATA_DIR` bezeichnet auf dem Host den ausdrücklich gewählten, beschreibbaren Datenpfad. Docker Compose bind-mountet genau diesen Pfad nach `/data`; die Anwendung legt die Datenbank immer als `maptoy.sqlite` in diesem Datenverzeichnis an. Ein separater Datenbankpfad ist nicht konfigurierbar. Für persistente Anwendungsdaten werden weder benannte noch anonyme Docker-Volumes angelegt. Dadurch bleiben Datenbank, Tile-Archiv, Exporte und weitere persistente Artefakte auf dem Host unmittelbar sichtbar, sicherbar und kontrollierbar.

### 8.2 Reverse-Proxy-Fähigkeit

- Keine absoluten maptoy-internen Pfade wie `/api` oder `/assets` im Client; sie werden relativ zur öffentlichen Einstiegs-URL erzeugt. Künftige Adapter dürfen deklarierte externe Provider-Ursprünge verwenden.
- Ein Reverse Proxy entfernt einen öffentlichen Unterpfad vor dem Weiterleiten.
- Die SPA verwendet pfadbasierte Routen und eine aus der internen Routentiefe erzeugte relative HTML-Basis, damit Navigation und direkte Deep Links unter dem vorgeschalteten Unterpfad funktionieren.
- Redirects, Download-Links, Dokumentations-Deep-Links und Fehlerseiten verwenden die relative beziehungsweise öffentliche URL-Basis.
- Tests decken mindestens Betrieb unter `/` und einen Präfix-entfernenden Proxy unter `/tools/maptoy/` ab.
- README enthält Beispielkonfigurationen für einen verbreiteten Reverse-Proxy.

### 8.3 Docker

- Mehrstufiger Build: Dependencies, Test/Build, minimale Runtime
- Betrieb als nicht privilegierter Benutzer
- genau ein veröffentlichter HTTP-Port
- ausschließlich ein expliziter Host-Bind-Mount von `MAPTOY_DATA_DIR` nach `/data`; keine benannten oder anonymen Docker-Volumes für persistente Anwendungsdaten
- Healthcheck gegen den Liveness-Endpunkt
- sauberer Shutdown: keine neuen Jobs, laufende Dateischreibvorgänge abschließen, Jobstatus sichern
- temporäre Dateien beim Start prüfen und verwaiste Dateien kontrolliert bereinigen
- Image-Tags mindestens als Version und unveränderlicher Commit-Bezug

### 8.4 NixOS-Entwicklung

Die Flake stellt mindestens bereit:

- festgelegte Node- und pnpm-Versionen
- native Build- und Laufzeitabhängigkeiten für SQLite, Bildverarbeitung, PROJ und GDAL
- Biome und benötigte Hilfswerkzeuge
- `devShell` mit verständlichem Shell-Hook
- optional Checks für Formatierung, Typprüfung und Tests

`.envrc` verwendet `use flake`. Generierte oder lokale Dateien wie `.direnv`, `.env`, Datenbank, Tiles und Exporte werden ignoriert.

## 9. Sicherheit und Schutzmechanismen

Auch als private Anwendung verarbeitet maptoy fremde URLs und potenziell große Datenmengen. Deshalb gehören folgende Maßnahmen zur ersten Version:

- strikte Schema- und Wertevalidierung für alle API-Eingaben
- Schutz vor Path Traversal: IDs werden nicht ungeprüft als Dateipfade verwendet
- erlaubte Protokolle für Tile-Quellen auf `https` und optional bewusst freigegebenes `http` begrenzen
- SSRF-Schutz: lokale, Link-Local- und private Zielnetze standardmäßig sperren; bewusste Ausnahme nur über Serverkonfiguration
- Redirect-Ziele erneut gegen die Netzwerkregeln prüfen
- Größenlimits für Layer-Assets, Exporte, Auflösung und Jobanzahl
- Dateityp anhand tatsächlicher Inhalte beziehungsweise sicherer Decoder prüfen
- Timeouts, Response-Größenlimits, kontrollierte Retries und Circuit-Breaker-artige Pause bei anhaltenden Anbieterfehlern
- Log-Redaktion für API-Schlüssel, Authorization-Header und Query-Secrets
- HTML-/Script-Inhalte aus Attribution oder Metadaten nicht ungeprüft rendern
- Upload-Dateien außerhalb öffentlich ausgelieferter Verzeichnisse speichern
- EXIF- und andere Bildmetadaten nur gezielt übernehmen, GPS-Daten vor Verwendung anzeigen und nicht benötigte Metadaten aus Vorschaubildern und Exporten entfernen
- nur beim Build/Deployment zugelassene Plugins laden; Plugin-Hooks erhalten kontrollierte Asset-, Logging- und Rendering-Schnittstellen statt beliebiger Pfad- oder Secret-Zugriffe
- Content-Security-Policy standardmäßig auf maptoy selbst beschränken und externe Ursprünge erst mit einem künftig tatsächlich aktivierten Adapter gezielt freigeben
- Datenbankmigrationen und Cache-Löschungen transaktional beziehungsweise wiederaufnehmbar gestalten

## 10. Eigenverantwortung und verantwortliche Downloads

Der Nutzer ist allein dafür verantwortlich, die jeweils aktuellen Nutzungsbedingungen, Lizenzen, Attributionserfordernisse und technischen Vorgaben eines Kartenanbieters zu prüfen und einzuhalten. maptoy nimmt keine rechtliche Bewertung vor, überwacht keine Änderungen fremder Bedingungen und garantiert nicht, dass eine konfigurierte Nutzung zulässig ist. Die integrierte Dokumentation und externe Links dienen nur als technische Hilfestellung und sind keine Rechtsberatung.

Map Sets sollen Attribution, Terms-URL, eigene Notizen und den Zeitpunkt der letzten Nutzerprüfung enthalten. Diese Angaben sind informativ: maptoy leitet daraus keine rechtliche Freigabe ab und sperrt Caching, Batch-Downloads oder Exporte nicht anhand einer vermeintlichen Lizenzentscheidung. Technische Capability-Flags beschreiben ausschließlich, was ein Adapter implementieren kann.

Der Nutzer konfiguriert Rate-Limit, Parallelität, Cache-Alter, Retry-Grenzen und User-Agent passend zum jeweiligen Anbieter. maptoy setzt diese konfigurierten Betriebsgrenzen technisch um und reagiert defensiv auf Provider-Signale, übernimmt aber nicht die Verantwortung für deren inhaltliche Angemessenheit.

Vor Jobstart prüft der Server:

- ob Zoombereich und Gebiet innerhalb der Map-Set-Grenzen liegen
- wie viele Tiles bereits vorhanden und noch abzurufen sind
- ob konfigurierbare Job-, Tages- oder Speichergrenzen überschritten werden
- ob ausreichend freier Speicher vorhanden ist

Vor größeren Downloads und Exporten zeigt die Oberfläche Terms-Link, Attribution, letzte Nutzerprüfung, Umfangsschätzung und konfigurierte Limits an. Die Ausführung bleibt eine bewusste Entscheidung des Nutzers.

HTTP 429 und 503 führen zu verlangsamter Verarbeitung. Die globale und providerbezogene Parallelität muss zentral begrenzt sein, damit mehrere Jobs zusammen kein Limit umgehen.

## 11. Test- und Qualitätsstrategie

### 11.1 Unit-Tests

- Umrechnung zwischen Koordinaten, Zoomstufen und XYZ-Tiles
- Antimeridian-, Pol- und Bounds-Fälle
- URL-Template-Auflösung ohne Secret-Leak
- Konfigurations- und Map-Set-Validierung
- Sperre relevanter Quellenfelder nach der ersten Tile-Revision, logische Tile-Schlüssel, Content-Hash und hashbasierte Pfadbildung
- Auswahlregeln für `current`, Snapshot, `asOf` und explizite Tile-Revision
- Retry-/Backoff- und Rate-Limit-Logik mit kontrollierter Zeit
- Exportgrößen- und Tile-Anzahlschätzung
- Map-Adapter-Vertrag, Capability-Auswertung und adapterneutrale Viewport-Ereignisse
- Plugin-Manifest, Schemas, Versionskompatibilität und Datenmigrationen
- GPX-/GeoJSON-Normalisierung sowie EXIF-Ausrichtung und GPS-Extraktion
- Dokumentations-Metadaten, Sprach-Fallback, Ankererzeugung und sprachbezogener Suchindex

### 11.2 Integrationstests

- lokaler Fake-Tile-Server für Treffer, 404, 429, Redirect, Timeout und fehlerhaften Content-Type
- Cache-Miss, Cache-Hit, atomarer Schreibvorgang und parallele identische Anfragen
- bedingte Validierung mit 304, unverändertem 200-Inhalt und geändertem 200-Inhalt
- Revisionsfolge `A → B → A` mit erneuter Verwendung der Content-Datei, aber vollständiger zeitlicher DB-Historie
- dauerhafte Revisionshistorie, Content-Deduplizierung, Snapshot-Auswahl und zeitbezogener Abruf
- Hash-/Metadatenvergleich zweier Cache-Stände und Schutz referenzierter Revisionen vor Löschung
- Datenbankmigration und Neustart mit laufendem Job
- Abbruch, Pause, Wiederaufnahme und teilweise fehlgeschlagener Batch
- Export mit Track- und Bildoverlay
- Plugin-Registry und isolierter Aufruf von Import-, Asset- und Export-Hooks
- Verhalten bei fehlendem oder inkompatiblem Plugin ohne Verlust persistierter Layerdaten
- Contract-Test des Leaflet-/XYZ-Adapters und eines minimalen Fake-Adapters
- explizite Löschung einer unreferenzierten Tile-Revision ohne Beeinflussung anderer Revisionen oder Snapshots
- Erzeugung von `openapi.json` aus den Server-Schemas und Abgleich aller dokumentierten Endpunkte

Tests verwenden keine echten öffentlichen Tile-Dienste.

### 11.3 End-to-End- und Betriebstests

- Map Set erstellen, Karte laden und Attribution sehen
- Gebiet auswählen, Schätzung bestätigen, Download abschließen und Coverage prüfen
- einen Snapshot anlegen, ein Tile aktualisieren und aktuellen, historischen sowie verglichenen Stand anzeigen
- Track und GPS-getaggtes Bild importieren, auf der Karte konfigurieren und gemeinsam exportieren
- Export mit Plugin-Layern erstellen und Ergebnis herunterladen
- englische, deutsche und thailändische Dokumentationsroute öffnen, Fallback prüfen und einen kontextbezogenen Hilfelink verfolgen
- englische und deutsche Suche prüfen; für Thai entweder funktionsfähige Suche oder den ausdrücklich deaktivierten Zustand mit Verweis auf die englische Suche prüfen
- Anwendung unter einem Präfix-entfernenden Reverse-Proxy-Unterpfad laden; Assets, API, Tiles, Downloads, Dokumentation, Suche und pfadbasierte Deep Links funktionieren
- Container mit leerem sowie vorhandenem Volume starten
- SIGTERM während eines Jobs und anschließender konsistenter Neustart

### 11.4 Manuelle API-Tests mit Bruno

Die unter `tests/bruno/` versionierte Bruno Collection ergänzt automatisierte Tests um nachvollziehbare manuelle Diagnose- und Smoke-Abläufe. Sie enthält mindestens Health/Readiness, Map-Set-Verwaltung, Tile-Abruf mit allen Refresh-Modi, Revisionshistorie und Snapshot-Vergleich, Batch-Jobs, Layer-Asset-Upload und Export. Zustandsverändernde oder löschende Requests sind eindeutig benannt und nicht Teil eines unabsichtlichen Standardlaufs.

Eine eingecheckte lokale Beispielumgebung definiert die relative beziehungsweise konfigurierbare `baseUrl`, aber keine echten Secrets. Lokale Secret-Dateien werden ignoriert. Die Collection ist zunächst ein manuelles Werkzeug; ein späterer `bru`-CLI-Smoke-Lauf kann ergänzt werden, ist für v1.0 aber kein verpflichtendes Qualitäts-Gate.

### 11.5 Qualitäts-Gates

Jeder Merge muss mindestens Formatprüfung, Linting, Typprüfung, Unit-Tests und Build bestehen. Adapter und Plugins müssen ihre jeweiligen Contract-Test-Suites bestehen. Der Dokumentations-Build prüft zusätzlich vollständige englische Inhalte, Frontmatter, lokalisierte Fallback-Ziele, interne Links, lokale Assets, doppelte IDs/Anker und OpenAPI-Konsistenz; ein Bericht weist den Übersetzungsgrad pro Sprache aus. Externe Links werden regelmäßig separat geprüft, dürfen wegen temporärer Fremdausfälle aber nicht jeden normalen Build blockieren. Kritische Integrations- und E2E-Tests laufen in CI beziehungsweise vor einem Release. Abhängigkeiten und Containerbasis werden regelmäßig auf bekannte Schwachstellen geprüft.

Nicht offensichtliche Invarianten, Sicherheits- und Vertrauensannahmen, Recovery-Reihenfolgen sowie begründete Workarounds werden knapp direkt am betroffenen Code kommentiert. Kommentare erklären das **Warum**; selbsterklärende Syntax und triviale Abläufe werden nicht nacherzählt.

## 12. Umsetzungsphasen

### Phase 0: Technische Klärung und Spike

**Aufgaben**

- Provider-Anforderungen und gewünschte Beispielquelle dokumentieren
- Adaptergrenze zwischen fachlicher Kartenoberfläche, Leaflet-/XYZ-Renderer und späteren Frontend-Renderern als ADR festlegen
- Plugin-Lebenszyklus, Vertrauensmodell, SDK-Versionierung und Frontend-/Server-Hooks als ADR festlegen
- Datenmodell für stabile Map-Set-Quellen, unveränderliche Tile-Revisionen, Snapshots und zeitbezogene Auswahl als ADR festlegen
- Tile-Mathematik für WGS84/XYZ prototypisch prüfen
- 2x2- oder 3x3-Tile-Raster serverseitig zusammensetzen
- einen Track und ein GPS-getaggtes Testbild über prototypische Plugin-Hooks rendern und einen Testausschnitt nach einer zweiten Projektion exportieren
- Speicher- und Laufzeitverhalten bei einer repräsentativen Bildgröße messen
- Entscheidung `sharp`/Projektionsbibliothek versus GDAL als kurze Architecture Decision Record festhalten

**Ergebnis/Akzeptanz**

- Ein reproduzierbares Testprogramm erzeugt ein korrektes Kartenbild mit Attribution und Plugin-Layern.
- Grenzen für Exportpixel, unterstützte Projektionen und benötigte native Abhängigkeiten sind bekannt.
- Die Adapter- und Plugin-Verträge sind klein genug, um Leaflet beziehungsweise die Referenz-Layertypen ohne Zugriff aus fachlichen UI-Komponenten anzubinden.

### Phase 1: Repository und lauffähiger Grundrahmen

**Aufgaben**

- pnpm-Monorepo, TypeScript, Biome und Testframework einrichten
- Nix Flake und direnv-Konfiguration erstellen
- Server-, Web-, Contracts-, Map-Adapter-SDK- und Layer-Plugin-SDK-Package anlegen
- Buildzeit-Registries und Contract-Test-Harness für Adapter und Plugins anlegen
- Markdown-Pipeline, Dokumentationsrouting, Sprachmanifest und englische/deutsche/thailändische Minimalstruktur mit Fallback anlegen
- Environment-Schema mit `.env.example` implementieren
- Vue-SPA bauen und durch Fastify auf demselben Port ausliefern
- Health-/Readiness-Endpunkte und strukturiertes Logging ergänzen
- Bruno Collection mit lokaler Beispielumgebung und ersten Health-/Readiness-Requests anlegen
- mehrstufiges Dockerfile und Compose-Beispiel mit explizitem Host-Bind-Mount für das Datenverzeichnis erstellen
- gemeinsame semantische Versionierung aller auslieferungsrelevanten Paketmanifeste und einen Changelog einführen; Spikes werden unabhängig und nur bei eigenen Änderungen versioniert

**Ergebnis/Akzeptanz**

- Ein Befehl startet die Entwicklungsumgebung, ein weiterer alle Qualitätschecks.
- Der Container startet ohne Root-Rechte, liefert SPA und API auf einem Port und wird gesund gemeldet.
- Datenbank und spätere persistente Artefakte liegen über `MAPTOY_DATA_DIR` in einem direkt zugänglichen Hostverzeichnis; Compose legt dafür kein Docker-verwaltetes Volume an.
- Die vollständige englische Startseite sowie deutsche und thailändische Routen mit funktionierendem Englisch-Fallback sind über die Hauptnavigation erreichbar.
- Ein automatisierter Test bestätigt den Betrieb hinter einem Präfix-entfernenden Proxy-Unterpfad.
- Der Abschluss der Phase 1 ist als gemeinsame Version `0.0.1` in allen Paketmanifesten und im Changelog nachvollziehbar.
- Ein automatisierter Test verhindert voneinander abweichende Versionen in den auslieferungsrelevanten Paketmanifesten; Spike-Manifeste sind davon ausgenommen.

### Phase 2: Map Sets und interaktive Karte

**Status:** abgeschlossen am 21. August 2026 als Version `0.0.2`

**Aufgaben**

- SQLite-Schema und Migrationen für Map Sets anlegen
- CRUD-API und gemeinsame Validierung implementieren
- Secret-Referenzen sicher auflösen
- Map-Set-Übersicht und Editor bauen
- Testabruf mit verständlicher Diagnose ergänzen
- Leaflet-/XYZ-Adapter mit Map-Set-Auswahl, Attribution und Standardausschnitt umsetzen
- Capability-basierte UI-Zustände und Fake-Adapter für Contract-Tests ergänzen

**Ergebnis/Akzeptanz**

- Ein gültiges XYZ-Map-Set kann vollständig über die UI verwaltet werden.
- Fehlerhafte Templates, unerlaubte URLs und fehlende Secrets werden klar abgewiesen.
- Die Karte lädt ausschließlich über relative Anwendungs-URLs.
- Fachliche Komponenten importieren keine Leaflet-Typen; der Leaflet-/XYZ-Adapter und der Fake-Adapter bestehen dieselbe Contract-Test-Suite.
- v1 enthält keine Google-Maps-Abhängigkeit, keinen Google-Loader und keine Google-spezifische Konfiguration.

### Phase 3: Revisionsfähiges Tile-Archiv

**Status:** abgeschlossen am 22. August 2026 als Version `0.0.3`

**Aufgaben**

- DB-Schema für logische Tiles, unveränderliche Tile-Revisionen, aktuelle Zeiger und Snapshots implementieren
- Quellenfelder eines Map Sets nach der ersten gespeicherten Tile-Revision sperren und für abweichende Quellen das Duplizieren vorsehen
- hashbasiertes Dateilayout `data/tiles/<map-set-id>/<z>/<x>/<y>.<content-hash>.<ext>` umsetzen
- Tile-Proxy mit Cache-Miss/Hit, Inhaltsprüfung, Timeout und atomarem Schreiben bauen
- parallele Abrufe desselben Tiles deduplizieren
- Refresh-Modi `auto`, `force` und `cache-only` sowie bedingte HTTP-Validierung umsetzen
- Auswahl über aktuellen Stand, Snapshot, `asOf` und explizite Tile-Revision implementieren
- Snapshot-Erstellung und Hash-/Metadatenvergleich zweier Stände ergänzen
- DB-basierte Cache-Statistiken je Zoomstufe, expliziten Dateisystem-Audit und eine cursor-paginierte, gefilterte Revisionsansicht ergänzen
- explizite, referenzsichere Löschung ohne automatische Bereinigung historischer Revisionen sowie bestätigten bidirektionalen Abgleich zwischen DB und Dateisystem implementieren

**Ergebnis/Akzeptanz**

- Der zweite Abruf eines Tiles benötigt keinen Providerzugriff.
- Ein unveränderter Providerinhalt aktualisiert nur die Validierungsmetadaten; geänderter Inhalt erzeugt eine zusätzliche Revision und erhält die alte.
- Aktueller Stand, benannter Snapshot, Zeitstand und explizite Revision liefern reproduzierbar die erwarteten Bytes.
- Vergleiche erkennen identische, geänderte, hinzugekommene und fehlende Tiles anhand der gespeicherten Revisionen.
- Speicherlimits löschen keine historischen Revisionen; eine referenzierte Revision kann nicht versehentlich entfernt werden.
- Ein Prozessabbruch hinterlässt kein scheinbar gültiges, unvollständiges Tile.
- Revisionsanzahl und belegter Speicher stimmen mit den gespeicherten Dateien überein; ein bestätigter Abgleich entfernt sowohl verwaiste Dateien als auch unbrauchbare DB-Revisionen für extern gelöschte Dateien.
- Der normale Aufruf der Cache-Seite lädt weder sämtliche Revisionen noch scannt er das Tile-Verzeichnis; beide teuren Operationen erfolgen begrenzt beziehungsweise ausdrücklich.

### Phase 4: Batch-Downloads und Job-System

**Aufgaben**

- persistentes Jobmodell und einen In-Process-Worker implementieren
- Gebiet-/Zoom-Schätzung mit Duplikat- und Cache-Berücksichtigung bauen
- providerbezogene Rate-Limits, Parallelität, Retries und `Retry-After` umsetzen
- Pause, Fortsetzung, Abbruch und Neustart-Recovery ergänzen
- Download-Ansicht mit Gebietsauswahl und Jobfortschritt erstellen
- konfigurierte Speicher-, Größen- und Betriebsgrenzen durchsetzen und Terms-/Attributionshinweise vor Start anzeigen

**Ergebnis/Akzeptanz**

- Eine kleine definierte Region kann vollständig vorab geladen werden.
- Schätzung und tatsächliche Zahl der bearbeiteten Tiles sind nachvollziehbar.
- 429-Antworten verlangsamen den Worker; Abbruch und Neustart führen nicht zu beschädigten Daten.
- Die Oberfläche macht die Eigenverantwortung sichtbar, trifft aber keine rechtliche Zulässigkeitsentscheidung für den Nutzer.

### Phase 5: Cache-Abdeckung

**Aufgaben**

- effiziente Abdeckungsabfrage und Aggregation entwickeln
- Zoomfilter und Statusklassen implementieren
- Coverage-Layer über die neutrale Adapter-Schnittstelle für vorhanden, fehlend, veraltet und laufend bauen
- Auswahl von aktuellem Stand, Snapshot und Zeitpunkt sowie Vergleichsdarstellung ergänzen
- Detailansicht mit Tile-Zahl, Revisionen, Änderungen, Größe und Aktualität ergänzen
- Performance für große Caches messen und bei Bedarf Indizes oder vorberechnete Aggregate ergänzen

**Ergebnis/Akzeptanz**

- Die Abdeckung eines typischen Caches wird ohne Übertragung sämtlicher Tile-Datensätze flüssig dargestellt.
- Zwei ausgewählte Stände lassen sich aggregiert vergleichen und bis zu einzelnen geänderten Tiles untersuchen.
- Die Anzeige stimmt in Stichproben mit dem Dateisystem und den Cache-Metadaten überein.

### Phase 6: Layer-Plugin-System

**Aufgaben**

- Registry, Manifestprüfung, Capability-Modell und SDK-Kompatibilitätsprüfung implementieren
- generische Layer-Persistenz, Asset-Speicher, CRUD-API und Layer-Verwaltungsansicht bauen
- Datei-Upload über Frontend/API mit generierten Asset-IDs, Status, Hash und kontrolliertem Speicherort umsetzen
- kontrollierte Frontend-, Import-, Asset- und Server-Rendering-Hooks bereitstellen
- Schema-Migrationen und Verhalten bei fehlenden oder inkompatiblen Plugins umsetzen
- Track-Referenz-Plugin für GPX/GeoJSON, Stil, interaktive Karte und normalisierte Geometrie implementieren
- Bild-Referenz-Plugin für EXIF/GPS, manuelle Koordinaten, geografische Bounds, Vorschaubilder und Kartenanzeige implementieren
- Dateigrößen-, Decoder-, Metadaten- und Pfadschutz für Plugin-Assets ergänzen
- SDK-Dokumentation und Contract-Test-Suites erstellen

**Ergebnis/Akzeptanz**

- Ein Track und ein GPS-getaggtes Bild lassen sich importieren, konfigurieren, anordnen und im Leaflet-/XYZ-Adapter darstellen.
- Beide Referenz-Plugins verwenden ausschließlich die veröffentlichten Plugin-Schnittstellen und bestehen dieselbe Contract-Test-Suite.
- Ein deaktiviertes oder fehlendes Plugin verursacht keinen Datenverlust; ungültige beziehungsweise inkompatible Zustände werden verständlich angezeigt.
- Es kann kein ausführbarer Plugin-Code über API oder Weboberfläche installiert werden.

### Phase 7: Kartenbild-Export

**Aufgaben**

- Exportmodell, Schätzung und Job-Integration implementieren
- Auswahl des aktuellen Stands, eines Snapshots, eines Zeitstands oder expliziter Revisionen in Exportaufträge integrieren
- Tiles zusammensetzen, zuschneiden und in PNG/JPEG/WebP kodieren
- gewählte Zielprojektionen ergänzen
- serverseitige Layer-Plugin-Hooks in den Exportablauf integrieren
- Track- und Bild-Referenz-Plugins für alle unterstützten Zielprojektionen rendern
- Layer-Reihenfolge, Deckkraft, Attribution und Fehlerstrategie konfigurierbar machen
- Export-UI mit Vorschau, Fortschritt, Ergebnisdownload und Aufräumregeln bauen

**Ergebnis/Akzeptanz**

- Ein Kartenausschnitt wird in jeder unterstützten Ausgabeart und Projektion korrekt erzeugt.
- Testtrack, GPS-Bild und Bounds-Bild liegen nach Projektion visuell und numerisch an den erwarteten Koordinaten.
- Der Export nutzt Plugin-Daten und -Stile konsistent zur interaktiven Ansicht, soweit die Ausgabemedien dies zulassen.
- Fehlende Tiles, inkompatible Plugins und zu große Exporte führen zu einer vorhersehbaren, verständlichen Reaktion.

### Phase 8: Integrierte Dokumentation

**Vorgezogen umgesetzt**

- englisches Glossar und Abkürzungsverzeichnis mit deutschen und thailändischen Fassungen erstellen
- englische und deutsche Übersicht wichtiger Tile-Provider mit Varianten, URL-Templates, Parametern, Policy-Einordnung, Prüfdatum und offiziellen Links erstellen
- englische und deutsche Projektionsübersicht mit Auswahlhilfe, anfänglich unterstützten EPSG-Codes und Auswirkungen der Reprojektion erstellen
- `CHANGELOG.md` aus dem Repository-Wurzelverzeichnis beim Build direkt als englische Dokumentationsseite mit den üblichen Sprach-Fallbacks einbinden

**Aufgaben**

- Dokumentationslayout mit Navigation, Inhaltsverzeichnis, Breadcrumbs, Sprachwechsel und Deep Links fertigstellen
- englischen und deutschen Suchindex sowie gemeinsame Suchoberfläche implementieren
- Aufwand und Qualität einer Thai-geeigneten Segmentierung prüfen; Thai-Suche entweder verlässlich implementieren oder bewusst deaktivieren und auf die englische Suche verweisen
- kontextbezogene Hilfelinks aus Map Sets, Cache, Downloads, Coverage, Jobs, Layern und Exporten ergänzen
- OpenAPI-Spezifikation aus den Server-Schemas generieren und eine lesbare API-Referenz einbetten
- sämtliche vereinbarten Inhalte einschließlich App-Handbuch, API, Betrieb und Fehlersuche vollständig auf Englisch verfassen
- deutsche und thailändische Lokalisierungen bereitstellen und fehlende Seiten/Abschnitte sichtbar auf Englisch zurückfallen lassen
- Provider-Seiten mit Attribution, Fähigkeiten, Limits, Prüfdatum und offiziellen externen Links anlegen
- Eigenverantwortung des Nutzers, Veränderlichkeit fremder Bedingungen und fehlende rechtliche Prüfung durch maptoy deutlich dokumentieren
- Architekturhinweise für Layer-Plugins und künftige Renderer-Adapter samt v1.0-Abgrenzung dokumentieren
- Build-Prüfungen für vollständiges Englisch, Fallbacks, Übersetzungsstatus, Links, Assets, Anker, Sanitizing und API-Konsistenz aktivieren
- App-, Dokumentations- und Changelog-Version sichtbar miteinander verknüpfen

**Ergebnis/Akzeptanz**

- Sämtliche vereinbarten Inhaltsbereiche sind auf Englisch ohne Internetzugang verfügbar; nur ausdrücklich externe Referenzen benötigen Netzwerkzugriff.
- Deutsch und Thai sind auswählbar; fehlende Übersetzungen fallen sichtbar und ohne defekte Navigation auf Englisch zurück.
- Sprachwechsel, englische/deutsche Suche und kontextbezogene Hilfelinks führen reproduzierbar zur richtigen Seite beziehungsweise Überschrift; Thai-Suche funktioniert zuverlässig oder ist mit verständlicher Alternative deaktiviert.
- Die eingebettete API-Referenz entspricht der ausgelieferten Serverversion und enthält keine Secrets oder internen Konfigurationswerte.
- Der Build verhindert fehlende englische Inhalte, ungültige Fallbacks, ungültige interne Links und unsichere Dokumentinhalte und erzeugt einen Übersetzungsstatusbericht.

### Phase 9: Härtung und erste Veröffentlichung

**Aufgaben**

- Sicherheitsprüfungen für URL-Ziele, Redirects, Pfade, Layer-Assets, Plugin-Hooks und Secret-Redaktion abschließen
- Lasttests für Tile-Proxy, Download-Worker und große Exporte durchführen
- Datenbank-Backup/-Restore sowie Reparatur des hashbasierten Tile-Archivs ohne stillschweigende Löschung historischer Revisionen dokumentieren
- README als knappen Schnellstart mit Verweis auf die integrierte Konfigurations-, Reverse-Proxy- und Provider-Dokumentation erstellen
- Beispiel-Map-Set ohne geheimen Schlüssel bereitstellen, sofern dessen Bedingungen dies erlauben
- vollständige Testmatrix und Container-Smoke-Test ausführen
- Versionierung und Changelog fortführen sowie versionierte Release-Artefakte einführen

**Ergebnis/Akzeptanz**

- Eine neue Instanz ist allein mit integriertem Handbuch, README, Container und `.env` startbar.
- Persistente Daten überleben Upgrade und Container-Neuerstellung.
- Alle Qualitäts-Gates und die unten stehende Definition of Done sind erfüllt.

## 13. Priorisierung nach Releases

### v0.1 – Technischer Durchstich

- Grundrahmen, gleicher HTTP-Port, Nix/Docker
- ein Map Set
- Leaflet-/XYZ-Adapter hinter der allgemeinen Renderer-Schnittstelle
- hashbasiertes Tile-Archiv mit aktuellem Stand und dauerhaft erhaltener Revisionshistorie
- integrierte Dokumentationsnavigation mit vollständigem englischem Schnellstart sowie Deutsch-/Thai-Fallback

### v0.2 – Offline-Vorbereitung

- mehrere Map Sets mit jeweils stabiler Quellenkonfiguration
- Cache-Snapshots, Zeitstände und Hash-/Metadatenvergleiche
- belastbares Job-System
- Batch-Download mit Limits
- Coverage-Ansicht
- lokalisierbare Dokumentation für Map Sets, Cache, Coverage und Downloads

### v0.3 – Kartenerzeugung

- Bildexport in Quellprojektion
- ausgewählte alternative Projektionen
- allgemeines Layer-Plugin-System mit SDK und Contract-Tests
- Track- und Bild-Referenz-Plugins einschließlich GPS-getaggter Bilder
- verwalteter Asset-Upload über Frontend und API
- Exporthistorie und Download
- vollständige englische Projektions-, Plugin- und Exportdokumentation mit lokalisierten Fassungen

### v1.0 – Stabiler Privatbetrieb

- Sicherheits- und Performance-Härtung
- Backup-/Upgrade-Dokumentation
- vollständiges englisches App-Handbuch, API-Referenz, Provider-/Plugin-Bereich, Glossar und lokalisierte Suche mit Deutsch-/Thai-Fallback
- versionierte Renderer-Adapter- und Layer-Plugin-Verträge; Google-Maps-Adapter weiterhin bewusst nicht implementiert
- vollständige Reverse-Proxy- und Container-Tests
- definierte Kompatibilitäts- und Migrationsregeln
- vollständige manuelle Bruno Collection für die zentralen API-Abläufe

## 14. Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Nutzer übersieht oder missachtet geänderte Providerbedingungen | Vertrags-/Lizenzverstoß trotz technisch funktionierender App | Eigenverantwortung klar dokumentieren, Terms-Link/Prüfdatum anzeigen und keine Zulässigkeitsgarantie suggerieren |
| Reprojektion benötigt schwere native Bibliothek | größeres Image und komplexerer Nix-/Docker-Build | früher Spike; begrenzte Projektionsauswahl; GDAL nur bei nachgewiesenem Bedarf |
| Sehr große Zoomgebiete erzeugen Millionen Tiles | Kosten, Laufzeit und Speicherüberlauf | verpflichtende Schätzung, harte Limits, freier-Speicher-Prüfung und Bestätigung |
| Dauerhaft erhaltene Tile-Revisionen lassen den Speicher wachsen | neue Abrufe oder Exporte scheitern wegen Platzmangel | getrennte Statistik, Warn-/Aufnahmelimits, Kapazitätsschätzung und ausschließlich explizite bestätigte Löschung |
| SQLite und Dateisystem laufen auseinander | Historie, aktuelle Zeiger oder Snapshots werden unzuverlässig | atomare Writes, transaktionale Zustände, Backup sowie nicht destruktive Reparatur-/Scan-Funktion |
| Historische oder von Snapshots referenzierte Revision wird versehentlich gelöscht | reproduzierbare Stände und Vergleiche gehen verloren | Referenzschutz, ausdrückliche Bestätigung, Vorschau der Auswirkungen und Backup |
| Reverse-Proxy-Unterpfad bricht Assets oder API | Anwendung nicht erreichbar | ausschließlich relative URL-Helfer und automatisierter Proxy-E2E-Test ab Phase 1 |
| Bösartige oder falsche Quell-URL ermöglicht SSRF | Zugriff auf interne Dienste | IP-/DNS-Prüfung, Redirect-Prüfung, Protokoll-Allowlist und explizite Ausnahmen |
| Export verbraucht zu viel RAM | Containerabsturz | Pixelgrenzen, Worker-Limit, Streaming/Tile-basierte Verarbeitung und Messungen |
| Nutzer konfiguriert Limits zu hoch oder mehrere Jobs addieren ihre Last | Providerfehler, Sperrung oder Terms-Verstoß | zentraler Limiter pro Provider, sichtbare Schätzung und Verantwortungshinweis statt vermeintlicher Rechtsprüfung |
| Geheimnisse erscheinen in Logs oder DB | Credential-Leak | Secret-Referenzen, redigierte Logs und Tests für Fehlermeldungen |
| Leaflet-Details gelangen in fachliche Komponenten | späterer Renderer-Adapter erfordert großen Umbau | eigene Adapter-Schnittstelle, Importgrenzen und Contract-Test mit Fake-Adapter |
| Plugin-Schnittstelle ist zu eng oder instabil | weitere Layertypen benötigen Kernänderungen | Spike, versionierte Schemas, Track/Bild als unterschiedlich strukturierte Referenzen und Contract-Tests |
| Plugin oder Dateiimport verarbeitet schädliche Inhalte | Codeausführung, Datenleck oder Ressourcenverbrauch | nur vertrauenswürdige Buildzeit-Plugins, kontrollierte Hooks, sichere Decoder und harte Limits |
| EXIF-GPS-Daten werden unbeabsichtigt weitergegeben | Datenschutzproblem | Koordinaten vor Übernahme anzeigen sowie nicht benötigte Metadaten aus Vorschauen/Exporten entfernen |
| Dokumentation und Verhalten laufen auseinander | Fehlbedienung und falsche API-Nutzung | API-Referenz generieren, Feature-DoD um Dokumentation ergänzen und versionsgleich veröffentlichen |
| Englische Dokumentation ist unvollständig oder lokalisierter Fallback ist defekt | fehlende Hilfe und widersprüchliche Navigation | Englisch als Build-Gate, stabile Dokument-/Abschnitts-IDs, Fallback-Tests und Übersetzungsstatusbericht |
| Externe Provider-Links oder Bedingungen veralten | Nutzer verlässt sich auf überholte Hinweise | offizielle Quellen, sichtbares Prüfdatum, Linkprüfung und ausdrücklicher Hinweis auf eigenständige Prüfung der aktuellen Bedingungen |

## 15. Definition of Done für v1.0

`maptoy` gilt als v1.0-fertig, wenn:

- die Anwendung reproduzierbar über Nix entwickelt und als Docker-Image gebaut werden kann;
- SPA, API, Tiles, Exporte und Dokumentation über einen HTTP-Port und unter einem Reverse-Proxy-Unterpfad funktionieren;
- der Leaflet-/XYZ-Renderer ausschließlich über den versionierten Adaptervertrag angebunden ist und derselbe Vertrag mit einem Fake-Adapter getestet wird;
- keine Google-Maps-Laufzeitabhängigkeit oder Google-spezifische Implementierung enthalten ist, die Adapterarchitektur eine spätere Implementierung aber ohne Umbau fachlicher Komponenten erlaubt;
- Map Sets ohne Secret-Leaks verwaltet und validiert werden können;
- sämtliche unterschiedlichen Tile-Revisionen hashbasiert, unveränderlich und dauerhaft in Dateien sowie Datenbank nachvollziehbar sind und Quellenfelder nach dem ersten Cache-Eintrag nicht mehr verändert werden können;
- aktueller Stand, Snapshot, Zeitstand und explizite Revision reproduzierbar auswählbar und vergleichbar sind;
- keine historische Revision automatisch gelöscht wird und explizite Löschungen aktuelle beziehungsweise von Snapshots referenzierte Revisionen schützen;
- Batch-Jobs konfigurierte technische Limits und Provider-Signale respektieren sowie Neustart, Pause und Abbruch konsistent behandeln;
- die Coverage-Ansicht große Caches und Vergleiche aggregiert und verständlich darstellt;
- das allgemeine Layer-Plugin-System versionierte Manifeste, Schemas, Migrationen sowie Frontend-/Server-Hooks bereitstellt und seine Contract-Tests besteht;
- Layer-Assets über Frontend und API hochgeladen, validiert und ausschließlich über verwaltete Asset-IDs referenziert werden können;
- Track- und Bild-Referenz-Plugins einschließlich GPS-getaggter Bilder interaktiv und im Export funktionieren;
- Kartenbilder mit den dokumentierten Projektionen und Plugin-Layern korrekt exportiert werden;
- das vollständige englische App-Handbuch, die zur Serverversion passende API-Referenz, Provider-/Plugin-/Projektionsseiten und das Glossar integriert, englisch/deutsch durchsuchbar und kontextbezogen verlinkt sind;
- Deutsch und Thai auswählbar sind und fehlende Übersetzungen sichtbar und funktionsfähig auf Englisch zurückfallen;
- Thai-Suche entweder zuverlässig funktioniert oder ausdrücklich deaktiviert ist und auf die englische Suche verweist;
- der Dokumentations-Build vollständiges Englisch sowie gültige Fallbacks, interne Links und Assets sicherstellt;
- alle Eingaben, Remote-URLs, Layer-Assets, Plugin-Hooks und Dateipfade durch die beschriebenen Schutzmaßnahmen abgesichert sind;
- automatisierte Unit-, Integrations-, E2E- und Container-Smoke-Tests erfolgreich sind;
- die versionierte Bruno Collection alle zentralen API-Abläufe für manuelle Smoke- und Diagnosetests abdeckt, ohne Secrets zu enthalten;
- Konfiguration, Datenpersistenz, Backup, Upgrade, Reverse-Proxy und Eigenverantwortung des Nutzers für Providerbedingungen dokumentiert sind.

## 16. Noch zu entscheidende Punkte

Diese Entscheidungen sollten während Phase 0 beziehungsweise vor der jeweils betroffenen Phase getroffen und als Architecture Decision Records dokumentiert werden:

1. Welche konkreten Tile-Anbieter dienen als erste Beispiele, und welche rein technischen Defaults sollen dafür vorgeschlagen werden?
2. **Entschieden:** `sharp` und `proj4` genügen nicht als allgemeiner Raster-Warper; GDAL wird gemäß [ADR 0004](docs/internal/adr/0004-use-gdal-for-raster-reprojection.md) verwendet.
3. Welche alternativen Projektionen müssen in v0.3 tatsächlich unterstützt werden?
4. Welche maximalen Gebiets-, Tile-, Speicher- und Exportgrößen sind für die Zielhardware sinnvoll, und wann soll das Tile-Archiv warnen beziehungsweise neue Datenaufnahme blockieren?
5. Sollen Map Sets ausschließlich in SQLite verwaltet oder zusätzlich als importierbare/exportierbare JSON-Dateien unterstützt werden?
6. Soll das Bild-Plugin neben EXIF-GPS und geografischen Bounds bereits Worldfiles oder GeoTIFF-Metadaten unterstützen?
7. Wie lange bleiben fertige Exporte und Jobprotokolle standardmäßig erhalten?
8. Soll eine spätere Version MBTiles als Import-/Exportformat unterstützen?
9. Welche offiziellen Provider-Links werden beispielhaft mitgeliefert, ohne dadurch Aktualität oder Zulässigkeit zu garantieren?
10. Welcher Mindestübersetzungsgrad wird für Deutsch und Thai pro Release angestrebt, ohne den definierten Englisch-Fallback infrage zu stellen?
11. Sollen Plugins nach v1 ausschließlich als eigene Builds oder über einen signierten, administrativen Installationsweg verteilt werden?
12. Welche Capabilities soll ein späterer Google-Maps-JavaScript-Adapter tatsächlich anbieten, insbesondere im Verhältnis zu Cache, Batch-Download und Export?
13. Reicht für v1 der Hash-/Metadatenvergleich von Cache-Ständen oder sollen bereits visuelle Tile-Differenzbilder erzeugt werden?
14. Ist eine ausreichend gute Thai-Suche mit vertretbarem Aufwand möglich oder wird sie in v1 bewusst deaktiviert?
