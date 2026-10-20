# exec'd by build_site.py after map_patch / theme_patch.
# 1) money: your cost per mile, pay per mile / per cube, truck rental, profit or loss
# 2) My location: fresh GPS fix that replaces start A (New York stays the default), clear errors

pmain = rep(pmain, '<div class="f"><label class="lbl" for="mpg">MPG</label><input id="mpg" type="number" step="0.1" min="2" max="25" value="6.5" inputmode="decimal"></div>\n        </div>',
  '<div class="f"><label class="lbl" for="mpg">MPG</label><input id="mpg" type="number" step="0.1" min="2" max="25" value="6.5" inputmode="decimal"></div>\n        </div>\n'
  '        <div class="f"><label class="lbl" for="perMile" data-pi18n="per_mile">Your cost per mile, $</label><input id="perMile" type="number" step="0.01" min="0" max="20" placeholder="0.00" inputmode="decimal"><span class="note" data-pi18n="per_mile_note">Driver pay, truck payment, insurance — anything you pay per mile. It is added to the trip total on top of fuel and tolls.</span></div>')

pmain = rep(pmain, '<input id="priceAdj" type="number" step="0.01" value="0.00" inputmode="decimal"></div>\n        </div>',
  '<input id="priceAdj" type="number" step="0.01" value="0.00" inputmode="decimal"></div>\n        </div>\n'
  '        <p class="money-h" data-pi18n="money_h">Pay and truck rental</p>\n'
  '        <div class="grid2">\n'
  '          <div class="f"><label class="lbl" for="payMile" data-pi18n="pay_mile">You get per mile, $</label><input id="payMile" type="number" step="0.01" min="0" placeholder="0.00" inputmode="decimal"></div>\n'
  '          <div class="f"><label class="lbl" for="rental" data-pi18n="rental">Truck rental for the trip, $</label><input id="rental" type="number" step="1" min="0" placeholder="0" inputmode="decimal"></div>\n'
  '          <div class="f"><label class="lbl" for="payCube" data-pi18n="pay_cube">You get per cubic foot, $</label><input id="payCube" type="number" step="0.01" min="0" placeholder="0.00" inputmode="decimal"></div>\n'
  '          <div class="f"><label class="lbl" for="cubes" data-pi18n="cubes">Cubic feet on the truck</label><input id="cubes" type="number" step="50" min="0" placeholder="0" inputmode="numeric"></div>\n'
  '        </div>\n'
  '        <p class="note" data-pi18n="money_note">Fill in what you\'re paid by the mile, by the cube, or both. The trip estimate then shows income minus fuel, tolls, your per-mile cost and the truck rental.</p>')

pmain = rep(pmain, '<span class="lbl" data-pi18n="fuel_tolls">Fuel + tolls</span>', '<span class="lbl" id="grandLbl">Fuel + tolls</span>')

pmain = rep(pmain, '<div><span data-pi18n="cpm">Cost per mile</span><b id="cpm">$0.00</b></div>\n              </div>',
  '<div id="pmRow" hidden><span id="pmLbl">Per mile</span><b id="pmCost">$0</b></div>\n'
  '                <div id="rentRow" hidden><span data-pi18n="rent_lbl">Truck rental</span><b id="rentCost">$0</b></div>\n'
  '                <div><span data-pi18n="cpm">Cost per mile</span><b id="cpm">$0.00</b></div>\n'
  '              </div>\n'
  '              <div class="pl" id="plBox" hidden>\n'
  '                <span class="lbl" id="plLbl">Profit</span>\n'
  '                <span class="pl-big" id="plVal">$0</span>\n'
  '                <div id="incMileRow"><span id="incMileLbl">Pay by mile</span><b id="incMile">$0</b></div>\n'
  '                <div id="incCubeRow"><span id="incCubeLbl">Pay by cube</span><b id="incCube">$0</b></div>\n'
  '                <div><span data-pi18n="inc_total">Income</span><b id="incTotal">$0</b></div>\n'
  '                <div><span data-pi18n="exp_total">Expenses</span><b id="expTotal">$0</b></div>\n'
  '                <div><span data-pi18n="net_mile">Net per mile</span><b id="netMile">$0.00</b></div>\n'
  '              </div>')

