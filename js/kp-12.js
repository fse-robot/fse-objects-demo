/* ── Блок 12. Снабжение: очередь заявок, склад, движение ТМЦ ───────────
   Два наружных объекта под две роли.

   SUPPLY — вкладки «Заявки» и «Склад» внутри раздела «Закупки» (kp-02).
   Снабженец ведёт позицию по шести состояниям и видит остаток. Цель роли —
   держать запас минимальным, поэтому на складе показывается не только что
   лежит, но и с какого числа лежит без движения.

   SUPMAT — вкладка «Материалы» внутри раздела «Смена» (kp-03). Исполнитель
   заказывает материал с объекта и там же видит, где заявка. Согласующего
   между ними нет: заявка уходит снабжению напрямую.

   Статус меняет только снабжение, но виден он исполнителю сразу — это
   замыкание цепочки, ради которого обе роли попали в объём вместе. */
(function(){
if(window.__supplyV1)return; window.__supplyV1=true;

var API='/montazh/api';
var NB=' ';

function sess(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}}
function E(s){return (typeof esc==='function')?esc(s):String(s==null?'':s)
  .replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ic(n){return '<svg class="i"><use href="#'+n+'"/></svg>';}
function T(m,ms){if(typeof toast==='function')toast(m,ms);}
function rub(n){return n==null?'—':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,
  maximumFractionDigits:2}).format(n).replace(/\s/g,NB)+NB+'₽';}
function qs(n){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3})
  .format(+n||0).replace(/\s/g,NB);}
function num(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return isNaN(n)?0:n;}

async function api(path,opts){
  opts=opts||{};
  opts.headers=Object.assign({'X-FSE-Session':sess()},opts.headers||{});
  var what=(opts.method&&opts.method!=='GET')?'действие не сохранилось':'раздел не загрузился';
  var r;
  try{r=await fetch(API+path,opts);}catch(e){throw new Error(window.fseFailText(0,what));}
  if(r.status===401&&typeof authExpired==='function'){authExpired();}
  var t=await r.text();
  var d=null; try{d=t?JSON.parse(t):null}catch(e){}
  if(!r.ok)throw new Error((d&&d.detail)||window.fseFailText(r.status,what));
  return d;
}
function post(path,body){return api(path,{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});}

/* Цепочка одна на оба экрана: у исполнителя и у снабжения расходиться
   ей нельзя, иначе они читают разные состояния одной позиции. Порядок
   и коды — те же, что в backend/api/mnt_supply.py (FLOW, FLOW_RU). */
var FLOW=['new','ordered','transit','stock','issued','returned'];
var FLOW_RU={new:'Заявка',ordered:'Заказано',transit:'В пути',stock:'На складе',
             issued:'Выдано',returned:'Вернули'};
/* Переход спрашивает количество: доехать может меньше заказанного,
   а вернуться с объекта — сколько осталось, вплоть до нуля. */
var ASK_QTY={stock:'Сколько приняли',issued:'Сколько выдали',returned:'Сколько вернули'};
var KIND_RU={receipt:'Приход от поставщика',toll:'Давальческое от партнёра',
             issue:'Выдача на объект',tool:'Инструмент на руки',
             back:'Возврат',writeoff:'Списание'};
var PLACE_RU={supplier:'Поставщик',partner:'Партнёр',stock:'Склад',
              object:'Объект',person:'На руках',used:'Израсходовано'};

function chain(st){
  var at=FLOW.indexOf(st);
  return '<div class="chn">'+FLOW.map(function(k,i){
    var cls=i<at?' class="done"':(i===at?' class="on"':'');
    return '<span'+cls+'>'+E(FLOW_RU[k])+'</span>';}).join('')+'</div>';
}
/* В списке у позиции одна метка «где сейчас»: шесть подписей у каждой из
   двадцати строк на телефоне встают в три ряда. Весь путь раскрывается
   нажатием на метку и остаётся раскрытым при перерисовке списка. */
var STAGE_CLS={new:'warn',ordered:'info',transit:'info',stock:'info',
               issued:'ok',returned:'ok'};
var chnOpen={};
function stage(id,st){
  var op=!!chnOpen[id];
  return '<div><button type="button" class="ch '+STAGE_CLS[st]+'" data-act="chn" '
    +'data-id="'+id+'" aria-expanded="'+op+'" title="Весь путь позиции">'
    +E(FLOW_RU[st])+ic('i-down')+'</button></div>'
    +'<div data-chn="'+id+'"'+(op?'':' hidden')+'>'+chain(st)+'</div>';
}
/* Свой обработчик, а не перерисовка: список длинный, и перерисовка
   сбрасывала бы прокрутку. */
document.addEventListener('click',function(ev){
  var el=ev.target.closest('[data-act="chn"]'); if(!el)return;
  var id=el.dataset.id,box=el.parentNode.nextElementSibling;
  if(chnOpen[id])delete chnOpen[id]; else chnOpen[id]=true;
  el.setAttribute('aria-expanded',String(!!chnOpen[id]));
  if(box)box.hidden=!chnOpen[id];
});

/* ══ СНАБЖЕНИЕ ═══════════════════════════════════════════════════════ */
var SUP={reqs:null,stock:null,moves:null,cost:null,staff:null,objs:null,
         openOnly:true,movesAll:false,err:'',
         /* Отмеченное. В очереди ключ — id позиции заявки, на складе — место
            плюс позиция: одна и та же гайка на складе и на объекте это два
            разных остатка, и путать их нельзя. */
         pick:{},spick:{}};
function pickCount(o){return Object.keys(o).length;}
/* Причину, по которой пакетом действовать нельзя, полоса пишет сразу, а
   главную кнопку гасит: сообщение после нажатия исчезает, и перечитать
   правило негде. */
function selbar(n,act,lbl,offAct,why){
  return '<div class="selbar on"><b>'+n+'</b><span>выбрано:</span>'
    +'<button class="btn sm primary" data-act="'+act+'"'+(why?' disabled':'')+'>'
    +ic('i-right')+'<span class="lbl">'+lbl+'</span></button>'
    +'<button class="btn sm" data-act="'+offAct+'">Снять</button>'
    +'<span class="fnote" data-why'+(why?'':' hidden')+'>'+E(why)+'</span></div>';
}
/* Дальше отмеченных только «Вернули» — его пакетом не отметить. */
function advNext(){
  var picked=Object.keys(SUP.pick).map(function(k){return SUP.pick[k];});
  if(!picked.length)return [];
  var far=Math.max.apply(null,picked.map(function(x){return FLOW.indexOf(x.status);}));
  return FLOW.slice(far+1).filter(function(k){return k!=='returned';});
}
function advWhy(){
  return advNext().length?'':'Дальше отмеченных только «Вернули», а его пакетом '
    +'не отметить: количество у каждой позиции своё';
}
function moveWhy(){
  var rows=Object.keys(SUP.spick).map(function(k){return SUP.spick[k];});
  if(!rows.length)return '';
  var place=rows[0].place,ref=rows[0].ref||'';
  return rows.some(function(r){return r.place!==place||(r.ref||'')!==ref;})
    ?'Отмечены остатки из разных мест — одним движением их не провести, снимите лишнее':'';
}

