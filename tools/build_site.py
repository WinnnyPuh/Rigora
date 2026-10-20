"""Builds public/index.html: the trip planner (ported from the Claude prototype) plus the
company check, with a top navigation. Run: python3 tools/build_site.py
Inputs: tools/planner-src.html (prototype) and tools/check-src.html (the phase 1 check page)."""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
B = (ROOT / "tools" / "planner-src.html").read_text(encoding="utf-8")
C = (ROOT / "tools" / "check-src.html").read_text(encoding="utf-8")

def rep(s, o, n, c=1):
    k = s.count(o)
    if k != c: sys.exit(f"want {c} of {o[:90]!r}, got {k}")
    return s.replace(o, n)

css = re.search(r"<style>(.*?)</style>", B, re.S).group(1)
scripts = re.findall(r"<script>(.*?)</script>", B, re.S)
dp, pjs = scripts[0], scripts[1]
pmain = B[B.index('<section class="view" id="v-plan" hidden>'):]
pmain = pmain[:pmain.index("  </section>\n\n  <!-- POST -->")] + "  </section>"
pmain = pmain.replace('<section class="view" id="v-plan" hidden>', '<section class="view" id="v-plan">')

# ---------- planner markup: truck height and length, honest notes ----------
pmain = rep(pmain, '<div class="f"><label class="lbl" for="weight" data-pi18n="weight">Gross weight, lb</label>',
  '<div class="f"><label class="lbl" for="height" data-pi18n="height">Height, ft</label><input id="height" type="number" step="0.25" min="7" max="15" value="13.5" inputmode="decimal"></div>'
  '<div class="f"><label class="lbl" for="length" data-pi18n="length">Length, ft</label><input id="length" type="number" step="1" min="10" max="120" value="72" inputmode="numeric"></div>'
  '<div class="f"><label class="lbl" for="weight" data-pi18n="weight">Gross weight, lb</label>')

# example trip across the top of the country
pjs = rep(pjs, '{q:"Parker, CO",pos:null,label:""},\n  {q:"Kansas City, MO",pos:null,label:""},\n  {q:"Chicago, IL",pos:null,label:""}',
               '{q:"New York, NY",pos:null,label:""},\n  {q:"Chicago, IL",pos:null,label:""},\n  {q:"Seattle, WA",pos:null,label:""}')
# ---------- planner script: talk to our own API instead of Claude connectors ----------
adapter = r'''
// ---------- site API adapter (replaces Claude connectors) ----------
async function apiGet(path){const r=await fetch(path);return apiOut(r)}
async function apiPost(path,body){const r=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return apiOut(r)}
async function apiOut(r){let j=null;try{j=await r.json()}catch(e){}
  if(r.ok&&j&&!j.error)return j;
  throw {code:r.status===400?"tool_error":"server_unavailable",message:(j&&(j.detail||j.error))||("HTTP "+r.status),retryable:r.status>=500};}
const enc=encodeURIComponent;
const SITE={
  "tomtom-fuzzy-search":i=>apiGet(`/api/search?q=${enc(i.query)}&limit=${i.limit||6}&typeahead=${i.typeahead?1:0}`),
  "tomtom-routing":i=>apiPost("/api/route",i),
  "tomtom-traffic":i=>apiGet(`/api/traffic?bbox=${enc((i.bbox||[]).join(","))}`),
  "tomtom-reverse-geocode":()=>Promise.resolve({}),
  "xweather_get_current_weather":i=>apiGet(`/api/wx?kind=current&loc=${enc(i.location)}`),
  "xweather_get_forecast_weather":i=>apiGet(`/api/wx?kind=${i.forecast_filter==="day"?"daily":"hourly"}&loc=${enc(i.location)}&at=${enc(i.start_datetime||"")}`),
  "xweather_get_current_active_weather_alerts":i=>apiGet(`/api/wx?kind=alerts&loc=${enc(i.location)}`),
  "xweather_get_roadweather":()=>Promise.resolve({roadweather:[]})
};
const siteMcp={callTool:async(server,tool,input)=>{const f=SITE[tool];if(!f)throw {code:"tool_error",message:"unknown "+tool};return {payload:await f(input||{})}}};
// state miles come back with the route, computed on the server from state boundaries
function smFromSpans(spans,dist){
  const total=dist[dist.length-1];
  if(!spans||!spans.length)spans=[{st:"US",i0:0,i1:dist.length-1}];
  const segs=spans.map(s=>({st:s.st,m:dist[s.i1]-dist[s.i0],i0:s.i0,i1:s.i1}));
  const bounds=spans.slice(1).map((s,k)=>({i:s.i0,from:spans[k].st,to:s.st}));
  const per={};segs.forEach(s=>{if(s.m>0)per[s.st]=(per[s.st]||0)+s.m});
  const order=[];segs.forEach(s=>{if(s.m>0&&!order.includes(s.st))order.push(s.st)});
  if(!order.length){per[spans[0].st]=total;order.push(spans[0].st)}
  return {per,order,segs,bounds};
}
'''
pjs = rep(pjs, "\n// ---------- status ----------", adapter + "\n// ---------- status ----------")

