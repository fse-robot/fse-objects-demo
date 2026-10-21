/* ═══════════════════════════════════════════════════════════════════════════
   kp-21.js — раздел «CRM» (#617).

   Сделки из копии amoCRM: стадия, сумма, ответственный, папка на Диске.
   Нажатие раскрывает выпущенные по сделке документы — по дате или по
   названию. Список и фильтры собирает сервер (GET /deal-docs/crm);
   здесь только отрисовка. Из раскрытой сделки выпускается КП на
   проектирование по шаблону «КП-FSE-Проект» (#652) или на обслуживание
   по форме раздела «Обслуживание» (#664); сделка переносится
   в «Обслуживание» объектом (#662).
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
if(window.__crmV1)return; window.__crmV1=true;

var C={q:'',stage:'',resp:0,page:0,deals:null,total:0,size:50,stages:[],people:[],
  open:{},sort:'date',err:'',busy:false,seq:0};

var WON=142;  // «Успешно реализовано» — одно для всех воронок amoCRM

function rub(n){return n?new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽':''}

function ensureView(){
  var v=document.getElementById('crmView');
  if(!v){v=document.createElement('div');v.id='crmView';v.style.display='none';
    (document.querySelector('.main')||document.body).appendChild(v);}
  return v;
}

// Стадия в фильтре — пара «воронка:стадия»: номера стадий у воронок свои.
function stageOpts(){
  var by={},order=[];
  C.stages.forEach(function(s){
    if(!by[s.pipeline_id]){by[s.pipeline_id]=[];order.push(s);}
    by[s.pipeline_id].push(s);});
  return '<option value="">Все стадии</option>'+order.map(function(p){
    return '<optgroup label="'+esc(p.pipeline)+'">'+by[p.pipeline_id].map(function(s){
      var v=s.pipeline_id+':'+s.status_id;
      return '<option value="'+v+'"'+(v===C.stage?' selected':'')+'>'+esc(s.stage)+'</option>';}).join('')
      +'<option value="'+p.pipeline_id+':0"'+(p.pipeline_id+':0'===C.stage?' selected':'')+'>Вся воронка</option>'
      +'</optgroup>';}).join('');
}
function peopleOpts(){
  return '<option value="0">Все ответственные</option>'+C.people.map(function(p){
    return '<option value="'+p.id+'"'+(+p.id===C.resp?' selected':'')+'>'+esc(p.name)+'</option>';}).join('');
}

function stageChip(d){
  var cls=!d.closed?'info':(d.status_id===WON?'ok':'bad');
  return d.stage?'<span class="ch '+cls+'">'+esc(d.stage)+'</span>':'';
}
function icoLink(u,ic,t){
  u=safeUrl(u); if(!u)return '';
  return '<a class="disc" href="'+esc(u)+'" target="_blank" rel="noopener" title="'+t+'">'
    +'<svg class="i"><use href="#'+ic+'"/></svg></a>';
}

function dealBtns(d){
  var ok=typeof can==='function', h='';
  if(ok&&can('spec:write'))
    h+='<button class="btn sm" data-crm-kp="'+d.id+'"><svg class="i"><use href="#i-file"/></svg>'
      +'<span class="lbl">КП</span></button>'
      +'<button class="btn sm" data-crm-letter="'+d.id+'" title="Исходящее письмо заказчику">'
      +'<svg class="i"><use href="#i-edit"/></svg><span class="lbl">Исх.письмо</span></button>';
  if(ok&&can('to:manage'))
    h+=d.site_id
      ?'<button class="btn sm" data-crm-site="'+d.site_id+'" title="Открыть объект в «Обслуживании»">'
        +'<svg class="i"><use href="#i-cog"/></svg><span class="lbl">В обслуживании</span></button>'
      :'<button class="btn sm" data-crm-to="'+d.id+'" title="Завести объект в «Обслуживании»">'
        +'<svg class="i"><use href="#i-cog"/></svg><span class="lbl">В обслуживание</span></button>';
  return h?'<div class="crmsort">'+h+'</div>':'';
}
function docsHTML(d){
  if(!d.documents.length)return dealBtns(d)+'<div class="prjnote">Документов app по сделке не выпускал</div>';
  var list=d.documents.slice().sort(C.sort==='name'
    ?function(a,b){return String(a.name).localeCompare(String(b.name),'ru')}
    :function(a,b){return a.issued_on<b.issued_on?1:a.issued_on>b.issued_on?-1:0});
  function sb(k,ic,t){return '<button class="btn sm'+(C.sort===k?' on':'')+'" data-crm-sort="'+k+'">'
    +'<svg class="i"><use href="#'+ic+'"/></svg><span class="lbl">'+t+'</span></button>';}
  return dealBtns(d)+'<div class="crmsort">'+sb('date','i-cal','По дате')+sb('name','i-doc','По названию')+'</div>'
    +list.map(function(x){
      return '<div class="speccard" data-crm-doc><div class="pnm"><b>'+esc(x.name||'Документ')+'</b>'
        +'<div class="s">'+esc(['№'+x.number,ymd(x.issued_on),rub(Number(x.total))].filter(Boolean).join(' · '))
        +(x.margin!=null?' · <span class="n'+(typeof mgLevel==='function'?' mg '+mgLevel(x.margin_pct):'')+'">маржа '
          +(rub(Number(x.margin))||'0 ₽')+' · '+x.margin_pct+'%</span>':'')+'</div></div>'
        +'<div class="crmr">'+(x.spec_uid?'<button class="disc" data-crm-xlsx="'+esc(x.spec_uid)+'" title="КП в Excel — откроет смету">'
          +'<svg class="i"><use href="#i-sheet"/></svg></button>':'')
        +icoLink(x.url,'i-ext','Открыть документ')+'</div></div>';}).join('');
}

function dealHTML(d){
  var op=!!C.open[d.id];
  var sub=[d.responsible,d.company,d.docs?'документов: '+d.docs:''].filter(Boolean).join(' · ');
  return '<div class="prj'+(op?' op':'')+'"><div class="speccard" data-crm="'+d.id+'">'
    +'<button class="disc" title="'+(op?'Свернуть':'Раскрыть')+'" aria-expanded="'+op+'">'
    +'<svg class="i"><use href="#i-'+(op?'down':'right')+'"/></svg></button>'
    +'<div class="pnm"><b>'+esc(d.name||('Сделка '+d.id))+'</b>'
    +'<div class="s">'+stageChip(d)+' '+esc(sub)+'</div></div>'
    +'<div class="crmr"><div class="psum n">'+rub(d.price)+'</div><div class="crmr">'
    +icoLink(d.folder_url,'i-fold','Папка сделки на Диске')
    +icoLink(d.url,'i-ext','Сделка в amoCRM')+'</div></div></div>'
    +'<div class="prjkids">'+(op?docsHTML(d):'')+'</div></div>';
}

/* ═══════════════════ КП НА ПРОЕКТИРОВАНИЕ (#652) ═══════════════════
   Разделы — те же, что DESIGN_SECTIONS в deal_docs.py; у каждого отмеченного
   стадия и цена. Выезд и авторский надзор — строки без стадии. */
