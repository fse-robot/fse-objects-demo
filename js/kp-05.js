/* ═══════════════════════════════════════════════════════════════════════════
   kp-05.js — Обзор.

   Раньше здесь в рамку загружалась главная страница сайта: внутри рабочей
   системы человек получал витрину с кнопкой «Войти», из которой некуда было
   деться. Теперь это первый экран приложения.

   И26 · на первом экране только то, что система действительно знает.
   Список смет отдаёт /api/specs: название, объект, число позиций, дата правки.
   Сумм и наценок в нём нет — и мы их не показываем, вместо правдоподобных
   чисел стоит честное «в смете»: суммы считаются при открытии сметы.

   #659 · сотрудникам компании Обзор показывает отделы: блок на отдел,
   плитка на показатель. Цифры и права считает сервер (/overview): какие
   блоки и чьи деньги видны, экран не решает. Пустой ответ — блоков у роли
   нет (заказчик, партнёр, гость), и показывается обзор по сметам.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){

function ic(id){return '<svg class="i"><use href="#'+id+'"/></svg>'}
function nb(s){return String(s).replace(/ /g,' ')}   /* И12а · неразрывные */
var MN=['января','февраля','марта','апреля','мая','июня','июля','августа',
        'сентября','октября','ноября','декабря'];
function today(){var d=new Date();return d.getDate()+' '+MN[d.getMonth()]}
function num(n){return nb((+n||0).toLocaleString('ru-RU'))}

/* Разделы, доступные этой роли. Порядок — как в меню.
   Массив в scope читается как «любое из перечисленных прав» — так же,
   как в SECT_SCOPE. */
var QUICK=[
  {go:'specs',   scope:['spec:read','spec:calc'], icon:'i-doc', t:'Сметы'},
  {go:'deal',    scope:'deal:read',     icon:'i-calc', t:'Расчёт сделки'},
  {go:'zakupki', scope:'purchase:read', icon:'i-cart', t:'Закупки'},
  {go:'shift',   scope:'shift:own',     icon:'i-pin',  t:'Смена'},
  {go:'to',      scope:'to:read',       icon:'i-cog',  t:'Обслуживание'},
  {go:'entities',scope:'entity:read',   icon:'i-bank', t:'Юрлица'},
  {go:'settings',scope:'users:company', icon:'i-cog',  t:'Настройки'},
  {go:'audit',   scope:'audit:read',    icon:'i-shield',t:'Журнал доступа'}
];

/* Разделов ещё нет — они перечислены здесь ровно теми же словами,
   что и в меню (И24, И25). Ничего сверх этого не обещаем. */
var SOON=['Проекты','Календарь','Уведомления','Клиенты','Объекты',
          'Оборудование','Подрядчики','Мониторинг систем'];

function kcard(cls,icon,label,value,detail,dcls,tip){
  return '<div class="k '+cls+'"'+(tip?' title="'+tip+'"':'')+'><div class="r"><div class="ic">'+ic(icon)+'</div>'
    +'<div style="min-width:0"><div class="lb">'+label+'</div>'
    +'<div class="vl n">'+value+'</div>'
    +(detail?'<div class="dl" style="color:var(--'+(dcls||'mut')+')">'+detail+'</div>':'')
    +'</div></div></div>';
}

