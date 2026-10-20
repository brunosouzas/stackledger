"""Stress input: N stations on a grid, L lines of random walks between them."""
import json
import random
import sys

random.seed(int(sys.argv[3]) if len(sys.argv) > 3 else 7)
n, nl = int(sys.argv[1]), int(sys.argv[2])
cells = random.sample([(c, r) for c in range(0, 30, 2) for r in range(0, 20, 2)], n)
stations = [{"id": f"s{i}", "label": f"App {i}", "at": list(p)} for i, p in enumerate(cells)]
colors = ["#7B3FE4", "#0098D4", "#00A88F", "#00782A", "#DC241F", "#EE7C0E", "#9B0056", "#B36305", "#F2C500", "#E21836", "#003688", "#84B817"]
lines = []
for j in range(nl):
    start = random.choice(cells)
    stops = [start]
    while len(stops) < random.randint(5, 9):
        cur = stops[-1]
        near = sorted((p for p in cells if p not in stops), key=lambda p: abs(p[0] - cur[0]) + abs(p[1] - cur[1]))[:4]
        stops.append(random.choice(near))
    idx = {tuple(s["at"]): s["id"] for s in stations}
    lines.append({"id": f"l{j}", "code": str(j + 1), "label": f"Line {j + 1}", "color": colors[j % len(colors)],
                  "stops": [idx[p] for p in stops]})
json.dump({"title": "Stress", "subtitle": f"{n} stations, {nl} lines", "zones": [], "stations": stations, "lines": lines}, sys.stdout)
