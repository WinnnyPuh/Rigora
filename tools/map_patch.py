# Run from build_site.py (exec) with pmain, pjs, css, rep, re in scope.
# 1) real map (Leaflet + free tiles) instead of the SVG sketch, route options under the map
# 2) order after Trip overview: Map -> Schedule (folded) -> Weather (folded) -> Show full details
# 3) 26 ft box truck presets

# ---------- truck presets ----------
pjs = rep(pjs, '26:{weight:25000,mpg:8,tank:50,speed:70,fuel:"diesel",h:12.5,len:36,', '26:{weight:25000,mpg:9.5,tank:50,speed:70,fuel:"diesel",h:13,len:36,')

# ---------- markup: cut the cards out and put them back in the new order ----------
def cut(src, start, end_marker="</section>"):
    i = src.index(start); j = src.index(end_marker, i) + len(end_marker)
    return src[:i] + src[j:], src[i:j]

pmain, mapc = cut(pmain, '<section class="card" id="mapCard" hidden>')
pmain, schedc = cut(pmain, '<section class="card" id="schedCard" hidden')
pmain, wxc = cut(pmain, '<section class="card" id="wxCard" hidden')
full_btn = '<button class="more-btn" type="button" id="fullBtn" aria-expanded="false" aria-controls="fullWrap"><span id="fullBtnTxt" data-pi18n="full_show">Show full details</span><span class="chev" aria-hidden="true">▾</span></button>'
pmain = rep(pmain, full_btn + "\n", "")
alts_div = '<div class="alts" id="alts" hidden></div>'
pmain = rep(pmain, alts_div, "")

# map card
mapc = rep(mapc, '<h2 data-pi18n="sketch_h">Route sketch</h2>', '<h2 data-pi18n="sketch_h">Route map</h2>')
mapc = rep(mapc, '<a class="btn" id="gmSat" href="#" target="_blank" rel="noopener" data-pi18n="open_sat">Open satellite ↗</a>',
       '<a class="btn" id="gmSat" href="#" target="_blank" rel="noopener" data-pi18n="open_sat" style="display:none">Open satellite ↗</a>')
mapc = rep(mapc, '<div class="maplinks">', '<div class="maplinks"><div class="seg seg-sm" role="radiogroup" aria-label="Map type"><button type="button" role="radio" class="segb" data-base="map" aria-checked="true" data-pi18n="mt_map">Map</button><button type="button" role="radio" class="segb" data-base="sat" aria-checked="false" data-pi18n="mt_sat">Satellite</button></div>')
mapc = re.sub(r'<div class="legend">.*?</div>\n', '''<div class="legend"><span><i style="background:#ff6a1a"></i><span data-pi18n="lg_route">Route</span></span><span><i style="background:transparent;border-top:3px dashed #6b7280;height:0"></i><span data-pi18n="lg_alt">Other route</span></span><span><i style="background:#7c3aed"></i><span data-pi18n="lg_toll">Toll road</span></span><span><i style="background:#c62a1f;width:8px;height:8px"></i><span data-pi18n="lg_weigh">Weigh / inspection</span></span><span><i style="background:#17803f;width:8px;height:8px;border-radius:50%"></i><span data-pi18n="lg_cert">Certified scale</span></span><span><i style="background:#c62a1f;width:9px;height:8px;clip-path:polygon(50% 0,100% 100%,0 100%)"></i><span data-pi18n="lg_traffic">Traffic incident</span></span><span><i style="width:10px;height:10px;border:2px dashed #b45a00;border-radius:50%;background:transparent"></i><span data-pi18n="lg_wx">Weather to watch</span></span></div>
''', mapc, count=1, flags=re.S)
mapc = rep(mapc, '<div class="mapbox"><svg id="map" viewBox="0 0 800 420" role="img" aria-label="Route sketch"></svg></div>',
       '<div class="mapbox" id="mapBox"><div id="lmap" role="region" aria-label="Route map"></div></div>\n        ' + alts_div)
mapc = re.sub(r'\n\s*<p class="note" id="gmNote">.*?</p>', '\n        <p class="note" id="gmNote" hidden></p>', mapc, count=1, flags=re.S)

# folding: Schedule keeps the arrival answer visible, the table folds
schedc = rep(schedc, '<div class="card-head"><h2 id="hSched" data-pi18n="sched_h">Schedule</h2></div>',
  '<div class="card-head"><button type="button" class="fold-btn" aria-expanded="false" aria-controls="schedBody"><h2 id="hSched" data-pi18n="sched_h">Schedule</h2><span class="fold-t" data-pi18n="fold_show">Show</span><span class="chev" aria-hidden="true">▾</span></button></div>')