pjs = rep(pjs, '''  $("grand").textContent=usd(fuel+tollCost);
  $("fuelCost").textContent=usd(fuel);$("tollCost").textContent=tollMi?usd(tollCost):"$0";
  $("cpm").textContent=usd(totalMi?(fuel+tollCost)/totalMi:0,2);''', '''  const pmRate=Math.max(0,parseFloat($("perMile").value)||0),pmCost=pmRate*totalMi;
  const rent=Math.max(0,parseFloat($("rental").value)||0),grandAll=fuel+tollCost+pmCost+rent;
  $("grand").textContent=usd(grandAll);$("grandLbl").textContent=(pmRate||rent)?T("grand_all"):T("fuel_tolls");
  $("pmRow").hidden=!pmRate;$("pmLbl").textContent=T("pm_lbl",{m:num(totalMi),r:usd(pmRate,2)});$("pmCost").textContent=usd(pmCost);
  $("rentRow").hidden=!rent;$("rentCost").textContent=usd(rent);
  $("fuelCost").textContent=usd(fuel);$("tollCost").textContent=tollMi?usd(tollCost):"$0";
  $("cpm").textContent=usd(totalMi?grandAll/totalMi:0,2);
  const payM=Math.max(0,parseFloat($("payMile").value)||0),payC=Math.max(0,parseFloat($("payCube").value)||0),cu=Math.max(0,parseFloat($("cubes").value)||0);
  const incM=payM*totalMi,incC=payC*cu,inc=incM+incC,profit=inc-grandAll;
  $("plBox").hidden=!(inc>0);
  if(inc>0){$("plBox").className="pl "+(profit>=0?"plus":"minus");$("plLbl").textContent=profit>=0?T("pl_plus"):T("pl_minus");
    $("plVal").textContent=(profit<0?"−":"+")+usd(Math.abs(profit));
    $("incMileRow").hidden=!incM;$("incMileLbl").textContent=T("inc_mile",{m:num(totalMi),r:usd(payM,2)});$("incMile").textContent=usd(incM);
    $("incCubeRow").hidden=!incC;$("incCubeLbl").textContent=T("inc_cube",{c:num(cu),r:usd(payC,2)});$("incCube").textContent=usd(incC);
    $("incTotal").textContent=usd(inc);$("expTotal").textContent=usd(grandAll);
    $("netMile").textContent=(profit<0?"−":"")+usd(totalMi?Math.abs(profit)/totalMi:0,2);}''')

pjs = rep(pjs, '["mpg","tank","tollRate","priceAdj"].forEach(id=>$(id).addEventListener("input",render));',
  '''["mpg","tank","tollRate","priceAdj"].forEach(id=>$(id).addEventListener("input",render));
// money inputs: remembered on this device
["perMile","payMile","payCube","cubes","rental"].forEach(id=>{try{const v=localStorage.getItem("rigora_"+id);if(v)$(id).value=v}catch(e){}
  $(id).addEventListener("input",()=>{try{localStorage.setItem("rigora_"+id,$(id).value)}catch(e){}render()})});''')

# ---------- My location ----------
pmain = rep(pmain, '<button class="btn" id="reverse" type="button" data-pi18n="reverse">⇅ Reverse</button>\n        </div>',
  '<button class="btn" id="reverse" type="button" data-pi18n="reverse">⇅ Reverse</button>\n'
  '          <button class="btn" id="useMe" type="button" data-pi18n="my_loc_start">📍 Start from my location</button>\n'
  '        </div>\n'
  '        <p class="locmsg" id="locMsg" aria-live="polite"></p>')

