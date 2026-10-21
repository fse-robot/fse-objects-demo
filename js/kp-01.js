const SK='fse_kp_specs', CK='fse_kp_cloud';
// ── конфиг сервера ──
// Единственный ключ — сессия, общего токена больше нет.
// См. ADR-0006 (docs/adr/0006-session-auth.md).
const CFG={API:'/api'};
// Ключ имени в localStorage — ОДИН на весь проект. Раньше их было три
// (fse_fio, fse_user_name, fse_user): страница входа писала в один, эта
// читала другой, и в поле «автор правки» всегда уезжала пустая строка.
const UK='fse_user_name';
// Читаем функцией, а не один раз при загрузке: /auth/me отвечает позже, чем
// разбирается этот блок, и снятое на старте значение навсегда осталось бы пустым.
function userName(){try{return localStorage.getItem(UK)||''}catch(e){return ''}}
let LIVE=false;
function sessId(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}}
// ── учёт монтажа (ledger): свой API, та же сессия ──
const LAPI='/montazh/api';
async function ledger(path,opts={}){
  // X-FSE-Session обязателен: сервис монтажа определяет по нему компанию.
  opts.headers=Object.assign({'X-FSE-Session':sessId()},opts.headers||{});
  let r;
  try{r=await fetch(LAPI+path,opts);}catch(e){LIVE=false;const err=new Error('Нет связи с сервером');err.offline=true;throw err;}
  if(r.status===401&&!PUB){authExpired();}
  if(!r.ok){const e=new Error((await r.json().catch(()=>({}))).detail||('HTTP '+r.status));e.status=r.status;throw e;}
  return r.json();
}
// Режим публичной ссылки (п.4) — открыть спецификацию без входа.
// Адрес читается: /kp/spec-2026-014?t=<секрет> (#283). Прежняя форма
// ?pub=<секрет> открывается по-прежнему — ссылки живут 90 дней, и те,
// что уже у заказчиков, обязаны работать.
const PUB_NUM=(location.pathname.match(/\/kp\/([\w.-]+)/)||[])[1]||'';
const PUB=new URLSearchParams(location.search).get('t')
        ||new URLSearchParams(location.search).get('pub');
// Номер уезжает на сервер вместе с секретом: без сверки ссылка «свой
// номер плюс чужой секрет» открыла бы чужую смету под видом названной.
const pubPath=()=>'/pub/'+encodeURIComponent(PUB||'')
  +(PUB_NUM?'?n='+encodeURIComponent(PUB_NUM):'');
// Право на правку по ссылке решает СЕРВЕР (can_edit в ответе /pub/{token}).
// Аноним теперь получает только чтение; правит лишь вошедший сотрудник компании-владельца.
let PUB_EDIT=false;
let pubSeen=null;  // последний updated_at — чтобы подхватывать чужие правки
let pubFail=false; // последнее сохранение по ссылке не прошло
// Сессия кончилась — это не «офлайн», а «вас разлогинили». Продолжать работу
// нельзя: человек будет править смету, а на сервер ничего не уйдёт.
function authExpired(){
  // Чистим свои ключи, а не всё хранилище: localStorage.clear() уносил
  // тему, шрифт и служебные отметки вроде fse_noplans_seen_*, которые
  // к сессии отношения не имеют, — человек возвращался в чужое оформление.
  try{
    ['fse_session','fse_me','fse_scopes','fse_kp_specs'].forEach(function(k){
      localStorage.removeItem(k);});
    sessionStorage.clear();
    // После входа заново человек вернётся туда, где его застал конец сессии.
    sessionStorage.setItem('fse_return',location.hash.slice(1));
  }catch(e){}
  location.href='index.html';
}
// Выход по кнопке. Отличается от authExpired двумя вещами: сессию гасит
// сервер, а не только браузер, и уходим на экран входа, а не на посадочную —
// человек либо уступает компьютер, либо входит другим.
async function logout(){
  try{
    await fetch(CFG.API+'/auth/logout',{method:'POST',
      headers:{'X-FSE-Session':sessId()}});
  }catch(e){/* сети нет — токен погаснет по сроку, уводить всё равно надо */}
  try{
    // Чистим то, что относится к человеку. Тема и шрифт остаются: они
    // принадлежат компьютеру, а не учётной записи.
    ['fse_session','fse_me','fse_scopes','fse_kp_specs','fse_role','fse_role_name',
     'fse_uid','fse_company',UK].forEach(function(k){localStorage.removeItem(k);});
    sessionStorage.clear();
  }catch(e){}
  location.href='app.html';
}
// Метка в меню — единственный намёк, что почту стоит привязать: ни баннера
// на весь экран, ни напоминания при каждом входе.
async function identityBadge(){
  try{
    const d=await api('/auth/me');
    const w=$('#mailWarn');if(w)w.style.display=d&&d.email?'none':'';
  }catch(e){/* метка — подсказка, а не право доступа */}
}

function identityRow(name,value,ok,okText,badText){
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;'
    +'padding:10px 0;border-bottom:1px solid var(--line)"><b>'+esc(name)+'</b>'
    +'<span style="display:flex;align-items:center;gap:8px;color:var(--mut)">'
    +(value?esc(value):'')+'<span class="ch '+(ok?'ok':'warn')+'">'
    +esc(ok?okText:badText)+'</span></span></div>';
}

async function identityOpen(edit){
  let me={};try{me=await api('/auth/me');}catch(e){toast('Сервер недоступен');return;}
  const has=!!me.email;
  const head=identityRow('Telegram',me.username?'@'+me.username:'',!!me.username,'привязан','нет')
    +identityRow('Почта',me.email||'',has,'привязана','не привязана');

  /* Привязано и менять не просили — экран отдыхает: ни открытого поля,
     ни красной кнопки. Иначе законченное дело выглядит незаконченным. */
  if(has&&!edit){
    const M=UI.modal({narrow:true,title:'Вход в систему',
      sub:'Входить можно любым из двух способов',
      body:head+'<p class="note" style="margin:12px 0 12px">Входить можно любым из двух '
        +'способов — это одна учётная запись.</p>'
        +'<button class="btn" data-id="edit" style="width:auto">Сменить адрес</button>'
        +'<p class="note" style="margin:12px 0 0;color:var(--mut);font-size:12px">'
        +'Кнопки «отвязать» нет: остаться без второго способа входа необратимо, '
        +'а восстановления в системе не предусмотрено.</p>',
      ok:null,cancel:'Закрыть'});
    const b=M.el.querySelector('[data-id="edit"]');
    if(b)b.addEventListener('click',function(){M.close();identityOpen(true);});
    return;
  }

  const body=head
    +(has?'<div class="errbox" style="margin:12px 0 10px">Новый адрес заменит <b>'
        +esc(me.email)+'</b> после подтверждения кодом. До подтверждения работает прежний.</div>'
      :'<p class="note" style="margin:12px 0 10px">Привяжите адрес — и входить можно будет '
        +'любым из двух способов, в ту же учётную запись. Пригодится там, где Telegram '
        +'не открывается.</p>')
    +'<input class="f" id="idMail" type="email" placeholder="ivanov@gasbase.ru" value="">'
    +'<div class="hint" id="idHint" style="font-size:12px;color:var(--mut);margin-top:8px">'
    +'Пришлём код на этот адрес — шесть цифр, 10 минут.</div>'
    +'<div id="idCode" style="display:none;margin-top:10px">'
    +'<input class="f" id="idCodeF" inputmode="numeric" maxlength="6" placeholder="——————"'
    +' style="text-align:center;letter-spacing:.25em;font-weight:700"></div>';
  let M;
  M=UI.modal({narrow:true,title:has?'Новый адрес почты':'Вход в систему',
    sub:has?'Прежний работает, пока новый не подтверждён':'Способы входа в эту учётную запись',
    body:body,ok:'Отправить код',okIcon:'i-key',
    onOk:async function(w){
      const cf=w.querySelector('#idCode');
      const em=(w.querySelector('#idMail').value||'').trim();
      if(cf.style.display==='none'){
        if(!em){M.error('Введите адрес почты');return false;}
        try{
          await api('/auth/email/link',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({email:em})});
        }catch(e){M.error(String(e&&e.message||'Не удалось отправить код'));return false;}
        cf.style.display='';
        w.querySelector('#idHint').textContent='Код отправлен на '+em+'. Введите его здесь.';
        w.querySelector('.mfoot .btn.primary .lbl').textContent='Подтвердить';
        return false;
      }
      const code=(w.querySelector('#idCodeF').value||'').replace(/\D/g,'');
      if(code.length<6){M.error('Код — шесть цифр');return false;}
      try{
        await api('/auth/email/link/confirm',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email:em,code:code})});
      }catch(e){M.error(String(e&&e.message||'Код не подошёл'));return false;}
      toast('Почта привязана: '+em);identityBadge();
    }});
}


