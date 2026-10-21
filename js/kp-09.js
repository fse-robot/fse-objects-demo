/* ═══════════════════════════════════════════════════════════════════════════
   kp-09.js — слой интерфейса. Подключается последним, поэтому видит всё,
   что нарисовали предыдущие блоки, и ничего в их логике не трогает.

   Что здесь:
     1. Тема, кегль, шрифт — настройки человека, запоминаются на устройстве.
     2. Меню: выезд на телефоне, нижнее меню, группа «Появится позже», поиск.
     3. Иконки и title на все кнопки — правила И1, И6, И7, И7а, И7б.
        Кнопки рисуются из десяти разных мест; подбирать их руками — это
        и был разнобой, из-за которого появилось правило И7а.
     4. Раскрытие записи списка и таблицы на телефоне — И16.
     5. Недостающие узлы: окно, форма, перетаскивание файла, пустое
        состояние, ошибка, загрузка, уведомление. window.UI.
     6. Спарклайн в карточке показателя.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var H=document.documentElement, D=document;
function $(s,r){return (r||D).querySelector(s)}
function $$(s,r){return Array.prototype.slice.call((r||D).querySelectorAll(s))}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null}}
function svg(id,cls){return '<svg class="i'+(cls?' '+cls:'')+'"><use href="#'+id+'"/></svg>'}

/* ── 1. ТЕМА, КЕГЛЬ, ШРИФТ ──────────────────────────────────────────────
   Светлая тема по умолчанию: замеры дают выигрыш и по остроте зрения,
   и по вычитке текста. Тёмная — выбор для вечера и объекта. ── */
if(ls('gb_t')==='d')H.setAttribute('data-t','d');
if(ls('gb_b')==='1')H.setAttribute('data-b','1');
function markTheme(){
  var dark=H.getAttribute('data-t')==='d', b=$('#tT');
  if(b){b.innerHTML=svg(dark?'i-sun':'i-moon');
        b.title=dark?'Тема: включить дневную':'Тема: включить вечернюю';}
  var m=D.querySelector('meta[name=theme-color]');
  if(m)m.setAttribute('content',dark?'#0E1013':'#F7F8FA');
  var s=$('#tB'); if(s){var big=H.getAttribute('data-b')==='1';
    s.textContent=big?'A⁻':'A⁺'; s.title=big?'Вернуть обычный кегль':'Крупный кегль';}
}
markTheme();
var tT=$('#tT'); if(tT)tT.onclick=function(){
  var dark=H.getAttribute('data-t')==='d';
  if(dark)H.removeAttribute('data-t'); else H.setAttribute('data-t','d');
  ls('gb_t',dark?'l':'d'); markTheme(); spark();
};
/* И10 · базовый кегль не меняется, крупный — только по кнопке.
   Половина аудитории с пресбиопией: она начинается около сорока. */
var tB=$('#tB'); if(tB)tB.onclick=function(){
  var big=H.getAttribute('data-b')==='1';
  if(big)H.removeAttribute('data-b'); else H.setAttribute('data-b','1');
  ls('gb_b',big?'0':'1'); markTheme(); spark();
};
/* И9а · список закрытый. И9б · шрифтов Яндекса здесь нет: они принадлежат
   компании и разрешены только в её продуктах. И9в · файлы со своего сервера. */
var SYSF='-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
var FONTS={inter:'"Inter"',golos:'"Golos Text"',onest:'"Onest"',manrope:'"Manrope"',roboto:'"Roboto"',sys:''};
/* Есть ли гарнитура на самом деле. Файлы лежат в /fonts/ на своём сервере;
   пока их туда не положили, выбор в списке ничего не менял — человек жал
   и не понимал, почему ничего не происходит. Теперь недоступное честно
   помечено и не выбирается. */
function fontReady(k){
  var st=FONTS[k];
  if(!st)return true;                        // системный есть всегда
  try{ if(!D.fonts||!D.fonts.check)return true;   // браузер не умеет — не мешаем
       return D.fonts.check('16px '+st); }catch(e){ return true; }
}
function setFont(k){
  var st=FONTS[k]===undefined?FONTS.inter:FONTS[k];
  D.body.style.fontFamily=(st?st+',':'')+SYSF;
  ls('gb_f',k);
}
var fsel=$('#fnt');
function markFonts(){
  if(!fsel)return;
  var lost=0;
  Array.prototype.forEach.call(fsel.options,function(o){
    var okf=fontReady(o.value);
    if(!okf){ lost++;
      if(o.textContent.indexOf('—')<0)o.textContent=o.textContent+' — нет на сервере';
      o.disabled=true; }
  });
  fsel.title=lost?('Шрифтов на сервере нет: '+lost+' из '+fsel.options.length
    +'. Положить их — server-10-fonts.sh'):'Шрифт';
}
if(fsel){
  var sf=ls('gb_f'); if(sf&&FONTS[sf]!==undefined)fsel.value=sf;
  if(!fontReady(fsel.value)){fsel.value='sys';}
  setFont(fsel.value);
  fsel.onchange=function(){
    if(!fontReady(this.value)){
      UI.toast('Шрифт не установлен на сервере — оставляю системный',3600,'bad');
      this.value='sys'; }
    setFont(this.value);
  };
  markFonts();
  /* Шрифты подгружаются не мгновенно — перепроверяем, когда браузер
     сообщит, что закончил. */
  try{ if(D.fonts&&D.fonts.ready)D.fonts.ready.then(function(){
    Array.prototype.forEach.call(fsel.options,function(o){
      if(fontReady(o.value)){o.disabled=false;
        o.textContent=o.textContent.replace(' — нет на сервере','');}});
    markFonts();
  }); }catch(e){}
}

/* ── 2. МЕНЮ И ШАПКА ───────────────────────────────────────────────────── */
/* Боковое меню на компьютере сворачивается в полоску со значками.
   Раньше «Закрыть меню» работало только на телефоне: на широком экране
   меню стоит на месте, и нажатие не делало ничего — человек жал и решал,
   что сломано. */
