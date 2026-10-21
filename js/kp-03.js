(function(){

var SAPI='/montazh/api';
var SH={sub:'shift',objects:null,current:undefined,salary:null,report:false,busy:false,err:'',geo:null,q:'',
        year:new Date().getFullYear(),month:new Date().getMonth()+1,
        // ents — юрлица компании; entFilter — по какому строим табель и ведомость.
        // Пусто = все юрлица, это же и единственный вариант, пока юрлицо одно.
        ents:null,entFilter:'',objs:null,objQ:'',cloud:null,
        // «Мои деньги»: период задаёт сервер (с 11-го по 10-е), клиент его не вычисляет.
        money:undefined,mYear:null,mMonth:null};

function sess(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}}
function role(){try{return localStorage.getItem('fse_role')||'office'}catch(e){return 'office'}}
// Табель и оклады по всей компании — право payroll:write. Роль тут больше ни при чём.
function boss(){return can('payroll:write');}
// Менеджер без своей смены (#59): видит только вкладку «Объекты» — назначает
// куратора и исполнителя, но ни табеля, ни окладов у него в этом разделе нет.
function objOnly(){return !boss() && !can('shift:own') && (can('object:assign')||can('object:curator'));}
// Свой user_id — чтобы куратор мог отфильтровать «объекты, за которые
// отвечает» (#59); тот же ключ localStorage пишет kp-01.js при входе.
function myUid(){try{var v=localStorage.getItem('fse_uid');if(v)return +v;}catch(e){}return 0;}
var ROLE_RU={admin:'Администратор',director:'Директор',office_admin:'Администратор офиса',office:'Менеджер',
  montazhnik:'Исполнитель',snab:'Снабжение',partner:'Партнёр',customer:'Заказчик',
  to_engineer:'Инженер ТО'};
function roleRu(r){return ROLE_RU[r]||r||'';}
// esc2 удалён — экранировщик в файле один, esc() из первого блока.

// Отказ без объяснения сервера: человеку на объекте нужен не код ответа, а
// что не получилось, что уже сохраненное цело и что делать. status 0 — сети нет.
function failText(status,what){
  if(!status)return 'Нет связи: '+what+', сохраненное на месте. Повторите, когда появится сеть.';
  if(status>=500)return 'Сервер не ответил: '+what+', сохраненное на месте. Повторите через минуту.';
  return what.charAt(0).toUpperCase()+what.slice(1)+' — обновите страницу и повторите.';
}
// Вкладки «Смены» из kp-11 и kp-12 говорят теми же словами.
window.fseFailText=failText;

async function sapi(path,opts){
  opts=opts||{};
  // Только сессия: общего токена больше нет, и ручки монтажа определяют
  // компанию по ней же.
  opts.headers=Object.assign({'X-FSE-Session':sess()},opts.headers||{});
  var what=(opts.method&&opts.method!=='GET')?'действие не сохранилось':'раздел не загрузился';
  var r;
  try{r=await fetch(SAPI+path,opts);}catch(e){throw new Error(failText(0,what));}
  // 401 — не «ошибка раздела», а конец сессии: уводим на вход, а не оставляем
  // человека тыкать кнопки, которые ничего не сохраняют.
  if(r.status===401&&typeof authExpired==='function'){authExpired();}
  var t=await r.text();
  var d=null; try{d=t?JSON.parse(t):null}catch(e){}
  if(!r.ok) throw new Error((d&&d.detail)||failText(r.status,what));
  return d;
}

// Геолокация обязательна: без координат смену не начать и не закрыть.
// Отказ несёт код браузера — по нему экран подсказывает, что делать:
// разрешить доступ, включить геолокацию или просто попробовать ещё раз.
function geo(){
  return new Promise(function(res,rej){
    if(!navigator.geolocation)return rej(geoErr(0));
    navigator.geolocation.getCurrentPosition(
      function(p){res({lat:p.coords.latitude,lon:p.coords.longitude,accuracy_m:p.coords.accuracy});},
      function(e){rej(geoErr(e&&e.code));},
      {enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
}
var GEO_MSG={0:'Браузер не умеет определять геопозицию',
             1:'Доступ к геопозиции запрещён',
             2:'Телефон не смог определить координаты',
             3:'Координаты не определились за 15 секунд'};
var GEO_HINT={0:'Откройте приложение в Chrome или Safari.',
              1:'Разрешите сайту доступ к геопозиции — в запросе браузера или в настройках сайта — и нажмите «Определить снова».',
              2:'Проверьте, что геолокация на телефоне включена, выйдите из-под перекрытия и нажмите «Определить снова».',
              3:'Под открытым небом обычно быстрее — нажмите «Определить снова».'};
function geoErr(code){
  var e=new Error(GEO_MSG[code]||GEO_MSG[2]); e.geo=true; e.code=(code in GEO_MSG)?code:2; return e;
}
// Отказ геометки — состояние на месте нажатия, а не строка наверху раздела:
// видно, что смена не открыта (или не закрыта и часы идут), и что нажать
// дальше. Главное действие — попробовать снова; запасное — продолжить без
// координат: работа не останавливается, руководитель увидит отметку.
function geoState(){
  var g=SH.geo, stop=g.on==='stop';
  var text=(stop?'Смена не закрыта, часы идут. ':'Смена не открыта. ')+(GEO_HINT[g.code]||'')
    +' Можно и без геометки — руководитель увидит отметку «без геометки».';
  var alt=stop?'Закрыть без геометки':'Открыть без геометки';
  if(!window.UI)return '<div class="erin"><svg class="i"><use href="#i-warn"/></svg>'
    +'<span>'+esc(g.msg+'. '+text)+'</span>'
    +'<button class="btn sm" data-act="sh-geo" style="margin-left:auto">Определить снова</button>'
    +'<button class="btn sm ghost" data-act="sh-nogeo">'+esc(alt)+'</button></div>';
  return UI.error({title:g.msg,text:text,act:'sh-geo',btn:'Определить снова',primary:true,
                   alt:alt,altAct:'sh-nogeo'});
}

function hhmm(iso){try{var d=new Date(iso);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}catch(e){return '';}}
function since(iso){try{var m=Math.floor((Date.now()-new Date(iso))/60000);
  return Math.floor(m/60)+' ч '+(m%60)+' мин';}catch(e){return '';}}
var NB='\u00A0';
// И12а · разделители разрядов и пробел перед знаком валюты неразрывные,
// иначе «₽» уезжает на вторую строку и читается как отдельное число.
function money(n){return (n==null?'—':new Intl.NumberFormat('ru-RU').format(Math.round(n))
  .replace(/\s/g,NB)+NB+'₽');}
function hrs(n){return String(Math.round((+n||0)*10)/10).replace('.',',');}

// ── Снимки смен ──
// Публичной ссылки у фотографии больше нет: на снимке выжжены координаты
// объекта заказчика, дата и название компании — в открытом доступе этому не
// место. Файл отдаёт ручка-прокси, требующая заголовок сессии, а его браузер
// при загрузке <img src> не отправляет. Значит тянем сами и показываем blob.
var PH={urls:[],open:''};
// Освобождать обязательно: без revoke каждый показ журнала оставлял в памяти
// вкладки по мегабайту на снимок, и за смену телефон начинал задыхаться.
// Единственное исключение — снимок, открытый сейчас во весь экран: отпустить
// его значит превратить картинку в «битую» прямо на глазах.
function phFree(){
  var ov=document.getElementById('phOv');
  var keep=(ov&&ov.classList.contains('on'))?PH.open:'';
  var left=[];
  PH.urls.forEach(function(u){
    if(u&&u===keep){left.push(u);return;}
    try{URL.revokeObjectURL(u)}catch(e){}});
  PH.urls=left;
}
function phWhen(at){try{var d=new Date(String(at||'').replace(' ','T'));
  if(isNaN(d.getTime()))return '';
  var p=function(n){return ('0'+n).slice(-2);};
  return p(d.getDate())+'.'+p(d.getMonth()+1)+' '+p(d.getHours())+':'+p(d.getMinutes());}catch(e){return '';}}
// shiftId передаём только там, где снимок можно убрать (журнал «Смены и
// снимки» в Табеле) — на карточке текущей смены исполнителя кнопки нет,
// снимать доказательство вправе только тот, кто работу принимает (#106).
function phThumbs(files,shiftId){
  var list=(files||[]).filter(function(f){return f&&f.url;});
  if(!list.length)return '';
  var delOk=shiftId!=null&&typeof can==='function'&&can('media:delete');
  return '<div class="phrow">'+list.map(function(f){
    var geo=(f.lat!=null&&f.lon!=null)?(Number(f.lat).toFixed(4)+', '+Number(f.lon).toFixed(4)):'';
    return '<div class="phi" data-ph="'+esc(f.url)+'" title="'+esc([f.name||'',geo].filter(Boolean).join(' · '))+'">'
      +'<div class="phimg"><span class="phw">загрузка…</span></div>'
      +((delOk&&f.ref)?('<button class="btn sm danger phdel" data-act="sh-phdel" data-sid="'+esc(shiftId)
        +'" data-ref="'+esc(f.ref||'')+'" title="Убрать снимок из карточки">'
        +'<svg class="i"><use href="#i-x"/></svg></button>'):'')
      +'<div class="phc">'+esc(phWhen(f.at))+'</div></div>';}).join('')+'</div>';
}
// Тянем по очереди: десяток одновременных запросов к прокси упирается в лимит
// соединений браузера, и первый же снимок ждёт дольше, чем все остальные.
async function phLoad(root){
  var items=[].slice.call((root||document).querySelectorAll('.phi[data-ph]'));
  for(var i=0;i<items.length;i++){
    var el=items[i], url=el.getAttribute('data-ph'), box=el.querySelector('.phimg');
    el.removeAttribute('data-ph');                 // второй раз тот же файл не тянем
    try{
      var r=await fetch(url,{headers:{'X-FSE-Session':sess()}});
      if(!r.ok)throw new Error('HTTP '+r.status);
      var u=URL.createObjectURL(await r.blob());
      PH.urls.push(u); el._blob=u;
      if(box){box.innerHTML='';
        var img=document.createElement('img'); img.alt='Снимок смены'; img.src=u; box.appendChild(img);}
    }catch(e){
      // Битая картинка выглядит как поломка приложения. Заглушка честнее:
      // видно, что снимок есть, просто сейчас не открылся.
      if(box)box.innerHTML='<span class="phw">снимок не открылся</span>';
    }
  }
}
function phOpen(u){
  var ov=document.getElementById('phOv');
  if(!ov){
    ov=document.createElement('div'); ov.id='phOv';
    ov.innerHTML='<img alt="Снимок смены"><button class="btn sm" id="phClose">Закрыть</button>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(){ov.classList.remove('on');});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape')ov.classList.remove('on');});
  }
  var im=ov.querySelector('img'); if(im)im.src=u;
  PH.open=u; ov.classList.add('on');
}
// Открытие в полный размер — тем же blob: второй раз ходить на сервер незачем.
document.addEventListener('click',function(ev){
  // Кнопка «убрать снимок» лежит внутри .phi — свой обработчик на data-act
  // ниже, открывать снимок при клике по ней не нужно.
  if(ev.target.closest&&ev.target.closest('[data-act]'))return;
  var t=ev.target.closest&&ev.target.closest('.phi'); if(!t)return;
  if(t._blob)phOpen(t._blob);
});

// ── Экран Исполнителя ──
// ── Экран «Смена» ────────────────────────────────────────────────────
// Две карточки в одной сетке: слева работа прямо сейчас, справа месяц.
// Раньше это были два разных экрана, и чтобы понять «сколько уже за месяц»,
// приходилось уходить со смены на вкладку табеля и возвращаться обратно.

function shiftParams(c){
  // Пары «подпись — значение». Таблицы нет: две колонки сеткой читаются
  // так же, а на узком экране не ломаются.
  var rows=[];
  rows.push(['Начало', hhmm(c.started_at)+(c.geo_start?(' · '+esc(c.geo_start)):'')
    +(c.geo===false?' · <span style="color:var(--amb)">без геометки</span>':'')]);
  rows.push(['Идёт', since(c.started_at)]);
  if(SH.lines&&SH.lines.length){
    var done=SH.lines.filter(function(l){return l.qty_remaining!=null&&+l.qty_remaining<=0;}).length;
    rows.push(['Объёмы по смете', done+' из '+SH.lines.length]);
  }else if(SH.lines&&!SH.lines.length){
    rows.push(['Объёмы по смете','в смете нет позиций']);
  }
  rows.push(['Фотографии', (c.photos||0)
    ? String(c.photos)
    : '<span style="color:var(--amb)">пока ни одной</span>']);
  return '<div class="prmg">'+rows.map(function(r){
    return '<span>'+r[0]+'</span><span class="v">'+r[1]+'</span>';}).join('')+'</div>';
}

function cardCurrent(c){
  var geoStop=!!(SH.geo&&SH.geo.on==='stop');
  return '<div class="cd" style="box-shadow:inset 3px 0 0 var(--grn)">'
   + '<div class="cdh"><h2>'+esc(c.object_name)+'</h2>'
   +   '<span class="stt ok" style="margin-left:auto"><i></i>идёт</span></div>'
   + '<div class="pd pd0">'+shiftParams(c)+'</div>'
   + ((c.files&&c.files.length)?('<div class="pd pd0">'+phThumbs(c.files)+'</div>'):'')
   + (geoStop?geoState():'')
   + '<div class="pd" style="display:flex;gap:8px;flex-wrap:wrap">'
   +   (geoStop?'':'<button class="btn primary" data-act="sh-stop" title="Закрыть смену">'
   +     '<svg class="i"><use href="#i-ok"/></svg><span class="lbl">Закрыть смену</span></button>')
   +   '<button class="btn io'+(SH.volOpen?' on':'')+'" data-act="sh-vol" title="Отметить объём">'
   +     '<svg class="i"><use href="#i-check"/></svg><span class="lbl">Отметить объём</span></button>'
   // Без capture и с multiple: снимал весь день — вечером выложил пачкой
   // из галереи. Телефон сам предложит и галерею, и камеру.
   +   '<label class="btn io" title="Добавить фото — из галереи или с камеры, можно несколько" '
   +     'aria-label="Добавить фото">'
   +     '<svg class="i"><use href="#i-cam"/></svg>'
   +     '<input id="shPhoto" type="file" accept="image/*" multiple style="display:none"></label>'
   + '</div>'
   + (SH.volOpen?('<div class="pd" style="border-top:1px solid var(--line)">'+viewLines()+'</div>'):'')
   + '<div class="callout">Одна открытая смена на человека. Это гарантирует база данных, '
   +   'а не проверка в интерфейсе.</div>'
   + '</div>';
}

function cardObjects(){
  var h='<div class="cd"><div class="cdh">'
   +'<div class="sr" style="max-width:none;flex:1"><span class="m">'
   +'<svg class="i"><use href="#i-srch"/></svg></span>'
   +'<input type="text" id="shSearch" placeholder="Поиск объекта по названию или заказчику" '
   +'value="'+esc(SH.q||'')+'" autocomplete="off"></div></div>';

  if(SH.objects===null)
    return h+(window.UI?UI.loading(3):'<div class="pd sub">Загрузка объектов…</div>')+'</div>';
  if(!SH.objects.length)
    return h+(window.UI?UI.empty({icon:'i-bld',
      title:SH.q?'По запросу ничего не найдено':'Объектов пока нет',
      text:SH.q?'Попробуйте часть названия или имя заказчика.'
               :'Объект создаётся в разделе «Сметы» — достаточно названия.'})
      :'<div class="pd sub">Объектов нет</div>')+'</div>';

  h+=SH.objects.map(function(o){
    var geoHere=!!(SH.geo&&SH.geo.on==='start'&&SH.geo.uid===o.uid);
    return '<div class="it" style="align-items:center"><div class="ni info">'
      +'<svg class="i"><use href="#i-bld"/></svg></div>'
      +'<div style="min-width:0"><div class="tx" style="font-weight:600">'+esc(o.name)+'</div>'
      +(o.customer||o.updated?'<div class="sb">'+esc(o.customer||'')
        +(o.customer&&o.updated?' · ':'')+esc(o.updated||'')+'</div>':'')
      +'</div>'
      +(geoHere?'':'<button class="btn sm" style="margin-left:auto" data-act="sh-start" '
      +'data-uid="'+esc(o.uid)+'" title="Начать смену на объекте">Начать</button>')+'</div>'
      +(geoHere?geoState():'');
  }).join('');
  return h+'<div class="callout">Смена открывается с геометкой, если телефон её отдал. Одна открытая смена '
   +'на человека — это гарантирует база данных, а не проверка в интерфейсе.</div></div>';
}

// Табель на экране смены — та же таблица, что в отчётах: дни в строку, часы
// в ячейках, итог и зарплата справа. Тепловая карта из квадратов показывала
// только, что месяц не пустой, и не отвечала на вопрос, кто когда работал.
// Ниже неё — журнал отметок: свои у исполнителя, все по объектам у директора
// и администратора (ручки /shift/report и /shift/list режут выдачу сами).
function cardTabel(){
  var r=SH.report;
  var h='<div class="cd"><div class="cdh"><h2>Табель'
   +((r&&r.month_name)?(' · '+esc(r.month_name)+' '+esc(r.year)):'')+'</h2>'
   +'<div style="margin-left:auto;display:flex;gap:8px;align-items:center">'
   + xlsxBtns()
   +'<button class="lnk" data-act="sh-tab" data-t="list" '
   +'title="Открыть табель целиком — с выбором месяца и юрлица">Весь</button>'
   +'</div></div>';
  if(r===null)return h+(window.UI?UI.loading(3):'')+'</div>';
  if(!r)return h+(window.UI?UI.empty({icon:'i-rep',title:'Табель не загружен',
    text:'Откройте вкладку «'+(boss()?'Табель':'Мой табель')
         +'» и выберите месяц.'}):'')+'</div>';

  var days=r.days||[], ppl=r.overall||[];
  if(!days.length||!ppl.length)
    return h+(window.UI?UI.empty({icon:'i-rep',title:'Закрытых смен за месяц нет',
      text:'Как только первая смена закроется, здесь появится табель по дням.'}):'')+'</div>';
  if(typeof rpGrid!=='function')
    return h+'<div class="pd sub">Таблица табеля не загрузилась — обновите страницу.</div></div>';

  h+='<div class="pd pd0">'+rpGrid('Общий график',days,ppl,boss()?'все объекты':'мои смены');
  // Разбивка по объектам — только тому, кто видит чужие смены: у исполнителя
  // objects повторил бы общий график его же строкой.
  if(boss())(r.objects||[]).forEach(function(o,i){h+=rpGrid((i+1)+'. '+o.name,days,o.rows);});
  h+=viewShiftLog()+'</div>';
  return h+'<div class="ft">Норма месяца — '+esc(r.norm_hours)+' ч</div></div>';
}

function viewShift(){
  if(SH.current===undefined)
    return (window.UI?UI.loading(2):'<div class="pd sub">Загрузка…</div>');
  var h='';
  if(SH.err)h+='<div class="erin"><svg class="i"><use href="#i-warn"/></svg>'
    +'<span>'+esc(SH.err)+'</span></div>';
  // План монтажа — прямо здесь, у открытой смены: монтажник отмечает прибор
  // и прикладывает снимок, не уходя на соседнюю вкладку. Объект берётся из
  // самой смены, поэтому выбирать его второй раз не нужно.
  var plan=(SH.current&&window.MPLAN)?MPLAN.view({embed:true}):'';
  return h+'<div class="shgrid">'
    +(SH.current?cardCurrent(SH.current):cardObjects())
    +'</div>'
    +plan
    +cardTabel();
}

// ── Объёмы по позициям сметы (бывший раздел «Монтаж») ──
function viewLines(){
  if(SH.lines===undefined)return '<div class="sub" style="padding:8px 0">Загрузка позиций…</div>';
  if(!SH.lines||!SH.lines.length)return '<div class="sub" style="padding:8px 0">'
    +'В этом объекте нет позиций сметы — отмечать нечего, просто закройте смену.</div>';
  return '<div style="border-top:1px solid var(--line,var(--line));margin-top:8px;padding-top:8px">'
    // Снимок обязателен и привязан к строке: своё поле у каждой позиции, а
    // галочка неактивна, пока фото не выбрано, — требование видно до нажатия.
    +'<div class="fnote" style="margin:0 0 6px">Отметка уходит вместе с фото выполненного '
    +'объёма: кнопка с камерой у позиции, можно несколько снимков.</div>'
    +SH.lines.map(function(l){
      var rid=esc(l.row_id), left=(l.qty_remaining!=null?l.qty_remaining:'—');
      return '<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line,var(--soft))">'
        +'<div style="flex:1;min-width:0"><div style="font-size:14px">'+esc(l.name)+'</div>'
        +'<div class="s">осталось '+left+' '+esc(l.unit||'')
        +' · <span id="volPhN_'+rid+'">фото не выбрано</span></div></div>'
        +'<input class="f fmini" id="vol_'+rid+'" placeholder="0" style="width:64px">'
        +'<label class="btn sm io" title="Фото к этой позиции — из галереи или с камеры, можно несколько" '
        +  'aria-label="Фото к позиции">'
        +  '<svg class="i"><use href="#i-cam"/></svg>'
        +  '<input type="file" id="volPh_'+rid+'" class="volPh" data-rid="'+rid+'" '
        +    'accept="image/*" multiple style="display:none"></label>'
        +'<button class="btn sm primary io" id="volSave_'+rid+'" data-act="sh-volsave" data-rid="'+rid+'" '
        +  'disabled title="Сначала приложите фото" aria-label="Отметить объём">'
        +  '<svg class="i"><use href="#i-save"/></svg></button>'
        +'</div>';}).join('')
    +'</div>';
}
async function loadLines(){
  try{ SH.lines=await sapi('/shift/lines'); }
  catch(e){ SH.lines=[]; SH.err=e.message; }
  renderShift();
}

// ── Юрлица ──
// Два разных смысла, и путать их нельзя: юрлицо договора отвечает за
// себестоимость объекта, юрлицо-работодатель — за ведомость и НДФЛ сотрудника.
function entList(){return SH.ents||[];}
// Форму собственности дописываем только если её нет в самом названии:
// «ООО "ССГ"» уже несёт её, и префикс давал «ООО ООО "ССГ"».
function entTitle(e){
  var n=String(e.name||'').trim();
  return n.toUpperCase().indexOf(String(e.type||'').toUpperCase())===0 ? n : (e.type+' '+n);
}
// Выбор сотрудника — куратор или исполнитель объекта (#59). value=0 в
// сохранении означает «не выбран», тот же приём, что у entSelect и юрлица.
function staffSelect(id,val,zero){
  var list=SH.staff||[];
  if(!list.length)return '<span class="s">'+esc(zero)+'</span>';
  return '<select id="'+id+'" class="f" style="width:auto;height:36px">'
   +'<option value="">'+esc(zero)+'</option>'
   + list.map(function(u){return '<option value="'+u.user_id+'"'
       +(String(val)===String(u.user_id)?' selected':'')+'>'
       +esc(u.full_name)+' — '+esc(roleRu(u.role))+'</option>';}).join('')
   +'</select>';
}
function entSelect(id,val,zero,many){
  var list=entList();
  if(!list.length||(list.length<2&&!many))return '';
  return '<select id="'+id+'" class="f" style="width:auto;height:36px">'
   +'<option value="">'+esc(zero)+'</option>'
   + list.map(function(e){return '<option value="'+e.id+'"'
       +(String(val)===String(e.id)?' selected':'')+'>'+esc(entTitle(e))+'</option>';}).join('')
   +'</select>';
}
// Разнесение сметы объекта по нескольким юрлицам (#64): одна работа —
// несколько строк «юрлицо + сумма», а не единственное юрлицо договора.
// Показываем только когда юрлиц хотя бы два — разносить одним нечем.
function splitHTML(o){
  if(entList().length<2)return '';
  var rows=o.entity_split||[];
  var sum=rows.reduce(function(s,r){return s+(+r.amount||0);},0);
  return '<div class="s" style="margin-bottom:5px">Разнесение сметы по юрлицам</div>'
   +(rows.length?rows.map(function(r){
      return '<div class="bar" style="margin:0 0 6px">'
       +'<span class="s" style="flex:1">'+esc(r.entity)+' — '+money(r.amount)+' ₽, '
       +   (r.vat===false?'без НДС':'с НДС')+'</span>'
       +'<button class="btn sm io danger" data-act="sh-splitdel" data-uid="'+esc(o.uid)+'" '
       +   'data-eid="'+r.entity_id+'" title="Убрать юрлицо из разнесения">'
       +   '<svg class="i"><use href="#i-x"/></svg></button></div>';
     }).join('')
     :'<div class="s" style="margin-bottom:6px">Не разнесена — целиком через юрлицо договора</div>')
   +(rows.length?('<div class="s" style="margin-bottom:6px">Итого разнесено: '+money(sum)+' ₽</div>'):'')
   // Черновик и отказ живут у самого поля (#260): раньше отказ уходил в шапку
   // раздела, которую с карточки не видно, а перерисовка стирала введённое —
   // «нажал „Добавить“ — ничего не произошло, и сумма пропала».
   +'<div class="bar" style="margin:0 0 '+(SH.splitNote?'4px':'10px')+'">'
   +  entSelect('split_ent',(SH.splitDraft||{}).ent||'','Юрлицо',true)
   +  '<input class="f" id="split_amt" inputmode="numeric" placeholder="₽" '
   +     'value="'+esc((SH.splitDraft||{}).amt||'')+'" style="width:120px;text-align:left;height:36px">'
   +  '<button class="btn sm primary" data-act="sh-splitadd" data-uid="'+esc(o.uid)+'">Добавить</button>'
   +'</div>'
   +(SH.splitNote?('<div class="fnote warn" data-note="split" style="margin:0 0 10px">'+esc(SH.splitNote)+'</div>'):'');
}

// ── Табель: тот же вид, что в отчётах TimeBot (календарь, часы, зарплата,
//    разбивка по объектам и полный список смен с примечаниями внизу).
//    Отрисовку переиспользуем — rpTables объявлена в основном блоке.
var MN_RU=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
function viewReport(){
  var yy=new Date().getFullYear(), years=[yy,yy-1,yy-2];
  var head='<div class="bar" style="padding:10px 12px;gap:8px">'
   +'<select id="shMonth" class="f" style="width:auto">'
   + MN_RU.map(function(m,i){return '<option value="'+(i+1)+'"'+(SH.month===i+1?' selected':'')+'>'+m+'</option>';}).join('')
   +'</select>'
   +'<select id="shYear" class="f" style="width:auto">'
   + years.map(function(y){return '<option'+(SH.year===y?' selected':'')+'>'+y+'</option>';}).join('')
   +'</select>'
   // Селект юрлица показываем только когда их больше одного: при единственном
   // ООО это был бы выпадающий список из одного пункта — лишний клик ни за что.
   + entSelect('shEnt',SH.entFilter,'Все юрлица')
   +'<span style="margin-left:auto;display:flex;gap:8px">'+xlsxBtns()+'</span></div>';

  if(SH.report===null)return head+'<div class="sub" style="padding:12px">Загрузка табеля…</div>';
  if(!SH.report)return head+'<div class="sub" style="padding:12px">'
    +esc(SH.err||'Выберите месяц.')+'</div>';
  try{
    if(typeof rpTables==='function'){
      var extra='';
      var adj=SH.report.adjust||[];
      var withPay=(SH.report.overall||[]).filter(function(p){return p.bonus||p.fine;});
      if(adj.length){
        extra+='<div class="sec">Премии и штрафы</div><div class="rptwrap"><table class="rpt">'
          +'<thead><tr><th class="nm">Кому</th><th>Дата</th><th>Вид</th><th>Сумма</th>'
          +'<th style="text-align:left">Основание</th></tr></thead><tbody>'
          +adj.map(function(a){return '<tr><td class="nm">'+esc(a.who)+'</td><td>'+esc(a.date)+'</td>'
            +'<td>'+(a.kind==='bonus'?'премия':'штраф')+'</td>'
            +'<td class="money">'+(a.kind==='bonus'?'+':'−')+money(a.amount)+'</td>'
            +'<td style="text-align:left">'+esc(a.reason)+'</td></tr>';}).join('')
          +'</tbody></table></div>';
      }
      if(withPay.length){
        extra+='<div class="sec">К выплате'
          +(SH.report.entity?(' · '+esc(SH.report.entity)):'')+'</div><div class="rptwrap"><table class="rpt">'
          +'<thead><tr><th class="nm">ФИО</th><th>Как платим</th><th>По окладу</th><th>Сдельно</th><th>Премии</th><th>Штрафы</th><th>Итого</th></tr></thead><tbody>'
          +(SH.report.overall||[]).map(function(p){
            var piece=p.pay_kind==='piece';
            // Объём, отмеченный человеком на ставке, показываем зачёркнутым:
            // работа учтена, но деньгами она не станет — иначе одна и та же
            // работа оплатилась бы дважды.
            var pc=(p.piece?money(p.piece):'');
            if(p.piece&&p.piece_unpaid)pc='<span style="opacity:.5;text-decoration:line-through" title="Человек на ставке — объём в оплату не идёт">'+pc+'</span>';
            return '<tr><td class="nm">'+esc(p.name)+'</td>'
            +'<td class="s">'+(piece?'сдельно':'ставка')+'</td>'
            +'<td class="money">'+(piece?'—':money(p.salary))+'</td>'
            +'<td class="money">'+pc
            +(p.piece_no_rate?('<span title="Отметок на позиции, удалённые из сметы: '+p.piece_no_rate+'. Ставку взять неоткуда, в оплату не вошли." style="color:var(--warn,var(--amb))"> без ставки</span>'):'')
            +'</td>'
            +'<td class="money">'+(p.bonus?('+'+money(p.bonus)):'')+'</td>'
            +'<td class="money">'+(p.fine?('−'+money(p.fine)):'')+'</td>'
            +'<td class="money"><b>'+money(p.to_pay!=null?p.to_pay:p.salary)+'</b></td></tr>';}).join('')
          +'</tbody></table></div>';
      }
      return head+'<div style="padding:0 12px 16px">'+rpTables(SH.report)+extra+viewShiftLog()+'</div>';
    }
  }catch(e){}
  // запасной вид, если основная отрисовка недоступна
  return head+'<div class="sub" style="padding:12px">Смен за период: '+(SH.report.shifts||[]).length+'</div>'
    +'<div style="padding:0 12px 16px">'+viewShiftLog()+'</div>';
}

// Координаты до пяти знаков — это около метра; длинный хвост только мешает
// читать, и в отчёте они стоят ровно в таком виде.
function geoShort(g){
  var p=String(g).split(',');
  var a=Number(p[0]), b=Number(p[1]);
  return (p.length===2&&isFinite(a)&&isFinite(b))?(a.toFixed(5)+', '+b.toFixed(5)):String(g);
}

// ── Полный список выполненного ──
// Те же столбцы, что на листе «Полный список» отчёта TimeBot: имя, объект,
// начало, конец, часы, примечание, локация. Восьмой столбец наш — снимки:
// смена без фото ничем не подтверждена, и доказательная база нужна там же,
// где список, а не отдельной лентой карточек рядом с ним.
function viewShiftLog(){
  var h='<div class="sec">Полный список';
  if(SH.slist===null||SH.slist===undefined)
    return h+'</div>'+(window.UI?UI.loading(3):'<div class="sub">Загрузка…</div>');
  // Список смен приезжает своей ручкой, и теперь он же — главное содержимое
  // под табелем. Молчать о его отказе нельзя: пустое место читается как
  // «смен не было», а это разные вещи.
  if(SH.slist===false)
    return h+'</div><div class="errbox">Список смен не загрузился — обновите страницу.</div>';
  if(!SH.slist.length)return '';
  h+='<span class="hint">смен: '+SH.slist.length+'</span></div>'
    +'<div class="xscroll"><table><thead><tr><th>Имя</th><th>Объект</th>'
    +'<th>Начало работы</th><th>Конец работы</th>'
    +'<th style="text-align:right">Кол-во часов</th>'
    +'<th>Примечание</th><th>Локация</th><th>Снимки</th></tr></thead><tbody>';
  h+=SH.slist.map(function(s,i){
    // Ручка /shift/photo сама находит «свою» подходящую смену — открытую
    // или закрытую не позже PHOTO_GRACE_HOURS назад, — а не берёт id из
    // запроса. Поэтому кнопка «фото задним числом» имеет смысл только у
    // самой свежей закрытой смены в списке: это и есть та смена, куда
    // снимок реально уйдёт.
    var late=(i===0 && s.end && s.photo_open);
    // На телефоне запись сворачивается до первой ячейки — в ней имя и начало,
    // иначе месяц смен одного человека свернётся в двадцать одинаковых строк.
    return '<tr><td data-l="Имя"><b>'+esc(s.who)+'</b>'
      +'<div class="sub">'+esc(s.start)+'</div></td>'
      +'<td data-l="Объект">'+esc(s.object)+'</td>'
      +'<td data-l="Начало работы">'+esc(s.start)+'</td>'
      +'<td data-l="Конец работы">'+(s.end?esc(s.end):'смена идёт')+'</td>'
      +'<td data-l="Кол-во часов" class="n" style="text-align:right">'
      +(s.hours?esc(s.hours):'—')+'</td>'
      +'<td data-l="Примечание">'+esc(s.note||'—')+'</td>'
      +'<td data-l="Локация">'+(s.geo_start?esc(geoShort(s.geo_start))
        :'<span style="color:var(--amb)">без геометки</span>')+'</td>'
      +'<td data-l="Снимки">'+(phThumbs(s.files,s.id)||'<span class="sub">снимков нет</span>')
      +(late?('<label class="btn sm io" style="display:inline-flex;margin-top:6px" '
        +  'title="Смена закрыта недавно — снимок ещё можно приложить">'
        +  '<svg class="i"><use href="#i-cam"/></svg>'
        +  '<span class="lbl">Фото задним числом</span>'
        +  '<input class="shPhotoLate" type="file" accept="image/*" multiple '
        +    'style="display:none"></label>'):'')
      +'</td></tr>';}).join('');
  return h+'</tbody></table></div>';
}

// ── Выгрузка табеля ──
// Книгу собирает сервер: за год это двенадцать табелей, и считать их
// в браузере значит двенадцать запросов вместо одного. Право на выгрузку
// одно — payroll:read: в книге стоят ставки и начисления по всем.

// Иконку и подпись ставим сами: общий оформитель прячет подпись у «выгрузить»
// (И7а), а в шапке карточки и в полосе её прячет ширина телефона (И5). Значки
// разные, потому что различать эти две кнопки приходится там, где от них
// остались одни значки.
function xlsxBtn(p,icon,lbl,title){
  return '<button class="btn sm" data-act="sh-xlsx" data-p="'+p+'" title="'+title+'">'
    +'<svg class="i"><use href="#'+icon+'"/></svg><span class="lbl">'+lbl+'</span></button>';
}
function xlsxBtns(){
  if(!can('payroll:read'))return '';
  return xlsxBtn('month','i-sheet','Выгрузить месяц','Табель за показанный месяц книгой Excel')
    +xlsxBtn('year','i-cal','Выгрузить год','Книга с листами по каждому месяцу года');
}
async function dlTabel(kind,el){
  var mo=(kind==='year')?null:SH.month, yr=SH.year;
  var q='?year='+yr+(mo?('&month='+mo):'')
    +(SH.entFilter?('&entity_id='+encodeURIComponent(SH.entFilter)):'');
  el.disabled=true;
  try{
    var r;
    try{r=await fetch(SAPI+'/shift/report.xlsx'+q,{headers:{'X-FSE-Session':sess()}});}
    catch(e1){throw new Error(failText(0,'табель не выгрузился'));}
    if(!r.ok){
      var txt=await r.text(), d=null;
      try{d=txt?JSON.parse(txt):null;}catch(e2){/* отказ пришёл не JSON-ом */}
      throw new Error((d&&d.detail)||failText(r.status,'табель не выгрузился'));
    }
    var u=URL.createObjectURL(await r.blob());
    var a=document.createElement('a');
    a.href=u; a.download='Табель '+(mo?(MN_RU[mo-1]+' '+yr):yr)+'.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){URL.revokeObjectURL(u);},1000);
    if(typeof toast==='function')toast('Табель выгружен');
  }catch(e){if(typeof toast==='function')toast(e.message,4000);}
  el.disabled=false;
}

// ── Мои деньги (исполнитель) ──
// Экран отвечает на один вопрос: сколько я заработал. Построчно, а не итогом:
// «чтобы после подсчётов не было скрытых цифр и формул, меньше вопросов
// к расчётчику» (владелец, 23.08.2026). Свёрнутая сумма эту задачу не решает,
// поэтому разбивка по объектам и по строкам сметы — требование, а не украшение.
//
// Показываем НАЧИСЛЕНО. Факта выплаты в системе нет, и слова «выплачено»
// на этом экране быть не должно ни в каком виде.

// Копейки показываем только когда они есть. Округление «для красоты» ломает
// сложение на экране: три строки по 0,50 ₽ дают итог на рубль больше суммы
// показанных чисел — ровно тот вопрос к расчётчику, ради которого экран и сделан.
function money2(n){
  if(n==null)return '—';
  var k=Math.round(n*100)%100;
  return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:k?2:0,maximumFractionDigits:2})
    .format(n).replace(/\s/g,NB)+NB+'₽';}
