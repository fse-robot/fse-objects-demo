// Проекты только группируют specs по project_uid. Список остаётся один:
// второго массива, который может разойтись с первым, здесь не заводится.
let projects=[],prjOpen=new Set(),specSel=new Set();

function mapSpec(s){return {id:s.uid,number:s.number||'',title:s.title||'Без названия',
  date:fmtDate(s.updated_at),updated_at:s.updated_at,n:s.rows,object:s.object,customer:s.customer||'',
  prj:s.project_uid||'',_meta:true};}

// Поиск ищет и по номеру: номер для того и заведён, чтобы смету можно было
// назвать вслух и потом найти по названному (#283).
function specMatch(s,q){return ((s.title||'')+' '+(s.number||'')).toLowerCase().includes(q);}

function pickHTML(id){return canEdit()
  ?`<input type="checkbox" class="pick" data-spick="${esc(id)}"${specSel.has(id)?' checked':''}>`
  :'<span class="pickgap"></span>';}

function specCardHTML(s,prjUid){
  const n=s._meta?(s.n||0):((s.rows||[]).length);
  const sum=(!s._meta&&s.rows)?s.rows.reduce((a,r)=>a+(+r.retail||0)*(+r.qty||0),0):null;
  const menu=canEdit()?'<div class="mn" data-act="rowmenu">⋯<div class="menu">'
    +(prjUid?`<div data-act="prjdrop" data-uid="${esc(prjUid)}" data-spec="${esc(s.id)}">Вынести из проекта</div>`:'')
    +`<div data-act="prjmove" data-spec="${esc(s.id)}">Перенести в проект…</div></div></div>`:'';
  return `<div class="speccard" data-open="${esc(s.id)}">${pickHTML(s.id)}<div class="pnm"><b>${esc(s.title)}</b>`
    +`<div class="s">${esc([s.number,s.date,'позиций: '+n].filter(Boolean).join(' · '))}</div></div>`
    +`<div style="text-align:right">${sum!=null?`<b>${money(sum)} ₽</b><div class="s">розница</div>`:'<div class="s">открыть ›</div>'}</div>${menu}</div>`;}

// Раскрытие — и кнопкой, и нажатием по строке: открывать проекту нечего,
// отдельного экрана у него нет, и второго смысла у жеста не возникает.
// Правом spec:calc сервер считает число смет и сумму по своим, поэтому
// строка у разных людей показывает разное — об этом сказано словами.
function prjRowHTML(p,kids,open,shown){
  const menu=canEdit()?'<div class="mn" data-act="rowmenu">⋯<div class="menu">'
    +`<div data-act="prjrename" data-uid="${esc(p.uid)}">Переименовать</div>`
    +`<div data-act="prjdissolve" data-uid="${esc(p.uid)}">Распустить проект</div></div></div>`:'';
  const own=can('spec:read')?'':' (по вашим сметам)';
  const found=shown!=null?` <span class="ch info">найдено внутри: ${shown}</span>`:'';
  const note=(open&&shown!=null&&shown<p.specs)?`<div class="prjnote">показаны ${shown} из ${p.specs}</div>`:'';
  return `<div class="prj${open?' op':''}" data-prj="${esc(p.uid)}"><div class="speccard" data-prjrow="${esc(p.uid)}">`
    +`<button class="disc" title="${open?'Свернуть':'Раскрыть'}" aria-expanded="${open?'true':'false'}">`
    +`<svg class="i"><use href="#i-${open?'down':'right'}"/></svg></button>`
    +`<div class="pnm"><b>${esc(p.title)}</b><div class="s">`
    +`${esc([p.number,'смет: '+p.specs+own,fmtDate(p.updated_at)].filter(Boolean).join(' · '))}${found}</div></div>`
    +`<div class="psum n">${money(p.total)} ₽</div>${menu}</div>`
    +`<div class="prjkids">${kids}</div>${note}</div>`;}

function emptySpecsHTML(q){
  const o=q?{icon:'i-srch',title:'Ничего не найдено',
             text:'Поиск идёт и по проектам, и по сметам внутри них — проверьте название или номер.'}
          :{icon:'i-fold',title:'Пока нет спецификаций',
            text:'Нажмите «Новая смета», чтобы создать первую.'};
  return (window.UI&&UI.empty)?UI.empty(o)
    :'<div class="sub" style="padding:12px">'+esc(o.title)+'</div>';}

function renderSpecs(q){q=(q||'').trim().toLowerCase();
  const byPrj={};specs.forEach(s=>{if(s.prj)(byPrj[s.prj]=byPrj[s.prj]||[]).push(s);});
  const items=[];
  projects.forEach(p=>{
    const kids=byPrj[p.uid]||[];
    const self=((p.title||'')+' '+(p.number||'')).toLowerCase().includes(q);
    const hit=kids.filter(s=>specMatch(s,q));
    if(q&&!self&&!hit.length)return;
    // Свёрнутый проект не имеет права спрятать совпадение: нашлось внутри —
    // раскрываем сами и показываем только совпавшее, а не все сметы проекта.
    const byFind=!!q&&!self;
    const inner=byFind?hit:kids;
    items.push({at:p.updated_at||'',
      html:prjRowHTML(p,inner.map(s=>specCardHTML(s,p.uid)).join(''),
                      byFind||prjOpen.has(p.uid),byFind?hit.length:null)});});
  specs.forEach(s=>{
    if(s.prj&&projects.some(p=>p.uid===s.prj))return;
    if(q&&!specMatch(s,q))return;
    items.push({at:s.updated_at||'',html:specCardHTML(s,'')});});
  items.sort((a,b)=>a.at<b.at?1:a.at>b.at?-1:0);
  $('#specList').innerHTML=items.map(x=>x.html).join('')||emptySpecsHTML(q);
  renderSpecSel();}

// Полоса выбора — тот же узор, что у позиций сметы и очереди снабжения.
function renderSpecSel(){const sb=$('#specselbar');if(!sb)return;
  sb.classList.toggle('on',specSel.size>0);
  if(specSel.size)sb.innerHTML=`<b>${specSel.size}</b><span>выбрано:</span>`
    +'<button class="btn sm" data-act="prjlink">Связать в проект</button>'
    +'<button class="btn sm" data-act="prjlinkto">В существующий проект…</button>'
    +'<button class="btn sm" data-act="specselclear">Снять</button>';}

// Отказ сервера — не ошибка сети: он жив, назвал смету поимённо и объяснил,
// почему нельзя. Повторять молча нечего, выделение остаётся.
function prjErr(msg){const box=$('#specErr');if(!box)return;
  box.innerHTML='<div class="errbox x"><p>'+esc(msg)+'</p>'
    +'<button title="Скрыть" data-act="prjerrhide">'+(window.UI?UI.icon('i-x'):'×')+'</button></div>';}
function prjErrHide(){const box=$('#specErr');if(box)box.innerHTML='';}

async function prjRefresh(){
  const [ps,list]=await Promise.all([api('/projects'),api('/specs')]);
  projects=ps;specs=list.map(mapSpec);
  renderSpecs($('#specq')?$('#specq').value:'');}

function prjTogl(uid){prjOpen.has(uid)?prjOpen.delete(uid):prjOpen.add(uid);
  renderSpecs($('#specq')?$('#specq').value:'');}

function prjLinkNew(){
  const ids=[...specSel];if(!ids.length)return;
  if(!(window.UI&&UI.modal)){toast('Форма связывания не открылась');return}
  const m=UI.modal({narrow:true,title:'Связать в проект',sub:'Смет выбрано: '+ids.length,
    body:'<div class="fcell wide"><div class="flab">Название проекта <i>обязательно</i></div>'
      +'<input class="fin" id="prjTitle" maxlength="120" placeholder="Например: Фрегат, корпус Б">'
      +'<div class="fnote">Сметы остаются отдельными документами со своей историей версий — '
      +'проект собирает их в одну строку списка.</div></div>',
    ok:'Связать',okIcon:'i-link',
    onOk:w=>{const t=(w.querySelector('#prjTitle').value||'').trim();
      if(!t){m.error('Название проекта обязательно');return false}
      return api('/projects',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({title:t,specs:ids})})
        .then(()=>{specSel.clear();prjErrHide();toast('Связано в проект');return prjRefresh();});}});
  const inp=$('#prjTitle');if(inp)inp.focus();}

function prjLinkTo(ids){
  ids=(ids||[]).filter(Boolean);if(!ids.length)return;
  if(!projects.length){toast('Проектов пока нет — свяжите сметы в новый');return}
  if(!(window.UI&&UI.modal)){toast('Форма переноса не открылась');return}
  UI.modal({narrow:true,title:'Перенести в проект',sub:'Смет выбрано: '+ids.length,
    body:'<div class="fcell wide"><div class="flab">Проект</div><select class="fin" id="prjPick">'
      +projects.map(p=>`<option value="${esc(p.uid)}">${esc(p.title)}</option>`).join('')
      +'</select></div>',
    ok:'Перенести',okIcon:'i-link',
    // По одной и по очереди: сервер отказывает по конкретной смете и называет
    // её, а параллельные запросы смешали бы отказ с уже прошедшими.
    onOk:w=>{const uid=w.querySelector('#prjPick').value;
      return ids.reduce((p,sid)=>p.then(()=>api('/projects/'+encodeURIComponent(uid)+'/specs',
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({spec_uid:sid})})),Promise.resolve())
        .then(()=>{specSel.clear();prjOpen.add(uid);prjErrHide();toast('Перенесено');
          return prjRefresh();});}});}

function prjDrop(uid,sid){
  api('/projects/'+encodeURIComponent(uid)+'/specs/'+encodeURIComponent(sid),{method:'DELETE'})
    .then(()=>{prjErrHide();toast('Смета вынесена из проекта');return prjRefresh();})
    .catch(e=>prjErr('Не удалось вынести смету: '+((e&&e.message)||'нет связи')));}

function prjRename(uid){
  const p=projects.find(x=>x.uid===uid);if(!p)return;
  if(!(window.UI&&UI.modal)){toast('Форма переименования не открылась');return}
  const m=UI.modal({narrow:true,title:'Переименовать проект',
    body:'<div class="fcell wide"><div class="flab">Название <i>обязательно</i></div>'
      +`<input class="fin" id="prjTitle" maxlength="120" value="${esc(p.title)}"></div>`,
    ok:'Сохранить',
    onOk:w=>{const t=(w.querySelector('#prjTitle').value||'').trim();
      if(!t){m.error('Название проекта обязательно');return false}
      return api('/projects/'+encodeURIComponent(uid),
        {method:'PATCH',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({title:t})})
        .then(()=>{prjErrHide();toast('Переименовано');return prjRefresh();});}});}

function prjDissolve(uid){
  const p=projects.find(x=>x.uid===uid);if(!p)return;
  askYes({title:'Распустить проект?',
    text:'«'+(p.title||'')+'» перестанет быть одной строкой. Сметы вернутся в список '
      +'отдельными строками — сами документы и их история версий не трогаются.',
    ok:'Распустить',okIcon:'i-fold'},()=>{
    api('/projects/'+encodeURIComponent(uid),{method:'DELETE'})
      .then(()=>{prjOpen.delete(uid);prjErrHide();toast('Проект распущен');return prjRefresh();})
      .catch(e=>prjErr('Не удалось распустить проект: '+((e&&e.message)||'нет связи')));});}

// Самопочинка старых сохранённых ссылок Тинко: если у позиции есть 6-значный код,
// перебиваем устаревший адрес (…/cat/<код>, поиск) на прямую карточку /catalog/product/<код>/.
// Нужна, чтобы ранее сохранённые в localStorage спецификации показывали верную ссылку.
function fixTinkoLinks(rows){(rows||[]).forEach(r=>{const d=String(r.code||'').replace(/\D/g,'');
  if(!d||d.length>6)return;const fresh='https://www.tinko.ru/catalog/product/'+d.padStart(6,'0')+'/';
  (r.offers||[]).forEach(o=>{if(o&&(o.shop==='Тинко'||o.shop==='tinko'||/tinko\.ru/.test(o.url||'')))o.url=fresh;});
  if(/tinko\.ru/.test(r.url||''))r.url=fresh;});}

// rows может прийти из БД строкой "[]" (jsonb-строка вместо массива) — приводим к массиву,
// иначе rows.map/forEach падает и проект «не открывается». При первом сохранении вылечится.
function asRows(v){if(Array.isArray(v))return v;
  if(typeof v==='string'){try{const p=JSON.parse(v||'[]');return Array.isArray(p)?p:[];}catch(e){}}
  return [];}
async function openSpec(id){curId=id;sel.clear();mergePick=false;
  // Панель подбора принадлежит открытой смете: отмеченное чужой сметы
  // не должно уехать в эту (#348).
  catShown=false;catReset();catRender();const s=specs.find(x=>x.id===id);
  if(LIVE&&s&&s._meta){
    try{const full=await api('/specs/'+id);rows=asRows(full.rows);s.rows=rows;s.updated_at=full.updated_at;s.number=full.number||s.number||'';s.customer=full.customer||'';s._meta=false;}
    // Открывать редактор после неудачной загрузки НЕЛЬЗЯ. Раньше rows становились
    // пустыми, дальше срабатывало автосохранение — и через 600 мс уходил PUT
    // с пустым списком позиций: смета на сервере обнулялась из-за одного сбоя сети.
    catch(e){curId=null;rows=[];toast('Не удалось загрузить смету: '+(e.message||'нет связи')+'. Попробуйте ещё раз.',5000);go('specs');return;}
  }
  else rows=asRows(s&&s.rows);
  fixTinkoLinks(rows);
  dirty=false;loadTab();
  go('editor');render();specDocs(id);}

// КП, уже выпущенные по смете (#617), — в шапке: окно «КП в Google» закрыли,
// а где документ и был ли он, видно отсюда.
const ymd=v=>String(v||'').slice(0,10).split('-').reverse().join('.');
const docTitle=d=>(d.number?'КП №'+d.number+' от ':'КП от ')+ymd(d.issued_on);
async function specDocs(id){
  const s=specs.find(x=>x.id===id);
  if(!s||PUB||!LIVE||!can('spec:read'))return;
  try{s._docs=(await ledger('/deal-docs/docs?spec_uid='+encodeURIComponent(id))).docs||[];}
  catch(e){return}
  if(curId===id)updMeta();}
const docLink=d=>{const u=safeUrl(d.url);
  return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(docTitle(d))+'</a>':esc(docTitle(d));};
// Excel собирается из сметы как она есть сейчас (#646): правленая после КП
// смета даёт в нём другие цифры, чем в бланке, и шапка об этом говорит.
const editedAfterKp=s=>{const d=(s._docs||[])[0];
  return !!(d&&d.issued_at&&s.updated_at&&Date.parse(s.updated_at)>Date.parse(d.issued_at));};
function docsMeta(s){
  if(!(s._docs||[]).length)return '';
  return ' · '+s._docs.map(docLink).join(', ')
    +(editedAfterKp(s)?' · <span class="badge">смету правили после КП №'+esc(s._docs[0].number)+' — в Excel новые цифры</span>':'');}
// КП в Excel в полосе — только у сметы, по которой КП уже выставлено (#646):
// основной документ заказчику — бланк из Google.
function clientXlsxBtn(){const b=document.querySelector('[data-act="export-client"]');if(!b)return;
  const s=specs.find(x=>x.id===curId)||{};
  b.style.display=(!PUB&&!costMode()&&!kaMode()&&(s._docs||[]).length)?'':'none';}

// ── авто-варианты из базы после ручной правки наименования ──
// Хранятся вне строки (не сохраняются в спецификацию) — транзитный буфер по id строки.
let varMap={};
// Похожа ли найденная позиция на то, что искали. Раньше проверки не было
// вовсе: показывались первые четыре результата, какими бы они ни оказались,
// и «Заклепка резьбовая М3» получала в подсказки пожарный извещатель.
// Сверяем по значимым словам и по буквенно-цифровым кодам вида С2000-АСПТ.
// Кириллические буквы, похожие на латинские, приводим к латинице — поставщики
// пишут один и тот же артикул то так, то эдак.
function normTok(s){
  return String(s||'').toLowerCase()
    .replace(/[асвекмнорхутіь]/g,c=>({'а':'a','с':'c','в':'b','е':'e','к':'k','м':'m',
      'н':'h','о':'o','р':'p','х':'x','у':'y','т':'t','і':'i','ь':''}[c]||c))
    .replace(/[^a-zа-я0-9]+/gi,' ').trim();
}
function tokens(s){
  return new Set(normTok(s).split(/\s+/).filter(w=>w.length>=4||/\d/.test(w)));
}
// Артикул без разделителей вовсе: «ЭДУ-ПТ», «ЭДУ ПТ» и «ЭДУПТ» — одна вещь,
// и у четырёх поставщиков она записана всеми тремя способами.
function glueTok(s){return normTok(s).replace(/\s+/g,'');}
function relevant(cand,query){
  const hay=(cand.name||'')+' '+(cand.code||'')+' '+(cand.article||'');
  // Сначала артикулом. Короткое имя распадалось на куски по два-три знака,
  // ни один не проходил по длине, и ЭДУ-ПТ, ОПОП 1 и ОПОП-2 не показывались
  // ни разу, хотя в каталоге лежат.
  const gq=glueTok(query),gh=glueTok(hay),ga=glueTok(cand.code||cand.article||'');
  if(gq.length>=4&&gh.indexOf(gq)>=0)return true;
  if(ga.length>=4&&gq.indexOf(ga)>=0)return true;
  const q=tokens(query);
  if(!q.size)return false;
  const c=tokens(hay);
  for(const w of q){
    if(!c.has(w))continue;
    // Код с цифрами — сильное совпадение, одного достаточно.
    if(/\d/.test(w)&&w.length>=3)return true;
    // Слово без цифр — засчитываем, но требуем длины: «для», «шт» не считаются.
    if(w.length>=5)return true;
  }
  return false;
}
async function offerVariants(r){const q=(r.name||'').trim();if(q.length<2){delete varMap[r.id];return;}
  const m=await searchProducts(q);
  // Отсеиваем заведомо чужое: показывать верхушку выдачи вместо совпадения —
  // худший вариант, человек разбирает ерунду и перестаёт верить подсказкам.
  const res=(m||[]).filter(c=>relevant(c,q)).slice(0,4);
  if(!res.length){delete varMap[r.id];render();
    toast('В базе не нашлось. Уточните название и нажмите Enter — поищу заново',3600);return;}
  varMap[r.id]=res;render();}