/* «Все» — переключатель: когда отмечено всё, та же кнопка снимает отметку,
   и пара действий не разнесена по экрану. */
function reqLines(){
  var out=[];
  (SUP.reqs||[]).forEach(function(r){r.lines.forEach(function(l){
    if(l.status!=='returned')out.push(l);});});
  return out;
}
function placeRows(p){return (SUP.stock||[]).filter(function(r){return r.place===p;});}
function allReq(){
  var ls=reqLines();
  return !!ls.length&&ls.every(function(l){return SUP.pick[l.id];});
}
function allStock(p){
  var rs=placeRows(p);
  return !!rs.length&&rs.every(function(r){return SUP.spick[skey(r)];});
}
function allTitle(on,what){return on?'Снять отметку':'Отметить '+what;}
function allBtn(act,on,attrs,what){
  return '<button class="btn sm'+(on?' on':'')+'" data-act="'+act+'"'+attrs
    +' data-what="'+E(what)+'" aria-pressed="'+on+'" title="'+allTitle(on,what)+'">'
    +ic('i-check')+'<span class="lbl">Все</span></button>';
}
function syncAll(){
  document.querySelectorAll('#zakupkiView [data-act="sup-pickall"],'
    +'#zakupkiView [data-act="sup-spickall"]').forEach(function(b){
    var on=b.dataset.act==='sup-pickall'?allReq():allStock(b.dataset.p);
    b.classList.toggle('on',on);
    b.setAttribute('aria-pressed',String(on));
    b.title=allTitle(on,b.dataset.what);
  });
}

function rrSup(){if(typeof window.renderZakupki==='function')window.renderZakupki();}

/* ── Заявки ── */
function reqView(){
  if(SUP.err)return '<div class="cd">'+(window.UI?UI.error({title:'Очередь не загрузилась',
    text:SUP.err,act:'sup-reload'}):'<div class="pd sub">'+E(SUP.err)+'</div>')+'</div>';
  if(SUP.reqs===null)return (window.UI?UI.loading(4):'<div class="pd sub">Загружаю…</div>');
  var h='<div class="cd" style="margin-bottom:14px"><div class="cdh"><h2>Очередь заявок</h2>'
    +'<button class="btn sm'+(SUP.openOnly?' on':'')+'" style="margin-left:auto" '
    +'data-act="sup-open" aria-pressed="'+SUP.openOnly+'" title="Показывать только '
    +'незакрытые заявки">Только незакрытые</button>'
    +allBtn('sup-pickall',allReq(),'','все позиции')+'</div>';
  if(!SUP.reqs.length)return h+(window.UI?UI.empty({icon:'i-cart',title:'Заявок нет',
    text:'Заявку подаёт исполнитель с объекта — в разделе «Смена», вкладка «Материалы».'})
    :'<div class="pd sub">Заявок нет</div>')+'</div>';
  h+='</div>';
  var np=pickCount(SUP.pick);
  if(np)h+=selbar(np,'sup-advmany','Продвинуть','sup-pickno',advWhy());
  /* Группировка по объектам: снабженец возит на объект, а не человеку,
     и очередь без этой группировки читается как лента несвязанных строк. */
  var byObj={},order=[];
  SUP.reqs.forEach(function(r){
    if(!byObj[r.object_uid]){byObj[r.object_uid]=[];order.push(r.object_uid);}
    byObj[r.object_uid].push(r);});
  h+=order.map(function(uid){
    var rs=byObj[uid];
    return '<div class="cd" style="margin-bottom:14px"><div class="cdh">'
      +'<h2>'+E(rs[0].object_title)+'</h2>'
      +'<span class="ch info" style="margin-left:auto">заявок: '+rs.length+'</span></div>'
      +rs.map(reqCard).join('')+'</div>';}).join('');
  return h;
}
function reqCard(r){
  var head='<div class="it" style="border-top:1px solid var(--line);background:var(--soft)">'
    +'<div class="ni info">'+ic('i-usr')+'</div>'
    +'<div style="min-width:0"><div class="tx" style="font-weight:600">'+E(r.author)+'</div>'
    +'<div class="sb">'+E(r.created_at)+(r.need_by?' · нужно к '+E(r.need_by):'')
    +(r.note?' · '+E(r.note):'')+'</div></div>'
    +'<button class="btn sm danger" style="margin-left:auto" data-act="sup-cancel" '
    +'data-id="'+r.id+'" title="Снять заявку">'+ic('i-x')+'<span class="lbl">Снять</span></button>'
    +'</div>';
  return head+r.lines.map(function(l){
    var last=l.status==='returned';
    return '<div class="it">'
      +(last?'<span class="pickgap"></span>'
            :'<input type="checkbox" class="pick" data-act="sup-pick" data-id="'+l.id+'"'
             +' data-st="'+E(l.status)+'" data-name="'+E(l.name)+'"'
             +(SUP.pick[l.id]?' checked':'')+' title="Отметить позицию">')
      +'<div class="ni'+(last?' ok':'')+'">'+ic('i-box')+'</div>'
      +'<div style="min-width:0;flex:1"><div class="tx">'+E(l.name)+'</div>'
      +'<div class="sb n">'+qs(l.qty)+' '+E(l.unit||'шт')
      +(l.qty_stock!=null?' · принято '+qs(l.qty_stock):'')
      +(l.qty_issued!=null?' · выдано '+qs(l.qty_issued):'')
      +(l.qty_back!=null?' · вернули '+qs(l.qty_back):'')
      +' · '+E(l.status_at)+'</div>'+stage(l.id,l.status)+'</div>'
      +(last?'':'<button class="btn sm" style="margin-left:auto" data-act="sup-adv" '
        +'data-id="'+l.id+'" data-st="'+E(l.status)+'" data-name="'+E(l.name)+'" '
        +'data-qty="'+l.qty+'" title="Продвинуть состояние">'+ic('i-right')
        +'<span class="lbl">Дальше</span></button>')
      +'</div>';}).join('');
}