function navMin(on){
  H.setAttribute('data-nav',on?'min':'full');
  ls('gb_nav',on?'min':'full');
  var t=D.querySelector('[data-act="menuclose"] .t');
  if(t)t.textContent=on?'Развернуть меню':'Свернуть меню';
  var b=D.querySelector('[data-act="menuclose"]');
  if(b)b.title=on?'Развернуть меню':'Свернуть меню';
  spark();
}
if(ls('gb_nav')==='min')H.setAttribute('data-nav','min');
navMin(H.getAttribute('data-nav')==='min');
D.addEventListener('click',function(e){
  if(window.innerWidth<=900)return;            /* на телефоне меню выезжает */
  if(!e.target.closest('[data-act="menu"],[data-act="menuclose"]'))return;
  navMin(H.getAttribute('data-nav')!=='min');
});

var soonT=$('#soonT'), soonL=$('#soonL');
if(soonT)soonT.onclick=function(){this.classList.toggle('op');soonL.classList.toggle('op')};
/* ── Меню и поиск на телефоне ─────────────────────────────────────────
   Меню закрывается тремя способами, как везде: нажатием мимо, смахиванием
   влево и клавишей Esc. Раньше единственным способом была кнопка внизу
   списка — до неё надо было долистать.
   Поиск открывается строкой под шапкой, а не поверх неё: раньше он
   накрывал бургер, и закрыть его было нечем. ── */
function drawerClose(){
  try{ if(typeof drawer==='function')return drawer(false); }catch(e){}
  var d=$('#drawer'), o=$('#ov');
  if(d)d.classList.remove('on'); if(o)o.classList.remove('on');
}
function drawerOpen(){
  try{ if(typeof drawer==='function')return drawer(true); }catch(e){}
  var d=$('#drawer'), o=$('#ov');
  if(d)d.classList.add('on'); if(o)o.classList.add('on');
}
function drawerIsOpen(){var d=$('#drawer');return !!(d&&d.classList.contains('on'))}

/* И17 · поиск в шапке открывается кнопкой */
var srb=$('#srb'), topS=$('#topSearch');
function searchOpen(on){
  if(!topS)return;
  topS.classList.toggle('on',!!on);
  if(srb){srb.innerHTML=svg(on?'i-x':'i-srch');
          srb.title=on?'Закрыть поиск':'Поиск';
          srb.setAttribute('aria-label',srb.title);}
  if(on){var i=$('input',topS); if(i)try{i.focus()}catch(e){}}
}
if(srb)srb.onclick=function(ev){ev.stopPropagation();searchOpen(!topS.classList.contains('on'))};

/* Первое нажатие мимо открытого поиска только закрывает его — и дальше не
   идёт. Иначе тем же касанием открывалась карточка под строкой поиска:
   человек хотел убрать клавиатуру, а попадал в смету. */
D.addEventListener('click',function(e){
  if(!topS||!topS.classList.contains('on'))return;
  if(e.target.closest('#topSearch,#srb'))return;
  searchOpen(false);
  e.stopPropagation(); e.preventDefault();
},true);

/* Нажатие мимо: закрывает меню. Внутри самих узлов — не трогаем. */
D.addEventListener('click',function(e){
  if(window.innerWidth>900)return;
  if(!drawerIsOpen())return;
  if(e.target.closest('#drawer'))return;                 /* внутри меню */
  if(e.target.closest('[data-act="menu"]'))return;       /* бургер и затемнение переключат сами */
  drawerClose();
});
D.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if(topS&&topS.classList.contains('on'))searchOpen(false);
  if(drawerIsOpen())drawerClose();
});

/* Смахивание. Влево по открытому меню — закрыть; вправо от левого края —
   открыть. Порог 48 пикселей по горизонтали при небольшом вертикальном
   смещении, чтобы не срабатывало при обычной прокрутке. */
(function(){
  var x0=0,y0=0,mode='';
  D.addEventListener('touchstart',function(e){
    if(window.innerWidth>900){mode='';return}
    var t=e.touches&&e.touches[0]; if(!t)return;
    x0=t.clientX; y0=t.clientY;
    mode = drawerIsOpen() ? 'close' : (x0<=24 ? 'open' : '');
  },{passive:true});
  D.addEventListener('touchend',function(e){
    if(!mode)return;
    var t=e.changedTouches&&e.changedTouches[0]; if(!t){mode='';return}
    var dx=t.clientX-x0, dy=Math.abs(t.clientY-y0);
    if(dy<60){
      if(mode==='close'&&dx<-48)drawerClose();
      if(mode==='open' &&dx> 48)drawerOpen();
    }
    mode='';
  },{passive:true});
})();
/* ── Нижнее меню телефона ──────────────────────────────────────────────
   Четыре главных раздела роли в порядке бокового меню, текущий — всегда в
   ряду, «+» посередине; остальное остаётся в бургере. Ряд списывается с
   бокового меню, а не ведёт свой список: права (applyRoleNav) и подсветку
   (go) там уже держат восемь блоков, второй источник разошёлся бы с ними. ── */
var TAB={home:'Обзор',specs:'Сметы',deal:'Расчёт',zakupki:'Закупки',shift:'Смена',to:'ТО',partner:'Объект',track:'Объекты',finance:'Финансы'};
var tabnav=$('#tabnav'), tnm=$('#tnm'), drw=$('#drawer');
function sideNav(g){return $('.side .nav[data-go="'+g+'"]')}
function shown(g){var n=sideNav(g);return !!(n&&n.style.display!=='none')}
function scope(s){return typeof can==='function'&&can(s)}
/* Обзор в ряду нужен только администратору: остальным он лишнее нажатие */
function inRow(g){return g!=='home'||(typeof curRole==='function'&&curRole()==='admin')}
/* Начать смену и открыть выезд можно только на конкретном объекте — «+»
   ведёт на экран, где этот объект выбирают. Смета заводится сразу. */