schedc = rep(schedc, '<div class="tblwrap">', '<div class="fold-body" id="schedBody" hidden><div class="tblwrap">')
schedc = rep(schedc, '<p class="note" id="hosNote"></p>', '<p class="note" id="hosNote"></p></div>')

# Weather keeps the summary bar visible, the rest folds
m = re.search(r'\s*<div class="seg seg-3" role="radiogroup" aria-label="Weather time">.*?</div>\n', wxc, re.S)
seg3 = m.group(0).strip(); wxc = wxc.replace(m.group(0), "\n        ", 1)
wxc = rep(wxc, '<h2 id="hWx" data-pi18n="wx_h">Weather on the route</h2>',
  '<button type="button" class="fold-btn" aria-expanded="false" aria-controls="wxBody"><h2 id="hWx" data-pi18n="wx_h">Weather on the route</h2><span class="fold-t" data-pi18n="fold_show">Show</span><span class="chev" aria-hidden="true">▾</span></button>')
wxc = rep(wxc, '<div class="row-btns">', '<div class="fold-body" id="wxBody" hidden>' + seg3 + '\n        <div class="row-btns">')
wxc = re.sub(r'(<p class="note" data-pi18n="wx_note">.*?</p>)', r'\1</div>', wxc, count=1, flags=re.S)

pmain = rep(pmain, '<div id="fullWrap" class="col" hidden>',
  mapc + "\n\n      " + schedc + "\n\n      " + wxc + "\n\n      " + full_btn + "\n\n      <div id=\"fullWrap\" class=\"col\" hidden>")

# ---------- script ----------
pjs = rep(pjs, '''  if(go==="sched"){setFull(true,$("schedCard"));return}
  if(go==="wx"){setFull(true,$("wxCard"));return}''', '''  if(go==="sched"){setFold("schedCard",true,true);return}
  if(go==="wx"){setFold("wxCard",true,true);return}''')

# show the cards before drawing so the map knows its size
pjs = rep(pjs, '''  drawMap(coords,tolls,all,pts,sm);
  $("mapCard").hidden=false;$("detailCard").hidden=false;$("schedCard").hidden=false;$("wxCard").hidden=false;''',
'''  $("mapCard").hidden=false;$("detailCard").hidden=false;$("schedCard").hidden=false;$("wxCard").hidden=false;
  drawMap(coords,tolls,all,pts,sm);''')