function advDialog(el){
  var st=el.dataset.st,next=FLOW.slice(FLOW.indexOf(st)+1);
  var opts=next.map(function(k,i){return '<option value="'+k+'"'+(i?'':' selected')+'>'
    +E(FLOW_RU[k])+'</option>';}).join('');
  var m=UI.modal({narrow:true,title:'Продвинуть позицию',sub:el.dataset.name,
    ok:'Записать',okIcon:'i-ok',
    body:'<div class="fcell wide"><div class="flab">Новое состояние</div>'
      +'<select class="fin" id="supSt">'+opts+'</select></div>'
      +'<div class="fcell wide" style="margin-top:12px" id="supQtyBox">'
      +'<div class="flab" id="supQtyLab">Количество</div>'
      +'<input class="fin n" id="supQty" value="'+E(el.dataset.qty)+'"></div>'
      +'<div class="fcell wide" style="margin-top:12px;display:none" id="supPriceBox">'
      +'<div class="flab">Закупочная цена за единицу</div>'
      +'<input class="fin n" id="supPrice" placeholder="можно оставить пустым"></div>'
      +'<div class="fcell wide" style="margin-top:12px"><div class="flab">Примечание</div>'
      +'<input class="fin" id="supNote" placeholder="необязательно"></div>'
      +'<div class="fnote" style="margin-top:12px">Состояние идёт только вперёд. '
      +'«На складе», «Выдано» и «Вернули» записывают движение по складу.</div>',
    onOk:function(w){
      var v=w.querySelector('#supSt').value;
      advSend(el.dataset.id,v,num(w.querySelector('#supQty').value),
              w.querySelector('#supPrice').value,w.querySelector('#supNote').value);
    }});
  var sel=m.el.querySelector('#supSt');
  function sync(){
    var v=sel.value,lab=ASK_QTY[v];
    m.el.querySelector('#supQtyBox').style.display=lab?'':'none';
    m.el.querySelector('#supPriceBox').style.display=v==='stock'?'':'none';
    if(lab)m.el.querySelector('#supQtyLab').textContent=lab;
    if(v==='returned')m.el.querySelector('#supQty').value='0';
  }
  sel.addEventListener('change',sync); sync();
}
/* Пакетный переход. Целями предлагаем только то, что впереди у САМОЙ
   продвинутой из отмеченных: цепочка идёт вперёд у каждой позиции, и цель
   позади хотя бы одной сервер отклонит целиком. */
function advManyDialog(){
  var picked=Object.keys(SUP.pick).map(function(k){return SUP.pick[k];});
  var next=advNext();
  if(!next.length)return;
  UI.modal({narrow:true,title:'Продвинуть отмеченные',
    sub:picked.length+' поз.',ok:'Записать',okIcon:'i-ok',
    body:'<div class="fcell wide"><div class="flab">Новое состояние</div>'
      +'<select class="fin" id="supbSt">'+next.map(function(k,i){
        return '<option value="'+k+'"'+(i?'':' selected')+'>'+E(FLOW_RU[k])+'</option>';
        }).join('')+'</select></div>'
      +'<div class="fcell wide" style="margin-top:12px"><div class="flab">Примечание</div>'
      +'<input class="fin" id="supbNote" placeholder="необязательно"></div>'
      +'<div class="fnote" style="margin-top:12px">Количество берётся заявленное '
      +'по каждой позиции. Приняли или выдали меньше — отметьте такую позицию '
      +'отдельно кнопкой «Дальше».</div>'
      +'<div class="fnote warn" style="margin-top:8px">«Вернули» пакетом '
      +'недоступно: сколько осталось на объекте — у каждой позиции своё, '
      +'и в этом весь смысл того перехода.</div>',
    onOk:function(w){
      advManySend(Object.keys(SUP.pick).map(Number),
                  w.querySelector('#supbSt').value,
                  w.querySelector('#supbNote').value);
    }});
}
async function advManySend(ids,status,note){
  try{
    var r=await post('/supply/lines/status',{line_ids:ids,status:status,note:note||null});
    SUP.pick={};
    T('Состояние: '+FLOW_RU[status]+' · позиций: '+r.lines);
    supLoad();
  }catch(e){T(e.message,4000);}
}

async function advSend(id,status,qty,price,note){
  try{
    await post('/supply/lines/'+id+'/status',{status:status,
      qty:ASK_QTY[status]?qty:null,price:price?num(price):null,note:note||null});
    T('Состояние: '+FLOW_RU[status]);
    supLoad();
  }catch(e){T(e.message,3500);}
}

/* ── Склад ── */
function stockView(){
  if(SUP.stock===null)return (window.UI?UI.loading(4):'<div class="pd sub">Загружаю…</div>');
  var onStock=SUP.stock.filter(function(x){return x.place==='stock';}),
      onObj=SUP.stock.filter(function(x){return x.place==='object';}),
      onHand=SUP.stock.filter(function(x){return x.place==='person';}),
      toll=SUP.stock.filter(function(x){return x.owner==='toll';});
  var money=onStock.reduce(function(a,b){return a+(b.sum||0);},0),
      showCost=onStock.some(function(x){return x.sum!=null;});
  var h='<div class="cd" style="margin-bottom:14px"><div class="cdh">'
    +'<h2>Склад</h2>'
    +'<button class="btn sm primary" style="margin-left:auto" data-act="sup-move" '
    +'title="Записать движение">'+ic('i-plus')+'<span class="lbl">Движение</span></button></div>'
    +'<div class="pd pd0"><div class="kp">'
    +kpi('info','i-box','Позиций на складе',onStock.length,showCost?rub(money):'')
    +kpi('acc','i-bld','На объектах',onObj.length,'выдано и не вернулось')
    +kpi('ok','i-tool','Инструмент на руках',onHand.length,'')
    +kpi('warn','i-usrs','Давальческое',toll.length,'от партнёра')
    +'</div><p class="fnote">Остаток считается из движений, а не хранится: '
    +'приход в место минус расход из него.</p></div></div>';
  var ns=pickCount(SUP.spick);
  if(ns)h+=selbar(ns,'sup-movemany','Движение','sup-spickno',moveWhy());
  h+=stockTable('Что лежит на складе',onStock,'Склад пуст — и это цель, а не пробел.');
  h+=stockTable('Что на объектах',onObj,'На объектах ничего не числится.');
  h+=stockTable('Инструмент и материал на руках',onHand,'На руках ничего не числится.');
  h+=costView();
  h+=movesView();
  return h;
}
function kpi(cls,icon,label,value,detail){
  return '<div class="k '+cls+'"><div class="r"><div class="ic">'+ic(icon)+'</div>'
    +'<div style="min-width:0"><div class="lb">'+E(label)+'</div>'
    +'<div class="vl n">'+E(String(value))+'</div>'
    +(detail?'<div class="dl">'+E(detail)+'</div>':'')+'</div></div></div>';
}
/* Ключ остатка: место, ссылка на место и сама позиция. Материал и инструмент,
   наше и давальческое различаются тоже — иначе пакет записал бы движение
   не тем видом ТМЦ. */
