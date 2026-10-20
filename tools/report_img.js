// ---------- company report as a picture (JPG) or PDF, drawn on a canvas, no libraries ----------
async function reportCanvas(dot){
  const d=String(dot||"").replace(/\D/g,""),v=verdict(d),c=v.c;if(!c)return null;
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready}catch(e){}
  const S=2,W=1200,P=48,CW=W-2*P;
  const SANS='"Geist","Helvetica Neue",Arial,sans-serif',MONO='"Geist Mono",ui-monospace,Menlo,Consolas,monospace';
  const F=(w,s,m)=>w+" "+s+"px "+(m?MONO:SANS);
  const C={ink:"#111111",muted:"#6b6b69",line:"#e4e4e1",bg:"#f5f5f4",card:"#ffffff",good:"#17803f",warn:"#b45a00",bad:"#c62a1f",info:"#555553",orange:"#ff6a1a",
    goodBg:"#e9f5ee",warnBg:"#fcf1e4",badBg:"#fcebe9",mutBg:"#efefed"};
  const TONE={ok:[C.good,C.goodBg],bad:[C.bad,C.badBg],warn:[C.warn,C.warnBg],mut:[C.muted,C.mutBg],info:[C.info,C.mutBg]};
  const dt=s=>{if(!s)return "—";const t=new Date(String(s).length===10?s+"T12:00:00":s);return isNaN(t)?String(s):t.toLocaleDateString(LOC(),{month:"short",day:"numeric",year:"numeric"})};
  const mk=h=>{const cv=document.createElement("canvas");cv.width=W*S;cv.height=h*S;const g=cv.getContext("2d");g.scale(S,S);return [cv,g]};
  const [big,main]=mk(3200),[scr,scratch]=mk(1200); // stay under phone canvas size limits
  let x=main;
  const path=(X,Y,w,h,r)=>{x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath()};
  const box=(X,Y,w,h,r,fill,stroke,lw)=>{path(X,Y,w,h,r);if(fill){x.fillStyle=fill;x.fill()}if(stroke){x.strokeStyle=stroke;x.lineWidth=lw||1;x.stroke()}};
  const text=(t,X,Y,font,color,align)=>{x.font=font;x.fillStyle=color;x.textAlign=align||"left";x.textBaseline="alphabetic";x.fillText(String(t),X,Y);x.textAlign="left"};
  const tw=(t,font)=>{x.font=font;return x.measureText(String(t)).width};
  const wrap=(t,maxW,font)=>{x.font=font;const out=[];String(t??"").split("\n").forEach(par=>{let line="";par.split(/\s+/).filter(Boolean).forEach(w=>{const tt=line?line+" "+w:w;
    if(x.measureText(tt).width>maxW&&line){out.push(line);line=w}else line=tt});out.push(line)});return out.length?out:[""]};
  const pill=(t,tone,Xr,Y)=>{const f=F(700,12,true),w=Math.ceil(tw(t,f))+20,[fg,bg]=TONE[tone]||TONE.mut;box(Xr-w,Y,w,24,12,bg);text(t,Xr-w/2,Y+16.5,f,fg,"center");return w};

  // ---- header band
  box(0,0,W,88,0,"#111111");
  box(P,24,40,40,9,C.orange);box(P+10,37,20,6,3,"#111111");box(P+10,47,14,6,3,"#111111");
  text("Rigora",P+54,55,F(800,26),"#ffffff");
  text(T("check_h").toUpperCase(),W-P,44,F(700,12,true),"#bdbdb8","right");
  text("rigora.org",W-P,64,F(500,13,true),C.orange,"right");
  let y=88+40;

  // ---- name, chips | verdict
  const vW=300,leftW=CW-vW-28;
  const nameL=wrap(c.legal_name,leftW,F(800,32));
  nameL.forEach((l,i)=>text(l,P,y+28+i*38,F(800,32),C.ink));
  let ly=y+28+(nameL.length-1)*38+10;
  if(c.dba&&c.dba!==c.legal_name){ly+=22;text("DBA "+c.dba,P,ly,F(500,15),C.muted)}
  ly+=18;let cx=P;
  ["USDOT "+c.dot,...(c.dockets||[]),c.entity||""].filter(Boolean).forEach(ch=>{const f=F(600,13,true),w=Math.ceil(tw(ch,f))+20;
    if(cx+w>P+leftW){cx=P;ly+=34}box(cx,ly,w,28,6,C.bg,C.line);text(ch,cx+10,ly+19,f,C.ink);cx+=w+8});
  ly+=28;
  const lv=v.lvl,[vfg,vbg]=TONE[lv==="ok"?"ok":lv==="bad"?"bad":lv==="warn"?"warn":"mut"];
  const bad=v.flags.filter(f=>f.l==="bad").length,warn=v.flags.filter(f=>f.l==="warn").length;
  const sum=lv==="ok"?T("rp_sum_ok"):lv==="bad"?T("rp_sum_bad",{n:bad}):T("rp_sum_n",{n:warn});
  const sumL=wrap(sum,vW-36,F(500,15));
  const vH=24+18+34+sumL.length*21+18,vX=W-P-vW;
  box(vX,y,vW,vH,14,vbg,vfg,2);
  text(T("rp_verdict").toUpperCase(),vX+18,y+30,F(700,12,true),vfg);
  text(T("v_"+lv),vX+18,y+66,F(800,28),vfg);
  sumL.forEach((l,i)=>text(l,vX+18,y+94+i*21,F(500,15),C.ink));
  y=Math.max(ly,y+vH)+28;

  // ---- flags
  const fl=v.flags.filter(f=>f.l!=="ok");
  if(fl.length){
    const lines=fl.map(f=>({f,L:wrap(f.t,CW-60,F(500,15))}));
    const h=24+lines.reduce((s,o)=>s+o.L.length*21+10,0)+4;
    box(P,y,CW,h,12,C.bg,C.line);let fy=y+22;
    lines.forEach(({f,L})=>{const col=(TONE[f.l]||TONE.info)[0];x.beginPath();x.arc(P+26,fy+9,5,0,Math.PI*2);x.fillStyle=col;x.fill();
      L.forEach((l,i)=>text(l,P+42,fy+15+i*21,F(f.l==="bad"?700:500,15),f.l==="bad"?C.bad:C.ink));fy+=L.length*21+10});
    y+=h+24;
  }

  // ---- sections
  const auth=c.auth||[],act=auth.filter(AUTH_ACTIVE),cr=c.crashes||{},ins=c.insp||{};
  const bReq=Math.max(0,...act.map(a=>a.bipd_req||0)),bFile=Math.max(0,...act.map(a=>a.bipd_file||0));
  const cReq=act.some(a=>a.cargo_req),cFile=act.some(a=>a.cargo_file),dReq=act.some(a=>a.bond_req),dFile=act.some(a=>a.bond_file);
  const insRow=(l,req,ok,fileTxt)=>req?{t:"row",l,sub:T("rp_req")+": "+req,v:ok?(fileTxt||T("rp_file")):T("rp_missing"),tone:ok?"ok":"bad"}:{t:"row",l,sub:T("rp_notreq"),v:fileTxt||"—",tone:"mut"};
  const secs=[
    {h:T("rp_auth_h"),items:[...(auth.length?auth.map(a=>({t:"row",l:a.type,sub:(a.docket||"")+(c.auth_since&&AUTH_ACTIVE(a)?" · "+T("rp_since",{d:dt(c.auth_since)}):""),v:a.status||"—",tone:AUTH_ACTIVE(a)?"ok":"bad"})):[{t:"note",v:T("rp_noauth")}]),
      {t:"row",l:T("f_status"),v:c.usdot_status||"—",tone:String(c.usdot_status||"").toUpperCase()==="ACTIVE"?"ok":"bad"},
      ...(c.allowed_to_operate!=null?[{t:"row",l:T("rp_allowed"),v:c.allowed_to_operate?T("rp_yes"):T("rp_no"),tone:c.allowed_to_operate?"ok":"bad"}]:[]),
      {t:"row",l:T("f_oos"),v:c.oos_date?dt(c.oos_date):T("rp_none"),tone:c.oos_date?"bad":"ok"}]},
    {h:T("rp_ins_h"),items:[insRow(T("f_bipd"),bReq?usd(bReq):"",bFile>=bReq&&bFile>0,bFile?usd(bFile):""),insRow(T("f_cargo"),cReq?T("rp_yes"):"",cFile,""),insRow(T("f_bond"),dReq?T("rp_yes"):"",dFile,"")]},
    {h:T("rp_boc_h"),items:c.boc3?[{t:"big",v:c.boc3.agent,sub:[c.boc3.city,c.boc3.state].filter(Boolean).join(", ")},{t:"row",l:"BOC-3",v:T("rp_file"),tone:"ok"}]:[{t:"row",l:"BOC-3",v:T("rp_missing"),tone:"bad"}]},
    {h:T("rp_safety_h"),items:[{t:"row",l:T("f_rating"),v:(c.safety||{}).rating||"—",tone:"text"},...(ins.veh?[{t:"bar",l:T("rp_veh"),x:ins.veh}]:[]),...(ins.drv?[{t:"bar",l:T("rp_drv"),x:ins.drv}]:[])]},
    {h:T("rp_crash_h"),items:[{t:"nums",cells:[[cr.fatal,T("rp_fatal"),cr.fatal>0],[cr.injury,T("rp_injury")],[cr.tow,T("rp_tow")],[cr.total,T("rp_total")]]}]},
    {h:T("rp_fleet_h"),items:[{t:"nums",cells:[[c.power_units,T("rp_units")],[c.drivers,T("rp_drivers")]]},...((c.cargo||[]).length?[{t:"chips",list:c.cargo}]:[]),
      {t:"row",l:T("f_mcs"),v:c.mcs150?dt(c.mcs150):c.mcs150_outdated===false?T("rp_current"):c.mcs150_outdated?T("rp_outdated"):"—",tone:"text"},
      {t:"row",l:T("f_phone"),v:c.phone||"—",tone:"text"},{t:"row",l:T("f_addr"),v:c.address||"—",tone:"text",wide:true}]}
  ];
  const drawSec=(s,X,Y,w,h)=>{
    if(h)box(X,Y,w,h,14,C.card,C.line);
    const iX=X+20,iW=w-40;let yy=Y+34;text(s.h,iX,yy,F(800,18),C.ink);yy+=14;
    s.items.forEach((it,k)=>{
      if(k){x.fillStyle=C.line;x.fillRect(iX,yy,iW,1)}
      if(it.t==="row"){
        let vw=0;const vf=F(700,15);
        if(it.tone==="text"){const vl=wrap(it.v,it.wide?iW*0.62:iW*0.5,vf);vw=Math.max(...vl.map(l=>tw(l,vf)));
          const ll=wrap(it.l,iW-vw-16,F(500,15));const rows=Math.max(ll.length,vl.length);
          ll.forEach((l,i)=>text(l,iX,yy+26+i*20,F(500,15),C.muted));vl.forEach((l,i)=>text(l,iX+iW,yy+26+i*20,vf,C.ink,"right"));yy+=rows*20+18;return}
        const pf=F(700,12,true);vw=Math.ceil(tw(it.v,pf))+20;
        const ll=wrap(it.l,iW-vw-16,F(600,15)),sl=it.sub?wrap(it.sub,iW-vw-16,F(500,12,true)):[];
        ll.forEach((l,i)=>text(l,iX,yy+26+i*20,F(600,15),C.ink));sl.forEach((l,i)=>text(l,iX,yy+26+ll.length*20+i*17,F(500,12,true),C.muted));
        pill(it.v,it.tone,iX+iW,yy+10);yy+=Math.max(44,ll.length*20+sl.length*17+18);return}
      if(it.t==="note"){wrap(it.v,iW,F(500,15)).forEach((l,i)=>{text(l,iX,yy+26+i*20,F(500,15),C.muted)});yy+=40;return}
      if(it.t==="big"){const bl=wrap(it.v,iW,F(800,20));bl.forEach((l,i)=>text(l,iX,yy+32+i*26,F(800,20),C.ink));yy+=bl.length*26+14;
        if(it.sub){text(it.sub,iX,yy+16,F(500,14),C.muted);yy+=26}return}
      if(it.t==="bar"){const b=it.x,good=b.rate<=b.nat,mx=Math.max(b.rate,b.nat,1)*1.25,col=b.n?(good?C.good:C.warn):C.muted;
        text(it.l,iX,yy+26,F(600,15),C.ink);text(b.n?b.rate+"%":"—",iX+iW,yy+26,F(800,16,true),col,"right");
        box(iX,yy+38,iW,8,4,C.bg);if(b.n)box(iX,yy+38,Math.max(8,Math.min(1,b.rate/mx)*iW),8,4,col);
        x.fillStyle=C.ink;x.fillRect(iX+Math.min(1,b.nat/mx)*iW-1,yy+34,2,16);
        text(T("rp_insp",{n:num(b.n)}),iX,yy+68,F(500,12,true),C.muted);text(T("rp_nat",{n:b.nat}),iX+iW,yy+68,F(500,12,true),C.muted,"right");yy+=82;return}
      if(it.t==="nums"){const n=it.cells.length,cw=iW/n;it.cells.forEach(([val,l,red],i)=>{const cx0=iX+i*cw;
          text(val??"—",cx0,yy+44,F(800,30,true),red?C.bad:C.ink);wrap(l,cw-8,F(500,13)).forEach((ln,j)=>text(ln,cx0,yy+66+j*16,F(500,13),C.muted))});yy+=88;return}
      if(it.t==="chips"){let cx1=iX,cy=yy+12;it.list.forEach(ch=>{const f=F(600,12,true),w2=Math.ceil(tw(ch,f))+16;if(cx1+w2>iX+iW){cx1=iX;cy+=30}
          box(cx1,cy,w2,24,6,C.bg,C.line);text(ch,cx1+8,cy+16.5,f,C.ink);cx1+=w2+6});yy=cy+36;return}
    });
    return yy-Y+14;
  };
  const colW=(CW-20)/2;
  const measure=s=>{const keep=x;x=scratch;x.clearRect(0,0,W,1200);const h=drawSec(s,0,0,colW,0);x=keep;return h};
  for(let i=0;i<secs.length;i+=2){
    const a=secs[i],b=secs[i+1],h=Math.max(measure(a),b?measure(b):0);
    drawSec(a,P,y,colW,h);if(b)drawSec(b,P+colW+20,y,colW,h);y+=h+20;
  }

  // ---- footer
  y+=6;x.fillStyle=C.line;x.fillRect(P,y,CW,1);y+=28;
  text(T("checked_on",{d:dt(c.checked_at)})+" · "+T("rp_sources")+": "+(c.sources||["FMCSA"]).join(", "),P,y,F(500,13,true),C.muted);
  text("rigora.org/?q="+c.dot,W-P,y,F(700,13,true),C.ink,"right");y+=10;
  wrap(T("foot"),CW,F(500,13)).forEach(l=>{y+=20;text(l,P,y,F(500,13),C.muted)});
  y+=36;

  const [out,o]=mk(y);o.setTransform(1,0,0,1,0,0);o.fillStyle="#ffffff";o.fillRect(0,0,out.width,out.height);
  o.drawImage(big,0,0,out.width,Math.min(out.height,big.height),0,0,out.width,Math.min(out.height,big.height));
  big.width=big.height=scr.width=scr.height=0; // free memory on phones
  return out;
}
function jpegBlob(cv){return new Promise(r=>cv.toBlob(b=>r(b),"image/jpeg",0.92))}
// a one-page PDF that holds the JPEG (DCTDecode), page sized to the picture
async function pdfBlob(cv,title){
  const jpg=new Uint8Array(await (await jpegBlob(cv)).arrayBuffer());
  const pw=612,ph=Math.round(612*cv.height/cv.width*100)/100;
  const enc=new TextEncoder(),parts=[],offs=[];let len=0;
  const add=p=>{const b=typeof p==="string"?enc.encode(p):p;parts.push(b);len+=b.length};
  const obj=(n,body)=>{offs[n]=len;add(n+" 0 obj\n");body.forEach(add);add("\nendobj\n")};
  const esc2=s=>String(s).replace(/[\\()]/g,"\\$&").replace(/[^\x20-\x7e]/g,"?");
  const content="q "+pw+" 0 0 "+ph+" 0 0 cm /Im0 Do Q";
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1,["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2,["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  obj(3,["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+pw+" "+ph+"] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"]);
  obj(4,["<< /Type /XObject /Subtype /Image /Width "+cv.width+" /Height "+cv.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpg.length+" >>\nstream\n",jpg,"\nendstream"]);
  obj(5,["<< /Length "+content.length+" >>\nstream\n"+content+"\nendstream"]);
  obj(6,["<< /Title ("+esc2(title)+") /Producer (Rigora) >>"]);
  const xref=len;
  add("xref\n0 7\n0000000000 65535 f \n"+offs.slice(1).map(o=>String(o).padStart(10,"0")+" 00000 n \n").join(""));
  add("trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");
  return new Blob(parts,{type:"application/pdf"});
}
function saveBlob(blob,name){
  const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),60000);
}
async function downloadReport(kind,btn){
  const c=COS[state.dot];if(!c)return;const old=btn.textContent;btn.disabled=true;btn.textContent=T("dl_wait");
  try{
    const cv=await reportCanvas(state.dot);
    const base="Rigora-check-USDOT-"+c.dot+"-"+new Date().toISOString().slice(0,10);
    if(kind==="pdf")saveBlob(await pdfBlob(cv,"Rigora company check: "+c.legal_name+" (USDOT "+c.dot+")"),base+".pdf");
    else saveBlob(await jpegBlob(cv),base+".jpg");
  }catch(e){console.error(e);btn.textContent=T("dl_err");setTimeout(()=>{btn.textContent=old;btn.disabled=false},2500);return}
  btn.textContent=old;btn.disabled=false;
}