newmap = r'''// ---------- route map (Leaflet, loaded on first use) ----------
const LJS="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",LCSS="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const MC={route:"#ff6a1a",casing:"#ffffff",alt:"#6b7280",toll:"#7c3aed",cert:"#17803f",weigh:"#c62a1f",bad:"#c62a1f",warn:"#b45a00",ink:"#111111",stop:"#4a4a48"};
let leafletP=null,LMAP=null,LLAY=null,LBASE={},LFIT="",mapBase="map";
try{mapBase=localStorage.getItem("rigora_map")==="sat"?"sat":"map"}catch(e){}
function loadLeaflet(){
  if(window.L&&window.L.map)return Promise.resolve(window.L);
  if(!leafletP)leafletP=new Promise((res,rej)=>{
    const css=document.createElement("link");css.rel="stylesheet";css.href=LCSS;document.head.appendChild(css);
    const s=document.createElement("script");s.src=LJS;s.async=true;
    s.onerror=()=>{leafletP=null;rej(new Error("map"))};
    s.onload=()=>{let n=0;(function w(){if(window.L&&window.L.map)res(window.L);else if(n++>100){leafletP=null;rej(new Error("map"))}else setTimeout(w,50)})()};
    document.head.appendChild(s);
  });
  return leafletP;
}
function setBase(b){
  mapBase=b==="sat"?"sat":"map";try{localStorage.setItem("rigora_map",mapBase)}catch(e){}
  document.querySelectorAll("[data-base]").forEach(x=>x.setAttribute("aria-checked",String(x.dataset.base===mapBase)));
  if(LMAP){Object.values(LBASE).forEach(l=>LMAP.removeLayer(l));LBASE[mapBase].addTo(LMAP)}
}
document.querySelectorAll("[data-base]").forEach(x=>x.addEventListener("click",()=>setBase(x.dataset.base)));
setBase(mapBase);
async function drawMap(coords,tolls,sc,pts,sm){
  let L;
  try{L=await loadLeaflet()}catch(e){$("mapBox").innerHTML=`<p class="note" style="padding:16px">${T("map_err")}</p>`;return}
  if(!last||last.coords!==coords)return; // a newer route is already on its way
  if(!LMAP){
    LMAP=L.map("lmap",{scrollWheelZoom:false,zoomSnap:0.5,attributionControl:true});
    LBASE.map=L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'});
    LBASE.sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Imagery &copy; Esri"});
    LMAP.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    LBASE[mapBase].addTo(LMAP);LLAY=L.layerGroup().addTo(LMAP);
    LMAP.on("focus",()=>LMAP.scrollWheelZoom.enable());LMAP.on("blur",()=>LMAP.scrollWheelZoom.disable());
  }
  LMAP.invalidateSize();LLAY.clearLayers();
  const ll=c=>[c[1],c[0]];
  const thin=cs=>{const st=Math.max(1,Math.floor(cs.length/2000)),o=[];for(let i=0;i<cs.length;i+=st)o.push(ll(cs[i]));o.push(ll(cs[cs.length-1]));return o};
  const icon=(html,cls,size)=>L.divIcon({html,className:"mk "+cls,iconSize:[size,size],iconAnchor:[size/2,size/2]});
  const ALTS=(last&&last.alts)||[];
  ALTS.forEach((a,i)=>{if(i===last.altIdx)return;const line=thin(a.coords);
    L.polyline(line,{color:MC.alt,weight:5,opacity:.85,dashArray:"8 8",interactive:false}).addTo(LLAY);
    L.polyline(line,{color:"#000",weight:22,opacity:0.001}).on("click",()=>pickAlt(i)).bindTooltip(i===0?T("alt_fast"):T("alt_n",{n:i+1}),{sticky:true}).addTo(LLAY)});
  const main=thin(coords);
  L.polyline(main,{color:MC.casing,weight:9,opacity:.9,interactive:false}).addTo(LLAY);
  L.polyline(main,{color:MC.route,weight:5,opacity:1,interactive:false}).addTo(LLAY);
  tolls.forEach(t=>L.polyline(coords.slice(t.a,t.b+1).map(ll),{color:MC.toll,weight:6,opacity:.95}).bindTooltip(T("toll_pill")+" · "+num(t.mi,1)+" "+T("mi"),{sticky:true}).addTo(LLAY));
  sm.bounds.forEach(b=>L.marker(ll(coords[b.i]),{icon:icon(esc(b.to),"mk-st",26),keyboard:false}).bindTooltip(stName(b.from)+" → "+stName(b.to)).addTo(LLAY));
  sc.forEach(x=>{const nm=(x.f.properties.poi||{}).name||"";
    L.marker(ll(x.f.geometry.coordinates),{icon:icon("",x.kind==="cert"?"mk-cert":"mk-weigh",12),keyboard:false}).bindTooltip(esc(nm)).addTo(LLAY)});
  (((last&&last.wx)||{}).samples||[]).forEach(s=>{if(!s.sev)return;
    L.circleMarker(ll(s.pt),{radius:11,color:s.sev>=2?MC.bad:MC.warn,weight:3,dashArray:"3 3",fill:false}).bindTooltip(esc(s.reasons.join(", "))+" · "+T("at_mi",{n:num(s.mile)})).addTo(LLAY)});
  ((last&&last.traffic)||[]).forEach(x=>{const big=SEV_RANK[x.magnitudeOfDelay]>=3||x.category==="accident"||x.category==="road-closed";
    L.marker(ll(x.pt),{icon:icon("",big?"mk-tr":"mk-tr mk-tr-warn",16),keyboard:false}).bindTooltip(esc(catLabel(x.category))+" · "+T("at_mi",{n:num(x.mi)})).addTo(LLAY)});
  pts.forEach((p,i)=>L.marker(ll(p),{icon:icon(i===0?"A":String(i+1),i===0?"mk-stop mk-a":(i===pts.length-1?"mk-stop mk-z":"mk-stop"),26),zIndexOffset:1000}).bindTooltip(esc((last.labels||[])[i]||"")).addTo(LLAY));
  if(ALTS.length>1)ALTS.forEach((a,i)=>{const c=a.coords[idxAt(a.dist,a.dist[a.dist.length-1]*(0.35+0.2*i))];
    L.marker(ll(c),{icon:L.divIcon({html:T("map_route",{n:i+1}),className:"mk "+(i===last.altIdx?"mk-alt on":"mk-alt"),iconSize:null,iconAnchor:[30,12]}),zIndexOffset:900,title:i===0?T("alt_fast"):T("alt_n",{n:i+1})}).on("click",()=>pickAlt(i)).addTo(LLAY)});
  // fit only when the trip changes, so live traffic and weather updates keep the person's zoom
  const key=pts.map(p=>p.join(",")).join("|")+"#"+ALTS.length;
  if(key!==LFIT){LFIT=key;let b=L.latLngBounds(main);ALTS.forEach(a=>b.extend(L.latLngBounds(thin(a.coords))));LMAP.fitBounds(b,{padding:[28,28]})}
}
'''
i = pjs.index("function drawMap(coords,tolls,sc,pts,sm){")
j = pjs.index("// ---------- live traffic ----------")
pjs = pjs[:i] + newmap + "\n" + pjs[j:]