document.addEventListener('click',function(e){
  if(e.target.closest('[data-act="identity"]')){identityOpen();return;}
  if(!e.target.closest('[data-act="logout"]'))return;
  if(window.UI&&UI.confirm)UI.confirm({title:'Выйти из учётной записи?',
    text:'Эта вкладка перестанет быть входом в систему. На других устройствах вы останетесь в системе.',
    ok:'Выйти',okIcon:'i-out'}).then(function(y){if(y)logout();});
  else if(confirm('Выйти из учётной записи?'))logout();
});
async function api(path,opts={}){
  opts.headers=Object.assign({'X-FSE-Session':sessId()},opts.headers||{});
  let r;
  // TypeError от fetch — единственный настоящий «нет сети». HTTP-ошибка значит,
  // что сервер жив и ответил, и уводить приложение в офлайн-демо по ней нельзя.
  try{r=await fetch(CFG.API+path,opts);}
  catch(e){LIVE=false;const err=new Error('Нет связи с сервером');err.offline=true;throw err;}
  if(r.status===401&&!PUB){authExpired();}
  // Код ответа несём в ошибке: без него «сессия истекла» и «нет интернета»
  // выглядят одинаково, и человек продолжает работать вхолостую
  if(!r.ok){const e=new Error('HTTP '+r.status); e.status=r.status;
    try{const d=await r.json();if(d&&d.detail)e.message=String(d.detail);}catch(_){}
    throw e;}
  if(!PUB)LIVE=true;   // сервер ответил — возвращаемся в онлайн сами, без перезагрузки
  return r.status===204?null:r.json();
}
// Причина, по которой мы не в онлайне. Пусто — значит просто нет связи.
let SRC_WARN='';
function srcWarn(e){
  const s=e&&e.status;
  // 403 — это НЕ офлайн: сервер на связи и явно отказал. Показываем причину
  // и остаёмся в онлайне, иначе человек уходит в демо-режим по недоразумению.
  SRC_WARN = (e&&e.offline) ? ''
           : s===401 ? 'сессия истекла — войдите заново'
           : s===403 ? 'нет доступа к этим данным'
           : s>=500  ? 'ошибка сервера — изменения не сохранены'
           : (e&&e.message)||'';
  setSource();
  if(SRC_WARN&&typeof toast==='function')toast('Сервер отказал: '+SRC_WARN,5000);
}
function setSource(){const live=LIVE;const dot=document.getElementById('srcdot'),txt=document.getElementById('srctext');
  if(!dot||!txt)return;
  dot.classList.toggle('live',live&&!pubFail); dot.classList.toggle('warn',pubFail||(!live&&!!SRC_WARN));
  txt.textContent = pubFail ? 'не сохранено — правки только у вас'
    : (live ? 'каталог онлайн' : (SRC_WARN || 'демо (офлайн)'));
  txt.style.color = (pubFail||(!live&&SRC_WARN)) ? 'var(--red)' : '';}

/* цена = в наличии И минимальная; если нет в наличии — -1 (цену вписать вручную) */
// авто-выбор: сначала самый дешёвый В НАЛИЧИИ; если в наличии нет — самый дешёвый
// из доступных (под заказ), чтобы цена подставлялась сразу, без ручного «выбрать».
function bestOffer(offers){let bi=-1,bp=Infinity;(offers||[]).forEach((o,i)=>{if(o.stock&&o.price>0&&o.price<bp){bp=o.price;bi=i}});
  if(bi<0){bp=Infinity;(offers||[]).forEach((o,i)=>{if(o.price>0&&o.price<bp){bp=o.price;bi=i}});}
  return bi;}
// Наличие в три состояния: null — магазин остатка не сообщает (ЛУИС).
// Молчание — не «под заказ»: так сметчику говорили, что товара нет.
function stockOf(o){
  if(o&&o.stock===true)return {cls:'in',lbl:'в наличии'};
  if(o&&o.stock===false)return {cls:'out',lbl:'под заказ'};
  return {cls:'na',lbl:'уточнить'};}
function rid(){return Math.random().toString(36).slice(2,9)}
// Ключ операции для сервера. Обе ручки отметки объёма отбрасывают повтор с тем
// же ключом и возвращают прежний результат — так двойной тап на телефоне при
// плохой связи перестаёт удваивать объём и начисление. Ключ обязан жить до
// успеха: новый ключ на каждую попытку означал бы вторую запись.
// crypto.randomUUID есть не во всех рабочих телефонах, отсюда запасной вариант.
function opKey(){try{if(self.crypto&&crypto.randomUUID)return crypto.randomUUID();}catch(e){}
  return Date.now()+'-'+Math.random().toString(36).slice(2);}
function mkRow(c){const ch=bestOffer(c.offers);return {id:rid(),pid:c.pid||null,code:c.code||'',name:c.name,unit:c.unit||'шт',qty:1,montazh:0,zakup:c.zakup||0,zakupMon:0,kupleno:0,work:false,offers:JSON.parse(JSON.stringify(c.offers||[])),chosen:ch,retail:ch>=0?c.offers[ch].price:0,url:ch>=0?c.offers[ch].url:'',found:true,nameEdited:false}}
const $=s=>document.querySelector(s);
// Единственный экранировщик на весь файл. Раньше их было четыре, все разные и
// все дырявые: этот падал на числах (у Number нет .replace) и не закрывал ' и >,
// а строка спеки приходит с сервера и правится по публичной ссылке кем угодно.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Две цифры после запятой всегда: без них столбец «пляшет» — у одной суммы
// копейки есть, у соседней их съело округление, — и КП уезжает клиенту
// с ценой «1 072 209,2». Правило — design-language.md, § как показывается
// каждый тип данных.
const money=n=>(Math.round((+n||0)*100)/100)
  .toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
function fmtDate(iso){try{return new Date(iso).toLocaleDateString('ru-RU')}catch(e){return ''}}
function toast(m,ms){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._);t._=setTimeout(()=>t.classList.remove('on'),ms||1900)}
let lastSearchMs=0;
function setSpeed(txt){const el=$('#speednote');if(el)el.textContent=txt||'';}
function busy(on,txt){const l=$('#load');if(txt)$('#loadtxt').textContent=txt;l.classList.toggle('on',!!on);}
// ── роли и себестоимость ──
const VAT_DEFAULT=22;                    // ставка НДС по умолчанию, % — одна на весь файл

// ── Разрешения (scopes) ──
// ВАЖНО: это по-прежнему ТОЛЬКО интерфейс. Настоящая проверка прав живёт на
// сервере, и обойти её отсюда невозможно. Разрешения нужны ровно для одного —
// не показывать кнопки и данные, на которые сервер всё равно ответит 403.
// Храним в sessionStorage, а не в localStorage: набор прав не должен переживать
// закрытие вкладки, иначе на общем компьютере следующий увидит чужое меню.
let SCOPES=new Set();
const can=s=>SCOPES.has(s);
function setScopes(list){
  SCOPES=new Set(Array.isArray(list)?list:[]);
  try{sessionStorage.setItem('fse_scopes',JSON.stringify([...SCOPES]));}catch(e){}
}
try{const _s=JSON.parse(sessionStorage.getItem('fse_scopes')||'[]');if(Array.isArray(_s))SCOPES=new Set(_s);}catch(e){}

// ── Авторизация: сессия Telegram с сервера ──
// Промис держим: стартовый блок ниже обязан дождаться разрешений, иначе он
// выберет стартовый раздел и нарисует меню по пустому набору прав.
const AUTH_READY=(async function(){try{
 if(PUB)return; // публичные ссылки — без входа
 const sess=sessId();
 const r=await fetch('/api/auth/me',{headers:{'X-FSE-Session':sess}});
 if(r.status===401){authExpired(); return;}
 if(r.ok){const d=await r.json();
  // Разрешения приходят с сервера списком; роль оставляем только для подписи в шапке.
  setScopes(d&&d.scopes);
  if(d&&d.role){try{localStorage.setItem('fse_role',d.role);localStorage.setItem('fse_role_name',d.role_name||d.role);
   // Общего api_token больше нет. Старое значение чистим принудительно: оно могло
   // остаться с прошлой версии и годами лежать в браузере рабочего компьютера.
   localStorage.removeItem('fse_token');
   // Профиль нужен разделу «Смена»: идентификатор исполнителя раньше был
   // захардкожен, теперь берётся из /auth/me (myUid() в kp-03.js).
   if(d.user_id!=null)localStorage.setItem('fse_uid',String(d.user_id));
   if(d.company_id!=null)localStorage.setItem('fse_company',String(d.company_id));
   // Имя кладём в тот же ключ, из которого его потом читает userName().
   // Старые ключи чистим принудительно: они могли остаться от прошлых версий
   // и годами вводить в заблуждение при разборе «почему автор пустой».
   if(d.first_name||d.last_name)localStorage.setItem(UK,[d.first_name,d.last_name].filter(Boolean).join(' '));
   localStorage.removeItem('fse_fio');localStorage.removeItem('fse_user');
  }catch(e){}
   if(typeof initRole==='function')initRole();
   try{
    const on=document.getElementById('objname');
    if(on&&!document.getElementById('roleBadge'))on.insertAdjacentHTML('afterend','<span id="roleBadge" style="font-size:12px;color:var(--mut,var(--mut));margin-left:8px;white-space:nowrap"></span>');
    const rb=document.getElementById('roleBadge');if(rb)rb.textContent=d.role_name||'';
    // Переключатель ролей — инструмент администратора; у остальных его просто нет
    // в DOM, чтобы не подсказывать, что такая ручка вообще существует. Само меню
    // при этом остаётся у всех: с #329 в нём живут «Вход в систему» и «Выйти»,
    // а они нужны каждому — раньше вместе с переключателем исчезали и они.
    if(!can('users:manage')){
     document.querySelectorAll('#roleList .rolepick').forEach(n=>n.remove());
     const sd=document.querySelector('#roleList .sdiv');if(sd)sd.remove();
    }
    identityBadge();
    window.fseTrack=ev=>{try{fetch('/api/auth/track',{method:'POST',headers:{'Content-Type':'application/json','X-FSE-Session':localStorage.getItem('fse_session')||''},body:JSON.stringify({event:ev})}).catch(()=>{});}catch(e){}};
    fseTrack('app_open');
   }catch(e){}
}}
}catch(e){/* сервер недоступен — не блокируем работу */}})();

// Роль осталась только для подписи в шапке. Всё, что касается доступа, решает can().
function curRole(){try{return localStorage.getItem('fse_role')||'office'}catch(e){return 'office'}}