function qnum(n){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(+n||0)
  .replace(/\s/g,NB);}

// Формула строки: «3 шт × 1 200 ₽ × 0,6». Коэффициент объекта — часть ставки,
// и прятать его нельзя: именно из-за него сумма не сходится с ценой в смете.
function mnCalc(qty,unit,rate,coef){
  var s=qnum(qty)+NB+esc(unit);
  if(rate==null)return s;
  s+=' × '+money2(rate);
  if(coef!=null&&Math.abs(coef-1)>1e-9)s+=' × '+String(coef).replace('.',',');
  return s;}

function mnState(kind,qty,unit,rate,coef,amount){
  var appr=(kind==='approved');
  return '<div style="display:flex;gap:8px;align-items:baseline;padding:2px 0">'
    +'<span class="'+(appr?'pill in':'badge')+'" style="margin:0">'
    +(appr?'подтверждено':'отмечено')+'</span>'
    +'<span class="s" style="flex:1;min-width:0;white-space:normal">'
    +mnCalc(qty,unit,rate,coef)+'</span>'
    +'<span style="font-weight:600;white-space:nowrap">'+money2(amount)+'</span></div>';}

function viewMoney(){
  var M=SH.money;
  var ps=(M&&M.periods&&M.periods.length)?M.periods:null;
  var head='<div class="bar" style="padding:10px 12px;gap:8px">'
    +'<select id="mnPeriod" class="f" style="flex:1;min-width:0;height:36px">'
    +(ps?ps.map(function(p){
        return '<option value="'+p.year+'-'+p.month+'"'
          +((M&&M.period.year===p.year&&M.period.month===p.month)?' selected':'')
          +'>'+esc(p.title)+'</option>';}).join('')
       :'<option>текущий период</option>')
    +'</select></div>';

  if(M===null||M===undefined)
    return head+'<div class="sub" style="padding:12px">Загрузка начисления…</div>';
  if(M===false)
    return head+'<div class="sub" style="padding:12px">Начисление не загрузилось. '
      +esc(SH.err||'')+'</div>';

  var pays=!!(M.piece&&M.piece.pays);          // сдельщик: объём — это деньги
  var waiting=Math.round(((M.total||0)-(M.approved_total||0))*100)/100;
  var h=head+'<div style="padding:0 12px 16px">';

  // Итог периода. У сдельщика он делится на подтверждённое и ждущее приёмки —
  // до подтверждения куратора сумма видна, но в выплату не идёт.
  h+='<div class="speccard" style="display:block;margin:0 0 12px">'
    +'<div class="s">Начислено · '+esc(M.period.title)
    +(M.period.is_current?' · период идёт':'')+'</div>'
    +'<div style="font-size:26px;font-weight:700;letter-spacing:-.5px;margin:2px 0 0">'
    +money2(M.total)+'</div>';
  if(pays){
    h+='<div style="display:flex;gap:8px;align-items:baseline;margin-top:8px">'
      +'<span class="pill in" style="margin:0">подтверждено</span>'
      +'<span style="font-weight:600">'+money2(M.approved_total)+'</span></div>';
    if(waiting>0.004)
      h+='<div style="display:flex;gap:8px;align-items:baseline;margin-top:4px">'
        +'<span class="badge">отмечено, ждёт куратора</span>'
        +'<span style="font-weight:600">'+money2(waiting)+'</span></div>';
  }
  h+='</div>';

  // Оклад
  if(M.pay_kind!=='piece'){
    var S=M.salary||{};
    h+='<div class="sec">Оклад</div><div class="speccard" style="display:block;margin:0 0 4px">'
      +'<div style="display:flex;gap:8px"><span class="s" style="flex:1">Смен за период</span>'
      +'<b>'+(S.shifts||0)+'</b></div>'
      +'<div style="display:flex;gap:8px"><span class="s" style="flex:1">Часов</span>'
      +'<b>'+hrs(S.hours)+'</b></div>'
      +(S.amount!=null?('<div style="display:flex;gap:8px"><span class="s" style="flex:1">'
        +'Оклад в месяц</span><b>'+money2(S.amount)+'</b></div>'):'')
      +'<div style="display:flex;gap:8px;border-top:1px solid var(--line);margin-top:6px;'
      +'padding-top:6px"><span class="s" style="flex:1">Начислено по окладу</span>'
      +'<b>'+money2(S.accrued)+'</b></div>'
      +(S.no_salary?('<div class="s" style="color:var(--amb);margin-top:6px">'
        +'На часть смен оклад не задан — эти часы в деньги не превратились. '
        +'Скажите директору.</div>'):'')
      +'</div>';
  }

  // Объём — по объектам, внутри объекта построчно
  var objs=M.objects||[];
  h+='<div class="sec">Объём</div>';
  if(!objs.length){
    h+='<div class="sub" style="padding:0 0 4px">За период отмеченного объёма нет.</div>';
  }else{
    if(!pays)h+='<div class="s" style="margin:-4px 0 8px;color:var(--amb)">'
      +'Вы на окладе: отмеченный объём — учёт выполнения, в оплату он не идёт.</div>';
    h+=objs.map(function(o){
      var sum=(o.marked||0)+(o.approved||0);
      return '<div class="speccard" style="display:block;margin:0 0 8px">'
        +'<div style="display:flex;gap:8px;align-items:baseline">'
        +'<b style="flex:1;min-width:0">'+esc(o.name)+'</b>'
        +'<span style="font-weight:700;white-space:nowrap">'+money2(sum)+'</span></div>'
        +(o.lines||[]).map(function(l){
          var r='<div style="border-top:1px solid var(--line);margin-top:8px;padding-top:6px">'
            +'<div style="white-space:normal">'+esc(l.name)+'</div>';
          if(l.qty_approved)r+=mnState('approved',l.qty_approved,l.unit,l.rate,l.coef,l.amount_approved);
          if(l.qty_marked)r+=mnState('marked',l.qty_marked,l.unit,l.rate,l.coef,l.amount_marked);
          if(l.no_rate)r+='<div class="s" style="color:var(--amb)">'+l.no_rate
            +' отм. без ставки: позиции нет в смете, деньги по ней не считаются.</div>';
          return r+'</div>';}).join('')
        +'</div>';}).join('');
  }

  // Возвращено куратором (#171): отметка отменена, в деньги не идёт,
  // а причина — единственное, что объясняет, почему её нет в объёме.
  if((M.returned||[]).length){
    h+='<div class="sec">Возвращено куратором</div>'
      +'<div class="s" style="margin:-4px 0 8px">Исправьте и отметьте объём заново — '
      +'возвращённая отметка в деньги не идёт.</div>'
      +M.returned.map(function(r){
        return '<div class="speccard" style="display:block;margin:0 0 8px">'
          +'<div style="display:flex;gap:8px;align-items:baseline">'
          +'<b style="flex:1;min-width:0">'+esc(r.object)+'</b>'
          +'<span class="s" style="white-space:nowrap">'+qnum(r.qty)+' '+esc(r.unit||'')+'</span></div>'
          +'<div class="s">'+esc(r.row_name)+'</div>'
          +'<div style="margin-top:4px;white-space:normal">'+esc(r.reason)+'</div>'
          +'<div class="s" style="margin-top:4px">'+esc(r.by_name||'куратор')
          +(r.returned_at?(' · '+esc(phWhen(r.returned_at))):'')+'</div>'
          +'</div>';}).join('');
  }

  // Премии и штрафы
  if((M.adjust||[]).length){
    h+='<div class="sec">Премии и штрафы</div><div class="speccard" style="display:block">'
      +M.adjust.map(function(a){
        var plus=(a.kind==='bonus');
        return '<div style="display:flex;gap:8px;align-items:baseline;padding:3px 0">'
          +'<span class="s" style="flex:1;min-width:0;white-space:normal">'+esc(a.date)
          +(a.reason?(' · '+esc(a.reason)):'')+'</span>'
          +'<span style="font-weight:600;white-space:nowrap;color:'
          +(plus?'var(--grn)':'var(--red)')+'">'+(plus?'+':'−')
          +money2(a.amount)+'</span></div>';}).join('')
      +'</div>';
  }

  h+='<p class="hint" style="margin-top:12px">Показано начисленное. '
    +'Факт выплаты система не ведёт и не показывает.</p>';
  return h+'</div>';
}

