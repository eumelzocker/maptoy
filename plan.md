# Projektplan: maptoy

## 1. Zielbild

`maptoy` wird eine selbst gehostete Docker-Anwendung für den privaten Gebrauch. Sie stellt frei konfigurierbare Kartenquellen in einer Weboberfläche dar, speichert abgerufene Kartenkacheln mit dauerhaft nachvollziehbarer Revisionshistorie, unterstützt kontrollierte Batch-Downloads und erzeugt exportierbare Kartenbilder mit optionaler Projektion und erweiterbaren Zusatzlayern. Eine in die Weboberfläche integrierte, mehrsprachige Dokumentation erklärt Anwendung, API und kartografische Grundlagen unmittelbar in der jeweils installierten Version.

Frontend und Backend werden über denselben HTTP-Port ausgeliefert. Alle maptoy-eigenen URLs sind relativ zur öffentlichen Einstiegs-URL, damit die Anwendung sowohl unter einer Domain-Wurzel als auch unter einem Reverse-Proxy-Unterpfad funktioniert. Externe URLs sind ausschließlich für ausdrücklich konfigurierte Provider und Dokumentationsreferenzen zulässig.

Die Codebasis, technische Bezeichner und Benutzeroberfläche sind englischsprachig. Die integrierte Dokumentation ist auf Englisch vollständig; deutsche, thailändische und optionale weitere Lokalisierungen fallen bei fehlenden Inhalten kontrolliert auf Englisch zurück. Projektplanung und die Zusammenarbeit mit dem KI-Assistenten erfolgen auf Deutsch.

## 2. Annahmen und Leitentscheidungen

- Die erste Version ist eine Single-User-Anwendung ohne Benutzerverwaltung.
- Die Anwendung läuft zunächst als einzelner Container und benötigt keine externen Cloud-Dienste.
- Persistente Fachdaten liegen im explizit eingebundenen Anwendungsdatenverzeichnis; größenrotierte Traffic-Logs sind davon getrennte Betriebsartefakte und dürfen über eigene Host-Bind-Mounts bereitgestellt werden.
- SQLite verwaltet Metadaten, Konfigurationen und Jobs; Tile-Dateien, Exporte,
  verwaltete Nicht-Bild-Assets und abgeleitete Bildvorschauen liegen als Dateien im
  Anwendungsdatenverzeichnis. Originalbilder verbleiben außerhalb davon in
  einem ausdrücklich konfigurierten, nur lesbar eingebundenen Fotoverzeichnis.
- Auswahl und Nutzung einer Kartenquelle erfolgen in Eigenverantwortung des Nutzers. maptoy verlinkt Nutzungsbedingungen und dokumentiert konfigurierbare technische Limits, bewertet oder erzwingt aber nicht, ob Caching, Batch-Abrufe oder Exporte rechtlich beziehungsweise vertraglich zulässig sind.
- Anbieterbedingungen können sich ändern. Der Nutzer muss sie eigenständig prüfen und Map Sets, Limits sowie Nutzung entsprechend anpassen; die mitgelieferte Dokumentation ist keine Rechtsberatung und keine Garantie für Zulässigkeit.
- Eine `Map Set`-Konfiguration beschreibt Kartenquelle, Renderer-Adapter, Darstellung und Cache-Regeln. Zusatzlayer bilden einen davon unabhängigen globalen Overlay-Stack; echte Server-Secrets werden nur per Environment referenziert und nicht im Klartext in Map Sets gespeichert.
- Die erste Version konzentriert sich auf Raster-Tiles nach dem XYZ-Schema. Vector Tiles und WMTS-Sonderfälle sind mögliche spätere Erweiterungen.
- Die Kartenansicht verwendet eine Frontend-Adapter-Schnittstelle. v1.0 implementiert ausschließlich den Leaflet-/XYZ-Adapter; ein späterer Adapter für die Google Maps JavaScript API und weitere Karten-APIs ist architektonisch vorgesehen, aber ausdrücklich nicht Bestandteil von v1.0.
- Provider- und Renderer-Fähigkeiten wie interaktive Anzeige, Tile-Cache, Batch-Download, Export und Layer-Unterstützung werden getrennt ausgewiesen und nicht für jeden Adapter vorausgesetzt.
- Zusatzlayer verwenden eine allgemeine Plugin-Architektur. Track- und Fotolayer
  sind die datenbasierten Referenzimplementierungen und verwenden dieselben
  fachlichen Daten in interaktiver Karte und Bitmapexport. Zustandsabgeleitete
  dekorative Layer verwenden denselben Lebenszyklus, erzeugen ihre Darstellung
  jedoch ohne persistierte Features oder Assets aus Viewport, Projektion und aktiver
  Tile-Matrix.
- v1.0 lädt ausschließlich vertrauenswürdige Layer-Plugins, die beim Build beziehungsweise Deployment registriert werden. Installation oder Upload beliebigen ausführbaren Plugin-Codes über die Weboberfläche ist nicht vorgesehen.
- Das Backend dient gleichzeitig als API, Tile-Proxy und statischer Webserver für das gebaute Frontend.
- Eine optionale, generische Firefox-Erweiterung kann passende Browserantworten unverändert an frei konfigurierte HTTP-Ziele weiterleiten. Sie ist ein eigenständig versioniertes Workspace-Paket mit eigenen Build- und Testabläufen und wird weder im maptoy-Container gebaut noch ausgeliefert.
- Länger laufende Fotoverzeichnisscans, Downloads und Exporte werden als persistente
  Jobs ausgeführt, sodass Status, Fortschritt, Abbruch und Fehler nachvollziehbar
  sind.
- Die Dokumentationsquellen liegen versioniert im Repository, werden beim Frontend-Build validiert und zusammen mit der Anwendung ausgeliefert. Sie benötigen zur Anzeige keine externe Dokumentationsplattform.
- Englisch ist die obligatorische und vollständige Dokumentationssprache. Jede veröffentlichte Seite besitzt eine stabile sprachunabhängige ID; Deutsch, Thai und optionale weitere Sprachen können seitenweise auf die englische Fassung zurückfallen.

## 3. Umfang

### 3.1 Muss-Funktionen der ersten nutzbaren Version

- Map Sets anlegen, bearbeiten, validieren, duplizieren und löschen
- Rasterkarten im Vue-/Leaflet-Frontend anzeigen
- Tiles über das Backend laden und lokal cachen
- Tile-Bytes über die API kontrolliert einspielen und als revisionsfähige Cache-Stände speichern
- sämtliche inhaltlich unterschiedlichen Tile-Revisionen dauerhaft nachvollziehbar speichern
- aktuelle, historische, zeitbezogene oder als Snapshot benannte Cache-Stände auswählen und vergleichen
- Cache-Abdeckung für ein Gebiet und Zoomstufen sichtbar machen
- Batch-Downloads für Gebiet und Zoomstufen planen, starten, beobachten, pausieren beziehungsweise abbrechen und erneut versuchen
- vertrauenswürdige Layer-Plugins registrieren, konfigurieren und im XYZ-Renderer sowie im Export verwenden
- Track- und Fotolayer als vollständige Referenz-Plugins einschließlich
  GPS-getaggter Fotos und inkrementell scanbarer externer Fotoverzeichnisse
  bereitstellen
- einen dekorativen Tile-Grid-Layer ohne importierte Fachdaten bereitstellen, der
  sichtbare XYZ-Tiles mit `z/x/y` beschriftet und eine koordinatenabhängige
  metrische Maßstabsleiste einblendet
- Kartenbilder aus Kartenausschnitt, Größe, Projektion und optionalen Plugin-Layern erzeugen
- integrierte, über die Hauptnavigation erreichbare Dokumentation mit vollständiger englischer Fassung, Deutsch, Thai, Fallback, Suche, Sprachwechsel und externen Referenzlinks
- Konfiguration über Environment und `.env` für die Entwicklung
- Persistenz über explizite Host-Bind-Mounts
- Betrieb hinter einem Reverse-Proxy unter `/` oder einem Unterpfad
- Health- und Readiness-Endpunkte für den Containerbetrieb

### 3.2 Bewusst nicht Teil der ersten Version

- Mehrbenutzerbetrieb, Rollen und öffentliche Freigabelinks
- Synchronisation zwischen mehreren maptoy-Instanzen
- Vollwertiges GIS mit Feature-Editing oder räumlicher Datenbank
- Allgemeine Unterstützung aller proprietären Kartenprotokolle
- konkrete Implementierung eines Google-Maps-, Vector-Tile- oder sonstigen alternativen Frontend-Adapters
- Installation nicht vertrauenswürdiger oder zur Laufzeit hochgeladener Plugins über die Weboberfläche
- eigenständige Layer-, Asset- oder Fotokatalog-Hauptansicht; Layerbedienung bleibt
  in v1 Bestandteil der normalen Kartenansicht
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
       |-> filesystem: tiles, managed non-image assets, image previews, temporary files, exports
       |-> configured read-only photo directory outside the application data directory
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
- Datenbank: SQLite mit externen, nummerierten SQL-Migrationen über die in Node.js 24 enthaltene `node:sqlite`-API gemäß [ADR 0005](docs/internal/adr/0005-use-node-sqlite-for-metadata.md); Schema-Version 4 ist die festgelegte produktive Baseline, alle künftigen Migrationen bauen auf ihr auf
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
│   └── photo-layer/         # GPS-Foto-Referenz-Plugin
├── extensions/
│   └── firefox/             # generische, separat versionierte Response-Weiterleitung
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

Die Vue-Anwendung greift nicht direkt aus fachlichen Komponenten auf Leaflet zu. Ein `MapRendererAdapter` kapselt mindestens Erzeugung und Zerstörung der Karte, Viewport und Zoom, Ereignisse, Basiskarte, Layer-Anbindung, Screenspace-/Geo-Koordinaten sowie verfügbare Fähigkeiten. Ein Adapter-Manifest enthält stabile ID, Version, kompatible SDK-Version, Konfigurationsschema, Capability-Flags und die unterstützten Layer-Deskriptorarten. Plugins deklarieren die von ihnen benötigten Deskriptorarten; ein allgemeines `layerRendering`-Flag ersetzt diese feingranulare Kompatibilitätsprüfung nicht.

Der in v1.0 enthaltene Adapter `leaflet-xyz` bildet das bestehende XYZ-, Cache- und Exportmodell vollständig ab. Ein kleiner Fake-Adapter dient ausschließlich Vertragstests und beweist, dass zentrale UI-Komponenten nicht von Leaflet-Klassen abhängen. Für Google Maps wird in v1.0 weder Abhängigkeit noch Loader noch API-Key-Konfiguration ausgeliefert; die dokumentierte Adaptergrenze berücksichtigt jedoch, dass ein späterer Adapter clientseitig laden kann und möglicherweise weder Tile-Cache noch Batch-Download oder Serverexport anbietet.

#### Layer-Plugins

Ein `LayerPlugin` besteht aus einem gemeinsamen Manifest und nach Bedarf aus drei Teilen:

- **Shared:** Plugin-ID und -Version, kompatible SDK-Version, versioniertes Daten- und Konfigurationsschema, Capability-Flags und Migrationsfunktionen
- **Frontend:** Import-/Editor-Komponenten, interaktive Darstellung über die neutrale Kartenadapter-Schnittstelle, Legende und optionale Detailansichten
- **Server:** sichere Datei- und Metadatenverarbeitung, Validierung, Vorschaubilder sowie Rendering-Hook für Kartenexporte

Das Layer-Plugin-SDK stellt als wiederverwendbare, versionierte Geometriegrundlagen
Punkt, Linie und Fläche bereit. Diese Grundlagen sind diskriminierte Datenverträge
und Laufzeitschemas, keine objektorientierte Klassenhierarchie. Sie trennen Geometrie,
fachliche Feature-Eigenschaften, optionale Eigenschaften einzelner Linienstützpunkte
und Darstellung. Plugins spezialisieren diese Verträge, statt eigene inkompatible
Geometrieformen einzuführen: Bildpunkte und künftige POIs bauen auf Punkten auf,
Tracks und künftige Routen auf Linien, und künftige Regionen oder Auswahlgebiete auf
Flächen. Linienstützpunkte dürfen typisierte Zusatzdaten wie Zeitstempel, Höhe oder
Genauigkeit tragen. Flächen berücksichtigen mindestens einen Außenring und optionale
Innenringe.

Die Frontend-Hooks erzeugen ausschließlich adapterneutrale, typisierte
Darstellungsdeskriptoren für Punkte, Linien und Flächen. Stil beziehungsweise
Symbolisierung bleiben von der Geometrie getrennt und werden erst vom aktiven
Renderer-Adapter in dessen konkrete Darstellung übersetzt.

Neben Deskriptoren für persistierte Geometrie unterstützt das SDK
zustandsabgeleitete Dekorationsdeskriptoren. Deren sichtbarer Inhalt wird aus
Viewport, Projektion und aktiver Tile-Matrix berechnet und nicht als Feature- oder
Assetdaten persistiert. Initial steht `xyz-tile-grid` für ein weltbezogenes Raster
der tatsächlich verwendeten Source-Tiles bereit, das Grenzen, `z/x/y`-Beschriftung
und eine lokale metrische Maßstabsleiste je Tile gemeinsam beschreibt. Ein Plugin
veröffentlicht nur die deklarative Konfiguration; der Renderer aktualisiert die
Darstellung bei Pan, Zoom und Basiskartenwechsel selbstständig. Plugins erhalten
dafür weder Zugriff auf Leaflet noch auf Map-Set- oder globale UI-Stores.

