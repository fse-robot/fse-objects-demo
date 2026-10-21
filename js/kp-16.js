/* ── Блок 16. Конъюнктурный анализ (#403) ─────────────────────────────
   Третья вкладка сметы. Методика 421/пр требует по каждому материалу
   цены не менее трёх поставщиков, приведённые к сметной цене без НДС,
   и ссылку на документ, которым цена подтверждена. Без этого смета не
   проходит государственную экспертизу.

   Позиция остаётся строкой сметы на той же сетке, что «КП клиенту» и
   «Себестоимость»; предложения раскрываются блоком под ней. Позиции
   свои не заводятся — это те же строки сметы.

   Предложения приходят тремя путями: из каталога цен, из загруженного
   КП поставщика (разбирает /import/offer) и руками. Хранятся в самой
   позиции, в поле `ka`, и поэтому попадают под гриф себестоимости:
   цены поставщиков не уходят в браузер тому, кому не видна закупка
   (backend/api/fse_auth.py, COST_FIELDS).

   Реквизиты — свойство компании, а не предложения: список компаний
   собирается сам из всех предложений и правится одним окном.

   Процент по отмеченным ложится на принятую цену и НЕ переписывает
   цены поставщиков: документ утверждает, что цена рыночная, и
   ссылается на прайс. */
(function(){
if(window.__kaV1)return; window.__kaV1=true;

var SOFT_NAME='FSE Data House';      /* Meta/Soft — чем собран файл */
var SOFT_VER='1.0';
var SCHEMA_VER='1.01';
var ACCESS=['общедоступная информация','для служебного пользования','коммерческая тайна'];
var STATUS={1:'производитель',2:'поставщик'};
var MONTHS=['январь','февраль','март','апрель','май','июнь','июль','август',
            'сентябрь','октябрь','ноябрь','декабрь'];
var SHOW=4;                          /* предложений видно до «показать ещё» */
var NEED=3;                          /* сколько цен требует Методика */

function $(s){return document.querySelector(s);}
function E(s){return esc(s);}
function num(v){var n=parseFloat(String(v==null?'':v).replace(/\s/g,'').replace(',','.'));
  return isFinite(n)?n:0;}
function m2(n){return (Math.round((+n||0)*100)/100).toLocaleString('ru-RU',
  {minimumFractionDigits:2,maximumFractionDigits:2});}
function dec(n){return (Math.round((+n||0)*100)/100).toFixed(2);}
function nrm(s){return String(s==null?'':s).toLowerCase().replace(/\s+/g,' ').trim();}

/* ── величины ─────────────────────────────────────────────────────── */

function vat(){var v=+calcCfg().vatPct;return v>0?v:VAT_DEFAULT;}
/* Цена без НДС считается из цены с НДС только тогда, когда её не вписали:
   поставщик округляет по-своему, и его число вернее нашего деления. */
function noVat(o){return +o.priceNoVat>0?+o.priceNoVat:(+o.priceVat||0)/(1+vat()/100);}
function storage(o){return (noVat(o)+(+o.transport||0))*(+o.storagePct||0)/100;}
function estimate(o){return noVat(o)+(+o.transport||0)+storage(o);}
/* Процент по позиции — надбавка или скидка к принятой цене. Цены
   поставщиков он не трогает: в анализе они остаются такими, какими их
   дал поставщик, и коэффициент виден отдельно. */
function pct(r){return +r.kaPct||0;}
function accPrice(r){var p=picked(r);return p?estimate(p)*(1+pct(r)/100):null;}

/* Позиции анализа — материалы и оборудование сметы. Работы в него не
   идут: конъюнктурный анализ ведут по ресурсам, а не по монтажу. */
function items(){return (rows||[]).filter(function(r){
  return r&&r.type!=='section'&&r.type!=='calc'&&!r.work;});}
function skip(r){return !!r.work;}
function offers(r){return Array.isArray(r.ka)?r.ka:[];}
/* Сортировка по сметной цене: сравнивают с дешёвого. */
function sorted(r){return offers(r).slice().sort(function(a,b){return estimate(a)-estimate(b);});}
/* Принятая в смету — наименьшая сметная цена, пока не выбрали другую. */
function picked(r){var os=offers(r);if(!os.length)return null;
  var byId=os.filter(function(o){return o.id===r.kaPick;})[0];
  if(byId)return byId;
  return os.slice().sort(function(a,b){return estimate(a)-estimate(b);})[0];}
/* Видно четыре самых дешёвых и принятое; остальное — строкой .katail. */
function shown(r){var os=sorted(r),pk=picked(r);
  if(r.kaAll)return {head:os,tail:[]};
  var vis=os.slice(0,SHOW);
  if(pk&&vis.indexOf(pk)<0)vis=vis.concat([pk]);
  return {head:vis,tail:os.filter(function(o){return vis.indexOf(o)<0;})};}
function needsMore(r){return offers(r).length<NEED;}
function noReq(o){var c=o.company||{};return !(c.kpp&&c.inn);}

/* ── шапка документа ──────────────────────────────────────────────── */

function cfg(){var c=rows.find(function(x){return x.type==='calc';});
  if(!c){c={id:rid(),type:'calc',transportPct:2,overheadPct:3,machinesPct:1,vatPct:VAT_DEFAULT};
    rows.unshift(c);}
  return c;}
function head(){var c=calcCfg();if(!c.kaHead)c.kaHead={};return c.kaHead;}
function setHead(k,v){var c=cfg();if(!c.kaHead)c.kaHead={};
  var p=k.split('.');
  if(p.length===2){if(!c.kaHead[p[0]])c.kaHead[p[0]]={};c.kaHead[p[0]][p[1]]=v;}
  else c.kaHead[k]=v;
  saveCur();}
function objName(){var s=(specs||[]).find(function(x){return x.id===curId;})||{};
  return head().object||s.object||s.title||'';}

/* ── компании ─────────────────────────────────────────────────────────
   Список собирается сам из всех предложений — из каталога и из присланных
   КП. Реквизиты вводят один раз на компанию: у одной компании предложения
   по большинству позиций, и ввод в строке был бы вводом одного ИНН
   десятки раз. */

function supDir(){var c=calcCfg();if(!c.kaSup)c.kaSup={};return c.kaSup;}
function blankSup(name){return {name:name||'',inn:'',kpp:'',site:'',place:'',status:2};}
/* Второй справочник, общий для всех смет этого браузера: ИНН одного и того
   же магазина вводят один раз, а не заново на каждом объекте. Общего на
   компанию места для него нет — ADR-0051. */
var GK='fse_ka_sup';
function glob(){try{return JSON.parse(localStorage.getItem(GK)||'{}')||{};}catch(e){return {};}}
function globPut(nc){try{var g=glob();g[nrm(nc.name)]=nc;
  localStorage.setItem(GK,JSON.stringify(g));}catch(e){}}
function suppliers(){
  var by={},dir=supDir();
  Object.keys(dir).forEach(function(k){by[k]=Object.assign(blankSup(),dir[k],{n:0});});
  items().forEach(function(r){offers(r).forEach(function(o){
    var c=o.company||{},k=nrm(c.name);if(!k)return;
    if(!by[k])by[k]=Object.assign(blankSup(),c,{n:0});
    by[k].n++;});});
  return Object.keys(by).map(function(k){return Object.assign({key:k},by[k]);})
    .sort(function(a,b){return (b.n-a.n)||a.name.localeCompare(b.name,'ru');});}
/* Правка реквизитов закрывает пропуск сразу у всех предложений компании
   и остаётся в справочнике сметы — новое предложение той же компании
   подставит их само. */
function applySupplier(wasKey,nc){
  var dir=supDir();
  nc=Object.assign(blankSup(),nc);
  dir[nrm(nc.name)]=nc;
  globPut(nc);
  if(wasKey&&wasKey!==nrm(nc.name))delete dir[wasKey];
  items().forEach(function(r){offers(r).forEach(function(o){
    var k=nrm((o.company&&o.company.name)||'');
    if(k===wasKey||k===nrm(nc.name))o.company=Object.assign({},nc);});});}
function reqGaps(){var all=suppliers();
  return {total:all.length,bad:all.filter(function(s){return !(s.inn&&s.kpp);}).length};}
/* Выбор для предложения шире списка этой сметы: в свежем объекте компаний
   в анализе ещё нет, а реквизиты уже введены раньше. */
function choices(){
  var out=suppliers(),have={};
  out.forEach(function(s){have[s.key]=1;});
  var g=glob();
  Object.keys(g).forEach(function(k){if(!have[k])
    out.push(Object.assign({key:k,n:0},blankSup(),g[k]));});
  return out;}
function supOpts(cur){
  var k=nrm(cur||'');
  var h=choices().map(function(s){return '<option value="'+E(s.key)+'"'
    +(s.key===k?' selected':'')+'>'+E(s.name)+(s.inn?'':' — без ИНН')+'</option>';});
  if(!k)h.unshift('<option value="" selected>поставщик не назван</option>');
  h.push('<option value="__new">другая компания…</option>');
  return h.join('');}

/* ── источники предложений ────────────────────────────────────────── */

function mkOffer(o){var b={id:rid(),name:'',unit:'шт',priceVat:0,priceNoVat:0,transport:0,
  storagePct:0,note:'',src:'hand',file:'',doc:'',company:blankSup()};
  return Object.assign(b,o||{});}
function stamp(iso){var d=iso?new Date(iso):new Date();
  if(isNaN(d.getTime()))d=new Date();
  return {year:d.getFullYear(),month:d.getMonth()+1};}
function fromDir(name){var d=supDir()[nrm(name)]||glob()[nrm(name)];
  return d?Object.assign(blankSup(),d):Object.assign(blankSup(),{name:name||''});}

/* Предложения магазинов из каталога. Повторно один и тот же магазин по
   одной позиции не заводится: цену он обновляет, а не дублирует. */
function fromCatalog(){
  var added=0;
  items().forEach(function(r){
    var os=offers(r),src=r.offers||[];
    if(!src.length)return;
    src.forEach(function(o){
      var same=os.filter(function(x){return nrm(x.company.name)===nrm(o.shop);})[0];
      var t=stamp(o.updated);
      if(same){same.priceVat=+o.price||0;same.priceNoVat=0;same.year=t.year;same.month=t.month;
        same.file=o.url||same.file;same.stale=!!o.stale;return;}
      os.push(mkOffer({name:r.name||'',unit:r.unit||'шт',priceVat:+o.price||0,
        src:'catalog',file:o.url||'',doc:'прайс',stale:!!o.stale,year:t.year,month:t.month,
        company:fromDir(o.shop||'')}));
      added++;});
    r.ka=os;});
  saveCur();
  return {added:added};}

/* Разбор КП поставщика: позиции ложатся в строки сметы по артикулу, а где
   его нет — по названию. Что не легло, названо поимённо: молча потерянная
   позиция и есть та ошибка, из-за которой анализ потом не сходится. */
function keyOf(code,name){var c=String(code||'').trim();
  return c?'a:'+nrm(c):'n:'+nrm(name);}
function place(res){
  var idx={};
  items().forEach(function(r){
    idx[keyOf(r.code,r.name)]=r;
    if(r.code)idx['n:'+nrm(r.name)]=idx['n:'+nrm(r.name)]||r;});
  var t=stamp(res.date),put=0,miss=[];
  var sup=Object.assign(blankSup(),res.supplier||{});
  sup.status=+sup.status===1?1:2;
  if(sup.name)applySupplier('',Object.assign({},fromDir(sup.name),sup));
  (res.positions||[]).forEach(function(p){
    var r=idx[keyOf(p.article,p.name)]||idx['n:'+nrm(p.name)];
    if(!r){miss.push(p.name);return;}
    var withVat=res.vat_included!==false;
    r.ka=offers(r).concat([mkOffer({name:p.name||'',unit:p.unit||'шт',
      priceVat:withVat?+p.price||0:0,priceNoVat:withVat?0:+p.price||0,
      src:'file',file:res.file||'',doc:'КП',year:t.year,month:t.month,
      company:sup.name?fromDir(sup.name):sup})]);
    put++;});
  saveCur();
  return {put:put,miss:miss};}

/* ── выгрузки ─────────────────────────────────────────────────────────
   Три листа и три формата. Лист «нет цен» — готовая форма для рассылки:
   добрать недостающие цены и есть самое частое действие первых недель. */

function level(o){return o.quarter?('кв. '+o.quarter+' '+o.year)
  :((MONTHS[(+o.month||1)-1]||'')+' '+(o.year||''));}
/* Графа 9 формы: месяц и год документа числами, квартал — для цен ФГИС. */
function levelNum(o){return o.quarter?(o.quarter+' кв. '+o.year)
  :(('0'+(+o.month||1)).slice(-2)+'.'+(o.year||''));}

/* Оформление листа. Рамка чёрная, а не серо-синяя, как в выгрузке сметы:
   лист подшивают к смете и отдают в экспертизу. */
var LINE={style:'thin',color:{rgb:'000000'}};
var BOX={top:LINE,bottom:LINE,left:LINE,right:LINE};
var UNDER={bottom:LINE};
var MONEY='#,##0.00';
function st(h,o){o=o||{};
  var s={font:{name:'Arial',sz:o.sz||9,bold:!!o.b},
    alignment:{horizontal:h||'left',vertical:o.v||'center',wrapText:o.wrap!==false}};
  if(o.box)s.border=BOX;else if(o.under)s.border=UNDER;
  if(o.fmt)s.numFmt=o.fmt;
  return s;}

/* Лист собирается по ячейкам: у aoa_to_sheet нет ни рамок, ни объединений.
   Высоту строки Excel по переносу сам не подбирает — она прикидывается
   по самому длинному тексту строки. */
function sheet(widths){
  var ws={'!merges':[],'!rows':[],'!cols':widths.map(function(w){return {wch:w};}),
    '!margins':{left:0.31,right:0.31,top:0.79,bottom:0.31,header:0.2,footer:0.2}};
  var last=0,lines=[];
  function put(r,c,v,s,w){
    var cell={v:v==null?'':v,t:typeof v==='number'?'n':'s',s:s};
    ws[XLSX.utils.encode_cell({r:r,c:c})]=cell;last=Math.max(last,r);
    if(s.alignment.wrapText&&cell.t==='s'&&v){
      var per=Math.max(1,Math.floor((w||widths[c])*1.15*9/s.font.sz));
      lines[r]=Math.max(lines[r]||1,Math.ceil(String(v).length/per));}}
  function mrg(r1,c1,r2,c2){ws['!merges'].push({s:{r:r1,c:c1},e:{r:r2,c:c2}});}
  /* Рамка у каждой ячейки объединения, иначе Excel рисует её только у первой. */
  function span(r,c1,c2,v,s){var w=0;for(var k=c1;k<=c2;k++)w+=widths[k];
    for(var c=c1;c<=c2;c++)put(r,c,c===c1?v:'',s,w);
    if(c2>c1)mrg(r,c1,r,c2);}
  function high(r,pt){ws['!rows'][r]={hpt:pt};}
  function done(){
    lines.forEach(function(n,r){if(n>1&&!ws['!rows'][r])high(r,n*11.5+3);});
    ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:last,c:widths.length-1}});
    return ws;}
  return {put:put,mrg:mrg,span:span,high:high,done:done};}