function plusActs(){
  var r=[];
  if(shown('specs')&&typeof canEdit==='function'&&canEdit())r.push(['act','newspec','i-doc','Новая смета']);
  if(shown('zakupki')&&scope('purchase:write'))r.push(['go','zakupki','i-cart','Новая закупка']);
  if(shown('shift')&&scope('shift:own'))r.push(['go','shift','i-pin','Начать смену']);
  if(shown('to')&&scope('to:visit'))r.push(['go','to','i-cog','Открыть выезд']);
  return r;
}
function tnmOpen(on){
  if(!tnm)return;
  tnm.classList.toggle('on',!!on);
  var p=$('#tnPlus'); if(p)p.classList.toggle('on',!!on);
}
var tabKey='';
function tabBuild(){
  var all=Object.keys(TAB).filter(shown).filter(inRow);
  var cur=all.filter(function(g){return sideNav(g).classList.contains('act')})[0];
  var row=all.slice(0,4);
  if(cur&&row.indexOf(cur)<0)row[row.length-1]=cur;
  var acts=row.length?plusActs():[];
  /* Один раздел и нечего создавать — ряд не нужен: партнёру и заказчику хватает шапки */
  if(row.length<2&&!acts.length)row=[];
  var key=row.join()+'|'+cur+'|'+acts.map(function(a){return a[1]}).join();
  if(key===tabKey)return;
  tabKey=key;
  Object.keys(TAB).forEach(function(g){var n=sideNav(g);if(n)n.classList.toggle('inbar',row.indexOf(g)>=0)});
  var btn=function(g){var n=sideNav(g), u=n.querySelector('use');
    return '<button class="tn'+(g===cur?' act':'')+'" data-go="'+g+'" title="'+n.title+'">'
      +svg(u?u.getAttribute('href').slice(1):'i-home')+'<span class="t">'+TAB[g]+'</span></button>'};
  var h=row.map(btn);
  if(acts.length)h.splice(Math.ceil(h.length/2),0,
    '<button class="tn plus" id="tnPlus" title="Создать" aria-label="Создать"><span class="pc">'+svg('i-plus')+'</span></button>');
  tabnav.innerHTML=h.join('');
  /* Одно действие выполняется сразу: меню из одной строки — лишнее нажатие. */
  tnm.innerHTML=acts.length>1?acts.map(function(a){
    return '<div class="nav" data-'+a[0]+'="'+a[1]+'" title="'+a[3]+'"><span class="ic">'+svg(a[2])
      +'</span><span class="t">'+a[3]+'</span></div>'}).join(''):'';
  var p=$('#tnPlus');
  if(p&&acts.length===1){p.setAttribute('data-'+acts[0][0],acts[0][1]);
    p.title=acts[0][3]; p.setAttribute('aria-label',acts[0][3]);}
  tnmOpen(false);
}
if(tabnav&&tnm&&drw){
  tabBuild();
  new MutationObserver(tabBuild).observe(drw,{subtree:true,attributes:true,attributeFilter:['class','style']});
  /* Права приходят с сервера позже первой отрисовки и меняют «+», не трогая меню. */
  setInterval(tabBuild,4000);
  D.addEventListener('click',function(e){
    if(e.target.closest('#tnPlus:not([data-act]):not([data-go])')){tnmOpen(!tnm.classList.contains('on'));return}
    if(tnm.classList.contains('on'))tnmOpen(false);
  });
}

/* Общий поиск ведёт в список смет — искать по вводу, без кнопки «Найти» (И0) */
var gq=$('#globalq');
if(gq)gq.addEventListener('input',function(){
  var sq=$('#specq');
  if(typeof window.go==='function'&&$('#specsView')&&$('#specsView').style.display==='none')window.go('specs');
  if(sq){sq.value=this.value; sq.dispatchEvent(new Event('input',{bubbles:true}));}
});
/* Кто вошёл — в шапку. Имя берём из того же хранилища, что и остальной код. */
function whoami(){
  var nm=''; try{nm=localStorage.getItem('fse_user_name')||localStorage.getItem('fse_name')||''}catch(e){}
  var rl=''; try{rl=localStorage.getItem('fse_role_name')||''}catch(e){}
  var un=$('#userName'), rn=$('#roleName'), av=$('#avatar');
  if(un)un.textContent=nm||'Сотрудник';
  /* Роль пишет initRole() из первого блока. Здесь только подставляем
     запомненное, если сервер ещё не ответил, — и больше её не трогаем. */
  if(rn&&(!rn.textContent||rn.textContent==='—')&&rl)rn.textContent=rl;
  if(av){var p=(nm||'').trim().split(/\s+/).filter(Boolean);
    av.textContent=p.length?((p[0][0]||'')+(p[1]?p[1][0]:'')).toUpperCase():'FSE';}
}
whoami(); setInterval(whoami,4000);

/* ── 3. ИКОНКИ НА КНОПКАХ ───────────────────────────────────────────────
   И0 решил, какие кнопки вообще нужны. Здесь оставшиеся получают иконку,
   подпись в .lbl и полное название в title. Правило структурное: перебирать
   кнопки списком вручную уже пробовали — вышел разнобой (И7а). ── */