function suggestHTML(r){const list=varMap[r.id];if(!list||!list.length)return '';
  return `<div class="varbox"><div class="vh">${SHOPICON} Похожие позиции из базы — подставить цену и магазин?</div>${list.map((c,i)=>{
    const bi=bestOffer(c.offers);const b=bi>=0?c.offers[bi]:((c.offers&&c.offers[0])||{price:0});
    return `<div class="varrow"><span>${esc(c.name)}${c.code?` <span class="sub">${esc(c.code)}</span>`:''} · <span class="sub">${bi>=0?'в наличии от <b class="vprice">'+money(b.price)+' ₽</b>':'<b class="vprice">нет цены</b>'}</span></span><button class="btn sm primary" data-applyvar="${i}">подставить</button></div>`;
  }).join('')}<button class="btn sm" data-act="dismissvar" style="margin-top:6px">оставить вручную</button></div>`;}

// Иконка перехода к товару в магазине (узнаваемый «пакет/витрина», как на маркетплейсах)
const SHOPICON='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6l-2-4z"/><path d="M4 6h16"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
// Адрес в ссылке проверяем и экранируем. Строки спеки правит кто угодно,
// у кого есть публичная ссылка, а значит в url может приехать «javascript:…»
// или кавычка с обработчиком события — и выполниться в сессии директора,
// где в localStorage лежат его токены. Пускаем только http и https.
function safeUrl(u){
  u=String(u==null?'':u).trim(); if(!u)return '';
  // Только абсолютный http(s). Без этого «не адрес вовсе» достраивалось до
  // ссылки на наш же домен, и в смете появлялась кнопка «в магазин» в никуда.
  if(!/^https?:\/\//i.test(u))return '';
  try{const p=new URL(u); return p.href;}catch(e){return '';}
}
function lk(url,label,cls){const u=safeUrl(url);if(!u)return '';
  const t=label||'в магазин';
  return `<a class="lk${cls?' '+cls:''}" href="${esc(u)}" target="_blank" rel="noopener" `
    +`title="Открыть товар на сайте магазина${label?' '+esc(label):''}">${SHOPICON}<span>${esc(t)}</span></a>`;}
// Возраст цены стоит рядом с самой ценой: решение «ставить ли это в КП»
// принимается здесь. Дата — когда сборщик последний раз заходил за ценой,
// поэтому и подписано «сборщик заходил», а не «цена изменилась».
function offerAge(o){
  if(!o.updated)return '<span class="pill old">сборщик здесь не был</span>';
  const d=esc(fmtDate(o.updated));
  return o.stale?`<span class="pill old">устарела · ${d}</span>`
                :`<span class="sub" style="margin-left:6px">сборщик заходил ${d}</span>`;
}
// Пометка на позиции. Она означает «этим ещё не занимались», поэтому цена,
// вписанная руками, её снимает. Метка называет состояние, а что делать —
// говорит подсказка: одно и то же указание в каждой из десятков ненайденных
// строк спорило бы с самой сметой.

// Возраст цены на позиции не пишется: базу обновляет сборщик, сметчик на это
// не влияет, а место на каждой позиции дорого. Он виден в предложениях магазинов.
function attnHTML(r){
  if(needsPrice(r))return r.found
    ?'<span class="badge">в каталоге нет цены — впишите свою</span>'
    :'<span class="badge" title="Впишите цену или уточните название и нажмите Enter — поищу в каталоге заново">нет в базе</span>';
  return '';
}
function attnCount(){return rows.filter(r=>r.type!=='section'&&r.type!=='calc'&&needsPrice(r)).length;}
// Сколько позиций ещё требуют внимания — в шапке сметы, а не только в строках:
// иначе на длинной смете их считают глазами по всему списку.
function updMeta(){const s=specs.find(x=>x.id===curId)||{};
  const n=rows.filter(x=>x.type!=='section'&&x.type!=='calc').length,k=attnCount();
  $('#emeta').innerHTML=esc([s.number,s.date,'позиций: '+n].filter(Boolean).join(' · '))
    +docsMeta(s)+(k?' · <span class="badge">требуют цены: '+k+'</span>':'');
  clientXlsxBtn();}
// Цену вписали — пометка снимается сразу. Перерисовать всю смету здесь нельзя:
// это уводит курсор из поля, в котором печатают.
function updAttn(rw,r){
  rw.classList.toggle('needs',needsPrice(r));
  const box=rw.querySelector('.attn');if(box)box.innerHTML=attnHTML(r);
  updMeta();}
function offersHTML(r){if(!r.offers||!r.offers.length)return '';
  return `<div class="offers"><div class="sub" style="margin-bottom:4px">Предложения магазинов (зелёным — в наличии и дешевле):</div>${r.offers.map((o,i)=>
    `<div class="off"><span><span class="shop">${esc(o.shop)}</span> <span class="pill ${stockOf(o).cls}">${stockOf(o).lbl}</span>${offerAge(o)}</span>
      <span>${money(o.price)} ₽ ${lk(o.url)} <button class="btn sm" data-pickoffer="${i}" style="margin-left:6px">${i===r.chosen?'выбрано':'выбрать'}</button></span></div>`).join('')}</div>`;}
// Цена строки в КП — то, за что платит заказчик: оборудование и монтаж вместе.
// Себестоимость сравнивается именно с ней, иначе монтаж выглядит бесплатным.
function rowPrice(r){return ((+r.retail||0)+(+r.montazh||0))*(+r.qty||0);}
// Себестоимость складывается из тех же двух частей, что и цена в КП:
// оптовая закупка оборудования и то, что за монтаж просит бригада. Одним
// полем их не разделить — монтаж либо уезжает в закупку, либо теряется.
function rowCostOb(r){return (+r.zakup||0)*(+r.qty||0);}
function rowCostMon(r){return (+r.zakupMon||0)*(+r.qty||0);}
function rowCost(r){return rowCostOb(r)+rowCostMon(r);}
// Невписанная себестоимость — «неизвестно», а не ноль. Посчитав её нулём,
// раздел покажет маржу 100 % и «выгодно», и решение примут по этому числу.
// Ноль и пустое поле здесь означают одно: сметы старше этой вкладки хранят
// ноль везде, где закупку не подставили из каталога.
function costEmpty(r){return !(+r.zakup>0||+r.zakupMon>0);}
// Помечаем только подставленное из каталога: вписанное руками — случай
// по умолчанию, пометить его значило бы пометить почти всё.
function srcPill(r){return (costMode()&&!costEmpty(r)&&r.costSrc==='catalog')?'<span class="pill src">из каталога</span>':'';}
// подытог подраздела: сумма позиций от секции i до следующей секции.
// gaps — сколько позиций без вписанной себестоимости: по ним вердикт не считаем.
function sectionSubtotal(i){let ret=0,mon=0,zak=0,zakOb=0,zakMon=0,price=0,gaps=0;
  for(let j=i+1;j<rows.length;j++){const x=rows[j];if(x.type==='calc')continue;if(x.type==='section')break;
    const q=+x.qty||0;ret+=(+x.retail||0)*q;mon+=(+x.montazh||0)*q;price+=rowPrice(x);
    if(costEmpty(x))gaps++;else{zakOb+=rowCostOb(x);zakMon+=rowCostMon(x);zak+=rowCost(x);}}
  const marg=price-zak,margPct=price>0?Math.round(marg/price*1000)/10:null;
  return {ob:ret,mon,tot:ret+mon,zak,zakOb,zakMon,price,gaps,marg,margPct};}
// Вердикт выгодности раздела по марже: цена КП за вычетом себестоимости.
// Монтаж входит в обе части. Видят только директор и снабжение.
const MARGIN_GOOD=15, MARGIN_WARN=8;   // пороги маржи, %
function mgLevel(p){return p>=MARGIN_GOOD?'ok':(p>=MARGIN_WARN?'warn':'bad');}
function marginVerdict(st){if(st.margPct==null)return null;const p=st.margPct;
  if(p>=MARGIN_GOOD)return {col:'var(--grn)',bg:'var(--grnbg)',lbl:'выгодно'};
  if(p>=MARGIN_WARN)return {col:'var(--amb)',bg:'var(--ambbg)',lbl:'△ на грани'};
  return {col:'var(--red)',bg:'var(--redbg)',lbl:'невыгодно'};}
function marginHTML(st){if(!can('cost:read'))return '';
  // Пока себестоимость вписана не у всех позиций, вердикта нет: посчитанный
  // по части позиций, он читается как посчитанный по всему разделу.
  if(st.gaps)return `<span class="secpart">маржа неполная · без себестоимости: ${st.gaps}</span>`;
  const v=marginVerdict(st);if(!v)return '';
  return `<span class="secmargin" style="margin-left:10px;padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap;color:${v.col};background:${v.bg}">${v.lbl} · маржа ${st.margPct}% · ${money(st.marg)} ₽</span>`;}
// Подытог раздела: на вкладке КП — что платит заказчик, на вкладке
// себестоимости — во что смета обходится нам и сколько из неё маржа.
function secSumHTML(st,idx){
  // На вкладке анализа раздел считается по её же колонкам: подытог КП между
  // ними читался бы как посчитанный по ним.
  if(kaMode())return KA.secSumHTML(idx);
  const head=costMode()
    ?(st.gaps?`Подытог КП: <b>${money(st.price)}</b> ₽ `
             :`Себес: <b>${money(st.zak)}</b> ₽ <span class="sub">(об. ${money(st.zakOb)} · монт. ${money(st.zakMon)}) · из КП ${money(st.price)}</span> `)
    :`Подытог: <b>${money(st.tot)}</b> ₽ <span class="sub">(об. ${money(st.ob)} · монт. ${money(st.mon)})</span>`;
  return head+marginHTML(st);}
function updSectionSums(){document.querySelectorAll('.rowwrap.section').forEach(sec=>{const idx=rows.findIndex(x=>x.id===sec.dataset.id);if(idx<0)return;
  const ss=sec.querySelector('.secsum');if(ss)ss.innerHTML=secSumHTML(sectionSubtotal(idx),idx);});}

// ── пункт 5: категории разделов и нижние расчёты КП ──
const SECKINDS={reserve:'Резервное оборудование',additional:'Дополнительное оборудование',docs:'Документация',pnr:'Пусконаладочные работы'};
function calcCfg(){return rows.find(x=>x.type==='calc')||{transportPct:2,overheadPct:3,machinesPct:1,vatPct:VAT_DEFAULT};}
// Процент — от 0 до 100, максимум два знака. Раньше любая опечатка («20%», «2о»)
// давала NaN, NaN трактовался как 0, и итог молча превращался в «ВСЕГО (без НДС)»:
// КП уходило клиенту дешевле на пятую часть. Невалидное не записываем вовсе.
const PCT_RE=/^\d{0,3}([.,]\d{0,2})?$/;
// Строка настроек сметы. Хранит не только проценты: сюда же ложится всё,
// что человек крутит на смету целиком, — и потому она заводится в одном
// месте, а не там, где очередной расчёт первым до неё дотянулся.
function calcRow(){
  let c=rows.find(x=>x.type==='calc');
  if(!c){c={id:rid(),type:'calc',transportPct:2,overheadPct:3,machinesPct:1,vatPct:VAT_DEFAULT};rows.unshift(c);}
  return c;}
function setCalc(k,v){
  if(!canEdit())return false;   // только просмотр: проценты в смете не наши
  let c=calcRow();
  const s=String(v==null?'':v).trim();
  const el=document.querySelector('[data-calc="'+k+'"]');
  if(s!==''&&(!PCT_RE.test(s)||+s.replace(',','.')>100)){if(el)el.classList.add('fwarn');return false;}
  if(el)el.classList.remove('fwarn');
  c[k]=s.replace(',','.');saveCur();return true;}
function categorize(){const cat={main:{ob:0,mon:0},reserve:{ob:0,mon:0},additional:{ob:0,mon:0},docs:{ob:0,mon:0},pnr:{ob:0,mon:0}};
  let cur='main';
  for(const r of rows){if(r.type==='calc')continue;
    if(r.type==='section'){cur=SECKINDS[r.kind]?r.kind:'main';continue;}
    const q=+r.qty||0;cat[cur].ob+=(+r.retail||0)*q;cat[cur].mon+=(+r.montazh||0)*q;}
  return cat;}
function calcResults(){const c=calcCfg(),cat=categorize();
  const tp=+c.transportPct||0,op=+c.overheadPct||0,mp=+c.machinesPct||0,vp=+c.vatPct||0,tt=k=>cat[k].ob+cat[k].mon;
  // Базы как в эталоне КП: % от итога раздела «Основное оборудование»
  const mainT=tt('main');
  const mach=Math.round(mainT*mp)/100;
  const ov=Math.round(mainT*op)/100;
  const trans=Math.round(mainT*tp)/100;
  const total=tt('main')+tt('reserve')+tt('additional')+tt('docs')+tt('pnr')+mach+ov+trans;
  const vat=vp?Math.round(total*vp/(100+vp)*100)/100:0; // НДС «в т.ч.» (цены уже с НДС)
  return {cat,tp,op,mp,vp,mach,trans,ov,sub:total,vat,total};}
function renderCalcPanel(){const el=$('#calcpanel');if(!el)return;const r=calcResults(),m=money;
  // Без права правки проценты видны, но не редактируются, а кнопки «＋ раздел»
  // не рисуются: они меняют состав сметы.
  const ro=canEdit()?'':' readonly';
  // Проценты накрутки — наша раскладка, а не заказчика. По публичной ссылке,
  // открытой на просмотр, от строки остаются название и сумма.
  const pctOpen=!(PUB&&!canEdit());
  const pctRow=(label,key,pct,cv,val)=>`<div class="cline"><span>${label}${pctOpen?` <input class="fmini" data-calc="${key}" value="${esc(pct||'')}"${ro}>%`:''}</span><b data-cv="${cv}">${m(val)}</b></div>`;
  const catRow=(label,k,addk)=>`<div class="cline"><span>${label}${(addk&&canEdit())?` <button class="btn sm" data-addkind="${addk}">＋ раздел</button>`:''}</span><b data-cv="${k}">${m(r.cat[k].ob+r.cat[k].mon)}</b></div>`;
  el.innerHTML=`<div class="calchead">Итоги по КП</div>
    ${entLineHTML()}
    ${catRow('Основное оборудование','main','')}
    ${catRow('Резервное оборудование','reserve','reserve')}
    ${catRow('Дополнительное оборудование','additional','additional')}
    ${catRow('Документация','docs','docs')}
    ${catRow('Пусконаладочные работы','pnr','pnr')}
    ${pctRow('Машины и механизмы, допоборуд.','machinesPct',r.mp,'mach',r.mach)}
    ${pctRow('Накладные расходы','overheadPct',r.op,'ov',r.ov)}
    ${pctRow('Транспортные расходы','transportPct',r.tp,'trans',r.trans)}
    <div class="cline"><span>В т.ч. НДС <input class="fmini" data-calc="vatPct" value="${esc(r.vp||'')}"${ro}>%</span><b data-cv="vat">${m(r.vat)}</b></div>
    <div class="cline total"><span>${r.vp>0?'ВСЕГО с НДС':'ВСЕГО (без НДС)'}</span><b data-cv="total">${m(r.total)}</b></div>`;}
function updateCalcValues(){const el=$('#calcpanel');if(!el||!el.innerHTML)return;const r=calcResults();
  const set=(k,v)=>{const b=el.querySelector('[data-cv="'+k+'"]');if(b)b.textContent=v;};
  ['main','reserve','additional','docs','pnr'].forEach(k=>set(k,money(r.cat[k].ob+r.cat[k].mon)));
  set('mach',money(r.mach));set('trans',money(r.trans));set('ov',money(r.ov));set('vat',money(r.vat));set('total',money(r.total));}
// Вкладка сметы: КП клиенту или себестоимость. Позиции у них одни и те же,
// разные только колонки — второго списка нет, и разойтись им негде.
const TK='fse_kp_tab';
let TAB='kp';
function costMode(){return TAB==='cost'&&can('cost:read');}
// Конъюнктурный анализ показывает цены поставщиков — то же право, что и
// себестоимость: без него эти цены не приходят с сервера вовсе.
// Конъюнктурный анализ ведёт тот, кто составляет смету, и открыт он так же,
// как сам конструктор (ADR-0033): цены в нём — рыночные предложения магазинов,
// те же, что каталог показывает любому сотруднику. Гриф себестоимости
// закрывает другое — оптовую закупку и маржу. По публичной ссылке вкладки
// нет: заказчику отдают КП, а не наш разбор поставщиков.
function kaMode(){return TAB==='ka'&&!PUB&&!!window.KA;}
function tabStore(){try{return JSON.parse(localStorage.getItem(TK)||'{}')}catch(e){return {}}}
// Вкладку помним на смету, а не на приложение: закупку вписывают по всей
// смете за один заход, и возврат на КП после каждого ухода в другой раздел —
// лишняя работа, а у разных смет разная стадия.
function tabOK(t){return t==='ka'?!PUB:(t==='cost'?can('cost:read'):true);}
function loadTab(){const t=tabStore()[curId];
  TAB=((t==='cost'||t==='ka')&&tabOK(t))?t:'kp';}
function setTab(t){TAB=((t==='cost'||t==='ka')&&tabOK(t))?t:'kp';
  try{const m=tabStore();m[curId]=TAB;localStorage.setItem(TK,JSON.stringify(m));}catch(e){}
  render();}
// Смахивание по списку позиций листает вкладки сметы: на телефоне вкладки
// стоят в карточке, и на длинной смете до них далеко. Влево — следующая.
// Левый край занят смахиванием бокового меню (kp-09.js), ручка — перетаскиванием
// строки; жест внутри того, что само листается вбок, остаётся его прокруткой.
function tabOrder(){return ['kp','cost','ka'].filter(t=>t==='kp'||tabOK(t));}
function swipeOwned(el){
  for(;el&&el.id!=='editorView';el=el.parentElement){
    if(el.matches('input,textarea,select,.drag,.catpanel'))return true;
    const ox=getComputedStyle(el).overflowX;
    if((ox==='auto'||ox==='scroll')&&el.scrollWidth>el.clientWidth+1)return true;}
  return false;}
(function(){
  let x0=0,y0=0,on=false;
  document.addEventListener('touchstart',e=>{
    const t=e.touches&&e.touches[0];
    on=!!(t&&e.touches.length===1&&!PUB&&window.innerWidth<=900&&t.clientX>24
      &&e.target.closest&&e.target.closest('#editorView #list')&&!swipeOwned(e.target));
    if(on){x0=t.clientX;y0=t.clientY;}
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!on)return;on=false;
    const t=e.changedTouches&&e.changedTouches[0];if(!t)return;
    const dx=t.clientX-x0,dy=Math.abs(t.clientY-y0);
    if(Math.abs(dx)<60||dy>40||Math.abs(dx)<2*dy)return;
    const ord=tabOrder(),i=ord.indexOf(TAB),j=i+(dx<0?1:-1);
    if(i<0||j<0||j>=ord.length)return;
    setTab(ord[j]);
    // Вкладки в карточке могли уйти за верх экрана — куда попали, говорит подсказка.
    const l=document.querySelector('#tabbar .stab.on .lbl');if(l)toast(l.textContent,900);
  },{passive:true});
})();
function tabsHTML(){
  const b=(k,ic,lbl,ttl)=>`<button class="stab${TAB===k?' on':''}" data-act="tab" data-tab="${k}" title="${ttl}"><svg class="i"><use href="#${ic}"/></svg><span class="lbl">${lbl}</span></button>`;
  if(PUB)return '';
  return b('kp','i-doc','КП клиенту','Цена для клиента')
    +(can('cost:read')?b('cost','i-rub','Себестоимость','Себестоимость и маржа — видите только вы'):'')
    +b('ka','i-tbl','Конъюнктурный анализ','Цены поставщиков для экспертизы — Методика 421/пр');}
