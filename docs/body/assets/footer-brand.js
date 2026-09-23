(() => {
  const KEY = 'ts-studio-footer-settings-v1';
  let settings = {body:'signal', cover:'same', size:100}, library = [], builtins, redraw;
  try { settings = {...settings, ...JSON.parse(localStorage.getItem(KEY) || '{}')}; } catch {}
  settings.size = Math.max(50, Math.min(180, Number(settings.size) || 100));
  const db = () => new Promise((resolve,reject) => {
    const request = indexedDB.open('ts-studio-brand-library',1);
    request.onupgradeneeded = () => request.result.createObjectStore('logos',{keyPath:'id'});
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const transact = async (mode, operation) => {
    const database = await db();
    try { return await new Promise((resolve,reject) => {
      const tx = database.transaction('logos',mode), request = operation(tx.objectStore('logos'));
      tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    }); } finally { database.close(); }
  };
  const ready = transact('readonly',store=>store.getAll()).then(items=>{library=items;}).catch(()=>{});
  function textLogo(color, text = 'ZhenTalent') {
    const canvas=document.createElement('canvas'); canvas.width=650; canvas.height=130;
    const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.font='bold 104px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,325,68,640);
    return canvas.toDataURL('image/png');
  }
  const tinted = new Map(), pendingTints = new Set();
  function tint(src,color) {
    const key=src+color;
    if(tinted.has(key)) return tinted.get(key) || src;
    tinted.set(key,null);
    const img=new Image();
    let done;const pending=new Promise(resolve=>{done=resolve;});pendingTints.add(pending);
    const finish=()=>{pendingTints.delete(pending);done();};
    img.onerror=finish;
    img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,c.width,c.height);tinted.set(key,c.toDataURL('image/png'));finish();redraw();};
    img.src=src;return src;
  }
  function resolve(page,tone) {
    const cover=page.classList.contains('cover-page');
    const id=cover && settings.cover!=='same' ? settings.cover : settings.body;
    if(id==='none') return {src:null,name:'不显示',width:0};
    const item=library.find(item=>item.id===id) || builtins[id] || builtins.signal;
    let src=item[tone] || item.black || item.white;
    if(settings.colorMode==='custom' && /^#[0-9a-f]{6}$/i.test(settings.color||'')) {
      src=id==='jobs'||id==='talent' ? textLogo(settings.color,item.name) : tint(src,settings.color);
    }
    let width=(cover && page.querySelector('.cover-talent-signal-logo') ? 1080 : 330)*settings.size/100;
    width=Math.min(width,cover && page.querySelector('.cover-talent-signal-logo') ? 1080 : 960);
    const dims=item.dimensions?.[tone] || item.dimensions?.black || item.dimensions?.white;
    if(dims) width=Math.min(width,(cover?260:150)*dims[0]/dims[1]);
    return {src,name:item.name,width};
  }
  function apply(page,tone) {
    const spec=resolve(page,tone), logo=page.querySelector('.cover-talent-signal-logo') || page.querySelector('.logo-image');
    page.dataset.brandWidth=spec.width; page.dataset.brandName=spec.name;
    if(!logo) return;
    logo.hidden=!spec.src;
    if(spec.src) logo.src=spec.src; else logo.removeAttribute('src');
    logo.alt=spec.name;logo.style.width=spec.width+'px';logo.style.height='auto';
    if(logo.classList.contains('cover-talent-signal-logo')) logo.style.left=(1080-spec.width)/2+'px';
  }
  function init(black,white,render) {
    redraw=render; builtins={signal:{name:'Talent Signal',black,white},talent:{name:'ZhenTalent',black:textLogo('#111111'),white:textLogo('#ffffff')},jobs:{name:'Z Jobs',black:textLogo('#111111','Z Jobs'),white:textLogo('#ffffff','Z Jobs')}};
    const panel=document.createElement('div');panel.className='group';panel.id='footerBrandPanel';
    panel.innerHTML='<span class="label">底部标识</span><label for="footerChoice">整篇标识</label><select id="footerChoice"></select><label for="coverFooterChoice">封面标识</label><select id="coverFooterChoice"></select><label for="footerSize">标识大小</label><div class="row"><input id="footerSize" type="range" min="50" max="180" step="5"><output id="footerSizeValue"></output></div><details class="settings-fold"><summary>添加自定义标识</summary><label for="logoName">名称</label><input id="logoName" type="text" placeholder="例如：新栏目"><label for="logoBlack">深色 Logo（用于浅底，PNG）</label><input id="logoBlack" type="file" accept="image/png"><label for="logoWhite">浅色 Logo（用于深底，PNG，可选）</label><input id="logoWhite" type="file" accept="image/png"><p class="hint">至少上传一个版本，建议透明背景。只有一个版本时，两种底色共用。标识保存在当前浏览器。</p><button type="button" class="action" id="saveLogo">保存并使用</button><p class="hint" role="status" id="logoStatus"></p></details>';
    document.querySelector('.controls').append(panel);
    const colors=document.createElement('div');
    colors.innerHTML='<label for="footerColorMode">标识颜色</label><select id="footerColorMode"><option value="auto">自动（随深浅背景）</option><option value="custom">自定义颜色</option></select><div class="row"><input type="color" id="footerColor" value="#ff8254"><input type="text" id="footerColorHex" value="#FF8254" maxlength="7" aria-label="标识颜色 HEX"></div><button type="button" id="footerOrange">封面橙色 #FF8254</button><p class="hint">自定义颜色会将标识转为单色；不会改动封面文字。</p>';
    panel.insertBefore(colors,document.getElementById('footerSize').previousElementSibling);
    const $=id=>document.getElementById(id);
    const choices=()=>{
      for(const [id,selected] of [['footerChoice',settings.body],['coverFooterChoice',settings.cover]]) {
        const select=$(id);select.replaceChildren();
        const items=[...(id==='coverFooterChoice'?[{id:'same',name:'跟随整篇'}]:[]),{id:'signal',name:'Talent Signal'},{id:'talent',name:'ZhenTalent'},{id:'jobs',name:'Z Jobs'},{id:'none',name:'不显示'},...library];
        items.forEach(item=>select.add(new Option(item.name,item.id)));
        select.value=items.some(item=>item.id===selected)?selected:(id==='coverFooterChoice'?'same':'signal');
      }
      $('footerSize').value=settings.size;$('footerSizeValue').textContent=settings.size+'%';
      syncColor();
    };
    const persist=()=>{try {localStorage.setItem(KEY,JSON.stringify(settings));}catch {$('logoStatus').textContent='本机存储不足，当前选择未保存。';} redraw();window.dispatchEvent(new Event('studiochange'));};
    function syncColor(){ $('footerColorMode').value=settings.colorMode||'auto';$('footerColor').value=settings.color||'#ff8254';$('footerColorHex').value=(settings.color||'#ff8254').toUpperCase(); }
    const setColor=color=>{if(!/^#[0-9a-f]{6}$/i.test(color))return;settings.color=color;settings.colorMode='custom';syncColor();persist();};
    $('footerColorMode').onchange=e=>{settings.colorMode=e.target.value;settings.color=settings.color||'#ff8254';persist();};
    $('footerColor').oninput=e=>setColor(e.target.value);
    $('footerColorHex').onchange=e=>{setColor(e.target.value.trim());syncColor();};
    $('footerOrange').onclick=()=>setColor('#ff8254');
    $('footerChoice').onchange=e=>{settings.body=e.target.value;persist();};
    $('coverFooterChoice').onchange=e=>{settings.cover=e.target.value;persist();};
    $('footerSize').oninput=e=>{settings.size=Number(e.target.value);$('footerSizeValue').textContent=settings.size+'%';persist();};
    const read=async(file)=>{
      if(!file)return null;
      if(file.type!=='image/png'||file.size>5*1024*1024)throw Error('请上传不超过 5 MB 的 PNG 图片。');
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);});
      const image=new Image();image.src=src;await image.decode();return {src,dimensions:[image.naturalWidth,image.naturalHeight]};
    };
    $('saveLogo').onclick=async()=>{
      const name=$('logoName').value.trim();if(!name){$('logoStatus').textContent='请填写标识名称。';return;}
      $('saveLogo').disabled=true;
      try {
        const [black,white]=await Promise.all([read($('logoBlack').files[0]),read($('logoWhite').files[0])]);
        if(!black&&!white)throw Error('请至少上传一个 PNG 版本。');
        const item={id:'custom-'+crypto.randomUUID(),name,black:black?.src,white:white?.src,dimensions:{black:black?.dimensions,white:white?.dimensions}};
        await transact('readwrite',store=>store.put(item));library.push(item);settings.body=item.id;choices();persist();
        $('logoStatus').textContent='已保存并应用，可在标识列表中重复使用。';
        $('logoName').value='';$('logoBlack').value='';$('logoWhite').value='';
      }catch(error){$('logoStatus').textContent=error.message||'保存失败，请重试。';}finally{$('saveLogo').disabled=false;}
    };
    choices();ready.then(()=>{choices();redraw();});
  }
  window.FooterBrand={init,apply,resolve,ready,
    prepare:()=>Promise.all([...pendingTints]),
    getProject:()=>JSON.parse(JSON.stringify({settings,library})),
    async setProject(value){
      settings={...value.settings,cover:'same'}; library=value.library;
      const select=document.getElementById('footerChoice');
      select.replaceChildren(...[{id:'signal',name:'Talent Signal'},{id:'talent',name:'ZhenTalent'},{id:'jobs',name:'Z Jobs'},{id:'none',name:'不显示'},...library].map(i=>new Option(i.name,i.id)));
      select.value=settings.body;
      document.getElementById('footerSize').value=settings.size;
      document.getElementById('footerSizeValue').textContent=settings.size+'%';
      document.getElementById('footerColorMode').value=settings.colorMode||'auto';
      document.getElementById('footerColor').value=settings.color||'#ff8254';
      document.getElementById('footerColorHex').value=(settings.color||'#ff8254').toUpperCase();
      redraw();
    }
  };
})();