Einfache Plugin-Konfigurationen werden aus validiertem Konfigurationsschema und
typisierten UI-Hinweisen in einem gemeinsamen Editor dargestellt. Plugins mit
Import-, Scan- oder vergleichbaren Spezialabläufen dürfen einen bei der
Frontend-Registry registrierten Spezialeditor bereitstellen. Die gemeinsame
Layer-Editor-Shell löst Editoren über die Registry auf und enthält keine wachsende
Fallunterscheidung nach Plugin-IDs.

Die Registry wird beim Build aus explizit zugelassenen Paketen erzeugt. Ein Plugin erhält nur den benötigten Kontext statt direkten Zugriff auf Fastify, Pinia, Datenbank oder beliebige Dateipfade. Persistente Layer-Instanzen speichern Plugin-ID, Schema-Version und validierte Konfiguration. Fehlt ein Plugin nach einem Upgrade, bleiben seine Daten erhalten, der Layer wird jedoch deaktiviert und mit einer verständlichen Diagnose angezeigt.

Die Referenz-Plugins definieren die Mindestqualität der Schnittstelle:

- `track-layer`: Import von GPX und GeoJSON, normalisierte Geometrie, Linien-/Punktstil, interaktive Anzeige und Export
- `photo-layer`: sichere Bilddekodierung, EXIF-Ausrichtung, optionale GPS-Extraktion,
  explizite Punktkoordinate, Vorschaubild, Marker-/Hover-Popup-Anzeige mit einer
  zunächst im Code vorkonfigurierten, später per UI wählbaren Auswahl erweiterbarer
  Bilddetails und Export
- `tile-grid-layer`: assetfreie, zustandsabgeleitete Darstellung sichtbarer
  XYZ-Tile-Grenzen und `z/x/y`-Koordinaten sowie einer metrischen Maßstabsleiste

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
- keine Layer-Zuordnung; Layer-Instanzen sind global und bleiben beim Wechsel des Map Sets erhalten

Die Anwendung validiert URL-Templates, Wertebereiche und Secret-Referenzen vor dem Speichern. Eine Testfunktion ruft genau ein Tile ab und zeigt Status, Content-Type und Attribution an. Hinweise, Notizen oder ein Prüfdatum zu Nutzungsbedingungen sind rein informativ und werden von maptoy nicht als rechtliche Freigabe interpretiert.

### 5.2 Tile-Revisionen und Cache-Snapshots

Ein Map Set bildet die stabile Grenze einer Kartenquelle. Sobald seine erste Tile-Revision gespeichert wurde, dürfen die für Abruf oder Interpretation der Tile-Bytes relevanten Felder nicht mehr geändert werden: Quelltyp, URL-Template, Header, Subdomains, Tile-Größe, Format und Quellprojektion. Für eine andere Quelle wird das Map Set dupliziert. Metadaten, Startausschnitt, Zoomgrenzen, Capabilities sowie Cache- und Download-Regeln bleiben editierbar. Eine Rotation des Werts einer per Environment referenzierten Secret-Variable ändert die gespeicherte Map-Set-Konfiguration nicht.

Ein **logisches Tile** wird durch Map Set und Koordinate `(z, x, y)` identifiziert. Zu einem logischen Tile können beliebig viele unveränderliche **Tile-Revisionen** gehören. Eine Tile-Revision enthält mindestens:

- stabile Revisions-ID und Bezug zum logischen Tile
- kryptografischen Content-Hash, Dateiformat, Content-Type, Byte-Größe und Dateipfad
- `firstSeenAt`, `lastSeenAt`, `lastValidatedAt` und zeitliche Gültigkeit innerhalb der bekannten Historie
- soweit vorhanden `ETag`, `Last-Modified` und relevante, redigierte Provider-Metadaten
- Entstehungsquelle der Revision (`provider` oder `upload`)
- Status der Inhaltsprüfung und Kennzeichnung als aktuell ausgewählte Revision

Der Content-Hash bezieht sich auf die tatsächlich gespeicherten Bytes. Entspricht eine Validierung weiterhin der aktuell ausgewählten Revision, entsteht weder eine doppelte Datei noch eine neue Revision; stattdessen werden `lastSeenAt` und `lastValidatedAt` aktualisiert. Wechselt der Inhalt, entsteht ein neuer Revisionsdatensatz. War derselbe Hash bereits früher vorhanden, wird die vorhandene Content-Datei wiederverwendet, aber eine neue zeitliche Revision angelegt, damit auch eine Folge wie `A → B → A` vollständig nachvollziehbar bleibt. Alle früheren Revisionen bleiben erhalten.

Tile-Bytes können außerdem ohne Providerabruf über die API eingespielt werden. Der Upload verwendet einen unveränderten PNG-, JPEG- oder WebP-Body, muss vollständig dekodierbar sein und in Content-Type, tatsächlichem Bildformat sowie Abmessungen zum konfigurierten Tile-Format und zur Tile-Größe des Map Sets passen. Es gelten dieselben Koordinaten-, Bounds-, Cache-Policy-, Capability-, Größen-, Speicherlimit- und atomaren Schreibregeln wie beim Providerabruf. Der erste erfolgreiche Upload gilt als erster Cache-Eintrag und sperrt damit die quellbestimmenden Map-Set-Felder. Der Nutzer ist dafür verantwortlich, dass die eingespielten Bytes tatsächlich zur konfigurierten Quelle und Koordinate gehören.

Providerabruf, Revalidierung und Upload teilen sich je logischem Tile dieselbe Schreibkoordination, damit konkurrierende Änderungen eine deterministische Revisionshistorie erzeugen. Ist der hochgeladene Inhalt mit der aktuellen Revision identisch, werden nur Sichtungs- und Validierungszeitpunkt aktualisiert; es entstehen weder eine neue Revision noch zusätzlicher Speicherbedarf. Neue oder erneut auftretende Inhalte folgen denselben Hash- und Historienregeln wie Providerinhalte. Eine hochgeladene Revision trägt die Entstehungsquelle `upload`, keine Provider-Validatoren und gilt ab der lokalen Inhaltsprüfung als frisch für den Modus `auto`.

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

### 5.3 Persistente Jobs und Download-Gebiete

Ein Download-Gebiet besteht in der ersten Version aus einem Rechteck in WGS84. Polygone können später ergänzt werden. Vor dem Start berechnet das Backend die betroffenen Tile-Koordinaten pro Zoomstufe, entfernt Duplikate und erstellt eine Kostenschätzung.

Ein Job speichert:

- Typ (`photo-scan`, `tile-download`, `map-export`, später weitere Typen)
- Eingabeparameter als validiertes, versioniertes JSON
- Status `queued`, `running`, `paused`, `completed`, `failed` oder `cancelled`
- Gesamtzahl, erledigte, übersprungene und fehlgeschlagene Einheiten
- Erstellungs-, Start-, Aktualisierungs- und Endzeitpunkt
- letzten Fehler und begrenzte Fehlerhistorie
- Referenz auf Ergebnisdateien

Jobs müssen nach einem Prozessneustart konsistent fortsetzbar oder als unterbrochen erkennbar sein. Ein einzelner Tile-Fehler beendet nicht automatisch den gesamten Batch. Retries verwenden exponentielles Backoff und respektieren `Retry-After`.

Der minimale persistente Jobkern wird mit dem ersten länger laufenden
Fotoverzeichnisscan in Phase 5 eingeführt. Phase 6 erweitert denselben Jobkern um
Downloadschätzung, Provider-Limits und Tile-Download-Worker; Phase 7 ergänzt
Exportjobs. Es wird keine separate, nur für Fotoscans gültige
Hintergrundverarbeitung aufgebaut.

### 5.4 Layer-Plugins und Layer-Instanzen

Eine Layer-Instanz ist eine persistente Verwendung eines registrierten Plugins und enthält:

- stabile ID, verpflichtender Anzeigename als `/`-segmentierbarer Hierarchiepfad und Plugin-ID
- eine vom Plugin-Manifest deklarierte Kategorie als erste Hierarchieebene, zum
  Beispiel `Tracks`, `Photos`, `Decorations` oder künftig `POIs`
- Plugin- und Schema-Version
- globale Verfügbarkeit unabhängig vom aktuell gewählten Map Set
- validierte, pluginabhängige Konfiguration
- Sichtbarkeit, Reihenfolge, Deckkraft und gegebenenfalls zoombasierte Grenzen
- optionale Referenzen auf kontrollierte Asset-IDs statt frei zusammengesetzter
  Dateipfade
- Erstellungs-/Änderungszeitpunkt und Migrationsstatus

Persistente Feature-Daten und Assets sind für eine Layer-Instanz optional. Ein
zustandsabgeleiteter Layer darf ein leeres validiertes Datenobjekt verwenden und
seine Laufzeitdarstellung vollständig aus Rendererzustand und persistierter
Konfiguration erzeugen. Abgeleitete Tile-Grenzen, Koordinatenbeschriftungen und
Maßstabswerte werden weder in SQLite noch über die Layer-API gespeichert. Damit
nutzen dekorative Layer unverändert CRUD, Hierarchie, Sichtbarkeit, Reihenfolge,
Deckkraft, Zoomgrenzen, Migration und Diagnose des allgemeinen Layer-Modells, ohne
ein paralleles Persistenz- oder Verwaltungssystem einzuführen.

Die generische Assetverwaltung unterscheidet verwaltete Assets, externe
Quelldateien und abgeleitete Assets. Verwaltete Nicht-Bild-Assets können über
Frontend und API hochgeladen werden. Der Server vergibt eine Asset-ID und einen
kontrollierten Speicherort; der ursprüngliche Dateiname bleibt nur als Metadatum
erhalten. Uploads durchlaufen Größen-, Inhalts- und Pluginvalidierung. Die
Layer-Instanz referenziert anschließend ausschließlich die Asset-ID. Assetstatus und
Fehler bleiben als `pending`, `ready`, `changed`, `missing` oder `failed`
nachvollziehbar.

Originalfotos werden von maptoy weder dauerhaft hochgeladen noch in das
Anwendungsdatenverzeichnis kopiert. Der Betreiber konfiguriert stattdessen ein
Fotoverzeichnis, das im Container ausschließlich lesbar eingebunden wird. Persistiert
werden ein normalisierter relativer Pfad, Dateiname, tatsächlicher
Medientyp, Größe, Bildabmessungen, Aufnahmezeit, Hersteller, Kameramodell, ISO,
Blende, Belichtungszeit, optionale IPTC-Bildunterschrift, Änderungsfingerprint,
optionaler Content-Hash, Scanstatus und die fachliche Punktposition. Absolute Host-
oder Containerpfade werden weder an Plugins
noch an das Frontend ausgegeben. Plugin-Hooks greifen nur über kontrollierte
Asset-Resolver auf Original oder Vorschau zu.

Fotovorschauen sind abgeleitete, von maptoy verwaltete Assets unter
`MAPTOY_STORAGE_DATA_DIR`. Sie werden EXIF-orientiert, größen- und pixelbegrenzt,
metadatenbereinigt, hashbasiert und atomar erzeugt. Temporäre Bildbytes werden nach
der Verarbeitung entfernt. Die interaktive Karte verwendet grundsätzlich die
Vorschau; ein hochauflösender Export darf das externe Original kontrolliert und nur
bei passendem gespeicherten Fingerprint erneut lesen. Ist das Fotoverzeichnis oder eine Datei
nicht verfügbar, bleiben Metadaten und Vorschau erhalten und das Asset wird
verständlich als `missing` beziehungsweise `changed` diagnostiziert.

Ein Fotoverzeichnisscan arbeitet wahlweise rekursiv, inkrementell und als
persistenter Job. Er verarbeitet nur unterstützte Dateien innerhalb einer
konfigurierten Fotoverzeichnisses, vergleicht zunächst relativen Pfad, Größe und
Änderungszeit und dekodiert neue oder geänderte Fotos. Neu gefundene Fotos werden
nur mit einer vollständigen, gültigen EXIF-GPS-Punktposition in den Katalog
aufgenommen; übersprungene Fotos ohne Position werden separat in der
Jobzusammenfassung gezählt. Geänderte Inhalte werden neu ausgewertet und nicht mehr
auffindbare Dateien nur als `missing` markiert; ein Scan löscht weder Metadaten noch
Vorschauen oder Nutzerkorrekturen automatisch. Ein Content-Hash darf verzögert für
neue oder geänderte Dateien berechnet werden, damit große unveränderte Bestände
nicht bei jedem Scan vollständig gelesen werden.

Der Server führt vor dem Speichern und nach Plugin-Upgrades die zum Manifest passende Validierung aus. Plugin-Migrationen sind schrittweise, deterministisch und vorab sicherbar. Layerdaten werden nicht gelöscht, wenn das zugehörige Plugin temporär fehlt oder inkompatibel ist.

Das Track-Plugin importiert GPX und GeoJSON, bewahrt sinnvolle Quellmetadaten auf und speichert eine normalisierte Geometrie für Darstellung und Export. Das Bild-Plugin unterstützt GPS-getaggte Bilder als Punktlayer mit Vorschaubild. Eine vorhandene EXIF-GPS-Position wird beim ersten Scan ohne einzelnen Bestätigungsschritt als wirksame Punktposition übernommen und kann anschließend korrigiert oder entfernt werden. Gespeichert werden nur die wirksame Koordinate und ihre Herkunft `exif`, `manual` oder `none`; es gibt keine getrennten Felder für erkannte und akzeptierte Koordinaten. Ein erneuter Scan darf eine manuell korrigierte oder bewusst entfernte Position nicht überschreiben. Nur eine weiterhin aus EXIF stammende Position darf bei einer nachweislich geänderten Quelldatei aus deren aktuellen EXIF-Daten aktualisiert werden.