// ── Оклады (директор) ──
function viewSalary(){
  if(SH.salary===null)return '<div class="sub" style="padding:12px">Загрузка…</div>';
  var people=SH.staff||[];
  // Локальная дата, не UTC: до трёх часов ночи по Москве toISOString()
  // отдаёт вчерашнее число.
  var d=new Date();
  var today=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  var firstDay=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-01';

  var salOf={}, bonusOf={}, fineOf={};
  (SH.salary||[]).forEach(function(x){
    if(!salOf[x.user_id]||x.period_from>salOf[x.user_id].period_from)salOf[x.user_id]=x;});
  (SH.adjust||[]).forEach(function(a){
    var m=a.kind==='bonus'?bonusOf:fineOf; m[a.user_id]=(m[a.user_id]||0)+a.amount;});

  var qq=(SH.empQ||'').toLowerCase();
  var list=people.filter(function(p){return !qq||(p.full_name||'').toLowerCase().indexOf(qq)>=0;});

  var h='<div class="bar" style="padding:8px 12px">'
   +'<input class="f" id="empSearch" placeholder="Поиск сотрудника" value="'+esc(SH.empQ||'')+'" style="flex:1;text-align:left;height:36px">'
   +'</div>'
   +'<div class="bar" style="padding:0 12px 8px;gap:6px">'
   +'<button class="btn sm primary">В штате</button>'
   +'<button class="btn sm" disabled title="появится позже" style="opacity:.45">Фриланс</button>'
   +'<button class="btn sm" disabled title="появится позже" style="opacity:.45">Уволенные</button>'
   +'<span class="s" style="margin-left:auto;align-self:center">'+list.length+' чел.</span></div>';

  if(!list.length)return h+'<div class="sub" style="padding:12px">Никого не найдено.</div>';

  h+=list.map(function(p){
    var tid=p.user_id, sal=salOf[tid], b=bonusOf[tid]||0, f=fineOf[tid]||0;
    var open=String(SH.empOpen)===String(tid);
    var right=sal?money(sal.amount):'<span class="s">оклад не задан</span>';
    var marks=(b?'<span style="color:var(--grn)">+'+money(b)+'</span>':'')+(b&&f?' ':'')
             +(f?'<span style="color:var(--red)">&minus;'+money(f)+'</span>':'');
    var row='<div class="emprow'+(open?' open':'')+'" data-act="sh-emp" data-tid="'+tid+'">'
      +'<div class="empn">'+esc(p.full_name)+'<div class="s">'+esc(roleRu(p.role))
      +(p.employer?(' · '+esc(p.employer)):'')+'</div></div>'
      +'<div class="empv">'+right+(marks?'<div class="s">'+marks+'</div>':'')+'</div>'
      +'<div class="empc"><svg class="i chv"><use href="#i-down"/></svg></div></div>';
    if(!open)return row;
    return row+'<div class="empbox">'
      // Работодателя закрепляем в профиле: смена берёт его молча, а перевод
      // в другое юрлицо — осознанное действие директора, не выбор монтажника.
      +(entList().length?('<div class="s" style="margin-bottom:5px">Работодатель — юрлицо, от которого платим</div>'
        +'<div class="bar" style="margin:0 0 10px">'
        +  entSelect('emp_ent',p.employer_entity_id,'Не выбрано',true)
        +  '<button class="btn sm" data-act="sh-emplset" data-tid="'+tid+'">Закрепить</button></div>'):'')
      +'<div class="s" style="margin-bottom:5px">Как платим'
      +(p.employer?(' · '+esc(p.employer)):'')+'</div>'
      // Способ оплаты (3.6) живёт в самой записи оклада, поэтому перевод с
      // даты не переписывает уже закрытые месяцы.
      +'<div class="bar" style="margin:0 0 6px">'
      +  '<select class="f" id="sal_kind" style="flex:1;height:36px">'
      +    '<option value="salary"'+((sal&&sal.pay_kind==='piece')?'':' selected')+'>Ставка — оклад по часам</option>'
      +    '<option value="piece"'+((sal&&sal.pay_kind==='piece')?' selected':'')+'>Сдельно — по объёму монтажа</option>'
      +  '</select></div>'
      +'<div class="s" style="margin:0 0 6px;opacity:.75">'
      +  ((sal&&sal.pay_kind==='piece')
        ? 'Сдельно: начисление идёт по отмеченному объёму, оклад не применяется. Часы идут только в табель.'
        : 'Ставка: оклад делится на норму часов месяца и умножается на отработанные.')
      +'</div>'
      +'<div class="bar" style="margin:0 0 10px">'
      +  '<input class="f" id="sal_amt" inputmode="numeric" placeholder="\u20BD \u0432 \u043C\u0435\u0441\u044F\u0446" value="'+esc((sal&&sal.pay_kind!=='piece')?sal.amount:'')+'"'
      +    ((sal&&sal.pay_kind==='piece')?' disabled':'')+' style="flex:1;text-align:left;height:36px">'
      +  '<input class="f" id="sal_from" type="date" value="'+esc(sal?sal.period_from:firstDay)+'" style="flex:1;height:36px">'
      +  '<button class="btn sm primary" data-act="sh-salset" data-tid="'+tid+'">Сохранить</button></div>'
      +'<div class="s" style="margin-bottom:5px">Премия или штраф</div>'
      +'<div class="bar" style="margin:0 0 6px">'
      +  '<select class="f" id="adj_kind" style="width:auto;height:36px"><option value="bonus">Премия</option><option value="fine">Штраф</option></select>'
      +  '<input class="f" id="adj_amt" inputmode="numeric" placeholder="\u20BD" style="flex:1;text-align:left;height:36px">'
      +  '<input class="f" id="adj_date" type="date" value="'+today+'" style="flex:1;height:36px">'
      +'</div>'
      +'<div class="bar" style="margin:0">'
      +  '<input class="f" id="adj_why" placeholder="Основание" style="flex:1;text-align:left;height:36px">'
      +  '<button class="btn sm primary" data-act="sh-adjset" data-tid="'+tid+'">Начислить</button></div>'
      + empHistory(tid)
      +'</div>';
  }).join('');
  return h;
}

