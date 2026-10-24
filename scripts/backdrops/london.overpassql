[out:json][timeout:180][bbox:51.455,-0.26,51.56,0.06];
(
  way["natural"="water"]["water"~"^(river|canal|lake|reservoir|basin|dock)$"];
  relation["natural"="water"]["water"~"^(river|canal|lake|reservoir|basin|dock)$"];
  way["waterway"="riverbank"];
  relation["waterway"="riverbank"];
  way["leisure"="park"];
  relation["leisure"="park"];
  way["landuse"="recreation_ground"];
  relation["landuse"="recreation_ground"];
);
out geom;