Die normalisierten Layerdaten verwenden die gemeinsamen Geometriegrundlagen des
SDK. Ein Feature besitzt eine stabile ID, genau eine Geometrie und typisierte
fachliche Eigenschaften. Punktfeatures tragen eine Koordinate. Linienfeatures
tragen eine geordnete Folge von Stützpunkten, deren optionale typisierte Eigenschaften
zum Beispiel Track-Zeitstempel und Höhenwerte aufnehmen. Flächenfeatures tragen
validierte Ringe; die Unterstützung von Punkt, Linie und Fläche wird bereits in Phase
5 durch SDK-, Adapter- und Contract-Tests abgesichert, auch wenn v1 noch kein eigenes
Flächen-Referenz-Plugin ausliefert.

Pluginabhängige Darstellungseigenschaften wie Farbe, Linienbreite, Punktmarkierung,
Füllung oder Deckkraft verändern die normalisierte Geometrie nicht. Das Track-Plugin
spezialisiert Linie mit Track- und Stützpunktmetadaten. Das Bild-Plugin spezialisiert
Punkt mit extern referenzierten Originalen, verwalteten Vorschau-Assets und
Bildmetadaten.

### 5.5 Kartenexporte

Ein Exportauftrag enthält:

- Map Set sowie Auswahlmodus `current`, `snapshot`, `asOf` oder explizite Tile-Revisionen
- Kartengebiet oder Mittelpunkt plus Maßstab
- Ausgabegröße in Pixeln; optional DPI und physische Größe
- Ausgabeformat `png`, `jpeg` oder `webp`
- Zielprojektion aus der initialen Allowlist `EPSG:3857`, `EPSG:4326` und `EPSG:25833`; standardmäßig höchstens 4096², konfigurierbar bis maximal 8192² Pixel
- Verhalten bei fehlenden Tiles: abbrechen, transparent darstellen oder online nachladen
- ausgewählte Layer-Instanzen mit Reihenfolge, Deckkraft und exportbezogener Konfiguration

Der XYZ-Renderer bestimmt die benötigten Tiles, lädt sie bevorzugt aus dem gewählten Cache, setzt sie in der Quellprojektion zusammen, transformiert bei Bedarf und ruft danach die Server-Rendering-Hooks der ausgewählten Layer-Plugins auf. Attribution bleibt Bestandteil des Kernrenderers und muss im Ergebnis optional sichtbar sowie in den Exportmetadaten nachvollziehbar sein. Eine Maßstabsleiste wird dagegen ausschließlich als ausgewählter dekorativer Layer dargestellt und exportiert, damit Konfiguration und Sichtbarkeit demselben Layer-Lebenszyklus wie in der interaktiven Karte folgen. Adapter ohne Capability `serverExport` dürfen keinen solchen Exportauftrag starten.

## 6. API-Entwurf

Alle Endpunkte liegen relativ unter `api/`; keine Antwort darf absolute interne Hostnamen voraussetzen.

### 6.1 System

- `GET api/health` – einfacher Liveness-Check
- `GET api/ready` – prüft Datenbank sowie Schreibbarkeit des Anwendungsdatenverzeichnisses und beider Traffic-Log-Verzeichnisse
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
- `POST api/map-sets/:id/tiles/:z/:x/:y` – unveränderten PNG-, JPEG- oder WebP-Body passend zum Tile-Format als aktuelle Revision einspielen

Der Tile-Upload verwendet bewusst kein Multipart. Eine neu angelegte Revision antwortet mit `201` und `{ revisionId, created: true }`; entspricht der Inhalt bereits der aktuellen Revision, antwortet der Endpunkt mit `200` und `{ revisionId, created: false }`. Fehlender, nicht unterstützter oder zum Map Set unpassender Media-Type führt zu `415`, ungültige Bildbytes zu `400`, deaktiviertes Tile-Archiv zu `409`, eine Überschreitung des routenspezifischen Bytelimits zu `413` und ein ausgeschöpftes Speicherlimit zu `507`. Erfolgreiche Antworten liefern zusätzlich die Revisions-ID im gleichen Header wie der normale Tile-Abruf.

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
- `GET api/layers/:id/assets`
- `POST api/layers/:id/assets` – pluginvalidierter `multipart/form-data`-Upload
  verwalteter Nicht-Bild-Assets mit Größenlimit und Statusantwort
- `GET api/layers/:id/assets/:assetId` – kontrollierte Auslieferung eines
  verwalteten Assets beziehungsweise einer abgeleiteten Bildvorschau
- `GET api/photos/directory` – Konfigurations- und Verfügbarkeitsstatus des
  Fotoverzeichnisses, aber ohne absolute Serverpfade
- `POST api/layers/:id/photo-scan-jobs` – persistenten, optional rekursiven und
  inkrementellen Scan des Fotoverzeichnisses oder eines relativen Unterverzeichnisses
  starten

Die API bleibt generisch und verzweigt anhand der registrierten Plugin-ID in dessen Schemas und Hooks. Es gibt in v1.0 keinen Endpunkt zum Installieren oder Hochladen von Plugin-Code.

Scanrequests referenzieren ausschließlich einen validierten relativen Unterpfad.
Sie akzeptieren keine absoluten Dateisystempfade.
Bildoriginale werden über keinen Asset-Endpunkt dauerhaft in maptoy übernommen.

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

1. **Map** – ausgewähltes Map Set im aktiven Renderer-Adapter, optional
   einblendbares Layer-Panel mit Plugin-Auswahl, Import, Fotoverzeichnisscan,
   Konfiguration, Reihenfolge, Sichtbarkeit und Status, Koordinatenanzeige und
   Navigation.
2. **Map Sets** – Übersicht, Editor, Validierung und Testabruf.
3. **Cache** – Tile-Historie, Snapshots, aktuelle/historische Speicherbelegung und ausdrücklich bestätigte Löschaktionen.
4. **Coverage** – Übersichtskarte mit farblicher Cache-Abdeckung sowie Auswahl und Vergleich von aktuellem Stand, Snapshot oder Zeitpunkt.
5. **Downloads** – Gebietsauswahl auf der Karte, Schätzung, Terms-/Limit- und Verantwortungshinweise sowie Jobfortschritt.
6. **Exports** – Ausschnitt, Projektion, Ausgabeparameter, Plugin-Layer, Vorschau und Ergebnisdownload.
7. **Jobs** – gemeinsame Historie mit Fehlerdetails und Wiederaufnahmeaktionen.
8. **Documentation** – mehrsprachige Hilfe, API-Referenz, Provider-, Adapter-, Plugin- und Projektionsinformationen, Glossar und Fehlersuche.

Für Layer, Assets und Fotokatalog wird in v1 keine eigene Hauptansicht und keine
eigene `/layers`-Route angelegt. Die Kartenansicht bleibt während Auswahl,
Konfiguration und Import sichtbar. Ein kompaktes, schließbares Layer-Panel bietet
oberhalb genau eines Layer-Editors einen durchsuchbaren Dropdown-Baum für den
globalen Overlay-Stack. Checkboxen an Layern, Kategorien und Ordnern erlauben die
schnelle, bei Gruppen dreistufig dargestellte Sichtbarkeitssteuerung. Der ausgewählte
Layer stellt Deckkraft, Reihenfolge, Zoomgrenzen und Diagnosestatus im einzigen
Editor des Panels dar. Plugin-Auswahl, Trackimport, Fotoverzeichnisscan,
Detailbearbeitung und Diagnose öffnen fokussierte Dialoge oder
Unterpanels innerhalb dieser Ansicht.

`Add layer` erstellt einen global verfügbaren Layer. Beim Wechsel des Map Sets wird
nur der Basiskarten-Renderer neu aufgebaut; dieselben Layer-Instanzen werden in
unveränderter Sichtbarkeit und Reihenfolge wieder angehängt. Eine spätere
Map-Set-spezifische Auswahl darf ausschließlich als separates Anzeige-Preset
modelliert werden und ändert weder Eigentum noch Persistenz der Layer. Große
Bildbestände werden im Layer-Panel nur zusammengefasst; gefilterte Assetdetails
werden cursor-paginiert beziehungsweise virtualisiert in einem Dialog angezeigt.

Das Layer-Panel gruppiert die Instanzen auf der ersten Ebene nach der im
Plugin-Manifest deklarierten Kategorie. Weitere Ebenen entstehen ohne zusätzliches
Persistenzmodell aus `/`-Segmenten des verpflichtenden Layernamens, beispielsweise
`Tracks > Reisen > 2026 > Alpen` für den Namen `Reisen/2026/Alpen`.

Der unter `Decorations` angebotene `tile-grid-layer` benötigt weder Import noch
Assets. Sein Editor konfiguriert, ob Tile-Raster samt Koordinatenbeschriftung und die
metrische Maßstabsleiste sichtbar sind, sowie deren Farben und die Breite der
Maßstabsleiste als Anteil von 25 bis 100 Prozent der Tile-Breite. Die allgemeinen
Layerwerte steuern weiterhin Deckkraft und Zoomgrenzen. Jede sichtbare Tile-Zelle
enthält ihre eigene, für deren geografische Lage berechnete Maßstabsleiste. Deren
Breite bleibt innerhalb aller Tiles gleich; beschriftete und
visuell unterteilte Intervalle weisen die lokal dargestellte Distanz aus. Raster,
Beschriftung und Maßstab liegen gemeinsam in der weltbezogenen Renderer-Ebene und
folgen derselben Layer-Reihenfolge, Sichtbarkeit und Deckkraft.
Die Display Options bieten zusätzlich einen einfachen Grid-Schalter. Er verwendet
einen vorhandenen Tile-Grid-Layer namens `Default Grid` unverändert oder erzeugt ihn
bei Bedarf mit Standardkonfiguration; die Detailbearbeitung bleibt im Layer-Panel.

### 7.2 Bedienprinzipien

- Die Hauptnavigation markiert die aktive Ansicht dauerhaft und unterscheidet
  diesen Zustand klar von Hover und Tastaturfokus. Bei schmalen Viewports ersetzt
  ein zugänglicher Dropdown-Wechsler die horizontalen Routenlinks; beide
  Darstellungen verwenden dieselbe zentrale View-Definition.
- Vor großen Downloads oder Exporten werden Tile-Anzahl, geschätztes Datenvolumen und relevante Provider-Limits angezeigt.
- Destruktive Aktionen wie das Löschen einer Tile-Revision, eines Snapshots oder eines gesamten Map Sets erfordern eine eindeutige Bestätigung; referenzierte Revisionen sind geschützt.
- Fehler nennen Map Set, Jobphase und eine handlungsorientierte Ursache, ohne Secrets oder vollständige signierte URLs anzuzeigen.
- Die Coverage-Ansicht unterscheidet vorhanden, fehlend, veraltet und aktuell in Bearbeitung.
- Nicht unterstützte Funktionen werden anhand der Adapter-/Provider-Capabilities deaktiviert und mit einer Begründung versehen.
- Das Layer-Panel ist ein optionales Werkzeug des Map View und wird bei fehlender
  Capability `layerRendering` nicht als scheinbar nutzbare Verwaltung angeboten.
- Im Layer-Panel ist stets höchstens ein Layer-Editor im DOM. Der im Dropdown-Baum
  ausgewählte Layer wird oberhalb des Editors mit seinem vollständigen Pfad
  angezeigt; die Auswahl wird lokal im Browser gespeichert.
- Plugin-Kategorien und alle aus `/`-Namenssegmenten entstehenden Ordner sind auf-
  und zuklappbar; eingeklappte Hierarchieknoten werden lokal im Browser gespeichert
  und sind ohne gespeicherte Präferenz geöffnet.
- Klick auf einen Layernamen im Dropdown-Baum wählt ihn für den Editor aus und
  schließt den Dropdown. Ein Klick auf eine Checkbox ändert ausschließlich die
  Sichtbarkeit und lässt den Dropdown für weitere schnelle Änderungen geöffnet.
  Kategorien und Ordner verwenden dreistufige Checkboxen für ihre Nachfahren.
- Ein Track-Layer ohne importierte Geometrie hebt `Import track…` als Primäraktion
  hervor und nennt GPX sowie GeoJSON als unterstützte Formate. Nach einem Import
  wird daraus die nicht hervorgehobene Aktion `Replace track…`, weil ein erneuter
  Dateiimport die vorhandene Trackgeometrie vollständig ersetzt.
- Die allgemeine Layer-Deckkraft ist der einzige Deckkraftwert eines Track-Layers
  und wirkt identisch in interaktiver Karte und Serverexport. Eine frühere
  Track-Konfiguration mit zusätzlicher Linien-Deckkraft wird verlustfrei migriert,
  indem beide bisherigen Faktoren in den allgemeinen Layerwert überführt werden.
- Plugin-Editoren erscheinen innerhalb einer einheitlichen Layer-Oberfläche und dürfen Navigation, globale Stores oder andere Plugins nicht direkt manipulieren. Einfache Konfigurationen verwenden den gemeinsamen schemabasierten Editor; Spezialeditoren werden über die Registry aufgelöst und nicht durch Plugin-ID-Verzweigungen in der Shell eingebaut.
- Fotoverzeichnisscans zeigen Fortschritt, neue, geänderte, fehlende und
  fehlgeschlagene Dateien, ohne pro EXIF-GPS-Position eine Bestätigung zu verlangen.
  Automatisch übernommene Positionen lassen sich anschließend einzeln korrigieren
  oder entfernen.
- Die Coverage-Ansicht bleibt auf Abdeckung und Zustand des Tile-Archivs
  konzentriert. Phase 5 ergänzt dort weder Layerverwaltung noch Fotokatalog; eine
  spätere optionale Einblendung fachlicher Layer zur Orientierung ist davon
  unabhängig.