// история начислений сотрудника — внутри его же строки
function empHistory(tid){
  var items=(SH.adjust||[]).filter(function(a){return String(a.user_id)===String(tid);});
  if(!items.length)return '';
  return '<div style="margin-top:10px;border-top:1px solid var(--line,var(--line));padding-top:6px">'
    +items.map(function(a){
      var plus=a.kind==='bonus';
      return '<div style="display:flex;gap:8px;align-items:center;padding:3px 0">'
        +'<span class="s" style="flex:1;min-width:0">'+esc(a.date)+(a.reason?(' \u00B7 '+esc(a.reason)):'')+'</span>'
        +'<span style="font-weight:600;color:'+(plus?'var(--grn)':'var(--red)')+'">'+(plus?'+':'\u2212')+money(a.amount)+'</span>'
        +'<button class="btn sm io danger" data-act="sh-adjdel" data-id="'+a.id+'" title="Удалить начисление">'
        +  '<svg class="i"><use href="#i-trash"/></svg></button>'
        +'</div>';}).join('')
    +'</div>';
}


// ── Объекты директора: статус «в работе» и юрлицо договора ──
// Юрлицо договора — это то, от кого заключён договор на объект. От него
// считается себестоимость и рентабельность, и оно же попадает снимком
// в каждую смену на этом объекте.
function viewObjects(){
  if(SH.objs===null)return '<div class="sub" style="padding:12px">Загрузка объектов…</div>';
  var qq=(SH.objQ||'').toLowerCase();
  var mine=myUid();
  var list=(SH.objs||[]).filter(function(o){
    if(SH.objMine&&String(o.curator_id)!==String(mine))return false;
    return !qq||(o.name||'').toLowerCase().indexOf(qq)>=0;
  });
  var h='<div class="bar" style="padding:8px 12px">'
   +'<input class="f" id="objSearch" placeholder="Поиск объекта" value="'+esc(SH.objQ||'')+'" '
   +'style="flex:1;text-align:left;height:36px">'
   // Куратор видит объекты, за которые отвечает (#59): фильтр по своему id
   // среди тех же данных, без отдельной ручки.
   +(mine?('<button class="btn sm'+(SH.objMine?' on':'')+'" data-act="sh-objmine" '
     +'style="height:36px;white-space:nowrap">Я куратор</button>'):'')
   +'<span class="s" style="margin-left:8px;align-self:center">'+list.length+'</span></div>';
  if(!list.length)return h+'<div class="sub" style="padding:12px">Объектов нет. '
    +'Объект создаётся в разделе «Спецификации».</div>';
  h+=list.map(function(o){
    var open=String(SH.objOpen)===String(o.uid);
    var right=o.curator_name?esc(o.curator_name):'<span class="s">куратор не назначен</span>';
    var row='<div class="emprow'+(open?' open':'')+'" data-act="sh-obj" data-uid="'+esc(o.uid)+'">'
      +'<div class="empn">'+esc(o.name)
      +'<div class="s">'+(o.in_production?'в работе':'не в работе')+'</div></div>'
      +'<div class="empv">'+right+'</div>'
      +'<div class="empc"><svg class="i chv"><use href="#i-down"/></svg></div></div>';
    if(!open)return row;
    var execList=(o.executors||[]).length
      ? o.executors.map(function(x){
          return '<div class="bar" style="margin:0 0 6px">'
            +'<span class="s" style="flex:1">'+esc(x.name)+'</span>'
            +'<button class="btn sm io danger" data-act="sh-objexecdel" data-uid="'+esc(o.uid)+'" '
            +   'data-tid="'+x.id+'" title="Снять исполнителя">'
            +   '<svg class="i"><use href="#i-x"/></svg></button></div>';
        }).join('')
      : '<div class="s" style="margin-bottom:6px">Не назначен</div>';
    return row+'<div class="empbox">'
      // Куратор отвечает за объект и подтверждает выполнение (#59). Тот же
      // человек, что и приёмщик — второго поля под приёмку не заводим.
      +'<div class="s" style="margin-bottom:5px">Куратор объекта</div>'
      +'<div class="bar" style="margin:0 0 6px">'
      +  staffSelect('obj_cur',o.curator_id,'Не выбран')
      +  '<button class="btn sm primary" data-act="sh-objcur" data-uid="'+esc(o.uid)+'">Сохранить</button>'
      +'</div>'
      +'<label class="bar" style="margin:0 0 14px;gap:8px;cursor:pointer">'
      +  '<input type="checkbox" id="obj_self"'+(o.self_confirm?' checked':'')+'>'
      +  '<span class="s">Самоподтверждение — куратор сам подтверждает свою же работу '
      +  '(для мелких объектов, где он и есть исполнитель)</span>'
      +'</label>'
      +'<div class="s" style="margin-bottom:5px">Исполнитель — с кем идёт расчёт</div>'
      + execList
      +'<div class="bar" style="margin:0 0 14px">'
      +  staffSelect('obj_exec','','Добавить исполнителя')
      +  '<button class="btn sm primary" data-act="sh-objexecadd" data-uid="'+esc(o.uid)+'">Добавить</button>'
      +'</div>'
      // Юрлицо договора и статус «в работе» — object:meta, деньги объекта.
      // Менеджеру (object:assign/object:curator, но не object:meta) эта часть
      // карточки не показывается — сохранение всё равно получило бы 403.
      +(can('object:meta')?(
        '<div class="s" style="margin-bottom:5px">Юрлицо договора</div>'
        +'<div class="bar" style="margin:0 0 10px">'
        +  entSelect('obj_ent',o.contract_entity_id,'Не выбрано',true)
        +  '<button class="btn sm primary" data-act="sh-objent" data-uid="'+esc(o.uid)+'">Сохранить</button>'
        +'</div>'
        + splitHTML(o)
        +'<div class="bar" style="margin:0">'
        +  '<button class="btn sm'+(o.in_production?' primary':'')+'" data-act="sh-objprod" '
        +     'data-uid="'+esc(o.uid)+'" data-v="'+(o.in_production?'0':'1')+'">'
        +     (o.in_production?'Снять «в работе»':'Отметить «в работе»')+'</button></div>'
      ):'')
      // Приёмка выполнения — только тому, чей user_id стоит куратором
      // именно этого объекта (#58): картинка «куратор = приёмщик» и на сервере.
      +(String(o.curator_id)===String(mine)?pendingBlock(o.uid):'')
      // Отмена принятой отметки — это отзыв уже начисленных денег, поэтому
      // object:meta, а не кураторство (#215): куратор принимает и возвращает,
      // отменяет принятое тот, кто отвечает за деньги объекта.
      +(can('object:meta')?approvedBlock(o.uid):'')
      // Доступ партнёра-заказчика на просмотр своих разделов (#63, kp-14).
      // Здесь же, где куратор и исполнители: всё про объект — в одном месте.
      +((can('partner:manage')&&window.PARTNER)?PARTNER.grantBlock(o.uid):'')
      +'</div>';
  }).join('');
  return h;
}

