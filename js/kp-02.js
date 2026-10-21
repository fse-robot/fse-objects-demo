// ── Закупки — три вкладки одного раздела ──
// «Заявки» и «Склад» рисует kp-12 (SUPPLY), «Документы» — этот файл:
// таблица позиций закупки по объекту, которую собирают руками; накладная
// (УПД, ТОРГ-12) распознаётся в ту же таблицу. Позиция закупки связана со
// строками сметы — той же позицией, заменой или несколькими сразу
// (ADR-0047). Разделены по правам: очередь и склад ведёт снабжение
// (supply:manage), документы заводит и менеджер (purchase:read/write).
(function(){
// Раздел «Закупки» уже описан в SECT_SCOPE (purchase:read) — перечислять роли
// здесь больше не нужно. ГОНКА осталась: applyRoleNav мог отработать по /auth/me
// ДО этого блока (фетч резолвится между script-блоками), поэтому переприменяем.
try{if(typeof applyRoleNav==='function')applyRoleNav();}catch(e){}
var PUR={specId:null,draft:null,busy:false,list:null};
// Загружать накладные — право purchase:write. Смотреть историю — purchase:read.
function purCanUse(){return can('purchase:write');}
function purMoney(n){return money(n)+' ₽';}
// Счётная форма существительного: «1 позиция», «2 позиции», «5 позиций».
function purPlural(n,a,b,c){var m=Math.abs(n)%100,d=m%10;
 return (m>10&&m<20)?c:(d===1?a:(d>1&&d<5?b:c));}
// Строка «сумма не сходится»: цена × количество расходится с суммой
// документа больше чем на 5%. Считается и после правки чисел руками —
// иначе исправленная строка осталась бы помеченной, а испорченная чистой.
function purSuspect(l){var q=+l.qty||0,pr=+l.price||0,t=l.total==null||l.total===''?0:+l.total;
 return !!(q&&pr&&t&&Math.abs(pr*q-t)/Math.max(t,0.01)>0.05);}
function purLineTotal(l){var t=l.total==null||l.total===''?null:+l.total;
 return t!=null&&!isNaN(t)?t:Math.round((+l.qty||0)*(+l.price||0)*100)/100;}
function purEnsure(){var v=document.getElementById('zakupkiView');
 if(!v){v=document.createElement('div');v.id='zakupkiView';$('#specsView').parentNode.appendChild(v);purBind(v);}
 v.style.display='';return v;}
// ── навигация: оборачиваем go() ──
var _go=window.go;
window.go=function(view){
  var zv=document.getElementById('zakupkiView');
  if(view!=='zakupki'){if(zv)zv.style.display='none';return _go(view);}
  // Три вкладки — два права. Очередь заявок и склад открыты снабжению
  // (supply:manage), документы — менеджеру и снабжению (purchase:read).
  if(!can('purchase:read')&&!can('supply:manage')){
    toast('Раздел «Закупки» вам не выдан');return;}
  drawer(false);if(window.fseTrack)fseTrack('view:zakupki');
  document.querySelectorAll('.nav[data-go]').forEach(function(n){n.classList.toggle('act',n.dataset.go==='zakupki');});
  // Прячем ВСЕ разделы, а не перечисленные поимённо: список забывали пополнять
  // при добавлении нового экрана, и он оставался видимым под текущим.
  hideViewsExcept('zakupkiView');
  purEnsure();purRender();
  if(PURTAB==='docs'){if(PUR.list===null)purLoadList();}
  else if(window.SUPPLY)SUPPLY.load();
};
// ── план/факт закупки под строкой вкладки «Себестоимость» (рисует kp-01b) ──
function purFactHTML(r){var fq=+r.factQty||0;if(!fq)return '';
 var avg=(+r.factSum||0)/fq,plan=+r.zakup||0;
 var d=plan>0?Math.round((avg-plan)/plan*1000)/10:null;
 var col=d==null?'':(d>0.5?'var(--red)':'var(--grn)');
 return '<div class="sub" style="margin:2px 0 0">Куплено <b>'+(+r.kupleno||fq)+'</b> из '+(+r.qty||0)+
   ' · факт ср. <b>'+purMoney(avg)+'</b>'+(d==null?'':' · <b style="color:'+col+'">Δ '+(d>0?'+':'')+d+'%</b> к плану')+'</div>'+
   (r.zamena?'<div class="sub" style="margin:1px 0 0">↔ куплено как: <i>'+esc(r.zamena)+'</i></div>':'');}
window.purFactHTML=purFactHTML;
// ── рендер раздела ──
function purSpecOpts(sel){return (specs||[]).map(function(s){
  return '<option value="'+esc(s.id)+'"'+(String(s.id)===String(sel)?' selected':'')+'>'+esc(s.title||s.id)+'</option>';}).join('');}
function purIco(n){return '<svg class="i"><use href="#'+n+'"/></svg>';}
// Вкладка раздела живёт на window: kp-12 решает по ней, что подгружать.
// Держать это состояние в двух файлах значило бы разъехаться на первой же
// перерисовке.
window.PURTAB=null;
var PURTABS=[['req','Заявки','i-cart','supply:manage'],
             ['stock','Склад','i-box','supply:manage'],
             ['docs','Документы','i-doc','purchase:read']];
var PURSUB={req:'Очередь заявок с объектов: кто подал, что и на какой стадии поставки',
            stock:'Остатки, движение ТМЦ и материальные затраты по объектам',
            docs:'Позиции закупки по объекту: вносятся руками или из распознанной накладной и ложатся на строки сметы'};
var PURDOCT=[['upd','УПД'],['torg12','ТОРГ-12'],['other','Документ']];
var PURKIND=[['match','та же позиция'],['replace','замена']];
function purTabs(){
 var t=PURTABS.filter(function(x){return can(x[3]);});
 if(!PURTAB||!t.some(function(x){return x[0]===PURTAB;}))
   window.PURTAB=t.length?t[0][0]:'docs';
 if(t.length<2)return '';
 return '<div class="stabs">'+t.map(function(x){
   return '<button class="stab'+(PURTAB===x[0]?' on':'')+'" data-act="pur-tab" '
     +'data-t="'+x[0]+'" title="'+x[1]+'">'+purIco(x[2])
     +'<span class="lbl">'+x[1]+'</span></button>';}).join('')+'</div>';
}
function purDraft(){if(!PUR.draft)PUR.draft={doc:{doc_type:'other',doc_number:'',doc_date:'',
  supplier_name:'',supplier_inn:'',filename:null},lines:[],ocr:false,warn:null};return PUR.draft;}
function purRender(){var v=purEnsure();
 // Вкладки считаем ПЕРВЫМИ: purTabs() и выбирает вкладку по умолчанию, а
 // подпись раздела зависит от неё.
 var tabs=purTabs();
 var nm={req:'очередь заявок',stock:'склад',docs:'документы'}[PURTAB];
 var on=document.getElementById('objname');
 if(on)on.textContent='Закупки — '+nm;
 var head='<div class="ph"><div><h1>Закупки</h1><p>'+PURSUB[PURTAB]+'</p></div></div>'+tabs;
 if(PURTAB!=='docs'){
  v.innerHTML=head+(window.SUPPLY
    ?(PURTAB==='req'?SUPPLY.reqView():SUPPLY.stockView())
    :'<div class="cd"><div class="pd sub">Модуль снабжения не загрузился — '
      +'обновите страницу.</div></div>');
  return;
 }
 v.innerHTML=head
  +(purCanUse()?purDocHTML():'')
  +'<div class="cd"><div class="cdh"><h2>История закупок</h2></div>'
  +'<div id="purList">'+purListHTML()+'</div></div>';
 var dz=document.getElementById('purDrop');
 if(dz&&window.UI&&UI.dropzone)UI.dropzone(dz,function(files){if(files&&files[0])purParseFile(files[0]);});
}
// Шапка документа и таблица позиций — одна карточка: это один документ.
// Выбор объекта стоит первым, потому что без него позиции класть некуда.
function purDocHTML(){var d=purDraft().doc;
 var dt=PURDOCT.map(function(x){return '<option value="'+x[0]+'"'+(d.doc_type===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('');
 return '<div class="cd" style="margin-bottom:14px"><div class="cdh"><h2>Новая закупка</h2>'
  +'</div>'
  +'<div class="pd pd0">'
  +'<div class="fld" style="margin-bottom:12px"><label for="purSpec">Объект — смета, к которой относится закупка</label>'
  +'<select id="purSpec" class="inp" style="width:100%;max-width:420px">'
  +'<option value="">Не выбран</option>'+purSpecOpts(PUR.specId)+'</select></div>'
  +(PUR.specId?'':'<div class="fnote warn" style="margin-bottom:12px">Сначала выберите объект: '
     +'без него непонятно, в какую смету класть позиции.</div>')
  +'<div class="frow" style="margin-bottom:12px">'
  +'<div class="fld"><label>Документ</label><select class="inp" data-d="doc_type">'+dt+'</select></div>'
  +'<div class="fld"><label>Номер</label><input class="inp" data-d="doc_number" value="'+esc(d.doc_number||'')+'" style="width:120px"></div>'
  +'<div class="fld"><label>Дата</label><input class="inp" data-d="doc_date" value="'+esc(d.doc_date||'')+'" placeholder="дд.мм.гггг" style="width:120px"></div>'
  +'<div class="fld" style="flex:1 1 200px"><label>Поставщик</label><input class="inp" data-d="supplier_name" value="'+esc(d.supplier_name||'')+'"></div>'
  +'<div class="fld"><label>ИНН</label><input class="inp" data-d="supplier_inn" value="'+esc(d.supplier_inn||'')+'" style="width:130px"></div>'
  +'</div>'
  // Накладная — помощник: зона загрузки раскрыта, пока таблица пуста, и
  // сжимается в полосу, когда строки есть. Под таблицей она читалась бы
  // как итог. Пока файл разбирается, на месте зоны стоят полоски
  // загрузки: состояние видно там, куда только что нажали, а второе
  // нажатие невозможно.
  +(PUR.busy?'<div id="purBusy"><div class="sub" style="margin-bottom:6px">Распознаю документ…</div>'
     +(window.UI?UI.loading(3):'')+'</div>'
   :'<div class="fdrop'+(purDraft().lines.length?' bar':'')+'" id="purDrop" data-act="pur-file" title="Распознать УПД или накладную">'
  +purIco('i-imp')
  +'<b>Добавить позиции из накладной: перетащите файл или нажмите</b>'
  +'<span>Строки лягут в эту же таблицу. Excel, CSV и PDF с текстовым слоем читаются по ячейкам — '
  +'точнее всего. Скан и фотографию (PDF, JPG, PNG) система распознаёт сама, но числа '
  +'после этого нужно проверить глазами.</span>'
  +'</div>')+'<input type="file" id="purFile" style="display:none" '
  +'accept=".pdf,.xlsx,.xlsm,.xls,.csv,.jpg,.jpeg,.png">'
  +'</div>'
  +'<div id="purTable">'+purTableHTML()+'</div></div>';}
function purTableHTML(){var p=purDraft();
 var head=p.doc.filename?'<div class="pd" style="border-top:1px solid var(--line)"><div class="sub">'
  +'Из файла '+esc(p.doc.filename)+(p.ocr?' <span class="ch warn">распознано с картинки — проверьте числа</span>':'')+'</div>'
  +(p.warn?'<div class="fnote warn">'+esc(p.warn)+'</div>':'')+'</div>':'';
 var rowsOpts=purRowsOptions();
 var trs=p.lines.map(function(l,i){
  return '<tr'+(l.suspect?' class="suspect"':'')+'>'
   +'<td data-l="Позиция по документу"><div class="purname">'
   +'<input class="f'+(l.name_raw?'':' todo')+'" data-k="name_raw" data-idx="'+i+'" value="'+esc(l.name_raw||'')+'" placeholder="—" autocomplete="off">'
   +'<div class="drop" data-drop="'+i+'"></div></div>'
   +(l.suspect?'<span class="ch warn" title="цена×кол-во ≠ сумма">сумма не сходится</span>':'')+'</td>'
   +'<td data-l="Ед."><input class="f" data-k="unit" data-idx="'+i+'" value="'+esc(l.unit||'')+'" style="width:52px"></td>'
   +'<td data-l="Кол-во"><input class="f'+(+l.qty>0?'':' todo')+'" data-k="qty" data-idx="'+i+'" value="'+esc(l.qty==null?'':l.qty)+'" placeholder="—" style="width:70px"></td>'
   +'<td data-l="Цена ₽"><input class="f'+(+l.price>0?'':' todo')+'" data-k="price" data-idx="'+i+'" value="'+esc(l.price==null?'':l.price)+'" placeholder="—" style="width:90px"></td>'
   +'<td data-l="Сумма ₽"><input class="f" data-k="total" data-idx="'+i+'" value="'+esc(l.total==null?'':l.total)+'" placeholder="'+esc(money(purLineTotal(l)))+'" style="width:100px"></td>'
   +'<td data-l="Строка сметы">'+purLinksHTML(l,i,rowsOpts)+'</td>'
   +'<td class="inc"><button class="btn sm io" data-act="pur-rm" data-idx="'+i+'" title="Убрать позицию">'+purIco('i-x')+'</button></td></tr>';}).join('');
 var n=p.lines.filter(purLineReady).length;
 var linked=p.lines.filter(function(l){return purLineReady(l)&&purLinksOf(l).length;}).length;
 return head+(p.lines.length
  ?'<table class="purtbl">'
   +'<tr><th>Позиция по документу</th><th>Ед.</th><th>Кол-во</th><th>Цена ₽</th><th>Сумма ₽</th><th>Строка сметы</th><th></th></tr>'
   +trs+'</table>'
  :'<div class="pd" style="border-top:1px solid var(--line)"><div class="sub">Позиций пока нет: добавьте строку или распознайте накладную.</div></div>')
  +'<div id="purBad">'+purBadHTML()+'</div>'
  +'<div class="pd" style="border-top:1px solid var(--line);display:flex;gap:9px;flex-wrap:wrap;align-items:center">'
  +'<button class="btn sm" data-act="pur-add">'+purIco('i-plus')+'<span class="lbl">Позиция</span></button>'
  +'<button class="btn primary" data-act="pur-confirm"'+(n?'':' disabled')+'>Сохранить закупку ('+n+' поз.)</button>'
  +(p.lines.length?'<button class="btn" data-act="pur-cancel">Очистить</button>':'')
  +'<span class="hint" style="margin-left:auto" id="purHint">'+purHintText(n,linked)+'</span></div>';}
function purHintText(n,linked){if(!n)return 'Позиция сохраняется, когда есть название и количество';
 return n-linked?(n-linked)+' '+purPlural(n-linked,'позиция','позиции','позиций')+' без строки сметы — сохранится в документе, в смету не попадёт':'Все позиции лягут на строки сметы';}
function purLineReady(l){return !!(String(l.name_raw||'').trim()&&(+l.qty||0)>0);}
// Связи, которые уйдут в учёт: со строкой и с количеством. Пустая связь —
// незаполненный выбор, а не намерение.
function purLinksOf(l){return (l.links||[]).filter(function(k){return k.row_id&&(+k.qty||0)>0;});}
// Ячейка «Строка сметы»: связей может быть несколько — одна бухта закрывает
// две строки кабеля. Вид связи стоит рядом с каждой, а не у позиции.
function purLinksHTML(l,i,rowsOpts){
 var cands=l.candidates||[];
 var rows=(l.links||[]).map(function(k,j){
  var sel='<select data-k="row" data-idx="'+i+'" data-j="'+j+'">'
   +'<option value="">— выбрать —</option>'
   +'<option value="__new__"'+(k.row_id==='__new__'?' selected':'')+'>Новая позиция в смете</option>';
  if(cands.length)sel+='<optgroup label="Похожие">'+cands.map(function(c){
    return '<option value="'+esc(c.row_id)+'"'+(k.row_id===c.row_id?' selected':'')+'>'
     +Math.round(c.score*100)+'% · '+esc(c.name)+((c.zakup&&can('cost:read'))?' (план '+purMoney(c.zakup)+')':'')+'</option>';}).join('')+'</optgroup>';
  sel+='<optgroup label="Все строки сметы">'+rowsOpts.filter(function(o){
    return !cands.some(function(c){return c.row_id===o.id;});}).map(function(o){
    return '<option value="'+esc(o.id)+'"'+(k.row_id===o.id?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'</optgroup></select>';
  var kind=k.row_id==='__new__'?'':'<select data-k="kind" data-idx="'+i+'" data-j="'+j+'" title="Вид связи">'
   +PURKIND.map(function(x){return '<option value="'+x[0]+'"'+((k.kind||'match')===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select>';
  return '<div class="purlink">'+sel
   +'<input class="fmini" data-k="lqty" data-idx="'+i+'" data-j="'+j+'" value="'+esc(k.qty==null?'':k.qty)+'" title="Единиц по смете">'
   +kind+'<button class="btn sm io" data-act="pur-unlink" data-idx="'+i+'" data-j="'+j+'" title="Убрать связь">'+purIco('i-x')+'</button></div>';}).join('');
 return rows+((l.links||[]).length?'':'<div class="hint" style="margin-bottom:5px">Без строки сметы — в смету не попадёт</div>')
  +'<button class="btn sm" data-act="pur-link" data-idx="'+i+'">'+purIco('i-plus')+'<span class="lbl">'+((l.links||[]).length?'Ещё строка':'Строка сметы')+'</span></button>';}
// Предупреждение о строках с расхождением. Отдельным узлом, потому что
// обновляется по каждой правке числа вместе со счётчиком у кнопки.
function purBadHTML(){var p=PUR.draft;if(!p)return '';
 var bad=p.lines.filter(function(l){return l.suspect;}).length;
 if(!bad)return '';
 return '<div class="pd" style="border-top:1px solid var(--line)"><div class="fnote warn">'+
  bad+' '+purPlural(bad,'строка','строки','строк')+' с расхождением: цена × количество '+
  'не сходится с суммой документа. Проверьте числа — в закупку уйдёт то, что в таблице.</div></div>';}
function purRowsOptions(){var s=(specs||[]).find(function(x){return String(x.id)===String(PUR.specId);});
 return ((s&&s.rows)||[]).filter(function(r){return r&&r.name&&r.type!=='section'&&r.type!=='calc'&&!r.work;})
  .map(function(r){return {id:String(r.id),name:String(r.name).slice(0,90)};});}
function purListHTML(){
 if(PUR.list===null)return (window.UI?UI.loading(3):'<div class="pd sub">Загружаю…</div>');
 if(!PUR.list.length)return (window.UI?UI.empty({icon:'i-cart',title:'Закупок пока нет',
   text:PUR.specId?'Внесите позиции в таблицу выше или распознайте накладную.'
                  :'Выберите объект и заведите первую закупку.'})
   :'<div class="pd sub">Закупок пока нет.</div>');
 var tn={upd:'УПД',torg12:'ТОРГ-12',other:'Документ'};
 return PUR.list.map(function(d){
  return '<div class="purdoc">'+
   '<div class="purdh"><b>'+tn[d.doc_type||'other']+
   (d.doc_number?' № '+esc(d.doc_number):'')+(d.doc_date?' от '+esc(d.doc_date):'')+'</b>'+
   // Сумма документа — закупочная цена. Менеджеру и исполнителю её видеть не
   // положено: по ней восстанавливается вся себестоимость объекта.
   '<span><b>'+(can('cost:read')?purMoney(d.total_sum):'—')+'</b> '+
   (can('purchase:write')?'<button class="btn sm io danger" data-act="pur-del" data-id="'+esc(d.id)+'" title="Удалить закупку">'+purIco('i-trash')+'</button>':'')+'</span></div>'+
   '<div class="sub">'+esc(d.supplier_name||'')+(d.supplier_inn?' · ИНН '+esc(d.supplier_inn):'')+
   ' · объект: '+esc(d.spec_title||d.spec_id)+' · '+esc(d.uploaded_by||'')+' · '+esc((d.created_at||'').slice(0,16))+'</div>'+
   '<details><summary class="sub" style="cursor:pointer">'+d.lines.length+' '+
   purPlural(d.lines.length,'позиция','позиции','позиций')+'</summary>'+
   // То же и построчно: цена за единицу — это и есть закупка.
   d.lines.map(function(l){return '<div class="sub" style="padding:2px 0 2px 12px">'+esc(l.name_raw)+
    ' — '+esc(l.qty||0)+(l.unit?' '+esc(l.unit):'')+' × '+(can('cost:read')?(l.price==null?'—':money(l.price)):'—')+' ₽'+
    purHistLinks(l)+'</div>';}).join('')+
   '</details></div>';}).join('');}
// Замена в истории названа обеими сторонами: по документу — в строке,
// по смете — в связи, со словом «вместо».
function purHistLinks(l){var ks=l.links||[];
 if(!ks.length)return ' <b style="color:var(--red)">не в смете</b>';
 return ks.map(function(k){return (k.kind==='replace'?' ↔ вместо <i>':' → <i>')+esc(k.row_name||k.row_id)+'</i>'
  +(ks.length>1?' ('+esc(k.qty)+')':'');}).join(',');}
// ── данные ──
async function purLoadList(){try{
  PUR.list=await _authGet('purchases'+(PUR.specId?'?spec_id='+encodeURIComponent(PUR.specId):''));
 }catch(e){PUR.list=[];toast(e.message);}var el=document.getElementById('purList');if(el)el.innerHTML=purListHTML();}
// Строки сметы нужны сразу, как выбран объект: без них нечего подставлять
// в связь. Список смет приходит без строк, полная смета — отдельным запросом.
async function purLoadSpec(){var s=(specs||[]).find(function(x){return String(x.id)===String(PUR.specId);});
 if(!s)return null;
 try{
  if(typeof LIVE!=='undefined'&&LIVE&&s._meta){var full=await api('/specs/'+s.id);s.rows=asRows(full.rows);s.updated_at=full.updated_at;s._meta=false;
   var t=document.getElementById('purTable');if(t)t.innerHTML=purTableHTML();}
 }catch(e){}
 return s;}
function purNewLine(src){return Object.assign({name_raw:'',unit:'шт',qty:'',price:'',total:'',vat_pct:null,
  candidates:[],links:[],suspect:false},src||{});}
function purParseFile(file){
 if(!PUR.specId){toast('Сначала выберите объект (спеку)');return;}
 return purParseInto(file);}
async function purParseInto(file){
 var s=await purLoadSpec();
 if(!s){toast('Спека не найдена');return;}
 var b64=await new Promise(function(res,rej){var fr=new FileReader();
  fr.onload=function(){res(String(fr.result));};fr.onerror=rej;fr.readAsDataURL(file);});
 PUR.busy=true;purRender();
 try{
  var snap=(asRows(s.rows)||[]).map(function(r){return {id:r.id,type:r.type,work:r.work,name:r.name,code:r.code,unit:r.unit,qty:r.qty,zakup:r.zakup};});
  var out=await _authPost('purchases/parse',{filename:file.name,content_b64:b64,rows:snap});
  var p=purDraft();
  // Реквизиты из файла заполняют пустые поля и не трогают вписанное руками.
  ['doc_type','doc_number','doc_date','supplier_name','supplier_inn'].forEach(function(k){
   if(out.doc[k]&&(!p.doc[k]||p.doc[k]==='other'))p.doc[k]=out.doc[k];});
  p.doc.filename=out.doc.filename;p.ocr=!!out.ocr;p.warn=out.warn||null;
  // Похожая строка подставляется связью сразу: при высокой похожести —
  // как та же позиция, при средней — как замена; ниже — связь не угадывается.
  out.lines.forEach(function(l){var c0=l.candidates&&l.candidates[0];
   var links=[];
   if(c0&&c0.score>=0.55)links.push({row_id:c0.row_id,row_name:c0.name,qty:l.qty,kind:c0.score>=0.8?'match':'replace'});
   else if(!c0||c0.score<0.35)links.push({row_id:'__new__',row_name:null,qty:l.qty,kind:'match'});
   p.lines.push(purNewLine({name_raw:l.name_raw,unit:l.unit||'',qty:l.qty,price:l.price==null?'':l.price,
    total:l.total==null?'':l.total,vat_pct:l.vat_pct,candidates:l.candidates||[],links:links,suspect:!!l.suspect}));});
  toast('Распознано: '+out.lines.length+' '+purPlural(out.lines.length,'позиция','позиции','позиций'));
 }catch(e){toast(e.message,3500);}
 PUR.busy=false;purRender();}
// Флаг занятости: двойной тап по «Сохранить закупку» отправлял документ
// дважды, и kupleno/factQty/factSum в смете удваивались.
var _purSending=false;
async function purConfirm(){var p=PUR.draft;if(!p)return;
 if(_purSending)return;
 if(!PUR.specId){toast('Сначала выберите объект (спеку)');return;}
 var inc=p.lines.filter(purLineReady);
 if(!inc.length){toast('Нужна хотя бы одна позиция с названием и количеством');return;}
 var s=await purLoadSpec();
 if(!s){toast('Спека не найдена');return;}
 var byId={};purRowsOptions().forEach(function(o){byId[o.id]=o.name;});
 var lines=inc.map(function(l){
  var qty=+l.qty||0,price=+l.price||0;
  return {name_raw:String(l.name_raw).trim(),unit:l.unit||null,qty:qty,price:price,
   total:purLineTotal(l),vat_pct:l.vat_pct,
   links:purLinksOf(l).map(function(k){return {row_id:k.row_id==='__new__'?k.row_id:String(k.row_id),
    row_name:k.row_id==='__new__'?'новая позиция':(byId[k.row_id]||k.row_name||null),qty:+k.qty,kind:k.row_id==='__new__'?'match':(k.kind||'match')};})};});
 // Новая позиция в смете получает идентификатор до отправки: в документе
 // связь должна указывать на ту строку, которая появится в смете.
 var newIds={};
 lines.forEach(function(l,i){l.links.forEach(function(k){if(k.row_id==='__new__'){k.row_id=String(rid());newIds[k.row_id]=inc[i];}});});
 _purSending=true;
 try{
  await _authPost('purchases',{spec_id:String(PUR.specId),spec_title:s.title||'',doc:p.doc,lines:lines});
  // В смету факт ложится ТОЛЬКО после успешной записи. Деньги строки
  // закупки делятся между её связями по единицам сметы (ADR-0047).
  var hit=0,added=0;s.rows=asRows(s.rows);
  lines.forEach(function(l){var sum=l.links.reduce(function(a,k){return a+k.qty;},0);if(!sum)return;
   l.links.forEach(function(k){var share=l.total*k.qty/sum;
    var src=newIds[k.row_id];
    if(src){var nr=manualRow(String(l.name_raw).slice(0,200));nr.id=k.row_id;
     if(l.unit)nr.unit=String(l.unit).slice(0,10);
     nr.qty=k.qty;nr.zakup=l.price;nr.kupleno=k.qty;nr.factQty=k.qty;
     nr.factSum=Math.round(share*100)/100;s.rows.push(nr);added++;return;}
    var r=s.rows.filter(function(x){return String(x.id)===String(k.row_id);})[0];if(!r)return;
    r.kupleno=(+r.kupleno||0)+k.qty;r.factQty=(+r.factQty||0)+k.qty;
    r.factSum=Math.round(((+r.factSum||0)+share)*100)/100;
    if(k.kind==='replace')r.zamena=String(l.name_raw).slice(0,160);hit++;});});
  if(typeof curId!=='undefined'&&String(curId)===String(PUR.specId)){rows=s.rows;if(window.render)render();}
  // Сама закупка уже сохранена ручкой /purchases. Перезапись сметы — отдельное
  // право: у снабжения его нет, и PUT вернул бы 403 после успешной закупки,
  // выглядя как «закупка не прошла». Факт при этом на сервере есть.
  var canSpec=(typeof canEdit!=='function')||canEdit();
  if(!canSpec){/* правка смет не выдана — план/факт подтянется у того, кто её откроет */}
  else if(typeof LIVE!=='undefined'&&LIVE){await putSpec(s);}else if(window.saveLocal)saveLocal();
  toast('Закупка: '+lines.length+' поз. · факт в '+hit+' '+
   purPlural(hit,'строку','строки','строк')+' · новых в смете: '+added);
  PUR.draft=null;purRender();purLoadList();
 }catch(e){toast(e.message,3500);}
 finally{_purSending=false;}}
// ── подбор названия по каталогу: та же подсказка, что в смете ──
var _purSearchT=null;
function purSearch(inp){var i=+inp.dataset.idx,q=inp.value.trim();
 var box=inp.parentNode.querySelector('.drop');if(!box)return;
 clearTimeout(_purSearchT);
 if(typeof searchProducts!=='function'||q.length<SEARCH_MIN){box.classList.remove('on');return;}
 _purSearchT=setTimeout(async function(){
  var m=[];try{m=await searchProducts(q);}catch(e){}
  if(inp.value.trim()!==q)return;
  box.innerHTML=m.slice(0,6).map(function(c,n){return '<div class="drow" data-pick="'+i+':'+n+'"><div>'+esc(c.name)
   +'<div class="mt">'+(c.code?'<span class="art">'+esc(c.code)+'</span>':'')+'</div></div></div>';}).join('');
  box._items=m;box.classList.toggle('on',m.length>0);},250);}
function purPick(box,i,n){var c=box._items&&box._items[n];var p=PUR.draft;if(!c||!p||!p.lines[i])return;
 p.lines[i].name_raw=c.name;if(c.unit)p.lines[i].unit=c.unit;purRedrawTable();}
function purRedrawTable(){var t=document.getElementById('purTable');if(t)t.innerHTML=purTableHTML();}
function purRefreshCount(){var p=PUR.draft;if(!p)return;
 var n=p.lines.filter(purLineReady).length,linked=p.lines.filter(function(l){return purLineReady(l)&&purLinksOf(l).length;}).length;
 var b=document.querySelector('#purTable [data-act="pur-confirm"]');
 if(b){b.textContent='Сохранить закупку ('+n+' поз.)';b.disabled=!n;}
 var h=document.getElementById('purHint');if(h)h.textContent=purHintText(n,linked);
 var w=document.getElementById('purBad');if(w)w.innerHTML=purBadHTML();}
// ── события (делегирование на контейнер — НЕ на вставляемые позже элементы) ──
function purBind(v){if(v._purBound)return;v._purBound=1;
 v.addEventListener('click',function(ev){var b=ev.target.closest('[data-act],[data-pick]');if(!b)return;
  var p=PUR.draft,i=+b.dataset.idx;
  if(b.dataset.pick){var pr=b.dataset.pick.split(':');purPick(b.closest('.drop'),+pr[0],+pr[1]);return;}
  var act=b.dataset.act;
  if(act==='pur-tab'){window.PURTAB=b.dataset.t;purRender();
   if(PURTAB==='docs'){if(PUR.list===null)purLoadList();}
   else if(window.SUPPLY)SUPPLY.load();}
  else if(act==='pur-file'){var f=document.getElementById('purFile');if(f)f.click();}
  else if(act==='pur-add'){purDraft().lines.push(purNewLine());purRedrawTable();
   var last=document.querySelector('#purTable [data-k="name_raw"][data-idx="'+(purDraft().lines.length-1)+'"]');if(last)last.focus();}
  else if(act==='pur-rm'){if(p){p.lines.splice(i,1);purRedrawTable();}}
  else if(act==='pur-link'){if(p&&p.lines[i]){if(!PUR.specId){toast('Сначала выберите объект (спеку)');return;}
   (p.lines[i].links=p.lines[i].links||[]).push({row_id:'',row_name:null,qty:p.lines[i].qty,kind:'match'});purRedrawTable();}}
  else if(act==='pur-unlink'){if(p&&p.lines[i]){p.lines[i].links.splice(+b.dataset.j,1);purRedrawTable();}}
  else if(act==='pur-confirm')purConfirm();
  else if(act==='pur-cancel'){PUR.draft=null;purRender();}
  else if(act==='pur-del'){
   var kill=function(){_authPost('purchases/delete',{id:+b.dataset.id})
     .then(function(){toast('Закупка удалена');purLoadList();})
     .catch(function(e){toast(e.message);});};
   if(window.UI&&UI.confirm)UI.confirm({title:'Удалить закупку?',
     text:'Документ пропадёт из истории.',
     warn:'Факт из строк сметы при этом не вычитается — количество останется прежним.',
     ok:'Удалить',okIcon:'i-trash'}).then(function(y){if(y)kill();});
   else if(confirm('Удалить закупку? Факт из строк сметы не вычитается.'))kill();}});
 v.addEventListener('input',function(ev){var t=ev.target;if(t.dataset&&t.dataset.k==='name_raw')purSearch(t);});
 v.addEventListener('focusout',function(ev){var t=ev.target;if(t.dataset&&t.dataset.k==='name_raw'){
  var box=t.parentNode.querySelector('.drop');if(box)setTimeout(function(){box.classList.remove('on');},150);}});
 v.addEventListener('change',function(ev){var t=ev.target;
  if(t.id==='purSpec'){PUR.specId=t.value||null;purRender();purLoadList();purLoadSpec();return;}
  if(t.id==='purFile'){if(t.files&&t.files[0])purParseFile(t.files[0]);t.value='';return;}
  var p=PUR.draft;if(!p)return;
  if(t.dataset.d){p.doc[t.dataset.d]=t.value;return;}
  var i=+t.dataset.idx,k=t.dataset.k;if(!p.lines[i]||!k)return;var l=p.lines[i];
  if(k==='row'||k==='kind'||k==='lqty'){var kk=l.links[+t.dataset.j];if(!kk)return;
   if(k==='row'){kk.row_id=t.value;var o=purRowsOptions().filter(function(x){return x.id===t.value;})[0];kk.row_name=o?o.name:null;
    if(!kk.qty&&l.qty)kk.qty=l.qty;purRedrawTable();return;}
   if(k==='kind')kk.kind=t.value;else{kk.qty=String(t.value).replace(',','.');kk._own=true;}
   purRefreshCount();return;}
  if(k==='qty'||k==='price'||k==='total'){l[k]=String(t.value).replace(',','.');l.suspect=purSuspect(l);
   // Количество связи следует за количеством позиции, пока его не вписали отдельно.
   if(k==='qty')(l.links||[]).forEach(function(kk){if(!kk._own)kk.qty=l.qty;});
   purRedrawTable();return;}
  l[k]=t.value;purRefreshCount();});}
// Перерисовка раздела снаружи: kp-12 зовёт её после каждой своей загрузки,
// как kp-11 зовёт renderShift.
window.renderZakupki=purRender;
})();