- Formulare verwenden gemeinsame Schemas, damit Frontend- und Backend-Validierung übereinstimmen.
- Wiederkehrende Farben, Abstände, Typografie, Radien, Schatten und Zustände werden als zentrale CSS Custom Properties beziehungsweise gemeinsame CSS-Primitives definiert. Komponentenspezifische Regeln bleiben bei der jeweiligen Komponente oder Domäne; eine einzige anwachsende globale Stylesheet-Datei ist ebenso zu vermeiden wie kopierte Einzelregeln.
- Views komponieren kleine, klar verantwortliche und wiederverwendbare Vue-Komponenten. Wiederkehrende Interaktionsmuster wie Buttons, Felder, Panels, Statusanzeigen, Toolbars und Bestätigungsdialoge erhalten gemeinsame Basiskomponenten statt dupliziertem Markup und Verhalten.
- Datenzugriff, fachliche Zustandslogik, Darstellung und komplexe Interaktionen werden frühzeitig in Stores, Composables und Komponenten getrennt. Dateien, die mehrere unabhängige Verantwortlichkeiten sammeln, werden aufgeteilt, bevor daraus schwer testbare God-Files entstehen.
- Die SPA verwendet relative Assets und API-Aufrufe. Der Server setzt anhand der internen Routentiefe eine relative Dokumentbasis, die der Router übernimmt.

### 7.3 Integrierte Dokumentation

Die Dokumentation ist ein fester Teil der SPA und über die Hauptnavigation sowie kontextbezogene Hilfelinks erreichbar. Ein Hilfelink aus einem Map-Set-, Layer-, Download- oder Exportformular öffnet direkt den passenden Abschnitt. Dokumentationsrouten, Bilder, sprachbezogene Suchindizes und die API-Spezifikation funktionieren auch unter einem Reverse-Proxy-Unterpfad.

**Inhaltsbereiche**

- **App-Handbuch:** Schnellstart, Navigation und vollständige Anleitungen für Map Sets, Tile-Revisionen, externes Tile-Seeding, Snapshots, Vergleiche, Coverage, Downloads, Jobs, Layer-Plugins, das externe Fotoverzeichnis, Fotoverzeichnisscans und Exporte
- **API:** authentizitätsgetreue OpenAPI-Referenz, Request-/Response-Beispiele einschließlich des binären Tile-Uploads, Fehlercodes, relative URL-Nutzung und Versionshinweise
- **Map-Provider:** Konfigurationsfelder, URL-Templates, Attribution, Header, API-Schlüssel, Rate-Limits, technische Cache-/Export-Fähigkeiten sowie Links zu offiziellen Nutzungsbedingungen und Provider-Dokumentationen
- **Erweiterungen:** Renderer-Adapter- und Layer-Plugin-Verträge, Capability-Modell, Referenz-Plugins, Versionskompatibilität und klarer Hinweis, dass Google Maps in v1.0 noch nicht implementiert ist
- **Projektionen:** unterstützte EPSG-Codes, typische Einsatzfälle, Grenzen, Quell-/Zielprojektion und Auswirkungen der Reprojektion
- **Glossar:** Abkürzungen und Begriffe wie XYZ, EPSG, WGS84, Web Mercator, Tile, Bounds, GPX, GeoJSON, DPI und SSRF
- **Betrieb und Fehlersuche:** Environment-Variablen, Host-Bind-Mounts einschließlich
  des externen Read-only-Fotoverzeichnisses, Reverse-Proxy, Backup/Restore, Migrationen, Logs,
  fehlende beziehungsweise geänderte Bildquellen und typische Fehlerszenarien
- **Sicherheit und Verantwortung:** Secret-Verwaltung, Netzwerkzugriffe, Betriebsgrenzen unauthentifizierter Schreibendpunkte und klare Eigenverantwortung des Nutzers für Prüfung und Einhaltung der jeweils aktuellen Provider-Nutzungsbedingungen; keine Rechtsberatung oder Zulässigkeitsgarantie durch maptoy
- **Version und Änderungen:** App-Version, Dokumentationsversion und Link zum zugehörigen Changelog

**Darstellung und Navigation**

- Die Startseite bleibt als eigener Eintrag oberhalb des Inhaltsverzeichnisses.
  Die übrigen Seiten sind in die einklappbaren Bereiche `About maptoy` und
  `About Maps, the Universe, and Everything` gegliedert. Noch nicht übersetzte
  Seiten tragen kompakt eine UK-Flagge als Englisch-Fallbackhinweis.
- globaler Sprachumschalter mindestens für `English`, `Deutsch` und `ไทย`; optionale Sprachen werden aus einem Sprachmanifest ergänzt
- die Sprachwahl wird lokal gespeichert und bleibt beim Wechsel möglichst auf derselben Seite und Überschrift
- Standardauswahl anhand der Browsersprache; fehlt eine lokalisierte Seite, wird die englische Fassung mit sichtbarem Fallback-Hinweis angezeigt
- der Fallback-Hinweis wird in der gewählten Dokumentationssprache angezeigt
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

Alle Variablen folgen dem Schema `MAPTOY_<DOMÄNE>_<EIGENSCHAFT>`. Die Domäne
steht unmittelbar nach `MAPTOY_`; insbesondere verwendet der gesamte externe
Fotokatalog die Domäne `PHOTOS`. Alte, anders angeordnete Namen werden weder als
Alias noch als Fallback unterstützt. Eine `.env.example` dokumentiert mindestens:

```dotenv
MAPTOY_SERVER_HOST=0.0.0.0
MAPTOY_SERVER_PORT=4004
MAPTOY_STORAGE_DATA_DIR=./.data
MAPTOY_LOGGING_LEVEL=info
MAPTOY_LOGGING_API_TRAFFIC_DIR=${MAPTOY_STORAGE_DATA_DIR}/logs/api
MAPTOY_LOGGING_PROVIDER_TRAFFIC_DIR=${MAPTOY_STORAGE_DATA_DIR}/logs/provider
MAPTOY_LOGGING_TRAFFIC_MAX_BYTES=10485760
MAPTOY_LOGGING_TRAFFIC_MAX_FILES=5
MAPTOY_TILES_MAX_BYTES=10485760
MAPTOY_JOBS_MAX_CONCURRENCY=1
MAPTOY_EXPORTS_MAX_PIXELS=100000000
MAPTOY_STORAGE_TEMP_DIR=${MAPTOY_STORAGE_DATA_DIR}/tmp
MAPTOY_PHOTOS_DIR=./.photos
# Provider-specific secrets, for example:
# MAPTOY_EXAMPLE_API_KEY=
```

Beim Start wird die gesamte Konfiguration validiert. Fehlerhafte oder fehlende Pflichtwerte führen zu einer klaren Fehlermeldung. Konfigurationsschemata unterscheiden `server-secret`, `public-client` und `public`. Das Backend gibt echte Server-Secrets weder an das Frontend noch in Logs oder Jobparameter weiter. Die Kategorie `public-client` ist als Adapter-Vertrag vorgesehen, wird in v1.0 aber von keinem ausgelieferten Adapter benötigt.

`MAPTOY_TILES_MAX_BYTES` begrenzt sowohl Providerantworten als auch den Body der Tile-Upload-Route. Das Limit wird für Uploads routenspezifisch angewendet und darf insbesondere Map-Set-JSON oder andere API-Bodies nicht unbeabsichtigt begrenzen.

`MAPTOY_PHOTOS_DIR` bezeichnet das bestehende Fotoverzeichnis auf dem Host. Docker
Compose bindet es automatisch read-only nach `/photos` ein und übergibt maptoy nur
diesen festen internen Pfad. Weder Host- noch Containerpfad werden über die API
ausgegeben. Für
Bilddateigröße, dekodierte Pixelzahl, Vorschauabmessungen und Scanumfang gelten
eigene konfigurierbare Grenzen; ihre Defaults und Hartgrenzen werden in Phase 5 mit
repräsentativen Bildbeständen gemessen und nicht vom Tile-Bytelimit abgeleitet.

`MAPTOY_STORAGE_DATA_DIR` bezeichnet auf dem Host den ausdrücklich gewählten, beschreibbaren Pfad für persistente Fachdaten. Docker Compose bind-mountet genau diesen Pfad nach `/data`; die Anwendung legt die Datenbank immer als `maptoy.sqlite` in diesem Anwendungsdatenverzeichnis an. Ein separater Datenbankpfad ist nicht konfigurierbar. Die beiden getrennten, größenrotierten JSONL-Traffic-Logs für Client/API- und Backend/Tile-Provider-Verkehr sind Betriebsartefakte und erhalten eigene konfigurierbare Hostverzeichnisse und Bind-Mounts; ihre Vorgaben liegen unterhalb von `MAPTOY_STORAGE_DATA_DIR`, dürfen aber auf andere Hostpfade zeigen. Für persistente Fachdaten oder Traffic-Logs werden weder benannte noch anonyme Docker-Volumes angelegt. Dadurch bleiben Datenbank, Tile-Archiv, Exporte, Fotovorschauen, Logs und weitere persistente Artefakte auf dem Host unmittelbar sichtbar, sicherbar und kontrollierbar. Ein Backup des Anwendungsdatenverzeichnisses umfasst Fotokatalog, Metadaten und Vorschauen, aber ausdrücklich nicht die extern referenzierten Originalfotos. Das konfigurierte Fotoverzeichnis und extern konfigurierte Traffic-Logs müssen bei gewünschter Erhaltung separat gesichert werden.

Schema-Version 4 ist die produktive Datenbank-Baseline. Frühere, ausschließlich während der Entwicklung verwendete Schema-Versionen sind keine unterstützten Upgradequellen und existieren nicht im Produktivbetrieb. Alle neuen Datenbanken werden direkt mit Baseline 4 angelegt; künftige nummerierte SQL-Migrationen beginnen oberhalb dieser Version und müssen bestehende Baseline-4-Daten erhalten.

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
- explizite Host-Bind-Mounts von `MAPTOY_STORAGE_DATA_DIR` nach `/data` sowie der beiden getrennt konfigurierbaren Traffic-Log-Verzeichnisse; weder für Fachdaten noch Traffic-Logs benannte oder anonyme Docker-Volumes
- expliziter, ausschließlich lesbarer Host-Bind-Mount für `MAPTOY_PHOTOS_DIR`;
  der Container erhält dort keine Schreibberechtigung
- Healthcheck gegen den Liveness-Endpunkt
- Readiness-Prüfung für Datenbank und Schreibbarkeit des Anwendungsdatenverzeichnisses sowie beider konfigurierter Traffic-Log-Verzeichnisse
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
- Größenlimits für Tile-Uploads, Layer-Assets, Bilddateien, dekodierte Bildpixel,
  Vorschauen, Scans, Exporte, Auflösung und Jobanzahl
- Dateityp anhand tatsächlicher Inhalte beziehungsweise sicherer Decoder prüfen
- Timeouts, Response-Größenlimits, kontrollierte Retries und Circuit-Breaker-artige Pause bei anhaltenden Anbieterfehlern
- Log-Redaktion für API-Schlüssel, Authorization-Header und Query-Secrets
- HTML-/Script-Inhalte aus Attribution oder Metadaten nicht ungeprüft rendern
- Upload-Dateien außerhalb öffentlich ausgelieferter Verzeichnisse speichern;
  Bildoriginale ausschließlich extern referenzieren und nicht in das
  Anwendungsdatenverzeichnis kopieren
- Fotoverzeichnis ausschließlich serverseitig konfigurieren und lesbar einbinden;
  Scan- und Assetzugriffe auf normalisierte relative Pfade begrenzen,
  Symlink-Ausbrüche verhindern und absolute Pfade nicht an Client oder Plugins geben
- EXIF- und andere Bildmetadaten nur gezielt übernehmen, die Herkunft automatisch
  übernommener GPS-Koordinaten nachvollziehbar speichern und nicht benötigte
  Metadaten aus Vorschauen und Exporten entfernen
- nur beim Build/Deployment zugelassene Plugins laden; Plugin-Hooks erhalten kontrollierte Asset-, Logging- und Rendering-Schnittstellen statt beliebiger Pfad- oder Secret-Zugriffe
- Content-Security-Policy standardmäßig auf maptoy selbst beschränken und externe Ursprünge erst mit einem künftig tatsächlich aktivierten Adapter gezielt freigeben
- Datenbankmigrationen und Cache-Löschungen transaktional beziehungsweise wiederaufnehmbar gestalten

Die Anwendung besitzt in v1.0 keine eigene Authentifizierung. Damit ist auch der schreibende Tile-Upload nur für einen privaten, vertrauenswürdigen Betrieb vorgesehen und darf nicht ungeschützt für fremde Clients veröffentlicht werden. Wird maptoy über ein nicht vertrauenswürdiges Netz erreichbar gemacht, muss der vorgeschaltete Reverse Proxy den Zugriff authentifizieren und autorisieren. Diese Betriebsgrenze wird beim Endpunkt und in der integrierten Dokumentation sichtbar beschrieben.

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
- Tile-Upload-Validierung für Media-Type, Dateisignatur, Format, Policy, Capability, Bounds sowie Größen- und Speicherlimit
- Revisionsherkunft und Deduplizierung von Uploads sowie gemeinsame Koordination konkurrierender Uploads und Providerabrufe
- Auswahlregeln für `current`, Snapshot, `asOf` und explizite Tile-Revision
- Retry-/Backoff- und Rate-Limit-Logik mit kontrollierter Zeit
- Exportgrößen- und Tile-Anzahlschätzung
- Map-Adapter-Vertrag, Capability-Auswertung und adapterneutrale Viewport-Ereignisse
- gemeinsame Geometrie- und Laufzeitschemata für Punkt, Linie und Fläche einschließlich
  Feature-/Stützpunkteigenschaften, Ringvalidierung und Trennung von Geometrie und Stil