// ── облако поиска: локальное зеркало + общий сервер ──
function cloudStore(){return JSON.parse(localStorage.getItem(CK)||'{}')}
function learn(query,key){if(!query||!key)return;
  const c=cloudStore();const k=String(key).toLowerCase();c[k]=c[k]||[];const q=String(query).trim().toLowerCase();
  if(q.length>=2&&!c[k].includes(q)){c[k].push(q);localStorage.setItem(CK,JSON.stringify(c))}
  if(LIVE){api('/kp/learn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:query,key:key})}).catch(()=>{})}
}

// ── поиск: живой каталог сервера ──
const SHOP={tinko:'Тинко',etm:'ЭТМ',luis:'ЛУИС',layta:'Лайта',vseinstrumenti:'Всеинструменты.ру'};
// Перечни без розничной цены: позиция находится поиском, цену вписывают сами
const LISTED={kp:'из КП поставщиков',firepro:'каталог производителя'};
function normLive(p){return {pid:p.id,code:p.article||'',name:p.name,unit:p.unit||'шт',zakup:0,
  image:p.image||'',listed:(p.listed||[]).map(s=>LISTED[s]||s),
  offers:(p.offers||[]).map(o=>({shop:SHOP[o.shop]||o.shop,price:o.price,url:o.url||'',stock:o.stock==null?null:!!o.stock,
    updated:o.updated||'',stale:!!o.stale}))};}

// ── свежесть каталога ──
// «Готово» требует КП по актуальным ценам, а до этого возраст цены в системе
// нигде не показывался: сборщик мог молчать неделями, и выглядело это ровно
// так же, как ежедневный сбор. Спрашиваем один раз за открытие страницы —
// цены приезжают раз в сутки, чаще спрашивать нечего.
let CATALOG_SRC=null;      // null — ещё не спрашивали; [] — спросили и не вышло
let _catalogReq=null;
function loadCatalog(){
  if(PUB)return Promise.resolve([]);
  if(_catalogReq)return _catalogReq;
  _catalogReq=api('/catalog/sources').then(v=>CATALOG_SRC=Array.isArray(v)?v:[])
    .catch(()=>CATALOG_SRC=[]);
  return _catalogReq;
}
// Источники, по которым цены не приезжают. Пустой список значит либо
// «всё в порядке», либо «ещё не спрашивали» — это решает вызывающий по
// CATALOG_SRC===null.
function catalogTrouble(){return (CATALOG_SRC||[]).filter(s=>s&&s.state!=='ok');}

// ── что в позиции требует внимания ──
// Пометка на позиции означает «требует внимания», а не «взято не из каталога»:
// вписали цену — позиция разобрана, пометка снимается.
function priceOf(r){return +String(r.retail==null?'':r.retail).replace(',','.')||0;}
function needsPrice(r){return !r.work&&priceOf(r)<=0;}
// Отказ каталога и пустая выдача выглядят одинаково — оба возвращают пустой
// список. Подсказке они говорят разное: «такой позиции нет» против «спросить
// не вышло», и вписать руками при живой цене в базе — разные вещи.
let searchFailed=false;
// Подсказки при вводе — с третьей буквы. С двух сервер ищет только точный
// артикул и код магазина, и список почти всегда пуст: «ничего не нашлось»
// мелькало бы на каждом начале ввода. Enter и импорт ищут и с двух.
const SEARCH_MIN=3;
async function searchProducts(q){q=q.trim();if(q.length<2)return [];
  const t0=(self.performance||Date).now();let res=[];searchFailed=false;
  // Ошибка поиска — это ошибка на экране (srcWarn), а не повод подставить
  // выдуманные цены в живую смету.
  try{const ps=await api('/kp/search?q='+encodeURIComponent(q)+'&limit=20');res=ps.map(normLive);}
  catch(e){searchFailed=true;srcWarn(e);}
  lastSearchMs=Math.round((self.performance||Date).now()-t0);
  return res;
}

// ── второй вход в каталог: фильтр по производителю (#348) ──
// Поиск требует вспомнить позицию до того, как начал печатать. Фильтр
// показывает её сам. Список производителей спрашиваем один раз за открытие
// страницы: он меняется вместе с каталогом, то есть раз в сутки.
const BRAND_PAGE=50;
let CATALOG_BRANDS=null, _brandsReq=null;
function loadBrands(){
  if(PUB)return Promise.resolve([]);
  if(CATALOG_BRANDS)return Promise.resolve(CATALOG_BRANDS);
  if(_brandsReq)return _brandsReq;
  _brandsReq=api('/kp/brands')
    .then(b=>{CATALOG_BRANDS=Array.isArray(b)?b:[];return CATALOG_BRANDS;})
    .catch(e=>{_brandsReq=null;throw e;});
  return _brandsReq;
}
// Отмеченные производители складываются. Общее число приходит вместе со
// страницей: без него постраничная навигация не знает, сколько страниц рисовать.
async function brandProducts(brands,q,offset){
  const path='/kp/brand?'+brands.map(b=>'brand='+encodeURIComponent(b)).join('&')
    +(q?'&q='+encodeURIComponent(q):'')
    +'&limit='+BRAND_PAGE+'&offset='+(offset||0);
  const r=await api(path);
  // brand несём отдельно: normLive его не знает, а строке выдачи он нужен
  return {total:+r.total||0,
    items:(r.items||[]).map(p=>Object.assign(normLive(p),{brand:p.brand||''}))};
}
// Недавнее и популярное — до ввода и до фильтра (#366). Кэша нет: только
// что добавленная позиция должна встать в «недавнее» при следующем открытии.
async function loadFrequent(){
  if(PUB)return {recent:[],popular:[],brands:[]};
  const r=await api('/kp/frequent');
  const norm=l=>(l||[]).map(p=>Object.assign(normLive(p),{brand:p.brand||''}));
  return {recent:norm(r.recent),popular:norm(r.popular),brands:r.brands||[]};
}
// подтянуть себестоимость (закуп) для роли директор/офис
// Себестоимость теперь проверяется на сервере: у ролей без доступа запрос
// вернёт 403, поэтому и не дёргаем его лишний раз.
// Закупку показываем и без права правки (снабжение), но сохранять смету при
// этом нельзя: saveCur() ушёл бы в PUT и вернул 403 на каждой добавленной
// позиции. Цена остаётся на экране, в базу её пишет тот, кому это разрешено.
async function fetchCost(r){if(!LIVE||!r.pid||!can('cost:read'))return;
  // Вписанное руками главнее каталога: подставляем только в пустое поле.
  if(+r.zakup>0)return;
  try{const m=await api('/kp/cost?ids='+r.pid);const info=m[String(r.pid)];if(info&&info.cost){r.zakup=info.cost;r.costSrc='catalog';updFoot();if(canEdit())saveCur();}}catch(e){}}

// ── список товаров для добавления (data-pick индексирует сюда) ──
let lastResults=[];

let specs=[],curId=null,rows=[],sel=new Set(),mergePick=false;

// ── Правка названия сметы прямо в заголовке ──────────────────────────────────
// Раньше название спрашивали системным окном prompt(). Оно блокирует страницу,
// не оформляется под интерфейс и на телефоне занимает пол-экрана. Теперь
// заголовок правится там, где он написан: Enter — сохранить, Esc — отменить,
// уход фокуса — сохранить. Пустое имя не принимается: вернётся прежнее.
// Подтверждение действия. Если слой интерфейса почему-то не поднялся,
// падать нельзя — спрашиваем системным окном, как раньше.
function askYes(o,onYes){
  if(window.UI&&UI.confirm)return UI.confirm(o).then(y=>{if(y)onYes();});
  if(confirm((o.title||'')+'\n\n'+(o.text||'')))onYes();
}
// Удаление сметы вынесено из обработчика: его теперь зовёт окно подтверждения.
function delSpecGo(s){
  const dropLocal=()=>{specs=specs.filter(x=>x.id!==curId);saveLocal();curId=null;go('specs');toast('Смета удалена');};
  if(!LIVE){dropLocal();return}
  // Ответ сервера обязательно дожидаемся. Раньше смета исчезала из интерфейса
  // даже при отказе, а на сервере оставалась: человек уходил в уверенности,
  // что удалил, — и обнаруживал её потом у коллеги.
  const delId=curId;
  api('/specs/'+delId,{method:'DELETE'}).then(()=>{
    specs=specs.filter(x=>x.id!==delId);saveLocal();
    if(curId===delId)curId=null;
    go('specs');toast('Смета удалена');
  }).catch(e=>toast('Не удалось удалить: '+(e.message||'нет связи')+'. Смета на месте.',5000));
}
function editTitle(){
  const el=document.getElementById('etitle');
  if(!el||!canEdit())return;
  const s=specs.find(x=>x.id===curId); if(!s)return;
  const was=s.title||'';
  el.contentEditable='true';
  el.classList.add('editing');
  el.focus();
  // Выделяем целиком: чаще название заменяют, а не дописывают.
  const rng=document.createRange(); rng.selectNodeContents(el);
  const selc=window.getSelection(); selc.removeAllRanges(); selc.addRange(rng);

  let done=false;
  const finish=(save)=>{
    if(done)return; done=true;
    el.contentEditable='false';
    el.classList.remove('editing');
    const val=(el.textContent||'').trim();
    if(!save||!val){ el.textContent=was; return; }
    if(val===was)return;
    s.title=val;
    el.textContent=val;
    const on=document.getElementById('objname'); if(on)on.textContent=val;
    if(LIVE)putSpec(s); else saveLocal();
    toast('Название сохранено');
  };
  el.onkeydown=e=>{
    if(e.key==='Enter'){e.preventDefault();finish(true);el.blur();}
    else if(e.key==='Escape'){e.preventDefault();finish(false);el.blur();}
  };
  el.onblur=()=>finish(true);
}
// Название правится нажатием на него — отдельной кнопки в ряду нет.
document.addEventListener('click',e=>{
  const t=e.target.closest('#etitle');
  if(t&&t.contentEditable!=='true')editTitle();
});

// Правка разрешена, если сервер прислал can_edit (публичная ссылка) либо
// у вошедшего есть spec:write. Раньше здесь стояло безусловное true, и
// снабжение (spec:read без spec:write) видело живые поля: каждый PUT возвращал
// 403, обработчик молча уводил правки в localStorage, и человек работал часами
// в уверенности, что смета сохраняется.
//
// spec:calc правит только свои сметы, но чужие ему и не открываются: список
// по этому праву состоит из своих, а чужая отвечает 404. Значит всё, до чего
// он доберётся, он и правит — обманки не возникает.
function canEdit(){return PUB?!!PUB_EDIT:(can('spec:write')||can('spec:calc'));}
// Удаление — по правилу DELETE /specs/{uid}: spec:delete либо автор со spec:calc.
// Автора клиент не знает, но без spec:read сервер открывает только свои сметы.
function canDelSpec(){return !PUB&&(can('spec:delete')||(can('spec:calc')&&!can('spec:read')));}
// Приводим интерфейс в соответствие с правом. Прятать нужно не «кнопку
// удаления», а всё, что пишет: иначе получается экран-обманка.
function applyEditPerm(){
  const on=canEdit();
  const note=$('#roNote');
  if(note){note.style.display=on?'none':'';
    note.textContent=PUB?'Просмотр по ссылке — правка недоступна'
                        :'Просмотр — править эту смету может её автор';}
  document.querySelectorAll('[data-act="newspec"],[data-act="addsection"],[data-act="import"],'
    +'[data-act="mprices"],[data-act="dupspec"]')
    .forEach(b=>{b.style.display=on?'':'none';});
  document.querySelectorAll('[data-act="delspec"]')
    .forEach(b=>{b.style.display=canDelSpec()?'':'none';});
  // Общий доступ — своё разрешение (spec:publish), а не «правка вообще»:
  // выдать ссылку на смету может не всякий, кто её правит.
  const sh=document.querySelector('[data-act="sharespec"]');
  if(sh&&!PUB)sh.style.display=can('spec:publish')?'':'none';
  // КП в Google создаёт номер и документ на Диске — это право на смету, не на расчёт.
  document.querySelectorAll('[data-act="kp-gdoc"],[data-act="kp-letter"]')
    .forEach(b=>{b.style.display=(!PUB&&can('spec:write'))?'':'none';});
  const q=$('#q');
  if(q&&!PUB){q.readOnly=!on;
    q.placeholder=on?'Поиск позиции по названию или коду…':'Только просмотр — добавлять позиции нельзя';}
}
function saveLocal(){try{localStorage.setItem(SK,JSON.stringify(specs.map(x=>({id:x.id,title:x.title,date:x.date,rows:x.rows||[]}))));}catch(e){}}
let saveTimer=null;
// Сохранение, ушедшее на сервер и ещё не ответившее: кто отправляет смету
// дальше (КП в Google), ждёт его, а не только таймер.
let savingSpec=null;
// dirty — есть правки, которые ещё не доехали до сервера. Пока он поднят,
// применять серверное состояние нельзя: оно затрёт то, что человек только набрал.
let dirty=false;
function saveCur(){
  if(!canEdit())return;                     // только чтение — ничего не отправляем
  const s=specs.find(x=>x.id===curId);if(s)s.rows=rows;
  dirty=true;
  if(PUB){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=null;pubSave();},600);return;}
  if(!s)return;
  if(LIVE){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=null;savingSpec=putSpec(s);},600);}
  else {saveLocal();dirty=false;}}
