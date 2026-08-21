---
id: glossary
title: Glossar
language: de
---

# Glossar

Dieses Glossar erklärt Karten- und maptoy-Begriffe. Kurzformen sind gesondert im
[Abkürzungsverzeichnis](docs/de/abbreviations) aufgeführt.

## Attribution

Text oder Kennzeichnung, die Daten- und Bildanbieter einer Karte nennt. maptoy
übernimmt die konfigurierte Attribution in die interaktive Karte und, soweit
anwendbar, in Exporte.

## Bounds

Ein rechteckiger geografischer Bereich, meist durch westliche, südliche, östliche
und nördliche Grenze angegeben. Bounds können in maptoy ein Downloadgebiet, einen
Exportausschnitt oder die Position eines Bildlayers bestimmen.

## Cache

Lokaler Speicher für bereits von einem Provider abgerufene Tiles. Abhängig von
Aktualisierungsmodus und gewählter Revision kann ein Tile ohne erneute
Provider-Anfrage verwendet werden.

## Cache snapshot

Eine benannte, unveränderliche Auswahl exakter Tile-Revisionen für ein Map Set und
einen Quellstand. Ein Snapshot macht spätere Anzeige, Vergleiche und Exporte
reproduzierbar.

## Capability

Maschinenlesbare Angabe, dass ein Provider, Renderer-Adapter oder Layer-Plugin eine
Funktion wie interaktive Anzeige, Caching, Download oder Export unterstützt.

## Content hash

Kryptografischer Prüfwert aus den gespeicherten Bytes. maptoy erkennt damit gleiche
Tile-Inhalte und adressiert Inhaltsdateien, ohne die Revisionshistorie zu verwerfen.

## Coordinate reference system

Regeln, durch die Koordinaten eine definierte Lage auf der Erde erhalten. maptoy
bezeichnet unterstützte Koordinatenreferenzsysteme mit EPSG-Codes.

## Coverage

Zusammenfassung, welche Tiles für ein Gebiet und einen Zoombereich vorhanden sind.
Die Abdeckung unterscheidet Zustände wie vorhanden, fehlend, veraltet oder gerade in
Bearbeitung.

## GeoJSON

Auf JSON basierendes Format für geografische Objekte und deren Eigenschaften. Das
Track-Layer-Plugin kann unterstützte Linien- und Punktgeometrien aus GeoJSON
importieren.

## Layer

Informationen, die über der Basiskarte gezeichnet werden. Eine Layer-Instanz wird in
maptoy von einem registrierten Layer-Plugin verwaltet und kann Tracks, positionierte
Bilder oder andere Daten enthalten.

## Logical tile

Die Identität eines Tiles innerhalb eines Map Sets und Quellstands, bestimmt durch
Zoomstufe und `x`-/`y`-Koordinaten. Zu einem logischen Tile kann es mehrere
unveränderliche Tile-Revisionen geben.

## Map Set

Eine maptoy-Konfiguration, die Kartenquelle, Renderer-Adapter, Darstellung,
Cache- und Download-Regeln sowie zugeordnete Layer zusammenfasst. Geheimwerte
werden aus der Umgebung referenziert und nicht im Map Set gespeichert.

## Provider

Die externe Quelle, von der Kartentiles abgerufen werden. Der Nutzer ist dafür
verantwortlich, die aktuellen Bedingungen, Attributionsvorgaben, technischen Limits
und zulässigen Nutzungen zu prüfen und einzuhalten.

## Renderer adapter

Komponente, die maptoys neutrale Kartenschnittstelle mit einem konkreten
Browser-Renderer verbindet. Version 1.0 liefert den Leaflet-/XYZ-Adapter aus.

## Reprojection

Umrechnung geografischer Daten oder eines Rasterbilds von einem
Koordinatenreferenzsystem in ein anderes. Eine Reprojektion kann Form, Maßstab und
sichtbaren Ausschnitt verändern.

## Source revision

Unveränderliche Fassung der Map-Set-Felder, die Tile-Abrufe beeinflussen, etwa
URL-Template, Stil, Header, Format, Tile-Größe und Quellprojektion.

## Tile

Kleines rechteckiges Kartenbild für eine Zoomstufe und eine `x`-/`y`-Position.
Benachbarte Tiles bilden die im Renderer oder Export sichtbare Karte.

## Tile revision

Unveränderlicher Datensatz eines zu einem bestimmten Zeitpunkt beobachteten
Tile-Inhalts. Er speichert Content-Hash und Validierungsmetadaten und erhält frühere
und spätere Inhalte.

## URL template

Provider-URL mit Platzhaltern wie `{z}`, `{x}` und `{y}`. maptoy setzt sie für das
angeforderte Tile ein und verarbeitet konfigurierte Secret-Referenzen, ohne deren
Werte im Map Set zu speichern.

## Web Mercator

Projiziertes Koordinatenreferenzsystem, das häufig für Slippy Maps und XYZ-Tiles
verwendet wird. Seine Kennung ist `EPSG:3857`; Maßstabs- und Flächenverzerrungen
nehmen zu den Polen hin zu.

## Zoom level

Die `z`-Koordinate einer XYZ-Tile-Pyramide. Eine höhere Zoomstufe enthält mehr Tiles
und zeigt üblicherweise einen kleineren Bereich mit mehr Details.