- adapterneutrale Darstellungsdeskriptoren und Symbolisierung für Punkt, Linie und Fläche
- den zustandsabgeleiteten Deskriptor für XYZ-Tile-Raster, Beschriftung und lokale
  Maßstabsleiste je Tile,
  Capability-Abgleich sowie kanonische Source-Tile-Auswahl bei Viertel-Zoom,
  Tile-Größen-Offset und World-Wrapping
- geodätische Distanz und Rundung metrischer Maßstabswerte für definierte
  Bildschirmbreiten und Breitengrade
- Plugin-Manifest, Schemas, Versionskompatibilität und Datenmigrationen
- GPX-/GeoJSON-Normalisierung sowie EXIF-Ausrichtung und GPS-Extraktion
- Fotoscan-Fingerprints, inkrementelle Änderungsentscheidung und Regeln für
  `coordinateSource=exif|manual|none`, insbesondere Schutz manueller Korrekturen
  und bewusster Entfernung bei erneutem Scan
- Dokumentations-Metadaten, Sprach-Fallback, Ankererzeugung und sprachbezogener Suchindex

### 11.2 Integrationstests

- lokaler Fake-Tile-Server für Treffer, 404, 429, Redirect, Timeout und fehlerhaften Content-Type
- Cache-Miss, Cache-Hit, atomarer Schreibvorgang und parallele identische Anfragen
- bedingte Validierung mit 304, unverändertem 200-Inhalt und geändertem 200-Inhalt
- Revisionsfolge `A → B → A` mit erneuter Verwendung der Content-Datei, aber vollständiger zeitlicher DB-Historie
- Tile-Upload mit anschließend bytegleichem normalem und `cache-only`-Abruf ohne Providerkontakt
- wiederholter identischer Tile-Upload ohne neue Revision oder zusätzlichen Speicher sowie geänderter Upload mit unveränderlicher Historie und korrekter Entstehungsquelle
- abgewiesene Tile-Uploads bei ungültigem oder unpassendem Inhalt, deaktiviertem Archiv sowie überschrittenem Body- oder Speicherlimit ohne partielle Datei- oder Metadatenreste
- deterministische Historie bei konkurrierendem Upload und Providerabruf desselben logischen Tiles
- dauerhafte Revisionshistorie, Content-Deduplizierung, Snapshot-Auswahl und zeitbezogener Abruf
- Hash-/Metadatenvergleich zweier Cache-Stände und Schutz referenzierter Revisionen vor Löschung
- Datenbankmigration und Neustart mit laufendem Job
- Abbruch, Pause, Wiederaufnahme und teilweise fehlgeschlagener Batch
- Export mit Track- und Bildoverlay
- persistenter, assetfreier Tile-Grid-Layer mit korrekten `z/x/y`-Beschriftungen
  bei Pan, Viertel-Zoomstufen, 256-/512-Pixel-Tiles, Zoom-Offset und World-Wrapping
- koordinatenabhängige Maßstabsleisten in jedem sichtbaren Tile an mehreren
  Breitengraden sowie konsistente Neuberechnung nach Viewport- und Map-Set-Wechsel
- Plugin-Registry und isolierter Aufruf von Import-, Asset- und Export-Hooks
- Verhalten bei fehlendem oder inkompatiblem Plugin ohne Verlust persistierter Layerdaten
- Scan des konfigurierten Read-only-Fotoverzeichnisses mit automatischer EXIF-Position,
  atomarer Vorschauerzeugung und Nachweis, dass kein Originalbild unter
  `MAPTOY_STORAGE_DATA_DIR` gespeichert wird
- inkrementeller erneuter Fotoscan mit unveränderten, geänderten und fehlenden
  Dateien; manuell korrigierte oder entfernte Positionen bleiben erhalten, während
  weiterhin aus EXIF stammende Positionen geänderter Quelldateien aktualisiert werden
- Abbruch, Wiederaufnahme und Neustart-Recovery eines persistenten Fotoscan-Jobs
  sowie verständliche Diagnose eines nicht verfügbaren Fotoverzeichnisses
- Contract-Test des Leaflet-/XYZ-Adapters und eines minimalen Fake-Adapters
- Darstellung, Aktualisierung, Reihenfolge und Entfernung der gemeinsamen Punkt-,
  Linien- und Flächendeskriptoren im Leaflet-/XYZ-Adapter und Fake-Adapter
- explizite Löschung einer unreferenzierten Tile-Revision ohne Beeinflussung anderer Revisionen oder Snapshots
- Erzeugung von `openapi.json` aus den Server-Schemas und Abgleich aller dokumentierten Endpunkte
- Erzeugung einer frischen Datenbank aus Schema-Baseline 4 sowie verlustfreies Öffnen und spätere Migrieren bestehender Baseline-4-Datenbanken
- getrennte Rotation und Secret-Redaktion der API-/Provider-Traffic-Logs sowie Readiness-Fehler bei nicht beschreibbaren Daten- oder Logverzeichnissen

Tests verwenden keine echten öffentlichen Tile-Dienste.

### 11.3 End-to-End- und Betriebstests

- Map Set erstellen, Karte laden und Attribution sehen
- Gebiet auswählen, Schätzung bestätigen, Download abschließen und Coverage prüfen
- einen Snapshot anlegen, ein Tile aktualisieren und aktuellen, historischen sowie verglichenen Stand anzeigen
- Track und GPS-getaggtes Bild über Panel und Dialoge des Standard-Map-View
  importieren, bei weiterhin sichtbarer Karte konfigurieren und gemeinsam
  exportieren
- ein externes Bildverzeichnis rekursiv scannen, automatisch positionierte Bilder
  ohne Einzelbestätigung anzeigen, eine Position korrigieren und deren Erhalt nach
  erneutem Scan prüfen
- Export mit Plugin-Layern erstellen und Ergebnis herunterladen
- englische, deutsche und thailändische Dokumentationsroute öffnen, Fallback prüfen und einen kontextbezogenen Hilfelink verfolgen
- englische und deutsche Suche prüfen; für Thai entweder funktionsfähige Suche oder den ausdrücklich deaktivierten Zustand mit Verweis auf die englische Suche prüfen
- Anwendung unter einem Präfix-entfernenden Reverse-Proxy-Unterpfad laden; Assets, API, Tiles, Downloads, Dokumentation, Suche und pfadbasierte Deep Links funktionieren
- Container mit leeren sowie vorhandenen Host-Bind-Mounts für Anwendungsdaten und
  Traffic-Logs sowie des externen Read-only-Fotoverzeichnisses starten
- SIGTERM während eines Jobs und anschließender konsistenter Neustart

### 11.4 Manuelle API-Tests mit Bruno

Die unter `tests/bruno/` versionierte Bruno Collection ergänzt automatisierte Tests um nachvollziehbare manuelle Diagnose- und Smoke-Abläufe. Sie enthält mindestens Health/Readiness, Map-Set-Verwaltung, Tile-Abruf mit allen Refresh-Modi, Tile-Upload, Revisionshistorie und Snapshot-Vergleich, Batch-Jobs, Layer-Asset-Upload, Fotoverzeichnisstatus, Fotoscan-Jobs und Export. Zustandsverändernde oder löschende Requests sind eindeutig benannt und nicht Teil eines unabsichtlichen Standardlaufs.

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
- mehrstufiges Dockerfile und Compose-Beispiel mit explizitem Host-Bind-Mount für das Anwendungsdatenverzeichnis erstellen
- gemeinsame semantische Versionierung aller auslieferungsrelevanten maptoy-Anwendungspakete und einen Changelog einführen; Spikes und die optionale Firefox-Erweiterung werden unabhängig und nur bei eigenen Änderungen versioniert

**Ergebnis/Akzeptanz**

- Ein Befehl startet die Entwicklungsumgebung, ein weiterer alle Qualitätschecks.
- Der Container startet ohne Root-Rechte, liefert SPA und API auf einem Port und wird gesund gemeldet.
- Datenbank und spätere persistente Fachdaten liegen über `MAPTOY_STORAGE_DATA_DIR` in einem direkt zugänglichen Hostverzeichnis; separat konfigurierte Betriebsartefakte verwenden ebenfalls explizite Host-Bind-Mounts, und Compose legt keine Docker-verwalteten Volumes an.
- Die vollständige englische Startseite sowie deutsche und thailändische Routen mit funktionierendem Englisch-Fallback sind über die Hauptnavigation erreichbar.
- Ein automatisierter Test bestätigt den Betrieb hinter einem Präfix-entfernenden Proxy-Unterpfad.
- Der Abschluss der Phase 1 ist als gemeinsame Version `0.0.1` in allen Paketmanifesten und im Changelog nachvollziehbar.
- Ein automatisierter Test verhindert voneinander abweichende Versionen in den auslieferungsrelevanten maptoy-Anwendungsmanifesten; Spike-Manifeste und die Firefox-Erweiterung sind davon ausgenommen. Ein eigener Test hält Paket- und Firefox-Manifest der Erweiterung untereinander konsistent.

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

### Phase 3a: Externes Tile-Seeding über die API

**Status:** abgeschlossen am 24. August 2026 als Version `0.0.7`

**Aufgaben**

- die Entstehungsquelle einer Tile-Revision (`provider` oder `upload`) über eine nummerierte SQL-Migration oberhalb der produktiven Schema-Baseline 4 ergänzen und vorhandene Baseline-4-Daten verlustfrei als Providerrevisionen übernehmen
- gemeinsamen Servicepfad für Providerinhalte und hochgeladene Tile-Bytes schaffen, ohne Providerabruf beim Upload
- `POST api/map-sets/:id/tiles/:z/:x/:y` mit unverändertem Bild-Body, gemeinsamem Antwortschema und routenspezifischem `MAPTOY_TILES_MAX_BYTES`-Limit implementieren
- Content-Type und Dateisignatur gegen das konfigurierte Tile-Format prüfen sowie Koordinaten-, Bounds-, Cache-Policy-, Capability-, Größen- und Speicherregeln wiederverwenden
- Upload, Providerabruf und Revalidierung je logischem Tile gemeinsam koordinieren; Hash-Deduplizierung, zeitliche Revisionen und atomare Dateischreibvorgänge beibehalten
- präzise Fehlerverträge für Media-Type, Bildinhalt, deaktiviertes Archiv, Bodylimit und Speicherlimit dokumentieren
- OpenAPI-/Contract-Schemas, integrierte API-Dokumentation, Bruno-Request sowie Unit- und Integrationstests ergänzen; eine eigene UI ist für diesen Schritt nicht vorgesehen
- die fehlende Anwendungsauthentifizierung und den ausschließlich vertrauenswürdigen Betrieb des schreibenden Endpunkts samt Reverse-Proxy-Schutz dokumentieren

**Ergebnis/Akzeptanz**

- Ein gültiger Upload legt mit `201` genau eine Revision der Herkunft `upload` an; der normale und der `cache-only`-Abruf liefern anschließend exakt dieselben Bytes ohne Providerkontakt.
- Ein zum aktuellen Stand identischer Upload antwortet mit `200` und `created: false`, aktualisiert nur die Zeitmetadaten und erzeugt weder eine neue Revision noch zusätzlichen Speicherbedarf.
- Ein geänderter oder erneut auftretender Inhalt folgt denselben unveränderlichen Historien- und Deduplizierungsregeln wie Providerinhalte.
- Ungültige, unpassende, zu große oder durch Policy, Capability beziehungsweise Speicherlimit ausgeschlossene Uploads werden mit dem dokumentierten Statuscode abgewiesen und hinterlassen keine partielle Datei oder Metadaten.
- Gleichzeitiger Upload und Providerabruf desselben logischen Tiles erzeugen eine deterministische, unbeschädigte Revisionshistorie.
- Die Revisionsherkunft ist in API und Persistenz nachvollziehbar; bestehende Datenbanken ab Baseline 4 werden verlustfrei migriert.
- Die Dokumentation weist sichtbar darauf hin, dass der weiterhin unauthentifizierte Endpunkt nur in vertrauenswürdiger Umgebung oder hinter Zugriffsschutz betrieben werden darf.

Die Cache-Abdeckung wurde unabhängig vom späteren Download-Worker umgesetzt. Durch
die Anforderung, auch große externe Bildverzeichnisse sicher und wiederaufnehmbar zu
scannen, führt Phase 5 nun den minimalen gemeinsamen persistenten Jobkern ein. Phase
6 baut darauf mit Downloadschätzung, Provider-Limits und Tile-Download-Worker auf.
Einfache Overlay-Chips für aktuell bearbeitete Coverage-Bereiche werden weiterhin
erst mit dem Download-Worker ergänzt.

### Phase 4: Cache-Abdeckung

**Status:** umgesetzt und veröffentlicht mit `0.1.1` am 27. August 2026

**Aufgaben**

- effiziente Abdeckungsabfrage und Aggregation entwickeln
- Zoomfilter und Statusklassen für frisch, fehlend und veraltet implementieren
- Coverage-Layer über die neutrale Adapter-Schnittstelle bauen
- Auswahl von aktuellem Stand, Snapshot und Zeitpunkt ergänzen
- Detailansicht mit Tile-Zahl, Revisionen, Größe und Aktualität ergänzen
- Performance für große Caches messen und bei Bedarf Indizes oder vorberechnete Aggregate ergänzen

**Ergebnis/Akzeptanz**

- Die Abdeckung eines typischen Caches wird ohne Übertragung sämtlicher Tile-Datensätze flüssig dargestellt.
- Aktueller Stand, Snapshots und Zeitstände lassen sich in aggregierten Rasterzellen untersuchen.
- Die Anzeige stimmt in Stichproben mit dem Dateisystem und den Cache-Metadaten überein.