let CONFLICT409=false;
// Сохранения одного окна идут строго по очереди. Ответ дольше 600 мс иначе
// застаёт следующее сохранение со старой updated_at, и сервер принимает
// собственную правку окна за чужую (409).
let putChain=Promise.resolve();
function putSpec(s){const p=putChain.then(()=>putSpecNow(s));putChain=p.catch(()=>{});return p;}
async function putSpecNow(s){
  if(CONFLICT409)return;   // уже разошлись с сервером — долбить его дальше незачем
  const body={title:s.title,object:s.object||'',customer:s.customer||'',rows:s.rows||[],author:userName()};
  if(s.updated_at)body.updated_at=s.updated_at;
  try{const res=await api('/specs/'+s.id,{method:'PUT',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body)});
  if(res&&res.updated_at)s.updated_at=res.updated_at;
  // Номер выдаёт сервер при создании — до первого сохранения его нет.
  if(res&&res.number&&s.number!==res.number)s.number=res.number;
  // Шапка — после каждого сохранения: правка после КП должна сразу
  // сказать, что в Excel уже другие цифры (#646).
  if(s.id===curId)updMeta();
  dirty=false;
  if(SRC_WARN){SRC_WARN='';setSource();}}
  // Молчаливый уход в офлайн — худшее, что тут можно сделать: человек правит
  // смету дальше, а на сервер ничего не уходит. Показываем причину явно.
  // LIVE трогает только api(): по 403/500 сервер жив, и демо-режим тут ни при чём.
  catch(e){
    if(e&&e.status===409){
      // Кто-то сохранил эту же смету из другого окна, пока мы её правили.
      // Дальше сохранять нечем: наша версия устарела, а перезаписать чужую
      // тихо — то, ради чего эта проверка вообще заведена. Останавливаемся
      // и ждём, пока человек сам перезагрузит страницу.
      CONFLICT409=true;
      SRC_WARN='смету изменили в другом окне — обновите страницу';
      setSource();
      toast('Смету изменили в другом окне, пока вы её правили. Обновите страницу, иначе ваши правки не сохранятся.',8000);
      return;
    }
    srcWarn(e);saveLocal();
  }}
// публичный режим: сохранение и опрос чужих правок (живая совместная работа по ссылке)
async function pubSave(){if(!PUB_EDIT)return;const s=specs.find(x=>x.id===curId)||{};
  try{await api(pubPath(),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:s.title,rows:rows})});
    dirty=false;
    if(pubFail){pubFail=false;setSource();}}
  // Неудача оставляла dirty=true навсегда: опрос переставал применять
  // правки коллег, а единственным признаком было одно прошедшее
  // уведомление. Теперь состояние «не сохранено» видно постоянно.
  catch(e){pubFail=true;setSource();
    toast(e&&e.status===403?'Править по ссылке может только сотрудник компании — войдите':'Не сохранилось — ссылка отключена?',5000);}}
// Опрос публичной ссылки. Раньше цепочка setTimeout не прерывалась ничем: она
// продолжала стучать на сервер и после ухода из редактора, и в фоновой вкладке.
let pollOn=false,pollTimer=null;
function startPoll(){if(!PUB||pollOn)return;pollOn=true;if(!pollTimer)pollTimer=setTimeout(pubPoll,6000);}
function stopPoll(){pollOn=false;if(pollTimer){clearTimeout(pollTimer);pollTimer=null;}}
async function pubPoll(){
  pollTimer=null;
  if(!PUB||!pollOn)return;
  if(document.hidden){pollTimer=setTimeout(pubPoll,6000);return;}   // вкладка скрыта — не дёргаем сервер
  // Ждём, пока уляжется собственное сохранение: применить серверный ответ
  // поверх несохранённых правок — значит потерять их без следа.
  if(!dirty&&!saveTimer){
    try{const full=await api(pubPath());
      if(full&&full.updated_at!==pubSeen){pubSeen=full.updated_at;
        if(full.can_edit!==undefined)PUB_EDIT=full.can_edit===true;
        const editing=document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName||'');
        if(!editing&&!dirty){rows=asRows(full.rows);const s=specs.find(x=>x.id===curId);if(s){s.rows=rows;s.title=full.title;}
          // saveCur() здесь НЕ вызываем: раз в 6 секунд писать обратно только что
          // прочитанное — это бесконечный цикл записи чужих же данных.
          render();}}
    }catch(e){}
  }
  pollTimer=setTimeout(pubPoll,6000);
}
// Вкладку вернули — не ждём полный интервал, забираем свежее состояние сразу
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&pollOn&&!pollTimer)pollTimer=setTimeout(pubPoll,300);});

function drawer(on){$('#drawer').classList.toggle('on',on);$('#ov').classList.toggle('on',on)}
// роль: показ текущей и переключение (хранится в localStorage, общее с приложением)
// Пока активна только роль Менеджер — фиксируем её (остальные роли заглушены в меню).
// ── доступ к разделам по разрешениям ──
// Карта «раздел → разрешение» вместо карты «роль → разделы»: роли меняются и
// добавляются, а право на данные одно и то же. Пустая строка — раздел без
// собственных данных (Главная, справочные экраны), он открыт любому вошедшему.
// Ещё раз: это только меню. Данные закрывает сервер.
const ROLE_NAMES={office:'Менеджер',office_admin:'Администратор офиса',montazhnik:'Исполнитель',director:'Директор',snab:'Снабжение',partner:'Партнёр',customer:'Заказчик',to_engineer:'Инженер ТО',tracker:'Учёт объектов'};
const SECT_SCOPE={
  // home остаётся: экран жив и открывается по логотипу, из меню убран лишь
  // дублирующий пункт. comp и calc убраны вместе со своими пунктами.
  home:'', tasks:'',
  // Конструктор КП открыт любому сотруднику (#66): своё право spec:calc
  // у тех, кому не положены сметы компании. Внешним — заказчику и партнёру —
  // не выдано ни то ни другое, и раздел им не покажется.
  specs:['spec:read','spec:calc'], editor:['spec:read','spec:calc'],
  // «Смена» — не только свой табель (shift:own): менеджер туда заходит без
  // единой смены за плечами, только чтобы назначить куратора и исполнителя
  // на объект (#59). Массив — «любое из перечисленных прав».
  shift:['shift:own','object:assign','object:curator'],
  zakupki:'purchase:read', deal:'deal:read',
  entities:'entity:read', settings:'users:company', audit:'audit:read'
};
function sectAllowed(v){const s=SECT_SCOPE[v];if(!s)return true;
  return Array.isArray(s)?s.some(can):can(s);}
// spec:calc не двигает стартовый раздел сотрудника: у монтажника это «Смена»,
// у людей ТО — «Обзор», и конструктор их оттуда не уводит (#66, ADR-0033).
// Но у гостя, зарегистрировавшегося по почте, конструктор — единственное, что
// открыто, и «Обзор» встречал его пустыми показателями чужой компании.
// Поэтому проверка стоит последней: она срабатывает, только когда больше
// идти некуда.
function roleDefault(r){return can('spec:read')?'specs'
  :(can('shift:own')?'shift':(can('spec:calc')?'specs':'home'));}
// Аргумент оставлен ради совместимости с вызовами из более поздних блоков —
// решение принимается по разрешениям, а не по нему.
function applyRoleNav(role){
  document.querySelectorAll('.nav[data-go]').forEach(n=>{n.style.display=sectAllowed(n.dataset.go)?'':'none';});}
function initRole(){let r='office',nm=null;try{r=localStorage.getItem('fse_role')||'office';nm=localStorage.getItem('fse_role_name');}catch(e){}
  const el=$('#roleName');if(el)el.textContent=nm||ROLE_NAMES[r]||r;
  applyRoleNav(r);}