var SYM={'＋':'i-plus','+':'i-plus','➕':'i-plus','✎':'i-edit','⧉':'i-copy','🔗':'i-link',
 '🗑':'i-trash','📥':'i-imp','📤':'i-exp','💰':'i-rub','🔒':'i-lock','🛒':'i-cart','🔨':'i-tool',
 '🕘':'i-hist','⤓':'i-exp','↓':'i-imp','⚠':'i-warn','⛓':'i-merge','✓':'i-ok','✔':'i-ok',
 '✕':'i-x','✖':'i-x','×':'i-x','‹':'i-left','›':'i-right','⏳':'i-clock','📄':'i-file',
 '▾':'i-down','▴':'i-up','⋮':'i-dotsv','⋯':'i-dots','⚡':'i-wave','🔎':'i-srch','📋':'i-doc',
 '👷':'i-tool','📊':'i-chart','📦':'i-box','🏦':'i-bank','🗓':'i-cal','⚙':'i-cog','📜':'i-shield',
 '👤':'i-usr','👥':'i-usrs','🛠':'i-cog','🤝':'i-usrs','🏛':'i-bank','🛡':'i-shield','?':'i-help',
 '📍':'i-pin','📅':'i-cal','🖨':'i-file','📒':'i-rep','📐':'i-check','📷':'i-cam','⏱':'i-clock',
 '✗':'i-x','—':'i-minus','–':'i-minus','−':'i-minus','🏗':'i-bld','🔧':'i-tool'};
var ACT={
 'sh-nogeo':'i-tool', newspec:'i-plus', back:'i-left', dupspec:'i-copy', sharespec:'i-link',
 delspec:'i-trash', addsection:'i-plus', 'import':'i-imp', 'export-cost':'i-sheet',
 'export-shops':'i-cart', mprices:'i-tool', history:'i-hist',
 sigq:'i-help', sigsnd:'i-bell', pcontact:'i-usr', preq:'i-tool', preqsend:'i-tool',
 evgrp:'i-down', evfold:'i-up',
 menu:'i-menu', menuclose:'i-x', home:'i-home', rolemenu:'i-usr', reload:'i-refr',
 sel:'', del:'i-trash', dup:'i-copy', merge:'i-merge', delsel:'i-trash', clearsel:'i-x',
 cancelmerge:'i-x', rowmenu:'i-dots', dismissvar:'i-x', toggleoffers:'i-down',
 'pur-file':'i-imp','pur-confirm':'i-ok','pur-cancel':'i-x','pur-del':'i-trash',
 'nt-all':'i-ok',
 'rpload':'i-refr','rpxlsx':'i-sheet','mzback':'i-left','mzmark':'i-ok','mzobj':'i-bld','mztab':'i-list',
 'sh-start':'i-tool','sh-stop':'i-ok','sh-tab':'i-list','sh-find':'i-srch','sh-objfind':'i-srch',
 'sh-empfind':'i-srch','sh-vol':'i-check','sh-volsave':'i-save',
 'sh-salset':'i-save','sh-emplset':'i-save','sh-adjset':'i-save','sh-adjdel':'i-trash',
 'sh-cloudon':'i-lock','sh-cloudoff':'i-lock','sh-cloudpass':'i-key','sh-objent':'i-save',
 'sh-objprod':'i-tool','sh-emp':'i-usr','sh-obj':'i-bld','hs-back':'i-left',
 /* блок 11: план монтажа и сверх сметы */
 'pl-obj':'i-bld','pl-back':'i-left','pl-sheet':'i-map','pl-filt':'i-filt',
 'pl-zin':'i-plus','pl-zout':'i-minus','pl-zfit':'i-eye','pl-upload':'i-imp',
 'pl-bind':'i-link','pl-ptmode':'i-pin','pl-sgmode':'i-wave','pl-sgdone':'i-ok',
 'pl-sgstop':'i-x','pl-unmk':'i-x','pl-probe':'i-eye','ex-obj':'i-bld',
 'ex-back':'i-left','ex-add':'i-plus',
 'ex-del':'i-trash','ex-priceset':'i-save','ex-act':'i-ok','ex-print':'i-file',
 'ex-issue':'i-ok','ex-sign':'i-ok','ex-cancel':'i-x',
 /* блок 16: конъюнктурный анализ */
 'ka-catalog':'i-cart','ka-file':'i-imp','ka-export':'i-exp','ka-toggleall':'i-down',
 'ka-dl-xlsx':'i-sheet','ka-dl-pdf':'i-file','ka-dl-gge':'i-doc','ka-head':'i-edit',
 'ka-sup':'i-usrs','ka-pct':'i-ok','ka-pct0':'i-x','ka-add':'i-plus','ka-del':'i-trash',
 'ka-pick':'i-ok','ka-edit':'i-edit',
 /* блок 17: сварка труб */
 weld:'i-flame'
};
/* Кнопки, у которых подпись — это данные (название позиции, имя человека).
   По тексту иконку не угадать, поэтому смотрим на имя атрибута. */
var ATTR={'data-keepmerge':'i-merge','data-addkind':'i-plus','data-applyvar':'i-ok',
          'data-pick':'i-plus','data-role':'i-usr','data-e':'i-usr','data-d':'i-cal',
          'data-wsplit':'i-list','data-wadd':'i-plus'};
/* Порядок важен: первое совпадение и берётся */
var WORD=[
 [/сохран|закреп/,'i-save'],[/удал|очист/,'i-trash'],[/отмен|отказ|отозв|снять|убрать|закрыть|скрыть/,'i-x'],
 [/найти|поиск|егрюл/,'i-srch'],[/фильтр/,'i-filt'],[/обнов|повтор|пересчит/,'i-refr'],
 [/импорт|загрузить|перенести/,'i-imp'],[/выгруз|excel|скачать|отправ/,'i-exp'],
 [/копир|дублир/,'i-copy'],[/ссылк/,'i-link'],[/истори|журнал/,'i-hist'],
 [/календар|сегодня|месяц|квартал|период|дата/,'i-cal'],[/объект|адрес/,'i-bld'],
 [/смен|монтаж|начать|завершить|работ/,'i-tool'],
 [/подтверд|готово|согласов|подписан|выпустить|отметить|подстав|выбрать|применить|принять/,'i-ok'],
 [/деньг|начислить|оклад|цена|цены|оплат|стоим|тариф/,'i-rub'],
 [/показать|открыть|параметр|просмотр/,'i-eye'],[/свернуть/,'i-up'],[/развернуть|ещё|далее/,'i-down'],
 [/блок|доступ|право|включ|отключ|активир/,'i-lock'],[/ключ|пароль/,'i-key'],[/замечан|наруш|проблем/,'i-warn'],
 [/объедин/,'i-merge'],[/правк|изменить|реквизит|переимен|редакт/,'i-edit'],
 [/договор|акт|документ|смет|кп\b/,'i-doc'],[/прибор|оборудован/,'i-cyl'],
 [/сотрудник|инженер|исполнител|пользовател|приглаш/,'i-usr'],
 [/создать|добавить|нов[аыо]|выдать|назначить/,'i-plus'],
 [/таблиц|список|(^|\s)все($|\s)|норм|штат|фриланс|уволен/,'i-list']
];
/* Название для кнопки, у которой подписи нет вовсе: «‹», «›», «✕».
   Без него title оставался пустым — а он и есть подсказка при наведении
   и то, что читает экранный диктор (И7б). */