function skey(r){return [r.place,r.ref||'',r.item,r.cls,r.owner].join('|');}
function stockTable(title,rows,emptyText){
  var h='<div class="cd" style="margin-bottom:14px"><div class="cdh"><h2>'+E(title)+'</h2>'
    +(rows.length?allBtn('sup-spickall',allStock(rows[0].place),
        ' style="margin-left:auto" data-p="'+E(rows[0].place)+'"','всё в таблице')
      +'<span class="ch">'+rows.length+'</span>'
      :'<span class="ch" style="margin-left:auto">0</span>')+'</div>';
  if(!rows.length)return h+'<div class="pd sub">'+E(emptyText)+'</div></div>';
  var cost=rows.some(function(r){return r.sum!=null;});
  /* Галочка внутри первой ячейки, а не своим столбцом: на телефоне таблица
     сворачивается в записи, и первой ячейкой видно только название —
     отдельный столбец с галочкой оставил бы запись без имени. */
  h+='<div class="xscroll"><table><thead><tr><th>Позиция</th><th>Где</th>'
    +'<th style="text-align:right">Остаток</th>'
    +(cost?'<th style="text-align:right">Сумма</th>':'')+'<th>С какого числа</th></tr></thead><tbody>';
  h+=rows.map(function(r){
    var k=skey(r);
    return '<tr><td data-l="Позиция"><span style="display:inline-flex;gap:9px;align-items:center;max-width:100%">'
      +'<input type="checkbox" class="pick" data-act="sup-spick" '
      +'data-k="'+E(k)+'"'+(SUP.spick[k]?' checked':'')+' title="Отметить позицию">'
      +'<span style="min-width:0">'+E(r.item)
      +(r.owner==='toll'?' <span class="ch warn">давальческое</span>':'')
      +(r.cls==='tool'?' <span class="ch info">инструмент</span>':'')+'</span></span></td>'
      +'<td data-l="Где">'+E(r.where)+'</td>'
      +'<td data-l="Остаток" class="n" style="text-align:right">'+qs(r.qty)+' '+E(r.unit||'шт')+'</td>'
      +(cost?'<td data-l="Сумма" class="n" style="text-align:right">'+(r.sum==null?'—':rub(r.sum))+'</td>':'')
      +'<td data-l="С какого числа">'+E(r.since||'—')+'</td></tr>';}).join('');
  return h+'</tbody></table></div></div>';
}
function costView(){
  if(!SUP.cost||!SUP.cost.length)return '';
  return '<div class="cd" style="margin-bottom:14px"><div class="cdh">'
    +'<h2>Материал по объектам</h2></div>'
    +'<table><thead><tr><th>Объект</th><th style="text-align:right">Выдано минус возвращено</th>'
    +'</tr></thead><tbody>'
    +SUP.cost.map(function(c){
      return '<tr><td data-l="Объект">'+E(c.object_title)+'</td>'
        +'<td data-l="Сумма" class="n" style="text-align:right">'+rub(c.amount)+'</td></tr>';
      }).join('')
    +'</tbody></table><div class="pd sub">Возврат остатков вычитается здесь же — '
    +'без него себестоимость объекта была бы завышена на сумму того, что уехало обратно.</div></div>';
}
/* Журнал стоит последним на экране и растёт без конца, а смотрят в нём
   вчерашнее: показываем свежие записи, остальное — по кнопке.
   Сервер отдает не больше MOVES_MAX последних, поэтому полный ответ — «100+». */
var MOVES_TOP=10,MOVES_MAX=100;
function movesView(){
  var all=SUP.moves||[],cut=!SUP.movesAll&&all.length>MOVES_TOP;
  var h='<div class="cd"><div class="cdh"><h2>Журнал движений</h2>'
    +(all.length?'<span class="ch" style="margin-left:auto">'+(all.length>=MOVES_MAX?MOVES_MAX+'+':all.length)+'</span>':'')+'</div>';
  if(SUP.moves===null)return h+(window.UI?UI.loading(3):'<div class="pd sub">Загружаю…</div>')+'</div>';
  if(!SUP.moves.length)return h+'<div class="pd sub">Движений пока нет.</div></div>';
  return h+(cut?all.slice(0,MOVES_TOP):all).map(function(m){
    return '<div class="it"><div class="ni">'+ic(m.cls==='tool'?'i-tool':'i-box')+'</div>'
      +'<div style="min-width:0;flex:1"><div class="tx">'+E(m.item)
      +' <span class="n">'+qs(m.qty)+' '+E(m.unit||'шт')+'</span></div>'
      +'<div class="sb">'+E(m.kind_ru)+' · '+E(m.src)+' → '+E(m.dst)
      +(m.target?' («'+E(m.target)+'»)':'')
      +(m.counterparty?' · '+E(m.counterparty):'')
      +' · '+E(m.author)+' · '+E(m.created_at)
      +(m.note?' · '+E(m.note):'')+'</div></div>'
      +(m.manual?'<button class="btn sm danger" style="margin-left:auto" data-act="sup-mdel" '
        +'data-id="'+m.id+'" title="Убрать запись">'+ic('i-trash')+'</button>':'')
      +'</div>';}).join('')
    +(cut?'<div class="pd"><button class="btn sm" data-act="sup-mall">Весь журнал</button></div>':'')+'</div>';
}

/* Одна форма на четыре повода: давальческое, инструмент, остатки с гаража,
   возврат. Спрашиваем повод, а не пару мест — «выдали инструмент» человек
   понимает, «склад → человек» нет. */