// ── Приёмка выполнения куратором (#58) ──
function pendingBlock(uid){
  var list=SH.pending&&SH.pending[uid];
  var h='<div class="s" style="margin:14px 0 5px">К подтверждению</div>';
  if(list===undefined||list===null)
    return h+'<div class="sub" style="padding:4px 0">Загрузка отметок…</div>';
  if(list===false)
    return h+'<div class="sub" style="padding:4px 0">Не удалось загрузить отметки.</div>';
  if(!list.length)
    return h+'<div class="sub" style="padding:4px 0">Ждущих подтверждения нет.</div>';
  return h+list.map(function(f){
    return '<div class="speccard" style="display:block;margin:0 0 8px">'
      +'<div style="display:flex;gap:8px;align-items:baseline">'
      +'<b style="flex:1;min-width:0">'+esc(f.row_name)+'</b>'
      +'<span class="s" style="white-space:nowrap">'+qnum(f.qty)+'</span></div>'
      +'<div class="s">'+esc(f.executor_name)+(f.self_marked?' · самоотметка':'')
      +(f.installed_at?(' · '+esc(phWhen(f.installed_at))):'')+'</div>'
      +(f.note?('<div class="s" style="margin-top:4px">'+esc(f.note)+'</div>'):'')
      +((f.files&&f.files.length)?('<div class="pd pd0" style="margin-top:6px">'
        +phThumbs(f.files)+'</div>'):'')
      +'<div class="bar" style="margin-top:8px">'
      +  '<button class="btn sm primary" data-act="sh-objapprove" data-uid="'+esc(uid)
      +     '" data-fid="'+f.id+'">Подтвердить</button>'
      // Возврат с причиной (#171): неверную отметку не принимают и не
      // просят исправить по телефону — исполнитель видит причину сам.
      +  '<button class="btn sm" data-act="sh-objreturn" data-uid="'+esc(uid)
      +     '" data-fid="'+f.id+'">Вернуть</button>'
      +'</div>'
      // Отказ — под той отметкой, к которой относится (#259): в шапке раздела
      // его не видно, карточка объекта далеко внизу, и «нажал — ничего не
      // изменилось» заканчивалось повторными нажатиями.
      +((SH.pendNote&&SH.pendNote[f.id])
        ?('<div class="fnote warn" data-note="'+f.id+'">'+esc(SH.pendNote[f.id])+'</div>'):'')
      +'</div>';
  }).join('');
}
async function loadPending(uid){
  SH.pending=SH.pending||{}; SH.pending[uid]=null; SH.pendNote={}; renderShift();
  try{SH.pending[uid]=await sapi('/objects/'+encodeURIComponent(uid)+'/pending');}
  catch(e){SH.pending[uid]=false; SH.err=e.message;}
  renderShift();
}