var ICONNAME={'i-left':'Назад','i-right':'Вперёд','i-x':'Закрыть','i-ok':'Готово',
 'i-plus':'Добавить','i-minus':'Убрать','i-dots':'Действия','i-dotsv':'Действия',
 'i-down':'Развернуть','i-up':'Свернуть','i-trash':'Удалить','i-copy':'Дублировать',
 'i-link':'Ссылка','i-hist':'История правок','i-refr':'Обновить','i-filt':'Фильтры',
 'i-imp':'Импорт','i-exp':'Выгрузить','i-save':'Сохранить','i-srch':'Найти',
 'i-cam':'Фото','i-check':'Отметить','i-help':'Пояснение','i-lock':'Доступ',
 'i-key':'Ключ','i-sheet':'Выгрузить в Excel','i-cal':'Календарь','i-eye':'Показать',
 'i-warn':'Замечание','i-merge':'Объединить','i-edit':'Правка','i-list':'Список',
 'i-clock':'Время','i-file':'Документ','i-doc':'Документ','i-rub':'Деньги',
 'i-bld':'Объект','i-usr':'Сотрудник','i-tool':'Работы','i-cog':'Настройки'};
/* И7а · общепринятая иконка — подписи нет ни на какой ширине */
var IOSET={'i-refr':1,'i-filt':1,'i-copy':1,'i-link':1,'i-hist':1,'i-imp':1,'i-exp':1,
           'i-trash':1,'i-save':1,'i-sheet':1};
/* Где подпись остаётся при любом значке: в полосе вкладки и в окне четыре
   действия в ряд, и значок без подписи там читается как загадка. */
var NOIO='.tofoot,.tomfoot,.mfoot,.est,.erst,.tostep,.selbar,.varrow,.tomarks,.menu,'
  +'.dl .bar,.tabbar .acts,.mbody .bar,.tocard.mon .bar,.monline';
/* Кнопки, содержимое которых нельзя переписывать: у них своя разметка.
   .brandcol .bcl .btn — переключатель производителя, у него подпись
   и число позиций двумя узлами, а decorate() свёл бы их в один .lbl
   без пробела: «Болид412» (#348). Колокольчик и строки его списка —
   тем же двумя и тремя узлами: знак и счётчик, заголовок, текст и время
   (#256). */
var SKIP='.pg button,.varrow .btn,.brandcol .bcl .btn,#bellBtn,.bellmenu .bi,'
  +'.weldrow .btn,a.tbtn.tel';

function pickIcon(el,txt){
  var a=el.getAttribute('data-act')||el.getAttribute('data-to')||'';
  if(a&&ACT[a])return ACT[a];
  for(var k in ATTR)if(el.hasAttribute(k))return ATTR[k];
  var first=(txt||'').trim().charAt(0);
  if(SYM[first])return SYM[first];
  var low=(txt||'').toLowerCase();
  for(var i=0;i<WORD.length;i++)if(WORD[i][0].test(low))return WORD[i][1];
  if(el.closest('.tobar,.stabs,.tabs,.dl .tabs'))return 'i-list';
  return 'i-right';
}
function cleanLabel(t){
  t=String(t==null?'':t);
  /* Снимаем ведущий символ-«иконку»: он и был мусором, из-за которого
     появилось правило И6. Значение уходит в настоящую иконку. */
  var i=0;
  while(i<t.length){
    var ch=t.charAt(i);
    if(SYM[ch]!==undefined||ch===' '||ch===' '||ch==='️'){i++;continue}
    var cp=t.codePointAt(i);
    if(cp>=0x1F000){i+=String.fromCodePoint(cp).length;continue}
    break;
  }
  return t.slice(i).trim();
}
var NOTBTN={SELECT:1,INPUT:1,TEXTAREA:1,OPTION:1,OPTGROUP:1};
function decorate(el){
  if(!el||el.nodeType!==1)return;
  /* На выпадающий список и на поле ввода в этом коде местами повешен класс
     .btn — ради одинакового вида. Их содержимое трогать нельзя: перерисовка
     стёрла бы варианты выбора. */
  if(NOTBTN[el.tagName])return;
  if(el.querySelector('svg.i'))return;              /* уже оформлена */
  if(el.matches(SKIP)||el.closest(SKIP))return;
  if(el.querySelector('button,input,select,textarea'))return;
  var raw=el.textContent||'';
  var lbl=cleanLabel(raw);
  var icon=pickIcon(el,raw);
  if(!icon)return;
  var full=el.getAttribute('title')||lbl||el.getAttribute('aria-label')||ICONNAME[icon]||'';
  el.innerHTML=svg(icon)+(lbl?'<span class="lbl">'+lbl.replace(/[<>&]/g,function(c){
    return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})+'</span>':'');
  /* И7б · полное название в title: его читает и подсказка, и экранный диктор */
  if(full)el.setAttribute('title',full); else el.removeAttribute('title');
  if(!el.getAttribute('aria-label')&&full)el.setAttribute('aria-label',full);
  if(!lbl)el.classList.add('io');
  else if(IOSET[icon]&&!el.closest(NOIO))el.classList.add('io');
}
function decorateAll(root){
  /* Сам корень тоже размечаем: querySelectorAll его не возвращает, а
     вставляют в дерево чаще всего именно кнопку целиком. */
  if(root&&root.matches&&root.matches('button, .btn, .bt, .tbtn, .stab'))decorate(root);
  if(root&&root.matches){
    if(root.matches('.drag')&&!root.querySelector('svg')){
      root.innerHTML=svg('i-drag');root.title=root.title||'Перетащить';}
    if(root.matches('.xrow')&&!root.querySelector('svg')){
      root.innerHTML=svg('i-x');root.title=root.title||'Убрать строку';}
  }
  $$('button, .btn, .bt, .tbtn, .stab',root||D).forEach(function(el){
    if(el.tagName==='BUTTON'||el.classList.contains('btn')||el.classList.contains('bt')
       ||el.classList.contains('tbtn')||el.classList.contains('stab'))decorate(el);
  });
  /* Символы вместо иконок в служебных ячейках — то же правило И6 */
  $$('.drag',root||D).forEach(function(d){if(!d.querySelector('svg')){
    d.innerHTML=svg('i-drag');d.title=d.title||'Перетащить';}});
  $$('.mn',root||D).forEach(function(m){
    if(m.querySelector('svg'))return;
    var menu=m.querySelector('.menu');
    m.textContent='';
    m.insertAdjacentHTML('afterbegin',svg('i-dots'));
    if(menu)m.appendChild(menu);
    m.title=m.title||'Действия со строкой';
  });
  $$('.xrow',root||D).forEach(function(x){if(!x.querySelector('svg')){
    x.innerHTML=svg('i-x');x.title=x.title||'Убрать строку';}});
}
decorateAll();
/* Перерисовка списка на 264 позиции — это одна пачка изменений. Собираем их
   в один проход через кадр, иначе оформление кнопок гоняется по разу
   на каждую вставленную строку. */
