(function(){
var HS={list:null,busy:false};

// esc3 удалён — экранировщик один на файл, esc() из первого блока. Эта копия
// не закрывала апостроф, а v.at попадает в data-at="…" именно в кавычках.

function render(){
  var box=document.getElementById('hsList'); if(!box)return;
  if(HS.list===null){box.innerHTML='<div class="sub" style="padding:16px">Загружаю…</div>';return;}
  if(!HS.list.length){box.innerHTML='<div class="sub" style="padding:16px">'
    +'Журнал пуст. Записи появятся после первой правки.</div>';return;}
  box.innerHTML=HS.list.map(function(v){
    var d='';
    if(v.added)  d+='<span class="plus">+'+esc(v.added)+'</span> ';
    if(v.removed)d+='<span class="minus">−'+esc(v.removed)+'</span>';
    if(!d)d='<span class="s">без изменений</span>';
    return '<div class="hr'+(v.current?' now':'')+'">'
      +'<div class="hn"><div class="t">'+esc(v.at)+(v.current?'  ·  сейчас':'')+'</div>'
      +'<div class="s">'+esc(v.who)+' · позиций '+esc(v.positions)
      +(v.note?(' · '+esc(v.note)):'')+'</div></div>'
      +'<div class="hd">'+d+'</div>'
      +(v.current?'':'<button class="btn sm" data-act="hs-back" data-id="'+esc(v.id)+'" '
        +'data-at="'+esc(v.at)+'" data-n="'+esc(v.positions)+'">Вернуть</button>')
      +'</div>';
  }).join('');
}

function build(){
  if(document.getElementById('hsBox'))return;
  var ov=document.createElement('div'); ov.id='hsOv';
  var b=document.createElement('div'); b.id='hsBox';
  b.innerHTML='<div class="hh"><div class="shtop">'
    +'<button class="btn sm io" id="hsBack" title="Закрыть — к смете">'
    +'<svg class="i"><use href="#i-left"/></svg><span class="lbl">К смете</span></button>'
    +'<h3>История правок</h3></div>'
    +'<div class="sub">Каждая строка — состояние сметы на тот момент. '
    +'«Вернуть» возвращает смету целиком; текущее состояние при этом тоже '
    +'останется в журнале, так что возврат можно отменить.</div></div>'
    +'<div class="hlist" id="hsList"></div>'
    +'<div class="hf"><span class="s" id="hsNote" style="flex:1"></span>'
    +'<button class="btn sm" id="hsClose">Закрыть</button></div>';
  document.body.appendChild(ov); document.body.appendChild(b);
  ov.addEventListener('click',close);
  document.getElementById('hsClose').addEventListener('click',close);
  document.getElementById('hsBack').addEventListener('click',close);
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&b.classList.contains('on'))close();});
}
function open(){ build();
  document.getElementById('hsOv').classList.add('on');
  document.getElementById('hsBox').classList.add('on');
  HS.list=null; render(); load();
  if(window.fseBack)fseBack.open('history',close); }
function close(){ var b=document.getElementById('hsBox'); if(!b)return;
  document.getElementById('hsOv').classList.remove('on'); b.classList.remove('on');
  if(window.fseBack)fseBack.closed('history'); }

async function load(){
  try{ HS.list=await api('/specs/'+curId+'/versions'); }
  catch(e){ HS.list=[]; var n=document.getElementById('hsNote');
            if(n)n.textContent='Не удалось загрузить журнал: '+e.message; }
  render();
}

document.addEventListener('click',async function(ev){
  var el=ev.target.closest('[data-act]'); if(!el)return;
  if(el.dataset.act==='history'){
    if(typeof curId==='undefined'||!curId){ if(window.toast)toast('Откройте смету'); return; }
    ev.preventDefault(); open(); return;
  }
  if(el.dataset.act!=='hs-back')return;
  ev.preventDefault();
  // Возврат к прошлой версии переписывает смету целиком — это правка.
  // Журнал смотреть можно всем, кто видит смету, возвращать — нет.
  if(typeof canEdit==='function'&&!canEdit()){
    if(window.toast)toast('Только просмотр — вернуть версию нельзя');return;}
  if(HS.busy)return;
  var at=el.dataset.at, n=el.dataset.n;
  var okBack=(window.UI&&UI.confirm)
    ? await UI.confirm({title:'Вернуть смету к состоянию от '+at+'?',
        text:'В смете станет позиций: '+n+'.',
        warn:'Текущее состояние останется в журнале — возврат можно отменить.',
        ok:'Вернуть',okIcon:'i-hist'})
    : confirm('Вернуть смету к состоянию от '+at+'? Станет позиций: '+n);
  if(!okBack)return;
  HS.busy=true; el.disabled=true; el.textContent='Возвращаю…';
  try{
    var r=await api('/specs/'+curId+'/versions/'+el.dataset.id+'/restore',{method:'POST'});
    close();
    // Перечитываем смету с сервера, а не собираем из памяти: в памяти
    // лежит то, что мы только что заменили. openSpec идёт на сервер лишь
    // при _meta — после первого открытия он там false, и экран рисовал
    // прежние строки, а следующее автосохранение отправляло их обратно,
    // то есть возврат отменял сам себя.
    var sp=(typeof specs!=='undefined'&&specs)?specs.find(function(x){return x.id===curId;}):null;
    if(sp)sp._meta=true;
    if(typeof openSpec==='function')await openSpec(curId);
    if(window.toast)toast('Вернул: позиций '+r.positions
      +(r.added?(', восстановлено '+r.added):'' ), 4000);
  }catch(e){
    if(window.toast)toast('Не вернулось: '+e.message);
    el.disabled=false; el.textContent='Вернуть';
  }finally{ HS.busy=false; }
});
})();