function setRole(role,name){try{localStorage.setItem('fse_role',role);localStorage.setItem('fse_role_name',name);}catch(e){}
  const el=$('#roleName');if(el)el.textContent=name;const rl=$('#roleList');if(rl)rl.style.display='none';toast('Роль: '+name);
  applyRoleNav(role);
  go(roleDefault(role));}
// Скрыть все разделы кроме одного. Разделы — это div, чей id оканчивается на
// View. Перечислять их поимённо оказалось ненадёжно: добавили Главную —
// и она осталась висеть под «Сменой» и «Закупками».
function hideViewsExcept(keepId){
  document.querySelectorAll('div[id$="View"]').forEach(function(d){
    if(d.id!==keepId)d.style.display='none';});
}
window.hideViewsExcept=hideViewsExcept;
function go(view){drawer(false);if(window.fseTrack)fseTrack('view:'+view);
  impErrHide();      // отказ импорта относится к смете, а не к разделу вообще
  // Ушли из редактора — обрываем опрос публичной ссылки. Иначе он жил до
  // закрытия вкладки и продолжал стучать на сервер из любого раздела.
  if(view==='editor')startPoll(); else stopPoll();
  document.querySelectorAll('.nav[data-go]').forEach(n=>n.classList.toggle('act',n.dataset.go===(view==='editor'?'specs':view)));
  if($('#settingsView'))$('#settingsView').style.display='none';
  if($('#auditView'))$('#auditView').style.display='none';
  if($('#entitiesView'))$('#entitiesView').style.display='none';
  if($('#homeView'))$('#homeView').style.display='none';
  if(view==='home'){$('#specsView').style.display='none';$('#editorView').style.display='none';
    // Блок Главной подключается в конце файла — вызываем через проверку,
    // чтобы неполная загрузка страницы не роняла переход целиком
    $('#homeView').style.display='';$('#objname').textContent='';
    if(window.renderHome)renderHome();return;}
  if(view==='specs'||view==='editor'){$('#specsView').style.display=view==='specs'?'':'none';$('#editorView').style.display=view==='editor'?'':'none';
    $('#objname').textContent=view==='editor'?(specs.find(x=>x.id===curId)||{}).title||'':'';if(view==='specs')renderSpecs();}
  // Ветки view==='calc', 'montazh' и 'reports' сняты вместе со своими разделами
  // (СП 485 — 1 августа, «Монтаж» заменён «Сменой», «Отчёты» — зеркалом
  // TimeBot — #150). Ссылки на них могли остаться в закладке — отвечаем
  // словами, а не молчанием: ниже, в общем else, все три попадают в понятный текст.
  else if(view==='settings'){ if(!can('users:company')){toast('Раздел «Настройки» вам не выдан');return;}
$('#specsView').style.display='none';$('#editorView').style.display='none';
$('#objname').textContent='Настройки — пользователи'; ensureSettingsView(); renderUsersAdmin(); }
else if(view==='audit'){ if(!can('audit:read')){toast('Журнал доступа виден администратору');return;}
$('#specsView').style.display='none';$('#editorView').style.display='none';
$('#objname').textContent='Журнал доступа'; ensureAuditView(); renderAudit(); }
else if(view==='entities'){ if(!can('entity:read')){toast('Раздел «Юрлица» вам не выдан');return;}
$('#specsView').style.display='none';$('#editorView').style.display='none';
$('#objname').textContent='Юрлица — реквизиты'; ensureEntitiesView(); renderEntities(); }
// «Расчёты» и «Монтаж» отвечают отдельно: разделы не «появятся позже» —
// один переехал, другой заменён, и по старой закладке надо сказать куда,
// а не отправить ждать.
else if(view==='calc')toast('Расчёты по СП 485 переехали на сайт gasbase.ru',4000);
else if(view==='montazh')toast('Раздел «Монтаж» заменён «Сменой»',4000);
else if(view==='reports')toast('Раздел «Отчёты» снят вместе с зеркалом TimeBot',4000);
else toast('Раздел «'+({comp:'Юрлица',tasks:'Задачи'}[view]||view)+'» появится позже');}




// ── Настройки: пользователи Telegram (только директор) ──
function ensureSettingsView(){let v=document.getElementById('settingsView');
 if(!v){v=document.createElement('div');v.id='settingsView';$('#specsView').parentNode.appendChild(v);}
 v.style.display='';return v;}
// 401 здесь — истёкшая сессия, а не «нет прав»: показывать текст и оставлять
// человека на странице бессмысленно, ни один запрос уже не пройдёт.
async function _authGet(p){const r=await fetch('/api/auth/'+p,{headers:{'X-FSE-Session':sessId()}});
 if(r.status===401)authExpired();
 if(!r.ok)throw new Error(r.status===403?'Нет доступа к этим данным':'Ошибка '+r.status);return r.json();}
async function _authPost(p,body){const r=await fetch('/api/auth/'+p,{method:'POST',
 headers:{'Content-Type':'application/json','X-FSE-Session':sessId()},body:JSON.stringify(body)});
 if(r.status===401)authExpired();
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||'Ошибка');return d;}
// _esc удалён — экранировщик в файле один, esc() выше. Разные копии расходились:
// эта не закрывала апостроф, и значение в value='…' из неё выходило живым.
function _ago(t){if(!t||t==='None')return '—';const m=(Date.now()-new Date(t.replace(' ','T')).getTime())/60000;
 if(!isFinite(m))return '—';if(m<1)return 'только что';if(m<60)return Math.floor(m)+' мин назад';
 if(m<1440)return Math.floor(m/60)+' ч назад';return Math.floor(m/1440)+' дн назад';}