// Вход в подбор — кнопка в полосе вкладок за разделителем: видно, что это
// не третья вкладка, а переключатель. Открытая панель держит её нажатой
// и числом отмеченных производителей — число пишется той же строкой подписи,
// потому что decorate() сводит содержимое кнопки в единственный .lbl.
function catBtnHTML(){
  if(PUB||!canEdit())return '';
  const n=catSel.size?' · '+catSel.size:'';
  return `<span class="tsep"></span>`
    +`<button class="btn${catShown?' on':''}" data-act="catbtn" title="Подбор из каталога">`
    +`<svg class="i"><use href="#i-filt"/></svg><span class="lbl">Из каталога${n}</span></button>`;}
function updTabs(){
  if(!tabOK(TAB))TAB='kp';
  document.body.classList.toggle('kaon',kaMode());
  // Полоса стоит всегда: кроме вкладок она несёт вход в подбор и единицу
  // денег, названную один раз на всю таблицу. На вкладке анализа к ним
  // добавляются её собственные действия.
  const tb=$('#tabbar');
  if(tb){tb.style.display='';
    tb.innerHTML=`<div class="stabs">${tabsHTML()}${kaMode()?'':catBtnHTML()}</div>`
      +(kaMode()?KA.actsHTML():`<span class="hint curnote">все суммы — ₽</span>`);}
  const ec=document.querySelector('[data-act="export-cost"]');
  if(ec)ec.style.display=costMode()?'':'none';
  clientXlsxBtn();
  const th=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  // Подписи анализа такие же короткие, как у двух других вкладок: слоты
  // общей сетки узкие, а полные названия стоят в label ячеек и читаются
  // на телефоне, где строка складывается.
  th('thPrice',kaMode()?'Цен':(costMode()?'Закупка':'Цена об.'));
  th('thSum',kaMode()?'Мин.':(costMode()?'Оборуд.':'Сумма'));
  th('thMonP',kaMode()?'Принято':(costMode()?'Цена работ':'Цена монт.'));
  th('thMon',kaMode()?'Сумма':'Монтаж');
  th('thTot',kaMode()?'Поставщик':(costMode()?'Себес':'Всего'));}
// КАЖДОЕ значение позиции уходит в HTML-атрибут через esc(). Массив позиций
// приходит с сервера и правится по публичной ссылке кем угодно: незакрытая
// кавычка в qty или id — и в разметку встаёт чужой обработчик, который
// выполнится в сессии директора, где лежат его данные.
function rowHTML(r,i){
  if(r.type==='calc')return '';
  const ro=canEdit()?'':' readonly';                 // только чтение: поля видны, но не правятся
  // Заголовок раздела отмечается и переезжает наравне с позициями: без галочки
  // его нельзя было взять в пачку, и группа строк переставлялась без своего заголовка.
  if(r.type==='section'){const st=sectionSubtotal(i);const kn=SECKINDS[r.kind];
    return `<div class="rowwrap section${kn?' kind':''}${sel.has(r.id)?' sel':''}" data-id="${esc(r.id)}"><div class="secrow">
      ${canEdit()?'<div class="drag" title="перетащить">⋮⋮</div>':''}
      ${canEdit()?`<input type="checkbox" class="pick" data-act="sel"${sel.has(r.id)?' checked':''} title="выбрать раздел">`:''}
      ${kn?`<b class="seckind">${esc(kn)}</b>`:''}
      <input class="secttl" data-f="title" value="${esc(r.title||'')}" placeholder="${kn?'уточнение (необязательно)':'Название помещения / шифр проекта'}"${ro}>
      ${canEdit()?'<button class="btn sm" data-act="addrow">＋ строка</button>':''}
      <span class="secsum">${secSumHTML(st,i)}</span>
      ${canEdit()?'<div class="mn" data-act="rowmenu">⋯<div class="menu"><div data-act="dupsec">Дублировать с позициями</div><div data-act="del">Удалить раздел</div></div></div>':''}
    </div></div>`;}
  const sc=sel.has(r.id)?'sel':'';const nf=needsPrice(r)?'needs':'';
  const num=rows.slice(0,i).filter(x=>x.type!=='section'&&x.type!=='calc').length+1;
  const badge=`<span class="attn">${attnHTML(r)}</span>`;
  const wk=r.work?'<span class="chip-wk">работа</span>':'';
  // Предупреждение о магазине уместно там, где магазин есть: у строки,
  // вписанной руками, подтверждать нечего, а название в ней правят всегда.
  const flag=(r.nameEdited&&(r.url||(r.offers&&r.offers.length)))?'<span class="flag">название изменено — магазин не подтверждён</span>':'';
  // На вкладке анализа во второй строке стоит счётчик предложений, и он же
  // раскрывает блок поставщиков: магазин каталога там не при чём.
  const meta=r.work?'':(kaMode()?KA.lineHTML(r):rowMetaHTML(r));
  return `<div class="rowwrap ${sc} ${nf}" data-id="${esc(r.id)}"><div class="row">
    ${canEdit()?'<div class="drag" title="перетащить">⋮⋮</div>':'<div></div>'}
    <div>${canEdit()?`<input type="checkbox" data-act="sel" ${sel.has(r.id)?'checked':''}>`:''}</div>
    <div class="sub">${num}</div>
    <div class="cell namecell"><div class="nmField" data-f="name" title="${esc(r.name)}"${ro?'':' contenteditable="plaintext-only"'}>${esc(r.name)}</div>${wk}${badge}${srcPill(r)}${flag}
      ${meta}${suggestHTML(r)}</div>
    <div class="cell"><label>Ед.</label><input class="f${mtClass(r.unit)}" data-f="unit" value="${esc(r.unit||'')}"${ro}></div>
    <div class="cell num"><label>Кол-во</label><input class="f${mtClass(r.qty)}" data-f="qty" value="${esc(r.qty)}"${ro}></div>
    ${kaMode()?KA.cellsHTML(r):(costMode()?costCellsHTML(r,ro):kpCellsHTML(r,ro))}
    ${canEdit()?'<div class="mn" data-act="rowmenu">⋯<div class="menu"><div data-act="dup">Дублировать</div><div data-act="del">Удалить</div></div></div>':'<div></div>'}
    </div>${costMode()&&!r.work&&window.purFactHTML?purFactHTML(r):''}${kaMode()?KA.offersBlock(r):offersHTML(r)}</div>`;}
// Поле, в которое ещё не вводили, помечается подложкой — подсказка, а не
// ошибка. Приём один на обе вкладки: на вкладке КП пустое поле раньше
// не отличалось от заполненного.
function mtClass(v){return String(v==null?'':v).trim()?'':' todo';}

// Вторая строка позиции. Артикул первым — по нему ищут чаще, чем по названию;
// магазин ссылкой и наличие точкой стоят вместе справа, у своей цены. Набор
// тот же, что в строке подсказки поиска: один смысл — один вид на экране.
function rowMetaHTML(r){
  const offs=r.offers||[];
  const off=(r.chosen>=0&&offs[r.chosen])?offs[r.chosen]:null;
  const parts=[];
  parts.push(r.code?`<span class="n art" title="Артикул поставщика">${esc(r.code)}</span>`
    :'<span class="art">без артикула</span>');
  if(off){
    parts.push(lk(r.url,off.shop,'shop')||`<span class="shop">${esc(off.shop)}</span>`);
    const st=stockOf(off);
    parts.push(`<span class="st ${st.cls}" title="${{in:'В выбранном магазине есть в наличии',
      out:'В выбранном магазине нет в наличии — только под заказ',
      na:'Магазин не сообщает остаток — уточните при заказе'}[st.cls]}"><i></i>${st.lbl}</span>`);
    if(offs.length>1)parts.push(`<span class="offerline" data-act="toggleoffers" `
      +`title="Другие предложения магазинов">ещё ${offs.length-1}</span>`);
  }else if(offs.length){
    parts.push(`<span class="offerline" data-act="toggleoffers" title="Предложения магазинов">`
      +`выбрать магазин — ${offs.length} `+catPlural(offs.length,'предложение','предложения','предложений')+`</span>`);
  }else{
    parts.push('<span class="shop">магазина нет · вписана вручную</span>');
  }
  return `<div class="rowmeta">${parts.join('<span class="sep">·</span>')}</div>`;}

// Пять колонок после «Кол-во» — единственное, чем вкладки различаются.
// Сетка .thead/.row у них общая: ширины не меняются, строка не подпрыгивает
// при переключении, и складывание на телефоне работает готовым правилом.
function kpCellsHTML(r,ro){const q=+r.qty||0,ret=+r.retail||0,mon=+r.montazh||0;
  return `<div class="cell num"><label>Цена об. ₽</label><input class="f${mtClass(r.retail)}" data-f="retail" value="${esc(r.retail||'')}"${ro}></div>
    <div class="cell num"><label>Сумма ₽</label><b class="n" data-c="sum">${money(ret*q)}</b></div>
    <div class="cell num"><label>Цена монт. ₽</label><input class="f${mtClass(r.montazh)}" data-f="montazh" value="${esc(r.montazh||'')}"${ro}></div>
    <div class="cell num"><label>Монтаж ₽</label><b class="n" data-c="mon">${money(mon*q)}</b></div>
    <div class="cell num"><label>Всего ₽</label><b class="n" data-c="tot">${money((ret+mon)*q)}</b></div>`;}
// Колонки себестоимости стоят в тех же ролях, что и колонки КП: против цены
// оборудования — оптовая закупка, против цены монтажа — то, что берёт бригада.
// Так строка читается насквозь, а не двумя несравнимыми таблицами.
// Пустое поле подсвечивается у той части, которой позиция и состоит:
// у работы это монтаж, у оборудования — закупка.
function costCellsHTML(r,ro){const em=costEmpty(r),pr=rowPrice(r);
  const pct=(!em&&pr>0)?Math.round((pr-rowCost(r))/pr*1000)/10:null;
  return `<div class="cell num"><label>Закупка ₽</label><input class="f${(em&&!r.work)?' todo':''}" data-f="zakup" value="${esc(r.zakup||'')}" placeholder="—"${ro}></div>
    <div class="cell num"><label>Оборуд. ₽</label><b class="n" data-c="cob">${money(rowCostOb(r))}</b></div>
    <div class="cell num"><label>Цена работ ₽</label><input class="f${(em&&r.work)?' todo':''}" data-f="zakupMon" value="${esc(r.zakupMon||'')}" placeholder="—"${ro}></div>
    <div class="cell num"><label>Монтаж ₽</label><b class="n" data-c="cmon">${money(rowCostMon(r))}</b></div>
    <div class="cell num"><label>Себес ₽</label><b class="n" data-c="csum">${em?'—':money(rowCost(r))}</b>
      <div class="${pct==null?'sub':'sub mg '+mgLevel(pct)}" data-c="cpct">${pct==null?'маржа —':'маржа '+pct+'%'}</div></div>`;}
// Пересчёт по вводу правит ячейки на месте: перерисовка списка увела бы
// каретку из поля, в котором печатают.
function updCostCells(rw,r){const em=costEmpty(r),pr=rowPrice(r);
  const pct=(!em&&pr>0)?Math.round((pr-rowCost(r))/pr*1000)/10:null;
  const set=(k,v,cls)=>{const el=rw.querySelector('[data-c="'+k+'"]');if(!el)return;el.textContent=v;if(cls!=null)el.className=cls;};
  set('cob',money(rowCostOb(r)));
  set('cmon',money(rowCostMon(r)));
  set('csum',em?'—':money(rowCost(r)));
  set('cpct',pct==null?'маржа —':'маржа '+pct+'%',pct==null?'sub':'sub mg '+mgLevel(pct));
  const fo=rw.querySelector('input[data-f="zakup"]');if(fo)fo.classList.toggle('todo',em&&!r.work);
  const fm=rw.querySelector('input[data-f="zakupMon"]');if(fm)fm.classList.toggle('todo',em&&!!r.work);
  const pl=rw.querySelector('.pill.src');if(pl&&!r.costSrc)pl.remove();}
function totals(){return rows.reduce((a,r)=>{if(r.type==='section'||r.type==='calc')return a;const q=+r.qty||0;a.ob+=(+r.retail||0)*q;a.mon+=(+r.montazh||0)*q;return a},{ob:0,mon:0})}
// Итог по себестоимости считается по тем позициям, где она вписана, и рядом
// сказано, по скольким: маржа по половине сметы, поданная как маржа сметы,
// хуже отсутствия числа.
function costTotals(){return rows.reduce((a,r)=>{if(r.type==='section'||r.type==='calc')return a;
  a.n++;if(costEmpty(r)){a.gaps++;return a}
  a.ob+=rowCostOb(r);a.mon+=rowCostMon(r);a.zak+=rowCost(r);a.price+=rowPrice(r);return a},{ob:0,mon:0,zak:0,price:0,gaps:0,n:0})}
function updFoot(){
  if(kaMode()){const f=KA.footHTML();$('#foot').innerHTML=f.row;$('#footm').innerHTML=f.mob;return;}
  if(costMode())return updFootCost();
  const t=totals(),tot=t.ob+t.mon;
  $('#foot').innerHTML=`<span></span><span></span><span></span><div><b>ИТОГО</b></div><span></span><span></span><span></span><b class="n num">${money(t.ob)}</b><span></span><b class="n num">${money(t.mon)}</b><b class="n num">${money(tot)}</b><span></span>`;
  $('#footm').innerHTML=`<span>Оборуд / Монтаж / Всего</span><b>${money(t.ob)} / ${money(t.mon)} / ${money(tot)}</b>`;}
// Маржа ушла из колонок в подпись под «ИТОГО»: колонки заняты теми же
// пятью ролями, что на вкладке КП, и вердикт по всей смете читается строкой,
// а не числом, которое нечем подписать.
function updFootCost(){const t=costTotals(),mg=t.price-t.zak;
  const pct=t.price>0?Math.round(mg/t.price*1000)/10:null;
  const note=(pct==null?'маржа не считается':`маржа ${money(mg)} ₽ · ${pct}%`)
    +(t.gaps?` · по ${t.n-t.gaps} позициям из ${t.n}`:'');
  const cls=pct==null?'sub':'sub mg '+mgLevel(pct);
  $('#foot').innerHTML=`<span></span><span></span><span></span><div><b>ИТОГО</b><div class="${cls}">${note}</div></div><span></span><span></span><span></span><b class="n num">${money(t.ob)}</b><span></span><b class="n num">${money(t.mon)}</b><b class="n num">${money(t.zak)}</b><span></span>`;
  $('#footm').innerHTML=`<span>Оборуд / Монтаж / Себес</span><b>${money(t.ob)} / ${money(t.mon)} / ${money(t.zak)}</b>`;}
function renderSelbar(){const sb=$('#selbar');
  if(mergePick){const items=rows.filter(x=>sel.has(x.id));
    sb.classList.add('on');sb.innerHTML=`<b>Объединить — оставить какой вариант?</b>${items.map(x=>`<button class="btn sm" data-keepmerge="${esc(x.id)}">${esc((x.name||'').slice(0,28))}</button>`).join('')}<button class="btn sm" data-act="cancelmerge">Отмена</button>`;return;}
  sb.classList.toggle('on',sel.size>0);
  // На вкладке анализа полоса выбора делает одно: процент по отмеченным.
  // Удаление и объединение позиций живут там, где правят состав сметы.
  if(kaMode()){if(sel.size)sb.innerHTML=KA.selbarHTML(sel.size);return;}
  // Объединять разделы нечего: у заголовка нет ни количества, ни цены, —
  // с ним в наборе кнопка не показывается вовсе.
  const onlyRows=!rows.some(x=>sel.has(x.id)&&x.type==='section');
  if(sel.size)sb.innerHTML=`<b>${sel.size}</b><span>выбрано:</span>${onlyRows?'<button class="btn sm" data-act="merge">⛓ Объединить</button>':''}<button class="btn sm" data-act="dupsel">Дублировать</button><button class="btn sm danger" data-act="delsel">🗑 Удалить</button><button class="btn sm" data-act="selall">Выбрать все</button><button class="btn sm" data-act="clearsel">Снять</button>`;}