var DESIGN=[['augpt','АУГПТ'],['aps_soue','АПС+СОУЭ'],['apt','АПТ'],['vpv','ВПВ'],
  ['os','Охранная'],['eom','ЭОМ']];
var EXTRA=[['survey','Выезд и обследование'],['supervision','Авторский надзор']];
function priceIn(k,off){
  return '<input class="fin" type="number" min="0" step="1000" inputmode="decimal" data-kdp="'+k+'"'+(off?' disabled':'')+'>';
}
function designKp(d){
  if(typeof kpGoogle!=='function')return;
  kpGoogle({sub:d.name||('Сделка '+d.id),path:'/deal-docs/kp/design',
    deal:{id:d.id,name:d.name,url:d.url,stage:d.stage},
    body:'<div class="fcell wide"><div class="flab">Заказчик <i>обязательно</i></div>'
      +'<input class="fin" id="kdCust" maxlength="200" value="'+esc(d.company||'')+'"></div>'
      +'<div class="fcell wide"><div class="flab">Объект</div>'
      +'<input class="fin" id="kdObj" maxlength="300"></div>'
      +'<div class="fcell wide"><div class="flab">Разделы проекта: стадия и цена, ₽</div>'
      +DESIGN.map(function(x){
        return '<label class="optrow price"><input type="checkbox" data-kd="'+x[0]+'">'
          +'<span>'+esc(x[1])+'</span>'
          +'<select class="fin stage" data-kds="'+x[0]+'" disabled><option>П+Р</option><option>П</option><option>Р</option></select>'
          +priceIn(x[0],true)+'</label>';}).join('')
      +EXTRA.map(function(x){
        return '<label class="optrow price"><span>'+esc(x[1])+'</span>'+priceIn(x[0],false)+'</label>';}).join('')
      +'<div class="fnote">Пустая цена — строки нет в КП.</div></div>'
      +'<div class="fcell"><div class="flab">Первая версия проекта</div>'
      +'<input class="fin" id="kdTerm" maxlength="60" value="7–21 день"></div>'
      +'<div class="fcell"><div class="flab">&nbsp;</div>'
      +'<label class="optrow"><input type="checkbox" id="kdVat" checked><span>Счёт с НДС</span></label></div>',
    init:function(w){
      w.addEventListener('change',function(ev){
        var c=ev.target.closest('[data-kd]'); if(!c)return;
        var k=c.dataset.kd, pr=w.querySelector('[data-kdp="'+k+'"]');
        pr.disabled=!c.checked; w.querySelector('[data-kds="'+k+'"]').disabled=!c.checked;
        if(c.checked)pr.focus();});},
    collect:function(w){
      var sections=[], bad='', num=function(k){return Number(w.querySelector('[data-kdp="'+k+'"]').value)||0;};
      DESIGN.forEach(function(x){
        if(!w.querySelector('[data-kd="'+x[0]+'"]').checked)return;
        var v=num(x[0]);
        if(!(v>0)&&!bad)bad='Укажите цену для «'+x[1]+'»';
        sections.push({code:x[0],stage:w.querySelector('[data-kds="'+x[0]+'"]').value,price:v});});
      var c=w.querySelector('#kdCust').value.trim(), t=w.querySelector('#kdTerm').value.trim();
      if(!c)return 'Укажите заказчика';
      if(!sections.length)return 'Отметьте хотя бы один раздел проекта';
      if(!t)return 'Укажите срок первой версии проекта';
      return bad||{customer:c,object:w.querySelector('#kdObj').value.trim(),sections:sections,
        survey:num('survey'),supervision:num('supervision'),term:t,vat:w.querySelector('#kdVat').checked};},
    after:function(){load(false);}});
}

