(function(){
var B=window.__kp03a;
var SH=B.SH,boss=B.boss,geo=B.geo,hhmm=B.hhmm,hrs=B.hrs,loadLines=B.loadLines,
  loadApproved=B.loadApproved,loadPending=B.loadPending,money2=B.money2,myUid=B.myUid,
  objOnly=B.objOnly,phFree=B.phFree,phLoad=B.phLoad,qnum=B.qnum,sapi=B.sapi,since=B.since,
  dlTabel=B.dlTabel,
  viewMoney=B.viewMoney,viewObjects=B.viewObjects,viewReport=B.viewReport,
  viewSalary=B.viewSalary,viewShift=B.viewShift;
// ── Облако компании ──
// Фотографии смен уходят на диск СВОЕЙ компании. Директор подключает его сам
// и может отозвать доступ в любой момент — снимки его компании не должны
// лежать в чужом аккаунте.
// Два способа подключения: по ссылке согласия (Google, Яндекс) и паролем
// приложения (Mail.ru — публичного OAuth у их Облака нет).
function viewCloud(){
  if(SH.cloud===null)return '<div class="sub" style="padding:12px">Загрузка…</div>';
  var c=SH.cloud||{}, provs=c.providers||[];
  var h='';
  if(SH.err)h+='<div class="speccard" style="border-color:var(--red)"><div>'+esc(SH.err)+'</div></div>';

  if(c.connected){
    var cur=provs.filter(function(p){return p.id===c.provider;})[0]||{};
    return h+'<div class="speccard" style="flex-direction:column;align-items:stretch;gap:8px">'
      +'<div style="font-weight:600">'+esc(c.provider_name||'Облако')+' подключён</div>'
      +(c.account_email?'<div class="s">Аккаунт: '+esc(c.account_email)+'</div>':'')
      +(c.connected_at?'<div class="s">Подключено '+esc(c.connected_at)+'</div>':'')
      // Адрес папки приходит от провайдера облака и попадает прямо в href.
      // Экранирование от «javascript:…» не спасает — нужен разбор схемы,
      // поэтому прогоняем через тот же safeUrl, что и ссылки на магазины.
      +(safeUrl(c.folder_url)?'<div class="s"><a href="'+esc(safeUrl(c.folder_url))+'" target="_blank" rel="noopener">Открыть папку с объектами</a></div>':'')
      +(cur.public_links===false?'<div class="s">Ссылки на снимки открываются только со входом в это облако — '
        +'отправить их заказчику напрямую не получится.</div>':'')
      +(c.last_error?'<div class="s" style="color:var(--red)">Последняя ошибка: '+esc(c.last_error)+'</div>':'')
      +'<div class="bar" style="margin:6px 0 0">'
      +  '<button class="btn sm danger" data-act="sh-cloudoff">Отозвать доступ</button></div>'
      +'<div class="s">Уже загруженные фотографии останутся на вашем диске — они ваши.</div>'
      +'</div>'+viewDocs();
  }

  h+='<div class="speccard" style="flex-direction:column;align-items:stretch;gap:6px">'
   +'<div style="font-weight:600">Облако не подключено</div>'
   +'<div class="s">Пока не подключено, фотографии смен не сохраняются, и требование '
   +'фото при закрытии смены не применяется — чтобы исполнители могли работать.</div>'
   +'<div class="s">Приложение получит доступ только к папкам, которые создаст само.</div>'
   +'</div>';

  provs.forEach(function(p){
    h+='<div class="speccard" style="flex-direction:column;align-items:stretch;gap:8px">'
      +'<div style="font-weight:600">'+esc(p.name)+'</div>';
    if(!p.ready){
      h+='<div class="s">Не настроено на сервере — это разовая настройка администратора.</div>';
    }else if(p.kind==='oauth'){
      h+='<div class="s">Вход в аккаунт, подтверждение доступа. Отзывается в один клик.</div>'
        +'<div class="bar" style="margin:0"><button class="btn primary" data-act="sh-cloudon" '
        +'data-p="'+esc(p.id)+'" style="height:42px">Подключить</button></div>';
    }else{
      // Пароль приложения — не пароль от почты. Разница принципиальная,
      // поэтому проговариваем прямо в форме.
      h+='<div class="s">Нужен <b>пароль для внешних приложений</b>, не пароль от почты. '
        +esc(p.help||'')+'</div>'
        +'<div class="bar" style="margin:0">'
        +'<input class="f" id="cl_login" placeholder="адрес почты" autocomplete="off" '
        +'style="flex:1;text-align:left;height:38px">'
        +'<input class="f" id="cl_pass" type="password" placeholder="пароль приложения" '
        +'autocomplete="new-password" style="flex:1;text-align:left;height:38px">'
        +'<button class="btn primary" data-act="sh-cloudpass" data-p="'+esc(p.id)+'" '
        +'style="height:38px">Подключить</button></div>';
    }
    if(p.public_links===false){
      h+='<div class="s">Ссылку на снимок нельзя открыть без входа в это облако.</div>';
    }
    h+='</div>';
  });
  return h+viewDocs();
}

// Документы сделки (#559): Google Диск, на котором лежат папки сделок
// «Документы amoCRM / Клиенты». Это не облако фотоотчётов — подключение
// своё и отзывается отдельно. Пробный документ проверяет всю цепочку:
// шаблон → папка сделки → Google-документ.
function viewDocs(){
  var d=SH.docs;
  if(!d)return SH.docsErr?'<div class="speccard" style="border-color:var(--red)"><div>'+esc(SH.docsErr)+'</div></div>':'';
  var h='<div class="speccard" style="flex-direction:column;align-items:stretch;gap:8px">'
    +'<div style="font-weight:600">Документы сделок · Google Диск</div>';
  if(!d.connected){
    if(!d.server_ready)return h+'<div class="s">Не настроено на сервере — это разовая настройка администратора.</div></div>';
    return h+'<div class="s">Войдите в аккаунт, где лежит папка «Документы amoCRM», и оставьте галочку «Диск».</div>'
      +'<div class="bar" style="margin:0"><button class="btn primary" data-act="sh-docson" style="height:42px">Подключить</button></div></div>';
  }
  h+=(d.account_email?'<div class="s">Аккаунт: '+esc(d.account_email)+'</div>':'')
    +(d.connected_at?'<div class="s">Подключено '+esc(d.connected_at)+'</div>':'')
    +(d.last_error?'<div class="s" style="color:var(--red)">Последняя ошибка: '+esc(d.last_error)+'</div>':'');
  if(SH.docsErr)h+='<div class="s" style="color:var(--red)">'+esc(SH.docsErr)+'</div>';
  var tp=SH.docsTpl||[];
  if(tp.length){
    h+='<div class="s">Пробный документ</div>';
    // Сделка — поиском по amoCRM; без ключа amoCRM на сервере — руками.
    if(d.crm_ready){
      var dl=SH.docsDeals||[];
      h+='<input class="f" id="dd_q" value="'+esc(SH.docsQ||'')+'" placeholder="№ или название сделки в amoCRM" style="text-align:left;height:38px">'
        +'<select id="dd_deal" class="f" style="height:38px">'
        +(dl.length?dl.map(function(x){
            return '<option value="'+x.id+'"'+(String(x.id)===String(SH.docsPick)?' selected':'')+'>№'+x.id+' · '+esc(x.name||'без названия')+(x.stage?' · '+esc(x.stage):'')+'</option>';}).join('')
          :'<option value="">'+(SH.docsQ?(SH.docsDeals?'Сделка не найдена':'Ищу…'):'Сначала найдите сделку')+'</option>')
        +'</select>'
        +'<div class="s" id="dd_open"'+(docsDealUrl()?'':' hidden')+'><a class="lk" href="'+esc(docsDealUrl())+'" target="_blank" rel="noopener">Открыть в amoCRM</a></div>';
    }
    h+='<div class="bar" style="margin:0;flex-wrap:wrap">'
      +'<select id="dd_tpl" class="f" style="flex:1;min-width:0;height:38px">'
      +tp.map(function(t){return '<option value="'+esc(t.id)+'"'+(t.id===SH.docsTplPick?' selected':'')+'>'+esc(t.name)+'</option>';}).join('')
      +'</select>'
      +(d.crm_ready?'':'<input class="f" id="dd_id" inputmode="numeric" placeholder="№ сделки" style="width:110px;height:38px">'
        +'<input class="f" id="dd_name" placeholder="название сделки" style="flex:1;min-width:140px;text-align:left;height:38px">')
      +'<button class="btn primary" data-act="sh-docstrial" style="height:38px">Создать</button></div>';
    if(!d.crm_ready)h+='<div class="hint">amoCRM не подключена на сервере: номер вводится руками, ссылка в сделку не пишется.</div>';
  }
  var L=SH.docsLast;
  if(L){
    h+='<div class="s">'+(safeUrl(L.doc_url)?'<a href="'+esc(safeUrl(L.doc_url))+'" target="_blank" rel="noopener">'+esc(L.doc_name||'Документ')+'</a>':esc(L.doc_name||''))
      +(safeUrl(L.folder_url)?' · <a href="'+esc(safeUrl(L.folder_url))+'" target="_blank" rel="noopener">'+esc(L.folder_name||'Папка сделки')+'</a>':'')+'</div>'
      +(L.crm_linked?'<div class="s">Ссылка на папку записана в поле сделки «app.gasbase.ru»</div>'
        :L.crm_error?'<div class="s" style="color:var(--red)">Документ создан, но ссылку в amoCRM записать не удалось: '+esc(L.crm_error)+'</div>':'');
  }
  return h+'<div class="bar" style="margin:6px 0 0"><button class="btn sm danger" data-act="sh-docsoff">Отозвать доступ</button></div></div>';
}

function renderShift(){
  var v=document.getElementById('shiftView'); if(!v)return;
  // Освобождаем прежние blob-ссылки ДО замены разметки: после innerHTML старые
  // <img> уже недостижимы, и отпустить их будет некому.
  phFree();
  // «План» и «Сверх сметы» — блок kp-11: визуальная отметка объёма по плану
  // из рабочки и допработы с выпуском акта. Табличная отметка объёма никуда
  // не делась — обе пишут в одну таблицу фактов и потому не расходятся.
  // Табель целиком — вкладкой у обоих. У исполнителя это «Мой табель»: раздел
  // «Отчёты» ему закрыт (payroll:read). У руководителя раздела «Отчёты» тоже
  // нет — он снят вместе с зеркалом TimeBot, — а месяц, юрлицо и выгрузка
  // живут именно там, и карточка на экране смены их не заменяет.
  var tabs=boss()?[['shift','Смена'],['plan','План'],['extra','Сверх сметы'],
                   ['list','Табель'],['sal','Оклады'],['obj','Объекты'],['cloud','Облако']]
            :objOnly()?[['obj','Объекты']]
                 :[['shift','Смена'],['plan','План'],['extra','Сверх сметы'],
                   ['money','Мои деньги'],['list','Мой табель'],['calc','Расчёты']];
  // «Расчёты» — инженерные калькуляторы по СП 485 (kp-13). У исполнителя, а не
  // у руководителя: масса ГОТВ и проём сброса нужны тому, кто стоит на объекте.
  // Заявка на материалы — здесь же, а не отдельным разделом: исполнителю на
  // телефоне нужен один раздел, и статус поставки он смотрит там, где работает.
  if(can('supply:request'))tabs.splice(3,0,['mat','Материалы']);
  var TICO={shift:'i-pin',plan:'i-map',extra:'i-flag',money:'i-rub',list:'i-rep',
            sal:'i-rub',obj:'i-bld',cloud:'i-cam',mat:'i-cart',calc:'i-calc'};
  // Вкладки раздела — это перемещение, а не действие. Красная кнопка на экране
  // должна быть одна и означать «сделать» (И3): здесь это «Начать» и
  // «Завершить работу». Раньше активная вкладка тоже была красной.
  var head='<div class="ph"><div><h1>Смена</h1>'
    +'<p>Начало и конец работы с геометкой, снимки с объекта, объёмы, '
    +'заявки на материалы, табель и расчёты по СП 485</p></div></div>'
    +'<div class="stabs">'+tabs.map(function(t){
      return '<button class="stab'+(SH.sub===t[0]?' on':'')+'" data-act="sh-tab" data-t="'+t[0]+'"'
        +' title="'+t[1]+'"><svg class="i"><use href="#'+(TICO[t[0]]||'i-list')+'"/></svg>'
        +'<span class="lbl">'+t[1]+'</span></button>';
    }).join('')+'</div>';
  var noTab='<div class="sub" style="padding:12px">Вкладка не открылась, сохраненное на месте. Обновите страницу.</div>';
  var body = SH.sub==='shift'?viewShift() : SH.sub==='list'?viewReport()
           : SH.sub==='money'?viewMoney()
           : SH.sub==='plan'?(window.MPLAN?MPLAN.view():noTab)
           : SH.sub==='extra'?(window.MEXTRA?MEXTRA.view():noTab)
           : SH.sub==='mat'?(window.SUPMAT?SUPMAT.view():noTab)
           : SH.sub==='calc'?(window.MCALC?MCALC.view():noTab)
           : SH.sub==='obj'?viewObjects() : SH.sub==='cloud'?viewCloud() : viewSalary();
  v.innerHTML=head+body;
  phLoad(v);        // миниатюры подтягиваем после отрисовки, каждую своим запросом
}
// kp-11 (план и сверх сметы) перерисовывает раздел после своих загрузок.
window.renderShift=renderShift;

// ── Загрузка данных ──
async function loadCurrent(){try{var d=await sapi('/shift/current');SH.current=d.shift;SH.err='';}
  catch(e){SH.current=null;SH.err=e.message;}
  renderShift();
  // План монтажа встроен в экран смены — тянем его для объекта этой смены.
  if(SH.current&&window.MPLAN)
    MPLAN.load({object_uid:SH.current.object_uid,title:SH.current.object_name});}
async function loadObjects(){SH.objects=null;renderShift();
  try{SH.objects=await sapi('/shift/objects'+(SH.q?('?search='+encodeURIComponent(SH.q)):''));}
  catch(e){SH.objects=[];SH.err=e.message;}renderShift();}
// Юрлица нужны почти каждому экрану раздела — тянем один раз за сессию.
async function loadEntities(){
  if(SH.ents!==null)return SH.ents;
  try{SH.ents=await sapi('/shift/entities');}catch(e){SH.ents=[];}
  return SH.ents;}
async function loadSalary(){
  await loadEntities();
  try{SH.salary=await sapi('/shift/salary');}catch(e){SH.salary=[];SH.err=e.message;}
  // /shift/staff вместо /executors: тот ходит по общему токену и про
  // работодателя ничего не знает, а здесь он и нужен.
  try{SH.staff=await sapi('/shift/staff');}
  catch(e){if(!SH.staff){try{SH.staff=await sapi('/executors');}catch(e2){SH.staff=[];}}}
  try{SH.adjust=await sapi('/shift/adjust');}catch(e){SH.adjust=[];}
  renderShift();}
async function loadObjectsAdmin(){SH.objs=null;renderShift();
  await loadEntities();
  await loadStaff();
  try{SH.objs=await sapi('/shift/admin/objects');}catch(e){SH.objs=[];SH.err=e.message;}
  renderShift();}
// Сотрудники компании — для выбора куратора и исполнителя на карточке
// объекта (#59). Тот же справочник, что и на вкладке «Оклады», кэшируем один
// раз за сессию, чтобы не дёргать ручку при каждом разворачивании карточки.
async function loadStaff(){
  if(SH.staff)return SH.staff;
  try{SH.staff=await sapi('/shift/staff');}
  catch(e){try{SH.staff=await sapi('/executors');}catch(e2){SH.staff=[];}}
  return SH.staff;}
async function loadCloud(){SH.cloud=null;renderShift();
  try{SH.cloud=await sapi('/shift/storage');SH.err='';}
  catch(e){SH.cloud={};SH.err=e.message;}
  // Диск документов — второй запрос: его сбой не должен прятать облако фото.
  SH.docsTpl=null; SH.docsErr='';
  try{SH.docs=await sapi('/deal-docs/google');
      if(SH.docs.connected)SH.docsTpl=(await sapi('/deal-docs/templates')).templates;}
  catch(e){SH.docsErr=e.message;}
  renderShift();}
// Ссылка на выбранную сделку в amoCRM (#588): адрес даёт сервер, проверка — общая.
function docsDealUrl(){
  var d=(SH.docsDeals||[]).filter(function(x){return String(x.id)===String(SH.docsPick);})[0];
  return d?safeUrl(d.url)||'':'';}
// Сделки amoCRM для пробного документа. Ответ на устаревший запрос
// отбрасывается: пока он шёл, в поле уже дописали буквы.
async function loadDeals(){
  var q=SH.docsQ, tp=document.getElementById('dd_tpl');
  if(tp)SH.docsTplPick=tp.value;
  SH.docsDeals=q?null:[]; SH.docsPick=null; keepFocus(renderShift);
  if(!q)return;
  try{var r=await sapi('/deal-docs/deals?q='+encodeURIComponent(q));
      if(q!==SH.docsQ)return;
      SH.docsDeals=r.deals||[]; SH.docsErr='';
      SH.docsPick=SH.docsDeals.length?SH.docsDeals[0].id:null;}
  catch(e){if(q!==SH.docsQ)return; SH.docsDeals=[]; SH.docsErr=e.message;}
  keepFocus(renderShift);}
// «Мои деньги». Период не вычисляем на клиенте: границу с 11-го числа знает
// сервер, и вторая её копия в браузере разошлась бы с первой на смене месяца.
async function loadMoney(){
  SH.money=null; renderShift();
  var flt=(SH.mYear&&SH.mMonth)?('?year='+SH.mYear+'&month='+SH.mMonth):'';
  try{SH.money=await sapi('/shift/money'+flt); SH.err='';
      SH.mYear=SH.money.period.year; SH.mMonth=SH.money.period.month;}
  catch(e){SH.money=false; SH.err=e.message;}
  renderShift();}
async function loadReport(){SH.report=null;SH.slist=null;renderShift();
  await loadEntities();
  var flt='?year='+SH.year+'&month='+SH.month
        +(SH.entFilter?('&entity_id='+encodeURIComponent(SH.entFilter)):'');
  // Период меняется прямо выбором: ответ на прежний выбор, пришедший позже,
  // не должен подменить табель выбранного месяца.
  SH.repQ=flt;
  var rep, sl;
  try{rep=await sapi('/shift/report'+flt);}
  catch(e){rep=false;if(SH.repQ===flt)SH.err=e.message;}
  // Список смен — отдельная ручка: в отчёте для табеля снимков нет, только
  // их количество. Отказ по нему не должен прятать сам табель.
  try{sl=await sapi('/shift/list'+flt);}catch(e){sl=false;}
  if(SH.repQ!==flt)return;
  SH.report=rep; SH.slist=sl;
  renderShift();}

// ── Регистрация раздела ──
function ensureShiftView(){
  var v=document.getElementById('shiftView'); if(v)return v;
  v=document.createElement('div'); v.id='shiftView'; v.style.display='none';
  // Разделы живут внутри .main: там поля страницы. Раньше вешали на .wrap —
  // раздел ложился вплотную к краю экрана и к шапке.
  var w=document.querySelector('.main')||document.querySelector('.wrap')||document.body;
  w.appendChild(v); return v;
}

var _go=window.go;
window.go=function(view){
  var v=document.getElementById('shiftView'); if(v)v.style.display='none';
  if(view==='shift'){
    ensureShiftView();
    // Раньше здесь был список разделов поимённо, и Главная в него не попала —
    // «Смена» открывалась поверх неё, обе видны одновременно.
    hideViewsExcept('shiftView');
    var sv=document.getElementById('shiftView'); sv.style.display='';
    var on=document.getElementById('objname'); if(on)on.textContent='Смена';
    // подсветка активного пункта — иначе красным остаётся «Монтаж»
    document.querySelectorAll('.nav[data-go]').forEach(function(n){
      n.classList.toggle('act', n.dataset.go==='shift');});
    if(typeof drawer==='function'){try{drawer(false)}catch(e){}}
    var dr=document.querySelector('.drawer'); if(dr)dr.classList.remove('open');
    var ov=document.querySelector('.ov'); if(ov)ov.classList.remove('show');
    if(objOnly()){
      // Своей смены у него нет — грузить /shift/current и табель незачем,
      // и вкладки «Смена»/«Оклады» ему всё равно не видны.
      SH.sub='obj'; renderShift(); loadObjectsAdmin();
      return;
    }
    SH.sub='shift'; SH.current=undefined; SH.objects=null; SH.volOpen=false; renderShift();
    loadCurrent().then(loadObjects);
    if(SH.report===false)loadReport();
    return;
  }
  if(typeof _go==='function')return _go(view);
};

// Заголовки вкладок внутри раздела не должны конфликтовать со стилем кнопок:
// используем те же .btn/.btn.primary, что и в остальном приложении.
/* Стили раздела перенесены в css/kp.css. Вставленные скриптом они
   не знали про вечернюю тему: в них жёстко стояли белый и светло-серый,
   и половина раздела оставалась белой при тёмном фоне. */

// ── Поиск по вводу ───────────────────────────────────────────────────
// Кнопки «Найти» убраны (И0): поиск работает по вводу. Список
// перерисовывается целиком, поэтому место в поле возвращаем руками —
// иначе после каждой буквы каретка улетала в начало, а на телефоне
// закрывалась клавиатура.
function keepFocus(fn){
  var el=document.activeElement, id=el&&el.id;
  var pos=null; try{pos=el&&el.selectionStart;}catch(e){}
  fn();
  if(!id)return;
  var n=document.getElementById(id); if(!n)return;
  try{n.focus({preventScroll:true});}catch(e){try{n.focus()}catch(e2){}}
  if(pos!=null){try{n.setSelectionRange(pos,pos)}catch(e){}}
}
// Отказ действия — под нажатой кнопкой, без перерисовки раздела: шапку
// раздела с места нажатия не видно, а перерисовка сбрасывает прокрутку,
// введенное количество и выбранные фото. Прежний отказ убираем, чтобы под
// разными кнопками не копились устаревшие.
function failAt(el,msg){
  el.disabled=false;
  [].forEach.call(document.querySelectorAll('#shiftView .errbox[data-at]'),function(b){b.remove();});
  if(!el.isConnected){SH.err=msg; renderShift(); return;}
  var box=document.createElement('div');
  box.className='errbox'; box.setAttribute('data-at',''); box.setAttribute('role','alert');
  box.style.margin='6px 0'; box.textContent=msg;
  (el.closest('.phrow')||el.parentElement).insertAdjacentElement('afterend',box);
}
var _findT=null;
document.addEventListener('input',function(ev){
  var t=ev.target; if(!t||!t.id)return;
  if(t.id==='dd_deal'){SH.docsPick=+t.value;
    var op=document.getElementById('dd_open'), u=docsDealUrl();
    if(op){op.hidden=!u;op.firstChild.href=u;}
    return;}
  if(t.id==='dd_tpl'){SH.docsTplPick=t.value;return;}
  if(t.id==='dd_q'){
    SH.docsQ=t.value.trim(); clearTimeout(_findT);
    _findT=setTimeout(loadDeals,380); return;}
  if(t.id!=='shSearch'&&t.id!=='objSearch'&&t.id!=='empSearch')return;
  var id=t.id, val=t.value.trim();
  clearTimeout(_findT);
  _findT=setTimeout(function(){
    if(id==='shSearch'){ SH.q=val; loadObjects().then(function(){keepFocus(function(){});}); return; }
    if(id==='objSearch'){ SH.objQ=val; SH.objOpen=null; keepFocus(renderShift); return; }
    if(id==='empSearch'){ SH.empQ=val; SH.empOpen=null; keepFocus(renderShift); return; }
  }, id==='shSearch'?380:180);
});

// Закрытие смены. Вынесено из обработчика: его теперь зовёт окно
// подтверждения, а на случай, если слой интерфейса не поднялся, —
// прямой вызов.
async function stopShift(note,nogeo){
  if(SH.busy)return;
  SH.busy=true;
  if(typeof busy==='function')busy(true,'Закрываю смену…');
  try{
    var g2=nogeo?null:await geo();
    var r=await sapi('/shift/stop',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({lat:g2?g2.lat:null,lon:g2?g2.lon:null,
        accuracy_m:g2?g2.accuracy_m:null,note:note||null})});
    SH.err=''; SH.current=null; SH.report=false; SH.volOpen=false; SH.lines=undefined;
    if(typeof toast==='function'){
      var msg='Смена закрыта · '+hrs(r.hours)+' ч ушли в табель';
      // Без фото часы в табеле есть, а в зарплату не идут — предупреждаем
      // сразу, а не оставляем узнавать из ведомости в конце месяца.
      if(r.photo_excluded)msg+=', но не в зарплату — третья подряд смена без фото на объекте';
      toast(msg);
    }
    SH.geo=null; renderShift(); await loadObjects(); loadReport();
  }catch(e){
    if(e.geo)SH.geo={on:'stop',note:note||null,code:e.code,msg:e.message}; else SH.err=e.message;
    renderShift(); }
  finally{ SH.busy=false; if(typeof busy==='function')busy(false); }
}

/* Снимки смены. По одному запросу на файл: пачка параллельных запросов
   с объекта на плохой связи гибнет вся разом. Зовут и поле «Добавить фото»
   на карточке, и первая ступень закрытия смены. */
async function upShiftPhotos(list,late){
  var g=null; try{g=await geo();}catch(e){}
  var okN=0;
  for(var i=0;i<list.length;i++){
    if(typeof toast==='function')toast('Загружаю фото '+(i+1)+' из '+list.length+'…');
    try{
      var fd=new FormData(); fd.append('file',list[i]);
      if(g){fd.append('lat',g.lat); fd.append('lon',g.lon);}
      var r=await sapi('/shift/photo',{method:'POST',body:fd});
      okN++;
      SH.err='';
      if(SH.current){SH.current.photos=r.photos;
        SH.current.files=(SH.current.files||[]).concat([{url:r.url,name:'',at:new Date().toISOString()}]);}
      // Фото задним числом уходит на самую свежую закрытую смену — ровно
      // ту, что стоит в SH.slist[0] (см. viewShiftLog).
      else if(late&&SH.slist&&SH.slist[0]){
        SH.slist[0].photos=r.photos;
        SH.slist[0].files=(SH.slist[0].files||[]).concat([{url:r.url,name:'',at:new Date().toISOString()}]);
      }
    }catch(e){SH.err=e.message;}
  }
  renderShift();
  if(typeof toast==='function')
    toast(okN===list.length?('Фото загружены: '+okN):('Загружено '+okN+' из '+list.length+' — '+(SH.err||'')));
  return okN;
}

// Закрытие смены идёт двумя окнами: сначала необязательный снимок, потом
// примечание. Снимок в конце дня — тот, ради которого смену и открывали, а
// вспоминать о нём приходилось до нажатия «Закрыть», и его не прикладывали.
function askClosePhoto(){
  var cc=SH.current||{};
  UI.modal({
    title:'Приложить фото',
    sub:'Необязательно. Снимок можно приложить и после закрытия — в течение 3 часов.',
    body:'<div class="fcell wide"><div class="flab">Фото с объекта — из галереи '
        +'или с камеры, несколько</div>'
        +'<input class="fin" type="file" id="shClosePh" accept="image/*" multiple>'
        +'<div class="fnote">'+(cc.photos?('За смену уже загружено: '+cc.photos+'.')
          :'За смену не загружено ни одного.')+'</div></div>',
    ok:'Далее', okIcon:'i-right', cancel:'Отмена',
    onOk:function(w){
      var f=w.querySelector('#shClosePh');
      var list=(f&&f.files)?[].slice.call(f.files):[];
      if(!list.length){setTimeout(askCloseNote,0);return;}
      return upShiftPhotos(list,false).then(function(){setTimeout(askCloseNote,0);});
    }
  });
}
function askCloseNote(){
  var cc=SH.current||{};
  UI.modal({
    title:'Закрыть смену',
    sub:'Объект «'+esc(cc.object_name||'')+'». Смена идёт с '+hhmm(cc.started_at)
        +', уже '+since(cc.started_at)+'. Часы уйдут в табель и в расчёт зарплаты.',
    body:'<div class="fcell wide"><div class="flab">Примечание к смене</div>'
        +'<input class="fin" id="shNote" placeholder="Что сделано, что осталось — необязательно">'
        +'<div class="fnote">Видно в журнале смен и в табеле.</div></div>'
        +(cc.photos?''
          :'<div class="fnote warn" style="margin-top:12px">Ни одной фотографии не '
           +'загружено. Смена всё равно закроется — снимок ещё можно приложить '
           +'в течение 3 часов после закрытия. Но если это уже третья подряд смена '
           +'без фото на этом объекте, её часы не войдут в расчёт зарплаты.</div>'),
    ok:'Закрыть смену', okIcon:'i-ok',
    onOk:function(w){
      var n=w.querySelector('#shNote');
      stopShift(n?n.value:'');
    }
  });
}

// Открытие смены. Вынесено из обработчика по той же причине: его зовёт
// и «Начать», и «Определить снова» после отказа геометки.
async function startShift(uid,el,nogeo){
  if(SH.busy)return; SH.busy=true;
  if(el){el.disabled=true; (el.querySelector('.lbl')||el).textContent=nogeo?'Открываю…':'Определяю…';}
  try{
    // Отсутствие рабочей документации старт не блокирует (решение владельца
    // 23.08, отменяет ограничение от 18.08): не всякая смена связана с
    // монтажом позиций, план может появиться позже. Предупреждаем один раз
    // на объект, чтобы не спрашивать при каждом открытии смены.
    try{
      var _pl=await sapi('/plans?object_uid='+encodeURIComponent(uid));
      if(_pl&&_pl.plans&&!_pl.plans.length){
        var _nk='fse_noplans_seen_'+uid;
        if(!localStorage.getItem(_nk)){
          try{localStorage.setItem(_nk,'1')}catch(e2){}
          if(typeof toast==='function')
            toast('По объекту нет рабочей документации — планов монтажа. Смена откроется, объёмы можно будет отметить позже.');
        }
      }
    }catch(ePl){}
    var g=nogeo?null:await geo();
    await sapi('/shift/start',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({object_uid:uid,lat:g?g.lat:null,lon:g?g.lon:null,
        accuracy_m:g?g.accuracy_m:null})});
    SH.err=''; SH.geo=null; SH.current=undefined; renderShift(); await loadCurrent();
  }catch(e){
    if(e.geo)SH.geo={on:'start',uid:uid,code:e.code,msg:e.message}; else SH.err=e.message;
    renderShift();}
  finally{SH.busy=false;}
}