function moveDialog(){
  var kinds=['receipt','issue','tool','toll','back','writeoff'];
  var objs=(SUP.objs||[]).map(function(o){
    return '<option value="'+E(o.uid)+'">'+E(o.name)+'</option>';}).join('');
  var staff=(SUP.staff||[]).map(function(s){
    return '<option value="'+s.user_id+'">'+E(s.name)+'</option>';}).join('');
  var m=UI.modal({title:'Движение ТМЦ',sub:'Что, сколько, откуда, куда',
    ok:'Записать',okIcon:'i-save',
    body:'<div class="fgrid">'
      +'<div class="fcell"><div class="flab">Повод</div><select class="fin" id="mvKind">'
      +kinds.map(function(k){return '<option value="'+k+'">'+E(KIND_RU[k])+'</option>';}).join('')
      +'</select></div>'
      +'<div class="fcell"><div class="flab">Вид</div><select class="fin" id="mvCls">'
      +'<option value="material">Материал</option><option value="tool">Инструмент</option>'
      +'</select></div>'
      +'<div class="fcell wide"><div class="flab">Позиция <i>обязательно</i></div>'
      +'<input class="fin" id="mvItem" placeholder="Например: Модуль ГОТВ МПА-НТ 65-100-32"></div>'
      +'<div class="fcell"><div class="flab">Количество <i>обязательно</i></div>'
      +'<input class="fin n" id="mvQty" value="1"></div>'
      +'<div class="fcell"><div class="flab">Единица</div>'
      +'<input class="fin" id="mvUnit" value="шт"></div>'
      +'<div class="fcell"><div class="flab">Цена за единицу</div>'
      +'<input class="fin n" id="mvPrice" placeholder="можно оставить пустым"></div>'
      +'<div class="fcell" id="mvObjBox"><div class="flab">Объект</div>'
      +'<select class="fin" id="mvObj"><option value="">Не выбран</option>'+objs+'</select></div>'
      +'<div class="fcell" id="mvManBox"><div class="flab">Человек</div>'
      +'<select class="fin" id="mvMan"><option value="">Не выбран</option>'+staff+'</select></div>'
      +'<div class="fcell" id="mvCpBox"><div class="flab">Партнёр или поставщик</div>'
      +'<input class="fin" id="mvCp" placeholder="от кого"></div>'
      +'<div class="fcell wide"><div class="flab">Примечание</div>'
      +'<input class="fin" id="mvNote" placeholder="например: остатки из гаража"></div>'
      +'</div><div class="fnote" style="margin-top:12px" id="mvHint"></div>',
    onOk:function(w){return moveSend(w);}});
  var k=m.el.querySelector('#mvKind');
  function sync(){
    var v=k.value;
    /* Открытая сторона повода выбирается тем, что заполнено: возврат и
       списание бывают и с объекта, и с рук. Остальные поводы сторону знают. */
    m.el.querySelector('#mvObjBox').style.display=
      (v==='issue'||v==='toll'||v==='back'||v==='writeoff')?'':'none';
    m.el.querySelector('#mvManBox').style.display=
      (v==='tool'||v==='back'||v==='writeoff')?'':'none';
    m.el.querySelector('#mvCpBox').style.display=(v==='receipt'||v==='toll')?'':'none';
    if(v==='tool')m.el.querySelector('#mvCls').value='tool';
    m.el.querySelector('#mvHint').textContent=
      v==='back'?'Возврат — куда: на склад. Откуда: выберите объект или человека.'
      :v==='writeoff'?'Списание снимает остаток. Откуда: объект или человек, иначе склад.'
      :v==='toll'?'Давальческое остаётся собственностью партнёра и в затраты объекта не идёт.'
      :v==='issue'?'Тем же поводом записывают остатки, привезённые с гаража на объект.'
      :'';
  }
  k.addEventListener('change',sync); sync();
}
function moveSend(w){
  var body={kind:w.querySelector('#mvKind').value,
    cls:w.querySelector('#mvCls').value,
    item:w.querySelector('#mvItem').value.trim(),
    unit:w.querySelector('#mvUnit').value.trim()||'шт',
    qty:num(w.querySelector('#mvQty').value),
    price:w.querySelector('#mvPrice').value?num(w.querySelector('#mvPrice').value):null,
    object_uid:w.querySelector('#mvObj').value||null,
    person_id:w.querySelector('#mvMan').value?+w.querySelector('#mvMan').value:null,
    counterparty:w.querySelector('#mvCp').value.trim()||null,
    note:w.querySelector('#mvNote').value.trim()||null};
  if(!body.item){T('Укажите позицию');return false;}
  if(!(body.qty>0)){T('Количество должно быть больше нуля');return false;}
  // Возвращаем промис: окно закроется по успеху, а на отказе останется
  // открытым вместе с введённым — раньше форма исчезала до ответа сервера.
  return post('/supply/moves',body).then(function(){T('Движение записано');supLoad();});
}

/* Пакетное движение с отмеченных остатков. Откуда — не спрашиваем, оно уже
   известно: это место, где отмеченное лежит. Разные места разом не сводим —
   «откуда» стало бы неопределённым, а не гибким. */