function renderOld(v){
  var list=(typeof specs!=='undefined'&&specs)?specs:[];

  /* Состояние ошибки: список не пришёл и причина известна */
  if(!list.length&&typeof SRC_WARN!=='undefined'&&SRC_WARN){
    v.innerHTML=head()+'<div class="cd">'+(window.UI?UI.error({
      title:'Список смет не загрузился', text:SRC_WARN, act:'reload'})
      :'<div class="erst">Список смет не загрузился</div>')+'</div>';
    return;
  }

  var n=list.length;
  var pos=list.reduce(function(a,s){
    return a+(s._meta?(+s.n||0):((s.rows||[]).length))},0);
  var dates=list.map(function(s){return s.date||''}).filter(Boolean).sort();
  var last=dates.length?dates[dates.length-1]:'—';
  var live=(typeof LIVE!=='undefined')&&LIVE;

  var h=head();

  h+='<div class="kp">'
    +kcard('info','i-doc','Смет в системе',num(n),
        n?('правка '+nb(last)):'ни одной',n?'mut':'amb')
    +kcard('acc','i-list','Позиций в сметах',num(pos),'','mut','По данным списка смет')
    +kcard(live?'ok':'bad','i-plug','Связь с сервером',live?'есть':'нет',
        live?'':'данные устройства',live?'grn':'red',
        live?'Данные с сервера':'Показано из памяти устройства')
    +kcard('warn','i-rub','Суммы и наценка','—','в смете','mut','Считаются при открытии сметы')
    +'</div>';

  h+='<div class="g2"><div>';

  /* Последние сметы */
  h+='<div class="cd" style="margin-bottom:14px">'
    +'<div class="cdh"><h2>Последние сметы</h2>'
    +'<span class="lnk" data-go="specs" style="margin-left:auto" title="Все сметы">Все</span></div>';
  if(!n){
    h+=(window.UI?UI.empty({icon:'i-doc',title:'Смет пока нет',
        act:'newspec',btn:'Новая смета',btnIcon:'i-plus'})
      :'<div class="est">Смет пока нет</div>');
  }else{
    var top=list.slice().sort(function(a,b){
      return String(b.date||'').localeCompare(String(a.date||''))}).slice(0,6);
    h+='<div class="xscroll"><table><thead><tr>'
      +'<th style="padding-left:15px">Смета</th><th>Позиций</th><th>Изменена</th><th></th>'
      +'</tr></thead><tbody>'
      +top.map(function(s){
        var cnt=s._meta?(+s.n||0):((s.rows||[]).length);
        return '<tr data-open="'+esc(s.id)+'" style="cursor:pointer">'
          +'<td data-l="Смета" style="padding-left:15px"><div style="display:flex;gap:9px;align-items:center">'
          +'<div class="bld">'+ic('i-doc')+'</div><div style="min-width:0">'
          +'<div class="pn">'+esc(s.title||'Без названия')+'</div>'
          +(s.object?'<div class="sub">'+esc(s.object)+'</div>':'')
          +'</div></div></td>'
          +'<td data-l="Позиций" class="n">'+num(cnt)+'</td>'
          +'<td data-l="Изменена" class="n">'+esc(s.date||'—')+'</td>'
          +'<td>'+ic('i-right')+'</td></tr>';
      }).join('')
      +'</tbody></table></div>'
      +'<div class="ft">Показано '+top.length+' из '+num(n)+'</div>';
  }
  h+='</div>';

  /* Быстрые действия — только те разделы, что выданы роли */
  var qs=QUICK.filter(function(q){
    try{return !q.scope||(Array.isArray(q.scope)?q.scope.some(can):can(q.scope))}
    catch(e){return false}});
  h+='<div class="cd"><div class="cdh"><h2>Куда пойти</h2></div>'
    +'<div class="pd pd0" style="display:flex;gap:9px;flex-wrap:wrap">'
    +(qs.length?qs.map(function(q){
        return '<button class="btn" data-go="'+q.go+'" title="'+q.t+'">'
          +ic(q.icon)+'<span class="lbl">'+q.t+'</span></button>'}).join('')
      :'<span class="hint" title="Обратитесь к администратору компании">Разделы не выданы</span>')
    +'</div></div>';

  h+='</div><div>';

  h+=peopleCard();
  h+=catalogCard();

  /* Что здесь есть и чего ещё нет — честно, теми же словами, что в меню */
  h+='<div class="cd" style="margin-bottom:14px">'
    +'<div class="cdh"><h2>Ваш доступ</h2>'
    +'<span class="ch info" id="homeRole">—</span></div>'
    +'<div class="it" title="Роль решает, что видно: сотрудники разных компаний '
    +'не видят данные друг друга"><div class="ni info">'+ic('i-lock')+'</div>'
    +'<div><div class="tx">Разделов выдано</div></div>'
    +'<div class="wh n">'+qs.length+'</div></div>'
    +'<div class="it" title="'+(live?'Правки уходят сразу'
        :'Правки останутся на устройстве до восстановления связи')+'">'
    +'<div class="ni '+(live?'ok':'bad')+'">'+ic('i-plug')+'</div>'
    +'<div><div class="tx">'+(live?'Сервер отвечает':'Сервер недоступен')+'</div></div></div>'
    +'<div class="ft">Вход — по приглашению</div>'
    +'</div>';

  h+='<div class="cd" title="В меню они приглушены и не нажимаются">'
    +'<div class="cdh"><h2>Появится позже</h2>'
    +'<span class="ch" style="margin-left:auto">'+SOON.length+'</span></div>'
    +'<div class="pd pd0"><div style="display:flex;gap:6px;flex-wrap:wrap">'
    +SOON.map(function(t){return '<span class="ch">'+t+'</span>'}).join('')
    +'</div></div></div>';

  h+='</div></div>';

  v.innerHTML=h;
  var r=document.getElementById('homeRole');
  if(r){var rn=document.getElementById('roleName');
        r.textContent=(rn&&rn.textContent&&rn.textContent!=='—')?rn.textContent:'Роль не задана';}
  if(window.UI&&UI.spark)UI.spark();
}