// ── События ──
document.addEventListener('click',async function(ev){
  var el=ev.target.closest('[data-act]'); if(!el)return;
  var a=el.dataset.act;

  if(a==='sh-tab'){SH.sub=el.dataset.t; SH.geo=null; renderShift();
    if(SH.sub==='list')loadReport();
    if(SH.sub==='money')loadMoney();
    if(SH.sub==='sal'&&SH.salary===null)loadSalary();
    if(SH.sub==='obj')loadObjectsAdmin();
    if(SH.sub==='cloud')loadCloud();
    if(SH.sub==='plan'&&window.MPLAN)MPLAN.load();
    if(SH.sub==='extra'&&window.MEXTRA)MEXTRA.load();
    if(SH.sub==='mat'&&window.SUPMAT)SUPMAT.load();
    if(SH.sub==='shift'){SH.current=undefined;renderShift();
      loadCurrent().then(loadObjects);
      // Табель нужен правой карточке экрана смены — тянем его сразу.
      if(SH.report===false)loadReport();}
    return;}

  if(a==='sh-find'){
    var qi=document.getElementById('shSearch'); SH.q=qi?qi.value.trim():'';
    loadObjects(); return;}

  if(a==='sh-xlsx'){await dlTabel(el.dataset.p,el); return;}

  // Работодатель сотрудника. Уже закрытые смены не переписываем — в них лежит
  // снимок на момент работы, и вчерашняя ведомость от перевода не двигается.
  if(a==='sh-emplset'){
    var etid=el.dataset.tid, esel=document.getElementById('emp_ent');
    el.disabled=true;
    try{
      await sapi('/shift/employer',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({user_id:+etid,entity_id:(esel&&esel.value)?+esel.value:null})});
      SH.err=''; SH.report=false; loadSalary();
      if(typeof toast==='function')toast('Работодатель закреплён');
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-obj'){
    var wasOpen=String(SH.objOpen)===String(el.dataset.uid);
    SH.objOpen = wasOpen ? null : el.dataset.uid;
    SH.splitDraft=null; SH.splitNote='';
    renderShift();
    if(!wasOpen){
      var oo=(SH.objs||[]).filter(function(x){return String(x.uid)===String(el.dataset.uid);})[0];
      SH.pending=SH.pending||{};
      if(oo&&String(oo.curator_id)===String(myUid())&&SH.pending[oo.uid]===undefined)
        loadPending(oo.uid);
      SH.approved=SH.approved||{};
      if(can('object:meta')&&SH.approved[el.dataset.uid]===undefined)
        loadApproved(el.dataset.uid);
      // Доступы партнёра — по одному объекту за раз: карточка открыта одна (#63).
      if(can('partner:manage')&&window.PARTNER)PARTNER.load(el.dataset.uid);
    }
    return;}

  if(a==='sh-objapprove'){
    var apUid=el.dataset.uid, apFid=el.dataset.fid;
    // Подтверждение необратимо и превращает объём в деньги (#173): промах
    // пальцем по кнопке в списке принимал чужую работу. Окно называет
    // позицию, исполнителя и сумму — ту же, что потом увидит исполнитель.
    var apItem=((SH.pending&&SH.pending[apUid])||[]).filter(function(x){
      return String(x.id)===String(apFid);})[0]||{};
    var apObj=(SH.objs||[]).filter(function(x){return String(x.uid)===String(apUid);})[0]||{};
    SH.pendNote=SH.pendNote||{};
    // Своя отметка при выключенном самоподтверждении: сервер ответит 403,
    // и говорить это надо до окна и под самой отметкой (#259), а не в шапке
    // раздела, которую куратор с карточки объекта не видит.
    if(apItem.self_marked&&!apObj.self_confirm){
      SH.pendNote[apFid]='Это ваша собственная отметка, а самоподтверждение у объекта выключено. '
        +'Поставьте галочку «Самоподтверждение» выше и сохраните куратора — или пусть подтвердит другой куратор.';
      renderShift(); return;
    }
    delete SH.pendNote[apFid];
    var apWho=apItem.self_marked?'Ваша собственная отметка':(apItem.executor_name||'Исполнитель');
    var apVol=qnum(apItem.qty)+' '+(apItem.unit||'шт');
    if(apItem.amount!=null){
      apVol+=' × '+money2(apItem.rate);
      if(apItem.coef!=null&&Math.abs(apItem.coef-1)>1e-9)apVol+=' × '+String(apItem.coef).replace('.',',');
      apVol+=' = '+money2(apItem.amount);
    }
    var apOk=(window.UI&&UI.confirm)
      ? await UI.confirm({title:'Подтвердить объём?',
          sub:apItem.row_name||'',
          text:apWho+' · '+apVol,
          warn:apItem.amount!=null
            ? 'После подтверждения сумма идёт в начисление исполнителю. Вернуть отметку будет нельзя.'
            : 'Цена монтажа по этой позиции в смете не задана: объём примется, а денег по нему будет ноль. Вернуть отметку будет нельзя.',
          ok:'Подтвердить',okIcon:'i-ok'})
      : confirm('Подтвердить объём? '+(apItem.row_name||'')+' — '+apWho+' · '+apVol);
    if(!apOk)return;
    el.disabled=true;
    try{
      await sapi('/install/'+apFid+'/approve',{method:'POST'});
      SH.err='';
      if(typeof toast==='function')toast('Подтверждено');
      loadPending(apUid);
    }catch(e){SH.pendNote[apFid]=e.message; el.disabled=false; renderShift();}
    return;}

  if(a==='sh-objcancel'){
    // Отмена забирает у исполнителя деньги, которые он уже видит принятыми:
    // окно называет позицию, исполнителя и сумму — ту же, что он видит сам.
    var cnUid=el.dataset.uid, cnFid=el.dataset.fid;
    var cnItem=(((SH.approved&&SH.approved[cnUid])||{}).items||[]).filter(function(x){
      return String(x.id)===String(cnFid);})[0]||{};
    SH.apprNote=SH.apprNote||{}; delete SH.apprNote[cnFid];
    var cnVol=qnum(cnItem.qty)+' '+(cnItem.unit||'шт')
      +(cnItem.amount!=null?(' = '+money2(cnItem.amount)):'');
    var cnOk=(window.UI&&UI.confirm)
      ? await UI.confirm({title:'Отменить принятую отметку?',
          sub:cnItem.row_name||'',
          text:(cnItem.executor_name||'Исполнитель')+' · '+cnVol,
          warn:'Объём перестанет учитываться, сумма уйдёт из начисления исполнителя. '
              +'Снять отмену нельзя — исправленный объём отмечается заново.',
          ok:'Отменить отметку',okIcon:'i-trash'})
      : confirm('Отменить принятую отметку? '+(cnItem.row_name||'')+' — '+cnVol);
    if(!cnOk)return;
    el.disabled=true;
    try{
      await sapi('/install/'+cnFid+'/cancel',{method:'POST'});
      SH.err='';
      if(typeof toast==='function')toast('Отметка отменена');
      loadApproved(cnUid);
    }catch(e){SH.apprNote[cnFid]=e.message; el.disabled=false; renderShift();}
    return;}

  if(a==='sh-objreturn'){
    // Причина обязательна: окно не закрывается, пока сервер не принял
    // возврат, — отказ остаётся в окне вместе с набранным текстом.
    var rtUid=el.dataset.uid, rtFid=el.dataset.fid;
    if(!(window.UI&&UI.modal)){failAt(el,'Окно возврата недоступно — обновите страницу.');return;}
    var rtWin=UI.modal({narrow:true,title:'Вернуть отметку',
      sub:'Исполнитель увидит причину в «Моих деньгах» и отметит объём заново',
      body:'<div class="fcell wide"><textarea class="fin" id="rtReason" rows="3" maxlength="500" '
        +'placeholder="Что исправить: нет снимка, объём больше сделанного, не та позиция…"></textarea></div>',
      ok:'Вернуть',okIcon:'i-left',
      onOk:function(w){
        var ta=w.querySelector('#rtReason'), reason=(ta&&ta.value||'').trim();
        if(!reason){rtWin.error('Укажите причину — без неё исполнитель не поймёт, что исправить'); if(ta)ta.focus(); return false;}
        return sapi('/install/'+rtFid+'/return',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({reason:reason})})
          .then(function(){SH.err=''; if(typeof toast==='function')toast('Возвращено исполнителю'); loadPending(rtUid);});
      }});
    return;}

  if(a==='sh-objfind'){
    var oi=document.getElementById('objSearch'); SH.objQ=oi?oi.value.trim():''; SH.objOpen=null;
    renderShift(); return;}

  if(a==='sh-objmine'){SH.objMine=!SH.objMine; renderShift(); return;}

  if(a==='sh-objent'){
    var osel=document.getElementById('obj_ent');
    el.disabled=true;
    try{
      // 0, а не null: сервер отличает «поле не прислали» от «снять привязку»
      await sapi('/shift/admin/objects/'+encodeURIComponent(el.dataset.uid),
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({contract_entity_id:(osel&&osel.value)?+osel.value:0})});
      SH.err=''; loadObjectsAdmin();
      if(typeof toast==='function')toast('Юрлицо договора сохранено');
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-splitadd'){
    var spEnt=document.getElementById('split_ent'), spAmt=document.getElementById('split_amt');
    var spEid=(spEnt&&spEnt.value)?+spEnt.value:0;
    var spAmount=String((spAmt||{}).value||'').replace(/\s/g,'').replace(',','.');
    // Отказ — под полем, введённое остаётся (#260); шапку раздела с карточки
    // объекта не видно, а перерисовка без черновика стирала сумму.
    SH.splitDraft={ent:spEnt?spEnt.value:'',amt:spAmt?spAmt.value:''};
    if(!spEid){SH.splitNote='Выберите юрлицо, на которое разносится сумма.';renderShift();return;}
    if(!spAmount||isNaN(+spAmount)||+spAmount<=0){SH.splitNote='Сумма — число больше нуля, в рублях.';renderShift();return;}
    SH.splitNote='';
    el.disabled=true;
    try{
      await sapi('/shift/admin/objects/'+encodeURIComponent(el.dataset.uid)+'/entity-split',
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({entity_id:spEid,amount:+spAmount})});
      SH.err=''; SH.splitDraft=null; loadObjectsAdmin();
      if(typeof toast==='function')toast('Разнесение сохранено');
    }catch(e){SH.splitNote=e.message; el.disabled=false; renderShift();}
    return;}

  if(a==='sh-splitdel'){
    el.disabled=true;
    try{
      await sapi('/shift/admin/objects/'+encodeURIComponent(el.dataset.uid)+'/entity-split/'
        +el.dataset.eid+'/delete',{method:'POST'});
      SH.err=''; loadObjectsAdmin();
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-cloudon'){
    el.disabled=true; el.textContent='Открываю…';
    try{
      var r=await sapi('/shift/storage/connect',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider:el.dataset.p||'yandex'})});
      // Отдельным окном: страницы согласия запрещают показ во врезке
      // Адрес пришёл с сервера, но открываем его только как http(s):
      // это единственное место, где серверная строка идёт в window.open.
      var au=(typeof safeUrl==='function')?safeUrl(r.auth_url):'';
      if(!au){SH.err='Провайдер вернул некорректный адрес согласия';renderShift();return;}
      var w=window.open(au,'fse_cloud','width=520,height=700');
      if(!w){SH.err='Браузер заблокировал окно — разрешите всплывающие окна для app.gasbase.ru';}
    }catch(e){SH.err=e.message;}
    renderShift(); return;}

  if(a==='sh-cloudpass'){
    var lg=(document.getElementById('cl_login')||{}).value||'';
    var pw=(document.getElementById('cl_pass')||{}).value||'';
    if(!lg.trim()||!pw.trim()){failAt(el,'Нужны и адрес почты, и пароль приложения');return;}
    var clLbl=el.textContent;
    el.disabled=true; el.textContent='Проверяю…';
    try{
      await sapi('/shift/storage/connect-password',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider:el.dataset.p||'mailru',login:lg.trim(),password:pw.trim()})});
      SH.err='';
      if(typeof toast==='function')toast('Облако подключено');
      loadCloud(); return;
    }catch(e){el.textContent=clLbl; failAt(el,e.message);}
    return;}

  if(a==='sh-cloudoff'){
    var okRev=(window.UI&&UI.confirm)
      ? await UI.confirm({title:'Отозвать доступ к облаку?',
          text:'Новые фотографии смен сохраняться не будут, пока облако не подключат заново.',
          warn:'Уже загруженные снимки останутся на вашем диске — они ваши.',
          ok:'Отозвать',okIcon:'i-lock'})
      : confirm('Отозвать доступ к облаку?');
    if(!okRev)return;
    el.disabled=true;
    try{ await sapi('/shift/storage/revoke',{method:'POST'}); SH.err='';
         if(typeof toast==='function')toast('Доступ отозван'); }
    catch(e){SH.err=e.message;}
    loadCloud(); return;}

  if(a==='sh-docson'){
    el.disabled=true; el.textContent='Открываю…';
    try{
      var dr=await sapi('/deal-docs/google/connect',{method:'POST'});
      var du=safeUrl(dr.auth_url);
      if(!du){SH.err='Google вернул некорректный адрес согласия';renderShift();return;}
      if(!window.open(du,'fse_cloud','width=520,height=700'))
        SH.err='Браузер заблокировал окно — разрешите всплывающие окна для app.gasbase.ru';
    }catch(e){SH.err=e.message;}
    renderShift(); return;}

  if(a==='sh-docstrial'){
    var dsel=document.getElementById('dd_deal'), dname='', did;
    if(dsel){
      did=+dsel.value;
      var dp=(SH.docsDeals||[]).filter(function(x){return x.id===did;})[0];
      dname=dp?dp.name:'';
    }else{
      did=+((document.getElementById('dd_id')||{}).value||'').trim();
      dname=((document.getElementById('dd_name')||{}).value||'').trim();
    }
    SH.docsTplPick=(document.getElementById('dd_tpl')||{}).value||'';
    if(!(did>0)){SH.docsErr=dsel?'Найдите сделку amoCRM по номеру или названию':'Нужен номер сделки из amoCRM';renderShift();return;}
    el.disabled=true; el.textContent='Создаю…';
    try{
      SH.docsLast=await sapi('/deal-docs/trial',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({deal_id:did,deal_name:dname,template_id:SH.docsTplPick})});
      SH.docsErr='';
      if(typeof toast==='function')toast(SH.docsLast.crm_error?'Документ создан, ссылка в amoCRM не записана':'Документ создан');
    }catch(e){SH.docsErr=e.message;}
    renderShift(); return;}

  if(a==='sh-docsoff'){
    var okD=(window.UI&&UI.confirm)
      ? await UI.confirm({title:'Отозвать доступ к Google Диску?',
          text:'Приложение перестанет создавать документы сделок, пока Диск не подключат заново.',
          warn:'Уже созданные документы останутся на Диске.',
          ok:'Отозвать',okIcon:'i-lock'})
      : confirm('Отозвать доступ к Google Диску?');
    if(!okD)return;
    el.disabled=true;
    try{ await sapi('/deal-docs/google/revoke',{method:'POST'}); SH.docsLast=null;
         if(typeof toast==='function')toast('Доступ отозван'); }
    catch(e){SH.err=e.message;}
    loadCloud(); return;}

  if(a==='sh-objcur'){
    var csel=document.getElementById('obj_cur'), scb=document.getElementById('obj_self');
    el.disabled=true;
    try{
      // 0, а не пусто: сервер отличает «поле не прислали» от «снять куратора»
      await sapi('/shift/admin/objects/'+encodeURIComponent(el.dataset.uid),
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({curator_id:(csel&&csel.value)?+csel.value:0,
                               self_confirm:!!(scb&&scb.checked)})});
      SH.err=''; loadObjectsAdmin();
      if(typeof toast==='function')toast('Куратор сохранён');
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-objexecadd'){
    var xsel=document.getElementById('obj_exec');
    if(!xsel||!xsel.value){failAt(el,'Выберите исполнителя из списка');return;}
    el.disabled=true;
    try{
      await sapi('/objects/'+encodeURIComponent(el.dataset.uid)+'/assign',
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({timebot_user_id:+xsel.value})});
      SH.err=''; loadObjectsAdmin();
      if(typeof toast==='function')toast('Исполнитель назначен');
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-objexecdel'){
    el.disabled=true;
    try{
      await sapi('/objects/'+encodeURIComponent(el.dataset.uid)+'/assign/'
        +encodeURIComponent(el.dataset.tid), {method:'DELETE'});
      SH.err=''; loadObjectsAdmin();
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-objprod'){
    el.disabled=true;
    try{
      await sapi('/shift/admin/objects/'+encodeURIComponent(el.dataset.uid),
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({in_production:el.dataset.v==='1'})});
      SH.err=''; loadObjectsAdmin();
    }catch(e){failAt(el,e.message);}
    return;}

  // Отметка выполненных объёмов по позициям сметы — то, что раньше жило
  // в отдельном разделе «Монтаж». Доступно из открытой смены.
  if(a==='sh-vol'){
    SH.volOpen=!SH.volOpen; renderShift();
    if(SH.volOpen&&SH.lines===undefined)loadLines();
    return;}

  if(a==='sh-volsave'){
    var rid=el.dataset.rid, inp=document.getElementById('vol_'+rid);
    var val=inp?parseFloat(String(inp.value).replace(',','.')):0;
    if(!val||val<=0){failAt(el,'Введите количество');return;}
    // Фото обязательно (#58): без него куратору нечего смотреть при приёмке.
    var vphEl=document.getElementById('volPh_'+rid);
    var vph=vphEl?[].slice.call(vphEl.files||[]):[];
    if(!vph.length){failAt(el,'Приложите фото выполненного объёма');return;}
    if(!(SH.current&&SH.current.object_uid)){failAt(el,'Смена не открыта');return;}
    el.disabled=true;
    // Ключ операции — один на нажатие и на все его повторы: смена идёт на
    // объекте, где связь пропадает, и вторая попытка отправить ту же отметку
    // не должна становиться вторым объёмом. Новый ключ — только после успеха.
    SH.ops=SH.ops||{};
    var vopid=SH.ops[rid]||(SH.ops[rid]=opKey());
    try{
      var vfiles=[];
      for(var vi=0;vi<vph.length;vi++){
        if(typeof toast==='function')toast('Загружаю фото '+(vi+1)+' из '+vph.length+'…');
        var vfd=new FormData(); vfd.append('file',vph[vi]);
        var vup=await sapi('/upload?object_uid='+encodeURIComponent(SH.current.object_uid),
          {method:'POST',body:vfd});
        if(vup&&vup.url)vfiles.push({url:vup.url,ref:vup.ref,type:vup.type||'image'});
      }
      var vres=await sapi('/install',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({object_uid:SH.current.object_uid,row_id:rid,qty:val,
          files:vfiles,client_op_id:vopid,date_end:new Date().toISOString()})});
      if(vphEl)vphEl.value='';
      delete SH.ops[rid];
      SH.err=''; SH.lines=undefined; renderShift(); loadLines();
      // repeat/duplicate — сервер узнал прежнюю отметку. Объём записан, ошибки нет.
      if(typeof toast==='function')
        toast(vres&&(vres.repeat||vres.duplicate)?'Уже отмечено — повтор не записан':'Отмечено');
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-start'){startShift(el.dataset.uid,el); return;}

  // Повтор после отказа геометки — то же действие, что не удалось, с теми же
  // данными: примечание к закрытию человек уже написал, второй раз не спрашиваем.
  if(a==='sh-geo'||a==='sh-nogeo'){
    var gs=SH.geo, ng=(a==='sh-nogeo'); if(!gs)return;
    if(gs.on==='stop')stopShift(gs.note,ng); else startShift(gs.uid,el,ng);
    return;}

  // Закрытие смены — через окно подтверждения. Раньше нажатие закрывало
  // смену сразу: промах пальцем на объекте стоил часа работы, и вернуть
  // его нельзя — в базе уже стоит время.
  if(a==='sh-stop'){
    if(SH.busy)return;
    if(!(window.UI&&UI.modal)){stopShift('');return;}
    askClosePhoto();
    return;}

  if(a==='sh-salset'){
    var tid=el.dataset.tid;
    var amt=String((document.getElementById('sal_amt')||{}).value||'').replace(/\s/g,'').replace(',','.');
    var frm=(document.getElementById('sal_from')||{}).value;
    var kind=((document.getElementById('sal_kind')||{}).value)||'salary';
    // Сдельщику сумма не нужна — у него её и нет. Требовать её значило бы
    // заставить директора выдумать число, которое нигде не применяется.
    if(!tid||!frm){failAt(el,'Укажите дату');return;}
    if(kind!=='piece'){
      if(!amt){failAt(el,'Укажите оклад или переключите на сдельную');return;}
      if(isNaN(+amt)){failAt(el,'Оклад — только цифры');return;}
    }
    el.disabled=true;
    try{
      await sapi('/shift/salary',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({user_id:+tid,amount:(kind==='piece'?0:+amt),
                             period_from:frm,pay_kind:kind})});
      SH.err=''; SH.salary=null; SH.report=false; renderShift(); loadSalary();
      if(typeof toast==='function')toast(kind==='piece'?'Переведён на сдельную':'Оклад сохранён');
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-adjset'){
    var atid=el.dataset.tid;
    var akind=(document.getElementById('adj_kind')||{}).value;
    var aamt=String((document.getElementById('adj_amt')||{}).value||'').replace(/\s/g,'').replace(',','.');
    var adate=(document.getElementById('adj_date')||{}).value;
    var awhy=(document.getElementById('adj_why')||{}).value;
    if(!atid||!aamt||!adate){failAt(el,'Укажите сумму и дату');return;}
    if(isNaN(+aamt)||+aamt<=0){failAt(el,'Сумма — положительное число');return;}
    el.disabled=true;
    try{
      await sapi('/shift/adjust',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({user_id:+atid,kind:akind,amount:+aamt,adjust_date:adate,reason:awhy||null})});
      SH.err=''; SH.adjust=null; SH.report=false; renderShift(); loadSalary();
      if(typeof toast==='function')toast(akind==='bonus'?'Премия начислена':'Штраф начислен');
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-emp'){
    SH.empOpen = (String(SH.empOpen)===String(el.dataset.tid)) ? null : el.dataset.tid;
    renderShift(); return;}

  if(a==='sh-empfind'){
    var ei=document.getElementById('empSearch'); SH.empQ=ei?ei.value.trim():''; SH.empOpen=null;
    renderShift(); return;}

  if(a==='sh-adjdel'){
    el.disabled=true;
    try{
      await sapi('/shift/adjust/'+el.dataset.id+'/delete',{method:'POST'});
      SH.err=''; SH.adjust=null; SH.report=false; renderShift(); loadSalary();
    }catch(e){failAt(el,e.message);}
    return;}

  if(a==='sh-phdel'){
    // Файл на Яндекс.Диске остаётся — решение владельца: из приложения
    // уходит ссылка, не файл (#106). Явно проговариваем это в подтверждении,
    // чтобы директор не решил, что снимок стёрся отовсюду.
    var okDel=(window.UI&&UI.confirm)
      ? await UI.confirm({title:'Убрать снимок из карточки?',
          text:'Снимок пропадёт из Табеля, кто и когда убрал — останется в журнале доступа.',
          warn:'Файл на Яндекс.Диске компании останется — приложение его не трогает.',
          ok:'Убрать',okIcon:'i-x'})
      : confirm('Убрать снимок из карточки? Файл на диске компании останется.');
    if(!okDel)return;
    el.disabled=true;
    try{
      await sapi('/shift/photo/remove?ref='+encodeURIComponent(el.dataset.ref),{method:'POST'});
      var sh=(SH.slist||[]).filter(function(s){return String(s.id)===String(el.dataset.sid);})[0];
      if(sh)sh.files=(sh.files||[]).filter(function(f){return f.ref!==el.dataset.ref;});
      SH.err='';
      if(typeof toast==='function')toast('Снимок убран из карточки');
      renderShift();
    }catch(e){failAt(el,e.message);}
    return;}
});