_i0 = pjs.index("function useGps(){")
_i1 = pjs.index("useGps(); // asks the browser")
_i1 = pjs.index("\n", _i1) + 1
pjs = pjs[:_i0] + r'''let startIsDefault=true,gpsBusy=false;
function locMsg(t,cls){const m=$("locMsg");m.textContent=t||"";m.className="locmsg "+(cls||"")}
function getFix(){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation){rej({code:"nosupport",msg:"no navigator.geolocation"});return}
    let best=null,done=false,wid=null,t1=null,t2=null;
    const finish=(ok,v)=>{if(done)return;done=true;if(wid!=null)navigator.geolocation.clearWatch(wid);clearTimeout(t1);clearTimeout(t2);ok?res(v):rej(v)};
    // maximumAge 0: never reuse an old cached position, always ask the phone where it is now
    const opts={enableHighAccuracy:true,maximumAge:0,timeout:20000};
    const onPos=p=>{if(!best||p.coords.accuracy<best.coords.accuracy)best=p;if(p.coords.accuracy<=150)finish(true,best)};
    const onErr=e=>{if(best){finish(true,best);return}
      finish(false,{code:e.code===1?"denied":e.code===3?"timeout":"unavail",msg:"code "+e.code+(e.message?" · "+e.message:"")})};
    try{wid=navigator.geolocation.watchPosition(onPos,onErr,opts)}catch(e){finish(false,{code:"nosupport",msg:String(e)});return}
    t2=setTimeout(()=>{if(best)finish(true,best)},6000);
    t1=setTimeout(()=>best?finish(true,best):finish(false,{code:"timeout",msg:"no fix in 20 s"}),20000);
  });
}
async function placeName(lat,lon){
  try{const r=await fetch(`/api/reverse?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`);const j=await r.json();
    const a=j&&j.address;if(a)return a.freeformAddress||[a.municipality,a.countrySubdivision].filter(Boolean).join(", ")||null}catch(e){}
  return null;
}
async function useGps(quiet){
  if(gpsBusy)return;gpsBusy=true;
  ["useMe","hereGps"].forEach(id=>$(id).setAttribute("aria-busy","true"));
  if(!quiet)locMsg(T("loc_getting"));
  try{
    const p=await getFix(),lat=p.coords.latitude,lon=p.coords.longitude;
    const name=(await placeName(lat,lon))||(lat.toFixed(4)+", "+lon.toFixed(4));
    hideExample();startIsDefault=false;
    stops[0]={q:name,pos:[lon,lat],label:T("gps_here")+" · "+name};
    renderStops();setRes(0,"✓ "+stops[0].label,"ok");
    $("hereLoc").value=name;gpsNote("gps_ok");loadHere(lat.toFixed(4)+","+lon.toFixed(4));
    locMsg(T("loc_ok",{l:name})+" (±"+Math.round(p.coords.accuracy)+" m)","ok");
    if(last)plan();
  }catch(e){
    if(!quiet){
      locMsg(T("loc_"+((e&&e.code)||"unavail")),"err");gpsNote("gps_no");
      let perm="?";try{const st=await navigator.permissions?.query?.({name:"geolocation"});if(st)perm=st.state}catch(x){}
      const d=document.createElement("span");d.className="locdiag";
      d.textContent=T("loc_diag",{d:[(e&&e.msg)||(e&&e.code)||"?","permission: "+perm,"https: "+window.isSecureContext].join(" · ")});
      $("locMsg").appendChild(d);
    }
  }finally{gpsBusy=false;["useMe","hereGps"].forEach(id=>$(id).removeAttribute("aria-busy"))}
}
$("hereGps").addEventListener("click",()=>useGps(false));
$("useMe").addEventListener("click",()=>useGps(false));
// no prompt on load: New York stays until the person presses My location; if location is already allowed, use it right away
(async()=>{try{const st=await navigator.permissions?.query?.({name:"geolocation"});if(st&&st.state==="granted"&&startIsDefault)useGps(true)}catch(e){}})();
''' + pjs[_i1:]

