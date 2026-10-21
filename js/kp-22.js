/* ═══════════════════════════════════════════════════════════════════════════
   kp-22.js — раздел «Финансы» (#660).

   Выписка Точки в формате 1С загружается файлом; операции разносятся по
   статьям ДДС и заказам. Статья, назначенная контрагенту, подставляется
   остальным его операциям с пометкой «авто» — их подтверждают. Вкладка
   «ДДС» — месяц по статьям и сверка конечного остатка с банком; «Отчёты» —
   ОПиУ по месяцам, выручка заказа — по его актам. Считает и сверяет
   сервер (/finance/…), здесь только отрисовка.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
if(window.__finV1)return; window.__finV1=true;

var F={sum:null,arts:[],ops:null,orders:null,rep:null,pnl:null,pnlTo:'',tab:'ops',month:'',
  fNone:true,fAuto:false,sel:{},open:{},gopen:{},popen:{},full:{},err:'',res:null,busy:false,
  form:false,actFor:null,acts:null,seq:0};
var MON=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь',
  'Октябрь','Ноябрь','Декабрь'];

function ic(n){return '<svg class="i"><use href="#'+n+'"/></svg>'}
function m2(v){return Math.abs(+v||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})}
function sg(v){return (+v<0?'−':'+')+m2(v)}
function dd(s){return s?s.slice(8,10)+'.'+s.slice(5,7):''}
function say(t){UI.toast(t,2400,'ok')}
function btn(attr,icon,lbl,cls,title){
  return '<button class="btn'+(cls?' '+cls:'')+'" '+attr+' title="'+esc(title||lbl)+'">'+ic(icon)
    +(lbl?'<span class="lbl">'+esc(lbl)+'</span>':'')+'</button>';
}
function wr(){return typeof can==='function'&&can('finance:write')}
function J(path,method,body){
  return ledger(path,{method:method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}
// Тот же ключ, что у правила на сервере: ИНН, а без него — название.
function party(o){
  var inn=(o.counterparty_inn||'').trim();
  return inn&&/[^0]/.test(inn)?inn:'name:'+(o.counterparty||'').toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}
function art(id){return F.arts.filter(function(a){return a.id===id})[0]}
function monLabel(m){
  if(!m)return '';
  var y=+m.slice(0,4);
  return MON[+m.slice(5,7)-1]+(y!==new Date().getFullYear()?' '+y:'');
}
function addMon(m,k){
  var n=+m.slice(0,4)*12+(+m.slice(5,7)-1)+k;
  return Math.floor(n/12)+'-'+('0'+(n%12+1)).slice(-2);
}
function thisMon(){return new Date().toISOString().slice(0,7)}
// ОПиУ — полгода, кончая выбранным месяцем.
function pnlFrom(){return addMon(F.pnlTo,-5)}

function ensureView(){
  var v=document.getElementById('financeView');
  if(!v){v=document.createElement('div');v.id='financeView';v.style.display='none';
    (document.querySelector('.main')||document.body).appendChild(v);}
  return v;
}

// ── Загрузка ─────────────────────────────────────────────────────────────
function load(){
  var my=++F.seq;
  return Promise.all([ledger('/finance/summary'),F.arts.length?F.arts:ledger('/finance/articles')])
    .then(function(r){
      if(my!==F.seq)return;
      F.sum=r[0]; F.arts=r[1];
      if(!F.month||F.sum.months.indexOf(F.month)<0)F.month=F.sum.months[0]||'';
      return loadTab();
    }).catch(function(e){if(my===F.seq){F.loadErr=e.message;paint();}});
}
function loadTab(){
  var my=F.seq;
  F.loadErr='';
  if(!F.sum||!F.sum.months.length){paint();return;}
  if(!F.pnlTo)F.pnlTo=F.sum.months[0];
  var p=F.tab==='ord'?ledger('/finance/orders').then(function(r){F.orders=r})
    :F.tab==='pnl'?ledger('/finance/pnl?from='+pnlFrom()+'&to='+F.pnlTo).then(function(r){F.pnl=r})
    :F.tab==='dds'?ledger('/finance/report?month='+F.month).then(function(r){F.rep=r})
    :ledger('/finance/operations?'+(F.fNone?'unassigned=true':'month='+F.month))
      .then(function(r){F.ops=r});
  // Заказы нужны и списку операций — для выбора заказа в строке.
  if(F.tab==='ops'&&!F.orders)p=Promise.all([p,ledger('/finance/orders').then(function(r){F.orders=r})]);
  paint();
  return p.then(function(){if(my===F.seq)paint();})
    .catch(function(e){if(my===F.seq){F.loadErr=e.message;paint();}});
}
function refreshSum(){
  ledger('/finance/summary').then(function(r){F.sum=r;paintTabs();}).catch(function(){});
}

function upload(files){
  var f=files&&files[0]; if(!f||!wr())return;
  if(!/\.txt$/i.test(f.name)){F.err='Файл «'+f.name+'» не разобран: нужна выписка Точки в формате 1С (.txt).';paint();return;}
  F.err='';F.res=null;F.busy=true;F.tab='ops';paint();
  var fd=new FormData(); fd.append('file',f);
  ledger('/finance/statements',{method:'POST',body:fd}).then(function(r){
    F.busy=false;F.res=r;F.sel={};F.ops=null;return load();
  }).catch(function(e){F.busy=false;F.err='Файл «'+f.name+'» не разобран: '+e.message;paint();});
}

// ── Разнос ───────────────────────────────────────────────────────────────
function assign(ids,aid,quiet){
  return J('/finance/operations','PATCH',{ids:ids,article_id:aid}).then(function(r){
    var src=F.ops.filter(function(o){return ids.indexOf(o.id)>=0});
    var keys={};
    src.forEach(function(o){o.article_id=aid;o.article_auto=false;keys[party(o)+'|'+o.direction]=1;});
    if(aid!==null&&r.filled){
      F.ops.forEach(function(o){
        if(o.article_id===null&&keys[party(o)+'|'+o.direction]){o.article_id=aid;o.article_auto=true;}});
    }
    if(!quiet&&r.filled)say('Подставлено ещё '+r.filled+' · '+src[0].counterparty);
    refreshSum(); paint();
    return r;
  }).catch(function(e){toast(e.message);paint();});
}
function confirmOps(ids){
  var by={};
  F.ops.forEach(function(o){if(ids.indexOf(o.id)>=0&&o.article_auto)(by[o.article_id]=by[o.article_id]||[]).push(o.id);});
  return Promise.all(Object.keys(by).map(function(k){
    return assign(by[k],+k,true).then(function(r){return r?by[k].length:0});
  })).then(function(c){var n=c.reduce(function(a,b){return a+b},0);if(n)say('Подтверждено: '+n);});
}
function setOrder(id,oid){
  J('/finance/operations','PATCH',{ids:[id],order_id:oid}).then(function(){
    F.ops.forEach(function(o){if(o.id===id)o.order_id=oid;});
    ledger('/finance/orders').then(function(r){F.orders=r;}).catch(function(){});
  }).catch(function(e){toast(e.message);paint();});
}
// Пустая дата начисления — операция идёт в ОПиУ по дате платежа.
function setAccrual(id,d){
  J('/finance/operations','PATCH',{ids:[id],accrual_date:d}).then(function(){
    F.ops.forEach(function(o){if(o.id===id)o.accrual_date=d;});
    F.pnl=null;paint();
  }).catch(function(e){toast(e.message);paint();});
}
function saveOrder(){
  var v=function(id){var el=document.getElementById(id);return el?el.value.trim():''};
  var body={client:v('f6c'),object:v('f6o'),amount:v('f6s').replace(/\s/g,'').replace(',','.'),
    order_date:v('f6d')};
  if(!body.client||!body.amount){toast('Нужны клиент и сумма');return;}
  J('/finance/orders','POST',body).then(function(){
    F.form=false;say('Заказ сохранён');
    return ledger('/finance/orders').then(function(r){F.orders=r;paint();});
  }).catch(function(e){toast(e.message);});
}
function saveAct(){
  var v=function(id){var el=document.getElementById(id);return el?el.value.trim().replace(/\s/g,'').replace(',','.'):''};
  var body={act_date:v('f6ad'),amount:v('f6as'),vat:v('f6av')||'0'};
  if(!body.act_date||!body.amount){toast('Нужны дата и сумма');return;}
  J('/finance/orders/'+F.actFor+'/acts','POST',body).then(function(){
    F.actFor=null;F.pnl=null;say('Акт сохранён');
    return ledger('/finance/orders').then(function(r){F.orders=r;paint();});
  }).catch(function(e){toast(e.message);});
}

function openActs(oid){
  F.actFor=oid;F.acts=null;paint();
  var s=document.getElementById('f6as');if(s)s.focus();
  ledger('/finance/orders/'+oid+'/acts').then(function(r){if(F.actFor===oid){F.acts=r;paint();}})
    .catch(function(e){toast(e.message);});
}
function delAct(aid){
  var kill=function(){
    ledger('/finance/acts/'+aid,{method:'DELETE'}).then(function(){
      F.pnl=null;say('Акт удалён');openActs(F.actFor);
      return ledger('/finance/orders').then(function(r){F.orders=r;paint();});
    }).catch(function(e){toast(e.message);});};
  UI.confirm({title:'Удалить акт?',text:'Выручка по нему уйдёт из ОПиУ.',ok:'Удалить',okIcon:'i-trash'})
    .then(function(y){if(y)kill();});
}

// ── Отрисовка ────────────────────────────────────────────────────────────
function shown(){
  var l=F.ops||[];
  return F.fNone&&F.fAuto?l.filter(function(o){return o.article_auto}):l;
}
function tabs(){
  var n=F.sum?F.sum.unassigned:0, ms=F.sum?F.sum.months:[], i=ms.indexOf(F.month);
  var st=function(k,icn,lbl,ch){
    return '<button class="stab'+(F.tab===k?' on':'')+'" data-f6tab="'+k+'" title="'+lbl+'">'+ic(icn)
      +'<span class="lbl">'+lbl+'</span>'+(ch||'')+'</button>';};
  var acts=F.tab==='ops'?(wr()?btn('data-f6="load"','i-imp','Загрузить выписку','primary'):'')
    :F.tab==='ord'?(wr()?btn('data-f6="neword"','i-plus','Новый заказ','primary'):'')
    :F.tab==='pnl'?pnlNav():monNav(ms,i);
  return '<div class="tabbar f6bar"><div class="stabs">'
    +st('ops','i-list','Операции',n?'<span class="ch warn" title="Не разнесено: '+n+'">'+n+'</span>':'')
    +st('ord','i-fold','Заказы')+st('dds','i-chart','ДДС')+st('pnl','i-rep','Отчёты')
    +'</div><span class="hint curnote">все суммы — ₽</span><div class="acts">'+acts+'</div></div>';
}
// Месяцы идут от нового к старому: «назад» — дальше по списку.
function monNav(ms,i){
  return '<button class="btn sm io" data-f6m="1" title="Предыдущий месяц"'+(i>=ms.length-1?' disabled':'')+'>'+ic('i-left')+'</button>'
    +'<span class="f6mon">'+esc(monLabel(F.month))+'</span>'
    +'<button class="btn sm io" data-f6m="-1" title="Следующий месяц"'+(i<=0?' disabled':'')+'>'+ic('i-right')+'</button>';
}
function pnlNav(){
  return '<button class="btn sm io" data-f6pm="-1" title="Месяцем раньше">'+ic('i-left')+'</button>'
    +'<span class="f6mon">'+esc(monLabel(pnlFrom())+' – '+monLabel(F.pnlTo))+'</span>'
    +'<button class="btn sm io" data-f6pm="1" title="Месяцем позже"'+(F.pnlTo>=thisMon()?' disabled':'')+'>'+ic('i-right')+'</button>';
}
function errHTML(){
  return F.err?'<div class="errbox x" style="margin:0 0 10px"><p>'+esc(F.err)+'</p>'
    +btn('data-f6="errx"','i-x','','sm io','Закрыть')+'</div>':'';
}
function artOpts(kind,cur){
  var groups=F.arts.filter(function(a){return a.kind===kind&&a.is_group});
  var loose=F.arts.filter(function(a){return a.kind===kind&&!a.is_group&&!a.parent_id});
  var opt=function(a){return '<option value="'+a.id+'"'+(a.id===cur?' selected':'')+'>'+esc(a.name)+'</option>'};
  return groups.map(function(g){
    return '<optgroup label="'+esc(g.name)+'">'+F.arts.filter(function(a){return a.parent_id===g.id}).map(opt).join('')+'</optgroup>';
  }).join('')+(loose.length?'<optgroup label="Без группы">'+loose.map(opt).join('')+'</optgroup>':'');
}
function artSel(o){
  return '<select class="fin f6sel'+(o.article_id?'':' none')+'" data-f6art="'+o.id+'"'+(wr()?'':' disabled')+'>'
    +'<option value="">Без статьи</option>'+artOpts(o.direction,o.article_id)+'</select>';
}
function ordSel(o){
  return '<select class="fin f6sel ord" data-f6ord="'+o.id+'"'+(wr()?'':' disabled')+'><option value="">—</option>'
    +(F.orders||[]).map(function(c){
      return '<option value="'+c.id+'"'+(c.id===o.order_id?' selected':'')+'>'
        +esc(c.client+(c.object?' · '+c.object:''))+'</option>';}).join('')+'</select>';
}
function accSel(o){
  var d=o.accrual_date||'';
  return '<div class="f6a"><input type="date" class="fin f6sel dt'+(d?'':' blank')+'" data-f6acc="'+o.id+'" value="'+d+'"'
    +' aria-label="Дата начисления"'+(wr()?'':' disabled')+'>'
    +(d&&wr()?btn('data-f6accx="'+o.id+'"','i-x','','sm io','Снять дату начисления'):'')+'</div>';
}
function selBar(l){
  var ids=Object.keys(F.sel).map(Number); if(!ids.length)return '';
  var picked=l.filter(function(o){return F.sel[o.id]});
  var dirs={}; picked.forEach(function(o){dirs[o.direction]=1});
  var kinds=Object.keys(dirs), mix=kinds.length>1;
  return '<div class="selbar on"><span><b>'+picked.length+'</b> отмечено</span>'
    +'<select class="fin f6sel" id="f6bulk"'+(mix?' disabled':'')+'><option value="">Статья…</option>'
    +(mix||!kinds.length?'':artOpts(kinds[0],null))+'</select>'
    +btn('data-f6="bulk"','i-ok','Назначить','primary sm')+btn('data-f6="bulkok"','i-ok','Подтвердить','sm')
    +btn('data-f6="selall"','i-list','Все','sm')+btn('data-f6="selx"','i-x','','sm io','Снять')
    +'</div>'+(mix?'<div class="fnote">Приход и расход — разные статьи: отметьте что-то одно.</div>':'');
}
function opsHTML(){
  if(F.busy)return '<p class="hint">Разбор выписки…</p>'+UI.loading(6);
  if(!F.ops)return UI.loading(6);
  var l=shown(), anyAuto=(F.ops||[]).some(function(o){return o.article_auto});
  var h='<div class="f6stick"><div class="f6flt">'
    +btn('data-f6="fnone"','i-filt','Без статьи','sm'+(F.fNone?' on':''),'Только без статьи')
    +(F.fNone&&anyAuto?btn('data-f6="fauto"','i-eye','Авто','sm'+(F.fAuto?' on':''),'Только подставленные'):'')
    +(F.fNone?'':monNav(F.sum.months,F.sum.months.indexOf(F.month)))
    +'<span class="ch f6tot" title="Операций в списке">'+l.length+'</span></div>'
    +(wr()?selBar(l):'')+'</div>'+errHTML();
  if(F.res)h+='<div class="f6res">'+ic('i-ok')+'Добавлено '+F.res.added+', уже были '+F.res.skipped+'</div>';
  if(!l.length)return h+'<div class="cd f6card" id="f6drop">'+UI.empty({icon:'i-ok',title:F.fNone?'Всё разнесено':'Ничего не найдено'})+'</div>';
  var allOn=l.every(function(o){return F.sel[o.id]});
  h+='<div class="cd f6card" id="f6drop"><div class="xscroll"><table class="f6t"><thead><tr>'
    +'<th>'+(wr()?'<input type="checkbox" class="pick" data-f6="all"'+(allOn?' checked':'')+' aria-label="Отметить все"> ':'')+'Контрагент</th>'
    +'<th>Дата</th><th>Назначение</th><th class="f6r">Сумма</th><th>Статья</th><th>Заказ</th>'
    +'<th title="Месяц операции в ОПиУ; пусто — по дате платежа">Начисление</th></tr></thead><tbody>'
    +l.map(row).join('')+'</tbody></table></div></div>';
  return h;
}
function row(o){
  var a=o.article_id&&art(o.article_id), inn=o.direction==='in';
  var sub=a?dd(o.op_date)+' · '+esc(a.name)+(o.article_auto?' · авто':'')
    :dd(o.op_date)+' · <span class="f6none">без статьи</span>';
  return '<tr data-op="'+o.id+'"'+(F.open[o.id]?' class="op"':'')+'><td><div class="f6c">'
    +(wr()?'<input type="checkbox" class="pick" data-f6pick="'+o.id+'"'+(F.sel[o.id]?' checked':'')+' aria-label="Отметить">':'')
    +'<div class="f6nm"><b title="'+esc(o.counterparty)+'">'+esc(o.counterparty||'—')+'</b><div class="sub">'+sub+'</div></div>'
    +'<span class="n f6s'+(inn?' in':'')+'">'+sg(inn?o.amount:-o.amount)+'</span></div></td>'
    +'<td class="n f6d">'+dd(o.op_date)+'</td>'
    +'<td class="f6w" data-l="Назначение"><span class="f6p'+(F.full[o.id]?' full':'')+'" data-f6p="'+o.id+'" title="'+esc(o.purpose)+'">'+esc(o.purpose)+'</span></td>'
    +'<td class="n f6r" data-l="Сумма, ₽"><span class="f6s'+(inn?' in':'')+'">'+sg(inn?o.amount:-o.amount)+'</span></td>'
    +'<td class="f6w" data-l="Статья"><div class="f6a">'+artSel(o)
    +(o.article_auto?'<span class="pill src" title="Подставлено по контрагенту — проверьте">авто</span>'
      +(wr()?btn('data-f6ok="'+o.id+'"','i-ok','','sm io','Подтвердить'):''):'')+'</div></td>'
    +'<td class="f6w" data-l="Заказ">'+ordSel(o)+'</td>'
    +'<td class="f6w" data-l="Начисление">'+accSel(o)+'</td></tr>';
}
function ordHTML(){
  var h='';
  if(F.form){
    var cl={}; (F.orders||[]).forEach(function(c){cl[c.client]=1});
    h+='<div class="cd f6form"><div class="fgrid">'
      +'<div class="fcell"><label for="f6c">Клиент</label><input class="fin" id="f6c" list="f6cl" autocomplete="off">'
      +'<datalist id="f6cl">'+Object.keys(cl).map(function(c){return '<option value="'+esc(c)+'">'}).join('')+'</datalist></div>'
      +'<div class="fcell"><label for="f6o">Объект</label><input class="fin" id="f6o"></div>'
      +'<div class="fcell"><label for="f6s">Сумма, ₽</label><input class="fin" id="f6s" inputmode="decimal"></div>'
      +'<div class="fcell"><label for="f6d">Дата</label><input class="fin" id="f6d" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'
      +'</div><div class="bar">'+btn('data-f6="ordx"','i-x','Отмена','ghost')+btn('data-f6="ordsave"','i-save','Сохранить','primary')+'</div></div>';
  }
  var ao=F.actFor&&(F.orders||[]).filter(function(c){return c.id===F.actFor})[0];
  if(ao){
    h+='<div class="cd f6form"><div class="sec">Акты · '+esc(ao.client+(ao.object?' · '+ao.object:''))+'</div>'
      +(F.acts===null?'<div class="skrow"><div class="skel t"></div></div>':F.acts.map(function(t){
        return '<div class="f6ar" data-act-id="'+t.id+'"><span class="t">'+dd(t.act_date)+'.'+t.act_date.slice(0,4)
          +(t.vat?' · НДС '+m2(t.vat):'')+'</span><span class="n">'+m2(t.amount)+'</span>'
          +btn('data-f6actdel="'+t.id+'"','i-trash','','sm io','Удалить акт')+'</div>';}).join(''))
      +'<div class="fgrid">'
      +'<div class="fcell"><label for="f6ad">Дата акта</label><input class="fin" id="f6ad" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'
      +'<div class="fcell"><label for="f6as">Сумма с НДС, ₽</label><input class="fin" id="f6as" inputmode="decimal"></div>'
      +'<div class="fcell"><label for="f6av">НДС, ₽</label><input class="fin" id="f6av" inputmode="decimal" placeholder="0"></div>'
      +'</div><div class="bar">'+btn('data-f6="actx"','i-x','Отмена','ghost')+btn('data-f6="actsave"','i-save','Сохранить','primary')+'</div></div>';
  }
  if(!F.orders)return h+UI.loading(4);
  if(!F.orders.length)return h+'<div class="cd">'+UI.empty({icon:'i-fold',title:'Заказов нет'})+'</div>';
  var paid=function(c){return c.left<=0?'<span class="ch ok f6s">оплачен</span>':'<span class="n f6s">'+m2(c.left)+'</span>'};
  return h+'<div class="cd f6card"><div class="xscroll"><table class="f6t o"><thead><tr>'
    +'<th>Клиент</th><th>Объект</th><th>Дата</th><th class="f6r">Сумма</th><th class="f6r">По актам</th><th class="f6r">Поступило</th><th class="f6r">Остаток</th>'
    +(wr()?'<th></th>':'')+'</tr></thead><tbody>'+F.orders.map(function(c){
      return '<tr data-ord="'+c.id+'"'+(F.open['o'+c.id]?' class="op"':'')+'><td><div class="f6c"><div class="f6nm"><b>'+esc(c.client)+'</b>'
        +'<div class="sub">'+esc(c.object||'')+'</div></div>'+paid(c)+'</div></td>'
        +'<td data-l="Объект">'+esc(c.object||'—')+'</td><td class="n" data-l="Дата">'+dd(c.order_date)+'.'+c.order_date.slice(0,4)+'</td>'
        +'<td class="n f6r" data-l="Сумма, ₽">'+m2(c.amount)+'</td><td class="n f6r" data-l="По актам, ₽">'+m2(c.acted)+'</td>'
        +'<td class="n f6r" data-l="Поступило, ₽">'+m2(c.received)+'</td>'
        +'<td class="n f6r" data-l="Остаток, ₽">'+(c.left<=0?'<span class="ch ok">оплачен</span>':m2(c.left))+'</td>'
        +(wr()?'<td class="f6w">'+btn('data-f6act="'+c.id+'"','i-doc','Акты','sm','Акты заказа')+'</td>':'')+'</tr>';
    }).join('')+'</tbody></table></div></div>';
}
function ddsHTML(){
  var r=F.rep; if(!r)return UI.loading(4);
  var b=r.bank||[], bad=b.filter(function(x){return Math.abs(x.diff)>=0.005})[0];
  var chk=!b.length?'':!bad?'<div class="dl ok" title="Совпадает с остатком в выписке банка">'+ic('i-ok')+'как в банке</div>'
    :'<div class="dl x" title="Остаток по операциям не совпадает с остатком в выписке. Похоже, загружены не все дни.">'
      +ic('i-warn')+'банк '+m2(bad.bank)+' · '+sg(bad.diff)+'</div>';
  var h='<div class="kp f6kp">'
    +'<div class="k"><div class="lb">На начало</div><div class="vl n">'+m2(r.opening)+' <small>₽</small></div><div class="dl hint">01.'+r.month.slice(5,7)+'</div></div>'
    +'<div class="k'+(bad?' f6x':'')+'"><div class="lb">На конец</div><div class="vl n">'+m2(r.closing)+' <small>₽</small></div>'+chk+'</div></div>';
  var rows=[];
  ['in','out'].forEach(function(k){
    r[k].groups.forEach(function(g){rows.push(group(g,k));});
  });
  h+='<div class="cd f6g">';
  if(!rows.length)return h+UI.empty({icon:'i-chart',title:'Операций нет'})+'</div>';
  return h+rows.join('')+'<div class="ftot"><span>За месяц</span><span class="n">'+sg(r.closing-r.opening)+'</span></div></div>';
}
// Строки с разбивкой раскрываются до групп и статей; прибыль — итоговые.
function pnlHTML(){
  var r=F.pnl; if(!r)return UI.loading(6);
  if(!r.rows.some(function(x){return x.total}))return '<div class="cd">'+UI.empty({icon:'i-rep',title:'Операций нет'})+'</div>';
  var mh=function(m){var y=m.slice(0,4);return MON[+m.slice(5,7)-1].slice(0,3)+(+y!==new Date().getFullYear()?' '+y.slice(2):'')};
  return '<div class="rptwrap f6pl"><table class="rpt"><thead><tr><th class="nm">ОПиУ</th>'
    +r.months.map(function(m){return '<th class="money">'+mh(m)+'</th>'}).join('')
    +'<th class="money">Итого</th></tr></thead><tbody>'
    +r.rows.map(function(x){return pnlRow(x,'',0,x.key==='margin')}).join('')+'</tbody></table></div>';
}
function pnlRow(x,up,d,pct){
  var key=up+x.key, can=x.items.length>0, on=can&&F.popen[key];
  var fm=function(v){
    if(v===null)return '—';
    if(pct)return v.toLocaleString('ru-RU',{maximumFractionDigits:2})+' %';
    return v?'<span'+(v<0?' class="neg"':'')+'>'+(v<0?'−':'')+m2(v)+'</span>':'<span class="hint">—</span>';};
  var cls=(can?'g':'')+(on?' op':'')+(/profit$/.test(x.key)?' tot':'');
  return '<tr'+(cls.trim()?' class="'+cls.trim()+'"':'')+(can?' data-f6pr="'+esc(key)+'"':'')+'>'
    +'<td class="nm'+(d?' d'+d:'')+'">'+(can?'<svg class="i chv"><use href="#i-right"/></svg>':'')+esc(x.name)+'</td>'
    +x.values.map(function(v){return '<td class="money">'+fm(v)+'</td>'}).join('')
    +'<td class="money">'+fm(x.total)+'</td></tr>'
    +(on?x.items.map(function(i){return pnlRow(i,key+'/',d+1,false)}).join(''):'');
}
function group(g,k){
  var sign=k==='in'?g.total:-g.total, cls=k==='in'?' in':'';
  if(g.id===null)return '<div class="acc"><div class="acch none" data-f6="gonone" title="Разнести">'
    +'<div class="nm"><b>'+esc(g.name)+'</b></div><span class="rt n">'+sg(sign)+'</span>'+ic('i-right')+'</div></div>';
  if(!g.items.length)return '<div class="acc"><div class="acch flat"><div class="nm"><b>'+esc(g.name)+'</b></div>'
    +'<span class="rt n'+cls+'">'+sg(sign)+'</span><span class="gap15"></span></div></div>';
  var key=k+g.id;
  return '<div class="acc'+(F.gopen[key]?' op':'')+'" data-f6g="'+key+'"><div class="acch"><div class="nm"><b>'+esc(g.name)+'</b></div>'
    +'<span class="rt n'+cls+'">'+sg(sign)+'</span><svg class="i chv"><use href="#i-down"/></svg></div><div class="accb">'
    +g.items.map(function(i){
      return '<div class="f6ar"><span class="t">'+esc(i.name)+'</span><span class="n">'+sg(k==='in'?i.total:-i.total)+'</span></div>';
    }).join('')+'</div></div>';
}
function paintTabs(){
  var v=document.getElementById('financeView'), t=v&&v.querySelector('.f6bar');
  if(t)t.outerHTML=tabs();
}
function paint(){
  var v=ensureView(), s=F.sum;
  var last=s&&s.last_statement;
  var h='<div class="ph"><div><h1>Финансы</h1>'
    +(last?'<p title="Последняя выписка">Точка · по '+dd(last.date_to)+'</p>':'')+'</div></div>';
  if(F.loadErr)h+=UI.error({title:'Не загрузилось',text:F.loadErr,act:'f6retry'});
  else if(!s)h+=UI.loading(6);
  else if(!s.months.length&&!F.busy){
    h+=errHTML()+'<div class="cd" id="f6drop">'+UI.empty(Object.assign({icon:'i-imp',title:'Выписок нет',
      text:'Выписка Точки в формате 1С, .txt'},wr()?{act:'f6load',btn:'Загрузить выписку',btnIcon:'i-imp'}:{}))+'</div>';
  } else {
    h+=tabs()+(F.tab==='ord'?ordHTML():F.tab==='dds'?ddsHTML():F.tab==='pnl'?pnlHTML():opsHTML());
  }
  v.innerHTML=h;
  if(wr())UI.dropzone(document.getElementById('f6drop'),upload);
}

// ── События ──────────────────────────────────────────────────────────────
function fileInput(){
  var i=document.getElementById('f6file');
  if(!i){i=document.createElement('input');i.type='file';i.id='f6file';i.accept='.txt';i.style.display='none';
    document.body.appendChild(i);
    i.addEventListener('change',function(){upload(i.files);i.value='';});}
  return i;
}
function act(a){
  var l=shown();
  if(a==='load'||a==='f6load'){fileInput().click();return;}
  if(a==='f6retry'){load();return;}
  if(a==='errx'){F.err='';paint();return;}
  if(a==='fnone'){F.fNone=!F.fNone;F.fAuto=false;F.sel={};F.ops=null;loadTab();return;}
  if(a==='fauto'){F.fAuto=!F.fAuto;F.sel={};paint();return;}
  if(a==='selall'){l.forEach(function(o){F.sel[o.id]=1});paint();return;}
  if(a==='selx'){F.sel={};paint();return;}
  if(a==='all'){var on=!l.every(function(o){return F.sel[o.id]});F.sel={};
    if(on)l.forEach(function(o){F.sel[o.id]=1});paint();return;}
  if(a==='bulk'){var b=document.getElementById('f6bulk');
    if(!b||!b.value){toast('Выберите статью');return;}
    var ids=Object.keys(F.sel).map(Number), n=ids.length;
    assign(ids,+b.value,true).then(function(r){if(r){F.sel={};say('Статья назначена: '+n
      +(r.filled?' · подставлено ещё '+r.filled:''));paint();}});return;}
  if(a==='bulkok'){confirmOps(Object.keys(F.sel).map(Number)).then(function(){F.sel={};paint();});return;}
  if(a==='neword'){F.form=true;paint();var c=document.getElementById('f6c');if(c)c.focus();return;}
  if(a==='ordx'){F.form=false;paint();return;}
  if(a==='ordsave'){saveOrder();return;}
  if(a==='actx'){F.actFor=null;paint();return;}
  if(a==='actsave'){saveAct();return;}
  if(a==='gonone'){F.tab='ops';F.fNone=true;F.fAuto=false;F.ops=null;loadTab();}
}
document.addEventListener('click',function(e){
  var t=e.target; if(!t.closest||!t.closest('#financeView'))return;
  var x=t.closest('[data-f6],[data-act]');
  if(x&&x.closest('#financeView')){act(x.dataset.f6||x.dataset.act);return;}
  var tb=t.closest('[data-f6tab]');
  if(tb){F.tab=tb.dataset.f6tab;F.sel={};F.res=null;loadTab();return;}
  var m=t.closest('[data-f6m]');
  if(m){var ms=F.sum.months, i=ms.indexOf(F.month)+(+m.dataset.f6m);
    if(i>=0&&i<ms.length){F.month=ms[i];F[F.tab==='dds'?'rep':'ops']=null;loadTab();}return;}
  var pm=t.closest('[data-f6pm]');
  if(pm){F.pnlTo=addMon(F.pnlTo,+pm.dataset.f6pm);F.pnl=null;loadTab();return;}
  var pr=t.closest('[data-f6pr]');
  if(pr){F.popen[pr.dataset.f6pr]=!F.popen[pr.dataset.f6pr];paint();return;}
  var ac=t.closest('[data-f6act]');
  if(ac){openActs(+ac.dataset.f6act);return;}
  var ad=t.closest('[data-f6actdel]');
  if(ad){delAct(+ad.dataset.f6actdel);return;}
  var ax=t.closest('[data-f6accx]');
  if(ax){setAccrual(+ax.dataset.f6accx,null);return;}
  var ok=t.closest('[data-f6ok]');
  if(ok){confirmOps([+ok.dataset.f6ok]);return;}
  var pk=t.closest('[data-f6pick]');
  if(pk){var id=+pk.dataset.f6pick; if(pk.checked)F.sel[id]=1; else delete F.sel[id]; paint();return;}
  var pp=t.closest('[data-f6p]');
  if(pp&&window.innerWidth>900){F.full[pp.dataset.f6p]=!F.full[pp.dataset.f6p];pp.classList.toggle('full');return;}
  // Раскрытие строки и группы переключает общий обработчик (kp-09) раньше
  // этого: здесь только запоминаем, чтобы перерисовка его не сбросила.
  var tr=t.closest('tr[data-op],tr[data-ord]');
  if(tr){var k=tr.dataset.op||'o'+tr.dataset.ord; F.open[k]=tr.classList.contains('op');}
  var g=t.closest('.acc[data-f6g]');
  if(g)F.gopen[g.dataset.f6g]=g.classList.contains('op');
});
document.addEventListener('change',function(e){
  var t=e.target; if(!t.closest||!t.closest('#financeView'))return;
  if(t.dataset.f6art){var id=+t.dataset.f6art;assign([id],t.value?+t.value:null);return;}
  if(t.dataset.f6ord){setOrder(+t.dataset.f6ord,t.value?+t.value:null);return;}
  if(t.dataset.f6acc&&t!==document.activeElement)saveAcc(t);
});
// Набор даты с клавиатуры шлёт change на каждый сегмент («0002-09-30»):
// поле в фокусе сохраняется, только когда его покидают.
function saveAcc(t){
  var id=+t.dataset.f6acc, v=t.value||null, o=F.ops.filter(function(x){return x.id===id})[0];
  if(!o||(o.accrual_date||null)===v)return;
  if(v&&v<'2000'){toast('Проверьте год');paint();return;}
  setAccrual(id,v);
}
document.addEventListener('focusout',function(e){
  var t=e.target; if(t.dataset&&t.dataset.f6acc&&t.closest('#financeView'))saveAcc(t);
});
document.addEventListener('input',function(e){
  var t=e.target; if(t.dataset&&t.dataset.f6acc)t.classList.toggle('blank',!t.value);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.f6acc)e.target.blur();
});

// ── Подключение раздела ──────────────────────────────────────────────────
try{ if(typeof SECT_SCOPE!=='undefined'&&SECT_SCOPE)SECT_SCOPE.finance='finance:read'; }catch(e){}
var _goFin=window.go;
window.go=function(v){
  if(v!=='finance'){
    var fv=document.getElementById('financeView'); if(fv)fv.style.display='none';
    return _goFin(v);
  }
  if(typeof drawer==='function'){try{drawer(false)}catch(e){}}
  if(window.fseTrack)fseTrack('view:finance');
  ensureView();
  if(typeof hideViewsExcept==='function')hideViewsExcept('financeView');
  document.getElementById('financeView').style.display='';
  document.querySelectorAll('.nav[data-go]').forEach(function(n){
    n.classList.toggle('act',n.dataset.go==='finance');});
  var on=document.getElementById('objname'); if(on)on.textContent='';
  paint(); load();
};
try{ if(typeof applyRoleNav==='function')applyRoleNav(); }catch(e){}
})();
