/* ═══════════════════════════════════════════════════════════════════════════
   kp-10.js — «Помощь и обратная связь».

   Ответ уходит телеграм-ботом, поэтому обратный канал есть у того, кто вошёл
   через Telegram. У вошедшего по почте (#329) его нет: он напишет, а ответить
   ему этим путём нельзя. Сообщение уходит на сервер (POST /api/auth/feedback),
   а он пересылает его в бот. Если ручки на сервере ещё нет или связи нет —
   текст кладётся в буфер обмена и открывается переписка с ботом: человек
   вставляет и отправляет сам. Молча потерять написанное нельзя.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
if(window.__helpV1)return; window.__helpV1=true;

// Тот же бот, через который выполняется вход. Если он сменится — правится здесь.
var BOT='fse_dijon_bot';
var TOPICS=[
  ['bug','Что-то сломалось'],
  ['data','Неверные данные или цифры'],
  ['idea','Предложение — чего не хватает'],
  ['access','Доступ: не вижу раздел или кнопку'],
  ['other','Другое']
];
var H={sent:false,busy:false,err:'',from:''};

function ic(n){return '<svg class="i"><use href="#'+n+'"/></svg>'}
function _escFallback(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function E(v){return (typeof esc==='function')?esc(v):_escFallback(v)}

function ensureView(){
  var v=document.getElementById('helpView');
  if(!v){v=document.createElement('div');v.id='helpView';v.style.display='none';
    (document.querySelector('.main')||document.body).appendChild(v);}
  return v;
}

// Откуда пришли — подставляем сами. Человек не обязан вспоминать, как
// назывался раздел: «у меня тут не работает» — нормальная формулировка.
var LAST='';
function ctx(){
  var live=(typeof LIVE!=='undefined')&&LIVE;
  return {section:LAST||'—', online:live,
          role:(document.getElementById('roleName')||{}).textContent||'—',
          w:window.innerWidth+'×'+window.innerHeight};
}

function render(){
  var v=ensureView(), c=ctx();
  v.innerHTML=
   '<div class="ph"><div><h1>Помощь и обратная связь</h1>'
   +'<p>Пишите сюда — сообщение придёт в телеграм тому, кто ведёт систему</p></div></div>'

   +'<div class="g2"><div>'
   +'<div class="cd" style="margin-bottom:14px"><div class="cdh"><h2>Написать</h2></div>'
   +'<div class="pd pd0">'
   + (H.err?('<div class="erin">'+ic('i-warn')+'<span>'+E(H.err)+'</span></div>'):'')
   + (H.sent?('<div class="fnote ok" style="margin-bottom:12px">Сообщение отправлено. '
             +'Ответ придёт в телеграм — в ту же переписку, через которую вы входите.</div>'):'')
   +'<div class="fcell wide" style="margin-bottom:14px"><div class="flab">О чём речь</div>'
   +'<select class="fin" id="hlTopic">'
   + TOPICS.map(function(t){return '<option value="'+t[0]+'">'+t[1]+'</option>'}).join('')
   +'</select></div>'
   +'<div class="fcell wide" style="margin-bottom:6px"><div class="flab">Что случилось<i>обязательно</i></div>'
   +'<textarea class="fin" id="hlText" rows="5" placeholder="Что нажали, что ожидали увидеть и что увидели на самом деле"></textarea>'
   +'<div class="fnote">Чем конкретнее, тем быстрее чинится. Название объекта или номер сметы помогают больше всего.</div></div>'
   +'</div>'
   +'<div class="pd" style="border-top:1px solid var(--line);display:flex;gap:9px;flex-wrap:wrap;align-items:center">'
   +'<button class="btn primary" data-act="hl-send"'+(H.busy?' disabled':'')+' title="Отправить в телеграм">'
   + ic('i-exp')+'<span class="lbl">'+(H.busy?'Отправляю…':'Отправить')+'</span></button>'
   +'<button class="btn" data-act="hl-tg" title="Открыть переписку с ботом">'
   + ic('i-link')+'<span class="lbl">Открыть телеграм</span></button>'
   +'<span class="hint" style="margin-left:auto">К сообщению прикладываются раздел, роль и размер экрана</span>'
   +'</div></div>'

   +'<div class="cd"><div class="cdh"><h2>Что приложить к сообщению</h2></div>'
   +'<div class="it"><div class="ni info">'+ic('i-pin')+'</div><div>'
   +'<div class="tx">Где это было</div><div class="sb">Раздел и, если можно, название объекта или сметы</div></div></div>'
   +'<div class="it"><div class="ni info">'+ic('i-check')+'</div><div>'
   +'<div class="tx">Что вы нажали</div><div class="sb">По шагам: открыл, выбрал, нажал</div></div></div>'
   +'<div class="it"><div class="ni info">'+ic('i-eye')+'</div><div>'
   +'<div class="tx">Что ожидали и что получили</div><div class="sb">Эти две строки экономят половину переписки</div></div></div>'
   +'<div class="it"><div class="ni warn">'+ic('i-cam')+'</div><div>'
   +'<div class="tx">Снимок экрана</div><div class="sb">Его прикладывают уже в телеграме — сюда файлы не грузятся</div></div></div>'
   +'</div>'

   +'</div><div>'
   +'<div class="cd" style="margin-bottom:14px"><div class="cdh"><h2>Что уйдёт вместе с текстом</h2></div>'
   +'<div class="pd pd0"><div class="prmg">'
   +'<span>Раздел</span><span class="v">'+E(c.section)+'</span>'
   +'<span>Роль</span><span class="v">'+E(c.role)+'</span>'
   +'<span>Экран</span><span class="v">'+E(c.w)+'</span>'
   +'<span>Связь с сервером</span><span class="v">'+(c.online?'есть':'нет')+'</span>'
   +'</div></div>'
   +'<div class="callout">Ни содержимого смет, ни цен, ни чужих данных в сообщение не попадает — '
   +'только то, что перечислено выше, и ваш текст.</div></div>'

   +'<div class="cd"><div class="cdh"><h2>Если ответа нет</h2></div>'
   +'<div class="pd pd0"><p class="note" style="margin:0">Сообщение уходит через сервер. Если сервер '
   +'недоступен, приложение положит текст в буфер обмена и откроет переписку с ботом '
   +'<b>@'+BOT+'</b> — вставьте и отправьте вручную. Написанное не пропадёт.</p></div></div>'
   +'</div></div>';
}

function openTelegram(text){
  try{ if(text&&navigator.clipboard)navigator.clipboard.writeText(text); }catch(e){}
  var a=document.createElement('a');
  a.href='https://t.me/'+BOT; a.target='_blank'; a.rel='noopener noreferrer';
  document.body.appendChild(a); a.click(); a.remove();
}

document.addEventListener('click',async function(ev){
  var el=ev.target.closest('[data-act]'); if(!el)return;
  var a=el.dataset.act;

  if(a==='hl-tg'){
    var t0=document.getElementById('hlText');
    openTelegram(t0?t0.value:'');
    return;}

  if(a==='hl-send'){
    if(H.busy)return;
    var te=document.getElementById('hlText'), tp=document.getElementById('hlTopic');
    var text=(te&&te.value||'').trim();
    if(text.length<10){
      H.err='Опишите чуть подробнее — по одной строке не понять, что чинить.';
      render(); if(typeof toast==='function')toast(H.err); return;}
    H.busy=true; H.err=''; H.sent=false; render();
    var c=ctx();
    var body={topic:(tp&&tp.value)||'other',text:text,
              section:c.section,role:c.role,screen:c.w,online:c.online};
    try{
      var r=await fetch('/api/auth/feedback',{method:'POST',
        headers:{'Content-Type':'application/json',
                 'X-FSE-Session':(function(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}})()},
        body:JSON.stringify(body)});
      if(!r.ok)throw new Error('HTTP '+r.status);
      H.sent=true; H.busy=false; render();
      var te2=document.getElementById('hlText'); if(te2)te2.value='';
      if(typeof toast==='function')toast('Отправлено — ответ придёт в телеграм');
    }catch(e){
      // Ручки на сервере может не быть — тогда не теряем текст, а отдаём
      // человеку готовое сообщение и открываем переписку с ботом.
      H.busy=false;
      H.err='Через сервер не ушло ('+(e.message||'нет связи')
           +'). Текст скопирован — вставьте его в телеграме.';
      render();
      openTelegram('Обратная связь · '+c.section+' · '+c.role+'\n\n'+text);
      if(typeof toast==='function')toast('Открыл телеграм — текст в буфере обмена',5000);
    }
    return;}
});

// ── Подключение раздела ──────────────────────────────────────────────────
try{ if(typeof SECT_SCOPE!=='undefined'&&SECT_SCOPE)SECT_SCOPE.help=''; }catch(e){}
var _goHelp=window.go;
window.go=function(v){
  if(v!=='help'){
    if(v)LAST=({home:'Обзор',specs:'Сметы',editor:'Конструктор КП',deal:'Расчёт сделки',
      zakupki:'Закупки',shift:'Смена',montazh:'Монтаж',to:'Обслуживание',
      reports:'Отчёты',entities:'Юрлица',settings:'Настройки',
      audit:'Журнал доступа'}[v]||v);
    var hv=document.getElementById('helpView'); if(hv)hv.style.display='none';
    return _goHelp(v);
  }
  if(typeof drawer==='function'){try{drawer(false)}catch(e){}}
  ensureView();
  if(typeof hideViewsExcept==='function')hideViewsExcept('helpView');
  document.getElementById('helpView').style.display='';
  document.querySelectorAll('.nav[data-go]').forEach(function(n){
    n.classList.toggle('act',n.dataset.go==='help');});
  var on=document.getElementById('objname'); if(on)on.textContent='Помощь';
  H.sent=false; H.err='';
  render();
};
try{ if(typeof applyRoleNav==='function')applyRoleNav(); }catch(e){}
})();
