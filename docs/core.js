(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const image=src=>{assert(typeof src==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(src)&&src.length<46*1024*1024,'图片必须为嵌入的 PNG / JPEG / WebP，且小于 32 MB');return src;};
  function validateBody(raw){
    assert(raw&&raw.schemaVersion===1&&raw.state&&typeof raw.state==='object','正文项目格式不正确');
    const state=clone(raw.state);state.pageRatio=state.pageRatio||'9:16';assert(['9:16','9:15','3:4'].includes(state.pageRatio),'页面比例不正确');
    for(const [k,min,max,fallback] of [['marginTop',24,400,88],['marginBottom',160,400,220],['marginLeft',24,240,64],['marginRight',24,240,64]]){
      const n=Number(state[k]??fallback);assert(Number.isFinite(n)&&n>=min&&n<=max,'页边距不正确：'+k);state[k]=String(n);
    }
    state.pageMode=state.pageMode||'auto';assert(['auto','manual'].includes(state.pageMode),'分页方式不正确');
    assert(typeof state.text==='string'&&state.text.length<=300000,'正文超过 30 万字符或格式不正确');
    const ranges={fs:[28,80],lh:[1.2,2.6],ls:[-2,12],pg:[10,110]};
    for(const [key,[min,max]] of Object.entries(ranges)){const n=Number(state[key]);assert(Number.isFinite(n)&&n>=min&&n<=max,'正文参数不正确：'+key);state[key]=String(n);}
    for(const key of ['customColor','customTextColor','headingColor'])assert(/^#[0-9a-f]{6}$/i.test(state[key]),'颜色格式不正确');
    for(const [key,choices] of Object.entries({bodyBackground:['paper','dark'],align:['left','center','justify'],weight:['300','400','600'],vAlign:['start','center'],textMode:['auto','light','dark','custom']}))assert(choices.includes(String(state[key])),'正文选项不正确：'+key);
    assert(typeof state.bodyFont==='string'&&state.bodyFont.length<60,'字体不正确');
    assert(typeof state.archiveNum==='string'&&state.archiveNum.length<200,'编号不正确');
    assert(raw.images&&typeof raw.images==='object'&&!Array.isArray(raw.images),'图片列表不正确');
    const images={};
    assert(Object.keys(raw.images).length<=100,'最多支持 100 张正文图片');
    for(const [k,v] of Object.entries(raw.images)){assert(/^[a-zA-Z0-9_-]{1,100}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k),'图片标识不正确');images[k]=image(v);}
    const imageIndex=Number(raw.imageIndex);assert(Number.isSafeInteger(imageIndex)&&imageIndex>=0,'图片序号不正确');
    const brand=clone(raw.brand||{settings:{body:'signal',size:100},library:[]});
    assert(brand.settings&&typeof brand.settings.body==='string'&&Number.isFinite(Number(brand.settings.size))&&brand.settings.size>=50&&brand.settings.size<=180,'标识设置不正确');
    brand.settings.colorMode=brand.settings.colorMode||'auto';
    brand.settings.color=brand.settings.color||'#ff8254';
    assert(['auto','custom'].includes(brand.settings.colorMode)&&/^#[0-9a-f]{6}$/i.test(brand.settings.color),'标识颜色不正确');
    assert(Array.isArray(brand.library)&&brand.library.length<=30,'标识库不正确');
    for(const item of brand.library){assert(typeof item.id==='string'&&/^custom-[a-zA-Z0-9-]+$/.test(item.id)&&typeof item.name==='string'&&item.name.length<200,'自定义标识不正确');assert(item.black||item.white,'标识图片缺失');for(const key of ['black','white'])if(item[key])image(item[key]);if(item.dimensions)for(const dims of Object.values(item.dimensions))if(dims)assert(Array.isArray(dims)&&dims.length===2&&dims.every(x=>Number.isFinite(x)&&x>0&&x<50000),'标识尺寸不正确');}
    assert(['signal','talent','jobs','none',...brand.library.map(i=>i.id)].includes(brand.settings.body),'标识不存在');
    return {schemaVersion:1,state,images,imageIndex,brand};
  }
  function validateProject(raw){assert(raw&&raw.kind==='talent-signal-studio'&&raw.schemaVersion===1,'不支持的整篇项目格式');assert(typeof raw.name==='string'&&raw.name.length<=100,'项目名不正确');assert(raw.cover&&typeof raw.cover==='object','缺少封面项目');assert(['9:16','9:15','3:4'].includes(raw.coverRatio),'封面比例不正确');return {...raw,body:validateBody(raw.body)};}
  // Uncompressed ZIP: no remote library/CDN. UTF-8 filenames, CRC32, sequential input.
  const table=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
  const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  function makeHeader(size){const a=new Uint8Array(size);return {a,v:new DataView(a.buffer)};}
  async function zip(entries){const parts=[],central=[];let offset=0,count=0;
    for await(const {name,blob} of entries){
      const n=new TextEncoder().encode(name),bytes=new Uint8Array(await blob.arrayBuffer()),crc=crc32(bytes),size=bytes.length;
      assert(offset+size<1024*1024*1024,'导出超过 1 GB，请分批导出');
      const h=makeHeader(30);h.v.setUint32(0,0x04034b50,true);h.v.setUint16(4,20,true);h.v.setUint16(6,0x800,true);h.v.setUint32(14,crc,true);h.v.setUint32(18,size,true);h.v.setUint32(22,size,true);h.v.setUint16(26,n.length,true);
      parts.push(h.a,n,blob);const c=makeHeader(46);c.v.setUint32(0,0x02014b50,true);c.v.setUint16(4,20,true);c.v.setUint16(6,20,true);c.v.setUint16(8,0x800,true);c.v.setUint32(16,crc,true);c.v.setUint32(20,size,true);c.v.setUint32(24,size,true);c.v.setUint16(28,n.length,true);c.v.setUint32(42,offset,true);central.push(c.a,n);offset+=30+n.length+size;count++;
    }
    assert(count>0&&count<65536,'没有可导出的页面');const length=central.reduce((s,x)=>s+x.length,0),end=makeHeader(22);end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,count,true);end.v.setUint16(10,count,true);end.v.setUint32(12,length,true);end.v.setUint32(16,offset,true);return new Blob([...parts,...central,end.a],{type:'application/zip'});
  }
  const api={validateBody,validateProject,zip,crc32};root.StudioCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