/* Свежесть цен по поставщикам. Дата отвечает на вопрос «сборщик сюда
   доходит?», а не «цена изменилась»: отметка обновляется при каждом
   посещении строки, даже когда цена та же. Формулировки под это. */
function catalogCard(){
  /* Роли без права на каталог (исполнитель, заказчик) карточку не видят:
     ручка им откажет, и получилась бы «недоступно» на пустом месте. */
  try{if(!can('catalog:read'))return ''}catch(e){return ''}
  var list=(typeof CATALOG_SRC!=='undefined')?CATALOG_SRC:[];
  if(list===null){
    /* Ещё не спрашивали: спросим и перерисуем. Второго захода не будет —
       после ответа CATALOG_SRC уже массив. */
    if(typeof loadCatalog==='function')loadCatalog().then(function(){renderHome()});
    return '<div class="cd" style="margin-bottom:14px">'
      +'<div class="cdh"><h2>Цены поставщиков</h2></div>'
      +'<div class="it"><div class="ni info">'+ic('i-rub')+'</div>'
      +'<div><div class="tx">Спрашиваем сервер…</div></div></div></div>';
  }
  if(!list.length){
    return '<div class="cd" style="margin-bottom:14px">'
      +'<div class="cdh"><h2>Цены поставщиков</h2></div>'
      +'<div class="it"><div class="ni warn">'+ic('i-rub')+'</div>'
      +'<div title="Сервер не ответил на запрос о свежести цен. '
      +'Возраст цен виден в самой смете, у каждого предложения магазина.">'
      +'<div class="tx">Состояние каталога недоступно</div>'
      +'</div></div></div>';
  }
  var bad=list.filter(function(s){return s.state!=='ok'}).length;
  var h='<div class="cd" style="margin-bottom:14px">'
    +'<div class="cdh"><h2>Цены поставщиков</h2>'
    +'<span class="ch '+(bad?'bad':'ok')+'" style="margin-left:auto">'
    +(bad?nb(bad+(bad===1?' не обновляется':' не обновляются')):'все обновляются')+'</span></div>';
  h+=list.map(function(s){
    var ok=s.state==='ok';
    /* Вторая строка — место обхода: где сборщик сейчас и за сколько проходит
       круг. Есть только у тех, кто идёт по разделам; Тинко и Лайта берутся
       файлом целиком, и очереди у них нет. */
    var c=s.crawl;
    var walk=c?('<div class="sb">'+esc(c.note)
      +(c.over_day?' <span class="ch warn">дольше суток</span>':'')+'</div>'):'';
    return '<div class="it"><div class="ni '+(ok?'ok':'bad')+'">'+ic('i-rub')+'</div>'
      +'<div style="min-width:0"><div class="tx">'+esc(s.name)+'</div>'
      +'<div class="sb">'+esc((s.detail||'').split('\n')[0])+'</div>'+walk+'</div>'
      +'<div class="wh n">'+(s.updated?nb(fmtDate(s.updated)):'нет цен')+'</div></div>';
  }).join('');
  h+='<div class="ft" title="Дата — когда сборщик последний раз заходил за ценой '
    +'по этому поставщику. Сама цена при этом могла не измениться. '
    +'Полный круг — за сколько обход возвращается к самому давнему разделу.">Дата — последний обход</div></div>';
  return h;
}

/* Люди amoCRM (#695): кто чем занят и сколько у него открытых сделок.
   Последнее действие — словами и временем; суммы, телефоны и тексты
   писем сервер не отдаёт. */