### Phase 5: Layer-Plugin-System und externer Fotokatalog

**Status:** Kernumfang am 28. August 2026 als Version `0.2.0` veröffentlicht;
Layer-Bedienung, Schemamigration und Navigation am 29. August 2026 mit Version
`0.2.1` verfeinert; Photo-Domäne und Betriebskonfiguration am 31. August 2026 mit
Version `0.3.0` konsolidiert; verbleibende Job-, Skalierungs- und Limit-Arbeiten am
31. August 2026 abgeschlossen und mit Version `0.3.1` veröffentlicht

**Aufgaben**

- Registry, Manifestprüfung, Capability-Modell und SDK-Kompatibilitätsprüfung implementieren
- wiederverwendbare, versionierte Geometrie- und Laufzeitschemata für Punkt, Linie und
  Fläche im Layer-Plugin-SDK implementieren; Feature-Eigenschaften,
  Linienstützpunkteigenschaften und Darstellung voneinander trennen
- typisierte, adapterneutrale Darstellungsdeskriptoren und Symbolisierung für Punkte,
  Linien und Flächen im Map-Adapter-SDK ergänzen und im Leaflet-/XYZ- sowie
  Fake-Adapter implementieren
- generische Layer-Persistenz, Assetkatalog, kontrollierten Speicher für verwaltete
  Nicht-Bild-Assets und Bildvorschauen sowie die CRUD-API bauen
- ein optional einblendbares Layer-Panel mit durchsuchbarem Dropdown-Baum,
  Gruppencheckboxen und genau einem ausgewählten Layer-Editor sowie fokussierte
  Plugin-, Import-, Scan- und Assetdialoge in den bestehenden Map View integrieren;
  generische Baum-, Dropdown- und Editorbausteine als wiederverwendbare
  Vue-Komponenten auslagern; keine eigene Layer-Route oder Hauptansicht anlegen
- Layer-Instanzen als globalen Overlay-Stack unabhängig von Map Sets persistieren
  und beim Wechsel der Basiskarte mit Sichtbarkeit, Reihenfolge und Konfiguration
  wieder an den neu erzeugten Renderer anhängen
- Plugin-Kategorie und `/`-segmentierte Layernamen als erweiterbare Hierarchie im
  Layer-Panel darstellen; neue Layer dürfen einen expliziten Namen erhalten oder
  verwenden bei leerem Feld einen freien, je Kategorie nummerierten Standardnamen
- Datei-Upload verwalteter Nicht-Bild-Assets über Frontend/API mit generierten
  Asset-IDs, Status, Hash und kontrolliertem Speicherort umsetzen
- ein serverseitig konfiguriertes und ausschließlich lesbares Fotoverzeichnis sowie
  sichere Auflösung relativer Pfade ohne Offenlegung absoluter
  Serverpfade implementieren
- minimalen persistenten Jobkern mit Polling, Fortschritt, Pause, Fortsetzung,
  Abbruch und Neustart-Recovery implementieren und einen optional rekursiven,
  inkrementellen Fotoverzeichnisscan als ersten Jobtyp bereitstellen
- Fotokatalog und Vorschau-Speicher so umsetzen, dass Originalfotos extern bleiben,
  nur Metadaten und abgeleitete Vorschauen persistiert und geänderte beziehungsweise
  fehlende Quellen ohne automatische Löschung erkannt werden
- kontrollierte Frontend-, Import-, Asset- und Server-Rendering-Hooks bereitstellen
- Schema-Migrationen und Verhalten bei fehlenden oder inkompatiblen Plugins umsetzen
- Track-Referenz-Plugin als Spezialisierung der gemeinsamen Linienbasis für
  GPX/GeoJSON, Track- und Stützpunktmetadaten einschließlich optionaler Zeitstempel,
  Stil, interaktive Karte und normalisierte Geometrie implementieren
- Bild-Referenz-Plugin als Spezialisierung der gemeinsamen Punktbasis für EXIF/GPS,
  manuelle Koordinaten, Bildmetadaten, Vorschaubilder und Kartenanzeige implementieren
- EXIF-GPS beim ersten Scan automatisch als wirksame Position mit Herkunft
  `exif` übernehmen; Korrektur und Entfernung ohne getrennte
  Erkannt-/Akzeptiert-Koordinaten ermöglichen und vor Überschreiben bei erneutem
  Scan schützen
- Dateigrößen-, Decoder-, Metadaten- und Pfadschutz für Plugin-Assets ergänzen
- Standard- und Hartgrenzen für Bildgröße, dekodierte Pixel, Vorschau,
  Scan-Batchgröße und parallele Decoder anhand repräsentativer Bildverzeichnisse
  messen, konfigurieren und dokumentieren
- SDK-Dokumentation und Contract-Test-Suites erstellen

**Ergebnis/Akzeptanz**

- Ein Track und ein GPS-getaggtes Bild lassen sich importieren, konfigurieren, anordnen und im Leaflet-/XYZ-Adapter darstellen.
- Beim Wechsel des Map Sets bleiben dieselben globalen Overlay-Layer mit ihrer
  Sichtbarkeit, Reihenfolge und Konfiguration erhalten und werden am neuen Renderer
  dargestellt, sofern dieser Layer-Rendering unterstützt.
- Layer erscheinen unter ihrer Plugin-Kategorie und lassen sich über Namen wie
  `Reisen/2026/Alpen` ohne zusätzliche Ordnerdatensätze weiter strukturieren.
- Kategorien und sämtliche aus Namenssegmenten entstehenden Ordnerebenen sind im
  durchsuchbaren Dropdown-Baum unabhängig ein- und ausklappbar; der Zustand bleibt
  lokal im Browser erhalten. Layer- und Gruppencheckboxen ändern die Sichtbarkeit,
  ohne den Dropdown zu schließen oder die Editorauswahl zu ändern.
- Der Add-Layer-Dialog bietet die Kategorien als visuelle Auswahl an. Nach dem
  Anlegen wird der neue Layer ausgewählt, als einziger Editor dargestellt und der
  primäre Import- oder Scan-Einstieg fokussiert.
- Sämtliche Layeraufgaben der v1 sind über das optionale Panel und die zugehörigen
  Dialoge im Standard-Map-View erreichbar; es gibt keine eigene Layer-Hauptansicht
  oder `/layers`-Route, und die Coverage-Ansicht bleibt unverändert auf das
  Tile-Archiv fokussiert.
- Das konfigurierte Read-only-Fotoverzeichnis kann rekursiv und inkrementell als
  persistenter Job gescannt werden. Originalbilder verbleiben außerhalb des
  Anwendungsdatenverzeichnisses; SQLite enthält den Katalog und
  `MAPTOY_STORAGE_DATA_DIR` ausschließlich abgeleitete Vorschauen und temporäre
  Verarbeitungsartefakte. Neu gefundene Fotos ohne gültige EXIF-GPS-Position werden
  nicht katalogisiert und im Scan-Ergebnis als übersprungen ausgewiesen.
- EXIF-GPS-Positionen sind ohne Einzelbestätigung unmittelbar nutzbar. Manuelle
  Korrekturen und bewusst entfernte Positionen überleben erneute Scans; fehlende oder
  geänderte Originale führen zu nachvollziehbaren Zuständen statt Datenverlust.
- Punkt, Linie und Fläche sind als pluginunabhängige, versionierte Geometriegrundlagen
  mit getrennten fachlichen Eigenschaften und Darstellungsstilen verfügbar. Der
  Leaflet-/XYZ-Adapter und der Fake-Adapter bestehen dafür dieselben Contract-Tests;
  ein eigenes Flächen-Referenz-Plugin ist für v1 nicht erforderlich.
- Das Track-Plugin verwendet ausschließlich die allgemeine Linienbasis einschließlich
  optionaler Stützpunktmetadaten. Das Bild-Plugin verwendet für GPS- und manuell
  positionierte Bilder ausschließlich die allgemeine Punktbasis.
- Track- und Bild-Referenz-Plugin verwenden ausschließlich die veröffentlichten Plugin-Schnittstellen und bestehen dieselbe Contract-Test-Suite.
- Ein deaktiviertes oder fehlendes Plugin verursacht keinen Datenverlust; ungültige beziehungsweise inkompatible Zustände werden verständlich angezeigt.
- Es kann kein ausführbarer Plugin-Code über API oder Weboberfläche installiert werden.

**Abschlussarbeiten**

- Fortschrittszähler und Zusammenfassungen von Fotoscan-Jobs werden bei Pause,
  Fortsetzung und Neustart-Recovery durch persistente Cursor konsistent gehalten. Eine erneut begonnene
  inkrementelle Verarbeitung darf bereits gezählte Dateien nicht ein zweites Mal
  addieren; Integrationsprüfungen decken Pause, Fortsetzung, Abbruch und Recovery
  einschließlich `completed + skipped + failed <= total` ab.
- Standard- und Hartgrenzen für Fotodateigröße, dekodierte Pixel,
  Vorschauabmessungen, Scan-Batchgröße, parallele Decoder und Dateianzahl sind mit
  repräsentativen Verzeichnissen gemessen. Messumgebung, Laufzeit, Speicherbedarf,
  gewählte Defaults und Einzelfehlerdiagnosen sind reproduzierbar dokumentiert.
- Für abgeschlossene Jobs und ihre begrenzte Fehlerhistorie ist eine konfigurierbare
  Aufbewahrungsstrategie mit stündlicher, beim Start ausgeführter und manuell
  auslösbarer Bereinigung umgesetzt. Wartende, laufende und pausierte Jobs bleiben
  geschützt; Phase 7 erweitert dieselbe Entscheidung um fertige Exportdateien.
- Der Fotokatalog wird im Frontend bedarfsgerecht und cursor-basiert geladen, statt
  beim Initialisieren sämtliche Assetseiten aller Layer abzurufen. Die Verwaltung
  lädt explizit weitere Seiten; nur sichtbare Fotolayer werden für die Karte
  vollständig nachgeladen.

### Phase 5a: Zustandsabgeleitete dekorative Layer

**Status:** Interaktiver Kernumfang am 30. August 2026 mit Version `0.2.3`
veröffentlicht; die serverseitige Ausgabe desselben Deskriptors bleibt Bestandteil
von Phase 7

**Aufgaben**

- einen versionierten, adapterneutralen Deskriptor `xyz-tile-grid` im Map-Adapter-
  und Layer-Plugin-SDK ergänzen, der Raster, `z/x/y`-Beschriftung und lokale
  Maßstabsleiste je Tile gemeinsam konfiguriert; Renderer-Manifeste weisen
  unterstützte Deskriptorarten aus und Plugins deklarieren ihre Anforderungen
- bestehende XYZ-Umrechnungen in `map-core` für sichtbare kanonische Tile-Bereiche
  wiederverwenden und dort gemeinsame, projektionsunabhängig nutzbare Grundlagen für
  geodätische Distanz sowie gut lesbar gerundete metrische Maßstabswerte ergänzen
- den tatsächlichen ganzzahligen Source-Zoom der aktiven Basiskachel als Grundlage
  des Rasters verwenden; Viertel-Zoomstufen, Tile-Größe `256` beziehungsweise `512`,
  Renderer-Zoom-Offset und World-Wrapping dürfen Beschriftung und geladene Tile-URL
  nicht auseinanderlaufen lassen
- `xyz-tile-grid` im Leaflet-/XYZ-Adapter als dynamisch aktualisierte weltbezogene
  Darstellung der sichtbaren Tile-Grenzen mit kanonischer Beschriftung `z/x/y` und
  einer eigenen Maßstabsleiste in jeder Tile-Zelle implementieren;
  deren feste prozentuale Breite wird auf die lokale metrische Länge des Source-Tiles
  abgebildet und mit gut lesbaren, segmentierten Intervallen dargestellt; Pan und
  Zoom erzeugen keine persistierten Features und bauen die Layer-Instanz nicht neu
  auf
- den Deskriptor im Fake-Adapter und in gemeinsamen Adapter-Contract-Tests abdecken;
  Anfügen, Aktualisieren, Sichtbarkeit, Deckkraft, Entfernen, Renderer-Neuaufbau und
  vollständiges Aufräumen prüfen
- das vertrauenswürdige Plugin `tile-grid-layer` unter der Kategorie `Decorations`
  registrieren; es veröffentlicht den Dekorationsdeskriptor im allgemeinen
  Layer-Lebenszyklus, verwendet ein leeres Datenobjekt und besitzt weder Asset-,
  Import- noch Job-Hooks
- einen gemeinsamen schemabasierten Konfigurationseditor für einfache Plugins sowie
  eine Registry-Auflösung für Spezialeditoren einführen; die Layer-Editor-Shell darf
  für den neuen Plugin-Typ keine weitere Plugin-ID-Verzweigung erhalten
- Tile-Raster, Beschriftung und Maßstabsleiste jeweils konfigurierbar machen;
  Linien-/Textfarben und eine Maßstabsbreite zwischen 25 und 100 Prozent der
  Tile-Breite als Plugin-Konfiguration, Deckkraft und Zoomgrenzen weiterhin
  ausschließlich als allgemeine Layerwerte führen
- SDK- und Plugin-Dokumentation um zustandsabgeleitete Layer,
  Deskriptor-Capabilities und lokale Dekorationen je Tile ergänzen

**Ergebnis/Akzeptanz**

- Jedes sichtbare Basiskarten-Tile ist mit genau der kanonischen Koordinate `z/x/y`
  seines tatsächlich verwendeten Source-Tiles beschriftet.
- Raster und Beschriftungen bleiben bei Pan, Viertel-Zoomstufen,
  256-/512-Pixel-Tiles, Renderer-Zoom-Offset, Datumsgrenzenüberschreitung und
  World-Wrapping mit der Basiskarte deckungsgleich.