/* Блок подписей формы: должность, подпись, расшифровка — каждое на своей
   линии с подписью под ней. Незаполненное в шапке остаётся пустой линией
   под ручную подпись. */
function signs(S,r,who,at){
  who.forEach(function(w){
    S.put(r,at.label,w.label,st('right',{wrap:false}));
    S.span(r,at.pos[0],at.pos[1],w.p.position||'',st('center',{under:true}));
    S.span(r,at.sig[0],at.sig[1],'',st('center',{under:true}));
    S.span(r,at.name[0],at.name[1],w.p.name||'',st('center',{under:true}));
    var cap=st('center',{sz:8,v:'top'});
    S.span(r+1,at.pos[0],at.pos[1],'(наименование должности)',cap);
    S.span(r+1,at.sig[0],at.sig[1],'(подпись)',cap);
    S.span(r+1,at.name[0],at.name[1],'(фамилия, имя, отчество (при наличии))',cap);
    r+=3;});
  return r;}
function signers(){var h=head();
  return [{label:'Составил:',p:h.composer||{}},{label:'Проверил:',p:h.verifier||{}}];}

/* Графы 1–27 сводной таблицы — Приложение № 1 к приказу Минстроя № 421/пр
   в редакции № 30/пр. Ширины взяты из формы; ИНН и КПП шире, чтобы номер
   не рвался на строки. */
var KA_W=[4.9,26.9,14.4,26.9,5.7,9.4,13.9,13.9,21.1,13.9,8.9,13.9,9.7,11.6,9.7,11.6,
  35.7,9.7,11.6,13.9,26.9,11.1,11,13,26.9,13.9,6.7];
var KA_H=['Номер по порядку','Код строительного ресурса',
  'Наименование ресурса, затрат в соответствии с проектной документацией',
  'Полное наименование ресурса, затрат в обосновывающем документе',
  'Единица измерения ресурса, затрат в соответствии с проектной документацией',
  'Единица измерения ресурса, затрат в обосновывающем документе',
  'Текущая отпускная цена за единицу измерения в обосновывающем документе с учетом НДС, рублей',
  'Текущая отпускная цена за единицу измерения в обосновывающем документе без учета НДС, рублей / '
    +'Сметная цена строительного ресурса в базисном или текущем уровне цен',
  'Месяц и год составления обосновывающего документа / Квартал (для сметных цен строительных '
    +'ресурсов в текущем уровне цен и индексов по ГОСР, размещенных в ФГИС ЦС)',
  'Индекс фактической инфляции / Индекс по ГОСР',
  'Коэффициент пересчета в единицу измерения в соответствии с графой 5',
  'Текущая отпускная цена за единицу измерения без НДС, рублей в соответствии с графой 5 '
    +'в уровне цен составления сметной документации',
  'Затраты на перевозку',null,'Заготовительно-складские расходы',null,
  'Дополнительные затраты, предусмотренные пунктами 88, 117, 119–121 Методики',null,null,
  'Сметная цена без учета НДС, рублей за единицу измерения в соответствии с графой 5',
  'Полное и (или) сокращенное (при наличии) наименования производителя (поставщика)',
  'Страна производителя оборудования, производственного и хозяйственного инвентаря',
  'КПП организации','ИНН организации','Гиперссылка на веб-сайт производителя (поставщика)',
  'Населенный пункт расположения склада производителя (поставщика)',
  'Статус организации - производитель (1) / поставщик (2)'];
var KA_SUB={12:'%',13:'рублей за единицу измерения в соответствии с графой 5 без учета НДС',
  14:'%',15:'рублей',16:'Наименование затрат',17:'%',18:'рублей'};
/* Выравнивание граф как в форме: коды, единицы, реквизиты — по центру,
   деньги — вправо, названия и адреса — влево. */
var KA_AL='clllccrrcrrrcrcrlcrrccccllc'.split('').map(function(a){
  return {c:'center',r:'right',l:'left'}[a];});