var PEOPLE=null,PEOPLE_AT=0,PEOPLE_EV=true;
function when(iso){
  var d=new Date(iso),t=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  var day=new Date(d);day.setHours(0,0,0,0);
  var now=new Date();now.setHours(0,0,0,0);
  var ago=Math.round((now-day)/864e5);
  if(ago===0)return t;
  if(ago===1)return 'вчера, '+t;
  return d.getDate()+' '+MN[d.getMonth()]+(d.getFullYear()===now.getFullYear()?'':' '+d.getFullYear());
}
function peopleCard(){
  try{if(!can('crm:people'))return ''}catch(e){return ''}
  var top='<div class="cd" style="margin-bottom:14px"><div class="cdh"><h2>Люди в CRM</h2>';
  /* Вернулись на «Обзор» через пару минут — показываем прежний список и
     тихо спрашиваем новый: столько же сервер держит ответ amoCRM, а ответ
     без действий — полминуты. */
  if(PEOPLE!=='wait'&&Date.now()-PEOPLE_AT>(PEOPLE_EV?120e3:30e3)){
    if(PEOPLE===null)PEOPLE='wait';
    PEOPLE_AT=Date.now();
    ledger('/crm/people').then(function(r){PEOPLE=r.people||[];PEOPLE_EV=r.events!==false},
      function(e){if(!Array.isArray(PEOPLE))PEOPLE={err:e.message||'amoCRM не ответила'}})
      .then(draw);
  }
  if(PEOPLE==='wait')
    return top+'</div><div class="it"><div class="ni info">'+ic('i-usrs')+'</div>'
      +'<div><div class="tx">Спрашиваем amoCRM…</div></div></div></div>';
  if(!Array.isArray(PEOPLE))
    return top+'</div><div class="it"><div class="ni warn">'+ic('i-usrs')+'</div>'
      +'<div style="min-width:0"><div class="tx">amoCRM не ответила</div>'
      +'<div class="sb">'+esc(PEOPLE.err)+'</div></div></div></div>';
  return top+'<span class="ch" style="margin-left:auto">'+PEOPLE.length+'</span></div>'
    +PEOPLE.map(function(p){
      var l=p.last;
      return '<div class="it"><div class="ni '+(l?'ok':'info')+'">'+ic('i-usr')+'</div>'
        +'<div style="min-width:0"><div class="tx">'+esc(p.name)+'</div>'
        +'<div class="sb">'+(l?esc(l.text)+', '+nb(when(l.at)):PEOPLE_EV?'Действий нет':'amoCRM не ответила')+'</div></div>'
        +'<div class="wh n" title="Открытых сделок">'+num(p.open_deals)+'</div></div>';
    }).join('')
    +'<div class="ft">Справа — открытые сделки</div></div>';
}

function head(){
  return '<div class="ph"><div><h1>Обзор</h1>'
    +'<p>Состояние на '+today()+'</p></div></div>';
}
function headOv(){
  return '<div class="ph"><div><h1>Обзор</h1><p>'+today()+'</p></div></div>';
}

/* ── Отделы (#659) ─────────────────────────────────────────────────────
   OV — последний ответ /overview: null — ещё не спрашивали, {err} — не
   пришёл. Ответ перезапрашивается при каждом входе на экран, а пока он
   идёт, видны прежние цифры: мигать полосками загрузки незачем. */
var OV=null, OV_BUSY=false, OV_OPEN={};

window.renderHome=function(){
  var v=document.getElementById('homeView'); if(!v)return;
  if(!v.__ov){v.__ov=1;v.addEventListener('click',ovClick);}
  if(!OV_BUSY)ovFetch();
  draw();
};

function ovFetch(){
  OV_BUSY=true;
  ledger('/overview').then(function(d){OV=d||{};})
    .catch(function(e){OV={err:e.message||'Сервер не ответил'};})
    .then(function(){OV_BUSY=false;draw();});
}

function draw(){
  var v=document.getElementById('homeView'); if(!v)return;
  if(OV&&!OV.err&&!OV.view){renderOld(v);return;}
  if(!OV){
    var sk='<div class="skrow"><div class="skel t"></div><div class="skel s"></div></div>';
    v.innerHTML=headOv()+'<div class="ovg">'+('<div class="cd">'+sk+sk+'</div>').repeat(3)+'</div>';
    return;
  }
  if(OV.err){
    v.innerHTML=headOv()+'<div class="cd">'+UI.error({title:'Обзор не загрузился',
      text:OV.err,act:'ov-retry'})+'</div>';
    return;
  }
  /* Порядок — телефонный; на мониторе сетка плотной укладкой подтягивает
     Снабжение в ряд к Продажам. */
  var bl=[bSales(),bMontazh(),bSupply(),bService(),bCrew()].filter(Boolean);
  v.innerHTML=headOv()+priceLine()+(bl.length
    ?'<div class="ovg">'+bl.join('')+'</div>'
    :'<div class="cd">'+UI.empty({icon:'i-chart',title:'Данных пока нет'})+'</div>')
    +peopleCard();
}