# POIs: along the actual route line, one request per query
pjs = re.sub(r"async function poisAlong\(legPts,cat,q\)\{.*?\n\}\n", r'''async function poisAlong(coords,cat,q){
  const dist=cumDist(coords),pts=[coords[0]];let next=3000;
  for(let i=1;i<coords.length;i++){if(dist[i]>=next){pts.push(coords[i]);next=dist[i]+3000}}
  pts.push(coords[coords.length-1]);
  try{const j=await apiPost("/api/along",{points:pts.slice(0,1500),query:q,code:cat||null});return ((j.pois||{}).features)||[]}
  catch(e){if(e&&e.code!=="tool_error")throw e;return []}
}
''', pjs, count=1, flags=re.S)
assert "apiPost(\"/api/along\"" in pjs
pjs = rep(pjs, 'poisAlong(pts,"WEIGH_STATION","weigh station")', 'poisAlong(coords,"WEIGH_STATION","weigh station")')
pjs = rep(pjs, 'poisAlong(pts,null,"inspection station")', 'poisAlong(coords,null,"inspection station")')
pjs = rep(pjs, 'poisAlong(pts,"TRUCK_STOP","truck stop")', 'poisAlong(coords,"TRUCK_STOP","truck stop")')

# route: keep the server's state spans; truck height/length
pjs = rep(pjs, 'return {coords:c,dist:d,sum:f.properties.summary,secs:sc,tollMi:',
               'return {coords:c,dist:d,spans:f.properties.stateSpans,sum:f.properties.summary,secs:sc,tollMi:')
pjs = rep(pjs, 'const sm=await stateMiles(coords,dist,p=>status(T("s_states"),{prog:.2+p*.55}));A0.sm=sm;',
               'const sm=smFromSpans(A0.spans,dist);A0.sm=sm;')
pjs = rep(pjs, 'if(!A.sm){status(T("alt_loading"),{prog:.1});A.sm=await stateMiles(A.coords,A.dist,p=>status(T("alt_loading"),{prog:.1+p*.85}))}',
               'if(!A.sm)A.sm=smFromSpans(A.spans,A.dist);')
pjs = rep(pjs, 'const rin={locations:pts,response_detail:"full",sectionType:["toll","tollRoad"],vehicleWeight:Math.round(lb*0.453592),vehicleMaxSpeed:Math.round(mph*1.609344),traffic:"live",routeType:"fast"};',
               'const ftIn=id=>{const v=parseFloat($(id).value);return v>0?+(v*0.3048).toFixed(2):null};\n    const rin={locations:pts,vehicleWeight:Math.round(lb*0.453592),vehicleHeight:ftIn("height"),vehicleLength:ftIn("length"),vehicleMaxSpeed:Math.round(mph*1.609344)};')

# truck presets get height and length
pjs = rep(pjs, 'tt:{weight:80000,mpg:6.5,tank:200,speed:65,fuel:"diesel"},', 'tt:{weight:80000,mpg:6.5,tank:200,speed:65,fuel:"diesel",h:13.5,len:72},')
for sz, h, ln in [(10, 10, 18), (12, 10.5, 21), (16, 11.5, 26), (20, 12, 31), (26, 12.5, 36)]:
    pjs = re.sub(rf'(    {sz}:\{{weight:[^}}]*?)(gvwr:)', rf'\1h:{h},len:{ln},\2', pjs, count=1)