function moveManyDialog(){
  var rows=Object.keys(SUP.spick).map(function(k){return SUP.spick[k];});
  if(!rows.length||moveWhy())return;
  var place=rows[0].place,ref=rows[0].ref||'';
  /* Повод ограничен тем, где вещи лежат: со склада их выдают, с объекта
     и с рук — возвращают. Список без этого предлагал бы заведомо отказные. */
  var kinds=place==='stock'?['issue','tool','writeoff']:['back','writeoff'];
  var objs=(SUP.objs||[]).map(function(o){
    return '<option value="'+E(o.uid)+'"'+(o.uid===ref?' selected':'')+'>'+E(o.name)
      +'</option>';}).join('');
  var staff=(SUP.staff||[]).map(function(sf){
    return '<option value="'+sf.user_id+'"'
      +(String(sf.user_id)===ref?' selected':'')+'>'+E(sf.name)+'</option>';}).join('');
  var list=rows.map(function(r,i){
    return '<div class="it" style="padding:8px 0"><div style="min-width:0;flex:1">'
      +'<div class="tx">'+E(r.item)+'</div>'
      +'<div class="sb n">остаток '+qs(r.qty)+' '+E(r.unit||'шт')+'</div></div>'
      +'<input class="fin n" style="width:110px;margin-left:auto" data-mq="'+i+'" '
      +'value="'+r.qty+'"></div>';}).join('');
  var m=UI.modal({title:'Движение с отмеченных',
    sub:PLACE_RU[place]+(rows[0].where&&place!=='stock'?' · '+rows[0].where:'')
        +' · позиций: '+rows.length,
    ok:'Записать',okIcon:'i-save',
    body:'<div class="fgrid">'
      +'<div class="fcell"><div class="flab">Повод</div><select class="fin" id="mmKind">'
      +kinds.map(function(k){return '<option value="'+k+'">'+E(KIND_RU[k])+'</option>';}).join('')
      +'</select></div>'
      +'<div class="fcell" id="mmObjBox"><div class="flab">Объект</div>'
      +'<select class="fin" id="mmObj"><option value="">Не выбран</option>'+objs+'</select></div>'
      +'<div class="fcell" id="mmManBox"><div class="flab">Человек</div>'
      +'<select class="fin" id="mmMan"><option value="">Не выбран</option>'+staff+'</select></div>'
      +'<div class="fcell wide"><div class="flab">Примечание</div>'
      +'<input class="fin" id="mmNote" placeholder="например: съезд с объекта"></div>'
      +'</div><div class="sec" style="margin-top:14px"><b>Сколько</b></div>'+list
      +'<div class="fnote" style="margin-top:10px" id="mmHint"></div>',
    onOk:function(w){return moveManySend(w,rows,place,ref);}});
  var k=m.el.querySelector('#mmKind');
  function sync(){
    var v=k.value;
    /* Куда — только для тех поводов, у которых сторона открыта. Возврат
       и списание со склада никуда выбирать не просят. */
    m.el.querySelector('#mmObjBox').style.display=
      (v==='issue'&&place==='stock')?'':'none';
    m.el.querySelector('#mmManBox').style.display=
      (v==='tool'&&place==='stock')?'':'none';
    m.el.querySelector('#mmHint').textContent=
      v==='back'?'Возврат на склад. Откуда — отсюда же, из отмеченного места.'
      :v==='writeoff'?'Списание снимает остаток совсем.'
      :v==='tool'?'Инструмент числится за человеком до возврата.'
      :'Тем же поводом записывают остатки, привезённые с гаража на объект.';
  }
  k.addEventListener('change',sync); sync();
}
function moveManySend(w,rows,place,ref){
  var kind=w.querySelector('#mmKind').value;
  var items=[];
  for(var i=0;i<rows.length;i++){
    var f=w.querySelector('[data-mq="'+i+'"]'),v=num(f?f.value:0);
    if(v<=0){T('Количество нельзя оставить нулевым: '+rows[i].item);return false;}
    if(v>rows[i].qty){T('Нельзя списать больше остатка: '+rows[i].item);return false;}
    items.push({item:rows[i].item,unit:rows[i].unit,qty:v,price:rows[i].price,
                cls:rows[i].cls,owner:rows[i].owner});
  }
  var body={kind:kind,note:w.querySelector('#mmNote').value.trim()||null,items:items,
            object_uid:null,person_id:null};
  /* Открытую сторону повода заполняем сами из отмеченного места: человек уже
     сказал, откуда, отметив строки. */
  if(place==='object')body.object_uid=ref;
  else if(place==='person')body.person_id=+ref;
  if(kind==='issue')body.object_uid=w.querySelector('#mmObj').value||null;
  if(kind==='tool')body.person_id=+w.querySelector('#mmMan').value||null;
  if(kind==='issue'&&!body.object_uid){T('Выберите объект');return false;}
  if(kind==='tool'&&!body.person_id){T('Выберите человека');return false;}
  return post('/supply/moves/bulk',body).then(function(r){
    SUP.spick={};
    T('Записано движений: '+r.moves);
    supLoad();
  });
}

async function supLoad(){
  var tab=(window.PURTAB||'req');
  SUP.err='';
  if(tab==='req'){
    SUP.reqs=null; rrSup();
    try{SUP.reqs=await api('/supply/requests'+(SUP.openOnly?'?only_open=true':''));}
    catch(e){SUP.reqs=[];SUP.err=e.message;}
    rrSup(); return;
  }
  SUP.stock=null; SUP.moves=null; rrSup();
  try{SUP.stock=await api('/supply/stock');}catch(e){SUP.stock=[];SUP.err=e.message;}
  try{SUP.moves=await api('/supply/moves');}catch(e){SUP.moves=[];}
  try{SUP.cost=await api('/supply/objects/cost');}catch(e){SUP.cost=[];}
  if(SUP.objs===null){try{SUP.objs=await api('/shift/objects');}catch(e){SUP.objs=[];}}
  if(SUP.staff===null){try{SUP.staff=await api('/supply/staff');}catch(e){SUP.staff=[];}}
  rrSup();
}

document.addEventListener('click',function(ev){
  var el=ev.target.closest('[data-act]'); if(!el)return;
  var a=el.dataset.act;
  if(a==='sup-reload'){supLoad();return;}
  if(a==='sup-adv'){advDialog(el);return;}
  if(a==='sup-move'){moveDialog();return;}
  if(a==='sup-mall'){SUP.movesAll=true;rrSup();return;}
  if(a==='sup-advmany'){advManyDialog();return;}
  if(a==='sup-movemany'){moveManyDialog();return;}
  if(a==='sup-pickno'){SUP.pick={};rrSup();return;}
  if(a==='sup-spickno'){SUP.spick={};rrSup();return;}
  if(a==='sup-open'){SUP.openOnly=!SUP.openOnly;SUP.pick={};supLoad();return;}
  if(a==='sup-pickall'){
    if(allReq())SUP.pick={};
    else reqLines().forEach(function(l){
      SUP.pick[l.id]={id:l.id,status:l.status,name:l.name};});
    rrSup();return;}
  if(a==='sup-spickall'){
    var rs=placeRows(el.dataset.p),off=allStock(el.dataset.p);
    rs.forEach(function(r){if(off)delete SUP.spick[skey(r)];else SUP.spick[skey(r)]=r;});
    rrSup();return;}
  if(a==='sup-cancel'){
    UI.confirm({title:'Снять заявку?',text:'Она пропадёт из очереди снабжения.',
      ok:'Снять',okIcon:'i-trash'}).then(function(y){
      if(!y)return;
      post('/supply/requests/'+el.dataset.id+'/cancel',{})
        .then(function(){T('Заявка снята');supLoad();})
        .catch(function(e){T(e.message,3500);});});
    return;}
  if(a==='sup-mdel'){
    UI.confirm({title:'Убрать запись движения?',
      text:'Остаток пересчитается сам — он считается из движений.',
      ok:'Убрать',okIcon:'i-trash'}).then(function(y){
      if(!y)return;
      post('/supply/moves/'+el.dataset.id+'/delete',{})
        .then(function(){T('Запись убрана');supLoad();})
        .catch(function(e){T(e.message,3500);});});
    return;}
});
document.addEventListener('change',function(ev){
  var t=ev.target,a=t.dataset&&t.dataset.act;
  /* Отметку не перерисовываем целиком: список длинный, а перерисовка сбрасывала
     бы прокрутку на каждой галочке. Перерисовываем, только когда полоса
     выделения появляется или исчезает. */
  if(a==='sup-pick'){
    var was=pickCount(SUP.pick);
    if(t.checked)SUP.pick[t.dataset.id]={id:+t.dataset.id,status:t.dataset.st,
                                         name:t.dataset.name};
    else delete SUP.pick[t.dataset.id];
    if(!was||!pickCount(SUP.pick))rrSup(); else bumpSel();
    return;}
  if(a==='sup-spick'){
    var wasS=pickCount(SUP.spick),row=(SUP.stock||[]).filter(function(r){
      return skey(r)===t.dataset.k;})[0];
    if(t.checked&&row)SUP.spick[t.dataset.k]=row;
    else delete SUP.spick[t.dataset.k];
    if(!wasS||!pickCount(SUP.spick))rrSup(); else bumpSel();
    return;}
});
/* Полоса уже на экране — обновляем в ней число и причину запрета. */
function bumpSel(){
  syncAll();
  var bar=document.querySelector('#zakupkiView .selbar');
  if(!bar)return;
  var req=PURTAB==='req',why=req?advWhy():moveWhy(),w=bar.querySelector('[data-why]');
  bar.querySelector('b').textContent=String(pickCount(req?SUP.pick:SUP.spick));
  bar.querySelector('.btn.primary').disabled=!!why;
  w.textContent=why;w.hidden=!why;
}

