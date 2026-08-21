---
id: map-projections
title: Kartenprojektionen
language: de
---

# Kartenprojektionen

Eine Kartenprojektion überträgt Positionen von der gekrümmten Erde auf eine ebene
Karte. Keine Projektion kann Form, Fläche, Entfernung und Richtung überall
gleichzeitig erhalten. Die richtige Wahl hängt deshalb vom Zweck und der
geografischen Ausdehnung der Karte ab.

Ein **Koordinatenreferenzsystem (KRS, englisch CRS)** umfasst mehr als die
Projektion: Es legt auch Datum, Koordinatenachsen, Einheiten und Gültigkeitsgebiet
fest. Ein **EPSG-Code** bezeichnet ein bestimmtes KRS. Ein Projektionsname allein,
etwa „Mercator“, reicht nicht aus, um Koordinaten zuverlässig zu interpretieren.

## Geplante anfängliche Unterstützung in maptoy

Der Projektionsexport ist noch nicht implementiert. Die für v1 geplante Liste
zugelassener Exportziele beginnt mit drei Koordinatenreferenzsystemen. Die später
auf dieser Seite beschriebenen Projektionen dienen der Einordnung, sind aber nicht
als anfängliche Exportziele vorgesehen.

| KRS | Einordnung | Sinnvoller Einsatz in maptoy | Wichtige Grenze |
| --- | --- | --- | --- |
| `EPSG:3857` — WGS 84 / Pseudo-Mercator | Projizierte Web-Mercator-Koordinaten, nominell in Metern | XYZ-Quelltiles, interaktive Slippy Maps und Exporte im vertrauten Webkartenbild | Maßstabs- und Flächenverzerrung nehmen zu den Polen stark zu; jenseits von etwa 85,0511° Nord oder Süd nicht darstellbar und für genaue Messungen ungeeignet |
| `EPSG:4326` — WGS 84 | Geografische Länge und Breite in Grad; kein projiziertes KRS | Eingabe von Bounds, Austausch von GPS-/GeoJSON-artigen Koordinaten und Exporte auf einem Längen-/Breitengradgitter | Grad sind Winkeleinheiten und keine konstanten Bodenentfernungen; die rechteckige Darstellung erzeugt Verzerrungen ähnlich der Plattkarte |
| `EPSG:25833` — ETRS89 / UTM-Zone 33N | Projizierte Transverse-Mercator-Koordinaten in Metern | Regionale und topografische Exporte innerhalb der UTM-Zone 33N, darunter Ostdeutschland und Mitteleuropa nahe 12°O–18°O | Regionales Zonen-KRS statt Weltkarte; außerhalb des Gültigkeitsgebiets ist die passende UTM-Zone oder ein lokales KRS zu verwenden |

Eine EPSG-Definition legt auch die Achsenreihenfolge fest. `EPSG:4326` verwendet
formal Breite, Länge, während GeoJSON und viele Web-APIs üblicherweise Länge, Breite
verwenden. Koordinatenfelder in maptoy müssen die Reihenfolge ausdrücklich
bezeichnen; sie darf nie allein aus den beiden Zahlen abgeleitet werden.

## Projektionseigenschaften

Projektionsfamilien erhalten unterschiedliche Eigenschaften. „Erhalten“ gilt dabei
immer eingeschränkt: meist lokal, entlang ausgewählter Linien oder bezogen auf einen
bestimmten Kartenzweck und nicht überall.

- **Winkeltreue** Projektionen erhalten lokale Winkel und kleine Formen. Dazu
  gehören Mercator, Transverse Mercator und Lambert Conformal Conic. Fläche und
  Maßstab können trotzdem stark verzerrt sein.
- **Flächentreue** Projektionen erhalten Flächenverhältnisse. Sie eignen sich für
  thematische Karten, die Mengen nach Regionen vergleichen. Formen und Winkel
  müssen sich dabei verändern.
- **Längentreue** Projektionen erhalten Entfernungen nur von bestimmten Punkten
  oder entlang bestimmter Linien, niemals zwischen allen Punktpaaren.
- **Azimutale** Projektionen sind auf einen Punkt zentriert. Je nach Variante
  erhalten sie Richtungen oder eine andere gewählte Eigenschaft von diesem Zentrum
  aus.
- **Vermittelnde** Projektionen gleichen mehrere sichtbare Verzerrungen aus, ohne
  eine geometrische Eigenschaft exakt zu erhalten.

## Weitverbreitete Projektionen

### Mercator und Web Mercator

Die klassische Mercator-Projektion ist winkeltreu und bildet einen Kurs mit
konstanter Kompassrichtung als Gerade ab. Dadurch wurde sie für die Navigation
wichtig. Web Mercator (`EPSG:3857`) verwendet eine sphärische Berechnung für
schnelle, quadratische globale Tile-Pyramiden und bildet die übliche Grundlage von
XYZ-Webkarten.

Web Mercator eignet sich sehr gut zur interaktiven Kartennavigation und für
Tile-Kompatibilität, aber schlecht für Flächenvergleiche oder Messungen im
kontinentalen und globalen Maßstab. Polargebiete sind nicht darstellbar, Gebiete in
hohen Breiten erscheinen viel zu groß.

### Transverse Mercator und UTM

