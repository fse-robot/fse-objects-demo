/* ── Блок 15. Оповещения «вас ждут» — колокольчик в шапке (#256) ───────
   В ящик падает только то, где от этой учётной записи зависит чужая
   работа: куратор нужен приёмке, исполнителю нужен ответ по объёму,
   администратору — человек без роли. Журналом всего подряд колокольчик
   не становится: это решает сервер, здесь только показ.

   Ссылка ведёт в то место, где действие и делается, а не в раздел:
   нажатие повторяет путь человека — раздел, вкладка, карточка, — поэтому
   открывается не своим кодом, а нажатиями по готовым узлам.

   Своих узлов два: сам колокольчик со счётчиком и выпадающий список.
   Оба описаны в docs/guides/design-language.md. */
(function(){
if(window.__bellV1)return; window.__bellV1=true;

var API='/montazh/api';
var EVERY=60000;          /* как часто спрашивать счётчик */
var N={items:null,unread:0,open:false,busy:false};

function $(s){return document.querySelector(s);}
function sess(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}}
function E(s){return (typeof esc==='function')?esc(s):String(s==null?'':s)
  .replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

async function api(path,opts){
  opts=opts||{};
  opts.headers=Object.assign({'X-FSE-Session':sess()},opts.headers||{});
  var r=await fetch(API+'/notify'+path,opts);
  var t=await r.text(); var d=null; try{d=t?JSON.parse(t):null}catch(e){}
  if(!r.ok)throw new Error((d&&d.detail)||('Ошибка '+r.status));
  return d;
}

/* Когда. Сегодняшнее время читается как время, вчерашнее — как «вчера»,
   остальное датой: в списке важен не час недельной давности, а день. */
function when(iso){
  var d=new Date(iso); if(isNaN(d))return '';
  var hm=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  var today=new Date(); today.setHours(0,0,0,0);
  var day=new Date(d); day.setHours(0,0,0,0);
  var diff=Math.round((today-day)/86400000);
  if(diff<=0)return hm;
  if(diff===1)return 'вчера '+hm;
  return d.toLocaleDateString('ru-RU');
}

function counter(){
  var b=document.getElementById('bellN'); if(!b)return;
  b.textContent=N.unread>99?'99+':String(N.unread);
  b.style.display=N.unread?'':'none';
}

function render(){
  var box=document.getElementById('bellList'); if(!box)return;
  var head='<div class="bh"><b>Оповещения</b>'
    +(N.unread?'<button class="btn sm ghost" data-act="nt-all" title="Отметить все прочитанными">'
      +'<span class="lbl">Прочитано всё</span></button>':'')+'</div>';
  if(N.items===null){box.innerHTML=head+'<div class="emp">Загружаю…</div>';return;}
  if(!N.items.length){
    box.innerHTML=head+'<div class="emp">Вас никто не ждёт — здесь пусто</div>';return;}
  box.innerHTML=head+N.items.map(function(it){
    return '<button class="bi'+(it.read?' read':'')+'" data-act="nt-open" data-id="'+it.id+'"'
      +' data-link="'+E(it.link||'')+'" title="'+E(it.title)+'">'
      +'<div class="t">'+E(it.title)+'</div>'
      +(it.body?'<div class="d">'+E(it.body)+'</div>':'')
      +'<div class="w">'+E(when(it.at))+'</div></button>';
  }).join('');
}

async function loadCount(){
  if(!sess())return;
  try{var d=await api('/count'); N.unread=d.unread||0; counter();}catch(e){}
}

async function loadList(){
  if(N.busy)return; N.busy=true;
  try{var d=await api(''); N.items=d.items||[]; N.unread=d.unread||0;}
  catch(e){N.items=[];}
  finally{N.busy=false; counter(); render();}
}

function close(){
  N.open=false;
  var box=document.getElementById('bellList'); if(box)box.style.display='none';
  var b=document.getElementById('bellBtn'); if(b)b.setAttribute('aria-expanded','false');
}

function open(){
  N.open=true;
  var rl=document.getElementById('roleList'); if(rl)rl.style.display='none';
  var box=document.getElementById('bellList'); if(box)box.style.display='';
  var b=document.getElementById('bellBtn'); if(b)b.setAttribute('aria-expanded','true');
  render(); loadList();
}

/* Ждём узел, которого ещё нет: раздел и вкладка перерисовывают себя после
   ответа сервера, и нажать по карточке объекта раньше этого нельзя. */
function waitFor(sel,fn,tries){
  var left=tries||30;
  (function tick(){
    var el=document.querySelector(sel);
    if(el)return fn(el);
    if(--left>0)setTimeout(tick,150);
  })();
}

function openTarget(link){
  var p=String(link||'').split('/');
  if(p[0]==='settings'){if(window.go)window.go('settings');return;}
  // Заявка заказчика (#454): to/site/<id> — карточка объекта в «Обслуживании».
  if(p[0]==='to'){
    if(window.go)window.go('to');
    var sid=String(p[2]||'').replace(/\D/g,'');
    if(p[1]==='site'&&sid)
      waitFor('#toView [data-to="site"][data-id="'+sid+'"]',function(c){c.click();});
    // Чат отдела (#548): to/chat — вкладка «Чат» у менеджера, кнопка чата у инженера.
    if(p[1]==='chat')
      waitFor('#toView [data-t="chat"]',function(c){if(!c.classList.contains('on'))c.click();});
    return;
  }
  if(p[0]!=='shift')return;
  if(window.go)window.go('shift');
  var tab=p[1]==='obj'?'obj':p[1];
  waitFor('.stab[data-t="'+tab+'"]',function(b){
    if(!b.classList.contains('on'))b.click();
    if(p[1]!=='obj'||!p[2])return;
    var uid=String(p[2]).replace(/["\\]/g,'');
    waitFor('[data-act="sh-obj"][data-uid="'+uid+'"]',function(row){
      if(!row.classList.contains('open'))row.click();
      row.scrollIntoView({block:'center'});
    });
  });
}

document.addEventListener('click',async function(ev){
  var btn=ev.target.closest('#bellBtn');
  if(btn){ev.preventDefault(); if(N.open)close(); else open(); return;}

  var all=ev.target.closest('[data-act="nt-all"]');
  if(all){
    ev.preventDefault();
    try{await api('/read-all',{method:'POST'});}catch(e){}
    N.unread=0; (N.items||[]).forEach(function(i){i.read=true;});
    counter(); render(); return;
  }

  var it=ev.target.closest('[data-act="nt-open"]');
  if(it){
    ev.preventDefault();
    var id=it.dataset.id, link=it.dataset.link;
    var rec=(N.items||[]).filter(function(x){return String(x.id)===String(id);})[0];
    if(rec&&!rec.read){
      rec.read=true; N.unread=Math.max(0,N.unread-1); counter();
      try{await api('/'+id+'/read',{method:'POST'});}catch(e){}
    }
    close(); openTarget(link); return;
  }

  /* Нажатие мимо закрывает список — как у списка ролей. */
  if(N.open&&!ev.target.closest('#bellList'))close();
});

document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&N.open)close();});

loadCount(); setInterval(loadCount,EVERY);

window.BELL={refresh:loadCount};
})();