function ovClick(e){
  var b=e.target.closest('[data-act="ov-retry"]');
  if(b){OV=null;draw();if(!OV_BUSY)ovFetch();return;}
  b=e.target.closest('[data-ov-more]');
  if(b){var k=b.dataset.ovMore;OV_OPEN[k]=!OV_OPEN[k];draw();}
}

/* Сумма в плитке — три значащие цифры, округление вниз, как в метриках ТО:
   на узкой плитке «1 250 000 ₽» обрезалось бы. Точная — в подсказке. */
function short(n){
  if(n<10000)return num(Math.floor(n))+' <small>₽</small>';
  var big=n>=1e6, x=n/(big?1e6:1e3), d=x>=100?0:(x>=10?1:2), k=Math.pow(10,d);
  return String(Math.floor(x*k+1e-9)/k).replace('.',',')+' <small>'+(big?'млн':'тыс')+'</small>';
}
function exact(n){return num(Math.round(n))+' ₽';}
function pct(x){return Math.round(x*100)+' <small>%</small>';}

/* Плитка. o: icon, lb, v (null — прочерк), dl, tip, cls (bad/warn у
   проблемного числа больше нуля), opt — второстепенная, на телефоне
   прячется под «Ещё N». Ведёт в раздел, только если он роли открыт. */
function tile(o,go){
  var to=go&&sectAllowed(go)?go:'';
  var na=o.v===null||o.v===undefined;
  var inner='<div class="r"><div class="ic">'+ic(o.icon)+'</div><div style="min-width:0">'
    +'<div class="lb">'+o.lb+'</div>'
    +'<div class="vl n'+(na?' na':'')+'">'+(na?'—':o.v)+'</div>'
    +(o.dl?'<div class="dl">'+o.dl+'</div>':'')+'</div></div>';
  var cls='k'+(to?' go':'')+(o.cls?' '+o.cls:'')+(o.opt?' opt':'');
  var tip=o.tip?' title="'+esc(o.tip)+'"':'';
  return to?'<button type="button" class="'+cls+'" data-go="'+to+'"'+tip+'>'+inner+'</button>'
    :'<div class="'+cls+'"'+tip+'>'+inner+'</div>';
}
function prob(n,cls){return n>0?cls:'';}