let sortable=null;
function render(){updTabs();applyEditPerm();const s=specs.find(x=>x.id===curId)||{};fixTinkoLinks(rows);
  $('#etitle').textContent=s.title||'';updMeta();$('#objname').textContent=s.title||'';
  // Пустая смета на вкладке себестоимости — не пустой список, а объяснение:
  // сюда приходят считать, и считать пока нечего.
  $('#list').innerHTML=(costMode()&&!rows.some(x=>x.type!=='calc'))
    ?UI.empty({icon:'i-rub',title:'Считать себестоимость пока не на чем',
      text:'В смете нет позиций. Добавьте их на вкладке «КП клиенту» — здесь появятся те же.'})
    :rows.map(rowHTML).join('');
  updFoot();renderCalcPanel();renderSelbar();catRender();
  // Шапка документа КА стоит над липкой группой: её заполняют один раз,
  // а таблицу читают весь день.
  if(window.KA)KA.renderHead();
  // Экземпляр Sortable держим один. Раньше каждый render() навешивал новый
  // поверх старого: обработчики копились, одна перестановка обрабатывалась
  // по нескольку раз, а на длинной смете это заметно ело память.
  if(sortable){try{sortable.destroy();}catch(e){}sortable=null;}
  // Перетаскивание ведёт сама библиотека, а не нативный механизм браузера:
  // на нативном её автопрокрутка не работает — страница едет только в полосе
  // у самой кромки окна и силами Chrome, а scrollSensitivity и scrollSpeed
  // на это не влияют. Без прокрутки позицию переносят рывками: дотащить,
  // отпустить, прокрутить колесом, снова зажать.
  sortable=new Sortable($('#list'),{handle:'.drag',animation:150,disabled:!canEdit(),
    forceFallback:true,scroll:true,scrollSensitivity:100,scrollSpeed:20,
    // Пока строку тащат, мышь красит текст под курсором: своё перетаскивание
    // библиотеки — это обычное нажатие, а не жест браузера.
    onStart:()=>document.body.classList.add('dnd'),
    onEnd:ev=>{document.body.classList.remove('dnd');const drag=ev.item&&ev.item.dataset.id;
      // Sortable переносит только ту строку, за которую потянули. Отмеченные
      // едут пачкой: набор снимаем до пересортировки, там он идёт в порядке сметы.
      const pack=(drag&&sel.has(drag)&&sel.size>1)?rows.filter(x=>sel.has(x.id)):null;
      const ids=[...$('#list').children].map(e=>e.dataset.id);
      rows.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
      if(pack){const at=rows.slice(0,rows.findIndex(x=>x.id===drag)).filter(x=>!sel.has(x.id)).length;
        const rest=rows.filter(x=>!sel.has(x.id));rest.splice(at,0,...pack);rows=rest;}
      saveCur();render();}});
  // saveCur() отсюда убран. render() вызывается и на чистом чтении — при открытии
  // сметы и после получения чужих правок по ссылке, — и безусловное сохранение
  // отправляло на сервер то, что мы только что прочитали. Сохраняем теперь строго
  // в тех местах, где данные действительно изменились.
}

// Молчащий сборщик виден там, где выбирают цену, а не только в «Обзоре»:
// подсказка поиска — единственный экран, который сметчик открывает всегда.
function catalogWarnHTML(){
  const bad=catalogTrouble();
  if(!bad.length)return '';
  // Внимание, а не отказ: выдача при этом рабочая, и красным она спорила
  // с точкой наличия, у которой красный значит «под заказ».
  return `<div class="errbox x">`
    +`<p>Цены не обновляются: ${bad.map(s=>esc(s.name)).join(', ')}. `
    +`Проверьте на «Обзоре»</p>`
    +`<button type="button" title="Скрыть" aria-label="Скрыть" data-act="dropwarnhide">`
    +`<svg class="i"><use href="#i-x"/></svg></button></div>`;
}

// дебаунс поиска-по-вводу (как у Тинко/ЭТМ): ищем через 160 мс после паузы
let _sugT=null;
function debouncedSuggest(v){clearTimeout(_sugT);
  if((v||'').trim().length<SEARCH_MIN){dropClose();return;}
  _sugT=setTimeout(()=>suggest(v),160);}
// Строка подсказки собрана так, чтобы позицию узнавали в лицо: названия
// в каталоге отличаются одним размером в конце, и по буквам их не вычитывают.
// Место под снимок держит габарит и пустым — когда сбор снимков появится
// (#365), список не поедет.
function dropSpeedHTML(txt){return `<div class="c dspeed">${esc(txt)}</div>`;}
function dropManualHTML(){const v=$('#q').value.trim();
  return `<div class="dman" data-manual="1"><b>＋ Добавить «${esc(v)}» вручную</b>`
    +`<div class="c">нет в базе — впишете цену</div></div>`;}