const HEAD=(h1,p)=>`<div class="ph"><div><h1>${h1}</h1><p>${p}</p></div></div>`;
async function renderUsersAdmin(){const v=ensureSettingsView();
 const SH_=HEAD('Настройки','Кто пользуется системой, с какой ролью и по какому приглашению');
 v.innerHTML=SH_+(window.UI?UI.loading(4):'<div class="pd sub">Загрузка…</div>');
 try{
  const [users,st,invites]=await Promise.all([_authGet('users'),_authGet('stats'),_authGet('invites')]);
  const S7={};(st.users||[]).forEach(u=>S7[u.user_id]=u);
  const RN={admin:'Администратор',director:'Директор',office_admin:'Администратор офиса',office:'Менеджер',montazhnik:'Исполнитель',snab:'Снабжение',partner:'Партнёр',customer:'Заказчик',to_engineer:'Инженер ТО',tracker:'Учёт объектов',guest:'Гость'};
  // Расшифровка кодов разделов в статистике действий. Снятые разделы здесь
  // остаются: в журнале лежат прошлые переходы, и без расшифровки они
  // превратились бы в «calc» и «comp» без объяснений.
  const SEC={home:'Обзор',comp:'Компании',specs:'Сметы',editor:'Конструктор КП',calc:'Расчёты (снят)',tasks:'Задачи',settings:'Настройки',deal:'Расчёт сделки',shift:'Смена',zakupki:'Закупки',entities:'Юрлица',audit:'Журнал доступа',to:'Обслуживание',recert:'Переосвидетельствование',crm:'CRM',help:'Помощь'};
  // Директора, партнера, заказчика и учёт объектов выдает только администратор: сервер
  // директору откажет, и в списке их нет. Нынешняя роль остается в списке
  // всегда, а уходит на сервер, только если ее сменили: сохранить заметку
  // гостя — не значит взять его на работу.
  const OUT=can('users:manage')?['admin']:['admin','director','partner','customer','tracker'];
  const opts=(r0,noAdmin,skip)=>Object.keys(RN).filter(k=>k===r0||(k!==skip&&(!noAdmin||!OUT.includes(k)))).map(k=>`<option value="${k}" ${k===r0?'selected':''}>${RN[k]}</option>`).join('');

  // Состояние человека тремя словами и точкой цвета — вместо цветного текста
  const ST={active:['ok','работает'],blocked:['bad','заблокирован']};
  const stt=s=>{const x=ST[s]||['warn','ждёт разрешения'];
    return `<span class="stt ${x[0]}"><i></i>${x[1]}</span>`;};

  const waiting=users.filter(u=>u.status!=='active'&&u.status!=='blocked'&&u.role!=='admin').length;

  // ── Люди. Раскрывающаяся запись вместо таблицы на семь колонок:
  //    править роль и заметку с телефона в таблице было нельзя (И16).
  const people=users.map(u=>{
    const s7=S7[u.user_id]||{};
    const isAdmin=u.role==='admin';
    const name=[u.first_name,u.last_name].filter(Boolean).map(esc).join(' ')||('id '+u.user_id);
    const open=(u.status!=='active'&&u.status!=='blocked'&&!isAdmin);
    return `<div class="acc${open?' op':''}" data-tid="${u.user_id}" data-role="${esc(u.role||'')}">
      <div class="acch">
        <div class="ni ${u.status==='blocked'?'bad':(u.status==='active'?'ok':'warn')}">
          <svg class="i"><use href="#i-usr"/></svg></div>
        <div class="nm"><b>${name}${u.username?` <span class="sub" style="display:inline">@${esc(u.username)}</span>`:''}</b>
          ${stt(u.status)} <span class="sub" style="display:inline">· ${esc(RN[u.role]||u.role||'роль не задана')}</span>
          ${u.note?`<div class="sub">${esc(u.note)}</div>`:''}</div>
        <div class="rt">${esc(_ago(s7.last_seen))}<div class="sub">действий за 7 дней: ${s7.actions_7d||0}</div></div>
        <svg class="i chv"><use href="#i-down"/></svg>
      </div>
      <div class="accb">${isAdmin
        ? '<div class="hint">Администратор. Роль не выдаётся и не снимается из интерфейса — только на сервере.</div>'
        : `<div class="frow">
            <div class="fld" style="flex:1 1 220px"><label>Заметка — кто это</label>
              <input class="inp uadm-note" value="${esc(u.note)}" placeholder="ФИО, бригада, компания" style="width:100%"></div>
            <div class="fld" style="flex:0 1 200px"><label>Роль</label>
              <select class="inp uadm-role" style="width:100%">${opts(RN[u.role]?u.role:'montazhnik',true)}</select></div>
            <button class="btn uadm-ok" title="${u.status==='active'?'Сохранить роль и заметку':'Разрешить вход и сохранить роль'}">
              <svg class="i"><use href="#i-ok"/></svg><span class="lbl">${u.status==='active'?'Сохранить':'Разрешить вход'}</span></button>
            ${u.status!=='blocked'?`<button class="btn danger uadm-block" title="Заблокировать — вход закроется">
              <svg class="i"><use href="#i-lock"/></svg><span class="lbl">Заблокировать</span></button>`:''}
          </div>
          <div class="fnote">Заметка сохраняется и по Enter. Роль решает, какие разделы человек увидит; данные закрывает сервер.</div>`}
      </div></div>`;}).join('');

  // ── Разделы за 7 дней. Строка «специи: 12 · отчёты: 3» читалась как шум;
  //    полоса длиной по доле сразу показывает, чем пользуются.
  const secs=(st.sections||[]).map(x=>({n:SEC[x.event.replace('view:','')]||x.event,c:+x.cnt||0}))
    .sort((a,b)=>b.c-a.c);
  const secMax=secs.reduce((m,x)=>Math.max(m,x.c),0)||1;

  v.innerHTML=SH_+`<div style="max-width:1000px">

<div class="cd" style="margin-bottom:14px">
  <div class="cdh"><h2>Люди</h2>
    ${waiting?`<span class="ch warn">ждут разрешения: ${waiting}</span>`:''}
    <span class="hint" style="margin-left:auto">всего: ${users.length}</span></div>
  <div class="pd pd0"><p class="note" style="margin:0 0 4px">Человек регистрируется сам — через телеграм на странице входа.
    Здесь ему выдают роль и открывают вход. Пока не открыли, он в систему не попадёт.</p></div>
  <div style="border-top:1px solid var(--line)">${people
    ||(window.UI?UI.empty({icon:'i-usrs',title:'Пока никого нет',
        text:'Отправьте приглашение — по ссылке человек войдёт сразу с нужной ролью.'}):'')}</div>
</div>

<div class="cd" style="margin-bottom:14px">
  <div class="cdh"><h2>Приглашения</h2>
    <span class="hint" style="margin-left:auto">ссылка действует 7 дней</span></div>
  <div class="pd pd0">
    <p class="note" style="margin:0 0 12px">Вошедший по ссылке активируется сразу, с той ролью,
      которую вы выбрали, — подтверждать вручную не нужно.</p>
    <div class="frow">
      <div class="fld" style="flex:0 1 200px"><label for="invRole">Роль</label>
        <select id="invRole" class="inp" style="width:100%">${opts('montazhnik',true,'guest')}</select></div>
      <div class="fld" style="flex:1 1 220px"><label for="invNote">Кому отправите</label>
        <input id="invNote" class="inp" placeholder="Имя или бригада — чтобы потом узнать" style="width:100%"></div>
      <button class="btn primary" id="invCreate" title="Создать приглашение">
        <svg class="i"><use href="#i-plus"/></svg><span class="lbl">Создать</span></button>
    </div>
  </div>
  ${invites.map(i=>`<div class="it" data-iid="${i.id}" data-code="${esc(i.code)}" style="align-items:center">
    <div class="ni info"><svg class="i"><use href="#i-link"/></svg></div>
    <div style="min-width:0"><div class="tx">${i.note?`<b>${esc(i.note)}</b> · `:''}${esc(i.role_name)}</div>
      <div class="sb">вошло по ссылке: ${i.uses} · действует до ${esc((i.expires_at||'').slice(0,10))}</div></div>
    <div style="margin-left:auto;display:flex;gap:7px;flex:0 0 auto">
      <button class="btn sm inv-copy" title="Копировать ссылку">
        <svg class="i"><use href="#i-copy"/></svg><span class="lbl">Ссылка</span></button>
      <button class="btn sm danger inv-del" title="Отключить приглашение">
        <svg class="i"><use href="#i-trash"/></svg><span class="lbl">Отключить</span></button></div>
  </div>`).join('')||`<div class="ft">Активных приглашений нет</div>`}
</div>

<div class="cd"><div class="cdh"><h2>Чем пользуются</h2>
    <span class="hint" style="margin-left:auto">переходы за 7 дней</span></div>
  ${secs.length?`<div class="pd pd0">${secs.map(x=>`<div style="margin-bottom:9px">
      <div style="display:flex;gap:10px;font-size:var(--f12);margin-bottom:4px">
        <span>${esc(x.n)}</span><b class="n" style="margin-left:auto">${x.c}</b></div>
      <div class="prg"><i style="width:${Math.round(x.c/secMax*100)}%;background:var(--blu)"></i></div>
    </div>`).join('')}</div>`
    :`<div class="ft">Пока пусто — статистика появится после первых переходов</div>`}
</div>

</div>`;
  // ── События. Строка теперь не <tr>, а запись списка: ищем по data-tid.
  v.querySelectorAll('.uadm-ok,.uadm-block').forEach(b=>b.onclick=async e=>{
   const row=e.target.closest('[data-tid]');const sel=row.querySelector('.uadm-role');
   const blocking=e.target.closest('.uadm-block');
   try{await _authPost('users/set',{user_id:+row.dataset.tid,role:sel&&sel.value!==row.dataset.role?sel.value:undefined,
    note:row.querySelector('.uadm-note').value,
    status:blocking?'blocked':'active'});
    toast(blocking?'Вход закрыт':'Сохранено, вход открыт');renderUsersAdmin();}
   catch(err){toast(err.message);}});
  v.querySelectorAll('.uadm-note').forEach(inp=>inp.onkeydown=async e=>{
   if(e.key!=='Enter')return;const row=e.target.closest('[data-tid]');
   try{await _authPost('users/set',{user_id:+row.dataset.tid,note:e.target.value});toast('Заметка сохранена');}
   catch(err){toast(err.message);}});
  const ic=v.querySelector('#invCreate');
  if(ic)ic.onclick=async()=>{try{await _authPost('invites',{role:v.querySelector('#invRole').value,note:v.querySelector('#invNote').value});
   toast('Приглашение создано');renderUsersAdmin();}catch(err){toast(err.message);}};
  v.querySelectorAll('.inv-copy').forEach(b=>b.onclick=e=>{
   const code=e.target.closest('[data-code]').dataset.code;
   const url=location.origin+'/index.html?inv='+code;
   (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('Ссылка скопирована'))
    .catch(()=>{ if(window.UI&&UI.copyBox)UI.copyBox('Ссылка приглашения',url);
     else window.prompt('Скопируй ссылку:',url); });});
  v.querySelectorAll('.inv-del').forEach(b=>b.onclick=async e=>{
   try{await _authPost('invites/delete',{id:+e.target.closest('[data-iid]').dataset.iid});toast('Приглашение отключено');renderUsersAdmin();}
   catch(err){toast(err.message);}});
 // Текст ошибки приходит с сервера и попадает в разметку — экранируем.
 }catch(e){v.innerHTML=SH_+(window.UI?UI.error({title:'Настройки не загрузились',text:e.message})
   :'<div class="pd" style="color:var(--red)">'+esc(e.message)+'</div>');}
}

// ── Журнал доступа (audit:read) ──
// Отдельный экран, потому что журнал имеет смысл, только если его читают
// глазами: в логах сервера обращения к себестоимости и ведомости теряются
// среди всего остального. Особая строка — обращение администратора к данным
// чужой компании: оно законно, но должно быть видно.
const AUD={days:7,crossOnly:false};
function ensureAuditView(){let v=document.getElementById('auditView');
 if(!v){v=document.createElement('div');v.id='auditView';$('#specsView').parentNode.appendChild(v);}
 v.style.display='';return v;}
// Время приходит от базы то с «T», то с пробелом. Не разобралось — показываем
// как есть: выдумывать дату в журнале доступа нельзя.
function audWhen(t){const s=String(t||'');if(!s)return '—';
 const d=new Date(s.replace(' ','T'));if(isNaN(d.getTime()))return s;
 const p=n=>('0'+n).slice(-2);
 return p(d.getDate())+'.'+p(d.getMonth()+1)+'.'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes());}
// Имена разрешений в журнале — машинные. Человеку показываем то же, что он
// видит в интерфейсе, иначе журнал читать невозможно.
const AUD_ACT={'cost:read':'Себестоимость','payroll:read':'Ведомость','payroll:write':'Оклады и премии',
 'object:meta':'Настройки объекта','media:read':'Снимок смены','share:create':'Публичная ссылка',
 'export:payroll':'Выгрузка ведомости','storage:manage':'Облако компании','tenant.declared':'Объявление компании'};
// Имена полей у ручки могут отличаться от ожидаемых — журнал тогда
// показывал столбец прочерков. Берём первое, что есть.
const audPick=(r,keys)=>{for(const k of keys){const v=r[k];
 if(v!=null&&String(v).trim()!=='')return v;} return '';};
function audRowHTML(r){
 const obj=[r.entity,r.entity_id].filter(x=>x!=null&&String(x)!=='').map(esc).join(' · ')||'—';
 const when=audPick(r,['at','ts','time','created_at','happened_at','date']);
 const who =audPick(r,['who','user','user_name','username','actor','name','user_id']);
 return `<tr${r.cross_tenant?' style="background:var(--warnbg)"':''}>
  <td style="padding:6px;white-space:nowrap">${esc(when?audWhen(when):'—')}</td>
  <td style="padding:6px">${esc(who||'—')}</td>
  <td style="padding:6px">${esc(AUD_ACT[r.action]||r.action||'—')}${r.cross_tenant?' <b style="color:var(--warn)">· чужая компания</b>':''}</td>
  <td style="padding:6px">${obj}</td>
  <td style="padding:6px;color:var(--mut)">${esc(r.note||'')}</td></tr>`;}
