---
id: layers
title: Layer, Tracks und externe Bilder
language: de
---

# Layer, Tracks und externe Bilder

Layer sind optionale Funktionen der normalen **Kartenansicht**. Das Layer-Werkzeug
liegt links unten in der Karte. Es gibt keine eigene Layer-Hauptansicht; Coverage
bleibt ausschließlich auf das Tile-Archiv ausgerichtet.

## Gemeinsame Grundlage

Layer-Plugins verwenden wiederverwendbare Punkt-, Linien- und Flächengeometrien.
Fachliche Eigenschaften und Geometrie sind von Farbe, Breite, Markersymbol und
Deckkraft getrennt. Das Track-Plugin spezialisiert Linien und kann Zeitstempel und
Höhe je Stützpunkt bewahren. Das Bild-Plugin spezialisiert Punkte. Ein Bild mit
geografischen Bounds verwendet einen eigenen Raster-Overlay-Vertrag und keine
Vektorfläche. Dieselben Grundlagen können später POIs, Routen und Regionen tragen.

Über **Add layer** und die dortige Symbolauswahl wird ein Track- oder Bildlayer
erstellt. Der Name ist optional; ein leeres Feld erhält den nächsten freien,
nummerierten Namen wie `Track 1`. Nach dem Anlegen öffnet sich der neue Layer-Editor
und fokussiert den Import beziehungsweise Verzeichnisscan. Alle Layer bilden
einen globalen, von Map Sets unabhängigen Overlay-Stack. Beim Wechsel des Map Sets
wird nur die Basiskarte ersetzt; dieselben Overlays werden mit ihrer Reihenfolge,
Sichtbarkeit, Deckkraft, Zoombegrenzung und Konfiguration wieder angehängt. Fehlende
oder inkompatible, beim Build registrierte Plugins werden diagnostiziert;
Plugin-Code kann weder im Browser noch über die API installiert werden.

Die erste Hierarchieebene stammt aus der Plugin-Kategorie, beispielsweise
**Tracks** oder **Images**. `/` erzeugt im Namen weitere Ebenen:
`Reisen/2026/Alpen` erscheint unter `Tracks > Reisen > 2026`. Umbenennen ändert
diesen Pfad; separate Ordnerdatensätze werden nicht angelegt. Kategorien und jede
daraus erzeugte Ordnerebene lassen sich unabhängig einklappen. Diese
Darstellungspräferenzen bleiben lokal im Browser erhalten.

## Tracks importieren

In einem Track-Layer importiert **Import GPX/GeoJSON** GPX beziehungsweise GeoJSON
LineString/MultiLineString. maptoy vergibt eine Asset-ID, validiert über das Plugin
und speichert die Datei kontrolliert unter `MAPTOY_DATA_DIR/layer-assets`. Der
ursprüngliche Dateiname bleibt nur Metadatum. DTD- und Entity-Deklarationen in GPX
werden abgewiesen. Es gilt `MAPTOY_MAX_LAYER_ASSET_BYTES`.

## Externe Bildwurzeln

maptoy übernimmt keine Bildoriginale in sein Datenverzeichnis. Stattdessen ordnet
der Betreiber einer stabilen ID einen absoluten, im Container nur lesbar
eingebundenen Pfad zu:

```dotenv
MAPTOY_IMAGE_ROOTS_JSON={"photos":"/images/photos"}
```

Mit der Beispiel-Compose-Erweiterung wird ein Hostverzeichnis so eingebunden:

```sh
MAPTOY_PHOTOS_DIR=/srv/photos docker compose \
  -f compose.yaml -f compose.images.example.yaml up --build
```

An Clients gelangt nur die Wurzel-ID. Scans akzeptieren ausschließlich relative
Unterverzeichnisse; absolute Pfade, `..` und Symlink-Ausbrüche werden verhindert.

## Bildverzeichnisse scannen

Im Bildlayer werden Wurzel, optionales Unterverzeichnis und rekursive Verarbeitung
gewählt. **Scan directory** startet einen persistenten Job, der pausiert, fortgesetzt
oder abgebrochen werden kann. Nach einem Neustart wird ein unterbrochener Scan erneut
eingereiht.

Neue und geänderte Dateien werden sicher dekodiert und als EXIF-orientierte,
metadatenbereinigte WebP-Vorschau unter `MAPTOY_DATA_DIR/layer-previews` abgelegt.
Unveränderte Dateien werden anhand Größe und Änderungszeit vor dem Dekodieren
übersprungen. Nicht mehr vorhandene Dateien erhalten den Status `missing`; Katalog
und Vorschau bleiben erhalten.

EXIF-GPS wird beim ersten Scan unmittelbar zur wirksamen Punktposition. Es gibt keine
getrennte erkannte und akzeptierte Koordinate. Unter **Manage images** kann die
Position korrigiert, bewusst entfernt oder durch West-/Süd-/Ost-/Nord-Bounds für ein
Raster-Overlay ersetzt werden. Manuelle Änderungen werden von späteren Scans nicht
überschrieben. Nur eine weiterhin aus EXIF stammende Position darf bei geänderter
Quelldatei aktualisiert werden.

## Speicher und Grenzen

SQLite enthält Layer, normalisierte Trackdaten, Asset-IDs, Bildwurzel-ID und
relativen Pfad, ausgewählte Metadaten, Fingerprint, wirksame Position, Bounds,
Status und Jobs. Im Datenverzeichnis liegen verwaltete Nicht-Bild-Uploads und
abgeleitete Vorschauen—keine Bildoriginale. Diese müssen getrennt gesichert werden.

Die Standardgrenzen sind 100 MiB pro Bild, 100 Millionen dekodierte Pixel, 640 Pixel
Vorschaukante, Batchgröße 100, zwei parallele Decoder und 100.000 Dateien pro Scan.
Sie werden über `MAPTOY_MAX_IMAGE_BYTES`, `MAPTOY_MAX_IMAGE_PIXELS`,
`MAPTOY_IMAGE_PREVIEW_MAX_EDGE`, `MAPTOY_IMAGE_SCAN_BATCH_SIZE`,
`MAPTOY_IMAGE_DECODER_CONCURRENCY` und `MAPTOY_MAX_IMAGE_SCAN_FILES` konfiguriert.