var moPend=false,moRoots=[];
var mo=new MutationObserver(function(recs){
  /* Размечаем только то, что появилось, а не весь документ заново: обход
     всего дерева на каждое изменение — это перерисовка списка на 264
     позиции, помноженная на число вставок. */
  for(var i=0;i<recs.length;i++){
    if(recs[i].type!=='childList')continue;
    for(var j=0;j<recs[i].addedNodes.length;j++){
      var n=recs[i].addedNodes[j];
      if(n.nodeType===1)moRoots.push(n);
    }
  }
  if(!moRoots.length||moPend)return;
  moPend=true;
  requestAnimationFrame(function(){
    moPend=false;
    var roots=moRoots; moRoots=[];
    roots.forEach(function(r){if(r.isConnected)decorateAll(r);});
    syncSelAll();restoreOpen();UI_markEmpty();
  });
});
mo.observe(D.body,{childList:true,subtree:true});

/* ── 4. РАСКРЫТИЕ ЗАПИСИ НА ТЕЛЕФОНЕ (И16) ─────────────────────────────
   На широком экране ничего не делаем: там таблица остаётся таблицей. ── */
D.addEventListener('click',function(e){
  var h=e.target.closest('.acch');
  if(h&&!e.target.closest('select,button,input,a')){h.parentElement.classList.toggle('op');return}
  if(window.innerWidth>900)return;
  if(e.target.closest('select,button,input,a'))return;
  var td=e.target.closest('.xscroll tbody td:first-of-type');
  if(td&&td.parentElement)td.parentElement.classList.toggle('op');
});

/* ── 4а. ОБЩИЙ ВЫБОР ПОЗИЦИЙ И МЕНЮ «ЕЩЁ» ──────────────────────────────
   Выделить всё и разом удалить или продублировать было нечем: галочка
   стояла у каждой строки, а над списком — ничего. Галочка в шапке
   таблицы и кнопка в полосе выбора закрывают это на компьютере и на
   телефоне, где шапки нет. ── */
function canEditNow(){try{return typeof canEdit!=='function'||canEdit()}catch(e){return true}}
function selAll(on){
  if(typeof rows==='undefined'||typeof sel==='undefined')return;
  if(!canEditNow())return;
  sel.clear();
  if(on)rows.forEach(function(r){if(r.type!=='section'&&r.type!=='calc')sel.add(r.id)});
  if(typeof render==='function')render();
  syncSelAll();
  if(typeof toast==='function')
    toast(on?('Выбрано позиций: '+sel.size):'Выбор снят');
}
function syncSelAll(){
  var c=$('#selall'); if(!c)return;
  if(typeof rows==='undefined'||typeof sel==='undefined')return;
  var n=rows.filter(function(r){return r.type!=='section'&&r.type!=='calc'}).length;
  c.disabled=!canEditNow()||!n;
  c.checked=n>0&&sel.size>=n;
  c.indeterminate=sel.size>0&&sel.size<n;
}
D.addEventListener('change',function(e){
  if(e.target&&e.target.id==='selall')selAll(e.target.checked);
});
D.addEventListener('click',function(e){
  var b=e.target.closest('[data-act="selall"]');
  if(b){var n=(typeof rows!=='undefined')
      ? rows.filter(function(r){return r.type!=='section'&&r.type!=='calc'}).length : 0;
    selAll(!(typeof sel!=='undefined'&&n&&sel.size>=n)); return;}
  var rl=$('#roleList');
  if(rl&&rl.style.display!=='none'&&!e.target.closest('.usr'))rl.style.display='none';
});

/* ── 4б. СВЁРНУТАЯ ПОЗИЦИЯ НА ПЛАНШЕТЕ И ТЕЛЕФОНЕ ──────────────────────
   Разворот держим по идентификатору строки, а не по классу на элементе:
   список перерисовывается целиком при каждой правке, и класс на узле
   после этого теряется — раскрытая позиция схлопывалась под руками. ── */