async function renderAudit(){const v=ensureAuditView();
 const dopt=[7,30,90].map(d=>`<option value="${d}"${AUD.days===d?' selected':''}>${d} дней</option>`).join('');
 v.innerHTML=HEAD('Журнал доступа',
   'Обращения к данным с грифом: себестоимость, ведомость, зарплаты, снимки смен, публичные ссылки')
+`<div style="max-width:1080px">
<div class="cd pd" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
 <div class="fld"><label for="audDays">Глубина</label>
  <select id="audDays" class="inp" style="min-width:130px">${dopt}</select></div>
 <label class="tfchk" style="height:auto;align-self:flex-end;padding-bottom:9px">
  <input type="checkbox" id="audCross"${AUD.crossOnly?' checked':''}>
  Только обращения к чужим компаниям</label>
 <span class="hint" style="margin-left:auto;align-self:center">Жёлтым — обращения администратора к данным чужой компании</span>
</div>
<div id="audBody" style="color:var(--mut)">${window.UI?UI.loading(4):'Загрузка…'}</div></div>`;
 const ds=document.getElementById('audDays');
 if(ds)ds.onchange=e=>{AUD.days=+e.target.value||7;renderAudit();};
 const cs=document.getElementById('audCross');
 if(cs)cs.onchange=e=>{AUD.crossOnly=!!e.target.checked;renderAudit();};
 const body=document.getElementById('audBody');
 let list;
 try{list=await _authGet('access-log?days='+AUD.days);}
 catch(e){body.innerHTML='<div style="color:var(--red)">'+esc(e.message)+'</div>';return;}
 // Фильтр по чужим компаниям считаем на клиенте: набор параметров ручки может
 // отличаться, а пустая таблица от непонятого сервером параметра выглядит как
 // «обращений не было» — самый опасный вид ошибки для журнала.
 const rows=(Array.isArray(list)?list:[]).filter(r=>!AUD.crossOnly||r.cross_tenant);
 if(!rows.length){body.innerHTML='<div>'+(AUD.crossOnly?'Обращений к чужим компаниям за период нет.':'Записей за период нет.')+'</div>';return;}
 body.innerHTML=`<div class="rptwrap"><table style="width:100%;border-collapse:collapse;font-size:13px">
<thead><tr style="text-align:left;color:var(--mut)"><th style="padding:6px">Когда</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Примечание</th></tr></thead>
<tbody>${rows.map(audRowHTML).join('')}</tbody></table></div>
<div class="sub" style="margin-top:8px">Записей: ${rows.length}</div>`;}


// ── Юрлица (director+admin): реквизиты + сотрудники ──
// V2: делегирование событий (кнопки в динамических формах) + автозаполнение по ИНН/БИК.
const ENT={list:null,users:null,pickLoading:false};
const ENT_TAXN={vat22:'НДС 22%',usn:'УСН (без НДС)'};
const ENT_TYPEN={ooo:'ООО',ip:'ИП'};
const ENT_F=[['name','Название (как в документах)'],['inn','ИНН'],['kpp','КПП (для ООО)'],['ogrn','ОГРН / ОГРНИП'],['address','Юридический адрес'],['bank','Банк'],['bik','БИК'],['rs','Расчётный счёт'],['ks','Корр. счёт'],['signer_name','Подписант — ФИО'],['signer_position','Подписант — должность'],['signer_basis','Действует на основании']];
function ensureEntitiesView(){let v=document.getElementById('entitiesView');
 if(!v){v=document.createElement('div');v.id='entitiesView';$('#specsView').parentNode.appendChild(v);}
 v.style.display='';entBind(v);return v;}
function entFormHTML(e){e=e||{};
 const f=(k,ph)=>`<label style="display:block;margin:6px 0 2px;font-size:12px;color:var(--mut)">${ph}</label>
 <div style="display:flex;gap:8px;align-items:center;max-width:420px"><input class="ent-f" data-k="${k}" value="${esc(e[k])}" style="padding:6px 8px;flex:1">
 ${k==='inn'?'<button class="btn sm ent-lookup" title="Подтянуть реквизиты из ЕГРЮЛ">🔎 По ИНН</button>':''}</div>`;
 return `<div class="ent-form" data-eid="${e.id||''}" style="border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:14px;margin:10px 0;max-width:640px">
 <b>${e.id?'Реквизиты':'Новое юрлицо'}</b>
 <div style="margin:6px 0 8px;font-size:12px;color:var(--mut)">Введи ИНН и нажми «По ИНН» — название, КПП, ОГРН, адрес и подписант подтянутся из ЕГРЮЛ. БИК подтягивает банк и к/с автоматически.</div>
 <div style="margin:8px 0 2px;font-size:12px;color:var(--mut)">Тип · Налоговый режим (влияет на НДС в КП!)</div>
 <select class="ent-f" data-k="type" style="padding:6px">${Object.keys(ENT_TYPEN).map(k=>`<option value="${k}" ${((e.type||'ooo')===k)?'selected':''}>${ENT_TYPEN[k]}</option>`).join('')}</select>
 <select class="ent-f" data-k="tax_mode" style="padding:6px;margin-left:8px">${Object.keys(ENT_TAXN).map(k=>`<option value="${k}" ${((e.tax_mode||'vat22')===k)?'selected':''}>${ENT_TAXN[k]}</option>`).join('')}</select>
 ${ENT_F.map(x=>f(x[0],x[1])).join('')}
 <div style="margin-top:12px"><button class="btn primary ent-save">Сохранить</button>
 <button class="btn ent-cancel" style="margin-left:8px">Отмена</button></div></div>`;}
function entCardHTML(e){const mem=(e.members||[]).map(m=>`<span style="display:inline-block;background:rgba(128,128,128,.12);border-radius:8px;padding:3px 8px;margin:2px 4px 2px 0">${esc(m.name||m.username||m.user_id)}${e.can_members?` <a href="#" class="ent-mdel" data-tid="${m.user_id}" style="text-decoration:none;color:var(--red)">✕</a>`:''}</span>`).join('')||'<span style="color:var(--mut)">пока никого</span>';
 return `<div class="ent-card" data-eid="${e.id}" style="border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:14px;margin:10px 0;max-width:640px;${e.active?'':'opacity:.55'}">
 <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="font-size:15px">${esc(e.name)}</b>
 <span style="font-size:12px;color:var(--mut)">${ENT_TYPEN[e.type]||e.type} · ${ENT_TAXN[e.tax_mode]||e.tax_mode}${e.inn?' · ИНН '+esc(e.inn):''}${e.active?'':' · отключено'}</span>
 ${e.can_edit?`<span style="margin-left:auto;white-space:nowrap"><button class="btn sm ent-edit">✎ Реквизиты</button>
 <button class="btn sm ${e.active?'danger':''} ent-toggle" style="margin-left:6px">${e.active?'Отключить':'Включить'}</button>${e.active?'':`
 <button class="btn sm danger ent-del" style="margin-left:6px">Удалить</button>`}</span>`:''}</div>
 <div style="font-size:13px;color:var(--mut);margin-top:6px">${[e.kpp?'КПП '+esc(e.kpp):'',e.ogrn?'ОГРН '+esc(e.ogrn):'',e.bank?esc(e.bank):'',e.bik?'БИК '+esc(e.bik):'',e.rs?'р/с '+esc(e.rs):''].filter(Boolean).join(' · ')||'реквизиты не заполнены'}</div>
 ${e.signer_name?`<div style="font-size:13px;color:var(--mut);margin-top:2px">Подписант: ${esc(e.signer_name)}${e.signer_position?' ('+esc(e.signer_position)+')':''}${e.signer_basis?', на основании '+esc(e.signer_basis):''}</div>`:''}
 ${e.can_members?`<div style="margin-top:10px;font-size:13px"><b>Сотрудники:</b> ${mem}
 <div style="margin-top:6px"><select class="ent-uadd" style="padding:5px 6px;min-width:200px"><option value="">— добавить сотрудника —</option></select></div></div>`:''}
 <div class="ent-formslot"></div></div>`;}
async function entUsers(){if(ENT.users)return ENT.users;
 try{ENT.users=await _authGet('entities/users');}catch(e){ENT.users=[];}
 return ENT.users;}
async function entLookup(form){const inp=form.querySelector('.ent-f[data-k="inn"]');
 const inn=(inp&&inp.value||'').replace(/\D/g,'');
 if(inn.length!==10&&inn.length!==12){toast('ИНН — 10 (ООО) или 12 (ИП) цифр');return;}
 toast('Ищу в ЕГРЮЛ…');
 try{const d=await _authGet('entities/lookup?inn='+inn);let n=0;
  const OVERWRITE=['name','kpp','ogrn','address','inn','type'];
  form.querySelectorAll('.ent-f').forEach(i=>{const k=i.dataset.k;const val=d[k];
   if(val==null||val==='')return;
   const cur=(i.value||'').trim();
   if(OVERWRITE.includes(k)||!cur){if(String(i.value)!==String(val)){i.value=String(val);n++;}}});
  toast('Заполнено из '+(d.source==='dadata'?'DaData':'ЕГРЮЛ')+': полей — '+n+(d.status&&d.status!=='ACTIVE'?' · статус: '+d.status:''));
 }catch(err){toast(err.message);}}
async function entBank(form,bikInp){const bik=(bikInp.value||'').replace(/\D/g,'');
 if(bik.length!==9)return;
 try{const b=await _authGet('entities/bank?bik='+bik);
  const bank=form.querySelector('.ent-f[data-k="bank"]'),ks=form.querySelector('.ent-f[data-k="ks"]');
  if(bank&&b.bank)bank.value=b.bank;
  if(ks&&b.ks)ks.value=b.ks;
  toast('Банк: '+b.bank);}catch(err){toast(err.message);}}