pjs = rep(pjs, '$("weight").value=t.weight;$("mpg").value=t.mpg;', '$("weight").value=t.weight;$("height").value=t.h;$("length").value=t.len;$("mpg").value=t.mpg;')

# boot: our API is always there
boot = re.search(r"\(async\(\)=>\{\n  try\{ mcp=await window\.claude\?\.use\?\.\(\"mcp\"\);.*?\n\}\)\(\);", pjs, re.S).group(0)
pjs = pjs.replace(boot, '''mcp=siteMcp;connState="ready";$("connDot").className="dot ok";$("connTxt").textContent=T("cs_ready");
$("hereLoc").value=stops[0].q;loadHere(stops[0].q);''')

# copy: what's different on the site (truck routing on, NWS weather, no road surface)
newtxt = {
 "en": dict(cav="Routes are calculated for your truck's height, length, weight and speed, so low bridges and truck-restricted roads are avoided. Always follow posted signs. Miles by state are measured along the route from state boundaries.",
            wx_note='Checked every 50 miles and at each stop. "At my ETA" uses your schedule above, so change the departure time or HOS and press Check weather again. Forecasts and alerts come from the National Weather Service (US only). Road-surface data isn\'t available yet.',
            cs_ready="Maps ready", height="Height, ft", length="Length, ft"),
 "ru": dict(cav="Маршрут считается под высоту, длину, вес и скорость вашего трака, поэтому низкие мосты и запрещённые для траков дороги обходятся. Всегда следуйте дорожным знакам. Мили по штатам считаются вдоль маршрута по границам штатов.",
            wx_note="Проверка каждые 50 миль и на каждой остановке. «На моё время» берёт расписание выше: измените выезд или HOS и снова нажмите «Проверить погоду». Прогноз и предупреждения — от National Weather Service (только США). Данных о покрытии дороги пока нет.",
            cs_ready="Карты готовы", height="Высота, фт", length="Длина, фт"),
 "es": dict(cav="La ruta se calcula para la altura, largo, peso y velocidad de tu camión, así que evita puentes bajos y vías restringidas para camiones. Sigue siempre las señales. Las millas por estado se miden a lo largo de la ruta con los límites estatales.",
            wx_note="Se revisa cada 50 millas y en cada parada. «A mi hora de paso» usa tu horario de arriba: cambia la salida o el HOS y vuelve a pulsar Revisar clima. El pronóstico y las alertas son del National Weather Service (solo EE. UU.). Aún no hay datos del pavimento.",
            cs_ready="Mapas listos", height="Altura, pies", length="Largo, pies")}
newtxt["en"].update(gps_btn="📍 My location", gps_here="My location", gps_no="Location is off for this site. Type a city or ZIP instead.",
    here_note="Allow location to see weather where you are, or type a city or ZIP. Until then it shows the start address.", gps_ok="Showing weather at your location. Type a city or ZIP to check somewhere else.")
newtxt["ru"].update(gps_btn="📍 Где я", gps_here="Моё местоположение", gps_no="Геолокация для сайта выключена. Впишите город или ZIP.",
    here_note="Разрешите геолокацию, чтобы видеть погоду там, где вы, или впишите город или ZIP. Пока показан стартовый адрес.", gps_ok="Погода по вашему местоположению. Впишите город или ZIP, чтобы посмотреть другое место.")
newtxt["es"].update(gps_btn="📍 Mi ubicación", gps_here="Mi ubicación", gps_no="La ubicación está desactivada para este sitio. Escribe una ciudad o ZIP.",
    here_note="Permite la ubicación para ver el clima donde estás, o escribe una ciudad o ZIP. Mientras tanto muestra la dirección de salida.", gps_ok="Clima en tu ubicación. Escribe una ciudad o ZIP para ver otro lugar.")

