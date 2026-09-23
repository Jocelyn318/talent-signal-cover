// The existing cover renderer is unchanged; only navigation/save ownership moves up.
document.querySelector('header').hidden = true;
const style=document.createElement('style');style.textContent='header[hidden]{display:none!important}main{min-height:100vh}aside{max-height:100vh}';document.head.append(style);
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase()==='s') {
    event.preventDefault(); event.stopImmediatePropagation();
    window.parent.document.getElementById('save').click();
  }
}, true);
for (const type of ['input','change','pointerup','click']) document.addEventListener(type,()=>{
  window.dispatchEvent(new Event('studiochange'));
});
