---
id: tile-providers
title: Tile-Provider
language: de
---

# Tile-Provider

Letzte inhaltliche Prüfung: **2026-09-04**.

Diese Seite dient der technischen Orientierung. Sie ist weder Empfehlung noch
Rechtsprüfung oder Garantie dafür, dass ein Provider eine bestimmte Nutzung erlaubt.
Bedingungen, Tarife, URLs, Limits und Attributionsvorgaben können sich ändern. Prüfe
vor dem Anlegen oder erneuten Prüfen eines Map Sets die verlinkte offizielle
Dokumentation und die für dein Konto geltenden Bedingungen.

*maptoy* arbeitet als serverseitiger Tile-Proxy mit dauerhafter Revisionshistorie,
Snapshots, Batch-Downloads und Exporten. Das geht über gewöhnliches Browser-Caching
hinaus. Eine technisch gültige XYZ-URL bedeutet deshalb nicht, dass der Provider die
Archivfunktionen von *maptoy* erlaubt. Solange eine anwendbare Vereinbarung dies nicht
ausdrücklich gestattet, dürfen Batch-Downloads nicht aktiviert und dauerhafte
Speicherung, Snapshots, Exporte oder Weitergabe nicht als erlaubt angenommen werden.

Katalog-Platzhalter wie `{style}` und `{mapId}` müssen vor dem Speichern eines Map
Sets durch einen festen Wert ersetzt werden. *maptoy* löst selbst nur Tile-Platzhalter
wie `{z}`, `{x}`, `{y}` und optional `{s}` auf. Zugangsdaten gehören in
Environment-Variablen; die Beispiele verwenden `${MAPTOY_*}`-Referenzen statt echter
Secrets.

