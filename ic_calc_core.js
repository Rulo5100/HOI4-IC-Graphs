/* BFFU IC calculator core — ports the Horstorical ic_calc.pyw algorithm to JS,
   using BFFU's extracted cost database (bffu_costs.json).

   unit_IC = (base + flatModules + Σ level*upgrade) * (1 + Σ multModules + design_team build_cost_ic)
   Per country we sum: stockpile + fielded (divisions & air wings) + WIP, plus net combat losses/kills.

   Exposed: computeIC(saveText, DB) -> { tags:[...], data:{TAG:{arsenal,wip,losses,kills,items:[...] }} }
   Works in Node (module.exports) and in the browser (window.computeIC).            */
(function(root){
"use strict";

// ---------- brace-aware text helpers (ported from the .pyw) ----------
function extractForwardBlock(text, startIdx){ // startIdx points at '{'
  let depth=0, inQ=false;
  for(let i=startIdx;i<text.length;i++){
    const ch=text[i];
    if(ch==='"' && text[i-1]!=='\\') inQ=!inQ;
    if(!inQ){ if(ch==='{')depth++; else if(ch==='}'){depth--; if(depth===0)return text.slice(startIdx,i+1);} }
  }
  return "";
}
function getParentBlock(text, startIdx){ // nearest enclosing { and the word before it
  let depth=0, inQ=false;
  for(let i=startIdx-1;i>=0;i--){
    const ch=text[i];
    if(ch==='"' && text[i-1]!=='\\') inQ=!inQ;
    if(!inQ){
      if(ch==='}')depth++;
      else if(ch==='{'){depth--;
        if(depth<0){
          let j=i-1; while(j>=0 && ' \t\n\r='.indexOf(text[j])>=0) j--;
          let k=j; while(k>=0 && /[A-Za-z0-9_]/.test(text[k])) k--;
          if(j>=0 && k<j) return {name:text.slice(k+1,j+1), idx:i};
          return {name:null, idx:i};
        }
      }
    }
  }
  return {name:null, idx:-1};
}
function extractNestedBlock(text, keyword){
  const re=new RegExp(keyword+"\\s*=\\s*\\{","i");
  const m=re.exec(text); if(!m) return "";
  let start=m.index+m[0].length-1, depth=0, inQ=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(ch==='"' && text[i-1]!=='\\') inQ=!inQ;
    if(!inQ){ if(ch==='{')depth++; else if(ch==='}'){depth--; if(depth===0)return text.slice(start+1,i);} }
  }
  return "";
}
function extractBracketBlock(chunk){ // chunk begins near a '{'
  const s=chunk.indexOf('{'); if(s<0) return "";
  let depth=0, inQ=false, esc=false;
  for(let i=s;i<chunk.length;i++){
    const ch=chunk[i];
    if(esc){esc=false;continue;}
    if(ch==='\\'){esc=true;continue;}
    if(ch==='"') inQ=!inQ;
    if(!inQ){ if(ch==='{')depth++; else if(ch==='}')depth--; }
    if(depth===0) return chunk.slice(0,i+1);
  }
  return chunk;
}

// ---------- blueprint costing ----------
function calculateBlueprint(variantBlock, archetype, DB){
  const base=DB.base[archetype]; if(!base) return 0;
  let flat=0, mult=0;
  const up=extractNestedBlock(variantBlock,"upgrades");
  if(up){
    for(const name in DB.upgrade){
      const m=new RegExp(name+"[=\\s]+(?:\\{\\s*level\\s*=\\s*)?(\\d+)","i").exec(up);
      if(m) flat += parseInt(m[1],10)*DB.upgrade[name];
    }
  }
  const mods=extractNestedBlock(variantBlock,"modules");
  if(mods){
    const re=/=\s*"?([a-zA-Z0-9_\-]+)"?/g; let mm;
    while((mm=re.exec(mods))){
      const mod=mm[1].toLowerCase();
      flat += DB.moduleFlat[mod]||0;
      mult += DB.moduleMult[mod]||0;
    }
  }
  const dtb=extractNestedBlock(variantBlock,"design_team_bonus");
  if(dtb){ const m=/build_cost_ic\s*=\s*([-\d\.]+)/i.exec(dtb); if(m) mult+=parseFloat(m[1]); }
  return Math.round((base+flat)*(1+mult)*100)/100;
}

function mapIdsAndBlueprints(text, DB){
  const idMap={}, variantCosts={};
  const re=/id\s*=\s*\{\s*id\s*=\s*(\d+)\s+type\s*=\s*70\s*\}/g; let m;
  while((m=re.exec(text))){
    const eid=m[1];
    if(idMap[eid] && ["unknown_variant","equipment","equipment_variant"].indexOf(idMap[eid])<0) continue;
    const par=getParentBlock(text, m.index); if(!par.name) continue;
    let bn=par.name.toLowerCase(), archetype=bn, role=null;
    const vb=extractForwardBlock(text, par.idx);
    if(bn==="equipment_variant"||bn==="equipment"){
      let am=/archetype\s*=\s*"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i.exec(vb);
      if(am) archetype=am[1].toLowerCase();
      else{ let tm=/type\s*=\s*"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i.exec(vb);
        archetype = tm ? tm[1].toLowerCase() : "unknown_variant"; }
      let rm=/\brole\s*=\s*"?([a-zA-Z_]+)"?/i.exec(vb);
      role = rm ? rm[1].toLowerCase() : null;
    }
    let raw=archetype;
    if(/light_tank|medium_tank|heavy_tank|modern_tank|super_heavy_tank|land_cruiser|mech|armored_car|armored_support/.test(raw))
      raw=raw.replace("equipment","chassis");
    let ui=raw;
    if(role && ["armor","fighter","cas","naval_bomber"].indexOf(role)<0) ui=raw+" ["+role+"]";
    idMap[eid]=ui;
    const norm=s=>s.replace(/_(artillery|aa|destroyer|flame|amphibious)_chassis/,"_chassis")
                   .replace(/^anti_tank_armored_car/,"armored_car")
                   .replace(/_(fighter|cas|naval_bomber|interceptor|suicide|tac_bomber|strat_bomber|heavy_fighter|maritime_patrol_plane|scout_plane)_airframe/,"_airframe");
    // try renamed (tank-style "_chassis") AND original (e.g. mechanized_equipment_1) keys
    let baseKey=null;
    for(const c of [norm(raw), norm(archetype), archetype, raw]){ if(DB.base[c]!==undefined){ baseKey=c; break; } }
    // last resort: a concatenated design name like "medium_tank_destroyer_chassis"+"sov_..."
    if(!baseKey){
      if(!DB._keys) DB._keys=Object.keys(DB.base);
      let best=null;
      for(const k of DB._keys){ if(k.length>=10 && raw.indexOf(k)===0 && (!best||k.length>best.length)) best=k; }
      if(best) baseKey=best;
    }
    if(baseKey){
      const ic=calculateBlueprint(vb, baseKey, DB);
      if(ic>0) variantCosts[eid]=ic;
    }
  }
  return {idMap, variantCosts};
}

// ---------- line-based stockpile + WIP parsers ----------
const isTag=s=>/^[A-Z]{3}$/.test(s);

function parseStockpiles(text){
  const stock={}; let depth=0, tag=null;
  const st={countries:-1, tag:-1, production:-1, equipments:-1};
  let buf=[];
  const lines=text.split("\n");
  for(let li=0; li<lines.length; li++){
    const s=lines[li].trim(); if(!s) continue;
    buf.push(s); if(buf.length>10) buf.shift();
    const nd=depth + (s.split("{").length-1) - (s.split("}").length-1);
    const ns=s.replace(/ /g,"");
    if(st.countries===-1 && ns.indexOf("countries={")>=0) st.countries=nd;
    else if(st.countries!==-1 && st.tag===-1){
      const mt=/^([A-Z]{3})\s*=\s*\{/.exec(s);
      if(mt && isTag(mt[1])){ tag=mt[1]; st.tag=nd; if(!stock[tag])stock[tag]={}; }
    } else if(st.tag!==-1 && st.production===-1){
      if(ns.indexOf("production={")===0) st.production=nd;
    } else if(st.production!==-1 && st.equipments===-1){
      if(/^equipments\s*=\s*\{/.test(s)) st.equipments=nd;
    }
    if(st.equipments!==-1){
      const ma=/amount=([\d\.]+)/.exec(ns);
      if(ma){
        const amt=parseFloat(ma[1]); let id=null, t70=false;
        for(let b=buf.length-1;b>=0;b--){
          const bl=buf[b].replace(/ /g,"");
          if(bl.indexOf("type=70")>=0) t70=true;
          let mi=/id=(\d+)/.exec(buf[b]); if(!mi) mi=/^(\d+)\s*=\s*\{/.exec(buf[b].trim());
          if(mi && !id) id=mi[1];
          if(bl.indexOf("equipment={")>=0) break;
        }
        if(id && t70 && tag){ stock[tag][id]=(stock[tag][id]||0)+amt; }
      }
    }
    depth=nd;
    ["equipments","production","tag","countries"].forEach(k=>{ if(st[k]!==-1 && depth<st[k]){ st[k]=-1; if(k==="tag")tag=null; } });
  }
  return stock;
}

function parseProgress(text, byId){
  const prog={}; let depth=0, tag=null; const eqAt={};
  const st={countries:-1, tag:-1, production:-1}; let block={};
  const lines=text.split("\n");
  for(let li=0; li<lines.length; li++){
    const s=lines[li].trim(); if(!s) continue;
    const cur=depth;
    const nd=depth + (s.split("{").length-1) - (s.split("}").length-1);
    const ns=s.replace(/ /g,"");
    if(st.countries===-1 && ns.indexOf("countries={")>=0) st.countries=nd;
    else if(st.countries!==-1 && st.tag===-1){
      const mt=/^([A-Z]{3})\s*=\s*\{/.exec(s);
      if(mt && isTag(mt[1])){ tag=mt[1]; st.tag=nd; if(!prog[tag])prog[tag]=0; }
    } else if(st.tag!==-1 && st.production===-1){
      if(ns.indexOf("production={")===0) st.production=nd;
    }
    if(st.production!==-1 && tag){
      if(ns.indexOf("produced=")===0){ const m=/^produced=([\d\.]+)/.exec(ns); if(m) block[cur]=(block[cur]||0)+parseFloat(m[1]); }
      else if(ns.indexOf("progress=")===0){ const m=/^progress=([\d\.]+)/.exec(ns); if(m) block[cur]=(block[cur]||0)+parseFloat(m[1]); }
      else if(ns.indexOf("equipment_variant_index=")===0){ const m=/id=(\d+)/.exec(ns); if(m) eqAt[cur]=m[1]; }
      if(nd<cur){
        if(block[cur]!==undefined){
          prog[tag]+=block[cur];
          if(byId && eqAt[cur]){ const o=byId[tag]||(byId[tag]={}); o[eqAt[cur]]=(o[eqAt[cur]]||0)+block[cur]; }
          delete block[cur];
        }
        delete eqAt[cur];
      }
    }
    depth=nd;
    ["production","tag","countries"].forEach(k=>{ if(st[k]!==-1 && depth<st[k]){ st[k]=-1; if(k==="tag")tag=null; if(k==="production")block={}; } });
  }
  return prog;
}

// ---------- chunk-based fielded equipment (divisions + air wings) ----------
function addAmounts(dst, owner, block){
  if(!dst[owner]) dst[owner]={};
  let m, re1=/id\s*=\s*\{\s*id\s*=\s*(\d+)\s+type\s*=\s*70\s*\}\s*amount\s*=\s*([\d\.]+)/g;
  while((m=re1.exec(block))) dst[owner][m[1]]=(dst[owner][m[1]]||0)+parseFloat(m[2]);
  let re2=/amount\s*=\s*([\d\.]+)\s*id\s*=\s*\{\s*id\s*=\s*(\d+)\s+type\s*=\s*70\s*\}/g;
  while((m=re2.exec(block))) dst[owner][m[2]]=(dst[owner][m[2]]||0)+parseFloat(m[1]);
}
function parseFielded(text){
  const fielded={};
  const divs=text.split(/\bdivision\s*=\s*\{/);
  for(let i=1;i<divs.length;i++){
    const blk=extractBracketBlock("{"+divs[i]);
    let owner=null;
    let ml=/logical_country\s*=\s*"([A-Z]{3})"/.exec(blk);
    if(ml) owner=ml[1];
    if(!owner){
      const tags=[...divs[i-1].matchAll(/\b([A-Z]{3})\s*=\s*\{/g)].map(x=>x[1]);
      if(tags.length) owner=tags[tags.length-1];
    }
    if(owner && isTag(owner)) addAmounts(fielded, owner, blk);
  }
  const wings=text.split(/\bair_wings\s*=\s*\{/);
  for(let i=1;i<wings.length;i++){
    const blk=extractBracketBlock("{"+wings[i]);
    let mt=/\btag\s*=\s*"([A-Z]{3})"/.exec(blk);
    if(mt && isTag(mt[1])) addAmounts(fielded, mt[1], blk);
  }
  return fielded;
}
// ships are individual ship={} blocks inside task_force={}; each references a hull design id (type 70)
function parseNaval(text){
  const naval={};
  const tfs=text.split(/\btask_force\s*=\s*\{/);
  for(let i=1;i<tfs.length;i++){
    const blk=extractBracketBlock("{"+tfs[i]);
    let owner=null;
    const ml=/logical_country\s*=\s*"([A-Z]{3})"/.exec(blk);
    if(ml) owner=ml[1];
    if(!owner){
      const tags=[...tfs[i-1].matchAll(/\b([A-Z]{3})\s*=\s*\{/g)].map(x=>x[1]);
      if(tags.length) owner=tags[tags.length-1];
    }
    if(owner && isTag(owner)) addAmounts(naval, owner, blk);
  }
  return naval;
}

// ---------- combat losses & kills ----------
function parseCombat(text){
  const losses={}, kills={};
  const chunks=text.split(/\bcombat_data_entry\s*=\s*\{/);
  for(let i=1;i<chunks.length;i++){
    const entry=extractBracketBlock("{"+chunks[i]);
    function sideTag(side){
      const sm=new RegExp("\\b"+side+"\\s*=\\s*\\{").exec(entry);
      if(!sm) return null;
      const sb=extractBracketBlock(entry.slice(sm.index));
      const tc=extractNestedBlock(sb,"tags");
      const t=/"([A-Z]{3})"/.exec(tc); return t?t[1]:null;
    }
    const att=sideTag("attacker"), def=sideTag("defender");
    [["attacker",att,def],["defender",def,att]].forEach(([side,prim,killer])=>{
      if(!prim || !isTag(prim)) return;
      const fm=new RegExp("\\b"+side+"\\s*=\\s*\\{").exec(entry); if(!fm) return;
      const fb=extractBracketBlock(entry.slice(fm.index));
      [["equipment_lost",1],["equipment_recovered",-1],["equipment_captured_by_enemy",-1]].forEach(([key,sign])=>{
        const ec=extractNestedBlock(fb,key); if(!ec) return;
        let m, re1=/id\s*=\s*\{\s*id\s*=\s*(\d+)\s+type\s*=\s*70\s*\}\s*amount\s*=\s*([\d\.]+)/g;
        while((m=re1.exec(ec))){ const id=m[1],a=parseFloat(m[2])*sign;
          (losses[prim]=losses[prim]||{})[id]=(losses[prim][id]||0)+a;
          if(killer&&isTag(killer)) (kills[killer]=kills[killer]||{})[id]=(kills[killer][id]||0)+a; }
        let re2=/amount\s*=\s*([\d\.]+)\s*id\s*=\s*\{\s*id\s*=\s*(\d+)\s+type\s*=\s*70\s*\}/g;
        while((m=re2.exec(ec))){ const id=m[2],a=parseFloat(m[1])*sign;
          (losses[prim]=losses[prim]||{})[id]=(losses[prim][id]||0)+a;
          if(killer&&isTag(killer)) (kills[killer]=kills[killer]||{})[id]=(kills[killer][id]||0)+a; }
      });
    });
  }
  return {losses, kills, entries: chunks.length-1};
}

// ---------- non-combat losses: attrition (per-country combat_log) and garrison (resistance_attack_log) ----------
// combat_log records: equipment={ equipment={id amount}... allow_zero_entries=no } reason=N date="..."
//   reason 0 = in combat (already counted from combat_data_entry); 1/2/3 = attrition-type losses
// resistance_attack_log: manpower={ value={ tag="OCCUPIER" ...}} country="OCCUPIED" garrison=yes|no equipment={...}
// one record per resistance attack: state, occupier (loses the equipment), occupied country, date, garrison flag, manpower, equipment
function parseResistance(text){
  const out=[]; const itemRe=/id\s*=\s*\{\s*id\s*=\s*(\d+)\s+type\s*=\s*70\s*\}\s*amount\s*=\s*([\d\.]+)/g;
  const parts=text.split(/resistance_attack_log\s*=\s*\{/);
  for(let i=1;i<parts.length;i++){
    const c=parts[i].slice(0,8000);
    const st=/^\s*state\s*=\s*(\d+)/.exec(c);
    const tg=/manpower\s*=\s*\{\s*value\s*=\s*\{\s*tag\s*=\s*"([A-Z]{3})"\s*value\s*=\s*([\d\.]+)/.exec(c);
    const co=/\bcountry\s*=\s*"([A-Z]{3})"/.exec(c);
    const dt=/\bdate\s*=\s*"([\d\.]+)"/.exec(c);
    if(!st||!tg||!co||!dt||!isTag(tg[1])) continue;
    const gar=/\bgarrison\s*=\s*(\w+)/.exec(c), eq=/\bequipment\s*=\s*\{([\s\S]*?)allow_zero_entries/.exec(c);
    const items={}; let m;
    if(eq){ itemRe.lastIndex=0; while((m=itemRe.exec(eq[1]))) items[m[1]]=(items[m[1]]||0)+parseFloat(m[2]); }
    out.push({state:+st[1], occ:tg[1], mp:parseFloat(tg[2]), country:co[1], date:dt[1], garrison:gar?gar[1]:"?", items});
  }
  return out;
}
function parseNonCombat(text){
  const att={1:{},2:{},3:{}}, garr={}; let logRecs=0, garrRecs=0;
  const itemRe=/id\s*=\s*\{\s*id\s*=\s*(\d+)\s+type\s*=\s*70\s*\}\s*amount\s*=\s*([\d\.]+)/g;
  const recRe=/\bequipment\s*=\s*\{\s*((?:equipment\s*=\s*\{\s*id\s*=\s*\{\s*id\s*=\s*\d+\s+type\s*=\s*70\s*\}\s*amount\s*=\s*[\d\.]+\s*\}\s*)+)allow_zero_entries\s*=\s*no\s*\}\s*reason\s*=\s*(\d)/g;
  const cl=text.split(/\r?\ncombat_log\s*=\s*\{/);
  for(let i=1;i<cl.length;i++){
    let ch=cl[i]; const e=ch.search(/\r?\n\}\r?\n/); if(e>0) ch=ch.slice(0,e);
    const tm=/\btag\s*=\s*"([A-Z]{3})"/.exec(ch); if(!tm||!isTag(tm[1])) continue; const tag=tm[1];
    let m; recRe.lastIndex=0;
    while((m=recRe.exec(ch))){
      logRecs++; const r=m[2]; if(r==="0"||!att[r]) continue;
      let it; itemRe.lastIndex=0; const dst=(att[r][tag]=att[r][tag]||{});
      while((it=itemRe.exec(m[1]))) dst[it[1]]=(dst[it[1]]||0)+parseFloat(it[2]);
    }
  }
  const resRecs=parseResistance(text);
  resRecs.forEach(r=>{ garrRecs++; const dst=(garr[r.occ]=garr[r.occ]||{}); for(const id in r.items) dst[id]=(dst[id]||0)+r.items[id]; });
  return {att, garr, logRecs, garrRecs, resRecs};
}

// ---------- cost fallback for unmatched ids ----------
function fallbackCost(name, DB){
  let c=DB.base[name.split(" [")[0]]||0;
  if(c>0) return c;
  if(name.indexOf("medium_tank")>=0) return name.indexOf("_3")>=0?26:(name.indexOf("_2")>=0?21.5:32);
  if(/light_tank|heavy_tank|modern_tank|mech|car|armored_support/.test(name)) return 25;
  if(/plane|airframe|bomber|fighter/.test(name)) return 45;
  if(name.indexOf("infantry")>=0) return 0.5;
  if(/artillery|anti_tank|anti_air/.test(name)) return 3;
  return 10;
}

// ---------- equipment categories (for the UI's include-air / include-ships filters) ----------
const AIR_RE=/(^|_)(cv_)?(small|medium|large)_plane|airframe|fighter|bomber|(^|_)cas(_|$| )|interceptor|helicopter|plane_equipment|scout_plane|maritime_patrol|(^|_)jet_/;
function isAirName(n){ return AIR_RE.test(String(n||"").toLowerCase()); }
function isShipName(n){ return /ship_hull/.test(String(n||"").toLowerCase()); }

// ---------- top-level ----------
function computeIC(text, DB, opts){
  opts=opts||{}; const log=opts.log||function(){};
  log("Compiling equipment blueprints…");
  const {idMap, variantCosts}=mapIdsAndBlueprints(text, DB);
  log("Reading stockpiles…");      const stock=parseStockpiles(text);
  log("Sweeping divisions & air wings…"); const fielded=parseFielded(text);
  log("Counting fleets…");          const naval=parseNaval(text);
  log("Reading assembly-line WIP…"); const wipById={}; const wip=parseProgress(text, wipById);
  log("Slicing combat logs…");      const {losses, kills, entries:combatEntries}=parseCombat(text);
  log("Reading attrition & garrison logs…"); const nonCombat=parseNonCombat(text);

  const tagset=new Set([...Object.keys(stock),...Object.keys(fielded),...Object.keys(naval),...Object.keys(wip),...Object.keys(losses),...Object.keys(kills),...Object.keys(nonCombat.att[1]),...Object.keys(nonCombat.att[2]),...Object.keys(nonCombat.att[3]),...Object.keys(nonCombat.garr)].filter(isTag));
  const data={};
  function unit(id, nameLc){ let c=variantCosts[id]; if(c&&c>0)return c; return fallbackCost(nameLc, DB); }

  tagset.forEach(tag=>{
    const items={};
    const merge=(src, field)=>{ const o=(src[tag]||{}); for(const id in o){ if(!items[id])items[id]={id,stock:0,field:0,naval:0}; items[id][field]+=o[id]; } };
    merge(stock,"stock"); merge(fielded,"field"); merge(naval,"naval");
    const list=[];
    let stockIC=0, fieldIC=0, navalIC=0, airStockIC=0, airFieldIC=0;
    for(const id in items){
      const total=items[id].stock+items[id].field+items[id].naval; if(total<=0) continue;
      const nm=(idMap[id]||"unknown").toLowerCase();
      const c=unit(id, nm);
      stockIC+=items[id].stock*c; fieldIC+=items[id].field*c; navalIC+=items[id].naval*c;
      if(isAirName(nm)){ airStockIC+=items[id].stock*c; airFieldIC+=items[id].field*c; }
      list.push({id, name:nm, stock:items[id].stock, field:items[id].field, naval:items[id].naval, total, unit:c, ic:total*c});
    }
    list.sort((a,b)=>b.ic-a.ic);
    const arsenal=list.reduce((s,i)=>s+i.ic,0)+(wip[tag]||0);
    function ledger(src){
      const out=[]; const o=src[tag]||{};
      for(const id in o){ const amt=o[id]; if(amt<=0.1)continue;
        const nm=(idMap[id]||"unknown").toLowerCase(); const c=unit(id,nm);
        out.push({id,name:nm,amt,unit:c,ic:amt*c}); }
      out.sort((a,b)=>b.ic-a.ic); return out;
    }
    const lossL=ledger(losses), killL=ledger(kills);
    let airWip=0, navalWip=0;
    const wb=wipById[tag]||{};
    for(const id in wb){ const nm=idMap[id]||""; if(isAirName(nm)) airWip+=wb[id]; else if(isShipName(nm)) navalWip+=wb[id]; }
    data[tag]={
      arsenal, wip:wip[tag]||0, airWip, navalWip, stockIC, fieldIC, navalIC, airStockIC, airFieldIC,
      airLosses:lossL.filter(i=>isAirName(i.name)).reduce((s,i)=>s+i.ic,0),
      airKills:killL.filter(i=>isAirName(i.name)).reduce((s,i)=>s+i.ic,0),
      losses:lossL.reduce((s,i)=>s+i.ic,0),
      kills:killL.reduce((s,i)=>s+i.ic,0),
      items:list, lossItems:lossL, killItems:killL,
      attr1Items:ledger(nonCombat.att[1]), attr2Items:ledger(nonCombat.att[2]), attr3Items:ledger(nonCombat.att[3]), garrItems:ledger(nonCombat.garr)
    };
  });

  const resistance=nonCombat.resRecs.map(r=>{
    const it=[]; let ic=0, n=0;
    for(const id in r.items){ const nm=(idMap[id]||"unknown").toLowerCase(), a=r.items[id], c=unit(id,nm); it.push([nm,a,a*c]); ic+=a*c; n+=a; }
    return {s:r.state, o:r.occ, c:r.country, d:r.date, g:r.garrison==="yes", m:r.mp, n, ic, it};
  });

  const tags=Object.keys(data).filter(t=>data[t].arsenal>100||data[t].losses>100||data[t].kills>100)
                    .sort((a,b)=>data[b].arsenal-data[a].arsenal);
  const dm=/\bdate="([\d.]+)"/.exec(text.slice(0,20000));
  return {tags, data, date: dm?dm[1]:null, combatEntries, logRecs:nonCombat.logRecs, garrRecs:nonCombat.garrRecs, resistance};
}

const api={parseNonCombat, isAirName, isShipName, computeIC, mapIdsAndBlueprints, parseStockpiles, parseFielded, parseNaval, parseProgress, parseCombat};
if(typeof module!=="undefined" && module.exports) module.exports=api;
root.computeIC=computeIC;
root.icIsAir=isAirName; root.icIsShip=isShipName;
})(typeof window!=="undefined"?window:globalThis);
