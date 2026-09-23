(function () {
  'use strict';
  const W = 1080, H = 1920, IDS = ['title', 'subtitle', 'series'];
  const editable = ['text', 'x', 'y', 'width', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'color', 'align', 'visible', 'locked', 'highlight', 'highlightColor'];
  function assert(value, message) { if (!value) throw new Error(message); }
  function number(value, min, max, name) { assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, name + '超出允许范围'); return value; }
  function color(value) { assert(typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value), '颜色必须为六位十六进制'); return value; }
  function validateProject(raw) {
    assert(raw && typeof raw === 'object' && raw.schemaVersion === 1, '不支持的项目版本');
    assert(raw.canvas && raw.canvas.width === W && raw.canvas.height === H, '画布必须为 1080 × 1920');
    assert(typeof raw.name === 'string' && raw.name.length <= 200, '项目名称无效');
    assert(Array.isArray(raw.layers) && raw.layers.length === 3, '项目需要三个独立文字层');
    const seen = new Set();
    const layers = raw.layers.map(l => {
      assert(l && IDS.includes(l.id) && !seen.has(l.id), '文字层标识无效或重复'); seen.add(l.id);
      assert(typeof l.text === 'string' && l.text.length <= 2000, '文字最多 2000 个字符');
      assert(typeof l.highlight === 'string' && l.highlight.length <= 200, '强调文字最多 200 个字符');
      assert(['TS Sans SC', 'TS Inter'].includes(l.fontFamily), '请使用随包字体');
      assert([400, 700, 900].includes(l.fontWeight), '字重无效');
      assert(['left', 'center', 'right'].includes(l.align), '对齐方式无效');
      assert(typeof l.visible === 'boolean' && typeof l.locked === 'boolean', '图层状态无效');
      return {id:l.id,text:l.text,x:number(l.x,-W,W*2,'横坐标'),y:number(l.y,-H,H*2,'纵坐标'),width:number(l.width,40,W*2,'文字框宽度'),fontSize:number(l.fontSize,12,300,'字号'),fontFamily:l.fontFamily,fontWeight:l.fontWeight,lineHeight:number(l.lineHeight,.8,3,'行距'),color:color(l.color),align:l.align,visible:l.visible,locked:l.locked,highlight:l.highlight,highlightColor:color(l.highlightColor)};
    });
    const b = raw.background;
    assert(b && typeof b.src === 'string', '缺少背景信息');
    assert(b.src === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(b.src), '背景只接受嵌入的 PNG、JPEG 或 WebP，不接受外部链接');
    assert(b.src.length <= 45 * 1024 * 1024, '背景过大，请使用小于 32 MB 的图片');
    const metadata = raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? JSON.parse(JSON.stringify(raw.metadata)) : {};
    return {schemaVersion:1,name:raw.name,canvas:{width:W,height:H},background:{src:b.src,scale:number(b.scale,1,5,'背景缩放'),focusX:number(b.focusX,0,1,'背景横向焦点'),focusY:number(b.focusY,0,1,'背景纵向焦点')},layers,metadata};
  }
  function font(l) { return l.fontWeight + ' ' + l.fontSize + 'px "' + l.fontFamily + '"'; }
  function layout(ctx, l) {
    ctx.font = font(l);
    const lines = []; let chars = [], text = '';
    const flush = () => { lines.push({text,chars,width:ctx.measureText(text).width}); chars=[]; text=''; };
    const tokens = [...l.text.matchAll(/\r?\n|[A-Za-z0-9]+(?:['’._-][A-Za-z0-9]+)*|[^\r\n]/gu)];
    for (const m of tokens) {
      if (/\n/.test(m[0])) { flush(); continue; }
      if (text && ctx.measureText(text + m[0]).width > l.width) flush();
      let offset = 0;
      for (const char of m[0]) {
        if (text && ctx.measureText(text + char).width > l.width) flush();
        chars.push({char,index:m.index+offset}); text += char; offset += char.length;
      }
    }
    flush();
    let ranges=[];
    if (l.highlight) { let at=0; while ((at=l.text.indexOf(l.highlight,at)) !== -1) {ranges.push([at,at+l.highlight.length]);at+=l.highlight.length;} }
    const lineStep=l.fontSize*l.lineHeight;
    const width=Math.max(0,...lines.map(x=>x.width));
    const left=l.align==='center'?l.x+(l.width-width)/2:l.align==='right'?l.x+l.width-width:l.x;
    const height=(lines.length-1)*lineStep+l.fontSize;
    return {id:l.id,lines,ranges,lineStep,bounds:{x:left,y:l.y,width,height},box:{x:l.x,y:l.y,width:l.width,height}};
  }
  function measureLayers(ctx, project) { return project.layers.filter(l=>l.visible).map(l=>layout(ctx,l)); }
  function draw(ctx, project, backgroundImage) {
    ctx.save();ctx.clearRect(0,0,W,H);ctx.fillStyle='#638CAE';ctx.fillRect(0,0,W,H);
    if(backgroundImage){const b=project.background;const s=Math.max(W/backgroundImage.naturalWidth,H/backgroundImage.naturalHeight)*b.scale;const dw=backgroundImage.naturalWidth*s,dh=backgroundImage.naturalHeight*s;ctx.drawImage(backgroundImage,(W-dw)*b.focusX,(H-dh)*b.focusY,dw,dh);}
    const measures=[];
    for(const l of project.layers){if(!l.visible)continue;const item=layout(ctx,l);measures.push(item);ctx.font=font(l);ctx.textAlign='left';ctx.textBaseline='top';
      item.lines.forEach((line,i)=>{let x=l.align==='center'?l.x+(l.width-line.width)/2:l.align==='right'?l.x+l.width-line.width:l.x;let prefix='';
        const runs=[];
        line.chars.forEach(c=>{const color=item.ranges.some(r=>c.index>=r[0]&&c.index<r[1])?l.highlightColor:l.color;const last=runs[runs.length-1];if(last&&last.color===color)last.text+=c.char;else runs.push({color,text:c.char});});
        runs.forEach(run=>{ctx.fillStyle=run.color;ctx.fillText(run.text,x+ctx.measureText(prefix).width,l.y+i*item.lineStep);prefix+=run.text;});
      });
    }
    ctx.restore();return measures;
  }
  function warnings(project, measures) {
    const result=[];const names={title:'主标题',subtitle:'副标题',series:'栏目名'};
    for(const item of measures){const b=item.bounds;const name=names[item.id];if(b.x<0||b.x+b.width>W||b.y<0||b.y+b.height>H)result.push(name+'超出画布');if(b.x<54||b.x+b.width>W-54||b.y<280||b.y+b.height>1640)result.push(name+'超出推荐 3:4 文字安全边距');}
    for(let i=0;i<measures.length;i++)for(let j=i+1;j<measures.length;j++){const a=measures[i].bounds,b=measures[j].bounds;if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)result.push(names[measures[i].id]+'与'+names[measures[j].id]+'可能重叠');}
    return [...new Set(result)];
  }
  window.TalentSignalRenderer={draw,measureLayers,validateProject,warnings,editable,W,H};
})();