var OPEN=Object.create(null);
var WIDE=1180;
function restoreOpen(){
  $$('#list>.rowwrap[data-id]').forEach(function(rw){
    rw.classList.toggle('op',!!OPEN[rw.dataset.id]);
  });
}
D.addEventListener('click',function(e){
  if(window.innerWidth>WIDE)return;
  var nc=e.target.closest('.row>.cell.namecell'); if(!nc)return;
  /* Название — поле правки, ссылка ведёт в магазин, подсказка подбора
     живёт своей жизнью. По ним не сворачиваем. */
  if(e.target.closest('.nmField,a,button,input,select,textarea,.offerline,.varbox'))return;
  var rw=nc.closest('.rowwrap'); if(!rw||!rw.dataset.id)return;
  if(OPEN[rw.dataset.id])delete OPEN[rw.dataset.id]; else OPEN[rw.dataset.id]=1;
  rw.classList.toggle('op');
});

var UI_markEmpty=function(){};
/* ── 4в. «СЮДА ЕЩЁ НЕ ВВОДИЛИ» ────────────────────────────────────────
   Пустое поле формы подсвечивается тёплым и слабым. Делается разметкой,
   а не правкой каждой формы: полей в приложении под сотню, и половина
   из них собирается строками внутри скриптов. ── */
var NEEDSEL='.dl .gi, .dl table.dt input, .fin, .tf, .inp, #calcpanel input';
function markEmpty(){
  $$(NEEDSEL).forEach(function(i){
    if(i.type==='checkbox'||i.type==='radio'||i.type==='file')return;
    if(i.readOnly||i.disabled){i.classList.remove('need');return}
    i.classList.toggle('need',!String(i.value||'').trim());
  });
}
D.addEventListener('input',function(e){
  var t=e.target;
  if(t&&t.matches&&t.matches(NEEDSEL))t.classList.toggle('need',!String(t.value||'').trim());
});
UI_markEmpty=markEmpty;

/* ── 5. СЕМЬ УЗЛОВ. Одна работа на все 33 окна приложения. ────────────── */
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

var UI={};
UI.esc=esc;
UI.icon=svg;

/* Уведомление о сохранении. Заменяет прежний toast: тот же вызов, но со
   значком — сообщение об успехе и об ошибке больше не путаются. */
var tEl=null,tTimer=null;
UI.toast=function(msg,ms,kind){
  tEl=tEl||D.getElementById('toast');
  if(!tEl)return;
  var ic=kind==='bad'?'i-warn':(kind==='info'?'i-help':'i-ok');
  tEl.innerHTML=svg(ic)+'<span>'+esc(msg)+'</span>';
  tEl.classList.add('on');
  clearTimeout(tTimer);
  tTimer=setTimeout(function(){tEl.classList.remove('on')},ms||2200);
};
window.toast=function(m,ms){UI.toast(m,ms,/не |ошиб|нельзя|отказ|не удалось/i.test(String(m))?'bad':'ok')};

/* Модальное окно */
UI.modal=function(o){
  o=o||{};
  var w=D.createElement('div');
  w.className='mdl on';
  w.innerHTML='<div class="mwin'+(o.narrow?' narrow':'')+(o.wide?' wide':'')+'">'
    +'<div class="mhead"><div style="min-width:0;flex:1"><b>'+esc(o.title||'')+'</b>'
    +(o.sub?'<div class="s">'+esc(o.sub)+'</div>':'')+'</div>'
    +'<button class="btn sm" data-ui="close" title="Закрыть окно">'+svg('i-x')+'</button></div>'
    +'<div class="mbody">'+(o.body||'')+'</div>'
    +'<div class="mfoot">'
    +'<button class="btn" data-ui="close" title="'+esc(o.cancel||'Отмена')+'">'
       +svg('i-x')+'<span class="lbl">'+esc(o.cancel||'Отмена')+'</span></button>'
    +(o.ok===null?'':'<button class="btn primary" data-ui="ok" title="'+esc(o.ok||'Сохранить')+'">'
       +svg(o.okIcon||'i-save')+'<span class="lbl">'+esc(o.ok||'Сохранить')+'</span></button>')
    +'</div></div>';
  D.body.appendChild(w);
  function close(){w.remove();D.removeEventListener('keydown',key)}
  function key(e){if(e.key==='Escape')close()}
  D.addEventListener('keydown',key);
  w.addEventListener('click',function(e){
    if(e.target===w){close();return}
    var b=e.target.closest('[data-ui]'); if(!b)return;
    if(b.dataset.ui==='close')close();
    if(b.dataset.ui==='ok'){
      if(!o.onOk){close();return}
      var r=o.onOk(w);
      if(r===false)return;
      // Окно закрывалось до ответа сервера, и отказ стирал всё введённое:
      // в снабжении, «сверх сметы» и метках плана человек набирал форму
      // заново, не зная, что именно не понравилось. Ждём промис, если он
      // вернулся; ошибка остаётся в окне вместе с данными.
      if(r&&typeof r.then==='function'){
        b.disabled=true;
        r.then(function(v){if(v!==false)close();},
               function(err){showErr(err&&err.message||'Не сохранилось');})
         .then(function(){b.disabled=false;});
        return;
      }
      close();
    }
  });
  function showErr(text){
    var box=w.querySelector('.merr');
    if(!box){box=D.createElement('div');box.className='merr errbox';
      box.style.margin='0 0 10px';
      var body=w.querySelector('.mbody'); if(body)body.insertBefore(box,body.firstChild);}
    box.textContent=text;
  }
  return {el:w,close:close,error:showErr};
};

/* Подтверждение вместо системного окна браузера. Возвращает обещание:
   true — согласились, false — отказались или закрыли любым способом.
   Системное окно нельзя ни оформить, ни прочитать с телефона нормально,
   а половина подтверждений в этом коде — необратимые действия. */
