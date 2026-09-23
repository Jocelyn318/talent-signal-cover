(() => {
  'use strict';
  const $=id=>document.getElementById(id), C=window.StudioCore;
  let cover,body,ready=false,busy=false,lastSaved='',timer,db,urls=[],storageBroken=false;
  const status=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
  const snapshot=()=>({kind:'talent-signal-studio',schemaVersion:1,name:$('name').value,coverRatio:$('ratio').value,cover:cover.getProject(),body:body.getProject()});
  const filename=()=>($('name').value||'Talent-Signal').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-');
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function setBusy(value){busy=value;$('workspace').inert=value;for(const el of document.querySelectorAll('header button,#name,#ratio,#refresh,#download'))el.disabled=value||!ready;}
  function connectDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('talent-signal-studio-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('请关闭旧工作台后重试'));});}
  function store(mode,operation){return new Promise((resolve,reject)=>{const tx=db.transaction('projects',mode),r=operation(tx.objectStore('projects'));tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function autosave(){
    if(!ready||busy||storageBroken)return;
    const project=snapshot(),serialized=JSON.stringify(project);if(serialized===lastSaved){if($('status').textContent.startsWith('有修改'))status('已自动保存到此浏览器');return;}
    try{await store('readwrite',s=>s.put(project,'current'));lastSaved=serialized;status('已自动保存到此浏览器');}
    catch(e){storageBroken=true;status('自动保存失败，请点击「保存项目」下载备份',true);}
  }
  function changed(){if(!ready||busy)return;clearTimeout(timer);status('有修改 · 正在保存…');timer=setTimeout(autosave,600);}
  async function applyProject(raw){
    if(raw?.schemaVersion===1&&raw?.layers&&raw?.canvas){await cover.setProject(raw);return;}
    const valid=C.validateProject(raw);
    $('cover').contentWindow.TalentSignalRenderer.validateProject(valid.cover);
    const old=snapshot();
    try{await cover.setProject(valid.cover);await body.setProject(valid.body);$('name').value=valid.name;$('ratio').value=valid.coverRatio;body.setRatio(valid.coverRatio);$('cover').contentDocument.getElementById(valid.coverRatio==='3:4'?'crop':'full').click();}
    catch(e){await cover.setProject(old.cover);await body.setProject(old.body);throw e;}
  }
  function canvasBlob(canvas,mime){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('封面编码失败')),mime,.96));}
  async function *entries(scope,mime){let n=1;const ext=mime==='image/jpeg'?'jpg':'png';
    if(scope!=='body'){yield {name:'01-封面.'+ext,blob:await canvasBlob(cover.exportCanvas($('ratio').value),mime)};n++;}
    if(scope!=='cover'){for await(const blob of body.exportBlobs(mime)){status('正在渲染第 '+n+' 张…');yield {name:String(n++).padStart(2,'0')+'-正文.'+ext,blob};}}
  }
  async function preview(){
    if(busy||!ready)return;setBusy(true);urls.forEach(URL.revokeObjectURL);urls=[];$('gallery').replaceChildren();
    try{
      if(!cover.getProject().background.src){const p=document.createElement('p');p.className='empty';p.textContent='封面尚未上传背景。请在「封面」中编辑；正文仍可单独导出。';$('gallery').append(p);}
      const scope=cover.getProject().background.src?'all':'body';
      for await(const entry of entries(scope,'image/png')){
        const bitmap=await createImageBitmap(entry.blob),canvas=document.createElement('canvas');canvas.width=360;canvas.height=Math.round(bitmap.height*360/bitmap.width);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
        const url=URL.createObjectURL(await canvasBlob(canvas,'image/png'));urls.push(url);
        const figure=document.createElement('figure'),img=new Image(),caption=document.createElement('figcaption');img.src=url;img.alt=entry.name;caption.textContent=entry.name;figure.append(img,caption);$('gallery').append(figure);
      }status('预览已更新 · 封面与正文比例一致');
    }catch(e){status('预览失败：'+e.message,true);}finally{setBusy(false);changed();}
  }
  function tab(id){
    if(busy)return;
    document.querySelectorAll('.panel').forEach(p=>{p.classList.toggle('active',p.id===id);p.inert=p.id!==id;});
    document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===id)));
    if(id==='body'&&body)body.refresh();if(id==='preview')preview();
  }
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  $('refresh').onclick=preview;
  $('save').onclick=()=>{if(!ready||busy)return;download(new Blob([JSON.stringify(snapshot())],{type:'application/json'}),filename()+'.ts-project.json');status('整篇项目已下载（含封面、正文和图片）');};
  $('open').onclick=()=>$('file').click();
  $('file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||busy)return;
    if(file.size>150*1024*1024){status('项目超过 150 MB',true);return;}
    if(!confirm('载入项目会替换当前内容。未下载的版本请先保存；是否继续？'))return;
    setBusy(true);
    try{await applyProject(JSON.parse(await file.text()));status('项目已载入');}
    catch(err){status('未载入：'+err.message+'。当前项目保留。',true);}
    finally{setBusy(false);changed();}
  };
  $('name').oninput=changed;$('ratio').onchange=()=>{body.setRatio($('ratio').value);$('cover').contentDocument.getElementById($('ratio').value==='3:4'?'crop':'full').click();changed();status('比例已更新 · 请检查分页及封面中央裁切');if($('preview').classList.contains('active'))preview();};
  $('export').onclick=()=>{$('exportDialog').showModal();};
  $('scope').onchange=()=>{};
  $('download').onclick=async()=>{if(busy)return;setBusy(true);const dialog=$('exportDialog');dialog.oncancel=e=>e.preventDefault();dialog.querySelectorAll('button,select').forEach(x=>x.disabled=true);
    try{const scope=$('scope').value,mime=$('format').value;
      if(scope==='cover'){for await(const entry of entries(scope,mime))download(entry.blob,filename()+'-'+entry.name);}
      else download(await C.zip(entries(scope,mime)),filename()+'.zip');
      dialog.close();status('导出完成 · 文件已下载');
    }catch(e){status('导出失败：'+e.message,true);}
    finally{dialog.oncancel=null;dialog.querySelectorAll('button,select').forEach(x=>x.disabled=false);setBusy(false);}
  };
  function shortcut(e){if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();}}
  document.addEventListener('keydown',shortcut);
  window.addEventListener('beforeunload',e=>{if(ready&&JSON.stringify(snapshot())!==lastSaved){e.preventDefault();e.returnValue='';}});
  async function waitApi(frame,key){for(let i=0;i<600;i++){const api=frame.contentWindow?.[key];if(api?.ready){const result=await api.ready;if(result?.fontError)throw Error(result.fontError);return api;}await new Promise(r=>setTimeout(r,100));}throw Error('编辑器加载超时，请刷新页面');}
  (async()=>{
    try{
      [cover,body]=await Promise.all([waitApi($('cover'),'coverEditor'),waitApi($('body'),'bodyEditor')]);
      try{db=await connectDb();const saved=await store('readonly',s=>s.get('current'));if(saved)await applyProject(saved);}
      catch(e){storageBroken=true;status('草稿恢复不可用：'+e.message+'；请用项目文件保存',true);}
      body.setRatio($('ratio').value);$('cover').contentDocument.getElementById($('ratio').value==='3:4'?'crop':'full').click();ready=true;lastSaved=storageBroken?'':JSON.stringify(snapshot());setBusy(false);
      if(!storageBroken)status('已就绪 · 自动保存在此浏览器');
      for(const id of ['cover','body']){$(id).contentWindow.addEventListener('studiochange',changed);$(id).contentDocument.addEventListener('keydown',shortcut);}
      // Catch programmatic changes / undo as well as UI events, without modifying the cover engine.
      setInterval(autosave,2500);
      window.studio={getProject:snapshot,applyProject:async raw=>{if(busy)throw Error('正在处理');setBusy(true);try{await applyProject(raw);}finally{setBusy(false);changed();}},exportEntries:entries,ready:true};
    }catch(e){status('加载失败：'+e.message,true);}
  })();
})();