window.SUPPLY={reqView:reqView,stockView:stockView,load:supLoad};

/* ══ ИСПОЛНИТЕЛЬ: вкладка «Материалы» ════════════════════════════════ */
var MT={uid:'',title:'',objs:null,lines:null,cart:{},reqs:null,
        find:null,q:'',note:'',need:'',busy:false,err:''};

function rrMt(){if(typeof window.renderShift==='function')window.renderShift();}

function mtView(){
  if(!MT.uid)return mtPick();
  return mtHead()+mtCart()+mtLines()+mtMine();
}
function mtHead(){
  return '<div class="cd" style="margin-bottom:14px"><div class="cdh">'
    +'<h2>'+E(MT.title||'Объект')+'</h2>'
    +'<button class="btn sm" style="margin-left:auto" data-act="mt-back" '
    +'title="Другой объект">'+ic('i-left')+'<span class="lbl">Объект</span></button></div>'
    +'<div class="pd sub">Заявка уходит снабжению напрямую — согласующего между вами нет.</div>'
    +'</div>';
}
function mtPick(){
  var h='<div class="cd"><div class="cdh"><h2>Выберите объект</h2></div>';
  if(MT.objs===null)return h+(window.UI?UI.loading(3):'<div class="pd sub">Загружаю…</div>')+'</div>';
  if(!MT.objs.length)return h+(window.UI?UI.empty({icon:'i-bld',title:'Объектов нет',
    text:'Объект создаётся в разделе «Сметы».'}):'<div class="pd sub">Объектов нет</div>')
    +'</div>';
  return h+MT.objs.map(function(o){
    return '<div class="it" style="align-items:center"><div class="ni info">'+ic('i-bld')+'</div>'
      +'<div style="min-width:0"><div class="tx" style="font-weight:600">'+E(o.name)+'</div>'
      +(o.customer?'<div class="sb">'+E(o.customer)+'</div>':'')+'</div>'
      +'<button class="btn sm" style="margin-left:auto" data-act="mt-obj" '
      +'data-uid="'+E(o.uid)+'" data-name="'+E(o.name||'')+'" title="Открыть объект">'
      +ic('i-right')+'<span class="lbl">Открыть</span></button></div>';}).join('')+'</div>';
}
function mtCart(){
  var keys=Object.keys(MT.cart);
  var h='<div class="cd" style="margin-bottom:14px"><div class="cdh"><h2>Заявка</h2>'
    +'<span class="ch info" style="margin-left:auto">позиций: '+keys.length+'</span></div>';
  if(!keys.length)h+='<div class="pd sub">Отметьте позиции ниже или добавьте свою.</div>';
  else h+=keys.map(function(k){var c=MT.cart[k];
    return '<div class="it"><div class="ni info">'+ic('i-box')+'</div>'
      +'<div style="min-width:0;flex:1"><div class="tx">'+E(c.name)+'</div>'
      +'<div class="sb n">'+qs(c.qty)+' '+E(c.unit||'шт')+'</div></div>'
      +'<button class="btn sm danger" style="margin-left:auto" data-act="mt-del" '
      +'data-k="'+E(k)+'" title="Убрать">'+ic('i-x')+'</button></div>';}).join('');
  h+='<div class="pd" style="border-top:1px solid var(--line)"><div class="fgrid">'
    +'<div class="fcell"><div class="flab">Нужно к</div>'
    +'<input class="fin" type="date" id="mtNeed" value="'+E(MT.need)+'"></div>'
    +'<div class="fcell"><div class="flab">Комментарий</div>'
    +'<input class="fin" id="mtNote" value="'+E(MT.note)+'" placeholder="например: к утру"></div>'
    +'</div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px">'
    +'<button class="btn primary" data-act="mt-send"'+(keys.length?'':' disabled')+'>'
    +ic('i-ok')+'<span class="lbl">Отправить заявку</span></button>'
    +'<button class="btn" data-act="mt-add">'+ic('i-plus')
    +'<span class="lbl">Добавить позицию</span></button></div></div></div>';
  return h;
}
function mtLines(){
  var h='<div class="cd" style="margin-bottom:14px"><div class="cdh">'
    +'<h2>Позиции сметы объекта</h2></div>';
  if(MT.lines===null)return h+(window.UI?UI.loading(4):'<div class="pd sub">Загружаю…</div>')+'</div>';
  if(!MT.lines.length)return h+'<div class="pd sub">В смете объекта позиций нет — '
    +'добавьте позицию поиском по базе или вручную.</div></div>';
  return h+MT.lines.map(function(l){
    var inCart=MT.cart['r:'+l.row_id];
    return '<div class="it"><div class="ni'+(inCart?' ok':'')+'">'+ic('i-doc')+'</div>'
      +'<div style="min-width:0;flex:1"><div class="tx">'+E(l.name)+'</div>'
      +'<div class="sb n">по смете '+qs(l.qty)+' '+E(l.unit||'шт')+'</div></div>'
      +'<button class="btn sm" style="margin-left:auto" '
      +'data-act="mt-take" data-row="'+E(l.row_id)+'" data-name="'+E(l.name)+'" '
      +'data-unit="'+E(l.unit||'шт')+'" title="'+(inCart?'В заявке':'Заказать')+'">'
      +ic(inCart?'i-ok':'i-plus')+'<span class="lbl">'+(inCart?'В заявке':'Заказать')
      +'</span></button></div>';}).join('')+'</div>';
}
function mtMine(){
  var h='<div class="cd"><div class="cdh"><h2>Заявки по объекту</h2></div>';
  if(MT.reqs===null)return h+(window.UI?UI.loading(3):'<div class="pd sub">Загружаю…</div>')+'</div>';
  if(!MT.reqs.length)return h+'<div class="pd sub">Заявок по этому объекту пока нет.</div></div>';
  return h+MT.reqs.map(function(r){
    return '<div class="it" style="background:var(--soft)"><div class="ni info">'+ic('i-usr')+'</div>'
      +'<div style="min-width:0"><div class="tx" style="font-weight:600">'+E(r.author)+'</div>'
      +'<div class="sb">'+E(r.created_at)+(r.note?' · '+E(r.note):'')+'</div></div></div>'
      +r.lines.map(function(l){
        return '<div class="it"><div class="ni'+(l.status==='returned'?' ok':'')+'">'
          +ic('i-box')+'</div><div style="min-width:0;flex:1">'
          +'<div class="tx">'+E(l.name)+' <span class="n">'+qs(l.qty)+' '+E(l.unit||'шт')
          +'</span></div>'+stage(l.id,l.status)+'</div></div>';}).join('');
    }).join('')+'</div>';
}

