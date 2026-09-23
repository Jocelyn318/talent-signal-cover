(() => {
  const selectPages = (pages, scope = 'all') => pages.filter(page => scope === 'all' || page.classList.contains('cover-page') === (scope === 'cover'));
  window.EditorWorkspace = { selectPages, createHistory, toggleFormat, init };
  function toggleFormat(value, start, end, action) {
    const replace = (from, to, text, left = 0, right = text.length) => ({value:value.slice(0, from) + text + value.slice(to), start:from + left, end:from + right});
    const prefixes = {h1:'# ', h2:'## ', quote:'> ', list:'- '};
    if (prefixes[action]) {
      const from = value.lastIndexOf('\n', start - 1) + 1;
      let to = value.indexOf('\n', end > start && value[end - 1] === '\n' ? end - 1 : end);
      if (to < 0) to = value.length;
      const lines = value.slice(from, to).split('\n'), prefix = prefixes[action];
      const remove = lines.every(line => !line.trim() || line.startsWith(prefix));
      const pattern = action === 'h1' || action === 'h2' ? /^#{1,3}\s+/ : action === 'quote' ? /^>\s?/ : /^[-*+]\s+/;
      const text = lines.map(line => remove ? (line.startsWith(prefix) ? line.slice(prefix.length) : line) : prefix + line.replace(pattern, '')).join('\n');
      return replace(from, to, text);
    }
    const markers = {bold:'**', underline:'__', highlight:'==', 'small-muted':'^^'};
    const marker = markers[action];
    if (!marker) return null;
    const selected = value.slice(start, end), n = marker.length;
    if (selected.length >= n * 2 && selected.startsWith(marker) && selected.endsWith(marker)) return replace(start,end,selected.slice(n,-n));
    // Find the formatted span containing the selection or caret.
    let cursor = 0;
    while (cursor < value.length) {
      const open = value.indexOf(marker,cursor);
      if (open < 0) break;
      const close = value.indexOf(marker,open+n);
      if (close < 0) break;
      if (start >= open+n && end <= close) return replace(open,close+n,value.slice(open+n,close),start-open-n,end-open-n);
      cursor = close+n;
    }
    const text = selected || ({bold:'加粗文字',underline:'下划线文字',highlight:'高亮文字','small-muted':'小灰字'}[action]);
    return replace(start,end,marker+text+marker,n,n+text.length);
  }
  function createHistory(initial) {
    let states = [{...initial}], index = 0, lastKind = '', lastTime = 0;
    return {
      get canUndo() { return index > 0; },
      get canRedo() { return index < states.length - 1; },
      capture(state) {
        if (state.value === states[index].value) {
          if (state.start !== states[index].start || state.end !== states[index].end) lastKind = '';
          states[index] = {...state};
        }
      },
      record(state, kind = '', time = Date.now()) {
        if (state.value === states[index].value) return;
        const merge = kind && kind === lastKind && time - lastTime < 700 && index > 0 && index === states.length - 1;
        states = states.slice(0, index + 1);
        if (merge) states[index] = {...state};
        else { states.push({...state}); index++; }
        if (states.length > 100) { states.shift(); index--; }
        lastKind = kind; lastTime = time;
      },
      undo() { lastKind = ''; return index > 0 ? {...states[--index]} : null; },
      redo() { lastKind = ''; return index < states.length - 1 ? {...states[++index]} : null; }
    };
  }
  function init({ getBodyBackground, setBodyBackground, render, fitPreview, flush, exportPages, insert, format }) {
    const $ = id => document.getElementById(id);
    let mode = 'body';
    const controls = document.querySelector('.controls');
    const groupOf = id => $(id).closest('.group');
    const bodyGroup = groupOf('text');
    const coverGroup = groupOf('coverTitle');
    bodyGroup.dataset.workspace = 'body';
    coverGroup.dataset.workspace = 'cover';
    groupOf('fs').dataset.workspace = 'body';
    groupOf('customTextColor').dataset.workspace = 'body';
    const fold = (group, title, open = false) => {
      const details = document.createElement('details');
      details.className = 'settings-fold'; details.open = open;
      const summary = document.createElement('summary'); summary.textContent = title;
      details.append(summary);
      const label = group.querySelector(':scope > .label');
      if (label) label.remove();
      while (group.firstChild) details.append(group.firstChild);
      group.append(details);
      return details;
    };
    fold(groupOf('customTextColor'), '颜色与对齐');
    if (groupOf('archiveNum') !== coverGroup) fold(groupOf('archiveNum'), '高级设置 · 系列编号');
    fold(groupOf('clearDraft'), '草稿管理');
    groupOf('clearDraft').before(document.getElementById('footerBrandPanel'));
    if (groupOf('archiveNum') !== coverGroup) { const hint = groupOf('archiveNum').querySelector('.hint'); if(hint) hint.remove(); }
    groupOf('export').hidden = true;
    const layoutGroup = groupOf('fs');
    const backgroundGroup = document.createElement('div');
    backgroundGroup.className = 'group'; backgroundGroup.dataset.workspace = 'body';
    backgroundGroup.innerHTML = '<label class="label" for="bodyBackground">正文底图</label><select id="bodyBackground"><option value="dark">深色磨砂</option><option value="paper">浅色纸纹</option></select>';
    bodyGroup.after(backgroundGroup);
    $('bodyBackground').onchange = event => setBodyBackground(event.target.value);
    layoutGroup.querySelector('.label').textContent = '正文样式';
    const fine = document.createElement('details'); fine.className = 'settings-fold';
    fine.innerHTML = '<summary>精细排版</summary>';
    ['ls','pg','weightSeg','vAlignSeg'].forEach(id => fine.append($(id).closest('.row')));
    layoutGroup.append(fine);
    const coverFine = document.createElement('details'); coverFine.className = 'settings-fold';
    coverFine.innerHTML = '<summary>文字与参考框设置</summary>';
    ['coverEnglishLetterSpacing','coverChineseAlignSeg','coverTitleSize','coverTitlePosY','coverIssueSize','coverTextGroupY','coverGuideSeg'].forEach(id => { const row = $(id)?.closest('.row'); if (row) coverFine.append(row); });
    coverGroup.append(coverFine);
    coverGroup.querySelector('.label').textContent = '封面内容';
    const coverHint = coverGroup.querySelector(':scope > .hint');
    if (coverHint) coverHint.textContent = '上传图片后调整取景。展开下方设置可微调文字；参考框仅用于预览，不会导出。';
    bodyGroup.querySelector('.label').textContent = '编写正文';
    $('text').setAttribute('aria-label', '正文内容');
    $('coverEnglishName').setAttribute('aria-label', '封面姓名');
    $('coverIdentity').setAttribute('aria-label', '封面身份');
    $('coverTitle').setAttribute('aria-label', '封面标题');
    const oldHint = bodyGroup.querySelector('.hint');
    oldHint.textContent = '选中文字后点击工具即可设置格式。空行分段，一级标题另起一页。';
    const help = document.createElement('details'); help.className = 'settings-fold markdown-help';
    help.innerHTML = '<summary>Markdown 写法与使用提示</summary><p class="hint">支持粘贴 Markdown。**加粗**、==高亮==、++下划线++。上传图片后会插入图片标记，保留标记即可保留图片。单次回车换行，空行新建段落。可使用“分页”指定下一页开始的位置。</p>';
    bodyGroup.append(help);
    const toolbar = $('markdownToolbar');
    toolbar.insertAdjacentHTML('beforeend', '<button type="button" id="insertPageBreak" title="在光标处另起一页">分页</button>');
    const text = $('text');
    const snapshot = () => ({value:text.value, start:text.selectionStart, end:text.selectionEnd});
    let history = createHistory(snapshot()), composing = false, compositionPending = false, compositionTimer;
    const record = (kind = '') => { history.record(snapshot(), kind); };
    const finishComposition = () => {
      if (!compositionPending) return;
      clearTimeout(compositionTimer); compositionPending = false; composing = false; record();
    };
    const restoreHistory = redo => {
      finishComposition();
      if (composing) return;
      const state = redo ? history.redo() : history.undo();
      if (!state) return;
      text.value = state.value; text.focus(); text.setSelectionRange(state.start, state.end);
      render(); text.dispatchEvent(new Event('change', {bubbles:true}));
    };
    window.EditorWorkspace.beforeBodyEdit = () => { finishComposition(); history.capture(snapshot()); };
    window.EditorWorkspace.afterBodyEdit = () => record();
    window.EditorWorkspace.resetHistory = () => { history = createHistory(snapshot()); };
    text.addEventListener('beforeinput', event => {
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); restoreHistory(event.inputType === 'historyRedo'); }
      else if (!composing && !event.isComposing) history.capture(snapshot());
    });
    text.addEventListener('input', event => { if (!composing && !event.isComposing) record(event.inputType === 'insertText' ? 'typing' : ''); });
    text.addEventListener('compositionstart', () => { history.capture(snapshot()); composing = true; });
    text.addEventListener('compositionend', () => {
      // Some IMEs commit their final input after compositionend. Never retain
      // the temporary phonetic text as an undo state.
      compositionPending = true;
      compositionTimer = setTimeout(finishComposition, 0);
    });
    text.addEventListener('keydown', event => {
      finishComposition();
      if (event.isComposing || composing || event.altKey) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); restoreHistory(event.shiftKey);
      }
    });
   
    $('insertPageBreak').onclick = () => insert($('text'), '<!-- pagebreak -->');
    toolbar.addEventListener('mousedown', event => { if(event.target.closest('button')) event.preventDefault(); });
    $('text').addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && ['b','u'].includes(event.key.toLowerCase())) {
        event.preventDefault(); format(event.key.toLowerCase() === 'b' ? 'bold' : 'underline');
      }
    });
    const header = document.querySelector('.app-bar');
    header.querySelector('h1').innerHTML = 'Talent Signal<span>长图文工作台</span>';
    header.insertAdjacentHTML('beforeend', '<nav class="workspace-tabs" aria-label="编辑模式"><button type="button" data-mode="cover" aria-pressed="false">封面</button><button type="button" data-mode="body" aria-pressed="true">正文</button></nav><button type="button" class="workspace-export" id="openExport">导出图片 ↗</button>');
    const stage = document.querySelector('.stage');
    stage.insertAdjacentHTML('afterbegin','<div class="workspace-stage-bar"><span id="workspaceLabel">正文预览</span><span id="workspaceCount"></span></div><div class="cover-empty" id="coverEmpty" hidden><span class="empty-symbol">＋</span><h2>从一张封面开始</h2><p>在左侧填写标题或上传图片，即可创建封面。<br>正文会完整保留，随时可以切换。</p><button type="button" id="startCover">填写封面标题</button></div>');
    $('startCover').onclick = () => $('coverTitle').focus();
    const dialog = document.createElement('dialog'); dialog.id = 'exportDialog';
    dialog.innerHTML = '<form method="dialog"><div class="dialog-heading"><h2>导出图片</h2><button aria-label="关闭导出窗口" value="cancel">×</button></div><p class="hint">每页 2160 × 3600，按顺序分别下载。</p><label for="exportScope">导出范围</label><select id="exportScope"><option value="all">完整稿件（封面 + 正文）</option><option value="cover">仅封面</option><option value="body">仅正文</option></select><label for="exportFormat">图片格式</label><select id="exportFormat"><option value="image/jpeg">JPG · 适合发布</option><option value="image/png">PNG · 无损画质</option></select><p class="hint" id="exportSummary" aria-live="polite"></p><button type="button" class="workspace-export" id="downloadSelection">开始下载</button></form>';
    document.body.append(dialog);
    const pages = () => [...document.querySelectorAll('.poster-page')];
    const refreshExport = () => {
      const count = selectPages(pages(), $('exportScope').value).length;
      $('exportSummary').textContent = count ? `将下载 ${count} 张图片；多页时请允许浏览器下载多个文件。` : '当前范围没有页面，请先添加内容。';
      $('downloadSelection').disabled = !count;
    };
    $('openExport').onclick = () => {flush(); refreshExport(); dialog.showModal();};
    $('exportScope').onchange = refreshExport;
    $('downloadSelection').onclick = async () => {
      dialog.querySelectorAll('button, select').forEach(el => el.disabled = true);
      header.inert = true; document.querySelector('.layout').inert = true;
      dialog.oncancel = event => event.preventDefault();
      try {await exportPages($('exportFormat').value, $('downloadSelection'), $('exportScope').value);}
      finally {
        header.inert = false; document.querySelector('.layout').inert = false;
        dialog.oncancel = null;
        dialog.querySelectorAll('button, select').forEach(el => el.disabled = false);
        refreshExport();
      }
    };
    const sync = () => {
      document.body.dataset.mode = mode;
      $('bodyBackground').value = getBodyBackground();
      document.querySelectorAll('[data-workspace]').forEach(el => el.hidden = el.dataset.workspace !== mode);
      const visible = selectPages(pages(), mode);
      $('coverEmpty').hidden = mode !== 'cover' || visible.length > 0;
      $('workspaceLabel').textContent = mode === 'cover' ? '封面预览' : '正文预览';
      $('workspaceCount').textContent = `${visible.length} 页 · 自动保存到本机`;
      document.querySelectorAll('[data-mode]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.mode === mode)));
      fitPreview();
    };
    document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
      flush(); mode = 'body'; sync(); render();
      controls.scrollTop = 0; stage.scrollTop = 0;
    });
    window.EditorWorkspace.sync = sync;
    // The studio owns all navigation and exports. Retired cover UI cannot be reached.
    header.hidden = true;
    groupOf('clearDraft').hidden = true;
    const studioStyle=document.createElement('style');studioStyle.textContent='.app-bar,[data-workspace="cover"],#coverEmpty,#clearDraft,#coverFooterChoice,label[for="coverFooterChoice"]{display:none!important}.layout{height:100vh!important}.cover-page{display:none!important}';document.head.append(studioStyle);
    document.querySelectorAll('[data-workspace="cover"], #coverEmpty, #exportDialog, #clearDraft').forEach(el=>el.hidden=true);
    document.getElementById('coverFooterChoice').hidden = true;
    document.querySelector('label[for="coverFooterChoice"]').hidden = true;
    sync();
  }
})();