// Окно согласия закрылось — сразу перечитываем состояние, чтобы директор
// увидел результат, а не гадал, получилось или нет
window.addEventListener('message',function(e){
  // Отправителя проверяем обязательно: сообщение может прислать любая страница,
  // открытая в другом окне, и без этой строки чужой сайт дёргает наш код.
  if(e.origin!==location.origin)return;
  if(e.data==='fse-storage'&&SH.sub==='cloud')loadCloud();
});

// Выбор в селектах периода и файлов — на change, а не на клик.
document.addEventListener('change',async function(ev){
  var t=ev.target; if(!t)return;
  // Период табеля и «Моих денег» применяется сразу по выбору, как поиск по вводу.
  if(t.id==='shMonth'||t.id==='shYear'||t.id==='shEnt'){
    var my=document.getElementById('shYear'), mm=document.getElementById('shMonth');
    var me=document.getElementById('shEnt');
    if(my)SH.year=+my.value; if(mm)SH.month=+mm.value; if(me)SH.entFilter=me.value||'';
    loadReport(); return;}
  if(t.id==='mnPeriod'){
    if(t.value&&t.value.indexOf('-')>0){
      var pp=t.value.split('-'); SH.mYear=+pp[0]; SH.mMonth=+pp[1];}
    loadMoney(); return;}
  // Снимок к позиции сметы сам никуда не уходит — он ждёт галочки у своей
  // строки. Здесь только показываем, сколько выбрано, и открываем галочку.
  if(t.classList&&t.classList.contains('volPh')){
    var vn=(t.files||[]).length, vrid=t.dataset.rid;
    var vlab=document.getElementById('volPhN_'+vrid), vbtn=document.getElementById('volSave_'+vrid);
    if(vlab)vlab.textContent=vn?('фото: '+vn):'фото не выбрано';
    if(vbtn){vbtn.disabled=!vn;vbtn.title=vn?'Отметить объём':'Сначала приложите фото';}
    return;
  }
  // Загрузка фото — отдельно, на change скрытого input. Файлов может быть
  // много (пачка из галереи за день) — грузим по одному: пачка параллельных
  // запросов на связи объекта гибнет вся разом.
  var late=t.classList&&t.classList.contains('shPhotoLate');
  if(t.id!=='shPhoto'&&!late)return;
  var list=[].slice.call(t.files||[]); t.value=''; if(!list.length)return;
  await upShiftPhotos(list,late);
});

// Подстраховки «через 150 мс уйти на смену» здесь больше нет: стартовый
// переход в kp-01 дожидается разбора всех kp-*, и roleDefault() к тому моменту
// уже знает про смену. Второй переход давал лишний view:shift в статистике.
window.__kp03b={renderShift:renderShift};
})();
