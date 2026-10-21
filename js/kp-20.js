/* ── Блок 20. Общий чат отдела ТО (#548, ADR-0069) ─────────────────────
   Одна лента на компанию, как группа в Telegram: текст и фото, своё
   удаляет автор, любое — тот, кто ведёт обслуживание. Заказчику чата нет.

   Раздел «Обслуживание» (kp-08) рисует экран целиком через innerHTML,
   поэтому чат держит своё состояние здесь и перерисовывает только свой
   узел #toChat: опрос раз в несколько секунд не сбивает набранный текст.
   Новое и удалённое приходит опросом, без WebSocket. Узлы и подписи —
   по макету «Обслуживание», кадры ?board=548. */
(function(){
if(window.__toChatV1)return; window.__toChatV1=true;
var B=window.__kp08a; if(!B)return;
var E=B.E, tapi=B.tapi, jpost=B.jpost, sess=B.sess;

var EVERY=5000;            /* опрос открытого чата */
var UNREAD_EVERY=60000;    /* счётчик на входе, пока чат закрыт */
var C={msgs:null,more:false,err:'',open:false,draft:'',unread:0,urls:{},timer:null,asked:0,
       upto:0,seq:0};

function sent(){return (C.msgs||[]).filter(function(m){return !m.tmp;});}
function last(){var s=sent();return s.length?s[s.length-1].id:0;}
function first(){var s=sent();return s.length?s[0].id:0;}
function day(iso){var d=new Date(iso);d.setHours(0,0,0,0);return d.getTime();}
function hm(iso){return new Date(iso).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}
/* Разделитель дня: «Сегодня», «Вчера», иначе число; год — только не текущий. */
function dayRu(iso){
  var t=new Date();t.setHours(0,0,0,0);
  var diff=Math.round((t.getTime()-day(iso))/86400000);
  if(diff===0)return 'Сегодня'; if(diff===1)return 'Вчера';
  var o={day:'numeric',month:'long'}; if(new Date(iso).getFullYear()!==t.getFullYear())o.year='numeric';
  return new Date(iso).toLocaleDateString('ru-RU',o);
}
function coarse(){try{return matchMedia('(pointer:coarse)').matches;}catch(e){return false;}}

/* ── Разметка ── */
function msg(m,prev){
  /* Подряд от одного автора в пределах пяти минут — без повтора имени, как в Telegram. */
  var cont=prev&&prev.user_id===m.user_id&&day(prev.at)===day(m.at)
           &&(new Date(m.at)-new Date(prev.at))<300000;
  var h='<div class="tcm'+(m.mine?' own':'')+(cont?' cont':'')+'" data-tc="sel" data-id="'+E(m.id)+'">'
       +'<div class="tcb">';
  if(!cont&&!m.mine)h+='<div class="tca">'+E(m.author)+'</div>';
  (m.files||[]).forEach(function(f){
    var u=m.tmp?f.local:C.urls[f.url];
    h+='<div class="tcph'+(m.tmp?' up':'')+'" role="img" aria-label="Фото"'
      +(m.tmp?'':' data-to="phopen" data-cph="'+E(f.url)+'"')+(u?' data-url="'+u+'"':'')+'>'
      +(u?'<img src="'+u+'" alt="">':'<svg class="i"><use href="#i-cam"/></svg>')+'</div>';
  });
  var tm=m.tmp?(m.failed?hm(m.at):'отправляется…'):hm(m.at);
  h+='<div class="tct">'+(m.body?E(m.body):'')
    +'<span class="tctm" title="'+E(dayRu(m.at)+', '+hm(m.at))+'">'+tm+'</span></div></div>';
  if(m.can_delete&&!m.tmp)h+='<button class="tbtn sm io tcdel" data-tc="del" data-id="'+m.id+'"'
    +' title="Удалить" aria-label="Удалить"><svg class="i"><use href="#i-trash"/></svg></button>';
  h+='</div>';
  if(m.failed)h+='<div class="tcerr"><svg class="i"><use href="#i-warn"/></svg><span>Не отправлено</span>'
    +'<button class="tbtn sm io" data-tc="retry" data-id="'+m.id+'" title="Отправить ещё раз"'
    +' aria-label="Отправить ещё раз"><svg class="i"><use href="#i-refr"/></svg></button>'
    +'<button class="tbtn sm io" data-tc="drop" data-id="'+m.id+'" title="Убрать" aria-label="Убрать">'
    +'<svg class="i"><use href="#i-x"/></svg></button></div>';
  return h;
}
function feed(){
  if(C.msgs===null)return '<div class="tonote">Загружаю…</div>';
  var h='';
  if(C.more)h+='<button class="tbtn sm tcmore" data-tc="older">Раньше</button>';
  if(!C.msgs.length)h+='<div class="tonote">Пока нет сообщений</div>';
  var prev=null, marked=false;
  C.msgs.forEach(function(m){
    if(!prev||day(prev.at)!==day(m.at))h+='<div class="tcday"><span class="ch">'+E(dayRu(m.at))+'</span></div>';
    if(!marked&&C.upto&&!m.tmp&&!m.mine&&m.id>C.upto){h+='<div class="tcnew">Новые</div>';marked=true;}
    h+=msg(m,prev); prev=m;
  });
  return h;
}
function composer(){
  return '<div class="tcin">'
    +'<label class="tbtn io" title="Снять фото" aria-label="Снять фото"><svg class="i"><use href="#i-cam"/></svg>'
    +'<input type="file" accept="image/*" capture="environment" class="tcPhoto" hidden></label>'
    +'<label class="tbtn io" title="Из галереи" aria-label="Из галереи"><svg class="i"><use href="#i-imp"/></svg>'
    +'<input type="file" accept="image/*" multiple class="tcPhoto" hidden></label>'
    +'<textarea class="tcta" id="tcText" rows="1" maxlength="4000" placeholder="Сообщение" aria-label="Сообщение"></textarea>'
    +'<button class="tbtn go io" data-tc="send" title="Отправить" aria-label="Отправить">'
    +'<svg class="i"><use href="#i-up"/></svg></button></div>';
}
function html(){
  return '<div id="toChat" class="tchat">'
    +(C.err?'<div class="erin"><svg class="i"><use href="#i-warn"/></svg><span>'+E(C.err)+'</span></div>':'')
    +'<div class="tcfeed" id="tcFeed">'+feed()+'</div>'+composer()+'</div>';
}

/* ── Отрисовка своего узла. Лента идёт потоком страницы, поле ввода прилипает
   к низу экрана — прокручивается окно, а не лента. ── */
function nearBottom(){var d=document.documentElement;return d.scrollHeight-window.scrollY-window.innerHeight<120;}
function toBottom(){window.scrollTo(0,document.documentElement.scrollHeight);}
function paint(keep){
  var box=document.getElementById('toChat'); if(!box)return;
  var stick=keep==='bottom'||nearBottom(), below=document.documentElement.scrollHeight-window.scrollY;
  var ta=document.getElementById('tcText'); if(ta)C.draft=ta.value;
  var focused=ta&&document.activeElement===ta;
  box.outerHTML=html();
  mount({stick:stick,focus:focused});
  if(keep==='top')window.scrollTo(0,document.documentElement.scrollHeight-below);
}
function mount(o){
  o=o||{stick:true};
  var f=document.getElementById('tcFeed'), ta=document.getElementById('tcText');
  if(!f)return;
  if(ta){ta.value=C.draft;grow(ta);if(o.focus)ta.focus();}
  if(o.stick)toBottom();
  photos(f);
}
/* Высота по тексту вместе с рамкой: иначе тексту не хватает пикселя и в пустом
   поле стоит серый столбик прокрутки. Прокрутка — только когда текст выше поля. */
function grow(ta){ta.style.height='auto';var h=ta.scrollHeight+ta.offsetHeight-ta.clientHeight;
  ta.style.height=Math.min(h,124)+'px';ta.style.overflowY=h>124?'auto':'hidden';}

/* Фото отдаёт ручка с проверкой прав, а <img src> заголовок сессии не шлёт:
   тянем сами и показываем blob. Ссылки живут, пока жив чат. */
function photos(root){
  root.querySelectorAll('[data-cph]:not([data-url])').forEach(async function(el){
    var src=el.dataset.cph;
    try{
      var u=C.urls[src];
      if(!u){
        var r=await fetch(src,{headers:{'X-FSE-Session':sess()}});
        if(!r.ok){el.innerHTML='<span class="phw">нет доступа</span>';return;}
        u=URL.createObjectURL(await r.blob()); C.urls[src]=u;
      }
      el.dataset.url=u; el.innerHTML='<img src="'+u+'" alt="">';
    }catch(e){el.innerHTML='<span class="phw">не загрузилось</span>';}
  });
}

/* ── Сервер ── */
async function load(){
  try{
    var r=await tapi('/to/chat');
    var pend=(C.msgs||[]).filter(function(m){return m.tmp;});
    C.msgs=r.messages.concat(pend); C.more=!!r.more; C.upto=r.read_upto||0; C.err='';
    C.unread=0; badge();
  }catch(e){C.err=e.message; if(C.msgs===null)C.msgs=[];}
  paint('bottom');
}
async function poll(){
  /* Ушли в другой раздел — узла нет, опрос останавливается до следующего входа. */
  if(C.open&&!document.getElementById('toChat'))return close();
  if(!C.open||document.hidden||C.msgs===null)return;
  try{
    var r=await tapi('/to/chat?after='+last()), gone={}, changed=false;
    (r.deleted||[]).forEach(function(id){gone[id]=1;});
    var keep=C.msgs.filter(function(m){return m.tmp||!gone[m.id];});
    if(keep.length!==C.msgs.length)changed=true;
    r.messages.forEach(function(m){if(put(keep,m))changed=true;});
    C.msgs=keep; if(C.err){C.err='';changed=true;}
    if(changed)paint();
  }catch(e){if(C.err!==e.message){C.err=e.message;paint();}}
}
/* Положить пришедшее с сервера перед неотправленными, без повтора. */
function put(list,m){
  if(list.some(function(x){return x.id===m.id;}))return false;
  var i=list.length; while(i>0&&list[i-1].tmp)i--;
  list.splice(i,0,m); return true;
}
async function older(){
  try{
    var r=await tapi('/to/chat?before='+first());
    C.msgs=r.messages.concat(C.msgs); C.more=!!r.more; paint('top');
  }catch(e){toastMsg(e.message);}
}
function find(id){return (C.msgs||[]).filter(function(m){return String(m.id)===String(id);})[0];}
function drop(m){C.msgs=C.msgs.filter(function(x){return x!==m;});}

/* Своё сообщение встаёт в ленту сразу с «отправляется…»; не ушло — «Не отправлено»
   и повтор, текст не теряется. */
async function deliver(m){
  m.failed=false; paint('bottom');
  try{
    var r;
    if(m.file){var fd=new FormData(); fd.append('file',m.file); if(m.body)fd.append('body',m.body);
      r=await tapi('/to/chat/photo',{method:'POST',body:fd});}
    else r=await jpost('/to/chat',{body:m.body});
    drop(m); put(C.msgs,r.message);
    if(m.local)try{URL.revokeObjectURL(m.local)}catch(e){}
  }catch(e){m.failed=true; toastMsg(e.message||'Не отправлено');}
  paint();
}
function pending(body,file){
  var m={id:'t'+(++C.seq),tmp:true,mine:true,user_id:-1,at:new Date().toISOString(),body:body||null,
         file:file||null,files:[]};
  if(file){m.local=URL.createObjectURL(file); m.files=[{local:m.local}];}
  if(!C.msgs)C.msgs=[];
  C.msgs.push(m); return m;
}
function send(){
  var ta=document.getElementById('tcText'); if(!ta)return;
  var text=ta.value.trim(); if(!text)return;
  ta.value=''; C.draft=''; grow(ta);
  deliver(pending(text));
}
async function sendPhotos(input){
  var fs=Array.prototype.slice.call(input.files||[]); input.value='';
  if(!fs.length)return;
  /* Подпись из поля — к первому снимку, как в Telegram. По одному: ручка
     принимает один файл, неудачный снимок не роняет остальные. */
  var ta=document.getElementById('tcText'), cap=ta?ta.value.trim():'';
  if(cap){ta.value='';C.draft='';grow(ta);}
  var list=fs.map(function(f,i){return pending(i===0?cap:'',f);});
  for(var i=0;i<list.length;i++)await deliver(list[i]);
}
async function del(id){
  var yes=(window.UI&&UI.confirm)?await UI.confirm({title:'Удалить сообщение?',
            text:'Оно пропадёт у всех.',ok:'Удалить',okIcon:'i-trash'})
          :window.confirm('Удалить сообщение?');
  if(!yes)return;
  try{
    await jpost('/to/chat/'+id+'/delete',{});
    var m=find(id); if(m)drop(m); paint();
  }catch(e){toastMsg(e.message||'Не удалилось');}
}
function toastMsg(t){if(typeof toast==='function')toast(t);}

/* ── Счётчик непрочитанных на входе в чат ── */
function badge(){
  document.querySelectorAll('[data-tcn]').forEach(function(el){
    el.textContent=C.unread>99?'99+':String(C.unread);
    el.title='Непрочитанных: '+C.unread; el.hidden=!C.unread;
  });
}
/* Зовётся и таймером, и каждой перерисовкой раздела — чаще раза в полминуты
   сервер не спрашиваем. */
async function refreshUnread(){
  if(C.open||document.hidden||Date.now()-C.asked<30000)return;
  var v=document.getElementById('toView');
  if(!v||v.style.display==='none'||!v.querySelector('[data-tcn]'))return;
  C.asked=Date.now();
  try{var r=await tapi('/to/chat/unread'); C.unread=r.unread; badge();}catch(e){}
}

/* ── Вход и выход ── */
function open(){
  if(C.open)return; C.open=true;
  C.msgs=null; C.upto=0; load();
  clearInterval(C.timer); C.timer=setInterval(poll,EVERY);
}
function close(){C.open=false; clearInterval(C.timer); C.timer=null;}

document.addEventListener('click',function(ev){
  var el=ev.target.closest('[data-tc]'); if(!el)return;
  var a=el.dataset.tc;
  if(a==='send')return send();
  if(a==='older')return older();
  if(a==='del')return del(el.dataset.id);
  if(a==='retry'){var m=find(el.dataset.id); if(m)deliver(m); return;}
  if(a==='drop'){var d=find(el.dataset.id); if(d){drop(d);paint();} return;}
  /* Нажатие на сообщение показывает корзину; второе нажатие или другое сообщение — прячет. */
  if(a==='sel'){
    if(ev.target.closest('[data-to="phopen"]'))return;
    var on=el.classList.contains('sel');
    document.querySelectorAll('#toChat .tcm.sel').forEach(function(x){x.classList.remove('sel');});
    if(!on)el.classList.add('sel');
  }
});
document.addEventListener('change',function(ev){
  var t=ev.target; if(t&&t.classList&&t.classList.contains('tcPhoto'))sendPhotos(t);
});
document.addEventListener('input',function(ev){
  if(ev.target&&ev.target.id==='tcText'){C.draft=ev.target.value;grow(ev.target);}
});
document.addEventListener('keydown',function(ev){
  /* Enter отправляет на компьютере; на телефоне это перенос строки, отправка — кнопкой. */
  if(ev.target&&ev.target.id==='tcText'&&ev.key==='Enter'&&!ev.shiftKey&&!coarse()){
    ev.preventDefault(); send();
  }
});
/* Уснувший телефон мог пропустить удалённое дольше окна опроса — по возвращении
   лента грузится заново, а не догоняется. */
document.addEventListener('visibilitychange',function(){
  if(!document.hidden&&C.open)load();
});
setInterval(refreshUnread,UNREAD_EVERY);

window.__toChat={html:html,mount:mount,open:open,close:close,refreshUnread:refreshUnread,
  unread:function(){return C.unread;}};
})();