function sheetAnalysis(){
  var S=sheet(KA_W),L=26,y=new Date().getFullYear();
  S.put(0,L,'Приложение № 1',st('right',{wrap:false,v:'top'}));
  S.put(1,L,'Утверждено приказом № 421 от 4 августа 2020 г. Минстроя РФ в редакции '
    +'приказа № 30/пр от 23 января 2025 г.',st('right',{wrap:false}));
  S.span(3,0,2,'СОГЛАСОВАНО:',st('center',{b:true,v:'top'}));
  S.span(3,23,L,'УТВЕРЖДАЮ:',st('center',{b:true,v:'top'}));
  [4,5].forEach(function(r){S.mrg(r,0,r,3);S.mrg(r,22,r,L);});
  S.put(6,0,'',st('left',{under:true}));S.span(6,1,2,'',st('right',{under:true}));
  S.span(6,22,L,'',st('right',{under:true}));
  var date='"____" ________________ '+y+' года';
  S.put(7,0,date,st('left',{wrap:false}));S.put(7,L,date,st('right',{wrap:false}));
  S.span(9,0,L,'Сводная таблица результатов конъюнктурного анализа',st('center',{b:true,sz:14}));
  S.high(9,26);
  S.span(11,0,L,objName(),st('center',{sz:10,under:true}));
  S.span(12,0,L,'(наименование объекта капитального строительства)',st('center',{sz:8,v:'top'}));
  ['Уровень цен составления сметной документации','Наименование субъекта Российской Федерации',
   'Ценовая зона субъекта Российской Федерации'].forEach(function(t,i){
    S.put(13+i,20,t,st('right',{wrap:false}));});

  var hs=st('center',{box:true});
  KA_H.forEach(function(t,c){
    if(t!=null)S.put(17,c,t,hs);else S.put(17,c,'',hs);
    S.put(18,c,KA_SUB[c]||'',hs);S.put(19,c,c+1,hs);
    if(!KA_SUB[c])S.mrg(17,c,18,c);});
  S.mrg(17,12,17,13);S.mrg(17,14,17,15);S.mrg(17,16,17,18);
  S.high(17,99);S.high(18,86);

  var r=20,n=0,sec=0,pend=null;
  (rows||[]).forEach(function(x){
    if(!x||x.type==='calc')return;
    if(x.type==='section'){pend=SECKINDS[x.kind]?SECKINDS[x.kind]+(x.title?' — '+x.title:'')
      :(x.title||'');return;}
    if(skip(x))return;
    var os=sorted(x),pk=picked(x);if(!os.length)return;
    if(pend!=null){sec++;
      S.span(r++,0,L,'Раздел '+sec+'. '+pend,st('left',{b:true,box:true}));pend=null;}
    n++;
    os.forEach(function(o,i){
      var c=o.company||{},b=!!(pk&&pk.id===o.id);
      var cell=function(k,v,fmt){S.put(r,k,v,st(KA_AL[k],{box:true,b:b,fmt:fmt}));};
      var money=function(k,v){cell(k,v==null?'':Math.round(v*100)/100,v==null?null:MONEY);};
      cell(0,n+'.'+(i+1));cell(1,x.ksr||'');cell(2,x.name||'');cell(3,o.name||x.name||'');
      cell(4,x.unit||'шт');cell(5,o.unit||x.unit||'шт');
      money(6,+o.priceVat||noVat(o)*(1+vat()/100));money(7,noVat(o));
      cell(8,levelNum(o));cell(9,'');cell(10,'');money(11,noVat(o));
      cell(12,'');money(13,+o.transport?+o.transport:null);
      cell(14,+o.storagePct?(+o.storagePct)+'%':'');money(15,+o.storagePct?storage(o):null);
      cell(16,'');cell(17,'');cell(18,'');money(19,estimate(o));
      cell(20,c.name||'');cell(21,'');cell(22,String(c.kpp||''));cell(23,String(c.inn||''));
      cell(24,c.site||'');cell(25,c.place||'');cell(26,+c.status===1?1:2);
      r++;});});

  r=signs(S,r+1,signers().concat([{label:'Застройщик (технический заказчик):',p:{}}]),
    {label:3,pos:[4,13],sig:[16,16],name:[19,24]});
  return S.done();}

/* Лист-запрос: то, чего не хватает, плюс пустые колонки под ответ. */
function sheetAsk(){
  var S=sheet([5,18,48,8,9,9,14,14,14,24]);
  S.span(0,0,9,'Запрос цен — '+objName(),st('left',{b:true,sz:12,wrap:false}));
  S.span(1,0,9,'Заполните две колонки цены и верните файл. Цены нужны на указанное количество.',
    st('left',{wrap:false}));
  var al=['center','left','left','center','center','center','right','right','center','left'];
  ['№','Код','Наименование','Ед. изм.','Кол-во','Цен собрано','Цена с НДС, ₽',
   'Цена без НДС, ₽','Срок поставки','Примечание'].forEach(function(t,c){
    S.put(3,c,t,st('center',{box:true,b:true}));});
  var r=4,n=0;
  items().forEach(function(x){n++;
    if(offers(x).length>=NEED)return;
    [n,x.code||'',x.name||'',x.unit||'шт',+x.qty||0,offers(x).length,'','','','']
      .forEach(function(v,c){S.put(r,c,v,st(al[c],{box:true,fmt:(c===6||c===7)?MONEY:null}));});
    r++;});
  signs(S,r+1,signers(),{label:1,pos:[2,2],sig:[3,5],name:[6,9]});
  return S.done();}

/* Лист «итог для КП»: принятая цена с коэффициентом и сумма по смете. */
function sheetTotal(){
  var S=sheet([5,48,8,9,16,14,16,16,30]);
  S.span(0,0,8,'Итог конъюнктурного анализа — '+objName(),st('left',{b:true,sz:12,wrap:false}));
  var al=['center','left','center','center','right','right','right','right','center'];
  ['№','Наименование','Ед. изм.','Кол-во','Принятая сметная цена, ₽','Коэффициент, %',
   'Цена в смете, ₽','Сумма, ₽','Принят поставщик'].forEach(function(t,c){
    S.put(2,c,t,st('center',{box:true,b:true}));});
  var r=3,n=0,sum=0,rnd=function(v){return Math.round(v*100)/100;};
  items().forEach(function(x){n++;
    var pk=picked(x),base=pk?estimate(pk):null,fin=accPrice(x),q=+x.qty||0;
    if(fin!=null)sum+=fin*q;
    [n,x.name||'',x.unit||'шт',q,base==null?'':rnd(base),pct(x)||'',
     fin==null?'':rnd(fin),fin==null?'':rnd(fin*q),pk?((pk.company&&pk.company.name)||''):'']
      .forEach(function(v,c){S.put(r,c,v,st(al[c],{box:true,
        fmt:(typeof v==='number'&&c>=4&&c!==5)?MONEY:null}));});
    r++;});
  S.span(r,0,6,'ВСЕГО',st('right',{box:true,b:true}));
  S.put(r,7,rnd(sum),st('right',{box:true,b:true,fmt:MONEY}));S.put(r,8,'',st('left',{box:true}));
  signs(S,r+2,signers(),{label:1,pos:[2,4],sig:[5,5],name:[6,8]});
  return S.done();}

function toXLSX(opt){
  opt=opt||{analysis:true,ask:true,total:true};
  var spec=(specs||[]).find(function(x){return x.id===curId;});
  var wb=XLSX.utils.book_new(),any=false;
  var add=function(name,ws){XLSX.utils.book_append_sheet(wb,ws,name);any=true;};
  if(opt.analysis){add('Конъюнктурный анализ',sheetAnalysis());
    wb.Workbook={Names:[{Name:'_xlnm.Print_Titles',Sheet:0,
      Ref:"'Конъюнктурный анализ'!$18:$20"}]};}
  if(opt.ask)add('Нет цен — запрос',sheetAsk());
  if(opt.total)add('Итог для КП',sheetTotal());
  if(!any)return false;
  XLSX.writeFile(wb,kpFname('Конъюнктурный анализ',spec,'Конъюнктурный анализ.xlsx'));
  return true;}

/* ── XML (.gge) ───────────────────────────────────────────────────────
   Коэффициент по позиции сюда не входит намеренно: файл утверждает цены
   поставщиков, и надбавка в нём была бы искажением. Она живёт в смете
   и в листе «итог для КП». */

function tag(n,v){return '<'+n+'>'+E(String(v))+'</'+n+'>';}

function xmlErrors(){
  var e=[];
  if(!objName())e.push('не заполнено наименование объекта');
  var pos=items().filter(function(r){return offers(r).length;});
  if(!pos.length)e.push('ни у одной позиции нет предложений');
  var badReq={},badLink={};
  pos.forEach(function(r){offers(r).forEach(function(o){
    var c=o.company||{};
    if(!c.name||!/^\d{9}$/.test(String(c.kpp||'')))badReq[c.name||'без названия']=1;
    if(c.inn&&!/^(\d{10}|\d{12})$/.test(String(c.inn)))badReq[c.name||'без названия']=1;
    if(!o.file)badLink[(r.name||'позиция').slice(0,40)]=1;});});
  var r1=Object.keys(badReq),r2=Object.keys(badLink);
  if(r1.length)e.push('нет ИНН или КПП: '+r1.slice(0,5).join(', ')+(r1.length>5?' и ещё '+(r1.length-5):''));
  if(r2.length)e.push('нет обоснования: '+r2.slice(0,5).join(', ')+(r2.length>5?' и ещё '+(r2.length-5):''));
  return e;}