# real GPS for "Weather here"; hide fields NWS doesn't give
pmain = rep(pmain, '<p class="note" data-pi18n="here_note">', '<p class="note" id="hereNote" data-pi18n="here_note">')
pmain = rep(pmain, '<button class="btn" type="submit" data-pi18n="check">Check</button></form>',
  '<button class="btn" type="submit" data-pi18n="check">Check</button><button class="btn" type="button" id="hereGps" data-pi18n="gps_btn">📍 My location</button></form>')
pjs = rep(pjs, """<span class="meta">${T("feels")} ${w.feelslikeF!=null?Math.round(w.feelslikeF)+"°F":"—"} · ${T("wind")} ${w.windSpeedMPH!=null?Math.round(w.windSpeedMPH):"—"} mph ${esc(w.windDir||"")}${w.windGustMPH?" ("+T("gusts")+" "+Math.round(w.windGustMPH)+")":""} · ${T("humidity")} ${w.humidity??"—"}% · ${T("visibility")} ${w.visibilityMI!=null?Math.round(w.visibilityMI)+" "+T("mi"):"—"}""",
  """<span class="meta">${[w.feelslikeF!=null?T("feels")+" "+Math.round(w.feelslikeF)+"°F":"",w.windSpeedMPH!=null?T("wind")+" "+Math.round(w.windSpeedMPH)+" mph "+esc(w.windDir||"")+(w.windGustMPH?" ("+T("gusts")+" "+Math.round(w.windGustMPH)+")":""):"",w.humidity!=null?T("humidity")+" "+w.humidity+"%":"",w.visibilityMI!=null?T("visibility")+" "+Math.round(w.visibilityMI)+" "+T("mi"):""].filter(Boolean).join(" · ")}""")
pjs = rep(pjs, '$("hereForm").addEventListener("submit",', """function gpsNote(k){const n=$("hereNote");n.setAttribute("data-pi18n",k);n.textContent=T(k);n.classList.toggle("warn",k==="gps_no")}
function useGps(){
  if(!navigator.geolocation){gpsNote("gps_no");return}
  navigator.geolocation.getCurrentPosition(p=>{const l=p.coords.latitude.toFixed(4)+","+p.coords.longitude.toFixed(4);$("hereLoc").value="";gpsNote("gps_ok");loadHere(l)},
    ()=>gpsNote("gps_no"),{maximumAge:600000,timeout:15000});
}
$("hereGps").addEventListener("click",useGps);
useGps(); // asks the browser for permission on first visit; the person can allow or block
$("hereForm").addEventListener("submit",""")
exec((ROOT / "tools" / "map_patch.py").read_text(encoding="utf-8"))
exec((ROOT / "tools" / "theme_patch.py").read_text(encoding="utf-8"))
for L, kv in newtxt.items():
    i = pjs.index(f"\n{L}:{{\n")
    j = pjs.index("\n}", i)
    seg = pjs[i:j]
    for k, v in kv.items():
        v2 = v.replace('"', '\\"')
        m = re.search(rf'([{{,\n]){k}:"(?:[^"\\]|\\.)*"', seg)
        if m: seg = seg[:m.start()] + f'{m.group(1)}{k}:"{v2}"' + seg[m.end():]
        else: seg = seg.replace(f"\n{L}:{{\n", f"\n{L}:{{\n{k}:\"{v2}\",", 1)
    pjs = pjs[:i] + seg + pjs[j:]
pjs = pjs.replace('localStorage.getItem("board_lang")', 'localStorage.getItem("rigora_lang")').replace('localStorage.setItem("board_lang",l)', 'localStorage.setItem("rigora_lang",l)')

for k, v in newtxt["en"].items():
    pmain = re.sub(rf'(data-pi18n="{k}"[^>]*>)[^<]*', lambda m: m.group(1) + v.replace("&", "&amp;").replace("<", "&lt;"), pmain)