- Jedes sichtbare Tile enthält eine kleine metrische Maßstabsleiste, die ohne
  verzögerte Plugin-Neumontage auf Source-Zoom und lokale geografische Breite
  reagiert, bei gleicher konfigurierter Breite lesbare Distanzen ausweist sowie in
  interaktiver Ansicht und späterem Export dieselbe Distanz-, Rundungs- und
  Segmentierungslogik verwendet.
- Der dekorative Layer wird über den vorhandenen Add-Layer-Dialog angelegt und nutzt
  unverändert Name, Hierarchie, Persistenz, Sichtbarkeit, Reihenfolge, Deckkraft,
  Zoomgrenzen, Diagnose und Löschen des allgemeinen Layer-Systems.
- Anlegen, Anzeigen und Aktualisieren des Layers erzeugen keine Assets, Importe,
  Jobs, zusätzlichen API-Endpunkte oder persistierten Laufzeitfeatures.
- Ein Map-Set-Wechsel berechnet Raster und Maßstab für die neue Basiskarte neu, ohne
  die Layer-Instanz oder ihre Konfiguration zu ersetzen.
- Bei einem Renderer ohne benötigte Deskriptorarten bleiben Instanz und Konfiguration
  erhalten; das Layer-Panel zeigt eine verständliche Inkompatibilitätsdiagnose.
- Wiederholter Renderer-Aufbau hinterlässt keine mehrfachen Event-Listener oder
  verwaisten Raster- beziehungsweise Maßstabselemente.

### Phase 6: Batch-Downloads und Erweiterung des Job-Systems

**Aufgaben**

- den in Phase 5 eingeführten persistenten Jobkern und In-Process-Worker um
  Tile-Download-Jobs und deren spezifische Fortschritts-/Fehlerdaten erweitern
- Gebiet-/Zoom-Schätzung mit Duplikat- und Cache-Berücksichtigung bauen
- providerbezogene Rate-Limits, Parallelität, Retries und `Retry-After` umsetzen
- Pause, Fortsetzung, Abbruch und Neustart-Recovery für Tile-Download-Einheiten auf
  Grundlage des gemeinsamen Jobkerns ergänzen
- Download-Ansicht mit Gebietsauswahl und Jobfortschritt erstellen
- laufende Download-Einheiten als einfache Chip-Overlays über der Coverage-Karte darstellen, ohne sie in Zellstatus oder Farblegende zu integrieren
- konfigurierte Speicher-, Größen- und Betriebsgrenzen durchsetzen und Terms-/Attributionshinweise vor Start anzeigen

**Ergebnis/Akzeptanz**

- Eine kleine definierte Region kann vollständig vorab geladen werden.
- Schätzung und tatsächliche Zahl der bearbeiteten Tiles sind nachvollziehbar.
- 429-Antworten verlangsamen den Worker; Abbruch und Neustart führen nicht zu beschädigten Daten.
- Die Coverage-Ansicht zeigt die vom Worker aktuell bearbeiteten Tiles konsistent als separate Chip-Overlays an.
- Die Oberfläche macht die Eigenverantwortung sichtbar, trifft aber keine rechtliche Zulässigkeitsentscheidung für den Nutzer.

### Phase 7: Kartenbild-Export

**Aufgaben**

- Exportmodell, Schätzung und Job-Integration implementieren
- Auswahl des aktuellen Stands, eines Snapshots, eines Zeitstands oder expliziter Revisionen in Exportaufträge integrieren
- Tiles zusammensetzen, zuschneiden und in PNG/JPEG/WebP kodieren
- gewählte Zielprojektionen ergänzen
- serverseitige Layer-Plugin-Hooks in den Exportablauf integrieren
- Track- und Bild-Referenz-Plugins für alle unterstützten Zielprojektionen rendern
- den Deskriptor `xyz-tile-grid` serverseitig rendern; das XYZ-Raster bezeichnet
  weiterhin die Source-Tiles und wird mit `z/x/y`-Beschriftung sowie der lokal je
  Tile berechneten Maßstabsleiste in die Zielprojektion abgebildet
- Layer-Reihenfolge, Deckkraft, Attribution und Fehlerstrategie konfigurierbar machen
- Export-UI mit Vorschau, Fortschritt, Ergebnisdownload und Aufräumregeln bauen

**Ergebnis/Akzeptanz**

- Ein Kartenausschnitt wird in jeder unterstützten Ausgabeart und Projektion korrekt erzeugt.
- Testtrack und GPS-Bild liegen nach Projektion visuell und numerisch an den erwarteten Koordinaten.
- Tile-Grenzen und `z/x/y`-Beschriftungen entsprechen in allen unterstützten
  Zielprojektionen denselben Source-Tiles; die Maßstabsleisten der einzelnen Tiles
  zeigen für definierte Ausschnitte und Breitengrade numerisch korrekte, gut lesbar
  gerundete Werte.
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
- kontextbezogene Hilfelinks aus Map Sets, Cache, Downloads, Coverage, Jobs,
  kartenintegriertem Layer-Panel und dessen Dialogen sowie Exporten ergänzen
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

## 13. Release- und Versionsplanung

Jeder zusammenhängende, getestete Entwicklungsstand kann die Patchversion erhöhen. Eine Phase darf deshalb mehrere `0.0.x`-Releases umfassen; umgekehrt muss ein Release keine vollständige Phase markieren. Maßgeblich für tatsächlich veröffentlichte Inhalte ist das [`CHANGELOG.md`](./CHANGELOG.md), nicht eine vorab reservierte Versionsnummer. Die optionale Firefox-Erweiterung besitzt mit `1.0.0` einen davon unabhängigen Versionszyklus; ihr Paketmanifest und ihr Firefox-Manifest bleiben untereinander synchron.

### 13.1 Versionsstand

| Version | Inhaltlicher Stand |
| --- | --- |
| `0.0.1` | Phase 1: Fundament mit Monorepo, Server, Web-App, Nix und Container-Betrieb |
| `0.0.2` | Phase 2: Map Sets, Provider-Konfiguration und interaktive Karte |
| `0.0.3` | Phase 3: hashbasiertes Tile-Archiv mit Revisionshistorie |
| `0.0.4`–`0.0.5` | phasenübergreifende UI-, Cache- und Dokumentationsverbesserungen |
| `0.0.6` | Traffic-Logs, Schema-Baseline 4 und Betriebsverbesserungen |
| `0.0.7` | Phase 3a: externes Tile-Seeding über die API und nachvollziehbare Revisionsherkunft |
| `0.0.8` | Kartenwerkzeuge, Menü- und Anzeigeverbesserungen sowie Cache-Abdeckungsstatistik und Bereinigung nicht mehr unterstützter Zoomstufen |
| `0.1.0` | eigenständig versionierte Firefox-Erweiterung, bereinigter Rendering-Spike und kleinere Metadatenkorrekturen |
| `0.1.1` | Phase 4: aggregierte Cache-Abdeckung, Zustandsvergleiche, Drill-down und Coverage-Kartenansicht |
| `0.1.2` | Coverage-Ansicht bereinigt und präzisiert, gemeinsame Zoom-Steuerung sowie Dokumentationsverbesserungen |
| `0.2.0` | Kernumfang von Phase 5: Layer-Plugin-System, Track-/Fotolayer, globaler Overlay-Stack, externer Fotokatalog und persistente Scan-Jobs |
| `0.2.1` | Skalierbare Layer- und Hauptnavigation, vereinheitlichte Track-Deckkraftmigration sowie gruppierte Dokumentationsnavigation |
| `0.2.2` | Koordinatenformate, verfeinerte Map-Set-Auswahl und Tile-Vorschau sowie OpenTopoMap als zugangsdatenfreie Erststartvorgabe |
| `0.2.3` | Dekorativer Tile-Grid-Layer mit lokalen Maßstabsleisten, schnellem Display-Schalter und Mapping-Ressourcen |
| `0.3.0` | Konsistentes Environment-Schema, vereinfachter Fotokatalog und überarbeitete Dialog- und Kartenwerkzeuge |
| `0.3.1` | Abschluss von Phase 5 mit belastbarer Scan-Wiederaufnahme, Job-Aufbewahrung, skalierbarem Fotokatalog und gemessenen Fotolimits |
| `0.3.2` | Cache- und Coverage-Verbesserungen sowie fokussierte Fotoverzeichnis-, Positions- und Metadatenabläufe |

### 13.2 Weitere Releases

Mit `0.3.1` ist Phase 5 vollständig veröffentlicht. Phase 5a ist bereits seit
Version `0.2.3` vollständig veröffentlicht; ihre für Phase 7 vorgesehene
serverseitige Deskriptorausgabe ist kein offener Bestandteil von Phase 5a. Die
weitere fachliche Reihenfolge erhält erst beim tatsächlichen Release konkrete
Patchnummern:

1. Phase 6: kontrollierter Batch-Download, Provider-Limits und Erweiterung des
   gemeinsamen Job-Systems
2. Phase 7: Bildexport, Projektionen, Exporthistorie und Download
3. Phase 8: vollständige Dokumentation und lokalisierte Suche
4. Phase 9: Sicherheits-, Performance-, Betriebs- und Release-Härtung

Zwischenstände und phasenübergreifende Verbesserungen dürfen weiterhin als eigene Versionen erscheinen.

### 13.3 Ziel `1.0.0`

`1.0.0` bezeichnet den ersten stabilen Stand für den vorgesehenen Privatbetrieb. Er wird erst erreicht, wenn Phase 9 abgeschlossen ist und die Definition of Done aus Abschnitt 10 erfüllt ist. Bis dahin besteht insbesondere keine Zusage, dass öffentliche APIs, Renderer-Adapter, Plugin-Verträge oder interne Datenmodelle bereits die Kompatibilitätsgarantien einer stabilen Hauptversion besitzen.

## 14. Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Nutzer übersieht oder missachtet geänderte Providerbedingungen | Vertrags-/Lizenzverstoß trotz technisch funktionierender App | Eigenverantwortung klar dokumentieren, Terms-Link/Prüfdatum anzeigen und keine Zulässigkeitsgarantie suggerieren |
| Reprojektion benötigt schwere native Bibliothek | größeres Image und komplexerer Nix-/Docker-Build | früher Spike; begrenzte Projektionsauswahl; GDAL nur bei nachgewiesenem Bedarf |
| Sehr große Zoomgebiete erzeugen Millionen Tiles | Kosten, Laufzeit und Speicherüberlauf | verpflichtende Schätzung, harte Limits, freier-Speicher-Prüfung und Bestätigung |
| Dauerhaft erhaltene Tile-Revisionen lassen den Speicher wachsen | neue Abrufe oder Exporte scheitern wegen Platzmangel | getrennte Statistik, Warn-/Aufnahmelimits, Kapazitätsschätzung und ausschließlich explizite bestätigte Löschung |
| SQLite und Dateisystem laufen auseinander | Historie, aktuelle Zeiger oder Snapshots werden unzuverlässig | atomare Writes, transaktionale Zustände, Backup sowie nicht destruktive Reparatur-/Scan-Funktion |
| Historische oder von Snapshots referenzierte Revision wird versehentlich gelöscht | reproduzierbare Stände und Vergleiche gehen verloren | Referenzschutz, ausdrückliche Bestätigung, Vorschau der Auswirkungen und Backup |
| Unauthentifizierter Tile-Upload ist für fremde Clients erreichbar | Manipulation des aktuellen Kartenstands und unkontrolliertes Speicherwachstum | nur vertrauenswürdiger Privatbetrieb, deutlicher Betriebshinweis und Authentifizierung/Autorisierung am Reverse Proxy bei externer Erreichbarkeit |
| Reverse-Proxy-Unterpfad bricht Assets oder API | Anwendung nicht erreichbar | ausschließlich relative URL-Helfer und automatisierter Proxy-E2E-Test ab Phase 1 |
| Bösartige oder falsche Quell-URL ermöglicht SSRF | Zugriff auf interne Dienste | IP-/DNS-Prüfung, Redirect-Prüfung, Protokoll-Allowlist und explizite Ausnahmen |
| Export verbraucht zu viel RAM | Containerabsturz | Pixelgrenzen, Worker-Limit, Streaming/Tile-basierte Verarbeitung und Messungen |
| Nutzer konfiguriert Limits zu hoch oder mehrere Jobs addieren ihre Last | Providerfehler, Sperrung oder Terms-Verstoß | zentraler Limiter pro Provider, sichtbare Schätzung und Verantwortungshinweis statt vermeintlicher Rechtsprüfung |
| Geheimnisse erscheinen in Logs oder DB | Credential-Leak | Secret-Referenzen, redigierte Logs und Tests für Fehlermeldungen |
| Leaflet-Details gelangen in fachliche Komponenten | späterer Renderer-Adapter erfordert großen Umbau | eigene Adapter-Schnittstelle, Importgrenzen und Contract-Test mit Fake-Adapter |
| Plugin-Schnittstelle ist zu eng oder instabil | weitere Layertypen benötigen Kernänderungen | versionierte Geometriegrundlagen und zustandsabgeleitete Dekorationsdeskriptoren, getrennte Feature-/Stützpunkteigenschaften und Symbolisierung, explizite Descriptor-Capabilities, datenbasierte und assetfreie Referenz-Plugins sowie Contract-Tests |
| Tile-Grid zeigt bei Viertel-Zoom, 512-Pixel-Tiles oder World-Wrapping andere Koordinaten als die Basiskarte tatsächlich lädt | Diagnose und gezielter Tile-Abruf verwenden falsche `z/x/y`-Werte | tatsächlichen ganzzahligen Source-Zoom und kanonische Tile-Koordinaten im Renderer bestimmen, gemeinsame XYZ-Mathematik aus `map-core` verwenden und alle Offset-/Wrap-Fälle testen |
| Maßstabsleiste unterscheidet sich zwischen Browser und Export oder ist in hohen Breitengraden falsch | kartografisch irreführende Längenangabe | gemeinsame geodätische Distanz- und Rundungslogik, Berechnung am Mittelpunkt jedes Source-Tiles sowie numerische Tests über mehrere Breitengrade und Projektionen |
| Plugin oder Dateiimport verarbeitet schädliche Inhalte | Codeausführung, Datenleck oder Ressourcenverbrauch | nur vertrauenswürdige Buildzeit-Plugins, kontrollierte Hooks, sichere Decoder und harte Limits |
| Konfiguriertes Fotoverzeichnis oder Originalfoto fehlt beziehungsweise wurde geändert | Fotoanzeige oder reproduzierbarer hochauflösender Export ist eingeschränkt | Metadaten und Vorschau erhalten, Fingerprint prüfen, Zustand `missing`/`changed` anzeigen und keine automatische Löschung oder unbemerkte Ersetzung |
| Fotoscan verlässt über Pfad oder Symlink die konfigurierte Wurzel | Zugriff auf nicht freigegebene Hostdateien | nur Wurzel-IDs und normalisierte relative Pfade akzeptieren, reale Zielpfade gegen die Read-only-Wurzel prüfen und absolute Pfade nicht offenlegen |
| EXIF-GPS-Daten werden unbeabsichtigt weitergegeben | Datenschutzproblem | nur eine nachvollziehbar als `exif` gekennzeichnete wirksame Position übernehmen, nachträgliche Korrektur/Entfernung ermöglichen und nicht benötigte Metadaten aus Vorschauen/Exporten entfernen |
| Dokumentation und Verhalten laufen auseinander | Fehlbedienung und falsche API-Nutzung | API-Referenz generieren, Feature-DoD um Dokumentation ergänzen und versionsgleich veröffentlichen |
| Englische Dokumentation ist unvollständig oder lokalisierter Fallback ist defekt | fehlende Hilfe und widersprüchliche Navigation | Englisch als Build-Gate, stabile Dokument-/Abschnitts-IDs, Fallback-Tests und Übersetzungsstatusbericht |
| Externe Provider-Links oder Bedingungen veralten | Nutzer verlässt sich auf überholte Hinweise | sichtbares Prüfdatum, Linkprüfung und ausdrücklicher Hinweis auf eigenständige Prüfung der aktuellen Bedingungen |