function toXML(){
  var h=head(),x=[];
  x.push('<?xml version="1.0" encoding="UTF-8"?>');
  x.push('<Construction xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
    +' xsi:noNamespaceSchemaLocation="MarketAnalysis-1_01.xsd">');
  x.push('<Meta><Soft>'+tag('Name',SOFT_NAME)+tag('Version',SOFT_VER)+'</Soft>'
    +'<File>'+tag('Type','КА')+tag('Version',SCHEMA_VER)+'</File></Meta>');
  x.push(tag('AccessLevel',ACCESS.indexOf(h.access)>=0?h.access:ACCESS[0]));
  x.push(tag('ObjectName',objName()));
  var sg='';
  if(h.composer&&h.composer.name)sg+='<Composer>'+tag('Name',h.composer.name)
    +tag('Position',h.composer.position||'')+'</Composer>';
  if(h.verifier&&h.verifier.name)sg+='<Verifier>'+tag('Name',h.verifier.name)
    +tag('Position',h.verifier.position||'')+'</Verifier>';
  x.push('<Signatures>'+sg+'</Signatures>');
  x.push('<Resources>');
  var n=0;
  items().forEach(function(r){
    var os=sorted(r);if(!os.length)return;
    n++;
    x.push('<Resource>'+tag('Num',n)+(r.ksr?tag('Code',r.ksr):'')
      +tag('Name',r.name||'')+tag('Unit',r.unit||'шт'));
    os.forEach(function(o){
      var c=o.company||{},st=(+c.status===1)?1:2;
      x.push('<Offer>'+tag('Name',o.name||r.name||'')+tag('Unit',o.unit||r.unit||'шт')
        +'<Price>'+tag('OfferWithVAT',dec(o.priceVat||noVat(o)*(1+vat()/100)))
        +tag('OfferWithoutVAT',dec(noVat(o)))
        +(+o.transport?tag('Transportation',dec(o.transport)):'')
        +(+o.storagePct?('<Storage>'+tag('Price',dec(storage(o)))
          +tag('Percent',Math.round(+o.storagePct))+'</Storage>'):'')
        +tag('EstimateWithoutVAT',dec(estimate(o)))+'</Price>'
        +'<PriceLevel>'+tag('Year',+o.year||new Date().getFullYear())
        +(o.quarter?tag('Quarter',+o.quarter):tag('Month',+o.month||1))
        +(o.note?tag('Note',o.note):'')+'</PriceLevel>'
        +'<Company>'+tag('Name',c.name||'')+tag('KPP',String(c.kpp||''))
        +tag('INN',String(c.inn||''))+(c.site?tag('Site',c.site):'')
        +(c.place?tag('StorePlace',c.place):'')+tag('Status',st)+'</Company>'
        +tag('LinkFile',o.file||'')+'</Offer>');});
    x.push('</Resource>');});
  x.push('</Resources></Construction>');
  return x.join('\n');}