function entBind(v){if(v._entBound)return;v._entBound=true;
 v.addEventListener('click',async e=>{
  const t=e.target;
  if(t.id==='entNew'){const s=v.querySelector('#entNewSlot');s.innerHTML=s.innerHTML?'':entFormHTML(null);return;}
  if(t.classList.contains('ent-cancel')){t.closest('.ent-form').remove();return;}
  if(t.classList.contains('ent-lookup')){entLookup(t.closest('.ent-form'));return;}
  if(t.classList.contains('ent-edit')){const card=t.closest('.ent-card');
   const ent=(ENT.list||[]).find(x=>String(x.id)===card.dataset.eid);
   const slot=card.querySelector('.ent-formslot');slot.innerHTML=slot.innerHTML?'':entFormHTML(ent);return;}
  if(t.classList.contains('ent-toggle')){const card=t.closest('.ent-card');
   const ent=(ENT.list||[]).find(x=>String(x.id)===card.dataset.eid);
   try{await _authPost('entities/set',{id:ent.id,active:!ent.active});toast(ent.active?'Юрлицо отключено':'Юрлицо включено');renderEntities();}
   catch(err){toast(err.message);}return;}
  // Удаление — только у отключённого: сперва юрлицо уходит из выбора, и лишь
  // потом, если на него ничего не ссылается, его можно убрать совсем.
  if(t.classList.contains('ent-del')){const card=t.closest('.ent-card');
   const ent=(ENT.list||[]).find(x=>String(x.id)===card.dataset.eid);
   askYes({title:'Удалить юрлицо «'+ent.name+'»?',text:'Отменить удаление будет нельзя.',ok:'Удалить',okIcon:'i-trash'},
    ()=>_authPost('entities/'+ent.id+'/delete',{}).then(()=>{toast('Юрлицо удалено');renderEntities();},err=>toast(err.message)));
   return;}
  if(t.classList.contains('ent-mdel')){e.preventDefault();const card=t.closest('.ent-card');
   try{await _authPost('entities/'+card.dataset.eid+'/members/delete',{user_id:+t.dataset.tid});toast('Сотрудник убран');renderEntities();}
   catch(err){toast(err.message);}return;}
  if(t.classList.contains('ent-save')){const form=t.closest('.ent-form');const body={};
   form.querySelectorAll('.ent-f').forEach(i=>body[i.dataset.k]=i.value.trim());
   try{
    if(form.dataset.eid){body.id=+form.dataset.eid;await _authPost('entities/set',body);}
    else await _authPost('entities',body);
    toast('Сохранено');renderEntities();
   }catch(err){toast(err.message);}return;}
 });
 v.addEventListener('change',async e=>{
  const t=e.target;
  if(t.classList.contains('ent-uadd')){if(!t.value)return;const card=t.closest('.ent-card');
   try{await _authPost('entities/'+card.dataset.eid+'/members',{user_id:+t.value});toast('Сотрудник добавлен');renderEntities();}
   catch(err){toast(err.message);}return;}
  if(t.classList.contains('ent-f')&&t.dataset.k==='bik'){entBank(t.closest('.ent-form'),t);return;}
  if(t.classList.contains('ent-f')&&t.dataset.k==='inn'){const inn=(t.value||'').replace(/\D/g,'');
   const form=t.closest('.ent-form');const nameInp=form.querySelector('.ent-f[data-k="name"]');
   if((inn.length===10||inn.length===12)&&nameInp&&!nameInp.value.trim())entLookup(form);return;}
 });}
async function renderEntities(){const v=ensureEntitiesView();
 const eh=HEAD('Юрлица','Реквизиты для КП и закрывающих документов — КС-2 и КС-3');
 v.innerHTML=eh+(window.UI?UI.loading(3):'<div class="pd sub">Загрузка…</div>');
 let list;try{list=await _authGet('entities');ENT.list=list;}
 catch(e){v.innerHTML=eh+(window.UI?UI.error({title:'Юрлица не загрузились',text:e.message})
   :'<div class="pd" style="color:var(--red)">'+esc(e.message)+'</div>');return;}
 const canCreate=can('entity:write');
 v.innerHTML=eh+`<div style="max-width:980px">
 <p class="note" style="margin:0 0 12px">У каждого директора свои юрлица; сотрудники видят реквизиты
 для подстановки в документы. Налоговый режим юрлица подставляет НДС в «Итоги по КП».</p>
 ${canCreate?'<button class="btn primary" id="entNew" title="Добавить юрлицо"><svg class="i"><use href="#i-plus"/></svg><span class="lbl">Юрлицо</span></button>':''}
 <div id="entNewSlot"></div>
 ${list.map(entCardHTML).join('')||(window.UI?UI.empty({icon:'i-bank',title:'Юрлиц пока нет',
   text:'Первое понадобится, чтобы подставлять реквизиты в КП и закрывающие.'}):'')}
 </div>`;
 v.querySelectorAll('.ent-uadd').forEach(async sel=>{
  const users=await entUsers();const card=sel.closest('.ent-card');
  const ent=(ENT.list||[]).find(x=>String(x.id)===card.dataset.eid);
  const have=new Set((ent.members||[]).map(m=>String(m.user_id)));
  users.filter(u=>!have.has(String(u.user_id))).forEach(u=>{
   const o=document.createElement('option');o.value=u.user_id;
   o.textContent=(u.name||('@'+(u.username||u.user_id)))+(u.note?' · '+u.note:'')+(u.role_name?' · '+u.role_name:'');
   sel.appendChild(o);});});
}
// «От юрлица» в панели итогов КП: выпадашка + НДС из налогового режима
function entLineHTML(){const c=calcCfg();
 if(ENT.list===null&&!PUB&&!ENT.pickLoading){ENT.pickLoading=true;
  _authGet('entities').then(l=>{ENT.list=l;ENT.pickLoading=false;if($('#calcpanel')&&$('#calcpanel').innerHTML)renderCalcPanel();})
  .catch(()=>{ENT.list=[];ENT.pickLoading=false;});}
 const list=(ENT.list||[]).filter(e=>e.active);
 if(!list.length&&!c.entityName)return '';
 const opts=['<option value="">— не выбрано —</option>'].concat(list.map(e=>`<option value="${e.id}" ${String(c.entityId||'')===String(e.id)?'selected':''}>${esc(e.name)} · ${ENT_TAXN[e.tax_mode]||''}</option>`)).join('');
 // Выбор юрлица меняет НДС в смете — значит это правка, и без права её нет.
 return `<div class="cline"><span>От юрлица</span><span><select id="entPick"${canEdit()?'':' disabled'} style="padding:4px 6px;max-width:320px">${opts}</select></span></div>`;}
document.addEventListener('change',e=>{if(e.target.id!=='entPick')return;
 const id=e.target.value;const ent=(ENT.list||[]).find(x=>String(x.id)===String(id));
 setCalc('entityId',id);setCalc('entityName',ent?ent.name:'');
 setCalc('vatPct',ent&&ent.tax_mode==='usn'?0:VAT_DEFAULT);
 renderCalcPanel();updateCalcValues();updFoot();
 toast(ent?('От юрлица: '+ent.name+' · '+(ENT_TAXN[ent.tax_mode]||'')):'Юрлицо не выбрано');});

// Таблицы табеля — их переиспользует «Смена» (kp-03.js) для своего графика.
const rpH=v=>{v=Number(v||0);return v?(Math.round(v*100)/100).toLocaleString('ru-RU'):'';};
const rpWe=d=>d.weekday==='сб'||d.weekday==='вс';
function rpGrid(title,days,rows,subtitle){ if(!rows||!rows.length)return '';
  let totH=0,totS=0;
  const th=`<th class="nm">ФИО</th>`+days.map(d=>`<th class="${rpWe(d)?'we':''}">${d.day}<div class="wd">${d.weekday}</div></th>`).join('')+`<th>Всего</th><th>Ставка</th><th>Зарплата</th>`;
  const tr=rows.map(p=>{totH+=+p.total||0;totS+=+p.salary||0;
    return `<tr><td class="nm">${esc(p.name)}</td>`+days.map(d=>`<td class="${rpWe(d)?'we':''}">${rpH(p.per_day[String(d.day)])}</td>`).join('')
      +`<td><b>${rpH(p.total)}</b></td><td class="money">${money(p.rate)}</td><td class="money"><b>${money(p.salary)}</b></td></tr>`;}).join('');
  const foot=`<tr><td class="nm">Итого</td>${days.map(()=>'<td></td>').join('')}<td><b>${rpH(totH)}</b></td><td></td><td class="money"><b>${money(Math.round(totS*100)/100)} ₽</b></td></tr>`;
  return `<div class="sec">${esc(title)}${subtitle?` <span style="font-weight:400;color:var(--mut)">· ${subtitle}</span>`:''}</div>
    <div class="rptwrap"><table class="rpt"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody><tfoot>${foot}</tfoot></table></div>`;}
function rpTables(rep){
  const totHours=(rep.overall||[]).reduce((a,p)=>a+(+p.total||0),0);
  const totPay=(rep.overall||[]).reduce((a,p)=>a+(+p.salary||0),0);
  const people=(rep.overall||[]).length;
  const kc=(cls,ic,lb,val,dl)=>`<div class="k ${cls}"><div class="r">
      <div class="ic"><svg class="i"><use href="#${ic}"/></svg></div>
      <div style="min-width:0"><div class="lb">${lb}</div><div class="vl n">${val}</div>
      ${dl?`<div class="dl" style="color:var(--mut)">${dl}</div>`:''}</div></div></div>`;
  let html=`<div class="kp">
    ${kc('info','i-cal','Период',`<span class="txt">${esc(rep.month_name)} ${rep.year}</span>`,'')}
    ${kc('','i-clock','Норма часов',rep.norm_hours,'по производственному календарю')}
    ${kc('','i-usrs','Смен · людей',`${rep.shifts.length} · ${people}`,'')}
    ${kc('ok','i-clock','Всего часов',rpH(totHours)||0,'')}
    ${kc('warn','i-rub','ФОТ по окладам',`${money(Math.round(totPay*100)/100)} ₽`,'без премий и штрафов')}
  </div>`;
  if(!rep.shifts.length) return html+(window.UI?UI.empty({icon:'i-cal',
    title:`За ${esc(rep.month_name)} ${rep.year} смен нет`,
    text:'Выберите другой месяц — или дождитесь, пока закроется первая смена.'})
    :'<div class="pd sub">Смен нет</div>');
  html+=rpGrid('Общий график',rep.days,rep.overall,'все объекты');
  (rep.objects||[]).forEach((o,i)=>{html+=rpGrid((i+1)+'. '+o.name,rep.days,o.rows);});
  // Полный список выполненного идёт следом, но рисует его viewShiftLog:
  // в отчёте у смены нет снимков, а без них список не доказательство.
  return html;}