UI.confirm=function(o){
  o=o||{};
  return new Promise(function(res){
    var answered=false;
    var m=UI.modal({
      narrow:true,
      title:o.title||'Подтвердите',
      sub:o.sub||'',
      body:'<p class="note" style="margin:0 0 4px">'+esc(o.text||'')+'</p>'
        +(o.warn?'<div class="fnote warn" style="margin-top:12px">'+esc(o.warn)+'</div>':''),
      cancel:o.cancel||'Отмена',
      ok:o.ok||'Да',
      okIcon:o.okIcon||'i-ok',
      onOk:function(){answered=true;res(true);}
    });
    /* Закрыли крестиком, «Отменой», Escape или щелчком мимо — это отказ. */
    var watch=new MutationObserver(function(){
      if(!D.body.contains(m.el)){watch.disconnect(); if(!answered)res(false);}
    });
    watch.observe(D.body,{childList:true});
  });
};

/* Окно «скопируйте ссылку». Нужно там, где буфер обмена недоступен:
   в браузере без разрешения на запись в буфер prompt() был единственным
   способом отдать человеку ссылку — и выглядел он соответствующе. */
UI.copyBox=function(title,url,note){
  var m=UI.modal({
    narrow:true, title:title||'Ссылка', ok:null,
    cancel:'Закрыть',
    body:'<div class="fcell wide"><input class="fin" id="uiCopy" readonly value="'+esc(url)+'">'
      +'<div class="fnote">'+esc(note||'Выделите и скопируйте — буфер обмена браузером не разрешён.')+'</div></div>'
  });
  var i=m.el.querySelector('#uiCopy');
  if(i){try{i.focus();i.select();}catch(e){}}
  return m;
};

/* Пустое состояние списка */
UI.empty=function(o){o=o||{};
  return '<div class="est">'+svg(o.icon||'i-fold')
    +'<b>'+esc(o.title||'Пока пусто')+'</b>'
    +'<p>'+esc(o.text||'')+'</p>'
    +(o.act?'<button class="btn primary" data-act="'+esc(o.act)+'" title="'+esc(o.btn||'')+'">'
       +svg(o.btnIcon||'i-plus')+'<span class="lbl">'+esc(o.btn||'')+'</span></button>':'')
    +'</div>';
};
/* Состояние ошибки */
UI.error=function(o){o=o||{};
  return '<div class="erst">'+svg('i-warn')
    +'<b>'+esc(o.title||'Не получилось')+'</b>'
    +'<p>'+esc(o.text||'')+'</p>'
    +(o.act?'<button class="btn'+(o.primary?' primary':'')+'" data-act="'+esc(o.act)+'" '
       +'title="'+esc(o.btn||'Повторить')+'">'
       +svg('i-refr')+'<span class="lbl">'+esc(o.btn||'Повторить')+'</span></button>':'')
    +(o.altAct?'<div class="alt"><button class="btn ghost" data-act="'+esc(o.altAct)+'" '
       +'title="'+esc(o.alt||'')+'">'+esc(o.alt||'')+'</button></div>':'')
    +'</div>';
};
/* Состояние загрузки: полоски вместо крутилки — видно, что появится */
UI.loading=function(n){
  var s='';
  for(var i=0;i<(n||4);i++)s+='<div class="skrow"><div class="skel t"></div><div class="skel s"></div></div>';
  return '<div class="cd">'+s+'</div>';
};
/* Загрузка файла перетаскиванием */
UI.dropzone=function(el,onFiles){
  if(!el||el.__dz)return; el.__dz=1;
  ['dragenter','dragover'].forEach(function(t){el.addEventListener(t,function(e){
    e.preventDefault();el.classList.add('over')})});
  ['dragleave','drop'].forEach(function(t){el.addEventListener(t,function(e){
    e.preventDefault();el.classList.remove('over')})});
  el.addEventListener('drop',function(e){
    var f=e.dataTransfer&&e.dataTransfer.files; if(f&&f.length&&onFiles)onFiles(f)});
};
/* Раскрытие строки на узком экране держит этот блок, поэтому и снаружи
   его меняют только отсюда: класс, поставленный мимо OPEN, теряется при
   первой же перерисовке списка. */
UI.rowOpen=function(id,on){
  if(on)OPEN[id]=1; else delete OPEN[id];
  restoreOpen();
};

window.UI=UI;

/* ── 6. СПАРКЛАЙН В КАРТОЧКЕ ПОКАЗАТЕЛЯ ────────────────────────────── */
function spark(){
  $$('svg.sp').forEach(function(s){
    var raw=s.getAttribute('data-v'); if(!raw)return;
    var v=raw.split(',').map(Number), c=s.getAttribute('data-c')||'#7A828C',
        w=s.clientWidth||240, h=34,
        mn=Math.min.apply(null,v), mx=Math.max.apply(null,v), r=(mx-mn)||1,
        p=v.map(function(y,i){return [i/(v.length-1)*w, h-4-(y-mn)/r*(h-10)]});
    var d='M'+p[0][0].toFixed(1)+' '+p[0][1].toFixed(1);
    for(var i=1;i<p.length;i++){var a=p[i-1],b=p[i],cx=(a[0]+b[0])/2;
      d+=' C'+cx.toFixed(1)+' '+a[1].toFixed(1)+' '+cx.toFixed(1)+' '+b[1].toFixed(1)
        +' '+b[0].toFixed(1)+' '+b[1].toFixed(1);}
    s.setAttribute('viewBox','0 0 '+w+' '+h);
    s.innerHTML='<path d="'+d+' L'+w+' '+h+' L0 '+h+' Z" fill="'+c+'" opacity=".10"/>'
      +'<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="1.8" '
      +'stroke-linecap="round" stroke-linejoin="round"/>';
  });
}
UI.spark=spark;
spark();
var rt=null;
window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(spark,120)});

})();