// Возраст цены — третьей строкой и только у устаревшей. В строке метаданных
// он заглушил бы наличие, а решение принимают по наличию.
function dropStaleHTML(o){
  if(!o||!o.stale)return '';
  const d=o.updated?fmtDate(o.updated).slice(0,5):'';
  const t=d?`цена от ${d}`:'сборщик здесь не был';
  return `<div style="margin-top:4px"><span class="pill old" style="margin-left:0"`
    +` title="Сборщик давно не заходил за этой ценой">${esc(t)}</span></div>`;
}
// Снимок позиции (#365): у ЭТМ и ЛУИС он приходит ссылкой на их же хост,
// у Тинко и Лайты его нет. Без ссылки — рамка «нет фото» тех же 42 px:
// строка не меняет высоту от того, есть картинка или нет. Ссылка ведёт на
// чужой сайт, поэтому referrer не отдаём. Не открылась — та же рамка.
function phHTML(c){
  if(!c.image)return `<span class="ph" title="Снимка у поставщика нет">нет фото</span>`;
  return `<img class="ph" src="${esc(c.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}
document.addEventListener('error',e=>{
  const el=e.target;if(!el||el.tagName!=='IMG'||!el.classList.contains('ph'))return;
  const s=document.createElement('span');s.className='ph';
  s.title='Снимок у поставщика не открылся';s.textContent='нет фото';el.replaceWith(s);
},true);
function dropRowHTML(c,idx){
  // Позиция из перечня без цены: наличия и магазина у неё нет, есть откуда она
  if(!(c.offers||[]).length)return `<div class="drow" data-pick="${idx}">`
    +phHTML(c)
    +`<div class="nm">`
      +`<div class="tl"><div class="t">${esc(c.name)}</div>`
      +`<span class="pr noprice">нет цены</span></div>`
      +`<div class="mt"><span class="n art" title="Артикул">${esc(c.code||'')}</span>`
      +`<span class="shop">${esc((c.listed||[]).join(', '))}</span></div>`
    +`</div></div>`;
  const bi=bestOffer(c.offers);const b=bi>=0?c.offers[bi]:((c.offers||[])[0]||{price:0});
  const more=(c.offers||[]).length-1;
  // Наличие — по всему каталогу, а не по выбранному предложению: «есть хоть
  // у кого-то» и решает, ждать поставку или нет.
  const offs=c.offers||[];
  const st=offs.some(o=>o.stock===true)
    ? `<span class="st in" title="Есть в наличии хотя бы у одного магазина"><i></i>в наличии</span>`
    : offs.some(o=>o.stock==null)
    ? `<span class="st na" title="Не все магазины сообщают остаток — уточните при заказе"><i></i>уточнить</span>`
    : `<span class="st out" title="Ни у одного магазина нет в наличии — только под заказ"><i></i>под заказ</span>`;
  const shop=esc(b.shop||'')+(more>0?' +'+more:'');
  return `<div class="drow" data-pick="${idx}">`
    +phHTML(c)
    +`<div class="nm">`
      +`<div class="tl"><div class="t">${esc(c.name)}</div>`
      +`<b class="n pr">${money(b.price)} ₽</b></div>`
      +`<div class="mt"><span class="n art" title="Артикул поставщика">${esc(c.code||'')}</span>`
      +st
      +`<span class="shop" title="Магазин с лучшей ценой">${shop}</span></div>`
      +dropStaleHTML(b)
    +`</div></div>`;
}
async function suggest(q){const d=$('#drop');if(q.trim().length<SEARCH_MIN){dropClose();return}
  const seq=++suggest._seq;dropSel=-1;
  d.innerHTML=dropSpeedHTML('идёт поиск…')+UI.loading(4);d.classList.add('on');
  const m=await searchProducts(q);if(seq!==suggest._seq)return;
  lastResults=m;setSpeed('поиск '+lastSearchMs+' мс');dropSel=-1;
  // Каталог не ответил — это не «ничего не нашлось»: пустая выдача сказала бы,
  // что позиции нет, и сметчик вписал бы её руками при живой цене в базе.
  if(searchFailed){d.innerHTML=UI.error({title:'Каталог не ответил',
      text:'Поиск по базе недоступен. Позицию можно вписать вручную — цена останется за вами.',
      act:'dropretry',btn:'Повторить'})+dropManualHTML();return}
  if(!m.length){d.innerHTML=dropSpeedHTML(`0 поз. за ${lastSearchMs} мс`)
    +UI.empty({icon:'i-fold',title:'Ничего не нашлось',
      text:'В каталоге нет позиции по такому запросу. Проверьте артикул или впишите позицию вручную.'})
    +dropManualHTML();return}
  d.innerHTML=dropSpeedHTML(`${m.length} поз. за ${lastSearchMs} мс`)+catalogWarnHTML()
    +m.map(dropRowHTML).join('')+dropManualHTML();}
suggest._seq=0;

// Выбор строки клавишами. Отдельный признак от наведения мышью: под курсором
// и под клавишами бывают разные строки, а добавится выбранная.
let dropSel=-1;
function dropClose(){$('#drop').classList.remove('on');dropSel=-1;}
function dropRowEls(){return Array.from($('#drop').querySelectorAll('.drow'));}
function dropMove(step){
  const rs=dropRowEls();if(!rs.length)return;
  dropSel=dropSel<0?(step>0?0:rs.length-1):(dropSel+step+rs.length)%rs.length;
  rs.forEach((el,i)=>el.classList.toggle('sel',i===dropSel));
  const d=$('#drop'),el=rs[dropSel];
  const head=d.querySelector('.dspeed'),off=head?head.offsetHeight:0;
  // Прокручиваем саму подсказку: scrollIntoView увёз бы страницу со сметой.
  if(el.offsetTop-off<d.scrollTop)d.scrollTop=el.offsetTop-off;
  else if(el.offsetTop+el.offsetHeight>d.scrollTop+d.clientHeight)
    d.scrollTop=el.offsetTop+el.offsetHeight-d.clientHeight;
}
function dropSelected(){const rs=dropRowEls();
  return (dropSel>=0&&rs[dropSel])?lastResults[+rs[dropSel].dataset.pick]:null;}

// ══ ПОДБОР ИЗ КАТАЛОГА: ФИЛЬТР ПО ПРОИЗВОДИТЕЛЮ (#348) ══════════════════
// Панель — блок между липкой группой и таблицей сметы, а не выпадающий
// список: смета остаётся на экране, видно, куда кладёшь позицию. Отмеченные
// производители складываются и применяются сразу, кнопки «Применить» нет.
let catShown=false, catBusy=false, catSheet=false;
let catBrands=[];               // [{brand,positions}] — весь список
let catBrandQ='';               // строка поиска по производителям
let catItems=[], catTotal=0, catOffset=0, catErr='';
const catSel=new Set();         // отмеченные производители
const catPick=new Map();        // pid → количество к добавлению
const catById=new Map();
const CAT_TOP=8;                // сколько «частых» показываем над алфавитом
let catFreq=null;               // {recent,popular,brands} — null, пока не загружено
let catFreqQ=true;              // строка была пустой при последней отрисовке
// Своё склонение, а не purPlural из kp-02: тот про закупки, и тянуть имя
// через файл значит завести мост, который ломается молча.
function catPlural(n,a,b,c){const m=Math.abs(n)%100,d=m%10;
  return (m>10&&m<20)?c:(d===1?a:(d>1&&d<5?b:c));}

function catReset(){catSel.clear();catPick.clear();catById.clear();
  catItems=[];catTotal=0;catOffset=0;catBrandQ='';catErr='';catSheet=false;}

// Производители: «частые» — те, что стоят в сметах компании, а не те, у кого
// позиций в каталоге больше: по объёму каталога наверх вставала
// электротехника, а Болида и Рубежа там не было. Пока смет нет — алфавит.
function catBrandList(){
  const q=catBrandQ.trim().toLowerCase();
  const all=catBrands.filter(b=>!q||b.brand.toLowerCase().includes(q));
  if(q)return [['',all]];
  const byName=new Map(all.map(b=>[b.brand,b]));
  const top=((catFreq&&catFreq.brands)||[]).map(f=>byName.get(f.brand)).filter(Boolean).slice(0,CAT_TOP);
  const rest=all.filter(b=>!top.includes(b)).sort((a,b)=>a.brand.localeCompare(b.brand,'ru'));
  return top.length?[['Частые',top],['По алфавиту',rest]]:[['',rest]];
}

function catBrandBtns(){
  return catBrandList().map(([ttl,list])=>(ttl?`<div class="bcg">${esc(ttl)}</div>`:'')
    +list.map(b=>`<button type="button" class="btn sm${catSel.has(b.brand)?' on':''}" `
      +`data-cbrand="${esc(b.brand)}">${esc(b.brand)}`
      +`<span class="cnt n">${(+b.positions||0).toLocaleString('ru-RU')}</span></button>`).join('')
  ).join('');
}

// В шторке галочки, а не переключатели: выдачи на экране нет, спорить
// с выбором позиций не с чем (#186). Свой узел, а не .catrow — у той место
// под снимок и цену, производителю они не нужны.
function catBrandRows(){
  return catBrandList().map(([ttl,list])=>(ttl?`<div class="bcg">${esc(ttl)}</div>`:'')
    +list.map(b=>`<div class="bcrow${catSel.has(b.brand)?' on':''}" data-cbrow="${esc(b.brand)}">`
      +`<input type="checkbox" class="pick" data-cbrand="${esc(b.brand)}"${catSel.has(b.brand)?' checked':''} `
      +`aria-label="Отметить ${esc(b.brand)}">`
      +`<span class="nm">${esc(b.brand)}</span>`
      +`<span class="cnt n hint">${(+b.positions||0).toLocaleString('ru-RU')}</span></div>`).join('')
  ).join('');
}

function catColHTML(sheet){
  return `<div class="brandcol${sheet?' sheet':''}">`
    +`<div class="bch"><span class="ttl">Производитель</span>`
    +`<span class="hint">${catSel.size} из ${catBrands.length}</span></div>`
    +`<div class="bcs"><div class="search"><input id="catbq" placeholder="Найти производителя" `
    +`autocomplete="off" value="${esc(catBrandQ)}"></div></div>`
    +`<div class="bcl">${sheet?catBrandRows():catBrandBtns()}</div>`
    +(sheet?`<div class="bcfoot"><button type="button" class="btn primary" data-catsheet="0">`
      +`Показать ${catTotal.toLocaleString('ru-RU')} ${catPlural(catTotal,'позицию','позиции','позиций')}</button></div>`:'')
    +`</div>`;
}

function catRowHTML(c){
  const bi=bestOffer(c.offers);const b=bi>=0?c.offers[bi]:(c.offers[0]||{price:0});
  const on=catPick.has(c.pid);
  const price=bi>=0?`${stockOf(b).lbl} от ${money(b.price)} ₽`:'<span class="noprice">нет цены</span>';
  return `<div class="catrow${on?' on':''}" data-crow="${c.pid}">`
    +`<input type="checkbox" class="pick" data-cpick="${c.pid}"${on?' checked':''} aria-label="Отметить позицию">`
    +phHTML(c)
    +`<div class="nm"><div class="t">${esc(c.name)}</div><div class="sub">`
    +(c.brand?`<span class="mfr">${esc(c.brand)}</span> · `:'')
    +`${c.code?esc(c.code)+' · ':''}${(c.offers||[]).length} предлож. · ${price}</div></div>`
    +`<div class="qty"><button type="button" data-cqty="${c.pid}" data-d="-1" title="Меньше">`
    +`<svg class="i sm"><use href="#i-minus"/></svg></button>`
    +`<input class="fmini n" data-cnum="${c.pid}" value="${on?catPick.get(c.pid):1}" inputmode="decimal" aria-label="Количество">`
    +`<button type="button" data-cqty="${c.pid}" data-d="1" title="Больше">`
    +`<svg class="i sm"><use href="#i-plus"/></svg></button></div></div>`;
}

function catPagerHTML(){
  const pages=Math.max(1,Math.ceil(catTotal/BRAND_PAGE));
  const cur=Math.floor(catOffset/BRAND_PAGE)+1;
  if(pages<2)return '';
  const btn=(n,lbl,dis)=>`<button type="button" data-cpage="${n}"${dis?' disabled':''}`
    +`${n===cur?' class="on"':''}>${lbl}</button>`;
  const nums=[];
  for(let i=1;i<=pages;i++){
    if(i<=2||i>pages-1||Math.abs(i-cur)<=1)nums.push(btn(i,String(i)));
    else if(nums[nums.length-1]!=='…')nums.push('…');
  }
  return `<div class="pg">${btn(cur-1,'<svg class="i sm"><use href="#i-left"/></svg>',cur<=1)}`
    +nums.map(x=>x==='…'?'<button type="button" disabled>…</button>':x).join('')
    +`${btn(cur+1,'<svg class="i sm"><use href="#i-right"/></svg>',cur>=pages)}</div>`;
}

// Недавнее и популярное стоят на месте выдачи, пока производитель не
// отмечен и строка пуста: это ответ на пустой экран, а не третий список.
// Один ряд на позицию — сервер не повторяет её в двух: строка ищется по pid.
function catFreqHTML(){
  if(!catFreq)return UI.loading(4);
  const grp=(ttl,list)=>list.length?`<div class="catg">${ttl}</div>`+list.map(catRowHTML).join(''):'';
  return grp('Смотрели недавно',catFreq.recent)+grp('Популярное в компании',catFreq.popular);
}
function catFreqAny(){return !catFreq||catFreq.recent.length>0||catFreq.popular.length>0;}

function catSideHTML(){
  const chips=[...catSel].map(b=>`<span class="fchip">${esc(b)}`
    +`<button type="button" class="x" data-cbrand="${esc(b)}" title="Снять ${esc(b)}" `
    +`aria-label="Снять ${esc(b)}"><svg class="i sm"><use href="#i-x"/></svg></button></span>`).join('');
  const q=($('#q')&&$('#q').value.trim())||'';
  catFreqQ=!q;
  const head=`<div class="selflt">${chips}`
    +(catSel.size?`<button type="button" class="btn sm ghost" data-cclear="1">Сбросить всё</button>`:'')
    +`<span class="hint">${catSel.size
        ?catTotal.toLocaleString('ru-RU')+' '+catPlural(catTotal,'позиция','позиции','позиций')
          +' · '+(q?`строка поиска сужает до «${esc(q)}»`:'строка поиска пустая, показано всё')
        :'отметьте производителя слева'}</span></div>`;
  let body;
  if(catErr)body=UI.error({title:'Каталог не ответил',text:catErr});
  else if(catBusy)body=UI.loading(4);
  else if(!catSel.size&&!q&&catFreqAny())body=catFreqHTML();
  else if(!catSel.size)body=UI.empty({icon:'i-filt',title:'Производитель не отмечен',
    text:'Отметьте одного или нескольких — здесь появится их оборудование'});
  else if(!catItems.length)body=UI.empty({title:'Ничего не нашлось',
    text:'Под отмеченными производителями по такому запросу позиций нет'});
  else body=catItems.map(catRowHTML).join('');
  const pager=catPagerHTML();
  return `<div class="catside">${head}<div class="catl">${body}</div>`
    +`<div class="selbar${catPick.size?' on':''}" id="catselbar">`
    +`<span>Отмечено: <b>${catPick.size}</b></span>`
    +`<button type="button" class="btn primary sm" data-cadd="1">`
    +`Добавить в смету</button></div>`
    +(pager?`<div class="catf"><span class="hint">Страница ${Math.floor(catOffset/BRAND_PAGE)+1} из ${Math.max(1,Math.ceil(catTotal/BRAND_PAGE))}</span>${pager}</div>`:'')
    +`</div>`;
}

function catRender(){
  const el=$('#catpanel');if(!el)return;
  if(!catShown){el.style.display='none';el.innerHTML='';return}
  el.style.display='';
  // Шапка — второй способ закрыть панель: блок в потоке не закрывается
  // нажатием мимо, как закрывался выпадающий список.
  const what=catSel.size
    ?`${esc([...catSel].join(', '))} · ${catTotal.toLocaleString('ru-RU')} `
      +catPlural(catTotal,'позиция','позиции','позиций')
    :`${catBrands.length} ${catPlural(catBrands.length,'производитель','производителя','производителей')}`;
  const head=`<div class="cph" role="button" tabindex="0" aria-expanded="true" `
    +`title="Закрыть подбор из каталога">`
    +`<svg class="i"><use href="#i-filt"/></svg>`
    +`<span class="ttl">Подбор из каталога</span>`
    +`<span class="hint cphint">${what}</span>`
    +`<span class="cpx"><span class="hint">Закрыть</span>`
    +`<button type="button" class="btn sm io" data-cfold="1" title="Закрыть подбор">`
    +`<svg class="i"><use href="#i-x"/></svg><span class="lbl">Закрыть</span></button></span>`
    +`<button type="button" class="btn sm io fltbtn" data-catsheet="1" `
    +`title="Производитель"><svg class="i"><use href="#i-filt"/></svg>`
    +`<span class="lbl">Производитель${catSel.size?' · '+catSel.size:''}</span></button></div>`;
  el.innerHTML=head+catColHTML(catSheet)+catSideHTML();
}

function catSyncPick(){
  const bar=$('#catselbar');if(bar){bar.classList.toggle('on',!!catPick.size);
    const b=bar.querySelector('b');if(b)b.textContent=catPick.size;}
}
function catSetPick(pid,on){
  const row=$('#catpanel .catrow[data-crow="'+pid+'"]');
  const num=row&&row.querySelector('[data-cnum]');
  if(on)catPick.set(pid,num&&+num.value>0?+num.value:1); else catPick.delete(pid);
  if(row)row.classList.toggle('on',on);
  const cb=row&&row.querySelector('[data-cpick]');if(cb)cb.checked=on;
  catSyncPick();
}

async function catLoad(){
  if(!catSel.size){catItems=[];catTotal=0;catErr='';catRender();return}
  const seq=++catLoad._seq;
  catBusy=true;catErr='';catRender();
  try{
    const q=($('#q')&&$('#q').value.trim())||'';
    const r=await brandProducts([...catSel],q,catOffset);
    if(seq!==catLoad._seq)return;
    catItems=r.items;catTotal=r.total;
    catItems.forEach(c=>catById.set(c.pid,c));
  }catch(e){if(seq!==catLoad._seq)return;catErr=e.message||'Попробуйте ещё раз';catItems=[];}
  finally{if(seq===catLoad._seq){catBusy=false;catRender();}}
}
catLoad._seq=0;

// Закрытие: панель уходит целиком, отмеченное остаётся — вернувшись, человек
// видит тот же набор производителей, а не пустой фильтр.
function catClose(){catShown=false;catSheet=false;catRender();updTabs();}

// Недавнее грузится при каждом открытии: только что добавленная позиция
// должна встать в него при следующем заходе. Не ответило — панель без него.
async function catOpen(){
  if(PUB||!canEdit())return;
  catShown=true;catFreq=null;catRender();updTabs();
  const fq=loadFrequent().then(f=>{
      f.recent.concat(f.popular).forEach(c=>catById.set(c.pid,c));catFreq=f;},
    ()=>{catFreq={recent:[],popular:[],brands:[]};});
  if(!catBrands.length){
    catBusy=true;catRender();
    try{catBrands=await loadBrands();}
    catch(e){catErr=e.message||'Список производителей не загрузился';}
    finally{catBusy=false;}
  }
  catRender();
  await fq;catRender();
}

function catToggleBrand(b){
  if(catSel.has(b))catSel.delete(b); else catSel.add(b);
  catOffset=0;catPick.clear();catLoad();
}

// Отмеченное уезжает в смету одним действием: набирают несколько позиций,
// добавляют разом. Количество берём из поля рядом с галочкой.
function catAddPicked(){
  const picked=[...catPick.entries()];
  if(!picked.length)return;
  picked.forEach(([pid,qty])=>{const c=catById.get(pid);if(!c)return;
    const r=mkRow(c);r.qty=(+qty>0?+qty:1);rows.push(r);fetchCost(r);});
  catPick.clear();render();saveCur();catRender();
  toast('Добавлено позиций: '+picked.length);
}

// Панель открывает только своя кнопка. Фокусом в строке поиска она
// открывалась, пока другого входа не было; со своей кнопкой в полосе
// вкладок (#402) это второй вход, который срабатывает не тогда, когда
// его звали: в поле вводят название позиции, а панель на каждый заход
// отодвигает смету вниз (#421).

function manualRow(name){return {id:rid(),pid:null,code:'',name:name,unit:'шт',qty:1,montazh:0,zakup:0,zakupMon:0,kupleno:0,work:false,offers:[],chosen:-1,retail:0,url:'',found:false,nameEdited:false}}
// Раздел — это всё, что лежит до следующего заголовка: список плоский,
// принадлежность строки задаётся только порядком.
function secEnd(i){let j=i+1;while(j<rows.length&&rows[j].type!=='section')j++;return j;}
// Новую строку показываем и отдаём под курсор сразу. Иначе она встаёт за краем
// экрана, и её ищут прокруткой.
function focusRow(id){const rw=[...document.querySelectorAll('.rowwrap')].find(x=>x.dataset.id===id);
  const f=rw&&rw.querySelector('.nmField');if(!f)return;
  f.scrollIntoView({block:'center'});f.focus();}
// Строку раздела вписывают руками: документации и пусконаладки в каталоге
// оборудования нет. Встаёт она в конец своего раздела — строки набираются
// подряд, а к разделу их относит порядок в rows, по нему считает categorize().
// Документация и пусконаладка помечаются работой: в сопоставление с УПД такая
// строка не идёт и цены из каталога не ждёт.
function addSectionRow(secId){
  const i=rows.findIndex(x=>x.id===secId);if(i<0)return;
  const kind=rows[i].kind;
  const r=Object.assign(manualRow(''),{work:kind==='docs'||kind==='pnr'});
  rows.splice(secEnd(i),0,r);render();saveCur();focusRow(r.id);}
// saveCur() здесь, а не в render(): позиция добавлена — данные изменились.
function addProduct(c,query){const r=mkRow(c);rows.push(r);if(query)learn(query,(c.code||c.name));fetchCost(r);render();saveCur();}
// Совпадение «уверенно»: артикул совпал ИЛИ название каталога содержит запрос.
// Защищает импорт/поиск от молчаливой подстановки чужого товара с ДРУГОЙ ценой
// (напр. «С2000-М» не должен подтянуть «С2000-К, клавиатуру»).
function _norm(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim();}
function matchConfident(c,p){const want=_norm(p.name||p.article);if(!want)return false;
  const nm=_norm(c.name),art=_norm(c.article||'');
  if(p.article&&art&&_norm(p.article)===art)return true;
  return nm.includes(want)||want.includes(nm.split(',')[0]);}
// выбрать из результатов уверенное совпадение (не просто первое)
function pickMatch(found,p){return (found||[]).find(c=>matchConfident(c,p))||null;}

function exportShops(){
  const spec=specs.find(x=>x.id===curId);
  const title=(spec&&spec.title)?spec.title:'Спецификация';
  const groups={},noOffer=[];
  rows.forEach(r=>{
    if(r.type==='calc'||r.type==='section')return;
    const o=(r.offers&&r.chosen>=0&&r.offers[r.chosen])?r.offers[r.chosen]:null;
    if(o&&o.shop){(groups[o.shop]=groups[o.shop]||[]).push({r:r,o:o});}
    else noOffer.push({r:r,o:null});
  });
  const order=['Тинко','ЛУИС','ЭТМ','Лайта','Всеинструменты.ру'];
  const shops=Object.keys(groups).sort((a,b)=>{
    const ia=order.indexOf(a),ib=order.indexOf(b);
    return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b,'ru');});
  if(!shops.length&&!noOffer.length){toast('Нет позиций для выгрузки');return;}
  const B={style:'thin',color:{rgb:'9AA3B5'}},bAll={top:B,bottom:B,left:B,right:B};
  const stTitle={font:{bold:true,sz:14},alignment:{vertical:'center'}};
  const stHead={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{patternType:'solid',fgColor:{rgb:'1F2A44'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:bAll};
  const stCell={border:bAll,alignment:{vertical:'center',wrapText:true}};
  const stNum={border:bAll,numFmt:'#,##0.00',alignment:{horizontal:'right',vertical:'center'}};
  const stQty={border:bAll,numFmt:'#,##0.###',alignment:{horizontal:'right',vertical:'center'}};
  const stTot={font:{bold:true},border:bAll,numFmt:'#,##0.00',alignment:{horizontal:'right',vertical:'center'}};
  const stTotL={font:{bold:true},border:bAll,alignment:{horizontal:'right',vertical:'center'}};
  const stLink={border:bAll,alignment:{vertical:'center',wrapText:true},font:{color:{rgb:'1155CC'},underline:true}};
  const wb=XLSX.utils.book_new();
  const addSheet=(name,items)=>{
    const ws={'!merges':[],'!cols':[{wch:5.75},{wch:12},{wch:48},{wch:7},{wch:9},{wch:12.5},{wch:14.75},{wch:11},{wch:60}]};
    const put=(rr,c,v,s)=>{ws[XLSX.utils.encode_cell({r:rr,c:c})]={v:v,t:(typeof v==='number'?'n':'s'),s:s};};
    put(0,0,name+' — '+title,stTitle);
    ws['!merges'].push({s:{r:0,c:0},e:{r:0,c:8}});
    ['№','Артикул','Наименование','Ед.','Кол-во','Цена ₽','Сумма ₽','Наличие','Ссылка'].forEach((hd,c)=>put(1,c,hd,stHead));
    let rr=2,num=0,tot=0;
    items.forEach(it=>{
      const r=it.r,o=it.o,q=+r.qty||0,p=o?(+o.price||0):0;
      num++;tot+=p*q;
      put(rr,0,num,stCell);put(rr,1,r.code||'',stCell);put(rr,2,r.name||'',stCell);
      put(rr,3,r.unit||'шт',stCell);put(rr,4,q,stQty);
      if(o){
        put(rr,5,p,stNum);
        ws[XLSX.utils.encode_cell({r:rr,c:6})]={t:'n',v:Math.round(p*q*100)/100,f:XLSX.utils.encode_cell({r:rr,c:4})+'*'+XLSX.utils.encode_cell({r:rr,c:5}),s:stNum};
        put(rr,7,stockOf(o).lbl,stCell);
        const u=o.url||'';const lc={v:u,t:'s',s:u?stLink:stCell};if(u)lc.l={Target:u};
        ws[XLSX.utils.encode_cell({r:rr,c:8})]=lc;
      }else{put(rr,5,'',stCell);put(rr,6,'',stCell);put(rr,7,'',stCell);put(rr,8,'',stCell);}
      rr++;
    });
    put(rr,5,'Итого:',stTotL);
    ws[XLSX.utils.encode_cell({r:rr,c:6})]={t:'n',v:Math.round(tot*100)/100,f:(rr>2?'SUM(G3:G'+rr+')':'0'),s:stTot};
    ws['!ref']='A1:'+XLSX.utils.encode_cell({r:rr,c:8});
    ws['!rows']=[{hpt:22},{hpt:28}];
    XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
  };
  shops.forEach(s=>addSheet(s,groups[s]));
  if(noOffer.length)addSheet('Не найдено',noOffer);
  XLSX.writeFile(wb,'Закупка по магазинам.xlsx');
  toast('Выгрузка по магазинам готова');
}
// Номер идёт в имя файла первым: у заказчика в папке лежат КП от разных
// поставщиков, и имени «КП — Тверская, 7» там мало (#283).
function kpFname(prefix,spec,fallback){
  const clean=String((spec&&spec.title)||'').replace(/[\\/:*?"<>|]/g,'-').trim();
  const parts=[(spec&&spec.number)||'',clean].filter(Boolean);
  return parts.length?prefix+' '+parts.join(' ')+'.xlsx':fallback;
}
function exportXLSX(){
  const spec=specs.find(x=>x.id===curId);
  const head=['№','Код','Наименование','Ед.','Кол-во','Цена об. ₽','Цена монт. ₽','КП всего','Опт. цена ₽','Себес монт. ₽','Себес всего','Маржа ₽','Маржа %','Магазин','Ссылка'];
  const aoa=[head];
  let num=0,sPr=0,sCst=0,gPr=0,gCst=0,open=false;
  const pushSub=()=>{if(!open)return;
    aoa.push(['','','Итого по разделу:','','','','',sPr,'','',sCst,sPr-sCst,'','','']);
    sPr=sCst=0;};
  rows.forEach(r=>{
    if(r.type==='calc')return;
    if(r.type==='section'){pushSub();const st=SECKINDS[r.kind]?SECKINDS[r.kind]+(r.title?' — '+r.title:''):(r.title||'');
      aoa.push(['','','Раздел: '+st,'','','','','','','','','','','','']);
      open=true;return;}
    num++;const q=+r.qty||0,ret=+r.retail||0,mon=+r.montazh||0,zak=+r.zakup||0,zakM=+r.zakupMon||0;
    const pr=rowPrice(r),cst=rowCost(r);
    sPr+=pr;sCst+=cst;gPr+=pr;gCst+=cst;
    const mg=pr?Math.round((pr-cst)/pr*100):0;const sh=r.offers&&r.offers[r.chosen]?r.offers[r.chosen].shop:'';
    aoa.push([num,r.code,r.name,r.unit,q,ret,mon,pr,zak,zakM,cst,pr-cst,mg,sh,r.url]);});
  pushSub();
  aoa.push(['','','ВСЕГО оборуд.+монтаж','','','','',gPr,'','',gCst,gPr-gCst,'','','']);
  const ws=XLSX.utils.aoa_to_sheet(aoa),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Позиции');XLSX.writeFile(wb,kpFname('КП_себестоимость',spec,'КП_себестоимость.xlsx'));toast('Экспорт готов');}

// Excel из раздела «CRM» (#646): форма собирается из открытой сметы, поэтому
// смету сначала открываем — человек заодно видит, из чего файл.
async function kpXlsxOf(uid){
  if(!specs.some(x=>x.id===uid)){toast('Смета этого КП недоступна — возможно, её удалили',4000);return}
  await openSpec(uid);
  if(curId===uid)exportClientXLSX();}

// КП заказчику в Excel формой эталона; основной документ — бланк из Google.
function exportClientXLSX(){
  const R=calcResults();
  const spec=specs.find(x=>x.id===curId);
  const title=['Спецификация',(spec&&spec.number)||''].filter(Boolean).join(' ')
    +(spec&&spec.title?' — '+spec.title:'');
  const B={style:'thin',color:{rgb:'9AA3B5'}};const bAll={top:B,bottom:B,left:B,right:B};
  const stTitle={font:{bold:true,sz:14},alignment:{vertical:'center'}};
  const stHead={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{patternType:'solid',fgColor:{rgb:'1F2A44'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:bAll};
  const stSec={font:{bold:true},fill:{patternType:'solid',fgColor:{rgb:'E8ECF5'}},border:bAll,alignment:{vertical:'center'}};
  const stCell={border:bAll,alignment:{vertical:'center',wrapText:true}};
  const stNum={border:bAll,numFmt:'#,##0.00',alignment:{horizontal:'right',vertical:'center'}};
  const stTot={font:{bold:true},border:bAll,numFmt:'#,##0.00',alignment:{horizontal:'right',vertical:'center'}};
  const stTotL={font:{bold:true},border:bAll,alignment:{horizontal:'right',vertical:'center'}};
  const ws={'!merges':[],'!cols':[{wch:5.75},{wch:41},{wch:9},{wch:8},{wch:12.5},{wch:14.75},{wch:12.5},{wch:14.75},{wch:16},{wch:22}]};
  const put=(r,c,v,s,f)=>{const ref=XLSX.utils.encode_cell({r:r,c:c});const cell={v:v==null?'':v,t:typeof v==='number'?'n':'s',s:s||stCell};if(f){cell.f=f;cell.t='n';}ws[ref]=cell;};
  const mrg=(r1,c1,r2,c2)=>ws['!merges'].push({s:{r:r1,c:c1},e:{r:r2,c:c2}});
  let r=0;
  put(r,0,title,stTitle);mrg(r,0,r,9);r++;
  const entCfg=calcCfg();const entSel=((typeof ENT!=='undefined'&&ENT.list)||[]).find(e=>String(e.id)===String(entCfg.entityId||''));
  const entTxt=entSel?[entSel.name,entSel.inn?'ИНН '+entSel.inn:'',entSel.kpp?'КПП '+entSel.kpp:'',ENT_TAXN[entSel.tax_mode]||''].filter(Boolean).join(' · '):(entCfg.entityName||'');
  if(entTxt){put(r,0,'Поставщик: '+entTxt,{font:{sz:11},alignment:{vertical:'center'}});mrg(r,0,r,9);r++;}
  r++;
  put(r,0,'№',stHead);mrg(r,0,r+1,0);
  put(r,1,'Тип, марка оборудования',stHead);mrg(r,1,r+1,1);
  put(r,2,'Ед. изм.',stHead);mrg(r,2,r+1,2);
  put(r,3,'Кол-во',stHead);mrg(r,3,r+1,3);
  put(r,4,'Оборудование:',stHead);mrg(r,4,r,5);
  put(r,6,'Монтажные работы:',stHead);mrg(r,6,r,7);
  put(r,8,'Всего, руб',stHead);mrg(r,8,r+1,8);
  put(r,9,'Ссылка',stHead);mrg(r,9,r+1,9);
  r++;
  put(r,4,'Цена, руб',stHead);put(r,5,'Стоимость, руб',stHead);put(r,6,'Цена, руб',stHead);put(r,7,'Стоимость, руб',stHead);
  r++;
  const secTotals=[];
  let secStart=null,secKind='main',num=0,openSec=false;
  const openSection=(kind,label)=>{put(r,0,'Раздел: '+label,stSec);mrg(r,0,r,9);r++;openSec=true;secKind=kind;num=0;secStart=r;};
  const flushSec=()=>{if(!openSec)return;
    put(r,0,'Итого:',stTotL);mrg(r,0,r,4);
    const a=secStart+1,b=r; // 1-based строки позиций
    if(b>=a+0&&r>secStart){put(r,5,0,stTot,'SUM(F'+a+':F'+b+')');put(r,7,0,stTot,'SUM(H'+a+':H'+b+')');put(r,8,0,stTot,'SUM(I'+a+':I'+b+')');}
    else{put(r,5,0,stTot);put(r,7,0,stTot);put(r,8,0,stTot);}
    put(r,9,'',stTotL);
    secTotals.push({kind:secKind,row:r});
    r++;openSec=false;secStart=null;};
  rows.forEach(it=>{
    if(it.type==='calc')return;
    if(it.type==='section'){flushSec();
      const kind=SECKINDS[it.kind]?it.kind:'main';
      const label=SECKINDS[it.kind]?SECKINDS[it.kind]+(it.title?' — '+it.title:''):(it.title||'Основное оборудование');
      openSection(kind,label);return;}
    if(!openSec)openSection('main','Основное оборудование');
    num++;const q=+it.qty||0,ret=+it.retail||0,mon=+it.montazh||0,n=r+1;
    put(r,0,num,stCell);put(r,1,it.name||'',stCell);put(r,2,it.unit||'',stCell);put(r,3,q,stNum);
    put(r,4,ret,stNum);put(r,5,0,stNum,'D'+n+'*E'+n);
    put(r,6,mon,stNum);put(r,7,0,stNum,'D'+n+'*G'+n);
    put(r,8,0,stNum,'F'+n+'+H'+n);
    put(r,9,it.url||'',stCell);r++;});
  flushSec();
  const addLine=(label,formula,val)=>{put(r,0,label,stTotL);mrg(r,0,r,7);if(formula)put(r,8,0,stTot,formula);else put(r,8,val||0,stTot);put(r,9,'',stTotL);r++;return r;};// возвращает 1-based строку
  // Заказчику уходят название и сумма. Ставку накрутки не выдаёт ни подпись,
  // ни ячейка: формула вида I12*3/100 называет и процент, и базу тому, кто
  // просто встал в неё курсором.
  const rowMach=addLine('Машины и механизмы, допоборудование',null,R.mach);
  const rowOv=addLine('Накладные расходы',null,R.ov);
  const rowTr=addLine('Транспортные расходы',null,R.trans);
  const rowTotal1=r+2; // ВСЕГО будет после строки НДС
  const rowVat=addLine(R.vp>0?('В т.ч. НДС ('+R.vp+'%)'):'Без НДС (УСН)',R.vp>0?('I'+rowTotal1+'*'+R.vp+'/(100+'+R.vp+')'):null,R.vp>0?R.vat:0);
  const totalRefs=secTotals.map(t=>'I'+(t.row+1)).concat(['I'+rowMach,'I'+rowOv,'I'+rowTr]);
  put(r,0,R.vp>0?'ВСЕГО с НДС:':'ВСЕГО:',{font:{bold:true,sz:12},border:bAll,alignment:{horizontal:'right',vertical:'center'}});mrg(r,0,r,7);
  put(r,8,0,{font:{bold:true,sz:12},border:bAll,numFmt:'#,##0.00',alignment:{horizontal:'right',vertical:'center'}},totalRefs.join('+'));
  put(r,9,'',stTotL);r++;
  ws['!ref']='A1:J'+r;
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Спецификация');
  XLSX.writeFile(wb,kpFname('КП',spec,'КП - FSE (спецификация).xlsx'));toast('Экспорт готов');}

// ── ИИ-импорт спецификации ──
// Отказ показывается строкой в шапке редактора, а не в toast. toast — это
// «уведомление о сохранении»: гаснет по таймеру и не берёт нажатие. Объяснение,
// почему разбор не удался, за две секунды прочитать нельзя, а выделить и
// переслать администратору — тем более (#95, поймано на живой загрузке).
function impErr(msg){
  const b=$('#impErr'); if(!b)return;
  $('#impErrText').textContent=msg;
  b.style.display='';
}
function impErrHide(){const b=$('#impErr'); if(b)b.style.display='none';}
const impErrX=$('#impErrX'); if(impErrX)impErrX.addEventListener('click',impErrHide);

$('#fileinput').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  impErrHide();      // прошлый отказ снимается новой попыткой
  if(!LIVE){toast('ИИ-импорт работает при подключённом сервере');return;}
  busy(true,'Распознаю файл…');
  const tImp=(self.performance||Date).now();
  try{const fd=new FormData();fd.append('file',f);
    const res=await api('/import',{method:'POST',body:fd});
    const recMs=Math.round((self.performance||Date).now()-tImp);
    // ── СМЕТА (Гранд-Смета): разделы + деление железо/работы ──
    if(res.format==='estimate'){
      // Импорт сметы: материалы/оборудование (подбор цены по базе) + работы, НЕ
      // привязанные к материалу (монтаж без пары, ПНР) — отдельными строками-работами.
      // Привязанный монтаж уже сидит в «Цене монт.» строки материала.
      const secs=res.sections||[];
      const impList=s=>s.positions.filter(p=>p.kind==='hardware'||(p.kind==='work'&&!p.consumed));
      const totalImp=secs.reduce((a,s)=>a+impList(s).length,0);
      if(!totalImp){toast('Позиции в смете не найдены');return;}
      if(rows.some(x=>x.type!=='calc'))rows.push({id:rid(),type:'section',title:'Импорт сметы: '+(f.name||'')});
      let done=0,searchTotal=0,nSearch=0,hw=0,wk=0,nsec=0;
      for(const sec of secs){
        const items=impList(sec);
        if(!items.length)continue;                  // совсем пустой раздел — пропускаем
        rows.push({id:rid(),type:'section',title:sec.name});nsec++;
        for(const p of items){done++;
          if(p.kind==='work'){                       // строка-работа: стоимость работы → «Цена монт.»
            rows.push(Object.assign(manualRow(p.name),{unit:p.unit||'шт',qty:p.qty||1,montazh:+p.work_cost||0,work:true,found:true}));
            wk++;continue;}
          busy(true,`Подбираю цены… ${done} из ${totalImp}`);
          const found=await searchProducts(p.name);searchTotal+=lastSearchMs;nSearch++;
          const m=pickMatch(found,p);
          if(m){const r=mkRow(m);r.qty=p.qty||1;if(p.name)r.name=p.name;if(p.unit)r.unit=p.unit;if(p.montage)r.montazh=p.montage;rows.push(r);fetchCost(r);}
          else{const mr=Object.assign(manualRow(p.name),{unit:p.unit||'шт',qty:p.qty||1,montazh:+p.montage||0});rows.push(mr);
            if(found.length)varMap[mr.id]=found.slice(0,4);}
          hw++;}
      }
      const note=`смета: ${nsec} разд. · материалов ${hw} · работ ${wk} · ${(recMs/1000).toFixed(1)} c`;
      setSpeed(note);render();saveCur();toast(note,6000);return;
    }
    // ── ПЛОСКАЯ спецификация ──
    const pos=res.positions||[];if(!pos.length){toast('Позиции не распознаны');return;}
    // импорт ДОБАВЛЯЕТ к существующим позициям; если проект не пуст — отделяем разделом
    if(rows.some(x=>x.type!=='calc'))rows.push({id:rid(),type:'section',title:'Импорт: '+(f.name||'спецификация')});
    let added=0,searchTotal=0;
    for(const p of pos){busy(true,`Подбираю цены… ${added+1} из ${pos.length}`);
      const found=await searchProducts(p.article||p.name);searchTotal+=lastSearchMs;
      const m=pickMatch(found,p);
      if(m){const r=mkRow(m);r.qty=p.qty||1;if(p.name){r.name=p.name;}rows.push(r);fetchCost(r);}
      else{const mr=Object.assign(manualRow(p.name),{code:p.article||'',unit:p.unit||'шт',qty:p.qty||1});rows.push(mr);
        if(found.length)varMap[mr.id]=found.slice(0,4);} // не угадали — покажем варианты на выбор
      added++;}
    const avg=pos.length?Math.round(searchTotal/pos.length):0;
    const note=`${added} поз. · распознано за ${(recMs/1000).toFixed(1)} c · цены ~${avg} мс/поз`;
    setSpeed(note);render();saveCur();toast(note,5000);
  // Сервер объясняет отказ сам и по-русски — своих подмен тут больше нет.
  // Прежняя ветка выдавала «не задан ключ ИИ» на любой 503 без тела, в том
  // числе когда бэкенд просто не поднят, и уводила разбор в ложную сторону.
  }catch(err){impErr('Импорт не выполнен. '+(err.message||'Сервер не ответил.'));}
  finally{busy(false);}
});

document.addEventListener('input',e=>{
  if(e.target.id==='specq'){renderSpecs(e.target.value);return}
  // Панель открыта и производители отмечены — строка сужает выдачу панели,
  // а подсказка поиска не открывается: два списка результатов на одном
  // экране спорят друг с другом (#348).
  if(e.target.id==='q'){
    if(catShown&&catSel.size){clearTimeout(_sugT);
      dropClose();
      clearTimeout(catLoad._t);catLoad._t=setTimeout(()=>{catOffset=0;catLoad();},200);return}
    // Недавнее и популярное уходят с первой буквой и возвращаются со стёртой.
    if(catShown&&(!e.target.value.trim())!==catFreqQ)catRender();
    debouncedSuggest(e.target.value);return}
  // Поиск по производителям перерисовывает только колонку: иначе поле теряет ввод.
  if(e.target.id==='catbq'){catBrandQ=e.target.value;
    const l=$('#catpanel .bcl');if(l)l.innerHTML=catSheet?catBrandRows():catBrandBtns();return}
  const cn=e.target.dataset.cnum;
  if(cn){const pid=+cn;if(catPick.has(pid))catPick.set(pid,+e.target.value>0?+e.target.value:1);return}
  // Пересчитываем только когда значение действительно принято: иначе итог
  // прыгал бы на каждый недобитый символ.
  if(e.target.dataset.calc){if(setCalc(e.target.dataset.calc,e.target.value))updateCalcValues();return}
  // data-f есть не только у строк сметы: те же имена полей встречаются
  // в таблицах расчёта сделки. Без привязки к строке редактора обработчик
  // падал на первом же вводе в другом разделе и уносил с собой пересчёт.
  const f=e.target.dataset.f;if(f){
    const rw0=e.target.closest('#editorView .rowwrap'); if(!rw0)return;
    if(!canEdit())return;   // поля readonly, но событие можно послать и из консоли
    const r=rows.find(x=>x.id===rw0.dataset.id); if(!r)return;
    if(f==='name'){const v=(e.target.value!==undefined?e.target.value:(e.target.textContent||''));if(v.trim()!==(r.name||'').trim()){r.name=v;r.nameEdited=true;}saveCur();return}
    if(f==='title'){r.title=e.target.value;saveCur();return}
    r[f]=(f==='unit')?e.target.value:e.target.value.replace(',','.');
    if(e.target.classList&&e.target.classList.contains('f'))
      e.target.classList.toggle('todo',!String(e.target.value||'').trim());
    // Вписанная руками себестоимость перестаёт быть каталожной.
    if(f==='zakup')delete r.costSrc;
    const rw=e.target.closest('.rowwrap');
    if(rw){
      if(costMode())updCostCells(rw,r);
      else{const q=+r.qty||0,ret=+r.retail||0,mon=+r.montazh||0;
        const set=(s,v)=>{const el=rw.querySelector('[data-c="'+s+'"]');if(el)el.textContent=v;};
        set('sum',money(ret*q));set('mon',money(mon*q));set('tot',money((ret+mon)*q));}
      if(f==='retail')updAttn(rw,r);}
    updSectionSums();updateCalcValues();updFoot();saveCur();}});
// После ручной правки названия предложить варианты из базы.
// Было событие change. На редактируемой ячейке оно не срабатывает вовсе —
// его вызывают только поля ввода. focusout всплывает и работает для обоих.
document.addEventListener('focusout',e=>{if(e.target.dataset&&e.target.dataset.f==='name'){const rw=e.target.closest('.rowwrap');if(!rw)return;
  const r=rows.find(x=>x.id===rw.dataset.id);if(r&&!r.work&&r.nameEdited&&(r.name||'').trim().length>=2)offerVariants(r);}});
// Esc закрывает меню — привычно и не требует искать кнопку
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#drawer').classList.contains('on'))drawer(false);});
// Стрелки ходят по подсказке, Esc её закрывает. Обработчик стоит до Enter:
// выбранная строка меняет то, что Enter добавит.
document.addEventListener('keydown',e=>{
  if(e.target.id!=='q'||!$('#drop').classList.contains('on'))return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();dropMove(e.key==='ArrowDown'?1:-1);return}
  if(e.key==='Escape')dropClose();});
document.addEventListener('keydown',async e=>{if(e.target.id==='q'&&e.key==='Enter'){const v=e.target.value.trim();if(!v)return;
  if(!canEdit()){toast('Только просмотр — добавлять позиции нельзя');return}
  // Выбрали строку стрелками — добавляем именно её, а не лучшее совпадение:
  // выбор глазами точнее, чем подбор по названию.
  const sel=dropSelected();
  if(sel){addProduct(sel,v);e.target.value='';dropClose();toast('Добавлено из каталога');return}
  busy(true,'Ищу в каталоге…');
  try{const m=await searchProducts(v);const pick=pickMatch(m,{name:v})||m[0];
    if(pick){addProduct(pick,v);}else{rows.push(manualRow(v));render();saveCur();}
    e.target.value='';dropClose();toast('Добавлено');}
  finally{busy(false);}}});
document.addEventListener('click',e=>{
  // Внутри карточки сметы теперь живут галочка выбора и меню строки — открыть
  // смету должно только нажатие мимо них.
  const open=e.target.closest('[data-open]');
  if(open&&!e.target.closest('input,button,.mn,.menu')){openSpec(open.dataset.open);return}
  const spick=e.target.closest('[data-spick]');
  if(spick){const sid=spick.dataset.spick;
    spick.checked?specSel.add(sid):specSel.delete(sid);renderSpecSel();return}
  const prow=e.target.closest('[data-prjrow]');
  if(prow&&!e.target.closest('.mn,.menu')){prjTogl(prow.dataset.prjrow);return}
  const goEl=e.target.closest('[data-go]');if(goEl){if(goEl.classList.contains('dimmed'))return;go(goEl.dataset.go);return}
  // Всё, что меняет состав или цены сметы, без права правки не срабатывает:
  // иначе экран показывает изменение, которого на сервере не будет.
  if(!canEdit()&&e.target.closest('[data-pick],[data-manual],[data-pickoffer],[data-applyvar],[data-keepmerge],[data-addkind],[data-cbrand],[data-cpick],[data-cadd]')){
    toast('Только просмотр — правка смет вам не выдана');return}
  const pick=e.target.closest('[data-pick]');if(pick){const c=lastResults[+pick.dataset.pick];if(c){addProduct(c,$('#q').value);}$('#q').value='';dropClose();toast('Добавлено из каталога');return}
  if(e.target.closest('[data-manual]')){const v=$('#q').value.trim();rows.push(manualRow(v));$('#q').value='';dropClose();render();saveCur();return}
  // ── подбор из каталога (#348) ──
  if(e.target.closest('[data-cfold]')||(e.target.closest('#catpanel>.cph')&&!e.target.closest('button'))){
    catClose();return}
  const cb=e.target.closest('[data-cbrand]');
  if(cb){catToggleBrand(cb.dataset.cbrand);return}
  if(e.target.closest('[data-cclear]')){catSel.clear();catPick.clear();catOffset=0;catLoad();return}
  const cs=e.target.closest('[data-catsheet]');
  if(cs){catSheet=cs.dataset.catsheet==='1';catRender();return}
  const cp=e.target.closest('[data-cpick]');
  if(cp){catSetPick(+cp.dataset.cpick,cp.checked);return}
  const cq=e.target.closest('[data-cqty]');
  if(cq){const pid=+cq.dataset.cqty;
    const num=$('#catpanel [data-cnum="'+pid+'"]');if(!num)return;
    const v=Math.max(1,(+num.value||1)+(+cq.dataset.d));
    num.value=v; if(catPick.has(pid))catPick.set(pid,v);
    return}
  const cbr=e.target.closest('[data-cbrow]');
  if(cbr&&!e.target.closest('input')){catToggleBrand(cbr.dataset.cbrow);return}
  const crow=e.target.closest('[data-crow]');
  if(crow&&!e.target.closest('input,button')){
    const pid=+crow.dataset.crow;catSetPick(pid,!catPick.has(pid));return}
  const cpg=e.target.closest('[data-cpage]');
  if(cpg){catOffset=Math.max(0,(+cpg.dataset.cpage-1)*BRAND_PAGE);catLoad();return}
  if(e.target.closest('[data-cadd]')){catAddPicked();return}
  const po=e.target.closest('[data-pickoffer]');if(po){const r=rows.find(x=>x.id===e.target.closest('.rowwrap').dataset.id);const i=+po.dataset.pickoffer;r.chosen=i;r.retail=r.offers[i].price;r.url=r.offers[i].url;r.nameEdited=false;render();saveCur();toast('Магазин: '+r.offers[i].shop);return}
  const av=e.target.closest('[data-applyvar]');if(av){const r=rows.find(x=>x.id===e.target.closest('.rowwrap').dataset.id);const list=varMap[r.id]||[];const c=list[+av.dataset.applyvar];
    if(c){const nr=mkRow(c);nr.id=r.id;nr.qty=r.qty;nr.kupleno=r.kupleno;nr.montazh=r.montazh;nr.unit=r.unit||nr.unit;rows[rows.indexOf(r)]=nr;delete varMap[r.id];learn(c.name,(c.code||c.name));fetchCost(nr);render();saveCur();toast('Подставлено из базы');}return}
  const km=e.target.closest('[data-keepmerge]');if(km){const keepId=km.dataset.keepmerge;const ids=[...sel];const items=rows.filter(x=>ids.includes(x.id));const keep=rows.find(x=>x.id===keepId);keep.qty=items.reduce((s,x)=>s+(+x.qty||0),0);rows=rows.filter(x=>x.id===keepId||!ids.includes(x.id));sel.clear();mergePick=false;render();saveCur();toast('Объединено');return}
  // Раздел заводится сразу со строкой: пустой заголовок предлагал перетащить
  // в него позиции, а вписать в него с ходу было нечего.
  const ak=e.target.closest('[data-addkind]');if(ak){const k=ak.dataset.addkind,sid=rid();
    rows.push({id:sid,type:'section',kind:k,title:''});
    addSectionRow(sid);toast(SECKINDS[k]+' — впишите первую строку');return}
  const rp=e.target.closest('.rolepick');if(rp){if(rp.classList.contains('dimmed'))return;setRole(rp.dataset.role,rp.dataset.rn);return}
  const el=e.target.closest('[data-act]');if(!el)return;const a=el.dataset.act;const rw=e.target.closest('.rowwrap');const id=rw&&rw.dataset.id;
  // Раньше здесь было drawer(true) — и клик по затемнению, у которого тот же
  // data-act, открывал меню заново вместо того, чтобы закрыть. Меню не
  // закрывалось ничем, кроме ссылки «В приложение», которая уводила на вход.
  if(a==='prjerrhide'){prjErrHide();return}
  if(a==='dropretry'){suggest($('#q').value);return}
  if(a==='dropwarnhide'){const b=el.closest('.errbox');if(b)b.remove();return}
  if(a==='specselclear'){specSel.clear();renderSpecs($('#specq').value);return}
  if(a==='prjlink'){prjLinkNew();return}
  if(a==='prjlinkto'){prjLinkTo([...specSel]);return}
  if(a==='prjmove'){prjLinkTo([el.dataset.spec]);return}
  if(a==='prjdrop'){prjDrop(el.dataset.uid,el.dataset.spec);return}
  if(a==='prjrename'){prjRename(el.dataset.uid);return}
  if(a==='prjdissolve'){prjDissolve(el.dataset.uid);return}
  if(a==='menu'){drawer(!$('#drawer').classList.contains('on'));return}
  if(a==='menuclose'){drawer(false);return}
  if(a==='home'){go('home');return}
  if(a==='rolemenu'){const rl=$('#roleList');if(rl)rl.style.display=rl.style.display==='none'?'':'none';return}
  // Создание, переименование, дублирование и удаление сметы — это тоже правка.
  // Кнопок без права нет, но событие можно послать из консоли, поэтому проверка
  // стоит здесь, а не только в отрисовке.
  if(a==='newspec'){if(!canEdit()){toast('Правка смет вам не выдана');return}/* Системное окно убрано: смета создаётся сразу, название правится в заголовке.
   Было три действия до первой строки сметы, стало одно. На телефоне prompt()
   вдобавок перекрывает экран и не поддаётся оформлению. */
   // Двойной тап заводил две сметы: обе уходили на сервер, вторая закрывала
   // первую собой, и человек не знал, что в списке появился пустой близнец.
   if(el.dataset.busy)return; el.dataset.busy='1'; setTimeout(()=>{delete el.dataset.busy;},1500);
   const ns={id:rid(),title:'Новый объект',date:new Date().toLocaleDateString('ru-RU'),rows:[]};specs.unshift(ns);if(LIVE)putSpec(ns);else saveLocal();openSpec(ns.id);setTimeout(editTitle,60);return}
  if(a==='back'){go('specs');return}
  if(a==='dupspec'){if(!canEdit())return;const s=specs.find(x=>x.id===curId);if(!s)return;
    const ns={id:rid(),title:(s.title||'Без названия')+' (копия)',date:new Date().toLocaleDateString('ru-RU'),
      rows:JSON.parse(JSON.stringify(rows||[])).map(r=>({...r,id:rid()}))};
    specs.unshift(ns);if(LIVE)putSpec(ns);else saveLocal();openSpec(ns.id);toast('Проект скопирован');return}
  if(a==='delspec'){if(!canDelSpec()){toast('Удаление смет вам не выдано');return}
    const s=specs.find(x=>x.id===curId);if(!s)return;
    // Подтверждение своим окном: системное нельзя ни прочитать с телефона,
    // ни оформить, а действие необратимое.
    askYes({title:'Удалить смету?',
      text:'«'+(s.title||'Без названия')+'» будет удалена вместе со всеми позициями.',
      warn:'Вернуть её будет нельзя.',ok:'Удалить',okIcon:'i-trash'},()=>delSpecGo(s));
    return}
  if(a==='sharespec'){if(!can('spec:publish')){toast('Выдавать публичные ссылки вам не выдано');return;}
    if(!LIVE){toast('Общий доступ — при подключённом сервере');return;}
    // Второй клик, пока идёт первый, выдавал вторую ссылку: срок жизни
    // прежней при этом продлевался, а в буфер попадала другая.
    if(el.dataset.busy)return; el.dataset.busy='1';
    api('/specs/'+curId+'/publish',{method:'POST'}).then(res=>{
      // Номер в адресе, секрет — в параметре: заказчик видит, что ему
      // прислали, а пускает по-прежнему секрет (#283).
      const link=location.origin+'/kp/'+encodeURIComponent(res.number)
        +'?t='+encodeURIComponent(res.token);
      /* Ссылку кладём в буфер. Раньше её показывали в системном окне, откуда
         надо было выделить текст и скопировать руками — четыре действия и
         постоянный риск прихватить лишний символ. Окно осталось запасным
         путём: буфер недоступен без защищённого соединения и по правам. */
      (navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject())
        .then(()=>toast('Ссылка скопирована, действует 90 дней. По ней смету смотрят, правит вошедший сотрудник компании',4500))
        .catch(()=>{ if(window.UI&&UI.copyBox)UI.copyBox('Публичная ссылка',link,
       'По ссылке смету смотрят. Правит её сотрудник компании-владельца, вошедший в систему. Ссылка действует 90 дней.');
     else window.prompt('Публичная ссылка — скопируйте:',link); });
    }).catch(e=>toast('Не удалось включить доступ: '+e.message))
      .then(()=>{delete el.dataset.busy;});return}
  if(a==='toggleoffers'){rw.querySelector('.offers').classList.toggle('on');return}
  // Клик по чекбоксу — не повод перерисовывать смету целиком: на 2000 строк это
  // ощутимая пауза, а вдобавок сбрасывался фокус и открытые списки предложений.
  // Достаточно подсветить саму строку и обновить панель выделения.
  if(a==='sel'){if(!canEdit())return;
    sel.has(id)?sel.delete(id):sel.add(id);
    if(rw)rw.classList.toggle('sel',sel.has(id));
    renderSelbar();return}
  if(a==='rowmenu'){const m=el.querySelector('.menu');const willOpen=!m.classList.contains('on');
    document.querySelectorAll('.menu.on').forEach(x=>x.classList.remove('on'));
    document.querySelectorAll('.rowwrap.menuopen').forEach(x=>x.classList.remove('menuopen'));
    if(willOpen){m.classList.add('on');if(rw)rw.classList.add('menuopen');}
    return}
  // Правки состава смет — только когда правка вообще разрешена. По публичной
  // ссылке в режиме чтения этих кнопок нет в DOM, но проверка нужна и здесь:
  // событие можно послать из консоли.
  if(a==='dup'){if(!canEdit())return;const r=rows.find(x=>x.id===id);rows.splice(rows.indexOf(r)+1,0,{...JSON.parse(JSON.stringify(r)),id:rid()});render();saveCur();return}
  // Копия раздела уносит с собой позиции: смету собирают одинаковыми
  // помещениями, а пустой заголовок и так даёт кнопка «Подраздел».
  if(a==='dupsec'){if(!canEdit())return;const i=rows.findIndex(x=>x.id===id);if(i<0)return;
    const block=rows.slice(i,secEnd(i)).map(x=>({...JSON.parse(JSON.stringify(x)),id:rid()}));
    rows.splice(i+block.length,0,...block);render();saveCur();
    toast('Раздел скопирован, позиций в нём: '+(block.length-1));return}
  if(a==='del'){if(!canEdit())return;rows=rows.filter(x=>x.id!==id);sel.delete(id);render();saveCur();return}
  // Копия каждой отмеченной позиции встаёт сразу под своей: смету собирают
  // повторяющимися блоками, и порядок внутри блока важнее компактности.
  if(a==='dupsel'){if(!canEdit())return;const picked=rows.filter(x=>sel.has(x.id));if(!picked.length)return;
    // С разделом в наборе копия ложится одним куском под отмеченным: копия
    // каждой строки под своей развела бы позиции по разным заголовкам.
    const withSec=picked.some(x=>x.type==='section');
    if(withSec){let at=0;rows.forEach((x,i)=>{if(sel.has(x.id))at=i+1});
      rows.splice(at,0,...picked.map(x=>({...JSON.parse(JSON.stringify(x)),id:rid()})));}
    else rows=rows.flatMap(x=>sel.has(x.id)?[x,{...JSON.parse(JSON.stringify(x)),id:rid()}]:[x]);
    sel.clear();render();saveCur();
    toast((withSec?'Дублировано строк: ':'Дублировано позиций: ')+picked.length);return}
  if(a==='delsel'){if(!canEdit())return;rows=rows.filter(x=>!sel.has(x.id));sel.clear();render();saveCur();toast('Удалено');return}
  if(a==='clearsel'){sel.clear();render();return}
  if(a==='dismissvar'){delete varMap[id];render();return}
  if(a==='merge'){if(sel.size<2){toast('Выберите 2+ позиции');return}mergePick=true;renderSelbar();return}
  if(a==='cancelmerge'){mergePick=false;renderSelbar();return}
  if(a==='import'){if(!canEdit()){toast('Только просмотр — импорт недоступен');return}$('#fileinput').click();return}
  if(a==='addsection'){if(!canEdit())return;rows.push({id:rid(),type:'section',title:''});render();saveCur();toast('Подраздел добавлен — впишите название');return}
  if(a==='addrow'){if(!canEdit())return;addSectionRow(id);return}
  if(a==='export-cost'){if(costMode())exportXLSX();return}
  if(a==='export-client'){exportClientXLSX();return}
  if(a==='kp-gdoc'){kpGdoc();return}
  if(a==='kp-letter'){const s=specs.find(x=>x.id===curId);
    if(s)kpLetter({sub:s.title||'',org:s.customer||'',object:s.object||''});return}
  if(a==='tab'){setTab(el.dataset.tab);return}
  if(a==='catbtn'){if(catShown)catClose();else catOpen();return}
  if(a==='export-shops'){exportShops();return}
  if(a==='reload'){location.reload();return}
});

// КП в Google-документ (#561). Сервер заполняет шаблон из сметы в базе, а не
// из браузера: правки, ещё не доехавшие до сервера, отправляем до запроса.
function kpGdoc(){
  const s=specs.find(x=>x.id===curId);if(!s)return;
  if(!LIVE){toast('Нет связи с сервером — документ создаётся только онлайн');return}
  if(CONFLICT409){toast('Смету изменили в другом окне — обновите страницу');return}
  let cust='',addr='';
  kpGoogle({sub:s.title||'',path:'/deal-docs/kp',xlsx:exportClientXLSX,
    top:'<div class="fcell wide"><div class="flab">Заказчик <i>обязательно</i></div>'
      +'<input class="fin" id="kgCust" maxlength="200" placeholder="Например: ООО «Северный»" value="'+esc(s.customer||'')+'"></div>'
      +'<div class="fcell wide"><div class="flab">Адрес объекта</div>'
      +'<input class="fin" id="kgAddr" maxlength="200" placeholder="Например: Москва, ул. Воздвиженка, д. 35" value="'+esc(s.object||'')+'"></div>',
    body:'<div class="fcell wide"><div class="flab">Срок выполнения работ <i>обязательно</i></div>'
      +'<input class="fin" id="kgTerm" maxlength="100" placeholder="Например: 30 рабочих дней"></div>'
      +'<div class="fcell"><div class="flab">Аванс за оборудование, %</div>'
      +'<input class="fin" id="kgAdvEq" inputmode="numeric" maxlength="3" value="100"></div>'
      +'<div class="fcell"><div class="flab">Аванс за монтаж, %</div>'
      +'<input class="fin" id="kgAdvMon" inputmode="numeric" maxlength="3" value="30"></div>',
    init:w=>{if(!s.customer)w.querySelector('#kgCust').focus();},
    collect:w=>{const term=w.querySelector('#kgTerm').value.trim();
      const adv=['#kgAdvEq','#kgAdvMon'].map(k=>w.querySelector(k).value.trim());
      cust=w.querySelector('#kgCust').value.trim();addr=w.querySelector('#kgAddr').value.trim();
      if(!cust)return 'Впишите заказчика';
      if(!term)return 'Укажите срок выполнения работ';
      if(adv.some(v=>!/^\d{1,3}$/.test(v)||+v>100))return 'Аванс — число от 0 до 100';
      return {spec_uid:s.id,work_term:term,adv_equipment:+adv[0],adv_montage:+adv[1]};},
    docs:s._docs,
    after:()=>specDocs(s.id),
    before:async()=>{
      await savingSpec;
      if(saveTimer||cust!==s.customer||addr!==(s.object||'')){clearTimeout(saveTimer);saveTimer=null;s.customer=cust;s.object=addr;dirty=true;await putSpec(s);}
      if(dirty)throw new Error('Смета не сохранилась на сервере — документ не создан');}});}

// Окно «КП в Google» всех видов КП (#599, #652) и письма (#563): сделка amoCRM
// общая, срок действия — у КП (o.till!==false), поля вида — o.body.
// o.collect(w) отдаёт поля запроса или текст ошибки; o.deal — сделка, уже
// выбранная там, откуда окно открыто; o.done(r) — окно готового документа.
function kpGoogle(o){
  if(!(window.UI&&UI.modal)){toast('Форма КП не открылась');return}
  const d=new Date();d.setDate(d.getDate()+21);
  const till=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  let deals=[],q='',timer=null;
  const withTill=o.till!==false;
  const m=UI.modal({narrow:o.narrow!==false,title:o.title||'КП в Google-документ',sub:o.sub||'',
    body:'<div class="fgrid">'+(o.top||'')+'<div class="fcell wide"><div class="flab">Сделка amoCRM <i>обязательно</i></div>'
      +'<input class="fin" id="kgQ" maxlength="100" placeholder="№ или название сделки" autocomplete="off">'
      +'<div style="display:flex;gap:6px;margin-top:6px"><select class="fin" id="kgDeal" style="flex:1;min-width:0"><option value="">Сначала найдите сделку</option></select>'
      +'<a class="btn io" id="kgOpen" target="_blank" rel="noopener" title="Открыть сделку в amoCRM" style="display:none;height:auto"><svg class="i"><use href="#i-ext"/></svg></a></div>'
      +'<div class="fnote warn" id="kgHad" style="display:none"></div>'
      +'<div class="fnote">Документ ляжет в папку сделки на Google Диске, ссылка на папку — в сделку.</div></div>'
      +(withTill?'<div class="fcell wide"><div class="flab">Срок действия КП до</div>'
      +'<input class="fin" id="kgTill" type="date" value="'+till+'"></div>':'')+(o.body||'')+'</div>',
    ok:'Создать',okIcon:'i-file',
    onOk:w=>{
      const did=+w.querySelector('#kgDeal').value, deal=deals.find(x=>x.id===did);
      const vt=withTill?w.querySelector('#kgTill').value:'';
      const x=o.collect(w);
      if(typeof x==='string'){m.error(x);return false}
      if(!deal){m.error('Найдите сделку amoCRM по номеру или названию');return false}
      if(withTill&&!vt){m.error('Укажите срок действия КП');return false}
      return (async()=>{
        if(o.before)await o.before();
        const r=await ledger(o.path,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({...x,deal_id:did,deal_name:deal.name||'',...(withTill?{valid_until:vt}:{})})});
        if(o.done)o.done(r);else kpGdocDone(r,o.xlsx);
        if(o.after)o.after(r);})();}});
  const qi=m.el.querySelector('#kgQ'), ds=m.el.querySelector('#kgDeal'), openA=m.el.querySelector('#kgOpen');
  // Сделка открывается в новой вкладке: окно с набранными сроками остаётся.
  const link=()=>{const u=safeUrl((deals.find(x=>x.id===+ds.value)||{}).url);
    if(u)openA.href=u;else openA.removeAttribute('href');openA.style.display=u?'':'none';had(+ds.value);};
  // Повторное КП по сделке — не ошибка, но его выпускают, видя уже выпущенные.
  // Выпущенное по смете видно сразу, по сделке — когда её выбрали.
  const hadEl=m.el.querySelector('#kgHad'), mine=o.docs||[];
  const hadShow=(t,r)=>{hadEl.style.display=r.length?'':'none';
    hadEl.innerHTML=r.length?t+r.slice(0,3).map(docLink).join(', ')+(r.length>3?' и ещё '+(r.length-3):''):'';};
  const had=async did=>{hadShow('По смете уже: ',mine);if(!did)return;
    let r;try{r=(await ledger('/deal-docs/docs?deal_id='+did)).docs||[];}catch(e){return}
    if(+ds.value!==did||!r.length)return;
    hadShow('По сделке уже: ',r);};
  hadShow('По смете уже: ',mine);
  const opts=(t)=>{ds.innerHTML=deals.length
    ?deals.map(x=>`<option value="${x.id}">№${x.id} · ${esc(x.name||'без названия')}${x.stage?' · '+esc(x.stage):''}</option>`).join('')
    :`<option value="">${esc(t)}</option>`;link();};
  ds.addEventListener('change',link);
  // Ответ на устаревший запрос отбрасывается: пока он шёл, в поле дописали буквы.
  qi.addEventListener('input',()=>{clearTimeout(timer);q=qi.value.trim();deals=[];
    if(!q){opts('Сначала найдите сделку');return}
    opts('Ищу…');
    timer=setTimeout(async()=>{const my=q;
      try{const r=await ledger('/deal-docs/deals?q='+encodeURIComponent(my));
        if(my!==q)return;deals=r.deals||[];opts('Сделка не найдена');}
      catch(e){if(my!==q)return;deals=[];opts('Поиск не сработал');m.error(e.message||'Поиск сделок не сработал');}},380);});
  if(o.deal&&o.deal.id){deals=[o.deal];qi.value='№'+o.deal.id;opts('');}else qi.focus();
  if(o.init)o.init(m.el,()=>deals.find(x=>x.id===+ds.value)||null);
  return m;}

// Excel есть только у КП из сметы: у остальных видов КП сметы нет,
// и выгрузка взяла бы последнюю открытую.
function kpGdocDone(r,xlsx){
  const doc=safeUrl(r.doc_url), fold=safeUrl(r.folder_url);
  const m=UI.modal({narrow:true,title:'КП №'+r.number+' создано',ok:null,cancel:'Закрыть',
    body:'<div class="fcell wide">'
      +(doc?`<a href="${esc(doc)}" target="_blank" rel="noopener">${esc(r.doc_name||'Документ')}</a>`:esc(r.doc_name||''))
      +(fold?`<div class="fnote"><a href="${esc(fold)}" target="_blank" rel="noopener">Папка сделки</a></div>`:'')
      +(r.crm_linked?'<div class="fnote">Ссылка на папку записана в сделку amoCRM</div>'
        :r.crm_error?`<div class="fnote warn">Ссылку в amoCRM записать не удалось: ${esc(r.crm_error)}</div>`:'')
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">'
      +(r.doc_id?'<button class="btn" type="button" id="kgPdf"><svg class="i"><use href="#i-doc"/></svg><span>Скачать PDF</span></button>':'')
      +(xlsx?'<button class="btn" type="button" id="kgXlsx"><svg class="i"><use href="#i-sheet"/></svg><span>Скачать Excel</span></button>':'')
      +'</div></div>'});
  const pb=m.el.querySelector('#kgPdf');
  if(pb)pb.addEventListener('click',()=>kpPdf(r.doc_id,r.doc_name,pb));
  const xb=m.el.querySelector('#kgXlsx');
  if(xb)xb.addEventListener('click',xlsx);}

// PDF собирает Google из того же документа: заказчику уходит ровно бланк с Диска,
// а не вторая форма, которую пришлось бы держать в согласии с ним.
async function kpPdf(id,name,btn){
  btn.disabled=true;
  try{
    const res=await fetch(LAPI+'/deal-docs/kp/'+encodeURIComponent(id)+'/pdf',{headers:{'X-FSE-Session':sessId()}});
    if(!res.ok)throw new Error((await res.json().catch(()=>({}))).detail||('Ошибка '+res.status));
    const u=URL.createObjectURL(await res.blob());
    const a=document.createElement('a');
    a.href=u;a.download=(String(name||'КП').replace(/[\\/:*?"<>|]/g,'-').trim()||'КП')+'.pdf';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
  }catch(e){toast(e.message||'PDF не скачался',4000);}
  btn.disabled=false;}

// Исходящее письмо на бланке ООО «ССГ» (#563). Открывается из «CRM», «Смет»,
// «Обслуживания» и «Переосвидетельствования»; o.org и o.object — заказчик
// и объект оттуда. Черновик модели только заполняет форму: в документ уходит
// то, что человек прочитал.
function kpLetter(o){
  o=o||{};
  const F=(id,lab,ph,val,max,wide)=>'<div class="fcell'+(wide?' wide':'')+'"><div class="flab">'+lab+'</div>'
    +'<input class="fin" id="'+id+'" maxlength="'+max+'" placeholder="'+esc(ph)+'" value="'+esc(val||'')+'"></div>';
  let getDeal=()=>null,armed=false;
  return kpGoogle({narrow:false,till:false,title:'Исходящее письмо',sub:o.sub||'',path:'/deal-docs/letter',
    deal:o.deal,done:letterDone,after:o.after,
    body:F('lgOrg','Организация адресата <i>обязательно</i>','Например: ООО «Северный»',o.org,200,true)
      +F('lgPos','Должность — кому','Генеральному директору','',200)
      +F('lgName','ФИО — кому','Иванову Ивану Петровичу','',200)
      +F('lgAddr','Адрес адресата','Индекс, город, улица, дом','',300,true)
      +'<div class="fcell wide"><div class="flab">О чём письмо</div>'
      +'<textarea class="fin" id="lgBrief" maxlength="3000" rows="3" placeholder="Несколько предложений: что сообщаем или просим, сроки, номер договора"></textarea>'
      +'<div style="margin-top:6px"><button class="btn sm" type="button" id="lgDraft"><svg class="i"><use href="#i-file"/></svg><span class="lbl">Составить черновик</span></button></div>'
      +'<div class="fnote" id="lgNote">Черновик заполнит заголовок, обращение и текст. Недостающее модель оставит в [скобках].</div></div>'
      +F('lgSubj','Заголовок','О сроках выполнения работ','',300,true)
      +F('lgSal','Обращение <i>обязательно</i>','Уважаемый Иван Петрович!','',150,true)
      +'<div class="fcell wide"><div class="flab">Текст письма <i>обязательно</i></div>'
      +'<textarea class="fin" id="lgBody" maxlength="8000" rows="10" placeholder="Абзацы разделяйте пустой строкой"></textarea></div>'
      +F('lgReply','В ответ на письмо','№ 45 от 01.10.2026','',100)
      +F('lgExec','Исполнитель','Фамилия И.О.','',100),
    init:(w,gd)=>{
      getDeal=gd;
      // Подсветка пустых полей (.need) живёт на событии input: заполненное
      // черновиком поле сообщает о вводе само, иначе осталось бы «пустым».
      const v=k=>w.querySelector(k).value.trim(), put=(k,x)=>{if(!x)return;const el=w.querySelector(k);
        el.value=x;el.dispatchEvent(new Event('input',{bubbles:true}));};
      const note=(t,bad)=>{const n=w.querySelector('#lgNote');n.textContent=t;n.className='fnote'+(bad?' warn':'');};
      w.querySelector('#lgBody').addEventListener('input',()=>{armed=false;});
      w.querySelector('#lgDraft').addEventListener('click',async ev=>{
        const b=ev.currentTarget, brief=v('#lgBrief');
        if(brief.length<10){note('Опишите в паре предложений, о чём письмо',true);return}
        // Набранный текст черновик заменяет только со второго нажатия.
        if(v('#lgBody')&&!armed){armed=true;note('Текст письма уже написан — нажмите ещё раз, чтобы заменить его черновиком',true);return}
        b.disabled=true;note('Составляю черновик…');
        try{
          const d=getDeal()||{};
          const r=await ledger('/deal-docs/letter/draft',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({brief,org:v('#lgOrg'),recipient:[v('#lgPos'),v('#lgName')].filter(Boolean).join(' '),
              deal_name:d.name||'',object:o.object||''})});
          put('#lgSubj',r.subject);put('#lgSal',r.salutation);put('#lgPos',r.position);put('#lgName',r.name);
          put('#lgBody',r.body);armed=false;
          note('Черновик готов. Проверьте текст и замените всё, что в [скобках]');
        }catch(e){note(e.message||'Черновик не получился',true);}
        b.disabled=false;});},
    collect:w=>{
      const v=k=>w.querySelector(k).value.trim();
      if(!v('#lgOrg'))return 'Укажите организацию адресата';
      if(!v('#lgSal'))return 'Укажите обращение, например «Уважаемый Иван Петрович!»';
      if(!v('#lgBody'))return 'Напишите текст письма или составьте черновик';
      if(['#lgOrg','#lgPos','#lgName','#lgAddr','#lgSubj','#lgSal','#lgBody','#lgReply','#lgExec']
        .some(k=>/\[[^\]]+\]/.test(v(k))))return 'В письме остались [скобки] — замените их';
      return {org:v('#lgOrg'),position:v('#lgPos'),name:v('#lgName'),address:v('#lgAddr'),
        salutation:v('#lgSal'),subject:v('#lgSubj'),body:w.querySelector('#lgBody').value,
        reply_to:v('#lgReply'),executor:v('#lgExec')};}});}

// Готовое письмо: Google-документ — переслать на согласование ссылкой,
// Word — согласовать и подписать вне Google, PDF — отправить заказчику.
function letterDone(r){
  const doc=safeUrl(r.doc_url), fold=safeUrl(r.folder_url);
  const m=UI.modal({narrow:true,title:'Письмо №'+r.number+' создано',ok:null,cancel:'Закрыть',
    body:'<div class="fcell wide">'
      +(doc?`<a href="${esc(doc)}" target="_blank" rel="noopener">${esc(r.doc_name||'Документ')}</a>`:esc(r.doc_name||''))
      +(fold?`<div class="fnote"><a href="${esc(fold)}" target="_blank" rel="noopener">Папка сделки</a></div>`:'')
      +(r.crm_linked?'<div class="fnote">Ссылка на папку записана в сделку amoCRM</div>'
        :r.crm_error?`<div class="fnote warn">Ссылку в amoCRM записать не удалось: ${esc(r.crm_error)}</div>`:'')
      +'<div class="fnote">На согласование — ссылкой на документ или файлом Word; заказчику — в PDF.</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">'
      +'<button class="btn" type="button" data-lgf="docx"><svg class="i"><use href="#i-doc"/></svg><span>Скачать Word</span></button>'
      +'<button class="btn" type="button" data-lgf="pdf"><svg class="i"><use href="#i-doc"/></svg><span>Скачать PDF</span></button>'
      +'</div></div>'});
  m.el.querySelectorAll('[data-lgf]').forEach(b=>b.addEventListener('click',()=>letterFile(r.doc_id,r.doc_name,b.dataset.lgf,b)));}

async function letterFile(id,name,fmt,btn){
  btn.disabled=true;
  try{
    const res=await fetch(LAPI+'/deal-docs/letter/'+encodeURIComponent(id)+'/file?fmt='+fmt,{headers:{'X-FSE-Session':sessId()}});
    if(!res.ok)throw new Error((await res.json().catch(()=>({}))).detail||('Ошибка '+res.status));
    const u=URL.createObjectURL(await res.blob());
    const a=document.createElement('a');
    a.href=u;a.download=(String(name||'Письмо').replace(/[\\/:*?"<>|]/g,'-').trim()||'Письмо')+'.'+fmt;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
  }catch(e){toast(e.message||'Файл не скачался',4000);}
  btn.disabled=false;}

// Первый переход обязан дождаться разбора остальных kp-*: «Смена», «Сделка»,
// «Обслуживание» и «Помощь» подменяют go() и roleDefault() ниже по странице,
// а ответ /auth/me резолвится между тегами <script>. Без ожидания исполнитель
// первым делом получал «Раздел «shift» появится позже» на собственной смене.
const scriptsParsed=()=>document.readyState==='loading'
  ? new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}))
  : Promise.resolve();

// ── старт ──
(async()=>{
  // Ждём разрешения: без них меню собралось бы пустым, а стартовый раздел
  // выбрался бы наугад. Ошибку глотаем — офлайн разберём ниже, по /specs.
  if(!PUB){try{await AUTH_READY;}catch(e){}}
  initRole();
  // Разрешения приехали — только теперь видно, показывать ли кнопки правки.
  applyEditPerm();
  // Свежесть каталога нужна и подсказке поиска, и «Обзору». Не ждём ответа:
  // без неё оба экрана работают, просто молчат о возрасте цен.
  if(!PUB&&can('catalog:read'))loadCatalog();
  if(PUB){  // публичный режим: грузим одну спецификацию по ссылке, без входа
    let full;
    try{full=await api(pubPath());}
    catch(e){$('#specsView').style.display='none';$('#editorView').style.display='';
      $('#etitle').textContent='Ссылка недействительна или общий доступ отключён';return;}
    LIVE=false;setSource();pubSeen=full.updated_at;
    const sb=document.getElementById('srctext');if(sb)sb.textContent='общий доступ';
    const sd=document.getElementById('srcdot');if(sd)sd.classList.add('live');
    document.body.classList.add('pubmode');
    // Право на правку присылает сервер. Клиент его больше не назначает себе сам:
    // анонимный PUT по ссылке теперь отвергается на сервере, и рисовать поля
    // для правки, которая гарантированно упрётся в 403, — обманывать человека.
    PUB_EDIT = full.can_edit===true;
    // Командные кнопки удаляем из DOM, а не прячем стилем: снять класс pubmode
    // в консоли — секунда, и «Удалить проект» сработает по-настоящему.
    document.querySelectorAll('[data-act="dupspec"],[data-act="delspec"],[data-act="sharespec"],[data-act="history"]')
      .forEach(b=>b.remove());
    if(!PUB_EDIT){
      // Режим только чтения: кнопок, которые меняют состав сметы, тоже быть не должно.
      document.querySelectorAll('[data-act="addsection"],[data-act="import"],[data-act="mprices"]').forEach(b=>b.remove());
      const q=$('#q');if(q){q.readOnly=true;q.placeholder='Только просмотр — правка по ссылке недоступна';}
      toast('Только просмотр. Чтобы править, войдите как сотрудник компании.',6000);
    }
    specs=[{id:full.uid,number:full.number||'',title:full.title||'Спецификация',date:fmtDate(full.updated_at),rows:asRows(full.rows)}];
    await openSpec(full.uid);
    return;   // опрос запускает go('editor') внутри openSpec
  }
  let list;
  try{list=await api('/specs');}
  catch(e){
    // Демо-проект вместо ошибки — плохая идея: на общем компьютере он выглядит
    // как чужая рабочая смета, её начинают править и «теряют». Показываем причину.
    srcWarn(e);specs=[];setSource();
    // Раздел выбираем по роли и здесь: исполнителю список смет не нужен и без
    // отказа — иначе он на секунду видит чужой экран с ошибкой вместо смены.
    await scriptsParsed();fseStart(roleDefault(curRole()));
    $('#specList').innerHTML='<div class="sub" style="padding:16px">Не удалось загрузить список спецификаций: '
      +esc((e&&e.message)||'нет связи с сервером')
      +'<div style="margin-top:12px"><button class="btn sm" data-act="reload">Повторить</button></div></div>';
    return;
  }
  specs=list.map(mapSpec);
  // Проекты грузятся отдельно и молча падать не имеют права: без них список
  // выглядит как список несвязанных смет, то есть врёт о состоянии дел.
  try{projects=await api('/projects');}
  catch(e){projects=[];prjErr('Проекты не загрузились: '+((e&&e.message)||'нет связи')
    +'. Сметы показаны по одной.');}
  setSource();
  await scriptsParsed();fseStart(roleDefault(curRole()));
})();

// Enter в названии позиции — повторный поиск по каталогу. Раньше поиск
// запускался только по уходу фокуса: чтобы система попробовала ещё раз,
// надо было щёлкнуть мышкой в стороне, и догадаться об этом было нельзя.
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const el=e.target;
  if(!el||!el.dataset||el.dataset.f!=='name')return;
  e.preventDefault();
  const rw=el.closest('.rowwrap'); if(!rw)return;
  const r=rows.find(x=>x.id===rw.dataset.id); if(!r)return;
  el.blur();                       // сохранит правку через focusout
  // Работу в каталоге оборудования не ищут: там её нет, и подсказка каждый раз
  // отвечала бы «в базе не нашлось» на строку, которой там и не место.
  if(!r.work&&(r.name||'').trim().length>=2){toast('Ищу в каталоге…');offerVariants(r);}
});