| Provider | Technische Raster-XYZ-Eignung für v1 | Archiv- und Batch-Regeln |
| --- | --- | --- |
| [OpenStreetMap Standard](https://openstreetmap.org/) | Direkt | Bulk-Download und Prefetch sind verboten; nur policykonforme interaktive Nutzung und Zwischenspeicherung. [Wiki](https://wiki.openstreetmap.org/wiki/DE:Hauptseite) |
| [OpenTopoMap](https://opentopomap.org/) | Direkt; *maptoy*s manuelle Entwicklungsquelle | Entwicklung mit geringem Volumen ohne Zugangsdaten und mit Attribution; Massendownloads vermeiden und vor größerer Nutzung das Projekt kontaktieren. |
| [MapTiler Cloud](https://www.maptiler.com/) | Direkt | Serverseitiger Proxy/Cache, Export und Bulk-Download benötigen eine individuelle Vereinbarung. |
| [Mapbox](https://www.mapbox.com/) | Direkt über die Static Tiles API | Aus HTTP-Cache-Headern keine Archivrechte ableiten; aktuelle Vereinbarung zu Proxy, Speicherung, Export und Offline-Nutzung prüfen. |
| [Stadia Maps](https://stadiamaps.com/) | Direkt | Standardbedingungen verbieten serverseitigen Proxy/Cache und allgemeinen Bulk-Download. |
| [Thunderforest](https://www.thunderforest.com/maps/) | Direkt | Standardbedingungen erlauben begrenztes Client-/Geräte-Caching, verbieten jedoch Caching-Proxys und Weitergabe. |
| [ArcGIS Location](https://location.arcgis.com/) | Direkt mit Pfadreihenfolge `{z}/{y}/{x}` | Konto-, Dienst- und vertragsabhängig; keine allgemeine Archiverlaubnis. |
| [Google Maps](https://maps.google.com/) | Manuell und eingeschränkt für 2D-Tiles | Eine extern erzeugte Session kann verwendet werden; *maptoy* erzeugt oder erneuert Sessions jedoch nicht und ruft keine Viewport-Attribution ab. Googles Cache-Beschränkungen begrenzen die Archivfunktionen. |

## OpenStreetMap Standard

**Name:** OpenStreetMap-Standard-Tile-Layer, betrieben von der OpenStreetMap
Foundation.

**Varianten:** Auf diesem Endpunkt ausschließlich Standard. Andere OSM-basierte
Stile sind eigenständige Dienste mit eigenen Betreibern und Regeln.

**URL-Template:**
`https://tile.openstreetmap.org/{z}/{x}/{y}.png`

**Parameter und Header:** Kein API-Schlüssel. Einen ehrlichen, kontaktierbaren
`User-Agent` konfigurieren; Browserzugriffe müssen einen gültigen `Referer` senden.

**Policy:** Sichtbare Attribution `© OpenStreetMap contributors` ist Pflicht.
HTTP-Cache-Header sind einzuhalten; können sie nicht ausgewertet werden, gilt eine
Mindest-Cachezeit von sieben Tagen. Bulk-Download, Offline-Prefetch und Umgehen des
Caches sind verboten. Der Dienst arbeitet ohne Verfügbarkeitsgarantie und kann
missbräuchliche Zugriffe sperren. *maptoy*s Batch-Download darf für diesen Endpunkt
nicht aktiviert werden.

**Offizielle Informationen:** [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/),
[Attributionsrichtlinien](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
und [Copyright und Lizenz](https://www.openstreetmap.org/copyright).

## OpenTopoMap

**Name:** OpenTopoMap.

**Varianten:** Ein weltweiter topografischer Rasterstil mit Höhenlinien und
Schummerung; Abdeckung und sinnvoll nutzbare maximale Zoomstufe können variieren.

**URL-Template:**
`https://tile.opentopomap.org/{z}/{x}/{y}.png`

**Parameter und Header:** Kein API-Schlüssel. Die vorgeschriebene Attribution für
OpenTopoMap und die Datenquellen anzeigen.

**Entwicklungsnutzung:** Dies ist *maptoy*s dokumentierte Quelle für manuelle
Entwicklung, Smoke-Checks, Screenshots und Demos, die echte Tiles benötigen. Sie
wird ausdrücklich konfiguriert; automatisierte Tests greifen nie auf öffentliche
Tile-Dienste zu. Die veröffentlichten Nutzungshinweise stellen die Karte mit
Attribution unter CC-BY-SA bereit. Damit passt eine kontrollierte Entwicklung mit
geringem Volumen ohne Zugangsdaten zu diesem Profil.

**Policy:** Es gibt keine Verfügbarkeitsgarantie. Massendownloads, großflächiges
Pre-Seeding und Lasttests sind zu vermeiden; vor größerer Nutzung soll das Projekt
kontaktiert werden. *maptoy*-Batch-Downloads bleiben deaktiviert, solange der Betreiber
Last und Aufbewahrung nicht zugestimmt hat. Das Entwicklungsprofil ist weder eine
allgemeine Rechtsprüfung noch eine Garantie für unbegrenzte Nutzung.

**Offizielle Informationen:** [Dienst, Lizenz, Legende und Nutzungshinweise](https://opentopomap.org/about#verwendung)
und [Projektquellcode](https://github.com/der-stefan/OpenTopoMap).

## MapTiler Cloud

**Name:** MapTiler Cloud Maps API.

**Varianten:** Gehostete Rasterfassungen von Kartenstilen wie Streets, Basic,
Bright, Outdoor, Satellite, Hybrid, Toner und Topo sowie eigene Map-IDs. Verfügbare
Stile und Tarifzugriff können sich im Kontokatalog ändern.

**URL-Template:**
`https://api.maptiler.com/maps/{mapId}/256/{z}/{x}/{y}.png?key=${MAPTOY_MAPTILER_API_KEY}`

`{mapId}` durch eine feste Map-ID wie `streets-v4` ersetzen. Das Segment `/256/`
ist für den dokumentierten 256-Pixel-Endpunkt optional; `.jpg`, `.webp` und
`@2x`-Varianten hängen von der Karte ab.

**Parameter und Header:** Map-ID, Tile-Größe, Format, optionaler Skalierungsfaktor
und verpflichtender `key`. Einen eigenen geschützten API-Schlüssel verwenden und
sein Kontingent überwachen.

**Policy:** Die Cloud-Standardbedingungen erlauben nur einen temporären persönlichen
Cache eines einzelnen Endnutzers. Serverseitiger Proxy/Cache, Export von
Karteninhalten sowie Batch- oder übermäßiger Bulk-Download erfordern eine schriftliche
Sondervereinbarung. MapTiler und Datenquellen müssen attribuiert werden; für
kostenlose Konten können zusätzliche Logo-Vorgaben gelten.

**Offizielle Informationen:** [Maps API](https://docs.maptiler.com/cloud/api/maps/),
[Kartenkatalog](https://cloud.maptiler.com/maps/),
[Schutz des API-Schlüssels](https://docs.maptiler.com/cloud/api/authentication-key/),
[Cloud-Bedingungen](https://www.maptiler.com/terms/cloud/) und
[Attributionsanleitung](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/).

## Mapbox

**Name:** Mapbox Static Tiles API.

**Varianten:** Klassische rasterisierbare Stile sind
- Streets v12 `streets-v12`
- Outdoors v12 `outdoors-v12`
- Light v11 `light-v11`
- Dark v11 `dark-v11`
- Satellite v9 `satellite-v9`
- Satellite Streets v12 `satellite-streets-v12`
- Navigation Day `navigation-day-v1`
- Navigation Night `navigation-night-v1`

sowie kompatible eigene Studio-Stile. Die aktuellen Stile Mapbox Standard und
Standard Satellite werden von der Static Tiles API nicht unterstützt.

**URL-Template:**
`https://api.mapbox.com/styles/v1/{styleId}/tiles/512/{z}/{x}/{y}?access_token=${MAPTOY_MAPBOX_ACCESS_TOKEN}`

`{styleId}` durch feste Werte ersetzen. `/256/` nur verwenden, wenn Map Set und
Abrechnung für 256-Pixel-Tiles konfiguriert sind; 512-Pixel-Tiles haben gegenüber
256-Pixel-Tiles eine verschobene Zoominterpretation. Ein literales`@2x`-Suffix ist
optional.

**Parameter und Header:** Kontoname, Stil-ID, Tile-Größe `256` oder `512`, optional
`@2x` und ein Zugriffstoken mit passendem Scope. Anfragen werden nach aktivem Tarif
abgerechnet und begrenzt.

**Policy:** Die API veröffentlicht HTTP-Cachezeiten. Diese beschreiben die
Aktualität, gewähren aber allein keine Rechte für *maptoy*s dauerhafte
Revisionshistorie, Proxy-Auslieferung, Exporte oder Prefetch. Vor Aktivierung einer
Archivfunktion müssen die aktuelle Mapbox-Vereinbarung und Produktbedingungen für
das konkrete Konto und den Anwendungsfall geprüft werden. Erforderliche Mapbox- und
Datenattribution muss erhalten bleiben.

**Offizielle Informationen:** [Static Tiles API](https://docs.mapbox.com/api/maps/static-tiles/),
[klassische Stil-IDs](https://docs.mapbox.com/map-styles/guides/classic-styles/),
[Token-Verwaltung](https://docs.mapbox.com/accounts/guides/tokens/),
[API-Caching](https://docs.mapbox.com/help/dive-deeper/api-caching/) und
[Rechtsportal](https://www.mapbox.com/legal/).

## Stadia Maps

**Name:** Rastertiles von Stadia Maps.

**Varianten:** Alidade Smooth, Alidade Smooth Dark, Alidade Satellite, Outdoors,
OSM Bright und bei Stadia gehostete Stamen-Stile wie Toner, Terrain und Watercolor.
Einige Stile bieten reine Hintergrund-, Linien- oder Labelvarianten.

**URL-Template:**
`https://tiles.stadiamaps.com/tiles/{style}/{z}/{x}/{y}.png?api_key=${MAPTOY_STADIA_API_KEY}`

`{style}` durch eine feste Stil-ID wie `alidade_smooth_dark` ersetzen. Einige Stile
unterstützen ein literales `@2x` vor der Endung; Watercolor verwendet JPEG und hat
abweichende HiDPI-Verfügbarkeit.

**Parameter und Header:** Feste Stil-ID und entweder Konto-/Domain-Authentifizierung
oder `api_key`. Ein selbst gehosteter Serverzugriff benötigt normalerweise einen
API-Schlüssel statt Browser-Domain-Authentifizierung.

**Policy:** Stadias Standardbedingungen verbieten serverseitigen Proxy und Cache;
enge Ausnahmen decken *maptoy*s allgemeines Tile-Archiv nicht ab. Allgemeiner
Bulk-Download ist untersagt, begrenztes Offline-Caching auf Mobilgeräten ist separat
beschränkt und an Bedingungen geknüpft. Je nach Stil sind Stadia Maps, Stamen
Design, OpenMapTiles, OpenStreetMap und weitere Datenanbieter zu attribuieren.

**Offizielle Informationen:** [Stilbibliothek](https://docs.stadiamaps.com/themes/),
[Raster-URL-Beispiele](https://docs.stadiamaps.com/guides/migrating-from-stamen-map-tiles/),
[Attribution](https://docs.stadiamaps.com/attribution/),
[Dienstlimits](https://docs.stadiamaps.com/limits/) und
[Nutzungsbedingungen](https://stadiamaps.com/terms-of-service/).

## Thunderforest

**Name:** Thunderforest Map Tiles API.

**Varianten:** OpenCycleMap (`cycle`), Transport, Transport Dark, Landscape,
Outdoors, Atlas und weitere im Konto- und Kartenkatalog angezeigte Stile.

**URL-Template:**
`https://api.thunderforest.com/{style}/{z}/{x}/{y}.png?apikey=${MAPTOY_THUNDERFOREST_API_KEY}`

`{style}` durch eine feste Stil-ID ersetzen. Optionale literale `@2x`-Skalierung
und PNG-/JPEG-Formate stehen zur Verfügung. Der einzelne Host
`api.thunderforest.com` wird gegenüber den alten Subdomains `a`, `b` und `c`
bevorzugt.

**Parameter und Header:** Feste Stil-ID, optionale Skalierung, gewähltes Format und
verpflichtender `apikey`. Einen ehrlichen `Referer` und/oder `User-Agent` senden.

**Policy:** Registrierung und Attribution für Thunderforest sowie die zugrunde
liegenden Datenquellen sind erforderlich. Die Standardbedingungen erlauben
Browser-/Geräte-Caching einschließlich Offline-Nutzung, verbieten aber Caching-Proxys
und andere Weitergabe. *maptoy*s serverseitiges Archiv benötigt daher eine separate
Erlaubnis. Kontotarif, Kontingent und begrenzende Provider-Antworten sind einzuhalten.

**Offizielle Informationen:** [Map Tiles API](https://www.thunderforest.com/docs/map-tiles-api/),
[API-Schlüssel](https://www.thunderforest.com/docs/apikeys/),
[Kartenkatalog](https://www.thunderforest.com/maps/) und
[Bedingungen](https://www.thunderforest.com/terms/).

## ArcGIS Location Platform

**Name:** ArcGIS Static Basemap Tiles Service.

**Varianten:** ArcGIS-Familien wie Navigation, Streets, Outdoor, Light Gray, Dark
Gray, Imagery Labels und Human Geography sowie Open-Familien wie OSM Style,
Navigation, Streets, Hybrid Detail, Light Gray und Dark Gray.

**URL-Template:**
`https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/{styleFamily}/{styleName}/static/tile/{z}/{y}/{x}`

`{styleFamily}` und `{styleName}` durch feste Werte wie `arcgis/navigation`
ersetzen. Die dokumentierte Pfadreihenfolge `{z}/{y}/{x}` weicht von der üblichen
Schreibweise ab, lässt sich aber mit einem *maptoy*-Template abbilden.

**Parameter und Header:** Feste Stilfamilie und Stilname, optional `language` und
`worldview` sowie Zugriffstoken mit der Berechtigung
`premium:user:staticbasemaptiles`. Soweit im Map Set unterstützt, einen Header
`Authorization: Bearer ${MAPTOY_ARCGIS_ACCESS_TOKEN}` gegenüber einem Query-Token
bevorzugen.

**Policy:** Zugriff benötigt ein ArcGIS-Location-Platform- oder geeignetes
ArcGIS-Konto und kann Tile-Nutzungskosten verursachen. Attribution kann je nach Stil
und Datenanbieter variieren. Offline-Nutzung, Caching, Weitergabe und Export richten
sich nach der anwendbaren Esri-Vereinbarung, den Dienstbedingungen und
datenspezifischen Bedingungen; ein statischer Tile-Endpunkt ist keine allgemeine
Erlaubnis für *maptoy*s Archiv.

**Offizielle Informationen:** [Einführung in Static Basemap Tiles](https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/),
[Selbstbeschreibung des Dienstes](https://developers.arcgis.com/rest/static-basemap-tiles/service-self-get/),
[Authentifizierung](https://developers.arcgis.com/documentation/security-and-authentication/)
und [Esri-Rechtsübersicht](https://www.esri.com/en-us/legal/overview).

## Google Maps Platform

**Name:** Google Maps Platform Map Tiles API.

**Varianten:** Roadmap, Satellite, Terrain, Street View und Photorealistic 3D. Nur
die 2D-Antworten für Roadmap, Satellite und Terrain ähneln Raster-XYZ-Tiles.

**Manuelles Map-Set-URL-Template:**
`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${MAPTOY_GOOGLE_MAPS_SESSION_TOKEN}&key=${MAPTOY_GOOGLE_MAPS_API_KEY}`

**Parameter und Ablauf:** API-Schlüssel und kurzlebiges Session-Token sind Pflicht.
*maptoy* kann beides aus seiner Serverumgebung lesen und ein vorhandenes, noch
gültiges Token für gewöhnliche 2D-Tile-Anfragen verwenden. Es erzeugt oder erneuert
dieses Token jedoch nicht. Das Token muss extern per POST mit `mapType`, `language`
und `region` sowie optionalen Skalierungs-, Layer- und Stilwerten erzeugt werden.
Google dokumentiert derzeit eine Gültigkeitsdauer von ungefähr zwei Wochen, die sich
ändern kann. Ersetze nach Ablauf den Environment-Wert und starte beziehungsweise
erzeuge den *maptoy*-Prozess neu. Zusätzlich wird eine Viewport-Abfrage benötigt, um
aktuelle Abdeckung und Attribution des sichtbaren Gebiets zu erhalten; *maptoy* führt
diese Abfrage nicht aus.

**Policy und Kompatibilität:** *maptoy* v1.0 enthält bewusst keinen Google-Maps-Adapter.
Der allgemeine Leaflet-/XYZ-Adapter kann 2D-Tiles dennoch technisch abrufen und
anzeigen, wenn wie oben ein gültiges Session-Token bereitgestellt wird. Das ist eine
eingeschränkte manuelle Kompatibilität und keine vollständige Integration der Google
Maps Platform: *maptoy* kann die erforderliche viewportabhängige Attribution nicht
pflegen. Google beschränkt außerdem Prefetch, Caching, Speicherung, nicht visuelle
Analyse und Offline-Nutzung. Solange die für das Konto geltende Vereinbarung dies
nicht ausdrücklich erlaubt, müssen Tile Archive, Cache, Batch-Download und
Serverexport deaktiviert bleiben. Auch ein künftiger dedizierter Adapter müsste den
vollständigen Session- und Attributionsablauf implementieren und inkompatible
Archivfunktionen deaktivieren.

**Offizielle Informationen:** [Map Tiles API](https://developers.google.com/maps/documentation/tile/overview),
[Session-Tokens](https://developers.google.com/maps/documentation/tile/session_tokens),
[Roadmap-Tile-Anfragen](https://developers.google.com/maps/documentation/tile/roadmap),
[Map-Tiles-Richtlinien](https://developers.google.com/maps/documentation/tile/policies)
und [Google-Maps-Platform-Bedingungen](https://cloud.google.com/maps-platform/terms/).

## Einen Provider für *maptoy*-Archive auswählen

Für uneingeschränkte Revisionshistorie, Batch-Downloads, Snapshots und Exporte ist
ein selbst betriebener Tile-Dienst aus Daten mit passender Lizenz oder ein
Providervertrag vorzuziehen, der serverseitiges Caching, historische Aufbewahrung,
Bulk-Abruf, Export und erforderliche Weitergaberechte ausdrücklich gestattet. Im Map
Set sollten Terms-URL, Attribution, eigenes Prüfdatum, konfigurierte Limits und eine
gegebenenfalls schriftliche Erlaubnis festgehalten werden. Provider-Dokumentation ist
technische Hilfe und ersetzt nicht die aktuelle, für das Konto geltende Vereinbarung.