function fname(ext){var s=(specs||[]).find(function(x){return x.id===curId;})||{};
  var t=String(s.title||'').replace(/[\\/:*?"<>|]/g,'-').trim();
  return ['Конъюнктурный анализ',s.number||'',t].filter(Boolean).join(' ')+ext;}

function download(text,name){
  var b=new Blob([text],{type:'application/xml;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},0);}

/* Печатная форма на подпись. Своей библиотеки PDF в приложении нет и
   заводить её ради одной таблицы незачем: печать браузера даёт и бумагу,
   и «Сохранить как PDF». */
function toPrint(){
  var h=head(),c=h.composer||{},v=h.verifier||{},n=0,tr=[];
  items().forEach(function(r){
    var os=sorted(r),pk=picked(r);if(!os.length)return;
    n++;
    os.forEach(function(o,i){
      var cm=o.company||{};
      tr.push('<tr>'+(i?'':'<td rowspan="'+os.length+'">'+n+'</td>'
          +'<td rowspan="'+os.length+'">'+E(r.name||'')+'</td>'
          +'<td rowspan="'+os.length+'">'+E(r.unit||'шт')+'</td>')
        +'<td>'+E(cm.name||'')+(cm.inn?'<br><span class="s">ИНН '+E(cm.inn)+'</span>':'')+'</td>'
        +'<td class="n">'+m2(o.priceVat||noVat(o)*(1+vat()/100))+'</td>'
        +'<td class="n">'+m2(noVat(o))+'</td>'
        +'<td class="n">'+((+o.transport)?m2(o.transport):'—')+'</td>'
        +'<td class="n">'+((+o.storagePct)?m2(storage(o)):'—')+'</td>'
        +'<td class="n'+((pk&&pk.id===o.id)?' acc':'')+'">'+m2(estimate(o))+'</td>'
        +'<td>'+E(level(o))+'</td></tr>');});});
  var w=window.open('','_blank');
  if(!w){toast('Браузер не дал открыть окно печати');return false;}
  w.document.write('<!doctype html><meta charset="utf-8"><title>'+E(fname(''))+'</title>'
    +'<style>body{font:12px/1.4 Arial,sans-serif;margin:18px;color:#191C20}'
    +'h1{font-size:15px;margin:0 0 4px}.sub{color:#555;margin:0 0 14px}'
    +'table{border-collapse:collapse;width:100%}'
    +'th,td{border:1px solid #9AA3B5;padding:4px 6px;vertical-align:top}'
    +'th{background:#E8ECF5;font-size:11px}.n{text-align:right;white-space:nowrap}'
    +'.acc{font-weight:700}.s{color:#555;font-size:10px}'
    +'.sign{margin-top:26px;display:flex;gap:48px}.sign div{flex:1}'
    +'@page{size:A4 landscape;margin:12mm}</style>'
    +'<h1>Конъюнктурный анализ</h1>'
    +'<p class="sub">Объект: '+E(objName())+' · уровень доступа: '+E(h.access||ACCESS[0])+'</p>'
    +'<table><thead><tr><th>№</th><th>Наименование ресурса</th><th>Ед.</th>'
    +'<th>Поставщик</th><th>Цена с НДС, ₽</th><th>Цена без НДС, ₽</th>'
    +'<th>Перевозка, ₽</th><th>ЗСР, ₽</th><th>Сметная цена, ₽</th><th>Уровень цен</th>'
    +'</tr></thead><tbody>'+tr.join('')+'</tbody></table>'
    +'<div class="sign"><div>Составил: '+E(c.name||'________________')+'<br>'
    +'<span class="s">'+E(c.position||'')+'</span></div>'
    +'<div>Проверил: '+E(v.name||'________________')+'<br>'
    +'<span class="s">'+E(v.position||'')+'</span></div></div>');
  w.document.close();
  w.focus();w.print();
  return true;}

/* ── показ ───────────────────────────────────────────────────────────
   Один цвет на блок предложений: зелёная засечка у принятого. Пилюлями
   помечаются исключения — «из КП» и устаревшая цена; «из каталога» не
   помечается вовсе, это случай по умолчанию. */

function gap(v,txt){return v?E(v):'<span class="gap">'+E(txt)+'</span>';}
function warnIcon(){return '<svg class="i"><use href="#i-warn"/></svg>';}

/* Счётчик предложений есть у каждой позиции — красным он превращает смету
   в рябь. Красным остаётся только «предложений нет». */
function lineHTML(r){if(skip(r))return '';var n=offers(r).length;
  return '<div class="rowmeta">'
    +(r.code?'<span class="n art" title="Артикул поставщика">'+E(r.code)+'</span>'
      :'<span class="art">без артикула</span>')
    +'<span class="sep">·</span>'
    +'<span class="offerline'+(n?'':' none')+'" data-act="toggleoffers"'
    +' title="Предложения поставщиков">'+(n?'предложений '+n:'предложений нет')+' ▾</span>'
    +'</div>';}

/* Пять колонок после «Кол-во». Пропуск показан янтарным числом на своём
   месте (.gap), а не заливкой строки: на свежей смете его несут почти все
   позиции, и заливка перекрасила бы смету целиком. */
function cellsHTML(r){
  if(skip(r))return '<div class="cell"><label>Предложений</label><span class="sub">работа</span></div>'
    +'<div class="cell"></div><div class="cell"></div><div class="cell"></div><div class="cell"></div>';
  var os=sorted(r),pk=picked(r),n=os.length;
  var min=n?estimate(os[0]):null,acc=accPrice(r),p=pct(r);
  var cnt=n>=NEED?String(n):'<span class="gap">'+(n?n+' из '+NEED:'нет')+'</span>';
  var sup=pk?E((pk.company&&pk.company.name)||'без названия'):'<span class="gap">—</span>';
  var own=ownOffer(r);
  return '<div class="cell"><label>Предложений</label><b class="n" data-c="kaN">'+cnt+'</b></div>'
    +'<div class="cell"><label>Мин. сметная ₽</label><b class="n" data-c="kaMin">'
      +(min==null?'—':m2(min))+'</b></div>'
    +'<div class="cell"><label>Принято ₽</label>'
      +((own||!n)&&canEdit()
        ? '<input class="f n'+(own?'':' todo')+'" data-kaf="own" inputmode="decimal"'
          +' title="Своя цена — сметная без НДС" placeholder="—" value="'
          +(own?E(dec(noVat(own))):'')+'">'
        : '<b class="n">'+(acc==null?'—':m2(acc))+'</b>')
      +(p?'<span class="flag">'+(p>0?'+':'')+E(String(p))+' %</span>':'')+'</div>'
    +'<div class="cell"><label>Сумма по смете ₽</label><b class="n" data-c="kaSum">'
      +(acc==null?'—':m2(acc*(+r.qty||0)))+'</b></div>'
    +'<div class="cell"><label>Принят поставщик</label><span class="shop">'+sup+'</span></div>';}

/* Своя цена — предложение без поставщика: позиция сразу считается и уходит
   в Excel, а в XML не проходит, и пропуск виден там же, где все прочие. */
function ownOffer(r){var os=offers(r);
  return (os.length===1&&os[0].own)?os[0]:null;}
function setOwn(r,v){
  var o=ownOffer(r);
  if(!v){if(o)r.ka=[];return !!o;}
  if(o){o.priceNoVat=v;o.name=r.name||'';o.unit=r.unit||'шт';return false;}
  var t=stamp();
  r.ka=[mkOffer({name:r.name||'',unit:r.unit||'шт',priceNoVat:v,own:true,
    doc:'своя цена',year:t.year,month:t.month})];
  return true;}

/* Несравнимое — подписью в ячейке поставщика. Реквизитов в строке нет:
   их пропуск — один знак у имени, а вводят их в окне компаний. */
function supHTML(o){
  var c=o.company||{},mt=[];
  if(c.status)mt.push(STATUS[+c.status===1?1:2]);
  if(c.place)mt.push(c.place);
  var pills=(o.src==='file'?'<span class="pill src">из КП</span>':'')
    +(o.stale?'<span class="pill old">устарела</span>':'');
  var req=noReq(o)?('<button class="reqw" data-act="ka-sup" data-sup="'+E(nrm(c.name))
    +'" title="Нет ИНН или КПП — заполнить" aria-label="Нет ИНН или КПП">'+warnIcon()+'</button>'):'';
  return '<div class="sup"><b class="shop">'+gap(c.name,'поставщик не назван')+'</b>'+req+pills
    +'<div class="sup2">'+gap(o.name,'наименование не заполнено')+' · '+E(o.unit||'шт')+'</div>'
    +(mt.length?'<div class="smt"><span>'+mt.map(E).join('</span><span>· </span><span>')+'</span></div>':'')
    +'</div>';}

/* Обоснование — короткая ссылка, имя файла в подсказке: длинный адрес
   в ячейке уровня цен забирал внимание у самих цен. */
function docHTML(o){
  if(!o.file)return '<span class="gap">нет обоснования</span>';
  var lbl=o.doc||(o.src==='file'?'КП':'прайс');
  if(!/^(https?:)?\/\//i.test(o.file))return '<span title="'+E(o.file)+'">'+E(lbl)+'</span>';
  return '<a class="lk" href="'+E(o.file)+'" target="_blank" rel="noopener" title="'+E(o.file)+'">'
    +'<span>'+E(lbl)+'</span></a>';}

function offHTML(r,o,pk,last){
  var acc=pk&&pk.id===o.id;
  return '<div class="off ka'+(acc?' acc':'')+(last?' last':'')+'" data-oid="'+E(o.id)+'">'
    +'<input type="radio" name="ka-'+E(r.id)+'" data-act="ka-pick" data-ko="'+E(r.id)+'"'
      +' data-oid="'+E(o.id)+'"'+(acc?' checked':'')+(canEdit()?'':' disabled')
      +' title="Принять эту цену в смету" aria-label="Принять эту цену в смету">'
    +supHTML(o)
    +'<span class="v" data-l="с НДС ₽">'+m2(o.priceVat||noVat(o)*(1+vat()/100))+'</span>'
    +'<span class="v" data-l="без НДС ₽">'+m2(noVat(o))+'</span>'
    +'<span class="v" data-l="Перевозка ₽">'+((+o.transport)?m2(o.transport):'—')+'</span>'
    +'<span class="v" data-l="ЗСР ₽" title="'+E((+o.storagePct||0)+' %')+'">'
      +((+o.storagePct)?m2(storage(o)):'—')+'</span>'
    +'<span class="v est2" data-l="Сметная ₽">'+m2(estimate(o))+'</span>'
    +'<span class="v doc" data-l="Уровень цен">'+E(level(o))
      +'<div class="sub">'+docHTML(o)+'</div></span>'
    +(canEdit()?'<div class="mn" data-act="rowmenu" title="Что сделать с предложением">⋯<div class="menu">'
      +'<div data-act="ka-edit" data-ko="'+E(r.id)+'" data-oid="'+E(o.id)+'">Правка предложения</div>'
      +'<div data-act="ka-sup" data-sup="'+E(nrm((o.company||{}).name||''))+'">Реквизиты поставщика</div>'
      +'<div data-act="ka-del" data-ko="'+E(r.id)+'" data-oid="'+E(o.id)+'">Убрать предложение</div>'
      +'</div></div>':'<span></span>')
    +'</div>';}

var KAH=['','Поставщик','с НДС ₽','без НДС ₽','перевозка ₽','ЗСР ₽','сметная ₽','уровень цен',''];

function offersBlock(r){
  if(skip(r))return '';
  var os=offers(r),sp=shown(r),pk=picked(r);
  var h='<div class="offers ka'+(r.kaOpen?' on':'')+'">';
  if(os.length){
    h+='<div class="kah">'+KAH.map(function(t){return '<span>'+E(t)+'</span>';}).join('')+'</div>';
    h+=sp.head.map(function(o,i){
      return offHTML(r,o,pk,!sp.tail.length&&i===sp.head.length-1);}).join('');
    if(sp.tail.length)h+='<div class="katail" data-act="ka-tail" data-ko="'+E(r.id)+'">ещё '
      +sp.tail.length+' дороже принятого — показать</div>';
  }
  h+='<div class="kafoot"><span class="hint">'
    +(os.length>=NEED?'предложений '+os.length+' — Методика требует не менее трёх'
      :'предложений '+os.length+' из '+NEED+' — Методика требует не менее трёх')+'</span>'
    +(canEdit()?'<button class="btn sm ghost" data-act="ka-add" data-ko="'+E(r.id)
      +'" title="Добавить предложение руками">＋ предложение</button>':'')
    +'</div></div>';
  return h;}

/* ── шапка документа, полоса вкладки, счётчик реквизитов ──────────── */

function headCardHTML(){
  var h=head(),c=h.composer||{};
  if(objName()&&c.name)return '<div class="cd kahead"><div class="kaline"><span class="sub">'
    +E([objName(),h.access||ACCESS[0],'составил '+c.name].join(' · '))+'</span>'
    +(canEdit()?'<button class="btn sm ghost" data-act="ka-head">Изменить</button>':'')+'</div></div>';
  return '<div class="cd kahead"><div class="calchead">Шапка конъюнктурного анализа</div>'
    +'<div class="kaline"><span class="sub">Наименование объекта и подпись составившего нужны '
    +'выгрузке в экспертизу — без них файл не собирается.</span>'
    +(canEdit()?'<button class="btn sm" data-act="ka-head">Заполнить</button>':'')+'</div></div>';}

function actsHTML(){
  var b=function(a,t,l,cls){return '<button class="btn sm'+(cls?' '+cls:'')+'" data-act="'+a
    +'" title="'+E(t)+'"><span class="lbl">'+E(l)+'</span></button>';};
  var open=items().some(function(r){return !r.kaOpen;});
  return '<div class="acts">'
    +b('ka-toggleall',open?'Раскрыть предложения у всех позиций':'Свернуть все предложения',
       open?'Развернуть всё':'Свернуть всё','ghost')
    // Не «Из каталога»: этой подписью в той же полосе названа панель подбора
    // позиций (#402), а здесь берут цены к уже набранным позициям.
    +(canEdit()?b('ka-catalog','Взять цены поставщиков из каталога','Цены из каталога'):'')
    +(canEdit()?b('ka-prices','Вписать цены одного поставщика сразу по всем позициям',
       'Цены поставщика'):'')
    +(canEdit()?b('ka-file','Загрузить КП поставщика','Загрузить КП'):'')
    +b('ka-export','Выгрузить анализ','Выгрузить','primary')
    +'</div>';}

/* Сколько компаний без реквизитов — меткой в шапке сметы: пропуск
   массовый, и считать его глазами по всей смете нельзя. Метка же и есть
   второй вход в окно компаний. */
function metaHTML(){
  var g=reqGaps();
  if(!g.total)return '';
  return ' · <span class="badge'+(g.bad?'':' ok')+'" data-act="ka-sup" style="cursor:pointer"'
    +' title="Открыть список поставщиков">реквизиты поставщиков: '
    +(g.total-g.bad)+' из '+g.total+'</span>';}

function renderHead(){
  var box=document.getElementById('kaheadbox');if(!box)return;
  if(!kaMode()){box.innerHTML='';return;}
  box.innerHTML=headCardHTML();
  var m=document.getElementById('emeta');
  if(m&&m.innerHTML.indexOf('реквизиты поставщиков')<0)m.innerHTML+=metaHTML();}

/* Полоса выбора на этой вкладке — процент по отмеченным. Удаления и
   объединения здесь нет: состав сметы правят на вкладке КП. */
function selbarHTML(n){
  return '<b>'+n+'</b><span>выбрано:</span>'
    +'<select class="fin" id="kaPctKind" style="height:30px;width:auto">'
    +'<option value="1">надбавка</option><option value="-1">скидка</option></select>'
    +'<input class="fmini" id="kaPctVal" value="10" title="Процент" aria-label="Процент">'
    +'<span class="sub">%</span>'
    +'<button class="btn sm" data-act="ka-pct">Применить</button>'
    +'<button class="btn sm ghost" data-act="ka-pct0" title="Убрать надбавку у отмеченных">Убрать</button>'
    +'<button class="btn sm" data-act="selall">Выбрать все</button>'
    +'<button class="btn sm" data-act="clearsel">Снять</button>';}

/* Подытог раздела — по тем же колонкам, что стоят в строках: сумма принятых
   цен и число позиций, которым не хватает предложений. Пусто здесь не ноль:
   раздел, где не принято ни одной цены, говорит это словами. */
function secSumHTML(from){
  var sum=0,n=0,few=0,priced=0;
  for(var i=from+1;i<rows.length;i++){
    var r=rows[i];
    if(r.type==='calc')continue;
    if(r.type==='section')break;
    if(skip(r))continue;
    n++;
    if(needsMore(r))few++;
    var a=accPrice(r);
    if(a!=null){priced++;sum+=a*(+r.qty||0);}}
  if(!n)return '<span class="sub">в разделе нет материалов</span>';
  if(!priced)return '<span class="sub">цены не приняты ни по одной позиции из '+n+'</span>';
  return 'По принятым: <b>'+m2(sum)+'</b> ₽ '
    +'<span class="sub">позиций '+priced+' из '+n+'</span>'
    +(few?' <span class="secpart">без трёх цен: '+few+'</span>':'');}

/* Итог вкладки — сумма принятых цен с коэффициентом, а не цен КП: на этой
   вкладке колонки другие, и чужой итог под ними читался бы как свой. */
function footHTML(){
  var all=items(),sum=0,ok=0;
  all.forEach(function(r){var a=accPrice(r);
    if(offers(r).length>=NEED)ok++;
    if(a!=null)sum+=a*(+r.qty||0);});
  var note='по принятым ценам · позиций с тремя предложениями: '+ok+' из '+all.length;
  return {row:'<span></span><span></span><span></span><div><b>ИТОГО</b>'
    +'<div class="sub">'+E(note)+'</div></div><span></span><span></span><span></span>'
    +'<span></span><span></span><b class="n">'+m2(sum)+'</b><span></span><span></span>',
    mob:'<span>Сметная стоимость по принятым ценам</span><b>'+m2(sum)+'</b>'};}

/* ── правка ──────────────────────────────────────────────────────────
   Одиннадцать величин в строку не вписать, поэтому предложение правится
   своим окном, а реквизиты — общим окном компаний: у одной компании
   предложения по большинству позиций. */

function find(rid_,oid){
  var r=(rows||[]).filter(function(x){return String(x.id)===String(rid_);})[0];
  if(!r)return null;
  var o=offers(r).filter(function(x){return String(x.id)===String(oid);})[0];
  return o?{r:r,o:o}:null;}

function fcell(lab,id,val,wide,ph){
  return '<div class="fcell'+(wide?' wide':'')+'"><div class="flab">'+E(lab)+'</div>'
    +'<input class="fin'+(wide?'':' n')+'" id="'+id+'" value="'+E(val==null?'':val)+'"'
    +(ph?' placeholder="'+E(ph)+'"':'')+'></div>';}

/* Поставщик правится там же, где цена. Окно компаний связывает реквизиты
   по названию, поэтому предложению нужно своё поле: у заведённого руками
   названия нет, и связаться с компанией ему нечем. */
function supFields(c){
  return '<div class="fcell wide"><div class="flab">Поставщик <i>обязательно</i></div>'
    +'<select class="fin'+(c.name?'':' need')+'" id="koSup">'+supOpts(c.name)+'</select></div>'
    +'<div class="fcell wide"><div class="flab">Реквизиты компании</div>'
    +'<div class="supgrid">'
    +'<input class="fin" id="koSupName" value="'+E(c.name||'')+'" placeholder="Наименование компании">'
    +'<input class="fin n'+(c.inn?'':' need')+'" id="koSupInn" value="'+E(c.inn||'')+'" placeholder="ИНН">'
    +'<input class="fin n'+(c.kpp?'':' need')+'" id="koSupKpp" value="'+E(c.kpp||'')+'" placeholder="КПП">'
    +'<select class="fin" id="koSupSt"><option value="2"'+(+c.status===1?'':' selected')
    +'>поставщик</option><option value="1"'+(+c.status===1?' selected':'')+'>производитель</option></select>'
    +'<span></span></div>'
    +'<div class="hint">Реквизиты — свойство компании: правка закроет пропуск '
    +'во всех её предложениях и подставится в следующей смете</div></div>';}

/* Выбор из списка подставляет реквизиты, «другая компания» очищает поля. */
function bindSup(m){
  var sel=m.el.querySelector('#koSup');if(!sel)return;
  var f=function(id){return m.el.querySelector('#'+id);};
  sel.addEventListener('change',function(){
    var c=sel.value==='__new'?blankSup():fromDir((choices().filter(function(s){
      return s.key===sel.value;})[0]||{}).name||'');
    f('koSupName').value=c.name||'';f('koSupInn').value=c.inn||'';
    f('koSupKpp').value=c.kpp||'';f('koSupSt').value=+c.status===1?'1':'2';
    ['koSupName','koSupInn','koSupKpp'].forEach(function(id){
      f(id).classList.toggle('need',!f(id).value);});
    if(sel.value==='__new')f('koSupName').focus();});}

/* Реквизиты компании из полей окна. Прежние сайт и склад не теряются:
   полей для них нет, а разбор КП их приносит. */
function supFrom(m){
  var v=function(id){var el=m.el.querySelector('#'+id);return el?el.value.trim():'';};
  var sel=m.el.querySelector('#koSup'),key=sel&&sel.value!=='__new'?sel.value:'';
  var prev=supDir()[key||nrm(v('koSupName'))]||glob()[key||nrm(v('koSupName'))]||{};
  return {key:key,
    nc:{name:v('koSupName'),inn:v('koSupInn'),kpp:v('koSupKpp'),
        status:+v('koSupSt')===1?1:2,site:prev.site||'',place:prev.place||''}};}

function editOffer(rid_,oid){
  var g=find(rid_,oid);if(!g)return;var o=g.o;
  var mo=MONTHS.map(function(n,i){return '<option value="'+(i+1)+'"'
    +((+o.month||1)===i+1?' selected':'')+'>'+E(n)+'</option>';}).join('');
  var m=UI.modal({title:'Предложение поставщика',sub:(o.company&&o.company.name)||'',
    ok:'Сохранить',okIcon:'i-save',
    body:'<div class="fgrid">'
      +supFields(o.company||blankSup())
      +'<div class="fcell wide"><div class="flab">Наименование у поставщика <i>обязательно</i></div>'
      +'<input class="fin" id="koName" value="'+E(o.name||'')+'"></div>'
      +fcell('Единица измерения','koUnit',o.unit||'шт')
      +fcell('Цена с НДС, ₽','koVat',o.priceVat||'')
      +fcell('Цена без НДС, ₽','koNo',o.priceNoVat||'','',String(Math.round(noVat(o)*100)/100))
      +fcell('Перевозка без НДС, ₽','koTr',o.transport||'')
      +fcell('Заготовительно-складские, %','koZsr',o.storagePct||'')
      +fcell('Год уровня цен','koYear',o.year||new Date().getFullYear())
      +'<div class="fcell"><div class="flab">Месяц уровня цен</div>'
      +'<select class="fin" id="koMonth">'+mo+'</select></div>'
      +'<div class="fcell wide"><div class="flab">Обоснование <i>обязательно</i></div>'
      +'<input class="fin" id="koFile" value="'+E(o.file||'')+'" '
      +'placeholder="ссылка на товар, имя файла КП или снимка прайса"></div>'
      +'<div class="fcell wide"><div class="flab">Примечание к уровню цен</div>'
      +'<input class="fin" id="koNote" value="'+E(o.note||'')+'"></div>'
      +'</div><div class="fnote" style="margin-top:12px">Цена без НДС считается из цены с НДС '
      +'по ставке '+vat()+' %, пока её не вписали: поставщик округляет по-своему.</div>',
    onOk:function(){
      var q=function(id){return m.el.querySelector('#'+id).value;};
      o.name=q('koName').trim();o.unit=q('koUnit').trim()||'шт';
      o.priceVat=num(q('koVat'));o.priceNoVat=num(q('koNo'));
      o.transport=num(q('koTr'));o.storagePct=num(q('koZsr'));
      o.year=parseInt(q('koYear'),10)||new Date().getFullYear();
      o.month=parseInt(q('koMonth'),10)||1;
      o.file=q('koFile').trim();o.note=q('koNote').trim();
      var s=supFrom(m);
      // Реквизиты правятся у всей компании, а компания у этого предложения:
      // сначала первое, иначе смена поставщика унесла бы с собой чужие цены.
      if(s.nc.name)applySupplier(s.key,s.nc);
      o.company=s.nc.name?fromDir(s.nc.name):blankSup();
      delete o.own;
      saveCur();redraw();return true;}});
  bindSup(m);}

/* Окно компаний. Список собирается сам из всех предложений — из каталога
   и из присланных КП, — не ограничен по числу и пополняется вручную,
   если КП пришло мимо приложения. */
function supRow(s){
  return '<div class="supgrid" data-key="'+E(s.key||'')+'">'
    +'<input class="fin" data-sf="name" value="'+E(s.name||'')+'" placeholder="Наименование компании">'
    +'<input class="fin n'+(s.inn?'':' need')+'" data-sf="inn" value="'+E(s.inn||'')+'" placeholder="ИНН">'
    +'<input class="fin n'+(s.kpp?'':' need')+'" data-sf="kpp" value="'+E(s.kpp||'')+'" placeholder="КПП">'
    +'<select class="fin" data-sf="status"><option value="2"'+(+s.status===1?'':' selected')
    +'>поставщик</option><option value="1"'+(+s.status===1?' selected':'')+'>производитель</option></select>'
    +'<span class="sub" title="предложений в анализе">'+(s.n||0)+'</span></div>';}

function supModal(focusKey){
  var list=suppliers();
  var g=reqGaps();
  var m=UI.modal({title:'Поставщики в этом анализе',
    sub:'ИНН и КПП вводят один раз на компанию — пропуск закроется во всех её предложениях',
    ok:'Сохранить',okIcon:'i-save',
    body:'<div class="supgrid" style="font-size:var(--f11);color:var(--mut);font-weight:600">'
      +'<span>Компания</span><span>ИНН</span><span>КПП</span><span>Статус</span><span>Предл.</span></div>'
      +'<div id="kaSupList">'+(list.length?list.map(supRow).join('')
        :'<div class="sub" style="padding:10px 0">Предложений пока нет — компании появятся, '
        +'когда возьмёте цены из каталога или загрузите КП.</div>')+'</div>'
      +'<div style="margin-top:10px"><button class="btn sm ghost" id="kaSupAdd" type="button">'
      +'＋ компания</button></div>'
      +'<div class="fnote'+(g.bad?' warn':' ok')+'" style="margin-top:12px">'
      +(g.bad?'Без ИНН и КПП XML для экспертизы не собирается: не заполнено у '+g.bad+' из '+g.total
        :'Реквизиты заполнены у всех компаний')+'</div>',
    onOk:function(){
      var boxes=m.el.querySelectorAll('#kaSupList .supgrid');
      Array.prototype.forEach.call(boxes,function(b){
        var v=function(f){var el=b.querySelector('[data-sf="'+f+'"]');return el?el.value.trim():'';};
        if(!v('name'))return;
        applySupplier(b.dataset.key||'',{name:v('name'),inn:v('inn'),kpp:v('kpp'),
          status:+v('status')===1?1:2,
          site:(supDir()[b.dataset.key]||{}).site||'',
          place:(supDir()[b.dataset.key]||{}).place||''});});
      saveCur();redraw();return true;}});
  var add=m.el.querySelector('#kaSupAdd');
  if(add)add.addEventListener('click',function(){
    var box=m.el.querySelector('#kaSupList');
    box.insertAdjacentHTML('beforeend',supRow({key:'',name:'',n:0}));
    var last=box.lastElementChild.querySelector('input');if(last)last.focus();});
  if(focusKey){var row=m.el.querySelector('.supgrid[data-key="'+focusKey+'"]');
    var inn=row&&row.querySelector('[data-sf="inn"]');if(inn)inn.focus();}}

/* Окно цен одного поставщика. Смета на сотню позиций через окно
   предложения — сотня окон; здесь весь прайс вводится одним проходом,
   а обоснование и уровень цен у КП общие на весь проход. */
function priceRow(r,o){
  return '<div class="pgrid" data-ko="'+E(r.id)+'">'
    +'<span>'+E(r.name||'')+'<div class="sub">'+E(r.unit||'шт')
    +' · '+E(String(+r.qty||0))+'</div></span>'
    +'<input class="fin n" inputmode="decimal" data-kp="1" value="'
    +((o&&+o.priceVat)?E(String(+o.priceVat)):'')+'" placeholder="цена с НДС">'
    +'</div>';}

function pricesModal(){
  if(!canEdit()){toast('Только просмотр — цены не правятся');return;}
  var list=items().filter(function(r){return !skip(r);});
  if(!list.length){toast('В смете нет материалов и оборудования');return;}
  var t=stamp();
  var mo=MONTHS.map(function(n,i){return '<option value="'+(i+1)+'"'
    +(t.month===i+1?' selected':'')+'>'+E(n)+'</option>';}).join('');
  var m=UI.modal({title:'Цены одного поставщика',
    sub:'позиций в смете: '+list.length,ok:'Внести цены',okIcon:'i-save',
    body:'<div class="fgrid">'+supFields(blankSup())
      +'<div class="fcell wide"><div class="flab">Обоснование <i>обязательно</i></div>'
      +'<input class="fin" id="koFile" placeholder="ссылка на прайс, имя файла КП или счёта"></div>'
      +'<div class="fcell"><div class="flab">Год уровня цен</div>'
      +'<input class="fin n" id="koYear" value="'+t.year+'"></div>'
      +'<div class="fcell"><div class="flab">Месяц уровня цен</div>'
      +'<select class="fin" id="koMonth">'+mo+'</select></div></div>'
      +'<div class="pgrid" style="font-size:var(--f11);color:var(--mut);font-weight:600;'
      +'margin-top:14px"><span>Позиция</span><span>Цена с НДС, ₽</span></div>'
      +'<div id="kaPriceList">'+list.map(function(r){
        return priceRow(r,null);}).join('')+'</div>'
      +'<div class="hint" style="margin-top:10px">Пустая строка остаётся как есть — '
      +'цену этого поставщика она не теряет</div>',
    onOk:function(){
      var s=supFrom(m);
      if(!s.nc.name){toast('Не назван поставщик');return false;}
      applySupplier(s.key,s.nc);
      var c=fromDir(s.nc.name),f=m.el.querySelector('#koFile').value.trim();
      var y=parseInt(m.el.querySelector('#koYear').value,10)||t.year;
      var mn=parseInt(m.el.querySelector('#koMonth').value,10)||t.month;
      var n=0;
      Array.prototype.forEach.call(m.el.querySelectorAll('#kaPriceList .pgrid'),function(b){
        var r=rowOf(b.dataset.ko),p=num(b.querySelector('[data-kp]').value);
        if(!r||p<=0)return;
        var o=offers(r).filter(function(x){
          return nrm((x.company||{}).name)===nrm(c.name);})[0];
        if(o){o.priceVat=p;o.priceNoVat=0;o.year=y;o.month=mn;
          if(f)o.file=f;delete o.stale;}
        else r.ka=offers(r).concat([mkOffer({name:r.name||'',unit:r.unit||'шт',
          priceVat:p,src:'hand',doc:'КП',file:f,year:y,month:mn,
          company:Object.assign({},c)})]);
        n++;});
      if(!n){toast('Ни одной цены не вписано');return false;}
      saveCur();redraw();toast('цен внесено: '+n);return true;}});
  bindSup(m);
  // Цены этого поставщика подставляются, как только он назван: чаще всего
  // прайс дополняют, а не вводят с нуля.
  var sel=m.el.querySelector('#koSup');
  var fill=function(){
    var nm=m.el.querySelector('#koSupName').value.trim();
    m.el.querySelector('#kaPriceList').innerHTML=list.map(function(r){
      return priceRow(r,nm?offers(r).filter(function(x){
        return nrm((x.company||{}).name)===nrm(nm);})[0]:null);}).join('');};
  sel.addEventListener('change',fill);
  m.el.querySelector('#koSupName').addEventListener('change',fill);}

function editHead(){
  var h=head(),c=h.composer||{},v=h.verifier||{};
  var sel=ACCESS.map(function(a){return '<option value="'+E(a)+'"'
    +((h.access||ACCESS[0])===a?' selected':'')+'>'+E(a)+'</option>';}).join('');
  var m=UI.modal({title:'Шапка конъюнктурного анализа',
    sub:'Идёт в XML для экспертизы',ok:'Сохранить',okIcon:'i-save',
    body:'<div class="fgrid">'
      +'<div class="fcell wide"><div class="flab">Наименование объекта <i>обязательно</i></div>'
      +'<input class="fin'+(objName()?'':' need')+'" id="khObj" value="'+E(objName())+'"></div>'
      +'<div class="fcell wide"><div class="flab">Уровень доступа</div>'
      +'<select class="fin" id="khAcc">'+sel+'</select></div>'
      +'<div class="fcell"><div class="flab">Составил, ФИО <i>обязательно</i></div>'
      +'<input class="fin'+(c.name?'':' need')+'" id="khCn" value="'+E(c.name||'')+'"></div>'
      +'<div class="fcell"><div class="flab">Должность</div>'
      +'<input class="fin" id="khCp" value="'+E(c.position||'')+'"></div>'
      +'<div class="fcell"><div class="flab">Проверил, ФИО</div>'
      +'<input class="fin" id="khVn" value="'+E(v.name||'')+'"></div>'
      +'<div class="fcell"><div class="flab">Должность</div>'
      +'<input class="fin" id="khVp" value="'+E(v.position||'')+'"></div>'
      +'</div>',
    onOk:function(){
      var q=function(id){return m.el.querySelector('#'+id).value.trim();};
      setHead('object',q('khObj'));setHead('access',q('khAcc'));
      setHead('composer.name',q('khCn'));setHead('composer.position',q('khCp'));
      setHead('verifier.name',q('khVn'));setHead('verifier.position',q('khVp'));
      redraw();return true;}});}

/* Окно выгрузки. Три листа и три формата в одном месте: выключенная
   кнопка не объясняет, почему она выключена, — а объяснить надо поимённо. */
function opt(id,lbl,note,on){
  return '<label class="optrow"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+'>'
    +'<span><b>'+E(lbl)+'</b><div class="hint">'+E(note)+'</div></span></label>';}

function exportModal(){
  var e=xmlErrors(),ask=items().filter(needsMore).length;
  var m=UI.modal({title:'Выгрузить конъюнктурный анализ',ok:null,cancel:'Закрыть',
    body:'<div>'
      +opt('kaShA','Анализ по форме Методики','все предложения по каждой позиции',true)
      +opt('kaShB','Нет цен — запрос поставщикам',
        ask?('позиций без трёх цен: '+ask+' — готовая форма для рассылки'):'таких позиций нет',ask>0)
      +opt('kaShC','Итог для КП','принятая цена, коэффициент и сумма по смете',true)
      +'</div>'
      +'<div class="bar" style="margin-top:14px">'
      +'<button class="btn primary" id="kaDlX" type="button" data-act="ka-dl-xlsx">'
      +'<span class="lbl">Скачать .xlsx</span></button>'
      +'<button class="btn" id="kaDlP" type="button" data-act="ka-dl-pdf">'
      +'<span class="lbl">PDF на подпись</span></button>'
      +'<button class="btn" id="kaDlG" type="button" data-act="ka-dl-gge">'
      +'<span class="lbl">XML .gge</span></button>'
      +'</div>'
      +(e.length?'<div class="errbox x" style="margin-top:12px"><p>XML .gge не собрался: '
        +'схема требует то, чего в анализе ещё нет. Excel и PDF уходят и без этого.</p></div>'
        +'<div class="cd" style="margin-top:8px;padding:2px 12px">'
        +e.map(function(t){return '<div class="off"><span>'+E(t)+'</span></div>';}).join('')+'</div>'
        :'<div class="fnote ok" style="margin-top:12px">XML .gge собирается: '
        +'обязательные величины схемы заполнены</div>')});
  var on=function(id){var el=m.el.querySelector('#'+id);return !!(el&&el.checked);};
  m.el.querySelector('#kaDlX').addEventListener('click',function(){
    if(!toXLSX({analysis:on('kaShA'),ask:on('kaShB'),total:on('kaShC')})){
      toast('Не отмечен ни один лист');return;}
    toast('Таблица выгружена');});
  m.el.querySelector('#kaDlP').addEventListener('click',function(){toPrint();});
  m.el.querySelector('#kaDlG').addEventListener('click',function(){
    if(xmlErrors().length){toast('XML не собрался — перечень в этом же окне',4000);return;}
    download(toXML(),fname('.gge'));toast('XML выгружен');});}

/* ── загрузка КП поставщика ─────────────────────────────────────────── */

async function loadFile(f){
  if(!canEdit()){toast('Только просмотр — загрузка недоступна');return;}
  busy(true,'Разбираю предложение…');
  try{
    var fd=new FormData();fd.append('file',f);
    var res=await api('/import/offer',{method:'POST',body:fd});
    res.file=f.name||res.file||'';
    var out=place(res);
    redraw();
    if(out.miss.length)UI.modal({title:'Разобрано, но легло не всё',ok:null,cancel:'Понятно',
      sub:'разнесено предложений: '+out.put+' · не опознано: '+out.miss.length,
      body:'<p class="note">Этих позиций в смете не нашлось — разбор сопоставляет '
        +'по артикулу и названию. Добавьте предложение руками там, где оно нужно.</p>'
        +'<div class="cd" style="margin-top:8px;padding:2px 12px">'
        +out.miss.slice(0,20).map(function(t){return '<div class="off"><span>'+E(t)+'</span></div>';}).join('')
        +'</div>'});
    else toast('разнесено предложений: '+out.put,4000);
  }catch(err){
    var msg=(err&&(err.detail||err.message))||'не удалось разобрать файл';
    if(window.impErr)impErr('Предложение «'+(f.name||'')+'» не разобралось: '+msg);
    else toast('Не разобралось: '+msg,5000);
  }finally{busy(false);}}

/* ── события ─────────────────────────────────────────────────────────
   Один слушатель на документ: действия вкладки лежат в четырёх местах —
   в шапке документа, в полосе вкладок, в полосе выбора и в строках. */
function redraw(){if(window.render)render();}

function rowOf(id){return (rows||[]).filter(function(x){return String(x.id)===String(id);})[0];}

/* Процент ложится на принятую цену отмеченных позиций. Цены поставщиков
   он не переписывает: документ утверждает, что цена рыночная, и ссылается
   на прайс — в строке остаётся и она, и коэффициент. */
function applyPct(val){
  if(!canEdit()){toast('Только просмотр — цены не правятся');return;}
  var n=0;
  items().forEach(function(r){if(!sel.has(r.id))return;
    if(val)r.kaPct=val; else delete r.kaPct;
    n++;});
  if(!n){toast('Ни одна позиция не отмечена');return;}
  saveCur();redraw();
  toast(val?('коэффициент '+(val>0?'+':'')+val+' % · позиций: '+n)
    :('надбавка убрана · позиций: '+n));}

document.addEventListener('click',function(e){
  var el=e.target.closest('[data-act]');
  if(el&&el.dataset.act==='toggleoffers'){
    var rw=el.closest('.rowwrap'),r=rw&&rowOf(rw.dataset.id);
    var box=rw&&rw.querySelector('.offers');
    if(!r||!box)return;
    r.kaOpen=box.classList.contains('on');
    // На узком экране предложения стоят внутри раскрытой строки: открыть
    // их, оставив строку свёрнутой, значит нажать в пустоту.
    if(r.kaOpen&&window.innerWidth<=1180&&UI.rowOpen)UI.rowOpen(r.id,true);
    return;}
  // Раскрывает вся строка позиции, а не только счётчик: попасть в короткую
  // подпись труднее, чем в строку, а других смыслов у нажатия по ней нет.
  if(!el&&kaMode()){
    var cell=e.target.closest('#list .row');
    if(cell&&!e.target.closest('input,select,textarea,button,a,.nmField,.mn,.drag,.offers')){
      var rw2=cell.closest('.rowwrap'),r2=rw2&&rowOf(rw2.dataset.id);
      var b2=rw2&&rw2.querySelector('.offers');
      if(r2&&b2&&!skip(r2)){r2.kaOpen=!b2.classList.contains('on');
        b2.classList.toggle('on',r2.kaOpen);
        if(r2.kaOpen&&window.innerWidth<=1180&&UI.rowOpen)UI.rowOpen(r2.id,true);}}
    return;}
  if(!el)return;
  var a=el.dataset.act,g,r;
  if(a.slice(0,3)!=='ka-')return;
  if(a==='ka-head'){editHead();return;}
  if(a==='ka-sup'){supModal(el.dataset.sup||'');return;}
  if(a==='ka-prices'){pricesModal();return;}
  if(a==='ka-export'){exportModal();return;}
  if(a==='ka-catalog'){var res=fromCatalog();
    toast(res.added?'добавлено предложений: '+res.added:'новых предложений в каталоге нет');
    redraw();return;}
  if(a==='ka-file'){var fi=document.getElementById('kafile');if(fi)fi.click();return;}
  if(a==='ka-toggleall'){var open=items().some(function(x){return !x.kaOpen;});
    items().forEach(function(x){x.kaOpen=open;
      // На узком экране предложения стоят внутри раскрытой строки: свёрнутая
      // строка не показала бы их, и кнопка сработала бы вхолостую.
      if(window.innerWidth<=1180&&UI.rowOpen)UI.rowOpen(x.id,open);});
    saveCur();redraw();return;}
  if(a==='ka-pct'||a==='ka-pct0'){
    if(a==='ka-pct0'){applyPct(0);return;}
    var kind=document.getElementById('kaPctKind'),v=document.getElementById('kaPctVal');
    var p=num(v&&v.value)*((kind&&+kind.value===-1)?-1:1);
    if(!p){toast('Процент не задан');return;}
    applyPct(Math.round(p*100)/100);return;}
  if(a==='ka-tail'){r=rowOf(el.dataset.ko);if(r){r.kaAll=true;redraw();}return;}
  if(a==='ka-add'){r=rowOf(el.dataset.ko);if(!r)return;
    var t=stamp(),o=mkOffer({name:r.name||'',unit:r.unit||'шт',year:t.year,month:t.month});
    r.ka=offers(r).concat([o]);r.kaOpen=true;saveCur();redraw();
    editOffer(r.id,o.id);return;}
  if(a==='ka-pick'){g=find(el.dataset.ko,el.dataset.oid);
    if(g){g.r.kaPick=g.o.id;saveCur();redraw();}return;}
  if(a==='ka-edit'){editOffer(el.dataset.ko,el.dataset.oid);return;}
  if(a==='ka-del'){g=find(el.dataset.ko,el.dataset.oid);
    if(!g)return;
    UI.confirm({title:'Убрать предложение?',ok:'Убрать',okIcon:'i-trash',
      text:((g.o.company&&g.o.company.name)||'Предложение')+' по позиции «'+(g.r.name||'')+'».'})
      .then(function(yes){if(!yes)return;
        g.r.ka=offers(g.r).filter(function(x){return x.id!==g.o.id;});saveCur();redraw();});
    return;}
});

/* Своя цена правится на месте: перерисовка списка увела бы каретку из поля.
   Полная — только когда предложение завелось или исчезло: тогда меняются
   счётчик в строке и блок предложений под ней. */
function updOwnCells(rw,r){
  var set=function(k,v){var el=rw.querySelector('[data-c="'+k+'"]');
    if(el)el.innerHTML=v;};
  var os=sorted(r),acc=accPrice(r),n=os.length;
  set('kaN',n>=NEED?String(n):'<span class="gap">'+(n?n+' из '+NEED:'нет')+'</span>');
  set('kaMin',n?m2(estimate(os[0])):'—');
  set('kaSum',acc==null?'—':m2(acc*(+r.qty||0)));}

document.addEventListener('input',function(e){
  var el=e.target;
  if(!el.dataset||el.dataset.kaf!=='own')return;
  if(!canEdit())return;
  var rw=el.closest('.rowwrap'),r=rw&&rowOf(rw.dataset.id);
  if(!r)return;
  if(setOwn(r,num(el.value)))el.dataset.kaNew='1';
  el.classList.toggle('todo',!String(el.value||'').trim());
  updOwnCells(rw,r);saveCur();});

document.addEventListener('focusout',function(e){
  var el=e.target;
  if(!el.dataset||el.dataset.kaf!=='own'||!el.dataset.kaNew)return;
  redraw();});

/* Вход для файла один на модуль: вешать его на каждую перерисовку значило
   бы разбирать один и тот же файл по разу на каждое открытие вкладки. */
var fi=document.getElementById('kafile');
if(fi)fi.addEventListener('change',function(e){
  var f=e.target.files[0];e.target.value='';if(f)loadFile(f);});

window.KA={cellsHTML:cellsHTML,offersBlock:offersBlock,lineHTML:lineHTML,footHTML:footHTML,
  secSumHTML:secSumHTML,
  selbarHTML:selbarHTML,renderHead:renderHead,actsHTML:actsHTML,loadFile:loadFile,
  fromCatalog:fromCatalog,place:place,toXLSX:toXLSX,toXML:toXML,toPrint:toPrint,
  xmlErrors:xmlErrors,download:download,fname:fname,items:items,offers:offers,sorted:sorted,
  picked:picked,estimate:estimate,accPrice:accPrice,noVat:noVat,storage:storage,
  needsMore:needsMore,noReq:noReq,suppliers:suppliers,applySupplier:applySupplier,
  reqGaps:reqGaps,head:head,setHead:setHead,objName:objName,mkOffer:mkOffer,level:level,
  vat:vat,ACCESS:ACCESS,STATUS:STATUS,m2:m2,num:num,nrm:nrm};
})();
