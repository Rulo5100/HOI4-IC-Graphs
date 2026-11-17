(function() {
"use strict";

const EQUAL=0x0001,OPEN=0x0003,CLOSE=0x0004,
      I32=0x000C,F32=0x000D,BOOL=0x000E,QUOTED=0x000F,
      U32=0x0014,UNQUOTED=0x0017,F64=0x0167,RGB=0x0243,
      U64=0x029C,I64=0x0317;

const MONTH_DAYS=[31,28,31,30,31,30,31,31,30,31,30,31];

function decodeDate(val){
  let hour=val%24; val=(val-hour)/24;
  let ordinal=val%365; let yr=(val-ordinal)/365-5000;
  let m=0,d=ordinal;
  for(;m<12;m++){
    if(d<MONTH_DAYS[m]){d+=1;break;}
    d-=MONTH_DAYS[m];
  }
  if(m>=12){m=11;d+=1;}
  return yr+"."+(m+1)+"."+d+"."+(hour+1);
}

function formatF32(raw){
  let v=raw/1000;
  if(v===Math.floor(v)) return v.toFixed(1);
  let s=v.toFixed(6);
  while(s.endsWith('0'))s=s.slice(0,-1);
  if(s.endsWith('.'))s+='0';
  return s;
}

function meltHoi4(buf,tokenDict){
  const view=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
  const len=buf.byteLength;
  let pos=7;
  const parts=["HOI4txt\n"];
  let indent=0;
  let afterEq=false;
  const utf8=typeof TextDecoder!=="undefined"?new TextDecoder("utf-8"):{decode:function(b){let s="";for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return s;}};

  function tabs(){return "\t".repeat(indent);}
  function u16(){let v=view.getUint16(pos,true);pos+=2;return v;}
  function i32v(){let v=view.getInt32(pos,true);pos+=4;return v;}
  function u32v(){let v=view.getUint32(pos,true);pos+=4;return v;}
  function peek(){if(pos<len-1)return view.getUint16(pos,true);return -1;}
  function strVal(){
    let slen=view.getUint16(pos,true);pos+=2;
    let s=utf8.decode(buf.subarray(pos,pos+slen));
    pos+=slen;return s;
  }

  function writeKey(k){parts.push(tabs()+k);}
  function writeVal(v){
    if(afterEq){parts.push(v+"\n");afterEq=false;}
    else{parts.push(tabs()+v+"\n");}
  }

  while(pos<len-1){
    let token=u16();

    if(token===EQUAL){
      parts.push("=");
      afterEq=true;
      continue;
    }
    if(token===OPEN){
      if(afterEq){parts.push("{\n");afterEq=false;}
      else{parts.push(tabs()+"{\n");}
      indent++;
      continue;
    }
    if(token===CLOSE){
      afterEq=false;
      indent=Math.max(0,indent-1);
      parts.push(tabs()+"}\n");
      continue;
    }

    if(token===I32){
      let v=i32v();
      let ds=decodeDate(v);
      let yr=parseInt(ds);
      if(yr>=1&&yr<=9999) writeVal(ds);
      else writeVal(String(v));
      continue;
    }
    if(token===F32){writeVal(formatF32(i32v()));continue;}
    if(token===BOOL){let v=buf[pos];pos++;writeVal(v?"yes":"no");continue;}
    if(token===QUOTED){
      let s=strVal();
      if(peek()===EQUAL) writeKey(s);
      else writeVal('"'+s+'"');
      continue;
    }
    if(token===U32){writeVal(String(u32v()));continue;}
    if(token===UNQUOTED){
      let s=strVal();
      if(peek()===EQUAL) writeKey(s);
      else writeVal(s);
      continue;
    }
    if(token===F64){
      let lo=view.getUint32(pos,true);let hi=view.getInt32(pos+4,true);pos+=8;
      writeVal(formatF32((hi*4294967296+lo)/100));
      continue;
    }
    if(token===U64){
      let lo=view.getUint32(pos,true);let hi=view.getUint32(pos+4,true);pos+=8;
      if(hi===0) writeVal(String(lo));
      else writeVal((BigInt(hi)*BigInt(4294967296)+BigInt(lo)).toString());
      continue;
    }
    if(token===I64){
      let lo=view.getUint32(pos,true);let hi=view.getInt32(pos+4,true);pos+=8;
      writeVal((BigInt(hi)*BigInt(4294967296)+BigInt(lo)).toString());
      continue;
    }
    if(token===RGB){
      if(afterEq){parts.push("rgb");afterEq=false;}
      else{parts.push(tabs()+"rgb");}
      continue;
    }

    let name=tokenDict[String(token)]||("0x"+token.toString(16));
    if(peek()===EQUAL) writeKey(name);
    else writeVal(name);
  }

  return parts.join("");
}

function isHoi4Binary(buf){
  if(buf.length<7) return false;
  return buf[0]===0x48&&buf[1]===0x4F&&buf[2]===0x49&&buf[3]===0x34&&
         buf[4]===0x62&&buf[5]===0x69&&buf[6]===0x6E;
}
function isZip(buf){
  return buf.length>=4&&buf[0]===0x50&&buf[1]===0x4B&&buf[2]===0x03&&buf[3]===0x04;
}
function isHoi4Text(buf){
  if(buf.length<7) return false;
  return buf[0]===0x48&&buf[1]===0x4F&&buf[2]===0x49&&buf[3]===0x34&&
         buf[4]===0x74&&buf[5]===0x78&&buf[6]===0x74;
}

if(typeof module!=="undefined"&&module.exports){
  module.exports={meltHoi4,isHoi4Binary,isHoi4Text,isZip,decodeDate};
} else if(typeof window!=="undefined"){
  window.meltHoi4=meltHoi4;
  window.isHoi4Binary=isHoi4Binary;
  window.isHoi4Text=isHoi4Text;
  window.isZip=isZip;
}

})();