fold = r'''
// ---------- folding cards (Schedule, Weather) ----------
function setFold(id,open,scroll){
  const card=$(id),btn=card.querySelector(".fold-btn"),body=$(btn.getAttribute("aria-controls")),t=btn.querySelector(".fold-t");
  body.hidden=!open;btn.setAttribute("aria-expanded",String(open));t.dataset.pi18n=open?"fold_hide":"fold_show";t.textContent=T(t.dataset.pi18n);
  if(open&&scroll)card.scrollIntoView({block:"start",behavior:"smooth"});
}
document.querySelectorAll(".fold-btn").forEach(b=>b.addEventListener("click",()=>setFold(b.closest("section").id,b.getAttribute("aria-expanded")!=="true")));
'''
pjs = rep(pjs, "\n// ---------- schedule / HOS ----------", fold + "\n// ---------- schedule / HOS ----------")

# ---------- copy ----------
newtxt["en"].update(map_route="Route {n}", sketch_h="Route map", mt_map="Map", mt_sat="Satellite", fold_show="Show", fold_hide="Hide",
  map_err="The map couldn't load. Check your connection and plan the route again.",
  alt_note="Tap a route on the map or a card here to switch. Fuel for other options is estimated from distance; the picked route gets the full breakdown, weather and traffic.")
newtxt["ru"].update(map_route="Маршрут {n}", sketch_h="Карта маршрута", mt_map="Карта", mt_sat="Спутник", fold_show="Показать", fold_hide="Скрыть",
  map_err="Карта не загрузилась. Проверьте интернет и постройте маршрут ещё раз.",
  alt_note="Нажмите на маршрут на карте или на карточку здесь, чтобы переключиться. Топливо для других вариантов — оценка по расстоянию; для выбранного считаются полный расчёт, погода и пробки.")
newtxt["es"].update(map_route="Ruta {n}", sketch_h="Mapa de la ruta", mt_map="Mapa", mt_sat="Satélite", fold_show="Mostrar", fold_hide="Ocultar",
  map_err="El mapa no se pudo cargar. Revisa tu conexión y vuelve a planear la ruta.",
  alt_note="Toca una ruta en el mapa o una tarjeta aquí para cambiar. El combustible de otras opciones se estima por distancia; la ruta elegida recibe el cálculo completo, clima y tráfico.")

css = rep(css, "#v-plan .mapbox svg{display:block;width:100%;height:auto}", "")
css += r'''
[hidden]{display:none!important}
/* route map */
#lmap{height:440px;width:100%;border-radius:12px;z-index:0;background:#e9e9e6}
@media (max-width:640px){#lmap{height:340px}}
.mapbox{border-radius:12px;overflow:hidden}
#lmap .leaflet-control-attribution{font-size:10px}
.leaflet-marker-icon.mk{display:flex;align-items:center;justify-content:center;font:700 12px/1 "Geist Mono",ui-monospace,monospace;box-sizing:border-box}
.mk-stop{background:#4a4a48;color:#fff;border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.mk-a{background:#111;color:#fff}.mk-z{background:#ff6a1a;color:#111}
.mk-alt{height:24px;background:#fff;color:#111;border:2px solid #6b7280;border-radius:7px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap;padding:0 7px;width:auto!important;font-size:11px}
.mk-alt.on{background:#ff6a1a;border-color:#111;color:#111}
.mk-st{background:rgba(255,255,255,.92);color:#4a4a48;border:1.5px solid #111;border-radius:6px;font-size:10px}
.mk-cert{background:#17803f;border:2px solid #fff;border-radius:50%}
.mk-weigh{background:#c62a1f;border:2px solid #fff}
.mk-tr{background:#c62a1f;clip-path:polygon(50% 0,100% 100%,0 100%)}
.mk-tr-warn{background:#b45a00}
#mapCard .alts{margin-top:14px}
#mapCard .maplinks{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
/* folding cards */
.fold-btn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;cursor:pointer}
.fold-btn h2{margin:0;flex:1}
.fold-btn .fold-t{font-size:13px;font-weight:600;color:var(--muted)}
.fold-btn .chev{transition:transform .15s}
.fold-btn[aria-expanded="true"] .chev{transform:rotate(180deg)}
.fold-btn:focus-visible{outline:2px solid var(--ink);outline-offset:4px;border-radius:6px}
#wxCard .card-head,#schedCard .card-head{margin-bottom:10px}
#wxBody>.seg{margin-bottom:12px}
#fullBtn{margin:4px 0 0}
'''