function kpPick(d){
  if(!(window.UI&&UI.modal))return;
  var m=UI.modal({narrow:true,title:'КП по сделке',sub:d.name||('Сделка '+d.id),ok:null,cancel:'Закрыть',
    body:'<div class="bar"><button class="btn" type="button" data-kpk="design"><svg class="i"><use href="#i-file"/></svg>'
      +'<span class="lbl">КП на проектирование</span></button>'
      +'<button class="btn" type="button" data-kpk="to"><svg class="i"><use href="#i-file"/></svg>'
      +'<span class="lbl">КП на обслуживание</span></button></div>'});
  m.el.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-kpk]'); if(!b)return;
    m.close();
    if(b.dataset.kpk==='design')return designKp(d);
    if(window.__kp08b&&__kp08b.kpTo)__kp08b.kpTo({sub:d.name||('Сделка '+d.id),customer:d.company||'',
      deal:{id:d.id,name:d.name,url:d.url,stage:d.stage},after:function(){load(false);}});});
}
/* ═══════════════════ ПЕРЕНОС В ОБСЛУЖИВАНИЕ (#662) ═══════════════════
   Объект и юрлицо заказчика, связанные со сделкой. Адреса у сделки amoCRM
   нет — его вписывают здесь; договор ТО заводится уже в карточке объекта. */