# ---------- check page pieces ----------
ccss = re.search(r"/\* check page \*/(.*?)</style>", C, re.S).group(1)
cjs = re.search(r"<script>(.*?)</script>", C, re.S).group(1)
hero = C[C.index('<section class="hero">'):C.index('<footer class="site">')]
cjs = rep(cjs, 'localStorage.getItem("rigora_lang")', 'localStorage.getItem("rigora_lang")')
# one language switch drives both views; one router for the two tabs
cjs = rep(cjs, '  if(state.status==="error"&&state.q)check(state.q);else render();\n}',
 '''  if(window.__planner)window.__planner.applyLang(lang);
  if(window.LocalDate)window.LocalDate.refresh();
  if(state.status==="error"&&state.q)check(state.q);else render();
}
function showView(v){
  if(v!=="check")v="plan";
  document.querySelectorAll("nav.tabs [data-view]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.view===v)));
  document.querySelectorAll(".view").forEach(s=>s.hidden=s.id!=="v-"+v);
  const h=v==="check"?"#company":"#planner";
  if(location.hash!==h)history.replaceState(null,"",(v==="check"&&state.dot?"?q="+encodeURIComponent(state.dot):location.pathname)+h);
}
document.querySelectorAll("nav.tabs [data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));''')
cjs = rep(cjs, 'history.replaceState(null,"","?q="+encodeURIComponent(j.company.dot))', 'history.replaceState(null,"","?q="+encodeURIComponent(j.company.dot)+"#company")')
cjs = rep(cjs, 'const q0=new URLSearchParams(location.search).get("q");if(q0)check(q0);',
               'const q0=new URLSearchParams(location.search).get("q");showView(q0||location.hash==="#company"?"check":"plan");if(q0)check(q0);')
cjs = rep(cjs, 'document.addEventListener("click",e=>{const b=e.target.closest("[data-q]");if(b)check(b.dataset.q)});',
               'document.addEventListener("click",e=>{const b=e.target.closest("[data-q]");if(b&&b.closest("#v-check"))check(b.dataset.q)});')
# nav labels live in the check script's dictionary
for L, a, b in [("en", "Trip planner", "Check a company"), ("ru", "Планировщик", "Проверка компании"), ("es", "Planificador", "Verificar empresa")]:
    k = cjs.index(f"\n{L}:{{") + len(L) + 3
    cjs = cjs[:k] + f'nav_plan:"{a}",nav_check:"{b}",' + cjs[k:]

html = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Rigora · Truck trip planner and carrier check</title>
<meta name="description" content="Plan truck trips with fuel by state, tolls, weather, traffic, scales and HOS, and check any US carrier or broker by USDOT or MC.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&family=Geist+Mono:wght@400;500;700&display=swap">
<style>
''' + css + "\n/* check page */" + ccss + '''
.view[hidden]{display:none}
#hereNote.warn{color:var(--bad,#b42318)}
#v-plan{padding-top:20px}
</style>
<meta name="theme-color" content="#ffffff">
''' + THEME_HEAD + '''
</head>
<body>
<header class="top"><div class="wrap">
  <h1><span class="logo" aria-hidden="true"></span><span data-i18n="app">Rigora</span><span class="tagline" data-i18n="tagline">Verified moving freight</span></h1>
  <div class="hdr-r">''' + THEME_BTN + '''<div class="lang" role="group" aria-label="Language"><button type="button" data-lang="en" aria-pressed="true">EN</button><button type="button" data-lang="ru" aria-pressed="false">RU</button><button type="button" data-lang="es" aria-pressed="false">ES</button></div></div>
</div></header>
<nav class="tabs" aria-label="Sections"><div class="wrap" role="tablist">
  <button role="tab" data-view="plan" aria-selected="true" data-i18n="nav_plan">Trip planner</button>
  <button role="tab" data-view="check" aria-selected="false" data-i18n="nav_check">Check a company</button>
</div></nav>
<main><div class="wrap">
''' + pmain + '''
  <section class="view" id="v-check" hidden>
''' + hero + '''  </section>
  <footer class="site"><span data-i18n="foot">Data from FMCSA.</span></footer>
</div></main>
<script>''' + dp + '''</script>
<script>''' + pjs + '''</script>
<script>''' + cjs + '''</script>
<script>''' + THEME_JS + '''</script>
</body>
</html>
'''
(ROOT / "public" / "index.html").write_text(html, encoding="utf-8")
print("built", len(html))