function block(key,title,wide,tiles){
  var hid=tiles.filter(function(t){return / opt"/.test(t);}).length;
  var open=OV_OPEN[key];
  return '<div class="cd ovb'+(wide?' w':'')+(open?' open':'')+'"><div class="cdh"><h2>'+title+'</h2>'
    +(hid?'<button type="button" class="btn sm ovm" data-ov-more="'+key+'" title="'
      +(open?'Свернуть':'Показать остальные показатели')+'">'+ic(open?'i-up':'i-down')
      +'<span class="lbl">'+(open?'Свернуть':'Ещё '+hid)+'</span></button>':'')
    +'</div><div class="kp">'+tiles.join('')+'</div></div>';
}

function bSales(){
  var s=OV.sales; if(!s)return '';
  var t=[tile({icon:'i-doc',lb:'Сметы',v:num(s.specs),dl:'за месяц'},'specs')];
  return block('sales','Продажи',!OV.supply,t);
}

function bMontazh(){
  var m=OV.montazh; if(!m)return '';
  var t=[tile({icon:'i-bld',lb:'Объекты',v:num(m.objects),dl:'в работе'},'shift')];
  if('on_shift' in m)t.push(tile({icon:'i-usrs',lb:'На смене',v:num(m.on_shift),dl:'сейчас',opt:1},'shift'));
  t.push(tile({icon:'i-check',lb:'Отметки',v:num(m.marks),dl:'ждут',cls:prob(m.marks,'warn'),
    opt:!m.marks,tip:'Отметки объёма ждут подтверждения'},'shift'));
  var x=m.extra;
  if(x){
    var sg='signed_sum' in x?short(x.signed_sum):num(x.signed);
    t.push(tile({icon:'i-file',lb:'Допработы',
      v:'unsigned_sum' in x?short(x.unsigned_sum):num(x.unsigned),
      dl:'не подписано · подписано '+sg,cls:prob(x.unsigned,'warn'),opt:!x.unsigned,
      tip:'Не подписано актов: '+x.unsigned+', подписано за месяц: '+x.signed},'shift'));
  }
  return block('montazh','Монтаж',true,t);
}

function bSupply(){
  var s=OV.supply; if(!s)return '';
  /* Очередь заявок — у снабжения; остальным заявки видны на объекте. */
  var go=can('supply:manage')?'zakupki':'shift';
  var all=s.new+s.ordered+s.transit;
  var chn='<div class="chn"><span>'+s.new+' новых</span><span>'+s.ordered+' заказано</span>'
    +'<span>'+s.transit+' в пути</span></div>';
  var t=[tile({icon:'i-cart',lb:'Заявки',v:num(all),dl:all?chn:'открытых нет'},go),
    tile({icon:'i-clock',lb:'Опаздывают',v:num(s.late),dl:'к сроку',cls:prob(s.late,'bad'),
      opt:!s.late,tip:'Нужная дата прошла, материал ещё не на складе'},go)];
  if('purchases' in s)t.push(tile({icon:'i-rub',lb:'Закупки',v:short(s.purchases),
    dl:'за месяц',opt:1,tip:exact(s.purchases)},'zakupki'));
  return block('supply','Снабжение',!OV.sales,t);
}

function bService(){
  var s=OV.to; if(!s)return '';
  var t=[tile({icon:'i-cog',lb:'Объекты',v:num(s.objects),dl:'на ТО'},'to')];
  if('revenue' in s)t.push(tile({icon:'i-rub',lb:'Выручка',v:s.revenue===null?null:short(s.revenue),
    dl:'в месяц',opt:1,tip:s.revenue===null?'Нет договоров с ценой':exact(s.revenue)},'to'));
  t.push(tile({icon:'i-gauge',lb:'Вовремя',v:s.on_time===null?null:pct(s.on_time),dl:'работ',opt:1,
    tip:s.on_time===null?'Работ со сроком в этом месяце ещё не было':''},'to'));
  t.push(tile({icon:'i-warn',lb:'Просрочено',v:num(s.overdue),dl:'работ',cls:prob(s.overdue,'bad'),opt:!s.overdue},'to'));
  t.push(tile({icon:'i-flag',lb:'Замечания',v:num(s.defects),dl:'открыты',cls:prob(s.defects,'warn'),opt:!s.defects},'to'));
  if('acts' in s){
    t.push(tile({icon:'i-file',lb:'Акты',v:'acts_sum' in s?short(s.acts_sum):num(s.acts),
      dl:'не подписаны',cls:prob(s.acts,'warn'),opt:!s.acts,tip:'Не подписано актов: '+s.acts},'to'));
    t.push(tile({icon:'i-msg',lb:'Заявки',v:num(s.requests),dl:'заказчиков',opt:1},'to'));
  }
  return block('to','Обслуживание',true,t);
}

function bCrew(){
  var c=OV.crew; if(!c)return '';
  var sh=c.shift;
  return block('crew','Смена',true,[
    tile({icon:'i-bld',lb:'Объекты',v:num(c.objects),dl:'назначены'},'shift'),
    tile({icon:'i-pin',lb:'Смена',v:sh?'<span class="txt">открыта</span>':'<span class="txt">нет</span>',
      dl:sh?esc(sh.object)+' · с '+sh.since:'',cls:sh?'ok':''},'shift')]);
}

/* Цены поставщиков — одной строкой и только при сбое: исправный каталог
   на экране директора ничего не сообщает. Строка остаётся, потому что
   «Сметы» отсылают сюда, когда сборщик молчит. */
function priceLine(){
  try{if(!can('catalog:read'))return ''}catch(e){return ''}
  if(typeof CATALOG_SRC!=='undefined'&&CATALOG_SRC===null){
    if(typeof loadCatalog==='function'&&!priceLine.asked){
      priceLine.asked=1;loadCatalog().then(draw);}
    return '';
  }
  var bad=catalogTrouble();
  if(!bad.length)return '';
  return '<div class="errbox ovp" title="Дата — когда сборщик последний раз заходил за ценой">'
    +'<p>'+(bad.length>1?'Цены не обновляются: ':'Цена не обновляется: ')
    +bad.map(function(s){return esc(s.name)+' ('+(s.updated?nb(fmtDate(s.updated)):'нет цен')+')';}).join(', ')
    +'</p></div>';
}
})();