## 15. Definition of Done für v1.0

`maptoy` gilt als v1.0-fertig, wenn:

- die Anwendung reproduzierbar über Nix entwickelt und als Docker-Image gebaut werden kann;
- SPA, API, Tiles, Exporte und Dokumentation über einen HTTP-Port und unter einem Reverse-Proxy-Unterpfad funktionieren;
- der Leaflet-/XYZ-Renderer ausschließlich über den versionierten Adaptervertrag angebunden ist und derselbe Vertrag mit einem Fake-Adapter getestet wird;
- keine Google-Maps-Laufzeitabhängigkeit oder Google-spezifische Implementierung enthalten ist, die Adapterarchitektur eine spätere Implementierung aber ohne Umbau fachlicher Komponenten erlaubt;
- Map Sets ohne Secret-Leaks verwaltet und validiert werden können;
- sämtliche unterschiedlichen Tile-Revisionen hashbasiert, unveränderlich und dauerhaft in Dateien sowie Datenbank nachvollziehbar sind und Quellenfelder nach dem ersten Cache-Eintrag nicht mehr verändert werden können;
- Tile-Bytes über die API format-, policy-, capability-, größen- und speichergeprüft eingespielt werden können, ihre Herkunft nachvollziehbar bleibt und gleichzeitige Uploads und Providerabrufe keine widersprüchliche Historie erzeugen;
- aktueller Stand, Snapshot, Zeitstand und explizite Revision reproduzierbar auswählbar und vergleichbar sind;
- keine historische Revision automatisch gelöscht wird und explizite Löschungen aktuelle beziehungsweise von Snapshots referenzierte Revisionen schützen;
- Batch-Jobs konfigurierte technische Limits und Provider-Signale respektieren sowie Neustart, Pause und Abbruch konsistent behandeln;
- die Coverage-Ansicht große Caches und Vergleiche aggregiert und verständlich darstellt;
- das allgemeine Layer-Plugin-System versionierte Manifeste, Schemas, Migrationen sowie Frontend-/Server-Hooks bereitstellt und seine Contract-Tests besteht;
- Layerauswahl, Import, Fotoscan, Konfiguration, Reihenfolge, Sichtbarkeit und
  Diagnosen im optionalen Panel beziehungsweise in Dialogen des Standard-Map-View
  funktionieren, ohne eigene Layer-Hauptansicht oder `/layers`-Route und ohne die
  fachliche Aufgabe der Coverage-Ansicht zu erweitern;
- Punkt, Linie und Fläche als pluginunabhängige, versionierte Geometriegrundlagen mit
  getrennten Feature-/Stützpunkteigenschaften und Darstellungsstilen im
  Layer-Plugin-SDK vorliegen und über adapterneutrale Deskriptoren dargestellt werden;
- zustandsabgeleitete, assetfreie Layer über dieselbe Persistenz, Hierarchie,
  Sichtbarkeit, Deckkraft, Zoomgrenzen und Diagnose wie datenbasierte Layer laufen,
  ohne Laufzeitfeatures oder ein paralleles Layer-System zu speichern;
- der Tile-Grid-Layer die tatsächlich verwendeten Source-Tiles bei Viertel-Zoom,
  256-/512-Pixel-Tiles und World-Wrapping korrekt als `z/x/y` bezeichnet und seine
  metrische Maßstabsleiste in jedem sichtbaren Tile abhängig von Source-Zoom und
  geografischer Breite korrekt berechnet;
- verwaltete Nicht-Bild-Assets über Frontend und API hochgeladen und validiert werden
  können und sämtliche Layer ausschließlich kontrollierte Asset-IDs statt frei
  zusammengesetzter Dateipfade referenzieren;
- das externe Read-only-Fotoverzeichnis rekursiv und inkrementell über persistente Jobs
  gescannt werden können, ohne Originalbilder in `MAPTOY_STORAGE_DATA_DIR` zu kopieren;
  SQLite enthält den Fotokatalog, das Anwendungsdatenverzeichnis nur abgeleitete
  Vorschauen und temporäre Verarbeitungsartefakte;
- EXIF-GPS automatisch als wirksame, mit Herkunft markierte Position übernommen wird
  und nachträgliche Korrektur beziehungsweise Entfernung bei erneutem Scan erhalten
  bleibt;
- Track- und Bild-Referenz-Plugins die gemeinsame Linien- beziehungsweise Punktbasis
  verwenden und interaktiv sowie im Export funktionieren;
- Kartenbilder mit den dokumentierten Projektionen und Plugin-Layern einschließlich
  projiziertem XYZ-Tile-Grid und koordinatenabhängiger Maßstabsleiste je Tile korrekt
  exportiert werden;
- das vollständige englische App-Handbuch, die zur Serverversion passende API-Referenz, Provider-/Plugin-/Projektionsseiten und das Glossar integriert, englisch/deutsch durchsuchbar und kontextbezogen verlinkt sind;
- Deutsch und Thai auswählbar sind und fehlende Übersetzungen sichtbar und funktionsfähig auf Englisch zurückfallen;
- Thai-Suche entweder zuverlässig funktioniert oder ausdrücklich deaktiviert ist und auf die englische Suche verweist;
- der Dokumentations-Build vollständiges Englisch sowie gültige Fallbacks, interne Links und Assets sicherstellt;
- alle Eingaben, Remote-URLs, Layer-Assets, Plugin-Hooks und Dateipfade durch die beschriebenen Schutzmaßnahmen abgesichert sind;
- automatisierte Unit-, Integrations-, E2E- und Container-Smoke-Tests erfolgreich sind;
- die versionierte Bruno Collection alle zentralen API-Abläufe für manuelle Smoke- und Diagnosetests abdeckt, ohne Secrets zu enthalten;
- Konfiguration, Datenpersistenz, Backup, Upgrade, Reverse-Proxy und Eigenverantwortung des Nutzers für Providerbedingungen dokumentiert sind.

## 16. Entscheidungsstand und offene Punkte

Dieser Abschnitt enthält nur Entscheidungen, die für die noch ausstehenden v1-Phasen
tatsächlich offen sind. Bereits festgelegte Architektur wird nicht erneut als Frage
geführt; Ideen ohne Einfluss auf v1 sind separat geparkt.

### 16.1 Bereits festgelegt

- Als dokumentierte Quelle für manuelle Entwicklung, Smoke-Checks und Demos dient
  OpenTopoMap über `https://tile.opentopomap.org/{z}/{x}/{y}.png`; ein eigener lokaler
  Tile-Server ist nicht vorgesehen. Automatisierte Tests bleiben mit generierten
  Bytes und einem In-Process-Fake netzwerkfrei. Nutzungsprofil und Grenzen stehen in
  [Example provider decision](docs/internal/provider-example.md).
- Renderer-Adapter und vertrauenswürdige Buildzeit-Plugins folgen
  [ADR 0001](docs/internal/adr/0001-map-renderer-adapter-boundary.md) und
  [ADR 0002](docs/internal/adr/0002-trusted-layer-plugin-lifecycle.md). Ein
  Google-Maps-Adapter und eine administrative Plugin-Installation gehören nicht zu
  v1.
- Rasterreprojektion, Zielprojektionen und anfängliche Exportgrenzen sind mit GDAL,
  `EPSG:3857`, `EPSG:4326` und `EPSG:25833` in
  [ADR 0004](docs/internal/adr/0004-use-gdal-for-raster-reprojection.md)
  festgelegt. Phase 7 überprüft die Messwerte mit der produktiven Pipeline, ohne die
  Grundsatzentscheidung neu zu öffnen.
- Für v1 genügen Hash- und Metadatenvergleiche von Cache-Ständen. Visuelle
  Differenzbilder bleiben eine optionale spätere Erweiterung.
- Englisch ist vollständig. Für Deutsch und Thai gilt seitenweiser, sichtbarer
  Englisch-Fallback; ein zusätzlicher Mindestübersetzungsgrad ist kein v1-Gate.
- Das Bild-Plugin unterstützt in v1 EXIF-GPS und explizite Punktkoordinaten.
  Worldfiles, GeoTIFF-Metadaten und flächige Bildgeoreferenzierung sind nicht
  Bestandteil des v1-Umfangs.
- Bildoriginale verbleiben in konfigurierten, nur lesbar eingebundenen externen
  Fotoverzeichnis. maptoy persistiert Katalogmetadaten und abgeleitete Vorschauen,
  übernimmt EXIF-GPS automatisch als korrigierbare wirksame Position und scannt
  Verzeichnisse inkrementell über den gemeinsamen persistenten Jobkern.
- Standard- und Konfigurationsobergrenzen für Fotodateien, dekodierte Pixel,
  Vorschauen, Batches, Decoder und Dateianzahl beruhen auf dem reproduzierbaren
  [Photo scan limits benchmark](docs/internal/photo-scan-benchmark.md).
- Terminale Jobs bleiben standardmäßig 30 Tage erhalten; ihre Diagnosehistorie ist
  standardmäßig auf 100 Einträge begrenzt. Beide Werte sind konfigurierbar. Die
  Bereinigung läuft beim Start und stündlich oder wird über die API manuell
  ausgelöst; wartende, laufende und pausierte Jobs sind geschützt.

### 16.2 Offen für verbleibende v1-Phasen

| Spätestens vor | Entscheidung | Benötigtes Ergebnis |
| --- | --- | --- |
| Phase 6 | Welche Standard- und Hartgrenzen gelten auf der Zielhardware für Gebietsauswahl und Tile-Anzahl, und ab wann warnt beziehungsweise blockiert die Aufnahmeprüfung? Die Coverage-Antwort ist unabhängig davon bereits auf standardmäßig 1.024 und maximal 4.096 aggregierte Zellen begrenzt. | Gemessene Defaults, konfigurierbare Obergrenzen, verständliche Preflight-Fehler und dokumentiertes Verhalten am Speicherlimit. `MAPTOY_TILES_MAX_BYTES` und die Exportpixelgrenzen werden dabei nicht erneut festgelegt. |
| Phase 7 | Wie lange bleiben fertige Exportdateien erhalten? | Auf der allgemeinen Job-Aufbewahrung aufbauende Standardfrist, konfigurierbare Grenze und nachvollziehbarer Bereinigungsweg für Exportdateien. |
| Phase 8 | Ist eine ausreichend gute Thai-Suche mit vertretbarem Aufwand möglich? | Entweder getestete Thai-Segmentierung und Suche oder eine bewusst deaktivierte Thai-Suche mit sichtbarem Verweis auf die englische Suche. |

Die jeweilige Entscheidung wird spätestens vor Abschluss der genannten Phase anhand
von Messungen beziehungsweise eines kleinen Spikes getroffen. Ein ADR ist nur nötig,
wenn die Entscheidung eine dauerhafte Architektur- oder Betriebsgrenze setzt.

### 16.3 Nach v1 geparkt

- Import und Export von Map Sets als JSON sowie MBTiles-Unterstützung
- Worldfiles und GeoTIFF-Metadaten im Bild-Plugin
- signierter administrativer Installationsweg für Plugins
- konkrete Capabilities eines späteren Google-Maps-JavaScript-Adapters
- visuelle Tile-Differenzbilder als Vergleichsjob
