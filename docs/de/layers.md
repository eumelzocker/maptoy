---
id: layers
title: Layers
language: de
---

# Layers

Layer sind optionale Funktionen der normalen **Kartenansicht**. Das Layer-Werkzeug
liegt links unten in der Karte. Es gibt keine eigene Layer-Hauptansicht; Coverage
bleibt ausschließlich auf das Tile-Archiv ausgerichtet.

## Gemeinsame Grundlage

Layer-Plugins verwenden wiederverwendbare Punkt-, Linien- und Flächengeometrien.
Fachliche Eigenschaften und Geometrie sind von Farbe, Breite, Markersymbol und
Deckkraft getrennt. Das Track-Plugin spezialisiert Linien und kann Zeitstempel und
Höhe je Stützpunkt bewahren. Das Foto-Plugin spezialisiert Punkte. Ein Foto mit
geografischen Bounds verwendet einen eigenen Raster-Overlay-Vertrag und keine
Vektorfläche. Dieselben Grundlagen können später POIs, Routen und Regionen tragen.

Über **Add layer** und die dortige Symbolauswahl wird ein Track- oder Fotolayer
erstellt. Der Name ist optional; ein leeres Feld erhält den nächsten freien,
nummerierten Namen wie `Track 1`. Nach dem Anlegen wird der neue Layer im
Baum-Dropdown ausgewählt, als einziger Layer-Editor geöffnet und der Import
beziehungsweise Verzeichnisscan fokussiert. Checkboxen im Dropdown ändern die
Sichtbarkeit, ohne die Editorauswahl zu wechseln. Der allgemeine Regler
**Opacity** gilt für den gesamten Layer in interaktiver Karte und Export. Alle Layer bilden
einen globalen, von Map Sets unabhängigen Overlay-Stack. Beim Wechsel des Map Sets
wird nur die Basiskarte ersetzt; dieselben Overlays werden mit ihrer Reihenfolge,
Sichtbarkeit, Deckkraft, Zoombegrenzung und Konfiguration wieder angehängt. Fehlende
oder inkompatible, beim Build registrierte Plugins werden diagnostiziert;
Plugin-Code kann weder im Browser noch über die API installiert werden.

Die erste Hierarchieebene stammt aus der Plugin-Kategorie, beispielsweise
**Tracks** oder **Photos**. `/` erzeugt im Namen weitere Ebenen:
`Reisen/2026/Alpen` erscheint unter `Tracks > Reisen > 2026`. Umbenennen ändert
diesen Pfad; separate Ordnerdatensätze werden nicht angelegt. Kategorien und jede
daraus erzeugte Ordnerebene lassen sich unabhängig einklappen. Diese
Darstellungspräferenzen bleiben lokal im Browser erhalten.

## Tracks importieren

In einem leeren Track-Layer ist **Import track…** als Primäraktion hervorgehoben.
Nach erfolgreichem Import heißt die normale Aktion **Replace track…**, weil eine
weitere Datei die normalisierte Trackgeometrie ersetzt. Beide Aktionen akzeptieren
GPX beziehungsweise GeoJSON LineString/MultiLineString. *maptoy* vergibt eine Asset-ID, validiert über das Plugin
und speichert die Datei kontrolliert unter `MAPTOY_STORAGE_DATA_DIR/layer-assets`. Der
ursprüngliche Dateiname bleibt nur Metadatum. DTD- und Entity-Deklarationen in GPX
werden abgewiesen. Es gilt `MAPTOY_LAYERS_ASSET_MAX_BYTES`.

## Externes Fotoverzeichnis

*maptoy* übernimmt keine Fotooriginale in sein Datenverzeichnis. Trage den
vorhandenen absoluten Hostpfad in `.env` ein:

```dotenv
MAPTOY_PHOTOS_DIR=/srv/photos
```

Danach wird maptoy ganz normal gestartet:

```sh
docker compose up --build
```

Die normale Compose-Datei mountet das Verzeichnis im Container read-only nach
`/photos` und konfiguriert maptoy entsprechend. Die Variablen für Fotolimits besitzen
Vorgabewerte und müssen für einen ersten Test nicht geändert werden. Nach dem Start
meldet `GET api/photos/directory` den Wert `available: true`, wenn der Mount lesbar
ist; keiner der absoluten Pfade wird ausgegeben. Scans akzeptieren ausschließlich
relative Unterverzeichnisse; absolute Pfade, `..` und Symlink-Ausbrüche werden
verhindert.

## Fotoverzeichnisse scannen

Im Fotolayer werden ein optionales Unterverzeichnis und rekursive Verarbeitung
gewählt. **Scan directory** startet einen persistenten Job, der pausiert, fortgesetzt
oder abgebrochen werden kann. Nach einem Neustart wird ein unterbrochener Scan erneut
eingereiht.

Neue und geänderte Dateien werden sicher dekodiert und als EXIF-orientierte,
metadatenbereinigte WebP-Vorschau unter `MAPTOY_STORAGE_DATA_DIR/layer-previews` abgelegt.
Unveränderte Dateien werden anhand Größe und Änderungszeit vor dem Dekodieren
übersprungen. Nicht mehr vorhandene Dateien erhalten den Status `missing`; Katalog
und Vorschau bleiben erhalten.

EXIF-GPS wird beim ersten Scan unmittelbar zur wirksamen Punktposition. Es gibt keine
getrennte erkannte und akzeptierte Koordinate. Unter **Manage photos** kann die
Position korrigiert, bewusst entfernt oder durch West-/Süd-/Ost-/Nord-Bounds für ein
Raster-Overlay ersetzt werden. Manuelle Änderungen werden von späteren Scans nicht
überschrieben. Nur eine weiterhin aus EXIF stammende Position darf bei geänderter
Quelldatei aktualisiert werden.

## Speicher und Grenzen

SQLite enthält Layer, normalisierte Trackdaten, Asset-IDs, relative Fotopfade,
ausgewählte Metadaten, Fingerprint, wirksame Position, Bounds,
Status und Jobs. Im Datenverzeichnis liegen verwaltete Nicht-Bild-Uploads und
abgeleitete Vorschauen—keine Fotooriginale. Diese müssen getrennt gesichert werden.

Die Standardgrenzen sind 100 MiB pro Foto, 100 Millionen dekodierte Pixel, 640 Pixel
Vorschaukante, Batchgröße 100, zwei parallele Decoder und 100.000 Dateien pro Scan.
Sie werden über `MAPTOY_PHOTOS_MAX_FILE_BYTES`, `MAPTOY_PHOTOS_MAX_DECODED_PIXELS`,
`MAPTOY_PHOTOS_PREVIEW_MAX_EDGE`, `MAPTOY_PHOTOS_SCAN_BATCH_SIZE`,
`MAPTOY_PHOTOS_SCAN_CONCURRENCY` und `MAPTOY_PHOTOS_SCAN_MAX_FILES` konfiguriert.