/* Позиция, которой в смете нет: сначала поиск по нашей базе, и только
   если не нашлось — ввод руками. Порядок важен, иначе одна и та же гайка
   заводится пятью разными названиями и остаток по ней не считается. */
function mtAddDialog(){
  var m=UI.modal({narrow:true,title:'Добавить позицию',sub:'Чего в смете нет',
    ok:'Добавить',okIcon:'i-plus',
    body:'<div class="fcell wide"><div class="flab">Поиск по базе</div>'
      +'<input class="fin" id="mtQ" placeholder="от двух букв"></div>'
      +'<div id="mtFound" class="fnote">Начните вводить — покажу, что есть в базе.</div>'
      +'<div class="fcell wide" style="margin-top:12px">'
      +'<div class="flab">Название <i>обязательно</i></div>'
      +'<input class="fin" id="mtName"></div>'
      +'<div class="fgrid" style="margin-top:12px">'
      +'<div class="fcell"><div class="flab">Количество</div>'
      +'<input class="fin n" id="mtQty" value="1"></div>'
      +'<div class="fcell"><div class="flab">Единица</div>'
      +'<input class="fin" id="mtUnit" value="шт"></div></div>',
    onOk:function(w){
      var name=w.querySelector('#mtName').value.trim();
      if(!name){T('Укажите название');return false;}
      var qty=num(w.querySelector('#mtQty').value);
      if(!(qty>0)){T('Количество должно быть больше нуля');return false;}
      MT.cart['m:'+name]={name:name,unit:w.querySelector('#mtUnit').value.trim()||'шт',
        qty:qty,row_id:null};
      rrMt();
    }});
  var inp=m.el.querySelector('#mtQ'),box=m.el.querySelector('#mtFound'),tm=null;
  inp.addEventListener('input',function(){
    clearTimeout(tm);
    var v=inp.value.trim();
    if(v.length<2){box.innerHTML='Начните вводить — покажу, что есть в базе.';return;}
    tm=setTimeout(function(){
      api('/supply/catalog?q='+encodeURIComponent(v)).then(function(list){
        if(!list.length){box.innerHTML='В базе не нашлось — впишите название руками.';return;}
        box.innerHTML=list.map(function(p){
          return '<div class="it" style="padding:7px 0;border-top:1px solid var(--line)">'
            +'<div style="min-width:0;flex:1"><div class="tx">'+E(p.name)+'</div>'
            +(p.brand?'<div class="sb">'+E(p.brand)+'</div>':'')+'</div>'
            +'<button class="btn sm" data-mtpick="'+E(p.name)+'" data-unit="'+E(p.unit)+'">'
            +'Взять</button></div>';}).join('');
      }).catch(function(e){box.textContent=e.message;});
    },300);
  });
  box.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-mtpick]'); if(!b)return;
    m.el.querySelector('#mtName').value=b.dataset.mtpick;
    m.el.querySelector('#mtUnit').value=b.dataset.unit||'шт';
  });
}

async function mtLoad(){
  if(MT.objs===null){
    try{MT.objs=await api('/shift/objects');}catch(e){MT.objs=[];MT.err=e.message;}
    /* Смена уже открыта — объект известен, и спрашивать его второй раз
       незачем: на телефоне это лишний экран между «нужен кабель» и заявкой. */
    if(!MT.uid){
      try{var c=await api('/shift/current');
        if(c&&c.shift&&c.shift.object_uid){MT.uid=c.shift.object_uid;
          MT.title=c.shift.object_name||'';}
      }catch(e){}
    }
    rrMt();
  }
  if(!MT.uid)return;
  MT.lines=null; MT.reqs=null; rrMt();
  try{MT.lines=await api('/supply/spec-lines?object_uid='+encodeURIComponent(MT.uid));}
  catch(e){MT.lines=[];MT.err=e.message;}
  try{MT.reqs=await api('/supply/requests?object_uid='+encodeURIComponent(MT.uid));}
  catch(e){MT.reqs=[];}
  rrMt();
}
async function mtSend(){
  var keys=Object.keys(MT.cart);
  if(!keys.length){T('Отметьте хотя бы одну позицию');return;}
  var body={object_uid:MT.uid,need_by:MT.need||null,note:MT.note||null,
    lines:keys.map(function(k){var c=MT.cart[k];
      return {row_id:c.row_id,name:c.name,unit:c.unit,qty:c.qty};})};
  try{
    await post('/supply/requests',body);
    MT.cart={}; MT.note=''; MT.need='';
    T('Заявка отправлена снабжению');
    mtLoad();
  }catch(e){T(e.message,3500);}
}

document.addEventListener('click',function(ev){
  var el=ev.target.closest('[data-act]'); if(!el)return;
  var a=el.dataset.act;
  if(a==='mt-obj'){MT.uid=el.dataset.uid;MT.title=el.dataset.name||'';
    MT.cart={};rrMt();mtLoad();return;}
  if(a==='mt-back'){MT.uid='';MT.title='';MT.lines=null;MT.reqs=null;rrMt();return;}
  if(a==='mt-take'){
    var k='r:'+el.dataset.row;
    if(MT.cart[k])delete MT.cart[k];
    else MT.cart[k]={name:el.dataset.name,unit:el.dataset.unit,qty:1,row_id:el.dataset.row};
    rrMt();return;}
  if(a==='mt-del'){delete MT.cart[el.dataset.k];rrMt();return;}
  if(a==='mt-add'){mtAddDialog();return;}
  if(a==='mt-send'){mtSend();return;}
});
document.addEventListener('input',function(ev){
  if(ev.target.id==='mtNote')MT.note=ev.target.value;
  if(ev.target.id==='mtNeed')MT.need=ev.target.value;
});

window.SUPMAT={view:mtView,load:mtLoad};
})();