// ── Отмена принятой отметки (#215) ──
function approvedBlock(uid){
  var st=SH.approved&&SH.approved[uid];
  var h='<div class="s" style="margin:14px 0 5px">Принятые отметки</div>';
  if(st===undefined||st===null)
    return h+'<div class="sub" style="padding:4px 0">Загрузка отметок…</div>';
  if(st===false)
    return h+'<div class="sub" style="padding:4px 0">Не удалось загрузить отметки.</div>';
  var list=st.items||[];
  if(!list.length)
    return h+'<div class="sub" style="padding:4px 0">Принятых отметок нет.</div>';
  return h+(st.more?'<div class="s" style="margin-bottom:6px">Показаны последние 50.</div>':'')
   +list.map(function(f){
    return '<div class="speccard" style="display:block;margin:0 0 8px">'
      +'<div style="display:flex;gap:8px;align-items:baseline">'
      +'<b style="flex:1;min-width:0">'+esc(f.row_name)+'</b>'
      +'<span class="s" style="white-space:nowrap">'+qnum(f.qty)+' '+esc(f.unit||'шт')+'</span></div>'
      +'<div class="s">'+esc(f.executor_name)
      +(f.amount!=null?(' · '+money2(f.amount)):'')
      +(f.approved_at?(' · принято '+esc(phWhen(f.approved_at))):'')+'</div>'
      +'<div class="bar" style="margin-top:8px">'
      +  '<button class="btn sm danger" data-act="sh-objcancel" data-uid="'+esc(uid)
      +     '" data-fid="'+f.id+'">Отменить отметку</button>'
      +'</div>'
      // Отказ — под той отметкой, к которой относится, как в приёмке (#259).
      +((SH.apprNote&&SH.apprNote[f.id])
        ?('<div class="fnote warn" data-note="'+f.id+'">'+esc(SH.apprNote[f.id])+'</div>'):'')
      +'</div>';
  }).join('');
}
async function loadApproved(uid){
  SH.approved=SH.approved||{}; SH.approved[uid]=null; SH.apprNote={}; renderShift();
  try{SH.approved[uid]=await sapi('/objects/'+encodeURIComponent(uid)+'/approved');}
  catch(e){SH.approved[uid]=false; SH.err=e.message;}
  renderShift();
}


// Мост для второй половины файла (kp-03b.js, «Облако/Отчёты/Смена») —
// общий IIFE разрезан на два <script>. Часть функций выше вызывает
// renderShift() из второй половины — он объявлен там позже, поэтому
// не переменная, а функция-обёртка: тело ещё не существует в момент
// объявления вызывающих функций, но существует к моменту их вызова.
function renderShift(){return window.__kp03b.renderShift();}
window.__kp03a={SH:SH,boss:boss,geo:geo,hhmm:hhmm,hrs:hrs,loadLines:loadLines,
  loadApproved:loadApproved,loadPending:loadPending,money2:money2,myUid:myUid,
  objOnly:objOnly,phFree:phFree,phLoad:phLoad,qnum:qnum,sapi:sapi,since:since,
  dlTabel:dlTabel,
  viewMoney:viewMoney,viewObjects:viewObjects,viewReport:viewReport,
  viewSalary:viewSalary,viewShift:viewShift};
})();