pjs = rep(pjs, 'const LOCALES={en:"en-US"', '''Object.assign(I18N.en,{money_h:"Pay and truck rental",pay_mile:"You get per mile, $",pay_cube:"You get per cubic foot, $",cubes:"Cubic feet on the truck",rental:"Truck rental for the trip, $",money_note:"Fill in what you're paid by the mile, by the cube, or both. The trip estimate then shows income minus fuel, tolls, your per-mile cost and the truck rental.",rent_lbl:"Truck rental",pl_plus:"You're in profit",pl_minus:"You're at a loss",inc_mile:"Pay by mile ({m} mi × {r})",inc_cube:"Pay by cube ({c} cu ft × {r})",inc_total:"Income",exp_total:"Expenses",net_mile:"Net per mile",
per_mile:"Your cost per mile, $",per_mile_note:"Driver pay, truck payment, insurance — anything you pay per mile. It is added to the trip total on top of fuel and tolls.",pm_lbl:"Per mile ({m} mi × {r})",grand_all:"Trip total",
my_loc_start:"📍 Start from my location",loc_getting:"Getting your location…",loc_ok:"Start set to your location: {l}",
loc_denied:"Location is blocked. iPhone: Settings → Privacy & Security → Location Services must be on, and Safari Websites (or Opera) set to While Using. Then allow location for rigora.org in the browser and press the button again.",
loc_unavail:"The phone couldn't get a GPS fix. Check that Location Services is on and try again.",loc_timeout:"Location took too long. Try again, ideally near a window or outside.",loc_nosupport:"This browser doesn't support location. Type your start address.",loc_diag:"Details: {d}"});
Object.assign(I18N.ru,{money_h:"Оплата и аренда трака",pay_mile:"Вы получаете за милю, $",pay_cube:"Вы получаете за куб (cu ft), $",cubes:"Кубов в траке (cu ft)",rental:"Аренда трака за рейс, $",money_note:"Впишите, сколько вам платят за милю, за кубы или и то и другое. В расчёте рейса появится доход минус топливо, платные дороги, ваша стоимость за милю и аренда трака.",rent_lbl:"Аренда трака",pl_plus:"Вы в плюсе",pl_minus:"Вы в минусе",inc_mile:"За мили ({m} ми × {r})",inc_cube:"За кубы ({c} cu ft × {r})",inc_total:"Доход",exp_total:"Расходы",net_mile:"Чистыми за милю",
per_mile:"Ваша стоимость за милю, $",per_mile_note:"Оплата водителя, платёж за трак, страховка — всё, что вы платите за милю. Добавляется к итогу рейса поверх топлива и платных дорог.",pm_lbl:"За мили ({m} ми × {r})",grand_all:"Итого за рейс",
my_loc_start:"📍 Старт от моего местоположения",loc_getting:"Определяю ваше местоположение…",loc_ok:"Старт — ваше местоположение: {l}",
loc_denied:"Геолокация заблокирована. На iPhone: Настройки → Конфиденциальность и безопасность → Службы геолокации должны быть включены, а у «Сайты Safari» (или Opera) — «При использовании». Потом разрешите геолокацию для rigora.org в браузере и нажмите кнопку ещё раз.",
loc_unavail:"Телефон не смог поймать GPS. Проверьте, что службы геолокации включены, и попробуйте ещё раз.",loc_timeout:"Геолокация отвечает слишком долго. Попробуйте ещё раз, лучше у окна или на улице.",loc_nosupport:"Этот браузер не поддерживает геолокацию. Впишите адрес старта.",loc_diag:"Подробности: {d}"});
Object.assign(I18N.es,{money_h:"Pago y renta del camión",pay_mile:"Te pagan por milla, $",pay_cube:"Te pagan por pie cúbico, $",cubes:"Pies cúbicos en el camión",rental:"Renta del camión por viaje, $",money_note:"Escribe cuánto te pagan por milla, por pie cúbico o ambos. El estimado mostrará el ingreso menos combustible, peajes, tu costo por milla y la renta.",rent_lbl:"Renta del camión",pl_plus:"Vas ganando",pl_minus:"Vas perdiendo",inc_mile:"Por milla ({m} mi × {r})",inc_cube:"Por pie cúbico ({c} × {r})",inc_total:"Ingreso",exp_total:"Gastos",net_mile:"Neto por milla",
per_mile:"Tu costo por milla, $",per_mile_note:"Pago del chofer, pago del camión, seguro: todo lo que pagas por milla. Se suma al total del viaje además del combustible y los peajes.",pm_lbl:"Por milla ({m} mi × {r})",grand_all:"Total del viaje",
my_loc_start:"📍 Salir desde mi ubicación",loc_getting:"Obteniendo tu ubicación…",loc_ok:"Salida fijada en tu ubicación: {l}",
loc_denied:"La ubicación está bloqueada. iPhone: Ajustes → Privacidad y seguridad → Localización debe estar activada, y Sitios web de Safari (u Opera) en Al usar la app. Luego permite la ubicación para rigora.org en el navegador y vuelve a pulsar el botón.",
loc_unavail:"El teléfono no pudo obtener el GPS. Revisa que la localización esté activada y vuelve a intentar.",loc_timeout:"La ubicación tardó demasiado. Vuelve a intentar, mejor cerca de una ventana o afuera.",loc_nosupport:"Este navegador no permite la ubicación. Escribe tu dirección de salida.",loc_diag:"Detalles: {d}"});
const LOCALES={en:"en-US"''')
