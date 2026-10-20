# Theme picker next to the language switch: Light / Dark / Night (warm, low blue light).
# exec'd from build_site.py; adds THEME_HEAD (in <head>, runs before paint), THEME_BTN (header), THEME_JS, and CSS.

css += r'''
/* night: warm, dim, low blue light */
:root[data-theme="night"]{
  --bg:#17110a; --surface:#211910; --ink:#f2d7a6; --muted:#b39169; --line:#3a2d1c;
  --sign:#f2d7a6; --sign-ink:#17110a; --amber:#ff8a3d; --amber-ink:#1a0d02; --stripe:#ff8a3d;
  --good:#b5c76a; --warn:#f0a040; --bad:#ff7d5e; --info:#c9ab82; --route:#f2d7a6; --toll:#ff8a3d; --scale:#ff7d5e; --stop:#6b5638; color-scheme:dark}
:root[data-theme="night"] img,:root[data-theme="night"] #lmap .leaflet-pane{filter:sepia(.55) saturate(.85) brightness(.8)}
/* theme picker */
.theme{position:relative}
.theme-btn{display:flex;align-items:center;gap:6px;background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:5px 10px;font:600 12px var(--mono);cursor:pointer;min-height:30px}
.theme-btn:focus-visible,.theme-menu button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.theme-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:1000;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:6px;min-width:190px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:grid;gap:2px}
.theme-menu button{display:flex;align-items:center;gap:10px;width:100%;background:transparent;color:var(--ink);border:0;border-radius:8px;padding:9px 10px;font:500 14px var(--body);text-align:left;cursor:pointer}
.theme-menu button:hover{background:var(--bg)}
.theme-menu button[aria-checked="true"]{background:var(--bg);font-weight:700}
.theme-menu button[aria-checked="true"]::after{content:"✓";margin-left:auto}
.theme-menu .sw{width:18px;height:18px;border-radius:50%;border:1px solid var(--line);flex:none}
.sw-light{background:#fff}.sw-dark{background:#111}.sw-night{background:linear-gradient(135deg,#211910 50%,#ff8a3d 50%)}
'''

THEME_HEAD = r'''<script>
(function(){var t=null;try{t=localStorage.getItem("rigora_theme")}catch(e){}
if(t!=="light"&&t!=="dark"&&t!=="night")t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
document.documentElement.setAttribute("data-theme",t)})();
</script>'''

THEME_BTN = '''<div class="theme"><button type="button" class="theme-btn" id="themeBtn" aria-haspopup="true" aria-expanded="false" aria-controls="themeMenu"><span aria-hidden="true" id="themeIco">◐</span><span id="themeTxt">Theme</span></button>
    <div class="theme-menu" id="themeMenu" role="radiogroup" hidden>
      <button type="button" role="radio" data-theme-set="light" aria-checked="false"><span class="sw sw-light"></span><span data-tl="light">Light</span></button>
      <button type="button" role="radio" data-theme-set="dark" aria-checked="false"><span class="sw sw-dark"></span><span data-tl="dark">Dark</span></button>
      <button type="button" role="radio" data-theme-set="night" aria-checked="false"><span class="sw sw-night"></span><span data-tl="night">Night</span></button>
    </div></div>'''

THEME_JS = r'''
(function(){
  const L={en:{theme:"Theme",light:"Light",dark:"Dark",night:"Night · warm"},
           ru:{theme:"Тема",light:"Светлая",dark:"Тёмная",night:"Ночная · тёплая"},
           es:{theme:"Tema",light:"Clara",dark:"Oscura",night:"Noche · cálida"}};
  const ICO={light:"☀",dark:"☾",night:"◐"};
  const root=document.documentElement,btn=document.getElementById("themeBtn"),menu=document.getElementById("themeMenu");
  let saved=null;try{saved=localStorage.getItem("rigora_theme")}catch(e){}
  const lang=()=>{const l=(root.lang||"en").slice(0,2);return L[l]?l:"en"};
  function paint(){
    const t=root.getAttribute("data-theme")||"light",d=L[lang()];
    document.getElementById("themeTxt").textContent=d.theme;document.getElementById("themeIco").textContent=ICO[t]||"◐";
    btn.setAttribute("aria-label",d.theme+": "+d[t]);
    menu.querySelectorAll("[data-tl]").forEach(s=>s.textContent=d[s.dataset.tl]);
    menu.querySelectorAll("[data-theme-set]").forEach(b=>b.setAttribute("aria-checked",String(b.dataset.themeSet===t)));
    const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=getComputedStyle(root).getPropertyValue("--surface").trim()||"#ffffff";
  }
  function set(t){root.setAttribute("data-theme",t);saved=t;try{localStorage.setItem("rigora_theme",t)}catch(e){}paint()}
  function open(o){menu.hidden=!o;btn.setAttribute("aria-expanded",String(o));if(o)(menu.querySelector('[aria-checked="true"]')||menu.querySelector("button")).focus()}
  btn.addEventListener("click",e=>{e.stopPropagation();open(menu.hidden)});
  menu.addEventListener("click",e=>{const b=e.target.closest("[data-theme-set]");if(!b)return;set(b.dataset.themeSet);open(false);btn.focus()});
  document.addEventListener("click",e=>{if(!menu.hidden&&!e.target.closest(".theme"))open(false)});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!menu.hidden){open(false);btn.focus()}});
  // follow the phone's light/dark setting until the person picks a theme here
  try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",e=>{if(!saved){root.setAttribute("data-theme",e.matches?"dark":"light");paint()}})}catch(e){}
  new MutationObserver(paint).observe(root,{attributes:true,attributeFilter:["lang"]});
  paint();
})();
'''
