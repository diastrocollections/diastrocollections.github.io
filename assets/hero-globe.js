/*
 * Diastro Gaming Collections — the globe in the hub hero.
 *
 * Draws Earth in scanlines, like a PAL picture on a CRT, seen from orbit with
 * Europe facing us. Every
 * city where a studio on the shelf was based gets a light, sized by how many
 * games on the shelf were made there. The city list lives in data/studios.json.
 *
 * The three studios with the most games on the shelf get a label.
 *
 * Light mode shows Europe by day: the cities are small ink dots. Dark mode
 * shows it at night, with the cities lit. Colours come from the --globe-*
 * tokens in hub.css, so the globe follows the site palette and the theme toggle.
 *
 * The land lines are also copied onto two extra canvases that hub.css animates
 * like a CRT: a breathing phosphor glow at night and a slow rolling bar.
 *
 * The coastlines are deliberately rough lon/lat outlines: at this line spacing
 * nobody can tell, and it keeps the file small.
 */
(function () {
  var stage = document.getElementById('globeStage');
  if (!stage) return;
  var baseCanvas = document.getElementById('globeBase');
  var lightsCanvas = document.getElementById('globeLights');
  // Copies of the land lines for the CRT animation, which hub.css plays.
  var crtCanvases = [document.getElementById('globeGlow'), document.getElementById('globeRoll')].filter(Boolean);
  var tip = document.getElementById('globeTip');
  var summaryEl = document.getElementById('globeSummary');

  var D = Math.PI / 180;
  var RASTER_STEP = 0.3; // degrees per cell of the land lookup table
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Geography (lon, lat) ---------- */

  // Mainland Europe up to the Urals. Inland seas are cut out with WATER below.
  var EUROPE = [[-8.9,37],[-8.8,38.7],[-9.5,39.4],[-8.8,41],[-8.9,42.6],[-9.3,43],[-7.9,43.8],[-5.8,43.6],[-3,43.4],[-1.6,43.4],[-1.2,44.7],[-1.2,46.2],[-2.3,47.1],[-4.6,47.9],[-4.6,48.6],[-3,48.8],[-1.6,48.7],[-1.4,49.7],[0.2,49.5],[1.6,50.2],[2.5,51.1],[3.6,51.4],[4.2,52],[4.7,52.9],[5.6,53.4],[7,53.6],[8.6,53.9],[8.6,55.4],[8.1,56.6],[9.5,57.2],[10.6,57.7],[11.6,58.2],[11.2,59],[10.5,59],[9.6,58.9],[8.2,58.1],[7,58],[5.6,58.6],[5.2,59.5],[5,61],[5.2,62.5],[7,63],[9,63.8],[10.6,64.8],[12.4,66],[13.5,67.6],[15.5,68.5],[18,69.6],[21,70.2],[24,71],[26.5,70.9],[28.5,71],[31,70.3],[33,69.4],[36,69.1],[41,67.7],[43.5,68.6],[46,68],[50,68.5],[54,68.8],[58,68.8],[60,69.5],[59,60],[58,52],[53,51],[51,47],[49,46.5],[47.5,45],[47.5,43],[45,42.5],[41.6,41.6],[39.7,43.6],[37.8,44.7],[36.5,45.3],[35.4,45],[33.5,44.5],[32.6,45.4],[33.6,46.1],[31.7,46.6],[30.7,46.5],[29.6,45.2],[28.6,44],[27.6,42.6],[28,41.6],[29,41.2],[27,40.4],[26.2,40.3],[26,40.8],[24.3,40.9],[23.7,40.7],[22.6,40.3],[23,39.6],[22.6,38.9],[24,38.2],[22.8,37.6],[23.2,36.4],[22.4,36.4],[21.1,38.3],[20.2,39.6],[19.4,40.4],[19.4,41.9],[17.5,43],[16,43.5],[15.2,44.3],[14.4,45.2],[13.6,45.1],[13.7,45.6],[12.4,45.4],[12.3,44.5],[13.6,43.5],[14,42.6],[16,41.4],[18,40.6],[18.5,40.1],[17.2,40.4],[16.5,39.7],[17.1,39],[16.6,38.4],[15.6,38],[15.8,39.5],[15.6,40],[14.6,40.6],[13.6,41.2],[12,41.9],[10.5,42.9],[10.2,43.9],[8.8,44.4],[7.5,43.8],[6.6,43.1],[4.8,43.4],[3,43.2],[3.2,42],[0.9,40.9],[-0.3,39.5],[0.2,39],[-0.5,38.3],[-2,36.7],[-5.4,36],[-6,36.2],[-7.4,37.2]];

  var WATER = [
    // Kattegat, Baltic, Gulf of Bothnia, Gulf of Finland
    [[10.7,57.6],[11.6,57.9],[12,57.3],[12.9,56.4],[12.6,56],[12.9,55.4],[14.2,55.4],[14.4,56],[16,56.2],[16.6,57],[16.6,58.5],[18,59],[18.9,59.8],[17.6,60.6],[17.3,61.7],[18,62.8],[20.5,63.9],[22,65.4],[24.6,65.8],[25.4,65],[24.6,64.2],[22.4,63.2],[21.4,62],[21.4,60.8],[22.5,60.2],[25.5,60.4],[28,60.5],[30.2,60],[29,59.8],[28,59.4],[26,59.5],[24,59.4],[23.5,59],[22,58.6],[21.5,57.3],[21,56.5],[21.1,55.7],[20,54.9],[19.5,54.4],[18.5,54.8],[16.5,54.5],[14.2,53.9],[12.5,54.4],[11,54],[10.1,54.4],[9.9,54.8],[9.6,55.5],[10.2,56.2],[10.5,57]],
    // Caspian Sea
    [[49,45],[47.5,44.5],[49,40],[50,37],[54,37],[54,42],[53,45],[51,47]]
  ];

  var ISLANDS = [
    // Great Britain
    [[-5.7,50],[-4.2,50.3],[-3,50.7],[-1,50.7],[1.4,51.2],[1.7,52.6],[0.3,53.4],[-0.1,54],[-1.3,54.8],[-1.6,55.6],[-2.1,56],[-2.6,56.3],[-1.8,57.6],[-3,57.7],[-4,57.6],[-3.1,58.6],[-5,58.6],[-5.7,57.5],[-5.6,56.4],[-6.2,56.3],[-5,55.6],[-5.1,54.8],[-3.4,54.9],[-3.2,54.1],[-3,53.4],[-4.6,53.3],[-4.1,52.7],[-5.1,51.9],[-4.2,51.6],[-3,51.5],[-4.5,51.1]],
    // Ireland
    [[-6,52.2],[-6,53],[-6.2,53.8],[-5.5,54.3],[-6,55.2],[-7.3,55.3],[-8.4,55.2],[-8.6,54.3],[-10,54.2],[-9.9,53.4],[-9.5,52.6],[-10.4,52.1],[-9.8,51.5],[-8.2,51.8]],
    // Iceland
    [[-22,64],[-24,65.5],[-22,66.4],[-16,66.5],[-14.5,65.5],[-14.5,64.4],[-18,63.4]],
    // Zealand and Funen
    [[9.9,55.1],[10.8,55.3],[11,55.7],[12.6,56.05],[12.6,55.2],[11.8,54.9],[10.6,54.8]],
    // Corsica, Sardinia, Sicily, Crete
    [[8.6,41.4],[9.4,41.4],[9.5,42.8],[9.3,43],[8.6,42.4]],
    [[8.4,39],[9.6,39.1],[9.8,40.6],[9.2,41.2],[8.2,40.9]],
    [[12.4,37.8],[15.1,36.7],[15.6,38.3],[13,38.2]],
    [[23.5,35.3],[26.3,35.1],[26.2,35.4],[23.6,35.6]],
    // Svalbard
    [[11,78.5],[17,76.5],[22,77.5],[27,80],[17,80.3],[11,79.7]]
  ];

  // Neighbouring coasts, drawn fainter so the Mediterranean and Black Sea read as seas.
  var NEIGHBOURS = [
    [[26.2,40],[26.5,39],[27,38],[27.3,37],[28,36.7],[30.5,36.3],[32,36.1],[34,36.3],[36,36.6],[35.8,34.6],[35,33],[34.5,31.5],[36,31],[42,31],[45,35],[44,38],[44.5,40],[43.5,41.1],[41.6,41.6],[40,41],[37,41.1],[35,42],[33,42],[31,41.2],[29.1,41.1],[29,40.6],[27.5,40.4]],
    [[-17,21],[-14.5,26],[-13,27.7],[-9.8,30],[-9.5,32.5],[-6.8,34],[-5.9,35.8],[-2,35.1],[1,36.5],[5,36.8],[9,37.2],[10.3,37],[11,36.8],[10.2,35.5],[11,34.7],[10.1,33.8],[11.5,33.1],[15.2,32.4],[18,30.7],[20,31.6],[20,32.6],[22.5,32.8],[25,31.8],[29.5,31],[32,31.2],[34.5,31.5],[34.5,28],[35,20],[-17,15]]
  ];

  function inside(lon, lat, poly) {
    var hit = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) hit = !hit;
    }
    return hit;
  }

  function insideAny(lon, lat, polys) {
    for (var i = 0; i < polys.length; i++) if (inside(lon, lat, polys[i])) return true;
    return false;
  }

  // 0 = sea or elsewhere, 1 = neighbouring coast, 2 = Europe
  function classify(lon, lat) {
    if (lon < -30 || lon > 70 || lat < 12 || lat > 82) return 0;
    if (insideAny(lon, lat, ISLANDS)) return 2;
    if (inside(lon, lat, EUROPE)) return insideAny(lon, lat, WATER) ? 0 : 2;
    return insideAny(lon, lat, NEIGHBOURS) ? 1 : 0;
  }

  function angularDistance(lon1, lat1, lon2, lat2) {
    var c = Math.sin(lat1 * D) * Math.sin(lat2 * D) +
      Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.cos((lon1 - lon2) * D);
    return Math.acos(Math.max(-1, Math.min(1, c))) / D;
  }

  // A lookup table of land weight over Europe's corner of the world: 1 in the
  // heart of Europe, fading out towards the Urals and North Africa, 0 for sea.
  // Built once; drawing then only needs cheap lookups.
  var RASTER = { lon0: -30, lat0: 12, cols: Math.ceil(100 / RASTER_STEP), rows: Math.ceil(70 / RASTER_STEP) };

  function buildRaster() {
    var cells = new Float32Array(RASTER.cols * RASTER.rows);
    for (var r = 0; r < RASTER.rows; r++) {
      for (var c = 0; c < RASTER.cols; c++) {
        var lon = RASTER.lon0 + (c + 0.5) * RASTER_STEP, lat = RASTER.lat0 + (r + 0.5) * RASTER_STEP;
        var kind = classify(lon, lat);
        if (!kind) continue;
        var weight = Math.max(0, Math.min(1, 1 - (angularDistance(lon, lat, 14, 52) - 24) / 16));
        cells[r * RASTER.cols + c] = kind === 1 ? weight * 0.5 : weight;
      }
    }
    return cells;
  }

  function landWeight(lon, lat) {
    var c = Math.floor((lon - RASTER.lon0) / RASTER_STEP), r = Math.floor((lat - RASTER.lat0) / RASTER_STEP);
    if (c < 0 || r < 0 || c >= RASTER.cols || r >= RASTER.rows) return 0;
    return raster[r * RASTER.cols + c];
  }

  /* ---------- Projection ---------- */

  function makeView(lon0, lat0, cx, cy, R) {
    return { lon0: lon0, s0: Math.sin(lat0 * D), c0: Math.cos(lat0 * D), cx: cx, cy: cy, R: R };
  }

  function project(lon, lat, v) {
    var cl = Math.cos(lat * D), sl = Math.sin(lat * D), dl = (lon - v.lon0) * D, cd = Math.cos(dl);
    return {
      x: v.cx + v.R * cl * Math.sin(dl),
      y: v.cy - v.R * (v.c0 * sl - v.s0 * cl * cd),
      z: v.s0 * sl + v.c0 * cl * cd // > 0 means on the visible side
    };
  }

  // A point on screen back to lon/lat, or null outside the globe. z is the same
  // as in project(): 1 facing us, 0 at the edge.
  function unproject(x, y, v) {
    var X = (x - v.cx) / v.R, Y = (v.cy - y) / v.R, rho = Math.sqrt(X * X + Y * Y);
    if (rho >= 1) return null;
    if (rho < 1e-9) return { lon: v.lon0, lat: Math.asin(v.s0) / D, z: 1 };
    var c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c);
    return {
      lon: v.lon0 + Math.atan2(X * sc, rho * cc * v.c0 - Y * sc * v.s0) / D,
      lat: Math.asin(cc * v.s0 + Y * sc * v.c0 / rho) / D,
      z: cc
    };
  }

  function seededRandom(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- State ---------- */

  var raster = null;
  var cities = [];
  var highlights = [];
  var state = { v: null, W: 0, H: 0, dpr: 1, dark: false, placed: [], marks: [], visible: true };

  // Where each highlight's label goes, relative to its city, in rank order:
  // [dx, dy, text alignment]. Scaled with the globe.
  // Labels never go left: that side of the globe sits under the hero text.
  var LABEL_SPOTS = [[26, -90, 'left'], [72, 20, 'left'], [36, -34, 'left']];

  function token(name) {
    return getComputedStyle(stage).getPropertyValue(name).trim();
  }

  function isDark() {
    return token('--globe-mode') === 'dark';
  }

  function layout() {
    var rect = stage.getBoundingClientRect();
    var W = Math.max(1, rect.width), H = Math.max(1, rect.height);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    baseCanvas.width = lightsCanvas.width = Math.round(W * dpr);
    baseCanvas.height = lightsCanvas.height = Math.round(H * dpr);
    crtCanvases.forEach(function (c) { c.width = baseCanvas.width; c.height = baseCanvas.height; });

    // On wide screens the globe sits beside the text, framed --globe-floor above the
    // bottom of the hero; on phones
    // (where hub.css sets --globe-floor to 0) it sits in its own band under the text.
    var floor = parseFloat(token('--globe-floor')) || 0;
    var narrow = floor === 0;
    var h = H - floor;
    // Zoomed in far enough that Europe fills the frame; the curve of the
    // planet still shows at the top corners.
    var R = h * 1.3;
    var cx = W * (narrow ? 0.48 : 0.6);
    var cy = h * 1.32;

    state.v = makeView(12, 18, cx, cy, R);
    state.W = W; state.H = H; state.dpr = dpr;
    state.dark = isDark();
    if (!raster) raster = buildRaster();
    drawBase();
    state.placed = cities.map(function (c) {
      var p = project(c.lon, c.lat, state.v);
      return { c: c, x: p.x, y: p.y, phase: c.lon * 7.3 };
    });
    state.marks = highlights.map(function (h) {
      var p = project(h.lon, h.lat, state.v);
      return { h: h, x: p.x, y: p.y };
    });
    drawLights(performance.now());
  }

  /* ---------- Drawing ---------- */

  function drawBase() {
    var s = state, v = s.v, ctx = baseCanvas.getContext('2d');
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.W, s.H);

    if (s.dark) {
      var rand = seededRandom(7);
      ctx.fillStyle = token('--globe-star');
      for (var i = 0; i < 150; i++) {
        var x = rand() * s.W, y = rand() * s.H, big = rand() < 0.15;
        if (Math.hypot(x - v.cx, y - v.cy) < v.R * 1.05) continue;
        ctx.globalAlpha = 0.15 + rand() * 0.45;
        ctx.fillRect(x, y, big ? 1.6 : 1, big ? 1.6 : 1);
      }
      ctx.globalAlpha = 1;
    }

    var halo = ctx.createRadialGradient(v.cx, v.cy, v.R * 0.97, v.cx, v.cy, v.R * 1.07);
    halo.addColorStop(0, token('--globe-halo'));
    halo.addColorStop(1, token('--globe-halo-fade'));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(v.cx, v.cy, v.R * 1.07, 0, Math.PI * 2); ctx.fill();

    // Scanlines: one row every few pixels. The sea is a single faint line per
    // row; the land is drawn on its own layer so it can glow at night.
    var pitch = Math.max(3, Math.round(v.R / 200)); // pixels between lines
    var thick = Math.max(1, pitch * 0.5);
    var layer = document.createElement('canvas');
    layer.width = baseCanvas.width; layer.height = baseCanvas.height;
    var lc = layer.getContext('2d');
    lc.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    lc.fillStyle = token('--globe-land');
    ctx.fillStyle = token('--globe-sea');
    var seaAlpha = s.dark ? 0.8 : 0.55;
    for (var y = pitch / 2; y < s.H; y += pitch) {
      var dy = (v.cy - y) / v.R;
      if (Math.abs(dy) >= 1) continue;
      var half = Math.sqrt(1 - dy * dy) * v.R;
      var x0 = Math.max(0, v.cx - half), x1 = Math.min(s.W, v.cx + half);
      ctx.globalAlpha = seaAlpha;
      ctx.fillRect(x0, y - thick / 2, x1 - x0, thick * 0.6);
      for (var x = x0; x < x1; x += 1) {
        var g = unproject(x, y, v);
        if (!g) continue;
        var w = landWeight(g.lon, g.lat);
        if (w <= 0.02) continue;
        lc.globalAlpha = (0.12 + 0.88 * w * w) * (0.35 + 0.65 * g.z);
        lc.fillRect(x, y - thick / 2, 1.05, thick);
      }
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (s.dark) {
      // A soft phosphor glow under the lines. Browsers without canvas filters
      // (Safari) skip the blur and simply show the lines.
      ctx.filter = 'blur(' + Math.round(3 * s.dpr) + 'px)';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(layer, 0, 0);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
    crtCanvases.forEach(function (c) {
      var cc = c.getContext('2d');
      cc.clearRect(0, 0, c.width, c.height);
      cc.drawImage(layer, 0, 0);
    });
  }

  function drawLights(t) {
    var s = state, ctx = lightsCanvas.getContext('2d');
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.W, s.H);
    if (!s.v) return;
    var scale = s.v.R / 650;
    var city = token('--globe-city');
    var ink = token('--globe-label');
    var still = reduceMotion.matches;

    s.placed.forEach(function (p) {
      var size = Math.sqrt(p.c.games);
      if (s.dark) {
        var flicker = still ? 1 : 0.88 + 0.12 * Math.sin(t / 900 + p.phase);
        var gr = (5 + size * 4.2) * scale * flicker;
        var glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
        glow.addColorStop(0, token('--globe-glow-core'));
        glow.addColorStop(0.35, token('--globe-glow'));
        glow.addColorStop(1, token('--globe-glow-fade'));
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x, p.y, gr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = city;
        ctx.beginPath(); ctx.arc(p.x, p.y, (0.9 + size * 0.32) * scale, 0, Math.PI * 2); ctx.fill();
      } else {
        // By day, a plain ink dot per city.
        ctx.fillStyle = city;
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 * scale + 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // Labels for the three biggest studios.
    ctx.font = '500 11px ' + token('--site-font-mono');
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1;
    var paper = token('--bg');
    // Labels get a thin outline in the page colour so they stay readable over the scanlines.
    function label(text, x, y) {
      ctx.save();
      ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = paper;
      ctx.strokeText(text, x, y);
      ctx.restore();
      ctx.fillText(text, x, y);
    }
    var k = Math.max(0.6, scale);
    s.marks.forEach(function (m, i) {
      var spot = LABEL_SPOTS[i % LABEL_SPOTS.length];
      var lx = m.x + spot[0] * k, ly = m.y + spot[1] * k;
      var ux = spot[0] < 0 ? -1 : 1, uy = spot[1] < 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(m.x + 3 * ux, m.y + 4 * uy);
      ctx.lineTo(lx - 3 * ux, ly - 7 * uy);
      ctx.stroke();
      ctx.textAlign = spot[2];
      label(m.h.city + ' · ' + m.h.studio + ' · ' + m.h.games + ' games', lx, ly);
    });
    ctx.textAlign = 'left';
  }

  function animate(t) {
    if (state.dark && state.visible && !reduceMotion.matches && !document.hidden) drawLights(t);
    requestAnimationFrame(animate);
  }

  /* ---------- Tooltip ---------- */

  stage.addEventListener('pointermove', function (e) {
    var rect = stage.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var best = null, bestDist = 16;
    state.placed.forEach(function (p) {
      var d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) { bestDist = d; best = p; }
    });
    if (!best) { tip.hidden = true; return; }
    var c = best.c;
    tip.textContent = c.city + ': ' + c.studios.join(', ') + '. ' + c.games + (c.games === 1 ? ' game' : ' games') + ' on the shelf.';
    tip.hidden = false;
    // The tip shares the hero as positioning parent with the stage, so offset by the stage's position.
    var left = Math.max(8, Math.min(best.x + 14, rect.width - tip.offsetWidth - 8));
    var top = Math.max(8, best.y - tip.offsetHeight - 10);
    tip.style.left = (stage.offsetLeft + left) + 'px';
    tip.style.top = (stage.offsetTop + top) + 'px';
  });
  stage.addEventListener('pointerleave', function () { tip.hidden = true; });

  /* ---------- Data ---------- */

  // data/studios.json lists one entry per studio and city. Group them by city.
  // Entries marked "low" confidence wait in the file until they're confirmed.
  function groupByCity(studios) {
    var byCity = {};
    studios.forEach(function (s) {
      if (s.confidence === 'low') return;
      var key = s.city + '|' + s.country;
      if (!byCity[key]) byCity[key] = { city: s.city, country: s.country, lat: s.lat, lon: s.lon, games: 0, studios: [] };
      byCity[key].games += s.games;
      if (byCity[key].studios.indexOf(s.studio) === -1) byCity[key].studios.push(s.studio);
    });
    return Object.keys(byCity).map(function (k) { return byCity[k]; })
      .sort(function (a, b) { return b.games - a.games; });
  }

  // The studios with the most games on the shelf. A tie goes to the studio
  // farthest from the ones already picked, so the labels spread out.
  function topStudios(studios, count) {
    var byStudio = {};
    studios.forEach(function (s) {
      if (s.confidence === 'low') return;
      var key = s.studio + '|' + s.city;
      if (!byStudio[key]) byStudio[key] = { studio: s.studio, city: s.city, lat: s.lat, lon: s.lon, games: 0 };
      byStudio[key].games += s.games;
    });
    var pool = Object.keys(byStudio).map(function (k) { return byStudio[k]; });
    var picked = [];
    function spread(s) {
      return picked.reduce(function (min, p) { return Math.min(min, angularDistance(s.lon, s.lat, p.lon, p.lat)); }, 180);
    }
    while (picked.length < count && pool.length) {
      pool.sort(function (a, b) { return (b.games - a.games) || (spread(b) - spread(a)); });
      picked.push(pool.shift());
    }
    return picked;
  }

  function describe(list) {
    if (!list.length || !summaryEl) return;
    var total = list.reduce(function (sum, c) { return sum + c.games; }, 0);
    summaryEl.textContent = 'Map of Europe with a light on each of ' + list.length + ' cities where ' + total +
      ' games on the shelf were made. The studios with the most games: ' +
      highlights.map(function (h) { return h.studio + ' in ' + h.city + ' (' + h.games + ')'; }).join(', ') + '.';
  }

  var pending = null;
  function relayout() {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(function () { pending = null; layout(); });
  }

  fetch(stage.getAttribute('data-src'))
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (studios) {
      cities = groupByCity(studios);
      highlights = topStudios(studios, 3);
      describe(cities);
      relayout();
    })
    .catch(function (err) {
      console.error('hero-globe.js: failed to load studio list', err);
    });

  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(stage);
  else window.addEventListener('resize', relayout);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', relayout);
  new MutationObserver(relayout).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      state.visible = entries[0].isIntersecting;
      stage.classList.toggle('is-paused', !state.visible);
    }).observe(stage);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  relayout();
  requestAnimationFrame(animate);
})();