function toService(d){
  if(!(window.UI&&UI.modal))return;
  function F(id,lab,val,max){
    return '<div class="fcell wide"><div class="flab">'+lab+' <i>обязательно</i></div>'
      +'<input class="fin" id="'+id+'" maxlength="'+max+'" value="'+esc(val||'')+'"></div>';}
  UI.modal({narrow:true,title:'Перенести в обслуживание',sub:d.name||('Сделка '+d.id),
    body:'<div class="fgrid">'+F('ctName','Название объекта',d.name,300)
      +F('ctAddr','Адрес','',500)+F('ctCust','Заказчик',d.company,300)
      +'<div class="fcell wide"><div class="fnote">Объект и заказчик появятся в «Обслуживании» '
      +'и будут связаны со сделкой. Если юрлицо с таким названием уже есть, объект привяжется к нему. '
      +'Договор ТО заводится в карточке объекта.</div></div></div>',
    ok:'Перенести',okIcon:'i-cog',
    onOk:function(w){
      var v=function(id){return w.querySelector('#'+id).value.trim();};
      var body={deal_id:d.id,name:v('ctName'),address:v('ctAddr'),customer:v('ctCust')};
      if(body.name.length<2)return Promise.reject(new Error('Укажите название объекта'));
      if(body.address.length<3)return Promise.reject(new Error('Укажите адрес объекта'));
      if(body.customer.length<2)return Promise.reject(new Error('Укажите заказчика'));
      return ledger('/to/sites/from-deal',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)}).then(function(r){
          d.site_id=r.id;
          if(typeof toast==='function')toast(r.linked?'Адрес уже был в обслуживании — связан со сделкой'
            :r.created?'Объект заведён в «Обслуживании»':'Сделка уже в обслуживании');
          openSite(r.id);});}});
}
function openSite(id){
  if(window.__kp08b&&window.__kp08b.openSite)window.__kp08b.openSite(id);
}
// Карточка объекта «Обслуживания» открывает свою сделку здесь: точный
// номер сервер ищет и среди закрытых сделок.
window.crmOpenDeal=function(id){
  C.q=String(id); C.open={}; C.open[id]=true; C.stage=''; C.resp=0;
  window.go('crm');
};

function listHTML(){
  if(C.err)return '<div class="errbox">'+esc(C.err)+'</div>';
  if(C.deals===null)return window.UI?UI.loading(4):'<div class="pd sub">Загрузка…</div>';
  if(!C.deals.length)return window.UI&&UI.empty?UI.empty(C.q||C.stage||C.resp
    ?{icon:'i-srch',title:'Ничего не найдено',text:'Поиск идёт по сделке, компании и номеру КП.'}
    :{icon:'i-fold',title:'Сделок нет',text:'Открытых сделок в amoCRM нет.'}):'';
  return C.deals.map(dealHTML).join('')
    +(C.deals.length<C.total?'<button class="btn" data-crm-more'+(C.busy?' disabled':'')+'>'
      +'<svg class="i"><use href="#i-down"/></svg><span class="lbl">Ещё '+Math.min(C.size,C.total-C.deals.length)+' из '+(C.total-C.deals.length)+'</span></button>':'');
}

function render(){
  var v=ensureView();
  v.innerHTML='<div class="ph"><div><h1>CRM</h1><p>Сделки amoCRM и выпущенные по ним документы</p></div></div>'
    +'<div class="stickhead"><div class="specsearch"><span class="m" style="position:absolute;left:11px;top:10px;'
    +'color:var(--dim);pointer-events:none"><svg class="i"><use href="#i-srch"/></svg></span>'
    +'<input id="crmq" placeholder="Сделка, компания или номер КП" autocomplete="off" value="'+esc(C.q)+'"></div>'
    +'<div class="frow" style="margin-bottom:12px">'
    +'<select id="crmStage" style="flex:1 1 180px">'+stageOpts()+'</select>'
    +'<select id="crmResp" style="flex:1 1 180px">'+peopleOpts()+'</select></div></div>'
    +'<div id="crmList">'+listHTML()+'</div>';
}
function paint(){var l=document.getElementById('crmList'); if(l)l.innerHTML=listHTML();}