Transverse Mercator dreht die Zylinderkonstruktion so, dass die Verzerrung nahe
einem gewählten Mittelmeridian gering ist. Das Universal-Transverse-Mercator-System
(UTM) wendet sie in schmalen Längenzonen an. Jede Zone besitzt ein eigenes KRS mit
Koordinaten in Metern.

UTM eignet sich für Vermessung, topografische Karten und regionale Messungen
innerhalb der richtigen Zone. Für Karten über mehrere Zonen hinweg ist es
ungeeignet. `EPSG:25833` verbindet die UTM-Zone 33N mit dem europäischen Datum
ETRS89.

### Lambert Conformal Conic

Lambert Conformal Conic ist eine winkeltreue Projektion, die häufig für Gebiete der
mittleren Breiten mit großer Ost-West-Ausdehnung verwendet wird. Eine oder zwei
Standardparallelen begrenzen die Verzerrung. Sie eignet sich für regionale
Referenzkarten und Luftfahrtkarten, aber nicht für Flächenvergleiche.

### Albers und flächentreue Azimutalprojektion nach Lambert

Albers Equal Area Conic eignet sich für große Gebiete der mittleren Breiten mit
Ost-West-Ausdehnung. Lambert Azimuthal Equal Area wird häufig für Kontinente,
Hemisphären und europäische Statistikkarten eingesetzt. Beide erhalten
Flächenverhältnisse und eignen sich damit besser als winkeltreue Projektionen für
Choroplethen und andere thematische Vergleiche.

### Equal Earth

Equal Earth ist eine moderne, pseudocylindrische flächentreue Projektion für
Weltkarten. Sie erhält die relativen Größen von Gebieten und bietet zugleich ein
ausgewogenes Gesamtbild. Wenn globale Flächenvergleiche wichtig sind, ist sie eine
gute Publikationsprojektion; lokale Winkel oder Entfernungen erhält sie nicht.

### Mittabstandstreue und orthografische Azimutalprojektion

Die mittabstandstreue Azimutalprojektion erhält Entfernung und Richtung vom
Kartenzentrum und eignet sich daher für Reichweitenkarten um einen Ort. Die
orthografische Azimutalprojektion ähnelt dem Blick aus dem Weltraum und wirkt
anschaulich in Präsentationen. Keine der beiden erhält allgemeine Entfernungen oder
Flächen auf der gesamten Karte.

## Eine Projektion auswählen

| Ziel | Sinnvoller Ausgangspunkt |
| --- | --- |
| Standard-XYZ-Tiles interaktiv anzeigen | Web Mercator (`EPSG:3857`) |
| Längen- und Breitengrade speichern oder austauschen | WGS 84 (`EPSG:4326`), als geografische Daten und nicht als ebenes Messgitter |
| Eine metrische regionale Karte in UTM-Zone 33N erzeugen | ETRS89 / UTM-Zone 33N (`EPSG:25833`) |
| Lokale Winkel und erkennbare kleine Formen erhalten | Ein für die Kartenregion entworfenes winkeltreues KRS |
| Flächen von Ländern oder Statistikregionen vergleichen | Eine zur Kartenausdehnung passende flächentreue Projektion |
| Reichweiten oder Peilungen von einem Zentrum zeigen | Eine passende, auf diesen Ort zentrierte Azimutalprojektion |

Ein KRS sollte nicht nur deshalb gewählt werden, weil seine Koordinaten in Metern
angegeben sind. Datum, Gültigkeitsgebiet, Achsenreihenfolge und erhaltene
Eigenschaft müssen ebenfalls passen. Entfernungen und Flächen sollten aus den
zugrunde liegenden Geodaten in einem geeigneten KRS berechnet werden, nicht aus den
Pixeln eines gerenderten Bilds.

## Auswirkungen der Reprojektion

In v1 wird maptoy XYZ-Rastertiles normalerweise in Web Mercator erhalten. Ein
Export in ein anderes KRS verzerrt das zusammengesetzte Raster auf ein neues
Pixelgitter. Dabei können zuvor gerade Kanten gebogen, der sichtbare Ausschnitt
verändert, transparente Bereiche erzeugt und Beschriftungen oder Linien durch
Resampling weicher werden. Eine Reprojektion kann keine in den Quelltiles fehlenden
Details erzeugen.

Basiskarte und alle Plugin-Layer müssen dieselbe Transformation und dasselbe
Ausgaberaster verwenden, damit Tracks und Bilder deckungsgleich bleiben. Am
Antimeridian, an den Polen oder am Rand des KRS-Gültigkeitsgebiets muss ein Export
gegebenenfalls geteilt werden oder wird abgelehnt. Wenn ein Exportbild außerhalb
von maptoy weiterverwendet wird, sollten Ziel-KRS und Ausdehnung immer mitgeführt
werden.

## Offizielle Referenzen

- [EPSG:3857 — WGS 84 / Pseudo-Mercator](https://epsg.org/crs_3857/WGS-84-Pseudo-Mercator.html)
- [EPSG:4326 — WGS 84](https://epsg.org/crs_4326/WGS-84.html)
- [EPSG:25833 — ETRS89 / UTM-Zone 33N](https://epsg.org/crs_25833/ETRS89-UTM-zone-33N.html)
- [PROJ-Projektionsreferenz](https://proj.org/en/stable/operations/projections/index.html)
