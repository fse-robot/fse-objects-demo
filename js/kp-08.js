(function(){
if(window.__patchToV1)return; window.__patchToV1=true;

var TAPI='/montazh/api';
// Один объект состояния на раздел. Ничего в localStorage: набор объектов
// заказчика не должен переживать закрытие вкладки на общем компьютере.
var T={sub:null,meta:null,sites:null,site:null,cps:null,contracts:null,
       acts:null,plan:null,grants:null,visit:undefined,
       checklist:null,portal:null,pcard:null,busy:false,err:'',q:'',
       grantsFor:null,addrItems:null,staff:null,tbOpen:false,tb:null,tbHist:null,tbQ:'',tbNew:true,tbPick:{},tbEdit:{},planMode:'cal',cal:null,calY:0,calM:0,calEng:'',calPick:null,calDay:null,engs:null,mine:null,
       // Акт выставляют за закончившийся месяц — по умолчанию прошлый.
       year:new Date(new Date().getFullYear(),new Date().getMonth()-1,1).getFullYear(),
       month:new Date(new Date().getFullYear(),new Date().getMonth()-1,1).getMonth()+1,
       actsNoVisits:[],
       marks:{},form:null,met:null,metErr:'',metY:new Date().getFullYear(),metM:new Date().getMonth()+1,jr:null,pjr:null,pmon:null,eng:null,engMonth:'',engOpen:{},engAll:{},sreq:null,preq:null,pcontact:false,sigOpen:{},ejr:{}};

function sess(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}}
function isMgr(){return can('to:manage');}
function isEng(){return can('to:visit');}
// Экран инженера: у самого инженера — всегда, у менеджера — на вкладке
// «Кабинет инженера» (ADR-0066). Решает, что грузить и что перерисовать.
function engView(){return isEng()&&(!isMgr()||T.sub==='eng');}
function isCust(){return can('to:portal')&&!can('to:read');}
function _escFallback(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function E(v){return (typeof esc==='function')?esc(v):_escFallback(v);}
function money(n){return n==null?'—':new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽';}
function dmy(v){if(!v)return '—';var s=String(v).slice(0,10).split('-');return s[2]+'.'+s[1]+'.'+s[0];}
function hhmm(iso){try{var d=new Date(iso);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}catch(e){return ''}}
// Дата по местному времени, а не по UTC. toISOString() отдаёт UTC, и в
// Москве с полуночи до трёх часов «сегодня» означало вчера: от этой даты
// зависят «просрочено», календарь и дата акта.
function today(){var d=new Date();
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}

async function tapi(path,opts){
  opts=opts||{};
  opts.headers=Object.assign({'X-FSE-Session':sess()},opts.headers||{});
  var r;
  try{r=await fetch(TAPI+path,opts);}catch(e){throw new Error('Нет связи с сервером');}
  if(r.status===401&&typeof authExpired==='function'){authExpired();}
  var ct=r.headers.get('content-type')||'';
  if(ct.indexOf('text/html')>=0)return await r.text();
  var t=await r.text(); var d=null; try{d=t?JSON.parse(t):null}catch(e){}
  // Отказ обязан называть причину: сервер её присылает, и прятать её за
  // «Ошибка 403» значит стоить человеку круга переписки.
  if(!r.ok)throw new Error((d&&d.detail)||('Ошибка '+r.status));
  return d;
}
function jpost(path,body,method){
  return tapi(path,{method:method||'POST',headers:{'Content-Type':'application/json'},
                    body:JSON.stringify(body||{})});
}

// Геолокация обязательна — как в разделе «Смена». Без координат выезд не
// открыть и не закрыть: отметка без координат ничего не доказывает.
function geo(){
  return new Promise(function(res,rej){
    if(!navigator.geolocation)return rej(new Error('Телефон не отдаёт геолокацию'));
    navigator.geolocation.getCurrentPosition(
      function(p){res({lat:p.coords.latitude,lon:p.coords.longitude,accuracy_m:p.coords.accuracy});},
      function(){rej(new Error('Разрешите доступ к геопозиции — без неё выезд отметить нельзя'));},
      {enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
}

// ── Снимки. Как в «Смене»: публичной ссылки у фото нет, файл отдаёт
// ручка-прокси, требующая заголовок сессии, а <img src> его не шлёт.
// Значит тянем сами и показываем blob, освобождая прежние ссылки.
var PHT={urls:[],open:''};
function phFreeT(){
  var ov=document.getElementById('tphOv');
  var keep=(ov&&ov.classList.contains('on'))?PHT.open:'';
  var left=[];
  PHT.urls.forEach(function(u){if(u&&u===keep){left.push(u);return;}
    try{URL.revokeObjectURL(u)}catch(e){}});
  PHT.urls=left;
}
function phLoadT(root){
  (root||document).querySelectorAll('[data-tph]').forEach(async function(el){
    if(el.dataset.done)return; el.dataset.done='1';
    try{
      var r=await fetch(TAPI+'/to/visit/photo/view?ref='+encodeURIComponent(el.dataset.tph),
                        {headers:{'X-FSE-Session':sess()}});
      if(!r.ok){el.innerHTML='<div class="phw">нет доступа</div>';return;}
      var u=URL.createObjectURL(await r.blob()); PHT.urls.push(u);
      el.innerHTML='<img src="'+u+'" alt="">'; el.dataset.url=u;
    }catch(e){el.innerHTML='<div class="phw">не загрузилось</div>';}
  });
}

/* ═══════════════════════ ОБЩЕЕ ═══════════════════════ */
function view(){
  var v=document.getElementById('toView');
  if(!v){v=document.createElement('div');v.id='toView';v.style.display='none';
    (document.querySelector('.main')||document.querySelector('.wrap')||document.body).appendChild(v);}
  return v;
}
// Вкладки раздела — перемещение, а не действие: красная кнопка на экране
// одна и означает «сделать» (И3). Раньше активная вкладка была такой же
// красной, как «Назначить выезд», и глаз не отличал одно от другого.
var TICO={sites:'i-bld',plan:'i-cal',contracts:'i-doc',acts:'i-file',cps:'i-bank',
          staff:'i-usrs',metrics:'i-chart',mine:'i-list',tb:'i-imp',grants:'i-lock',
          cal:'i-cal',mycal:'i-cal',eng:'i-gauge',chat:'i-msg'};
// Кнопки экрана вкладки встают в полосу вкладок справа: заголовок над ними
// повторял бы название вкладки и занимал строку. Экран, нарисованный вне
// полосы вкладок, получает кнопки на месте.
var tabActs=null;
function lift(h){if(tabActs===null)return h;tabActs+=h;return ''}
function tabs(list,acts){
  return '<div class="stabs">'+list.map(function(t){
    return '<button class="stab'+(T.sub===t[0]?' on':'')+'" data-to="tab" data-t="'+t[0]+'"'
      +' title="'+E(t[1])+'"><svg class="i"><use href="#'+(TICO[t[0]]||'i-list')+'"/></svg>'
      +'<span class="lbl">'+E(t[1])+'</span>'+(t[0]==='chat'?chatN():'')+'</button>';
  }).join('')+(acts?'<div class="acts">'+acts+'</div>':'')+'</div>';
}
// Чат отдела (#548) живёт в kp-20.js: здесь только вход и место на экране.
function chatN(){
  var n=0; if(window.__toChat)n=window.__toChat.unread();
  return '<span class="ch bad" data-tcn title="Непрочитанных: '+n+'"'+(n?'':' hidden')+'>'+(n>99?'99+':n)+'</span>';
}
function chatBody(){return window.__toChat?window.__toChat.html():empty('Чат не загрузился — обновите страницу.');}
function err(){return T.err
  ?'<div class="erin"><svg class="i"><use href="#i-warn"/></svg><span>'+E(T.err)+'</span></div>':'';}
function empty(txt){return '<div class="tonote">'+E(txt)+'</div>';}
function chip(cls,txt){return '<span class="tochip '+cls+'">'+E(txt)+'</span>';}

function dueChip(due,status){
  if(status==='done')return chip('ok','выполнено');
  if(!due)return chip('mut','—');
  var d=Math.round((new Date(due)-new Date(today()))/86400000);
  if(d<0)return chip('bad','просрочено на '+(-d)+' дн.');
  if(d<=7)return chip('warn','через '+d+' дн.');
  return chip('mut',dmy(due));
}
// Дата выезда ставится руками после разговора с заказчиком (#519); пока её
// нет, выезд виден, но без числа.
function visitChip(planned){
  return planned?dueChip(planned):chip('warn','дата не согласована');
}
// Срок вызова инженера по п. 2.7 договора «ТОМ» (#444): до срока — время,
// после — красная метка. Заявке, заведённой до сроков, остаётся «вызов».
function callChip(due){
  if(!due)return chip('warn','вызов');
  return new Date(due)<new Date()?chip('bad','просрочено'):chip('warn','до '+dm(due));
}
function sevRu(s){return {critical:'критическое',major:'существенное',minor:'незначительное'}[s]||s;}
function sevCls(s){return {critical:'bad',major:'warn',minor:'mut'}[s]||'mut';}
function stRu(s){return {open:'не устранено',agreed:'согласовано',declined:'отклонено',fixed:'устранено'}[s]||s;}
var MON=['январь','февраль','март','апрель','май','июнь',
         'июль','август','сентябрь','октябрь','ноябрь','декабрь'];
function monthRu(iso){
  try{var p=String(iso).split('-');return MON[+p[1]-1]+' '+p[0];}catch(e){return iso}
}
function contrRu(s){return {active:'действует',draft:'черновик',suspended:'приостановлен',closed:'закрыт'}[s]||s;}
function actRu(s){return {draft:'черновик',issued:'выпущен',sent:'отправлен',signed:'подписан',cancelled:'отменён'}[s]||s;}
function sysRu(k){return (T.meta&&T.meta.systems&&T.meta.systems[k])||k;}
function perRu(k){return (T.meta&&T.meta.periods&&T.meta.periods[k])||k;}

// Заголовок раздела. Раньше экран начинался с полосы вкладок, и человек,
// пришедший по ссылке, не понимал, куда попал.
function toHead(){
  if(isCust())return '<div class="ph"><div><h1>Ваши объекты</h1>'
    +'<p>Договоры, выезды и акты по вашим объектам</p></div></div>';
  // Порядок важен: у администратора есть и to:manage, и to:visit. Если сперва
  // спросить про инженера, директор увидит заголовок выездного инженера.
  if(!isMgr()&&isEng())return '<div class="ph"><div><h1>Обслуживание</h1>'
    +'<p>Ваши выезды: что сделать на объекте и чем закрыть</p></div></div>';
  return '<div class="ph"><div><h1>Обслуживание</h1>'
    +'<p>Объекты, регламенты, выезды и акты по договорам ТО</p></div></div>';
}
function render(){
  var v=view(); phFreeT();
  if(isCust())      v.innerHTML=toHead()+renderPortal();
  else if(isMgr())  v.innerHTML=toHead()+renderManager();
  else if(isEng())  v.innerHTML=toHead()+renderEngineer();
  else              v.innerHTML=toHead()
    +empty('Раздел «Обслуживание» вам не выдан. Обратитесь к администратору компании.');
  phLoadT(v);
  if(window.__toChat){
    if(document.getElementById('toChat')){window.__toChat.open();window.__toChat.mount();}
    else{window.__toChat.close();window.__toChat.refreshUnread();}
  }
}

/* ═══════════════════ КАБИНЕТ ЗАКАЗЧИКА ═══════════════════
   Экран, который владелец нарисовал на макете: видно, за что вы платите.
   Ни себестоимости, ни зарплат, ни чужих объектов — сервер их и не отдаёт,
   но и здесь мы их не рисуем, чтобы «случайно раскомментировать» было нечего. */
/* ── Мониторинг глазами заказчика (#445, макет «34 Обслуживание — мониторинг»).
   Одна строка состояния, цвет несёт вся карточка: десять плиток по видам
   сигналов на телефоне заняли бы пять рядов, девять из них всегда пустые.
   Пожар и пуск — красным, остальные сигналы — янтарным, устаревшие данные —
   серым: молчащий прибор не выглядит ни исправным, ни горящим. */
var MON_RED={fire:1,launch:1};
// Короткие метки вида сигнала для журнала: полное название — в подсказке.
var CAT_SHORT={fire:'пожар',attention:'внимание',launch:'пуск',stop:'останов',block:'блокировка',tamper:'корпус',
  fault:'неисправность',power:'питание',link:'связь',unknown:'неизвестно',autostart_off:'автопуск'};
function monCls(st){
  if(st.state==='stale'||st.state==='nodata')return 'stale';
  if(st.state!=='signals')return 'ok';
  return activeRed(st)?'bad':'warn';
}
function monWord(st){
  if(st.state==='nodata')return 'Данных с прибора ещё нет';
  if(st.state==='stale')return 'Нет свежих данных';
  var a=(st.signals||[]).filter(function(x){return !x.restored})[0];
  return a?a.title:'Сигналов нет';
}
function activeRed(st){
  return ((st&&st.signals)||[]).filter(function(x){return !x.restored&&MON_RED[x.category]})[0];
}
// В списке объектов — только красное: пожар и пуск. Остальное — внутри объекта.
function monChip(st){var a=activeRed(st);return a?chip('bad',a.title):'';}
// Состояние объекта одной строкой: слово своим цветом и свежесть данных.
function monLine(st,received,extra){
  // При пожаре слово уже в красной плашке — здесь остаётся только свежесть.
  return '<div class="monline '+monCls(st)+'">'+(activeRed(st)?'':('<b>'+E(monWord(st))+'</b>'))
    +'<span class="s" title="'+E('Прибор пока не передаёт события сам — журнал загружает инженер'
      +(received?(', последний раз '+dtm(received)):''))+'">'
    +(st.data_at?('данные на '+dm(st.data_at)):'данных нет')+'</span>'+(extra||'')+'</div>';
}
// Красная плашка — только при пожаре или пуске, с вызовом 112 и 101.
function critBanner(st){
  var a=activeRed(st); if(!a)return '';
  var where=[a.zone,a.element].filter(Boolean).join(' · ');
  return '<div class="tocard mon bad"><div class="monw">'+E(a.title)+'</div>'
    +'<div class="s">'+dm(a.occurred_at)+(where?(' · '+E(where)):'')+'</div>'
    +'<div class="s monfire" title="Звоните сами — п. 3.11 договора">Пожарную охрану мониторинг не вызывает</div>'
    +'<div class="bar" style="margin:8px 0 0;gap:6px">'
    +'<a class="tbtn sm go tel" href="tel:112">112</a><a class="tbtn sm tel" href="tel:101">101</a></div></div>';
}

// Живой журнал: событие — отдельная строка с полосой вида слева, чтобы
// строки не сливались. Пожар и пуск — всегда своей строкой; прочие
// сигналы подряд — «Неисправности ×N», служебные подряд одного элемента —
// «N служебных»; группы разворачиваются и сворачиваются на месте.
function evKind(r){return !r.category?'svc':(MON_RED[r.category]?'crit':'warn');}
function evGroups(rows){
  var out=[];
  rows.forEach(function(r,i){
    var kind=evKind(r), g=out[out.length-1];
    if(g&&g.kind===kind&&kind!=='crit'&&(kind==='warn'||g.rows[0].element===r.element))g.rows.push(r);
    else out.push({key:i,kind:kind,rows:[r]});
  });
  return out;
}
function evRow(r,k,hints,cats){
  var h=hints&&r.category?(hints.categories||{})[r.category]:null, dev=hints&&hints.device;
  var more=h?[h.action+'.',h.meaning,dev&&dev.action,dev&&dev.meaning].filter(Boolean).join(' '):'';
  var where=[r.zone,r.element,r.address].filter(Boolean).join(' · ');
  var html='<div class="evrow '+evKind(r)+'"><span class="t n">'+dm(r.occurred_at)+'</span>'
    +(r.category?('<span class="ek" title="'+E((cats||{})[r.category]||'')+'">'+E(CAT_SHORT[r.category]||'')+'</span>'):'')
    +'<span class="x" title="'+E(where)+'">'+E(r.event)+'</span>'
    +(more?('<button class="tbtn sm" data-to="sigq" data-k="'+E(k)+'" title="Что делать"></button>'):'')+'</div>';
  if(more&&(T.sigOpen||{})[k])
    html+='<div class="evmore s">'+E(more)+(where?(' '+E(where)+'.'):'')
      +(r.letter_at?(' Письмо '+dm(r.letter_at)+'.'):'')+' Подсказка не заменяет инструкцию объекта.</div>';
  return html;
}
function evList(rows,st,hints,cats){
  return '<div class="evlist">'+evGroups(rows).map(function(g){
    var n=g.rows.length, one=function(r,i){return evRow(r,st.name+(g.key+i),hints,cats);};
    if(g.kind==='crit'||n===1)return g.rows.map(one).join('');
    var opn=st.open[g.key], last=g.rows[0];
    return '<div class="evrow grp '+g.kind+'"><span class="t n">'+dm(last.occurred_at)+'</span>'
      +'<span class="x">'+(g.kind==='warn'?('Неисправности ×'+n):(n+' служебных · '+E(last.element||'')))+'</span>'
      +'<button class="tbtn sm" data-to="'+(opn?'evfold':'evgrp')+'" data-g="'+g.key+'" data-s="'+st.name+'" title="'
      +(opn?'Свернуть':'Развернуть')+'"></button></div>'+(opn?g.rows.map(one).join(''):'');
  }).join('')+'</div>';
}
function pJournal(s){
  var j=T.pjr, d=j.data, ev=d.event||'';
  var h='<div class="tosec" id="pjr">Журнал прибора</div>'
    +'<div class="torow" style="margin:0 0 10px;flex-wrap:wrap;gap:8px"><div class="s">'
    +d5(d.date_from)+'–'+d5(d.date_to)+(ev?(' · '+E(ev)):'')+' · '+d.total+'</div>'
    +'<div class="bar" style="gap:6px"><button class="tbtn sm'+(j.flt?' on':'')+'" data-to="pjrflt">Фильтр</button>'
    +'<button class="tbtn sm" data-to="pjrcsv" data-id="'+s.id+'">Скачать CSV</button></div></div>';
  if(j.flt)
    h+='<div class="tofields" style="margin:0 0 10px">'
      +'<label class="tofield"><span>С</span><input class="f" type="date" id="jrFrom" value="'+E(d.date_from)+'"></label>'
      +'<label class="tofield"><span>По</span><input class="f" type="date" id="jrTo" value="'+E(d.date_to)+'"></label>'
      +'<label class="tofield"><span>Событие</span><select class="f" id="jrEv"><option value="">все события</option>'
      +(d.kinds||[]).map(function(x){return '<option value="'+E(x.event)+'"'+(x.event===ev?' selected':'')+'>'
        +E(x.event)+' · '+x.n+'</option>';}).join('')+'</select></label></div>'
      +'<div class="bar" style="margin:0 0 10px"><button class="tbtn sm go" data-to="pjrshow" data-id="'+s.id+'">Показать</button></div>';
  var rows=d.events||[];
  if(!rows.length)return h+empty('Событий нет');
  if(d.total>rows.length)
    h+='<div class="tonote" title="Сузьте период или скачайте CSV">'+rows.length+' из '+d.total+'</div>';
  return h+evList(rows,{open:j.open,name:'p'},d.hints,d.categories);
}

function renderPortal(){
  if(T.pcard)return portalCard();
  if(T.portal===null)return '<div class="tonote">Загружаю…</div>';
  var d=T.portal||{};
  if(!d.sites||!d.sites.length)
    return '<div class="tohead"><h2>Объекты</h2></div>'
          +empty(d.hint||'Доступ к объектам ещё не выдан.');
  return '<div class="tohead"><h2>Ваши объекты</h2>'
        +'<div class="s">График работ, кто и когда приезжал, что проверил, '
        +'подписанные акты — всё в одном месте.</div></div>'
    +d.sites.map(function(s){
      var st=s.state==='ok'?chip('ok','исправна'):(s.state==='attention'?chip('warn','есть замечания'):chip('mut','нет данных'));
      var done=(s.done_ytd||0),due=(s.due_ytd||0);
      return '<div class="tocard" data-to="pcard" data-id="'+s.id+'">'
        +'<div class="torow"><div><b>'+E(s.name)+'</b>'
        +'<div class="s">'+E(s.address)+'</div>'
        +'<div class="s">'+(s.contracts?('договор '+E(s.contracts)+' · '):'')
        +E((s.systems||[]).join(', ')||'системы не заведены')+'</div></div>'
        +'<div style="text-align:right">'+st
        +monChip(((T.pmon||{}).sites||{})[s.id])+'</div></div>'
        +'<div class="tostats">'
        +'<div><b>'+done+'/'+due+'</b><span>работ по графику выполнено</span></div>'
        +'<div><b>'+(s.defects_open||0)+'</b><span>незакрытых замечаний</span></div>'
        +'<div><b>'+(s.false_alarms||0)+'</b><span>ложных срабатываний за год</span></div>'
        +'</div>'
        +'<div class="s" style="margin-top:8px">'
        +(s.last_visit?('последний выезд '+dmy(s.last_visit)):'выездов ещё не было')
        +(s.next_due?(' · следующий по графику '+dmy(s.next_due)):'')+'</div></div>';
    }).join('');
}

// Шапка карточки заказчика (#454, макет «36 Обслуживание — подсказки и
// вызов»): одна строка — ближайший выезд, контакт по нажатию, вызов
// инженера. Последний выезд и пояснения — в подсказке, а не строками.
function portalHead(s,d,plan){
  var next=plan.filter(function(p){return p.status==='planned'})
    .map(function(p){return p.planned_on||p.due_on}).sort()[0];
  var last=(d.visits||[])[0];
  var q=T.preq&&String(T.preq.site)===String(s.id)?T.preq:null, r=q&&q.req;
  var h='<div class="bar" style="margin-top:6px;gap:8px;align-items:center;flex-wrap:wrap">'
    +'<span class="s"'+(last?(' title="последний выезд '+dmy(last.started_at)+'"'):'')+'>'
    +(next?('выезд '+d5(next)):'выездов в графике нет')+'</span>'
    +((s.contact_name||s.contact_phone)?'<button class="tbtn sm" data-to="pcontact" title="Контакт на объекте"></button>':'');
  if(r)
    h+='<span class="s" title="Увидим в рабочее время и перезвоним">'+(r.source==='signal'?'По сигналу':'Заявка')
      +' · '+String(r.created_at).slice(11,16)+'</span>'
      +chip(r.status==='accepted'?'ok':'mut',r.status==='accepted'?'принята':'отправлена');
  else if(!(q&&q.form))
    h+='<button class="tbtn sm" data-to="preq" data-id="'+s.id+'">Вызвать</button>';
  h+='</div>';
  if(T.pcontact&&(s.contact_name||s.contact_phone))
    h+='<div class="s">'+E(s.contact_name||'')+(s.contact_phone?(' · <a href="tel:'
      +E(String(s.contact_phone).replace(/[^\d+]/g,''))+'">'+E(s.contact_phone)+'</a>'):'')+'</div>';
  if(q&&q.form&&!r)
    h+='<div class="bar" style="margin-top:8px;gap:6px"><input class="f" id="preqNote" style="flex:1"'
      +' placeholder="Что на экране прибора (необязательно)" maxlength="1000">'
      +'<button class="tbtn sm go" data-to="preqsend" data-id="'+s.id+'">Вызвать</button></div>';
  return h;
}

function portalCard(){
  var d=T.pcard; if(d===true)return '<div class="tonote">Загружаю…</div>';
  var s=d.site;
  var open=(d.defects||[]).filter(function(x){return x.status==='open'||x.status==='agreed'});
  var plan=(d.plan||[]);
  var done=plan.filter(function(p){return p.status==='done'}).length;
  var late=plan.filter(function(p){return p.status==='planned'&&p.due_on<today()}).length;

  var h='<div class="tohead"><button class="tbtn sm" data-to="pback">‹ К объектам</button>'
       +'<h2 style="margin-top:10px">'+E(s.name)+'</h2>'+portalHead(s,d,plan)+'</div>';

  // Мониторинг — сразу под названием: заказчик, пришедший по письму о
  // сигнале, должен увидеть состояние, не пролистывая график и акты.
  var pj=T.pjr&&String(T.pjr.site)===String(s.id)?T.pjr:null;
  var mon=pj&&pj.data&&pj.data.monitoring;
  if(mon){
    var dev=(pj.data.hints||{}).device;
    h+=critBanner(pj.data.status||{})
      +monLine(pj.data.status||{},pj.data.received_at,
        dev?'<button class="tbtn sm" data-to="sigsnd" data-k="dev">Звук</button>':'')
      +((T.sigOpen||{}).dev&&dev?('<div class="evmore s" style="margin:-4px 0 10px">'+E(dev.action)+'. '+E(dev.meaning||'')+'</div>'):'')
      +pJournal(s);
  }
  else if(pj&&pj.data&&pj.data.monitoring===false)
    h+='<div class="tonote">Мониторинг не подключён</div>';
  else if(pj&&pj.data===false)h+='<div class="tonote warn">'+E(pj.err)+'</div>';

  h+='<div class="tostats big">'
    +'<div><b>'+done+'/'+plan.length+'</b><span>работ по графику</span></div>'
    +'<div><b class="'+(open.length?'bad':'ok')+'">'+open.length+'</b><span>незакрытых замечаний</span></div>'
    +'<div><b>'+(d.acts||[]).length+'</b><span>актов</span></div>'
    +(late?'<div><b class="bad">'+late+'</b><span>просрочено</span></div>':'')
    +'</div>';

  h+='<div class="tosec">Системы на объекте</div><div class="tolist">'
    +((d.systems||[]).map(function(y){
        return '<div class="toli"><div><b>'+E(y.title)+'</b><div class="s">'+E(sysRu(y.kind))
          +(y.brand?(' · '+E(y.brand)):'')+(y.model?(' '+E(y.model)):'')
          +(y.zones_count?(' · '+y.zones_count+' зон'):'')
          +(y.modules_count?(' · модулей '+y.modules_count):'')
          +(y.gotv_kind?(' · '+E(y.gotv_kind)):'')+'</div>'
          +(y.vessel_check_on?('<div class="s">освидетельствование сосудов до '+dmy(y.vessel_check_on)+'</div>'):'')
          +'</div></div>';
      }).join('')||empty('Системы не заведены'))+'</div>';

  h+='<div class="tosec">График регламентных работ</div><div class="tolist">'
    +(plan.map(function(p){
        return '<div class="toli"><div><b>'+E(p.work||'Регламентные работы')+'</b>'
          +'<div class="s">'+E(p.system_title||'')+' · '+E(perRu(p.period_kind))
          +(p.doc_ref?(' · '+E(p.doc_ref)):'')+'</div></div>'
          +dueChip(p.due_on,p.status)+'</div>';
      }).join('')||empty('График не построен'))+'</div>';

  function pDef(x){
        var act='';
        if(s.can_approve&&(x.status==='open'))
          act='<div class="bar" style="margin:8px 0 0;gap:6px">'
             +'<button class="tbtn sm go" data-to="decide" data-id="'+x.id+'" data-v="agreed">Согласовать устранение</button>'
             +'<button class="tbtn sm" data-to="decide" data-id="'+x.id+'" data-v="declined">Отказаться</button></div>';
        return '<div class="toli col"><div class="torow"><div><b>'+E(x.title)+'</b>'
          +'<div class="s">'+dmy(x.found_on)+' · '+E(x.system_title||'')+' · '+E(sevRu(x.severity))
          +(x.fix_price?(' · устранение '+money(x.fix_price)):'')+'</div>'
          +(x.detail?('<div class="s">'+E(x.detail)+'</div>'):'')+'</div>'
          +chip(x.status==='fixed'?'ok':sevCls(x.severity),stRu(x.status))+'</div>'+act+'</div>';
  }
  var pInit=(d.defects||[]).filter(function(x){return x.initial;});
  if(pInit.length)
    h+='<div class="tosec">Недостатки первичного осмотра</div><div class="tolist">'
      +pInit.map(pDef).join('')+'</div>';
  h+='<div class="tosec">Замечания</div><div class="tolist">'
    +((d.defects||[]).filter(function(x){return !x.initial;}).map(pDef).join('')||empty('Замечаний нет'))+'</div>';

  h+='<div class="tosec">Выезды и фотоотчёт</div><div class="tolist">'
    +((d.visits||[]).map(function(v){
        var fio=[v.first_name,v.last_name].filter(Boolean).join(' ');
        var ph=(v.files||[]).map(function(f){
          return '<div class="phi"><div class="phimg" data-tph="'+E(f.ref)+'" data-to="phopen"></div></div>';}).join('');
        return '<div class="toli col"><div class="torow"><div><b>'+dmy(v.started_at)+'</b>'
          +'<div class="s">'+hhmm(v.started_at)+'–'+hhmm(v.finished_at)
          +(fio?(' · инженер '+E(fio)):'')+' · отметок '+(v.checks||0)
          +(v.kind==='initial'?' · первичный осмотр':'')+'</div></div>'
          +chip('ok','выполнено')+'</div>'
          +(ph?('<div class="phrow">'+ph+'</div>'):'')+'</div>';
      }).join('')||empty('Выездов ещё не было'))+'</div>';

  h+='<div class="tosec">Акты</div><div class="tolist">'
    +((d.acts||[]).map(function(a){
        if(a.period_kind==='initial')
          return '<div class="toli"><div><b>Акт первичного осмотра '+E(a.number)+'</b><div class="s">'
            +dmy(a.period_from)+'</div></div>'+chip(a.status==='signed'?'ok':'mut',actRu(a.status))
            +'<button class="tbtn sm" data-to="pprintact" data-id="'+a.id+'">Открыть</button></div>';
        return '<div class="toli"><div><b>'+E(a.number)+'</b><div class="s">'
          +dmy(a.period_from)+' — '+dmy(a.period_to)+' · '+money(a.amount)+'</div></div>'
          +chip(a.status==='signed'?'ok':'mut',actRu(a.status))+'</div>';
      }).join('')||empty('Актов пока нет'))+'</div>';

  return h;
}

/* ═══════════════════ КАБИНЕТ ИНЖЕНЕРА ═══════════════════
   Экран телефона. Ровно тот же порядок, что в TimeBot и в разделе «Смена»:
   приехал → отметился с геометкой → чек-лист → фото → уехал. */
function renderEngineer(){
  if(T.visit===undefined)return '<div class="tonote">Загружаю…</div>';
  // Форму рисует и экран инженера. Кнопка «⚠ Замечание» ставила T.form,
  // но formBox() вызывался только в кабинете менеджера — у инженера
  // кнопка не делала ничего.
  var form=T.form?formBox():'';
  // Вкладок у инженера нет: чат открывается значком в шапке и закрывается «Назад».
  if(T.sub==='chat'&&!isMgr())return '<div class="tohead"><div class="torow tcbar">'
    +'<button class="tbtn sm io" data-to="tab" data-t="" title="Назад" aria-label="Назад">'
    +'<svg class="i"><use href="#i-left"/></svg></button><h2>Чат ТО</h2></div></div>'+chatBody();
  if(!T.visit)return form+engineerSites()+(T.calPick?calPick():'');
  return form+engineerVisit();
}
function chatBtn(){
  return '<button class="tbtn sm io tcgo" data-to="tab" data-t="chat" title="Чат ТО" aria-label="Чат ТО">'
    +'<svg class="i"><use href="#i-msg"/></svg>'+chatN()+'</button>';
}

// Экран инженера (#446, макет «35 Обслуживание — инженер») — список на
// месяц, как был в TimeBot: закрыл выезд — объект ушёл в «Сделано».
// Красная кнопка выезда одна — у ближайшего объекта; рамку карточки
// просрочка не красит, место в начале раздела и метка срока говорят сами.
function engineerSites(){
  var d=T.eng;
  // Месяцы листаются (#527): вперёд — заранее видно, куда ехать, назад —
  // что сделано и что осталось. Пределы задаёт сервер (oldest/last).
  var nav=d?('<div class="bar" style="gap:6px;margin:0">'
    +'<button class="tbtn sm" data-to="engmonth" data-m="-1"'+(d.oldest?' disabled':'')+'>‹</button>'
    +'<button class="tbtn sm" data-to="engmonth" data-m="0"'+(d.current?' disabled':'')+'>Сегодня</button>'
    +'<button class="tbtn sm" data-to="engmonth" data-m="1"'+(d.last?' disabled':'')+'>›</button>'
    +'</div>'):'';
  var h='<div class="tohead"><div class="torow"><h2>Мои объекты</h2>'+nav+(isMgr()?'':chatBtn())+'</div>';
  if(d===null||d===undefined)return h+'</div><div class="tonote">Загружаю…</div>';
  if(d===false)return h+'</div>'+err();
  var todo=d.todo||[], done=d.done||[], other=d.other||[];
  function isMine(r){return (r.call&&r.call.mine)||r.works.some(function(w){return w.mine})}
  var mine=todo.filter(isMine);
  var free=todo.filter(function(r){return !isMine(r)});
  var total=todo.length+done.length;
  h+='<div class="s">'+E(monthRu(d.month))+(total?(' · '+done.length+'/'+total):'')
    +'</div></div>'+err();
  var first=d.current!==false;  // красная кнопка «ехать» — только в текущем месяце
  function sec(title,rows){
    if(!rows.length)return '';
    return '<div class="tosec">'+E(title)+'</div>'+rows.map(function(r){
      var html=engRow(r,first); first=false; return html;}).join('');
  }
  if(!total)h+=empty(d.past?'За '+monthRu(d.month)+' работ нет'
    :d.current===false?'На '+monthRu(d.month)+' работ не запланировано. План строит менеджер ТО по договору.'
    :'Работ на месяц нет');
  // В прошлом месяце «к выполнению» — это то, что так и не сделали.
  h+=sec(d.past?'Не сделано — мои':'Мои',mine)+sec(d.past?'Не сделано — без исполнителя':'Без исполнителя',free);
  h+=engFold('done','Сделано',done,function(r){
    return dmy(r.visit.finished_at)+(r.visit.first_name?(', '+E(r.visit.first_name)):'')
      +' · отметок '+(r.visit.checks||0);});
  h+=engFold('other','Остальные объекты',other,function(r){return E(r.address);});
  return h;
}

// Свёрнутый раздел — тем же приёмом, что служебные события журнала.
function engFold(key,title,rows,sub){
  if(!rows.length)return '';
  var h='<div class="tosec">'+E(title)+'</div>';
  if(!(T.engAll||{})[key])
    return h+'<div class="tolist"><div class="toli jrgrp"><div>'
      +E(key==='done'?'Закрыто: ':'Без работ: ')+rows.length
      +'<div class="s">'+rows.slice(0,3).map(function(r){return E(r.name)}).join(' · ')
      +(rows.length>3?' …':'')+'</div></div>'
      +'<button class="tbtn sm" data-to="engall" data-g="'+key+'">Все</button></div></div>';
  return h+rows.map(function(r){
    return key==='other'?engRow(r,false):'<div class="tocard"><div class="torow"><div><b>'+E(r.name)+'</b>'
      +'<div class="s">'+sub(r)+'</div></div>'+chip('ok','сделано')+monChip(r.mon)+'</div>'
      // На объект в месяце бывает нужно приехать ещё раз (#537): доснять,
      // доделать. Ошибочный или тестовый выезд — удалить: свой инженер,
      // любой — менеджер.
      +'<div class="bar" style="gap:8px;margin:10px 0 0">'
      +'<button class="tbtn sm" data-to="vstart" data-id="'+r.id+'" data-k="extra">📍 Ещё выезд</button>'
      +(r.visit&&r.visit.id&&(r.visit.mine||isMgr())
        ?('<button class="tbtn sm" data-to="vdel" data-id="'+r.visit.id+'" data-n="'+E(r.name)+'">Удалить выезд</button>'):'')
      +'</div></div>';
  }).join('');
}

function engRow(r,go){
  var w=r.works[0], c=r.call, open=(T.engOpen||{})[r.id];
  var h='<div class="tocard"><div class="torow" data-to="engopen" data-id="'+r.id+'" style="cursor:pointer"><div><b>'+E(r.name)+'</b>'
    +'<div class="s">'+E(r.address)+'</div>'
    +(c?('<div class="s">'+callWhat(c)+'</div>'):'')
    +(w?('<div class="s">'+E(w.work||'Регламентные работы')+(w.system_title?(' · '+E(w.system_title)):'')
      +(r.works.length>1?(' · ещё '+(r.works.length-1)):'')+'</div>'):'')
    +(r.visit?('<div class="s">выезд '+d5(r.visit.finished_at)+' · работы не закрыты</div>'):'')
    +'</div><div style="text-align:right">'+(c?callChip(c.due_at):(w?visitChip(w.planned_on):''))+monChip(r.mon)+'</div></div>';
  if(open){
    if(r.works.length)
      h+='<div class="tolist" style="margin:10px 0 0">'+r.works.map(function(x){
        return '<div class="toli"><div>'+E(x.work||'Регламентные работы')
          +'<div class="s">'+E(x.system_title||'')+(x.mine?'':' · без исполнителя')+'</div></div>'
          +'<div class="torow" style="gap:6px">'+visitChip(x.planned_on)
          +'<button class="tbtn sm" data-to="calitem" data-id="'+x.plan_id+'">Дата</button></div></div>';}).join('')+'</div>';
    if(r.contact_name||r.contact_phone)
      h+='<div class="torow" style="margin:10px 0 0;gap:8px"><div class="s">'+E(r.contact_name||'')
        +(r.contact_phone?(' · '+E(r.contact_phone)):'')+'</div>'
        +(r.contact_phone?('<a class="tbtn sm" href="tel:'+E(r.contact_phone.replace(/[^\d+]/g,''))+'">Позвонить</a>'):'')+'</div>';
    if(r.mon){
      var ej=(T.ejr||{})[r.id];
      h+='<div style="margin:10px 0 0">'+critBanner(r.mon)
        +monLine(r.mon,null,'<label class="tbtn sm">Загрузить CSV'
          +'<input type="file" accept=".csv,text/csv" id="toJournal" data-site="'+r.id+'" style="display:none"></label>')
        +(!ej||ej.data===null?'<div class="tonote">Загружаю…</div>'
          :(ej.data===false?'':evList(ej.data.events||[],{open:ej.open,name:'e'+r.id},null,ej.data.categories)))
        +'</div>';
    }
  }
  return h+'<button class="tbtn'+(go?' go':'')+'" data-to="vstart" data-id="'+r.id+'" style="margin-top:10px">'
    +'📍 Открыть выезд</button></div>';
}

function engineerVisit(){
  var v=T.visit;
  var h='<div class="tohead"><div class="torow"><h2>'+E(v.site_name)+'</h2>'+(isMgr()?'':chatBtn())+'</div>'
       +'<div class="s">'+E(v.address)+'</div>'
       +'<div class="s">выезд открыт в '+hhmm(v.started_at)+' · фото '+(v.photos||0)
       +(v.geo_drift_m!=null?(' · '+v.geo_drift_m+' м от точки объекта'):'')+'</div></div>'+err();

  // Первый выезд по договору сервер сам отмечает первичным осмотром (#79):
  // всё найденное уйдёт в акт первичного осмотра, а не в замечания ТО.
  var init=v.kind==='initial';
  if(init)
    h+='<div class="tostep"><div><b>Первичный осмотр</b><div class="s">'
      +'Запишите все недостатки, которые есть на объекте до начала обслуживания: они войдут в акт первичного осмотра.'
      +'</div></div><button class="tbtn sm" data-to="vkind" data-v="">Это не первичный</button></div>';
  else if(v.kind==='plan')
    h+='<div class="bar" style="margin:0 0 10px"><button class="tbtn sm" data-to="vkind" data-v="1">'
      +'Отметить как первичный осмотр</button></div>';

  // Две кнопки, потому что capture на телефоне открывает только камеру, а
  // в галерею с него не попасть — снятое заранее инженер приложить не мог (#542).
  h+='<div class="bar" style="gap:8px;margin:0 0 12px;flex-wrap:wrap">'
    +'<label class="tbtn go" style="flex:1;cursor:pointer"><svg class="i"><use href="#i-cam"/></svg><span class="lbl">Снять фото</span>'
    +'<input type="file" accept="image/*" capture="environment" class="toPhoto" style="display:none"></label>'
    +'<label class="tbtn go" style="flex:1;cursor:pointer"><svg class="i"><use href="#i-imp"/></svg><span class="lbl">Из галереи</span>'
    +'<input type="file" accept="image/*" multiple class="toPhoto" style="display:none"></label>'
    +'<button class="tbtn" data-to="newdefect" style="flex:1">⚠ '+(init?'Недостаток':'Замечание')+'</button></div>';

  var cl=T.checklist;
  if(cl===null)h+='<div class="tonote">Загружаю чек-лист…</div>';
  else if(!cl.due.length)h+=empty('По этому объекту сейчас нет работ, у которых подошёл срок. Отметьте фактически выполненное вручную ниже.');
  else h+=cl.due.map(function(d,di){
    var items=(d.items||[]);
    return '<div class="tocard"><div class="torow"><div><b>'+E(d.work||'Регламентные работы')+'</b>'
      +'<div class="s">'+E(d.system_title||'')+' · '+E(perRu(d.period_kind))
      +(d.doc_ref?('<br>'+E(d.doc_ref)):'')+'</div></div>'+dueChip(d.due_on)+'</div>'
      +'<div class="tochecks">'+items.map(function(it,ii){
         var k=d.plan_id+':'+ii, cur=(T.marks[k]||{}).result||'';
         return '<div class="tocheck"><div class="t">'+E(it.code?(it.code+'. '):'')+E(it.text)
           +(it.method?('<div class="s">'+E(it.method)+'</div>'):'')+'</div>'
           +'<div class="tomarks">'
           +['ok','fault','na'].map(function(r){
              return '<button class="tbtn sm'+(cur===r?' go':'')+'" data-to="mark" data-k="'+k+'" data-r="'+r
                +'" data-plan="'+d.plan_id+'" data-sys="'+(d.system_id||'')+'" data-code="'+E(it.code||'')
                +'" data-text="'+E(it.text)+'">'+({ok:'✓',fault:'✗',na:'—'}[r])+'</button>';}).join('')
           +'</div></div>';
       }).join('')+'</div>'
      +'<div class="bar" style="margin:8px 0 0"><button class="tbtn sm" data-to="markall" data-d="'+di+'">Все в норме</button></div>'
      +'</div>';
  }).join('');

  if(cl&&cl.defects_open&&cl.defects_open.length){
    h+='<div class="tosec">Незакрытые замечания по объекту</div><div class="tolist">'
      +cl.defects_open.map(function(x){
        // Записано по ошибке — удалить может любой, в любой момент (#537).
        return '<div class="toli"><div><b>'+E(x.title)+'</b><div class="s">'+dmy(x.found_on)+'</div></div>'
          +'<div class="torow" style="gap:6px">'+chip(sevCls(x.severity),stRu(x.status))
          +'<button class="tbtn sm" data-to="defdel" data-id="'+x.id+'" data-n="'+E(x.title)+'">Удалить</button>'
          +'</div></div>';}).join('')+'</div>';
  }

  var n=Object.keys(T.marks).length;
  h+='<div class="tofoot"><button class="tbtn go" data-to="vstop">'
    +'Завершить выезд'+(n?(' · отметок '+n):'')+'</button>'
    +'<div class="s" style="text-align:center;margin-top:6px">'
    +(init||v.kind==='extra'?'Без фото выезд не закрывается':'Без отметок и без фото выезд не закрывается')+'</div>'
    // Открыл выезд по ошибке — вернуться к списку объектов без менеджера (#537).
    +'<div class="bar" style="margin:10px 0 0;justify-content:center">'
    +'<button class="tbtn sm" data-to="vcancel">← Назад: отменить выезд</button></div></div>';
  return h;
}

/* ═══════════════════ КАБИНЕТ МЕНЕДЖЕРА ═══════════════════ */
function renderManager(){
  if(!T.sub)T.sub='sites';
  // Доступы заказчиков отдельной вкладкой были ошибкой: доступ выдаётся
  // ПОСЛЕ договора и всегда конкретному заказчику, а вкладка отрывала его
  // от договора и заставляла вспоминать, кому и куда. Теперь он живёт в
  // карточке договора, рядом с тем, из чего вытекает.
  var list=[['metrics','Метрики'],['sites','Объекты'],['chat','Чат'],['plan','Календарь'],['contracts','Договоры'],
             ['acts','Акты'],['cps','Юрлица'],['staff','Люди']]
             .concat(isEng()?[['eng','Кабинет инженера']]:[]);
  // Кабинет инженера сам рисует и ошибку, и форму — второй раз не нужно.
  if(T.sub==='eng'&&isEng())return tabs(list)+renderEngineer();
  var b={metrics:mMetrics,sites:mSites,chat:chatBody,plan:mPlan,contracts:mContracts,acts:mActs,
         cps:mCps,staff:mStaff}[T.sub]||mSites;
  tabActs='';
  var body=b(), acts=tabActs;
  tabActs=null;
  return tabs(list,acts)+err()+(T.form?formBox():'')+body;
}

/* ── Метрики отдела (#512). Пять чисел за месяц; чего данных нет — прочерк,
   а не ноль. Доля «в срок» из малого числа выездов показывается как «a из b»:
   «100 %» из одного выезда ничего не говорит. */
var MET_SMALL=5;
function cap(t){return t.charAt(0).toUpperCase()+t.slice(1);}
function metIso(){return T.metY+'-'+('0'+T.metM).slice(-2);}
function metTile(cls,ico,lab,val,na,dl,go,tip){
  var inner='<div class="r"><div class="ic"><svg class="i"><use href="#'+ico+'"/></svg></div>'
    +'<div><div class="lb">'+E(lab)+'</div><div class="vl'+(na?' na':'')+'">'+val+'</div></div></div>'
    +'<div class="dl">'+E(dl)+'</div><div class="gl"></div>';
  return go
    ?'<button type="button" class="k go'+(cls?' '+cls:'')+'" data-to="metgo" data-t="'+go+'"'
      +(tip?' title="'+E(tip)+'"':'')+'>'+inner+'</button>'
    :'<div class="k'+(cls?' '+cls:'')+'">'+inner+'</div>';
}
// Сумма в плитке — три значащие цифры, округление вниз: на узкой плитке
// «1 250 000 ₽» обрезалось бы. Точная сумма уходит в подсказку.
function metShort(n){
  if(n<10000)return {v:new Intl.NumberFormat('ru-RU').format(Math.floor(n)),u:''};
  var big=n>=1e6, x=n/(big?1e6:1e3), d=x>=100?0:(x>=10?1:2), k=Math.pow(10,d);
  var f=Math.floor(x*k+1e-9)/k;
  return {v:String(f).replace('.',','),u:big?'млн':'тыс'};
}
function metExact(n){return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' ₽';}
// Значок в строке обязателен: decorate() переписывает кнопку без svg.i в «значок + подпись».
function metList(title,rows,more,bad){
  if(!rows.length)return '';
  return '<div class="mcol"><div class="lb">'+E(title)+'</div>'+rows.map(function(r){
    return '<button type="button" class="mrow" data-to="metsite" data-id="'+r.site_id+'">'
      +'<span class="nm">'+E(r.name||('объект '+r.site_id))+'</span>'
      +'<span class="mv'+(bad?' bad':'')+'">'+r.count+' · с '+E(d5(r.oldest))+'</span>'
      +'<svg class="i"><use href="#i-right"/></svg></button>';
  }).join('')+(more?'<div class="s">ещё '+more+'</div>':'')+'</div>';
}
function mMetrics(){
  var h='<div class="tohead"><div class="torow"><h2>'+E(cap(monthRu(metIso())))+'</h2>'
    +'<div class="bar mtnav" style="gap:6px;margin:0">'
    +'<button class="tbtn sm" data-to="metmove" data-d="-1" title="Прошлый месяц"><svg class="i"><use href="#i-left"/></svg></button>'
    +'<button class="tbtn sm" data-to="metmove" data-d="1" title="Следующий месяц"><svg class="i"><use href="#i-right"/></svg></button>'
    +'</div></div></div>';
  if(T.met===null)return h+'<div class="tonote">Загружаю…</div>';
  if(T.met===false)return h+'<div class="tonote warn">Метрики не загрузились: '+E(T.metErr)
    +' <button class="lnk" data-to="metreload" title="Повторить"><svg class="i"><use href="#i-refr"/></svg></button></div>';
  var m=T.met, rev=m.revenue, ot=m.on_time;
  if(!rev.contracts&&!m.overdue.value&&!m.defects.value&&!ot.total)
    return h+empty('Договоров нет. Метрики появятся с первым договором.');
  var revDl=[];
  if(rev.value===null)revDl.push('цен нет');
  else if(rev.without_price)revDl.push(rev.without_price+' без цены');
  if(rev.vat_mixed)revDl.push('с НДС и без');
  var revShort=rev.value===null?null:metShort(rev.value);
  var otNa=ot.value===null, otSmall=!otNa&&ot.total<MET_SMALL;
  var late=m.overdue, defs=m.defects;
  var lateObj=late.sites.length+late.more, oldest=defs.sites.length?defs.sites[0].oldest:null;
  return h+'<div class="kp">'
    +metTile('','i-bld','Объектов',String(m.objects.value),false,'','sites')
    +metTile('','i-rub','Выручка, ₽',revShort?(E(revShort.v)+(revShort.u?' <small>'+revShort.u+'</small>':'')):'—',rev.value===null,
             revDl.join(' · '),'contracts',rev.value===null?'':'Плановая выручка в месяц: '+metExact(rev.value))
    +metTile('','i-clock','В срок',otNa?'—':(otSmall?(ot.in_time+' из '+ot.total):Math.round(ot.value*100)+'%'),otNa,
             otNa?'выездов не было':(otSmall?'':(ot.in_time+' из '+ot.total)),'plan')
    +metTile(late.value?'bad':'','i-warn','Просрочено',String(late.value),false,late.value?('объектов: '+lateObj):'')
    +metTile(defs.value?'bad':'','i-flag','Замечаний',String(defs.value),false,oldest?('с '+d5(oldest)):'')
    +'</div><div class="mtl">'
    +metList('Просрочено',late.sites,late.more,true)+metList('Замечания',defs.sites,defs.more,true)+'</div>';
}

function mSites(){
  if(T.tb!==null||T.tbOpen)return mTb();
  if(T.site)return mSiteCard();
  var h=lift('<button class="tbtn" data-to="tbopen">↓ Перенести из TimeBot</button>'
       +'<button class="tbtn go" data-to="form" data-f="site">＋ Адрес</button>')
       +'<div class="bar" style="margin:0 0 10px"><input class="f" id="toq" placeholder="Поиск по названию или адресу…" value="'+E(T.q)+'" style="flex:1"></div>';
  if(T.sites===null)return h+'<div class="tonote">Загружаю…</div>';
  if(!T.sites.length)return h+empty('Адресов пока нет. Заведите первый — потом к нему привяжете юрлица, системы и договор.');
  return h+T.sites.map(function(s){
    return '<div class="tocard" data-to="site" data-id="'+s.id+'"><div class="torow"><div>'
      +'<b>'+E(s.name)+'</b><div class="s">'+E(s.address)+'</div>'
      +'<div class="s">'+(s.parties?E(s.parties):'юрлица не привязаны')+'</div></div>'
      +(s.call_due?callChip(s.call_due):(s.overdue?chip('bad','просрочено '+s.overdue):dueChip(s.next_due)))+'</div>'
      +'<div class="s" style="margin-top:8px">систем '+(s.systems||0)
      +' · замечаний '+(s.defects_open||0)
      +(s.last_visit?(' · последний выезд '+dmy(s.last_visit)):' · выездов не было')+'</div></div>';
  }).join('');
}

// ── Перенос объектов из TimeBot ──────────────────────────────────────
// Отбор руками, а не автоматически. В базе бота нет ни адреса отдельным
// полем, ни признака «это ТО» — только название сделки в свободной форме.
// Разбор предлагается, решает человек: угаданный адрес это потом акт,
// выписанный не туда.
function mTb(){
  var h='<div class="tohead"><div class="torow"><h2>Перенос из TimeBot</h2>'
    +'<button class="tbtn" data-to="tbclose">‹ К адресам</button></div>'
    +'<div class="s">Объекты бота с их сделками amoCRM. Отметьте те, что берём на '
    +'обслуживание. Название сделки разобрано на заказчика, адрес и вид работ — '
    +'проверьте адрес, при необходимости поправьте прямо здесь.</div></div>';

  if(T.tb===null)return h+'<div class="tonote">Загружаю объекты бота…</div>';
  if(T.tb===false)return h+'<div class="tonote warn">'+E(T.err||'Не удалось получить объекты бота')+'</div>';

  var items=T.tb.items||[];
  var n=Object.keys(T.tbPick).filter(function(k){return T.tbPick[k]}).length;

  h+='<div class="bar" style="margin:0 12px 10px;gap:6px;flex-wrap:wrap">'
    +'<input class="tf" id="tbq" placeholder="Поиск по названию сделки…" value="'+E(T.tbQ)+'" style="flex:1;min-width:200px;height:38px">'
    +'<button class="tbtn sm'+(T.tbNew?' go':'')+'" data-to="tbnew">Только новые</button>'
    +'<button class="tbtn sm'+(T.tbNew?'':' go')+'" data-to="tball">Все</button>'
    +'</div>';

  if(!items.length)return h+empty(T.tbNew
    ? 'Все объекты бота уже перенесены — либо по запросу ничего не нашлось.'
    : 'Объектов не нашлось.');

  h+='<div class="s" style="margin:0 14px 8px">Показано '+items.length
    +(T.tb.already?(' · уже перенесено '+T.tb.already):'')+'</div>';

  h+=items.map(function(x,i){
    var p=T.tbEdit[x.id]||x.parsed||{};
    var on=!!T.tbPick[x.id];
    if(x.imported)
      return '<div class="tocard" style="opacity:.6"><div class="torow"><div>'
        +'<b>'+E(x.name)+'</b><div class="s">сделка '+E(x.amo_id)+'</div></div>'
        +chip('ok','перенесён')+'</div></div>';
    return '<div class="tocard'+(on?' tbon':'')+'">'
      +'<div class="torow"><label class="tbchk"><input type="checkbox" data-to="tbpick" data-id="'
      +x.id+'"'+(on?' checked':'')+'><span><b>'+E(x.name)+'</b>'
      +'<div class="s">сделка '+E(x.amo_id)
      +' · выездов '+(x.shifts||0)
      +(x.last_shift?(' · последний '+dmy(x.last_shift)):' · выездов не было')+'</div></span></label>'
      +(p.confident?chip('ok','адрес разобран'):chip('warn','проверьте адрес'))+'</div>'
      +(on?('<div class="tfgrid" style="margin-top:12px">'
        +'<div class="tfield"><div class="tflab">Заказчик</div>'
        +'<input class="tf'+(p.customer?'':' empty')+'" data-tbf="customer" data-id="'+x.id
        +'" value="'+E(p.customer||'')+'" placeholder="например, ООО «Северный»"></div>'
        +'<div class="tfield"><div class="tflab">Вид работ</div>'
        +'<input class="tf'+(p.work?'':' empty')+'" data-tbf="work" data-id="'+x.id
        +'" value="'+E(p.work||'')+'" placeholder="например, АУГПТ"></div>'
        +'<div class="tfield wide"><div class="tflab">Адрес<i>обязательно</i></div>'
        +'<input class="tf'+(p.address?'':' empty')+'" data-tbf="address" data-id="'+x.id
        +'" value="'+E(p.address||'')+'" placeholder="город, улица, дом"></div>'
        +'<div class="tfield"><div class="tflab">Этаж</div>'
        +'<input class="tf empty" data-tbf="floor" data-id="'+x.id+'" placeholder="например, 3"></div>'
        +'<div class="tfield"><div class="tflab">Помещения</div>'
        +'<input class="tf empty" data-tbf="room" data-id="'+x.id+'" placeholder="например, 204"></div>'
        +'</div>'):'')
      +'</div>';
  }).join('');

  h+='<div class="tofoot"><button class="tbtn go" data-to="tbapply"'+(n?'':' disabled')+'>'
    +(n?('Перенести отмеченные · '+n):'Отметьте объекты для переноса')+'</button>'
    +'<div class="s" style="text-align:center;margin-top:6px">Связь со сделкой amoCRM сохранится — '
    +'история выездов из бота будет видна в карточке объекта</div></div>';
  return h;
}

// Время события — как его записал прибор, из строки, а не через Date:
// журнал ведётся по часам объекта, и пересчёт в пояс браузера сдвинул бы
// его относительно выгрузки, с которой сверяются.
function dtm(v){return v?dmy(v)+' '+String(v).slice(11,16):'—';}
// Коротко, без года — там, где год очевиден: строки на телефоне узкие.
function dm(v){return v?dmy(v).slice(0,5)+' '+String(v).slice(11,16):'—';}
function d5(v){return v?dmy(v).slice(0,5):'—';}

// Что за вызов — одной строкой: сигнал прибора или слова заказчика.
function callWhat(c){
  if(c.source==='signal')return 'Неисправность'+(c.event?(' · '+E(c.event)):'')+(c.zone?(' · '+E(c.zone)):'');
  return 'Вызов заказчика'+(c.note?(' · '+E(c.note)):'');
}

// Вызовы инженера (#454, #444): кнопка заказчика и неисправность с прибора.
// Блок появляется, только когда вызовы есть, — пустой список был бы шумом.
function requestsBox(s){
  var r=T.sreq; if(!r||String(r.site)!==String(s.id)||!r.rows||!r.rows.length)return '';
  var st={new:['warn','новая'],accepted:['ok','принята'],closed:['mut','закрыта']};
  return '<div class="tosec">Вызовы</div><div class="tolist">'+r.rows.map(function(x){
    var who=[x.first_name,x.last_name].filter(Boolean).join(' ');
    var eng=[x.eng_first,x.eng_last].filter(Boolean).join(' ');
    return '<div class="toli"><div><b>'+dtm(x.created_at)+(who?(' · '+E(who)):'')+'</b>'
      +'<div class="s">'+callWhat(x)+'</div>'
      +(x.status!=='closed'?('<div class="s">'+(eng?E(eng):'без исполнителя')+'</div>'):'')+'</div>'
      +'<div style="text-align:right">'+(x.status==='closed'?'':callChip(x.due_at))+chip(st[x.status][0],st[x.status][1])
      +(x.status==='new'?'<button class="tbtn sm go" data-to="reqmove" data-v="accept" data-id="'+x.id+'" data-site="'+s.id+'">Принять</button>':'')
      +(x.status==='accepted'?'<button class="tbtn sm" data-to="reqmove" data-v="close" data-id="'+x.id+'" data-site="'+s.id+'">Закрыть</button>':'')
      +'</div></div>';
  }).join('')+'</div>';
}

// Письма о сигналах (#443): кому уходят и ушли ли. Письмо, которое не
// ушло, по договору считается неполученным — причина видна здесь, а не
// только в журнале сервиса.
function noticeBox(d){
  var nf=d.notify||{}, em=nf.emails||[], cats=d.categories||{}, ns=d.notices||[];
  var h='<div class="tosec">Письма о сигналах</div>'
    +'<div class="tonote'+(em.length?'':' warn')+'">'
    +(em.length?(E(em.join(', '))
        +(nf.autostart_off_minutes?(' · автопуск > '+nf.autostart_off_minutes+' мин'):' · автопуск без писем'))
      :'Писем нет: нет договора с мониторингом')
    +'</div>';
  if(!ns.length)return h;
  return h+'<div class="tolist">'+ns.map(function(n){
    return '<div class="toli"><div><b>'+E(cats[n.category]||n.category)+'</b>'
      +'<div class="s">'+E(n.event)+(n.zone?(' · '+E(n.zone)):'')+' · '+dtm(n.occurred_at)+'</div>'
      +(n.error?('<div class="s">'+E(n.error)+'</div>'):'')+'</div>'
      +(n.sent_at?chip('ok','ушло '+dm(n.sent_at)):chip(n.error?'bad':'mut',n.error?'не ушло':'в очереди'))
      +'</div>';
  }).join('')+'</div>';
}

// Журнал прибора объекта (#78). Блок прямо говорит, откуда данные и насколько
// они свежие: объект без передатчика не должен выглядеть подключённым, а
// передатчик, который молчит дольше порога, — «на связи».
function linkLine(lk){
  if(!lk)return '';
  return '<div class="tonote" title="'+E('События приходят от передатчика сами (SIA DC-09). «Нет связи» — '
      +'молчит дольше '+lk.silence_minutes+' мин, включая тестовые сообщения')+'">передатчик '+E(lk.account)+' '
    +chip(lk.online?'ok':'bad',lk.online?'на связи':'нет связи')
    +' · '+(lk.last_seen_at?('обмен '+dtm(lk.last_seen_at)):'обмена не было')+'</div>';
}
function journalBox(s){
  var j=T.jr, up=isMgr()||isEng();
  var h='<div class="tosec">Журнал прибора'
    +(isMgr()?('<button class="tbtn sm" data-to="form" data-f="plink" data-id="'+s.id+'">Передатчик</button>'):'')
    +(up?('<label class="tbtn sm">Загрузить CSV<input type="file" accept=".csv,text/csv" '
      +'id="toJournal" data-site="'+s.id+'" style="display:none"></label>'):'')+'</div>';
  if(!j||String(j.site)!==String(s.id)||j.data===null)return h+'<div class="tonote">Загружаю…</div>';
  if(j.data===false)return h+'<div class="tonote warn">'+E(j.err)+'</div>';
  var d=j.data, st=d.stored||{}, li=d.last_import;
  h+=linkLine(d.link);
  if(!st.n)return h+empty(d.link?'Событий пока нет':'Событий нет — загрузите CSV из веб-интерфейса прибора');
  h+='<div class="tonote" title="'+E((d.link?'':'Прибор не передаёт события сам — журнал пополняется загрузкой выгрузки. ')
      +'Хранится с '+dmy(st.first_at)+(li?(', в последнем файле события по '+dtm(li.last_at)):''))+'">'
    +(li?('загрузка '+dm(li.created_at)+(li.first_name?(', '+E(li.first_name)):'')
      +' · новых '+li.rows_new+' · '):'')+'всего '+st.n+'</div>';
  h+=noticeBox(d);
  var ev=d.event||'';
  h+='<div class="tofields" style="margin:0 0 10px">'
    +'<label class="tofield"><span>С</span><input class="f" type="date" id="jrFrom" value="'+E(d.date_from)+'"></label>'
    +'<label class="tofield"><span>По</span><input class="f" type="date" id="jrTo" value="'+E(d.date_to)+'"></label>'
    +'<label class="tofield"><span>Событие</span><select class="f" id="jrEv"><option value="">все события</option>'
    +(d.kinds||[]).map(function(x){return '<option value="'+E(x.event)+'"'+(x.event===ev?' selected':'')+'>'
      +E(x.event)+' · '+x.n+'</option>';}).join('')+'</select></label></div>'
    +'<div class="bar" style="margin:0 0 10px;gap:6px;flex-wrap:wrap">'
    +'<button class="tbtn sm go" data-to="jrshow" data-id="'+s.id+'">Показать</button>'
    +'<button class="tbtn sm" data-to="jrcsv" data-id="'+s.id+'">Скачать CSV</button></div>';
  var rows=d.events||[];
  if(!rows.length)return h+empty('Событий нет');
  if(d.total>rows.length)
    h+='<div class="tonote" title="Сузьте период или скачайте CSV">'+rows.length+' из '+d.total+'</div>';
  j.open=j.open||{};
  return h+evList(rows,{open:j.open,name:'m'},null,d.categories);
}

// Работы одного месяца под строкой месяца. Нажатие на работу раскрывает
// перечень операций из регламента — тот же, что инженер отмечает на выезде.
function planMonth(list){
  return list.map(function(p){
    var who=[p.first_name,p.last_name].filter(Boolean).join(' ');
    var open=T.planW===p.id;
    var items=Array.isArray(p.items)?p.items:[];
    return '<div class="toli nest col" data-to="planw" data-id="'+p.id+'"><div class="torow"><div>'
      +'<b>'+E(p.work||'Регламентные работы')+'</b>'
      +'<div class="s">'+E(p.system_title||'')+' · срок '+dmy(p.due_on)
      +(p.planned_on?(' · выезд '+dmy(p.planned_on)):'')+'</div>'
      +'<div class="s">'+(who?('исполнитель: '+E(who)):'исполнитель не назначен')+'</div></div>'
      +dueChip(p.due_on,p.status)+'</div>'
      +(open?('<div class="s" style="margin-top:8px">'+E(perRu(p.period_kind))
        +(p.doc_ref?(' · '+E(p.doc_ref)):'')+'</div>'
        +(items.length?('<ol>'+items.map(function(it){return '<li>'+E(it.text||'')+'</li>';}).join('')+'</ol>')
          :'<div class="s">Перечень операций в регламенте не заполнен.</div>')
        +(p.note?('<div class="s">'+E(p.note)+'</div>'):''))
        :'<div class="s">нажмите — что нужно сделать</div>')
      +'</div>';
  }).join('');
}

function mSiteCard(){
  var d=T.site; if(d===true)return '<div class="tonote">Загружаю…</div>';
  var s=d.site;
  var parties=d.parties||[], systems=d.systems||[], contracts=d.contracts||[], plan=d.plan||[];

  var h='<div class="tohead"><button class="tbtn sm" data-to="sback">‹ Все объекты</button>'
       +'<div class="torow" style="margin-top:12px"><div><h2>'+E(s.name)+'</h2>'
       +'<div class="s">'+E(s.address)
       +(s.floor?(' · этаж '+E(s.floor)):'')+(s.room?(' · пом. '+E(s.room)):'')+'</div>'
       +'<div class="s">'+(s.verified?'адрес сверен по справочнику'
            :'адрес введён вручную — геометка выездов проверяться не будет')+'</div></div>'
       +'<div class="torow">'
       +(typeof can==='function'&&can('spec:write')?'<button class="tbtn sm" data-to="kp"><svg class="i"><use href="#i-file"/></svg><span class="lbl">КП в Google</span></button>'
         +'<button class="tbtn sm" data-to="letter"><svg class="i"><use href="#i-edit"/></svg><span class="lbl">Исх.письмо</span></button>':'')
       +(s.amo_id&&/^\d+$/.test(s.amo_id)&&typeof can==='function'&&can('spec:read')&&window.crmOpenDeal
         ?'<button class="tbtn sm" data-to="crmdeal" data-id="'+E(s.amo_id)+'" title="Сделка №'+E(s.amo_id)+' в разделе «CRM»">'
           +'<svg class="i"><use href="#i-link"/></svg><span class="lbl">Сделка в CRM</span></button>':'')
       +'<button class="tbtn sm" data-to="form" data-f="site" data-id="'+s.id+'">Изменить</button></div></div></div>';

  // Пошаговая подсказка. Раньше объект без данных показывал пять пустых
  // блоков подряд, и по ним было не понять, что делать первым. Теперь
  // видно только следующий шаг — и кнопка, которая его делает.
  var step=null;
  if(!parties.length)      step=['Шаг 1. Привяжите юрлицо','Кто платит за обслуживание этого объекта. На одном адресе их может быть несколько.','form','party'];
  else if(!systems.length) step=['Шаг 2. Добавьте системы','Что именно обслуживается: АУПС, СОУЭ, АУГПТ, ВПВ. К системе сама подтянется периодичность работ.','form','system'];
  else if(!contracts.length)step=['Шаг 3. Заведите договор','Во вкладке «Договоры». Из него строится план работ и выпускаются акты.','tab','contracts'];
  else if(!plan.length)    step=['Шаг 4. Постройте план работ','Одна кнопка в карточке договора — работы разложатся по календарю на год вперёд.','tab','contracts'];
  if(step)
    h+='<div class="tostep"><div><b>'+E(step[0])+'</b><div class="s">'+E(step[1])+'</div></div>'
      +'<button class="tbtn go" data-to="'+step[2]+'"'
      +(step[2]==='form'?(' data-f="'+step[3]+'" data-id="'+s.id+'"'):(' data-t="'+step[3]+'"'))
      +'>'+(step[2]==='form'?'Добавить':'Перейти')+'</button></div>';

  h+='<div class="tosec">Юрлица на адресе'
    +'<button class="tbtn sm" data-to="form" data-f="party" data-id="'+s.id+'">＋ Привязать</button></div>'
    +'<div class="tolist">'+(parties.map(function(p){
      var role={owner:'собственник',payer:'плательщик — ему уходит акт',operator:'эксплуатирующая'}[p.party_role]||p.party_role;
      return '<div class="toli"><div><b>'+E(p.name)+'</b><div class="s">'+E(role)
        +(p.inn?(' · ИНН '+E(p.inn)):'')+'</div></div>'
        +'<button class="tbtn sm" data-to="delparty" data-id="'+p.id+'" data-site="'+s.id+'">Убрать</button></div>';
    }).join('')||empty('Пока никого. Юрлицо нужно, чтобы было кому выставлять акт.'))+'</div>';

  h+='<div class="tosec">Системы'
    +'<button class="tbtn sm" data-to="form" data-f="system" data-id="'+s.id+'">＋ Система</button></div>'
    +'<div class="tolist">'+(systems.map(function(y){
      return '<div class="toli"><div><b>'+E(y.title)+'</b><div class="s">'+E(sysRu(y.kind))
        +(y.brand?(' · '+E(y.brand)+(y.model?(' '+E(y.model)):'')):'')
        +(y.zones_count?(' · '+y.zones_count+' зон'):'')
        +(y.modules_count?(' · модулей '+y.modules_count):'')
        +'</div>'
        +'<div class="s">'+(y.regs?('регламентных работ: '+y.regs)
                                  :'регламента нет — в план не попадёт')+'</div></div>'
        +(y.regs?chip('ok','в плане'):chip('warn','нет регламента'))
        // Правки системы не было вовсе: завёл с опечаткой — и живи с ней.
        // Ручка PUT /to/systems/{id} была написана сразу, кнопки к ней не было.
        +'<button class="tbtn sm" data-to="form" data-f="system" data-id="'+s.id
        +'" data-sys="'+y.id+'">Изменить</button></div>';
    }).join('')||empty('Систем нет. Пока их нет, план работ строить не из чего.'))+'</div>';

  h+='<div class="tosec">Договоры</div><div class="tolist">'
    +(contracts.map(function(k){
      return '<div class="toli"><div><b>'+E(k.number)+'</b><div class="s">'+E(k.counterparty)
        +' · '+dmy(k.period_from)+' — '+(k.period_to?dmy(k.period_to):'бессрочно')
        +' · '+money(k.price)+' '+E(perRu(k.billing_period))+'</div></div>'
        +chip(k.status==='active'?'ok':'mut',contrRu(k.status))+'</div>';
    }).join('')||empty('Договоров нет. Заводятся во вкладке «Договоры».'))+'</div>';

  h+=requestsBox(s);
  h+=journalBox(s);

  // План на карточке объекта — тоже сводка по месяцам, а не список работ:
  // у объекта с четырьмя системами это полсотни строк в год, и карточка
  // превращалась в ленту, по которой не найти ни одного ответа.
  var late=plan.filter(function(p){return p.status==='planned'&&p.due_on<today()});
  var done=plan.filter(function(p){return p.status==='done'}).length;
  var byM={};
  plan.forEach(function(p){var k=String(p.due_on).slice(0,7)+'-01';
    var m=byM[k]=byM[k]||{n:0,d:0,l:0};m.n++;if(p.status==='done')m.d++;
    if(p.status==='planned'&&p.due_on<today())m.l++;});
  h+='<div class="tosec">План работ'
    +(plan.length?('<span class="s">выполнено '+done+' из '+plan.length
      +(late.length?(' · просрочено '+late.length):'')+'</span>'):'')+'</div>'
    +'<div class="tolist">'+(Object.keys(byM).sort().map(function(k){
      var m=byM[k];
      var open=T.planM&&T.planM.site===s.id&&T.planM.m===k;
      return '<div class="toli" data-to="planm" data-id="'+s.id+'" data-m="'+k+'">'
        +'<div><b>'+E(monthRu(k))+'</b><div class="s">работ '+m.n+' · '+(open?'скрыть':'показать')+'</div></div>'
        +(m.l?chip('bad','просрочено '+m.l):(m.d>=m.n?chip('ok','всё выполнено'):chip('mut',m.d+' из '+m.n)))
        +'</div>'
        +(open?planMonth(plan.filter(function(p){return String(p.due_on).slice(0,7)+'-01'===k;})):'');
    }).join('')||empty('План не построен. Он строится одной кнопкой в карточке договора.'))+'</div>'
    +(plan.length?'<div class="s" style="margin:6px 14px 0">Нажмите на месяц — откроется список работ.</div>':'');

  function defRow(x){
      // «Удалить» — у любого замечания, и у устранённого тоже (#537).
      var del='<button class="tbtn sm" data-to="defdel" data-id="'+x.id+'" data-n="'+E(x.title)+'">Удалить</button>';
      var btns='<div class="bar" style="margin:8px 0 0;gap:6px;flex-wrap:wrap">'
        +((x.status!=='fixed')
          ?([['agreed','Заказчик согласовал'],['declined','Заказчик отказался'],['fixed','Устранено']]
            .map(function(a2){return '<button class="tbtn sm" data-to="defst" data-id="'+x.id+'" data-v="'+a2[0]+'">'+a2[1]+'</button>';}).join('')
            +'<button class="tbtn sm" data-to="defedit" data-id="'+x.id+'">Изменить</button>'):'')
        +del+'</div>';
      var where=[x.location,x.floor].filter(Boolean).join(', ');
      return '<div class="toli col"><div class="torow"><div><b>'+E(x.title)+'</b>'
        +'<div class="s">'+dmy(x.found_on)+(where?(' · '+E(where)):'')+' · '+E(x.system_title||'')+' · '+E(sevRu(x.severity))
        +(x.fix_price?(' · устранение '+money(x.fix_price)):'')+'</div>'
        +(x.norm_ref?('<div class="s">'+E(x.norm_ref)+'</div>'):'')
        +(x.remedy?('<div class="s">Устранение: '+E(x.remedy)+'</div>'):'')+'</div>'
        +chip(x.status==='fixed'?'ok':sevCls(x.severity),stRu(x.status))+'</div>'+btns+'</div>';
  }
  // Недостатки первичного осмотра — «было до нас», отдельно от замечаний ТО.
  var defInit=(d.defects||[]).filter(function(x){return x.initial;});
  if(defInit.length)
    h+='<div class="tosec">Недостатки первичного осмотра</div><div class="tolist">'
      +defInit.map(defRow).join('')+'</div>';
  h+='<div class="tosec">Замечания</div><div class="tolist">'
    +((d.defects||[]).filter(function(x){return !x.initial;}).map(defRow).join('')||empty('Замечаний нет.'))+'</div>';

  if((d.acts||[]).length)
    h+='<div class="tosec">Акты</div><div class="tolist">'
      +d.acts.map(function(a){
        var init=a.period_kind==='initial';
        return '<div class="toli"><div><b>'+(init?'Первичный осмотр · ':'')+E(a.number)+'</b><div class="s">'
          +(init?dmy(a.period_from):(dmy(a.period_from)+' — '+dmy(a.period_to)+' · '+money(a.amount)))+'</div></div>'
          +chip(a.status==='signed'?'ok':(a.status==='draft'?'mut':'warn'),actRu(a.status))
          +'<button class="tbtn sm" data-to="printact" data-id="'+a.id+'" data-f="'+(init?'initial':'act')+'">🖨 Печать</button></div>';
      }).join('')+'</div>';

  // История из бота — до собственных выездов: по большинству объектов
  // своих ещё нет, а в боте накоплены годы.
  if(s.amo_id){
    h+='<div class="tosec">Выезды в TimeBot'
      +'<button class="tbtn sm" data-to="tbhist" data-id="'+s.id+'">'
      +(T.tbHist&&T.tbHist.site===s.id?'Скрыть':'Показать')+'</button></div>';
    if(T.tbHist&&T.tbHist.site===s.id){
      var hh=T.tbHist.items;
      h+='<div class="tolist">'+(hh===null?'<div class="toli"><span class="s">Загружаю…</span></div>'
        :(hh.length?hh.map(function(v){
           var fio=[v.first_name,v.last_name].filter(Boolean).join(' ');
           return '<div class="toli"><div><b>'+dmy(v.start)+' '+hhmm(v.start)+'</b>'
             +'<div class="s">'+E(fio||'—')+(v.hours?(' · '+v.hours+' ч'):' · не закрыт')
             +(v.note?(' · '+E(v.note)):'')+'</div></div>'
             +(v.lat?chip('mut','с геометкой'):chip('warn','без гео'))+'</div>';
         }).join(''):'<div class="toli"><span class="s">'+E(T.tbHist.hint||'Выездов не было')+'</span></div>'))
        +'</div>';
    }
  }

  h+='<div class="tosec">Выезды в приложении</div><div class="tolist">'
    +((d.visits||[]).map(function(v){
      var fio=[v.first_name,v.last_name].filter(Boolean).join(' ');
      var ph=(v.files||[]).map(function(f){
        return '<div class="phi"><div class="phimg" data-tph="'+E(f.ref)+'" data-to="phopen"></div></div>';}).join('');
      return '<div class="toli col"><div class="torow"><div><b>'+dmy(v.started_at)+' '+hhmm(v.started_at)+'</b>'
        +'<div class="s">'+E(fio||'инженер')+' · отметок '+(v.checks||0)
        +(v.geo_drift_m!=null?(' · '+v.geo_drift_m+' м от объекта'):'')
        +(v.auto_closed?' · закрыт автоматически':'')
        +(v.kind==='initial'?' · первичный осмотр':'')+'</div></div>'
        +(v.finished_at?chip('ok',(v.hours||0)+' ч'):chip('warn','идёт'))+'</div>'
        +(ph?('<div class="phrow">'+ph+'</div>'):'')+'</div>';
    }).join('')||empty('Выездов ещё не было.'))+'</div>';

  return h;
}

function mPlan(){
  if(T.planMode==='mine')return mMine();
  return mCal();
}

// ── Экран инженера: список, а не сетка. С телефона месячную сетку читать
// нельзя, а вопрос у него один — куда ехать сегодня.
function mMine(){
  var h='<div class="tohead"><h2>Мои выезды</h2>'
    +'<div class="s">Назначенное вам и работы без исполнителя. Отмечайтесь на объекте — '
    +'кнопка выезда во вкладке «Выезд».</div></div>';
  if(T.mine===null)return h+'<div class="tonote">Загружаю…</div>';
  if(!T.mine.length)return h+empty('На ближайшую неделю выездов нет.');
  var byS={};
  T.mine.forEach(function(x){(byS[x.site_id]=byS[x.site_id]||{s:x,items:[]}).items.push(x);});
  return h+Object.keys(byS).map(function(k){
    var g=byS[k],x=g.s,late=g.items.filter(function(i){return i.late}).length;
    return '<div class="tocard"><div class="torow"><div><b>'+E(x.site_name)+'</b>'
      +'<div class="s">'+E(x.address)+'</div>'
      +(x.contact_name?('<div class="s">'+E(x.contact_name)+(x.contact_phone?(' · '+E(x.contact_phone)):'')+'</div>'):'')
      +'</div>'+(late?chip('bad','просрочено '+late):chip('warn','работ '+g.items.length))+'</div>'
      +'<div class="tolist" style="margin:10px 0 0">'+g.items.map(function(i){
          return '<div class="toli"><div><b>'+E(i.work||'Регламентные работы')+'</b>'
            +'<div class="s">'+E(i.system_title||'')+' · '+E(perRu(i.period_kind))
            +(i.mine?'':' · не назначено')+'</div></div>'
            +visitChip(i.planned_on)+'</div>';}).join('')+'</div></div>';
  }).join('');
}

// ── Календарь менеджера ──────────────────────────────────────────────
var WD=['пн','вт','ср','чт','пт','сб','вс'];
function mCal(){
  var d=T.cal;
  var h='<div class="tohead"><div class="torow">'
    +'<div class="bar" style="gap:6px;margin:0">'
    +'<button class="tbtn sm" data-to="calmove" data-d="-1">‹</button>'
    +'<button class="tbtn sm" data-to="calmove" data-d="0">Сегодня</button>'
    +'<button class="tbtn sm" data-to="calmove" data-d="1">›</button>'
    +'</div></div>';
  if(d===null)return h+'</div><div class="tonote">Загружаю…</div>';
  if(!d)return h+'</div>'+empty('Календарь не загрузился. '+E(T.err||''));

  h+='<div class="s">'+E(monthRu(d.first))+' · перетащите работу на другой день, '
    +'чтобы перенести выезд. Нажмите — чтобы назначить инженера.</div></div>';

  var t=d.totals||{};
  h+='<div class="tostats">'
    +'<div><b>'+(t.work||0)+'</b><span>работ в месяце</span></div>'
    +'<div><b class="ok">'+(t.done||0)+'</b><span>выполнено</span></div>'
    +'<div><b class="'+(t.overdue?'bad':'ok')+'">'+(t.overdue||0)+'</b><span>просрочено</span></div>'
    +'<div><b>'+(t.unassigned||0)+'</b><span>без исполнителя</span></div></div>';

  // Фильтр по инженеру: главный вопрос менеджера — «что у Петра на неделе».
  h+='<div class="bar" style="margin:0 12px 10px;gap:6px;flex-wrap:wrap">'
    +'<button class="tbtn sm'+(T.calEng?'':' go')+'" data-to="caleng" data-e="">Все</button>'
    +(T.engs||[]).map(function(e){
       var nm=[e.first_name,e.last_name].filter(Boolean).join(' ')||('id '+e.user_id);
       return '<button class="tbtn sm'+(String(T.calEng)===String(e.user_id)?' go':'')
         +'" data-to="caleng" data-e="'+e.user_id+'">'+E(nm)+'</button>';}).join('')
    +'</div>';

  // Разложить по дням. Ключ — плановая дата, она же дата клетки.
  var byDay={};
  (d.items||[]).forEach(function(x){(byDay[x.planned_on]=byDay[x.planned_on]||[]).push(x);});

  var cells='';
  for(var i=0;i<d.weekday;i++)cells+='<div class="cd out"></div>';
  var ym=String(d.first).slice(0,8);
  for(var day=1;day<=d.days;day++){
    var iso=ym+(day<10?'0':'')+day;
    var list=byDay[iso]||[];
    var isToday=(iso===today());
    var past=(iso<today());
    cells+='<div class="cd'+(isToday?' now':'')+(past?' past':'')+'" data-day="'+iso+'" data-to="calday">'
      +'<div class="cdn">'+day+(list.length>3?('<i>'+list.length+'</i>'):'')+'</div>'
      +list.slice(0,4).map(function(x){
        var cls=x.status==='done'?'ok':(x.overdue?'bad':(x.assigned_to?'as':'no'));
        var who=[x.first_name,x.last_name].filter(Boolean).join(' ');
        return '<div class="ci '+cls+'" draggable="true" data-id="'+x.id+'" data-to="calitem"'
          +' title="'+E((x.work||'')+' · '+(x.site_name||''))+'">'
          +E(x.site_name)+(who?(' · '+E(who.split(' ')[0])):'')
          +(x.late_plan?' · поздно':'')+'</div>';}).join('')
      +(list.length>4?('<div class="cmore">ещё '+(list.length-4)+'</div>'):'')
      +'</div>';
  }
  h+='<div class="cal"><div class="calh">'+WD.map(function(w){return '<span>'+w+'</span>'}).join('')+'</div>'
    +'<div class="calg">'+cells+'</div></div>';

  // Хвост просрочки — отдельным ящиком, а не в клетках первого числа.
  if((d.tail||[]).length)
    h+='<div class="tosec">Просрочено с прошлых месяцев'
      +'<span class="s">'+d.tail.length+' — перетащите в календарь или перенесите кнопкой</span></div>'
      +'<div class="tolist tailbox">'+d.tail.map(function(x){
        return '<div class="toli"><div><b>'+E(x.site_name)+'</b><div class="s">'
          +E(x.work||'')+' · срок был '+dmy(x.due_on)+'</div></div>'
          +'<div class="ci bad" draggable="true" data-id="'+x.id+'" data-to="calitem">перенести</div></div>';
      }).join('')+'</div>';

  // Без согласованной даты в клетку класть нечего — отдельным ящиком.
  if((d.unagreed||[]).length)
    h+='<div class="tosec">Дата не согласована'
      +'<span class="s">'+d.unagreed.length+' — поставьте дату, когда договоритесь с заказчиком</span></div>'
      +'<div class="tolist tailbox">'+d.unagreed.map(function(x){
        var who=[x.first_name,x.last_name].filter(Boolean).join(' ');
        return '<div class="toli"><div><b>'+E(x.site_name)+'</b><div class="s">'
          +E(x.work||'')+' · срок '+dmy(x.due_on)+(who?(' · '+E(who)):'')+'</div></div>'
          +'<div class="ci '+(x.overdue?'bad':'no')+'" draggable="true" data-id="'+x.id+'" data-to="calitem">назначить</div></div>';
      }).join('')+'</div>';

  return h+(T.calPick?calPick():'')+(T.calDay?calDayBox(byDay[T.calDay]||[]):'');
}

// Работы одного дня — панелью снизу, когда их больше, чем влезло в клетку.
function calDayBox(list){
  return '<div class="tomodal" data-to="modalbg"><div class="tomwin"><div class="tomhead">'
    +'<div><b>'+dmy(T.calDay)+'</b><div class="s">работ: '+list.length+'</div></div>'
    +'<button class="tbtn x" data-to="calclose">✕</button></div>'
    +'<div class="tombody"><div class="tolist" style="margin:0">'
    +(list.map(function(x){
       var who=[x.first_name,x.last_name].filter(Boolean).join(' ');
       return '<div class="toli"><div><b>'+E(x.site_name)+'</b><div class="s">'
         +E(x.work||'')+' · '+E(x.system_title||'')+'</div>'
         +'<div class="s">срок по регламенту '+dmy(x.due_on)
         +(x.late_plan?' · <b style="color:var(--red)">выезд назначен позже срока</b>':'')+'</div></div>'
         +(who?chip('mut',who):chip('warn','без исполнителя'))
         +'<button class="tbtn sm" data-to="calitem" data-id="'+x.id+'">Изменить</button></div>';
     }).join('')||'<div class="s" style="padding:12px">Работ нет</div>')
    +'</div></div><div class="tomfoot"><button class="tbtn" data-to="calclose">Закрыть</button></div>'
    +'</div></div>';
}

// Панель одной работы: перенос и назначение.
function calPick(){
  var x=T.calPick;
  var who=[x.first_name,x.last_name].filter(Boolean).join(' ');
  return '<div class="tomodal" data-to="modalbg"><div class="tomwin"><div class="tomhead">'
    +'<div><b>'+E(x.site_name)+'</b><div class="s">'+E(x.work||'Регламентные работы')
    +' · '+E(x.system_title||'')+'</div></div>'
    +'<button class="tbtn x" data-to="calclose">✕</button></div>'
    +'<div class="tombody"><div class="tfgrid">'
    +'<div class="tfield"><div class="tflab">Дата выезда'
    +'<button class="tfq" data-to="hint" data-h="Дата, о которой договорились с заказчиком. Пусто — дата не согласована. Срок по регламенту при этом не меняется — по нему считается, был ли срыв.">?</button></div>'
    +'<input class="tf" type="date" id="calDate" value="'+E(x.planned_on||'')+'"></div>'
    +(isMgr()?('<div class="tfield"><div class="tflab">Исполнитель'
    +'<button class="tfq" data-to="hint" data-h="Инженер увидит работу у себя во вкладке «Мои выезды». Можно оставить пусто — тогда поедет любой.">?</button></div>'
    +'<select class="tf" id="calEngSel"><option value="">— не назначен —</option>'
    +(T.engs||[]).map(function(e){
       var nm=[e.first_name,e.last_name].filter(Boolean).join(' ')||('id '+e.user_id);
       return '<option value="'+e.user_id+'"'+(String(x.assigned_to)===String(e.user_id)?' selected':'')+'>'+E(nm)+'</option>';
     }).join('')+'</select></div>'):'')
    +'<div class="tfield wide"><div class="tflab">Срок по регламенту</div>'
    +'<div class="tfstatic">'+dmy(x.due_on)+' · '+E(perRu(x.period_kind))
    +(x.late_plan?' — <b style="color:var(--red)">выезд назначен позже срока</b>':'')+'</div></div>'
    +'<div class="tfield wide"><div class="tflab">Причина переноса'
    +'<button class="tfq" data-to="hint" data-h="Заполняется, если выезд уходит за нормативный срок. Останется в журнале — на случай вопроса, почему работа сделана позже.">?</button></div>'
    +'<input class="tf" id="calNote" placeholder="например, заказчик не даёт доступ до 20-го"></div>'
    +'</div><div class="tfhint"></div></div>'
    +'<div class="tomfoot"><button class="tbtn" data-to="calclose">Отмена</button>'
    +'<button class="tbtn go" data-to="calsave" data-id="'+x.id+'">Сохранить</button></div>'
    +'</div></div>';
}

function mContracts(){
  var h=lift('<button class="tbtn go" data-to="form" data-f="contract">＋ Договор</button>');
  if(T.contracts===null)return h+'<div class="tonote">Загружаю…</div>';
  if(!T.contracts.length)return h+empty('Договоров нет.');
  return h+T.contracts.map(function(k){
    var gr=grantsFor(k);
    return '<div class="tocard"><div class="torow"><div><b>'+E(k.number)+'</b>'
      +'<div class="s">'+E(k.counterparty)+(k.counterparty_inn?(' · ИНН '+E(k.counterparty_inn)):'')+'</div>'
      +'<div class="s">от '+E(k.entity_name||'юрлицо не выбрано')+' · '
      +dmy(k.period_from)+'—'+(k.period_to?dmy(k.period_to):'бессрочно')+'</div>'
      +'<div class="s">объекты: '+E(k.sites||'не привязаны')+'</div></div>'
      +'<div style="text-align:right"><b>'+money(k.price)+'</b><div class="s">'+E(perRu(k.billing_period))+'</div>'
      +chip(k.status==='active'?'ok':'mut',contrRu(k.status))
      +(k.monitoring?(' '+chip(k.notify_email?'ok':'warn','мониторинг')):'')+'</div></div>'
      +(k.overdue?('<div class="tonote warn" style="margin:8px 0 0">просрочено работ: '+k.overdue+'</div>'):'')
      // Письмо о сигнале без адреса уходит в никуда, и узнают об этом после
      // пожара. Поэтому пустое поле видно в списке, а не только в форме.
      +(k.monitoring&&!k.notify_email?('<div class="tonote warn" style="margin:8px 0 0">'
        +'нет почты для сигналов</div>'):'')
      +'<div class="bar" style="margin:10px 0 0;gap:6px;flex-wrap:wrap">'
      +'<button class="tbtn sm" data-to="form" data-f="contract" data-id="'+k.id+'">✎ Правка</button>'
      +'<button class="tbtn sm go" data-to="buildplan" data-id="'+k.id+'">📅 Построить план на год</button>'
      +'<button class="tbtn sm" data-to="grants" data-id="'+k.id+'" data-cp="'+k.counterparty_id+'">'
      +'👤 Доступ заказчику'+(gr.length?(' · '+gr.length):'')+'</button>'
      // Акты без объектов и выездов (#623): работы есть, а в системе их нет.
      +'<button class="tbtn sm" data-to="actman" data-id="'+k.id+'">📄 Акт без выездов</button>'
      +'<button class="tbtn sm" data-to="actinitman" data-id="'+k.id+'">🔍 Акт обследования без выезда</button>'
      +'</div>'
      +(T.grantsFor===k.id?grantsBox(k,gr):'')
      +'</div>';
  }).join('');
}

// Доступы конкретного договора. Раньше это была отдельная вкладка — и она
// отрывала выдачу доступа от того, из чего доступ вытекает. Заказчик в
// договоре уже назван, объекты уже перечислены: спрашивать их повторно
// значит дать возможность ошибиться.
function grantsFor(k){
  return (T.grants||[]).filter(function(g){
    if(g.revoked_at)return false;
    if(g.counterparty_id&&String(g.counterparty_id)===String(k.counterparty_id))return true;
    return g.site_id&&(k.site_ids||[]).map(String).indexOf(String(g.site_id))>=0;
  });
}
function grantsBox(k,gr){
  var h='<div class="togrants"><div class="s" style="margin-bottom:8px">'
    +'Кабинет объекта для <b>'+E(k.counterparty)+'</b>. Заказчик должен хотя бы раз '
    +'войти на app.gasbase.ru через Telegram — иначе доступу не к кому привязаться.</div>';
  h+=gr.map(function(g){
    var fio=[g.first_name,g.last_name].filter(Boolean).join(' ')||('id '+g.user_id);
    return '<div class="toli"><div><b>'+E(fio)+'</b><div class="s">'
      +E(g.site_name||g.counterparty||'—')
      +(g.can_approve?' · согласовывает замечания':' · только просмотр')
      +(g.role&&g.role!=='customer'?' · <b>роль не «Заказчик» — кабинет не откроется</b>':'')
      +'</div></div><button class="tbtn sm" data-to="revoke" data-id="'+g.id+'">Отозвать</button></div>';
  }).join('')||'<div class="s">Доступ ещё никому не выдан.</div>';

  var sites=(T.sites||[]).filter(function(x){return (k.site_ids||[]).map(String).indexOf(String(x.id))>=0;});
  h+='<div class="tofields" style="margin-top:10px">'
    +'<label class="tofield"><span>ID заказчика в системе *</span>'
    +'<input class="f" id="grTid" inputmode="numeric" placeholder="например 123456789"></label>'
    +'<label class="tofield"><span>На что выдаём</span><select class="f" id="grScope">'
    +'<option value="cp">все объекты '+E(k.counterparty)+'</option>'
    +sites.map(function(x){return '<option value="'+x.id+'">только '+E(x.name)+'</option>';}).join('')
    +'</select></label>'
    +'<label class="tofield"><span>Права</span><select class="f" id="grApprove">'
    +'<option value="">только смотреть</option>'
    +'<option value="1">смотреть и согласовывать замечания</option>'
    +'</select></label></div>'
    +'<div class="bar" style="margin:10px 0 0"><button class="tbtn go" data-to="grantadd" '
    +'data-id="'+k.id+'" data-cp="'+k.counterparty_id+'">Выдать доступ</button>'
    +'<button class="tbtn" data-to="grants" data-id="">Свернуть</button></div></div>';
  return h;
}

function mActs(){
  var yopt=[];for(var y=new Date().getFullYear();y>=2024;y--)yopt.push(y);
  var mn=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  var h='<div class="tohead"><div class="s">Собираются из закрытых выездов и выполненных работ за период. '
    +'Повторный запуск обновляет черновик и не трогает выпущенные.</div>'
    +'<div class="bar" style="margin:10px 0 0;gap:6px;flex-wrap:wrap">'
    +'<select class="f" id="toActY">'+yopt.map(function(v){return '<option'+(v===T.year?' selected':'')+'>'+v+'</option>'}).join('')+'</select>'
    +'<select class="f" id="toActM">'+mn.map(function(n,i){return '<option value="'+(i+1)+'"'+((i+1)===T.month?' selected':'')+'>'+n+'</option>'}).join('')+'</select>'
    +'<button class="tbtn go" data-to="genact" data-k="">Сформировать за месяц</button>'
    +'<button class="tbtn" data-to="genact" data-k="quarter">За квартал</button>'
    +'<button class="tbtn" data-to="actinitpick">🔍 Акт обследования без выезда</button>'
    +'</div></div>';
  // Договоры, которые «Сформировать» пропустило из-за отсутствия выездов
  // (#629): акт по ним составляется отдельно, на тот же период.
  var nv=T.actsNoVisits||[];
  if(nv.length)
    h+='<div class="tosec">Нет выездов за период — акт можно составить без них</div><div class="tolist">'
      +nv.map(function(s){
        return '<div class="toli"><div><b>'+E(s.contract)+'</b><div class="s">'+E(s.counterparty||'')+'</div></div>'
          +'<div class="bar" style="gap:6px"><button class="tbtn sm go" data-to="actman" data-id="'+s.contract_id+'"'
          +' data-y="'+s.y+'" data-m="'+s.m+'" data-k="'+E(s.k||'')+'">📄 Акт без выездов</button></div></div>';
      }).join('')+'</div>';
  // Первичные осмотры, по которым акт ещё не составлен (#79). Данные акта —
  // стороны, подписанты, системы, недостатки — подтягивает сервер.
  var pend=T.actsInit||[];
  if(pend.length)
    h+='<div class="tosec">Ждут акта первичного осмотра</div><div class="tolist">'
      +pend.map(function(v){
        var fio=[v.first_name,v.last_name].filter(Boolean).join(' ');
        return '<div class="toli"><div><b>'+E(v.site_name)+'</b><div class="s">'+dmy(v.started_at)
          +(fio?(' · '+E(fio)):'')+' · недостатков '+(v.defects||0)
          +(v.contract_number?(' · договор '+E(v.contract_number)+' · '+E(v.counterparty||'')):' · без договора')
          +'</div></div><div class="bar" style="gap:6px"><button class="tbtn sm" data-to="notinit" data-id="'+v.visit_id+'">Не осмотр</button>'
          +'<button class="tbtn sm go" data-to="initact" data-id="'+v.visit_id+'">Составить акт</button></div></div>';
      }).join('')+'</div>';
  if(T.acts===null)return h+'<div class="tonote">Загружаю…</div>';
  if(!T.acts.length)return h+empty('Актов нет. Выберите период и нажмите «Сформировать».');
  return h+T.acts.map(function(a){
    var t=(a.data&&a.data.totals)||{};
    if(a.period_kind==='initial')return initActCard(a);
    var man=a.data&&a.data.manual;
    return '<div class="tocard"><div class="torow"><div><b>'+E(a.number)+'</b>'
      +'<div class="s">'+E(a.counterparty)+' · договор '+E(a.contract_number)+'</div>'
      +'<div class="s">'+dmy(a.period_from)+' — '+dmy(a.period_to)+' · '+E(a.sites||'')+'</div>'
      +(man?('<div class="s">без выездов · '+E(a.data.summary||'')+'</div>')
        :('<div class="s">выездов '+(t.visits||0)+' · работ '+(t.works_done||0)+'/'+(t.works_planned||0)
          +' · незакрытых замечаний '+(t.defects_open||0)+'</div>'))+'</div>'
      +'<div style="text-align:right"><b>'+money(a.amount)+'</b><div>'
      +chip(a.status==='signed'?'ok':(a.status==='draft'?'mut':'warn'),actRu(a.status))+'</div></div></div>'
      +'<div class="bar" style="margin:10px 0 0;gap:6px;flex-wrap:wrap">'
      +'<button class="tbtn sm" data-to="printact" data-id="'+a.id+'" data-f="act">🖨 Акт работ</button>'
      // Журнал и протокол собираются из выездов — у акта без выездов они пустые.
      +(man?(a.status==='draft'?'<button class="tbtn sm" data-to="actsum" data-id="'+a.id+'">Текст акта</button>':'')
        :('<button class="tbtn sm" data-to="printact" data-id="'+a.id+'" data-f="journal">📒 Выписка из журнала</button>'
          +'<button class="tbtn sm" data-to="printact" data-id="'+a.id+'" data-f="protocol">📐 Протокол проверки</button>'))
      +actStButtons(a)
      +'</div></div>';
  }).join('');
}

function actStButtons(a){
  return (a.status==='draft'?'<button class="tbtn sm go" data-to="actst" data-id="'+a.id+'" data-v="issued">Выпустить</button>':'')
    +(a.status==='issued'?'<button class="tbtn sm" data-to="actst" data-id="'+a.id+'" data-v="sent">Отправлен заказчику</button>':'')
    +(a.status==='sent'||a.status==='issued'?'<button class="tbtn sm go" data-to="actst" data-id="'+a.id+'" data-v="signed">Подписан</button>':'')
    +(a.status!=='signed'&&a.status!=='cancelled'?'<button class="tbtn sm" data-to="actst" data-id="'+a.id+'" data-v="cancelled">Отменить</button>':'');
}

function initActCard(a){
  var d=a.data||{}, t=d.totals||{}, site=d.site||{}, vis=d.visit||{};
  return '<div class="tocard"><div class="torow"><div><b>'+E(a.number)+'</b>'
    +'<div class="s">Акт первичного осмотра'+(a.visit_id?'':' без выезда')+' · '+E(a.counterparty)
    +' · договор '+E(a.contract_number)+'</div>'
    +'<div class="s">'+dmy(a.period_from)+' · '+E(site.name||a.sites||'')
    +(vis.engineer?(' · '+E(vis.engineer)):'')+'</div>'
    +'<div class="s">недостатков '+(t.defects||0)+(t.critical?(' · критических '+t.critical):'')+'</div></div>'
    +'<div style="text-align:right">'
    +chip(a.status==='signed'?'ok':(a.status==='draft'?'mut':'warn'),actRu(a.status))+'</div></div>'
    +'<div class="bar" style="margin:10px 0 0;gap:6px;flex-wrap:wrap">'
    +'<button class="tbtn sm" data-to="printact" data-id="'+a.id+'" data-f="initial">🖨 Акт осмотра</button>'
    +(a.status==='draft'?'<button class="tbtn sm" data-to="actinittext" data-id="'+a.id+'">Заключение</button>'
      +(a.visit_id?'<button class="tbtn sm" data-to="initact" data-id="'+a.visit_id+'">Обновить данные</button>':''):'')
    +actStButtons(a)
    +'</div></div>';
}

// ── Люди раздела и совмещение ────────────────────────────────────────
// Инженер ТО ездит на обслуживание, но иногда выходит на монтаж — на
// объём или на окладе. Роль при этом не меняется: должность одна, работы
// две. Здесь и включается второе. Менеджеру здесь же директор включает
// «Ведёт обслуживание» (ADR-0066); какие совмещения кому положены, решает
// сервер — у человека в presets только его ключи.
var PRESET_CHIP={to_manage:'+ ведёт ТО',montazh:'+ монтаж',to:'+ обслуживание'};
function mStaff(){
  var h='<div class="tohead"><div class="s">Инженер ТО может дополнительно выходить на монтаж, монтажник — '
    +'подменять инженера на выезде, а менеджер — вести обслуживание. Роль при этом не '
    +'меняется: её задаёт администратор в «Настройках», здесь — только совмещение.</div></div>';
  if(T.staff===null)return h+'<div class="tonote">Загружаю…</div>';
  var st=T.staff.staff||[], pres=T.staff.presets||{};
  var iBoss=(curRole()==='director'||curRole()==='admin');
  if(!st.length)return h+empty('В компании нет инженеров ТО, монтажников и менеджеров. '
    +'Роли назначает администратор в разделе «Настройки».');

  return h+st.map(function(u){
    var boss=(u.role==='director'||u.role==='admin');
    var keys=Object.keys(u.presets||{});
    var onK=keys.filter(function(k){return u.presets[k]})[0];
    return '<div class="tocard"><div class="torow"><div>'
      +'<b>'+E(u.name)+'</b><div class="s">'+E(u.role_name)
      +(boss?' · все разделы открыты по должности':'')+'</div></div>'
      +(onK?chip('ok',PRESET_CHIP[onK]||pres[onK].title):(boss?'':chip('mut','без совмещения')))
      +'</div>'
      +(boss||!keys.length?'':'<div class="tocombo">'+keys.map(function(k){
          var on=!!u.presets[k], lock=pres[k].director_only&&!iBoss;
          return '<label class="tocombl"><input type="checkbox" data-to="combine" '
            +'data-tid="'+u.user_id+'" data-k="'+k+'"'+(on?' checked':'')+(lock?' disabled':'')+'>'
            +'<span><b>'+E(pres[k].title)+'</b><div class="s">'+E(pres[k].hint)
            +(lock?' Включает директор.':'')+'</div></span></label>';
        }).join('')+'</div>')
      +'</div>';
  }).join('');
}

function mCps(){
  var h=lift('<button class="tbtn go" data-to="form" data-f="cp">＋ Юрлицо</button>')
       +'<div class="tohead"><div class="s">Заказчики и балансодержатели объектов. Заводятся по ИНН — '
       +'реквизиты подтягиваются из ЕГРЮЛ.</div></div>';
  if(T.cps===null)return h+'<div class="tonote">Загружаю…</div>';
  if(!T.cps.length)return h+empty('Юрлиц заказчиков нет.');
  return h+'<div class="tolist">'+T.cps.map(function(c){
    return '<div class="toli"><div><b>'+E(c.name)+'</b><div class="s">'
      +({ooo:'ООО',ip:'ИП',ao:'АО',pao:'ПАО',gbu:'ГБУ'}[c.kind]||E(c.kind))
      +(c.inn?(' · ИНН '+E(c.inn)):'')+' · адресов '+(c.sites||0)+'</div></div>'
      +'<button class="tbtn sm" data-to="form" data-f="cp" data-id="'+c.id+'">✎</button></div>';
  }).join('')+'</div>';
}

function mGrants(){
  var h='<div class="tohead"><div class="torow"><h2>Доступы заказчиков в кабинет</h2>'
       +'<button class="tbtn go" data-to="form" data-f="grant">＋ Выдать</button></div>'
       +'<div class="s">Доступ выдаётся на адрес или на юрлицо целиком. Отзыв не удаляет запись: '
       +'«кто и когда имел доступ» — это то, что спрашивают после инцидента.</div></div>';
  if(T.grants===null)return h+'<div class="tonote">Загружаю…</div>';
  if(!T.grants.length)return h+empty('Доступы не выдавались.');
  return h+'<div class="tolist">'+T.grants.map(function(g){
    var fio=[g.first_name,g.last_name].filter(Boolean).join(' ')||('id '+g.user_id);
    return '<div class="toli"><div><b>'+E(fio)+'</b><div class="s">'
      +E(g.site_name||g.counterparty||'—')
      +(g.can_approve?' · может согласовывать':' · только просмотр')
      +(g.role&&g.role!=='customer'?(' · роль «'+E(g.role)+'», кабинет не откроется'):'')
      +'</div></div>'
      +(g.revoked_at?chip('mut','отозван '+dmy(g.revoked_at))
        :'<button class="tbtn sm" data-to="revoke" data-id="'+g.id+'">Отозвать</button>')+'</div>';
  }).join('')+'</div>';
}

// Мост для второй половины файла (kp-08b.js, «Формы/Загрузка/События») —
// общий IIFE разрезан на два <script>. render() (выше) вызывает formBox(),
// который объявлен только во второй половине — поэтому не переменная,
// а функция-обёртка: тело формы ещё не существует в момент объявления
// render(), но существует к моменту первого реального вызова.
function formBox(){return window.__kp08b.formBox();}
window.__kp08a={E:E,PHT:PHT,T:T,dmy:dmy,engView:engView,geo:geo,isCust:isCust,isEng:isEng,isMgr:isMgr,
  jpost:jpost,metIso:metIso,phFreeT:phFreeT,render:render,sess:sess,sysRu:sysRu,tapi:tapi,today:today,view:view};
})();