// Ответ на устаревший запрос отбрасывается: пока он шёл, фильтр поменяли.
async function load(more){
  var my=++C.seq, page=more?C.page+1:0, st=C.stage.split(':');
  if(!more){C.deals=null;C.err='';paint();}
  C.busy=true;
  try{
    var r=await ledger('/deal-docs/crm?'+new URLSearchParams({q:C.q,pipeline:+st[0]||0,
      status:+st[1]||0,responsible:C.resp,page:page}));
    if(my!==C.seq)return;
    C.page=page; C.total=r.total; C.size=r.page_size||C.size;
    C.deals=more?C.deals.concat(r.deals):r.deals;
    if(r.stages){C.stages=r.stages;C.people=r.people||[];
      var s=document.getElementById('crmStage'),p=document.getElementById('crmResp');
      if(s)s.innerHTML=stageOpts(); if(p)p.innerHTML=peopleOpts();}
  }catch(e){
    if(my!==C.seq)return;
    C.err=e.message||'Сделки не загрузились';
  }
  C.busy=false; paint();
}

// Письмо по сделке из списка: сделка уже выбрана, заказчик — её компания.
function letter(id){
  var d=(C.deals||[]).find(function(x){return String(x.id)===String(id)});
  if(!d||typeof kpLetter!=='function')return;
  kpLetter({sub:d.name||'',org:d.company||'',
    deal:{id:d.id,name:d.name,url:d.url,stage:d.stage},after:function(){load(false)}});
}

var timer=null;
document.addEventListener('input',function(e){
  if(e.target.id!=='crmq')return;
  C.q=e.target.value; clearTimeout(timer); timer=setTimeout(function(){load(false)},350);
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='crmStage'){C.stage=t.value;load(false);}
  else if(t.id==='crmResp'){C.resp=+t.value||0;load(false);}
});
document.addEventListener('click',function(e){
  var t=e.target; if(!t.closest||!t.closest('#crmView'))return;
  if(t.closest('a[target]'))return;
  var s=t.closest('[data-crm-sort]');
  if(s){e.preventDefault();C.sort=s.dataset.crmSort;paint();return;}
  if(t.closest('[data-crm-more]')){load(true);return;}
  var kb=t.closest('[data-crm-kp]');
  if(kb){var d=(C.deals||[]).find(function(x){return String(x.id)===kb.dataset.crmKp;});
    if(d)kpPick(d);return;}
  var ts=t.closest('[data-crm-to]');
  if(ts){var dd=(C.deals||[]).find(function(x){return String(x.id)===ts.dataset.crmTo;});
    if(dd)toService(dd);return;}
  var so=t.closest('[data-crm-site]');
  if(so){openSite(so.dataset.crmSite);return;}
  var lt=t.closest('[data-crm-letter]');
  if(lt){letter(lt.dataset.crmLetter);return;}
  var xl=t.closest('[data-crm-xlsx]');
  if(xl){kpXlsxOf(xl.dataset.crmXlsx);return;}
  var doc=t.closest('[data-crm-doc]');
  if(doc){var a=doc.querySelector('a[target]'); if(a)a.click(); return;}
  var row=t.closest('[data-crm]'); if(!row)return;
  var id=row.dataset.crm; C.open[id]=!C.open[id]; paint();
});

// ── Подключение раздела ──────────────────────────────────────────────────
try{ if(typeof SECT_SCOPE!=='undefined'&&SECT_SCOPE)SECT_SCOPE.crm='spec:read'; }catch(e){}
var _goCrm=window.go;
window.go=function(v){
  if(v!=='crm'){
    var cv=document.getElementById('crmView'); if(cv)cv.style.display='none';
    return _goCrm(v);
  }
  if(typeof drawer==='function'){try{drawer(false)}catch(e){}}
  if(window.fseTrack)fseTrack('view:crm');
  ensureView();
  if(typeof hideViewsExcept==='function')hideViewsExcept('crmView');
  document.getElementById('crmView').style.display='';
  document.querySelectorAll('.nav[data-go]').forEach(function(n){
    n.classList.toggle('act',n.dataset.go==='crm');});
  var on=document.getElementById('objname'); if(on)on.textContent='';
  render(); load(false);
};
try{ if(typeof applyRoleNav==='function')applyRoleNav(); }catch(e){}
})();
