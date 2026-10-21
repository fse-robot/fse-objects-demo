/* ── Блок 23. Учёт объектов внешней компании (#703) ────────────────────
   Партнёр со своей компанией ведёт здесь свои объекты
   вместо таблицы Excel: список, плитки итогов и карточка, поля которой
   разложены по блокам, как колонки его таблицы. Поля, подписи и списки
   выбора приходят с сервера (api/track.py, FIELDS) — экран своих не держит.

   У роли tracker это единственный раздел: всё остальное меню ей закрыто,
   как партнёру в блоке 14. Администратор видит тот же экран, где объекты
   всех таких компаний собраны вместе, и фильтр по компании над списком.

   Правка на месте: поле сохраняется, когда из него вышли. Узлы готовые —
   строка .speccard, плитки .k, блоки .acc, цепочка .chn, поля .fin
   (docs/guides/design-language.md). */
(function(){
if(window.__trackV1)return; window.__trackV1=true;

var API='/montazh/api';
var NB=' ';

function sess(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}}
function E(s){return (typeof esc==='function')?esc(s):String(s==null?'':s)
  .replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ic(n){return '<svg class="i"><use href="#'+n+'"/></svg>';}
function T(m,ms){if(typeof toast==='function')toast(m,ms);}
function rub(v){return (+v||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})
  .replace(/\s/g,NB);}
function dd(s){var m=/^(\d{4})-(\d\d)-(\d\d)/.exec(s||''); return m?m[3]+'.'+m[2]+'.'+m[1]:'';}
function ddShort(s){return dd(s).slice(0,5);}

async function api(path,opts){
  opts=opts||{};
  opts.headers=Object.assign({'X-FSE-Session':sess()},opts.headers||{});
  var r;
  try{r=await fetch(API+path,opts);}catch(e){throw new Error('Нет связи с сервером');}
  if(r.status===401&&typeof authExpired==='function'){authExpired();}
  var t=await r.text();
  var d=null; try{d=t?JSON.parse(t):null}catch(e){}
  if(!r.ok)throw new Error((d&&d.detail)||('Ошибка '+r.status));
  return d;
}
function post(path,body){return api(path,{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});}

/* ═══════════════════ СОСТОЯНИЕ ═══════════════════ */
// open — раскрытые блоки карточки. Карточка перерисовывается при переходах,
// и без памяти о них человек каждый раз раскрывал бы свой блок заново.
var S={list:undefined,err:'',schema:null,companies:[],all:false,co:'',
       oid:null,adding:false,note:'',open:{0:1,1:1}};

function view(){
  var v=document.getElementById('trackView');
  if(!v){v=document.createElement('div'); v.id='trackView'; v.style.display='none';
    (document.querySelector('.main')||document.querySelector('.wrap')||document.body).appendChild(v);}
  return v;
}
function fields(){return (S.schema&&S.schema.fields)||[];}
function field(k){return fields().filter(function(f){return f.key===k;})[0];}
function cur(){return (S.list||[]).filter(function(o){return o.id===S.oid;})[0];}
function shown(){
  return (S.list||[]).filter(function(o){return !S.co||String(o.company_id)===S.co;});
}
function label(o){return o.data.code||('№'+o.id);}

/* ═══════════════════ СПИСОК ═══════════════════ */
// Этап одной меткой: цвет говорит только «закончен» и «стоит», остальные
// этапы — обычная работа, и раскрашивать их по-разному было бы шумом.
function stageMark(s){
  if(!s)return '';
  var c=s==='Завершён'?' ok':(s==='Приостановлен'?' warn':' info');
  return '<span class="ch'+c+'">'+E(s)+'</span>';
}

function tiles(list){
  var tot=0, rest=0;
  list.forEach(function(o){tot+=+o.data.total||0; rest+=+o.data.rest||0;});
  function k(cls,icon,lab,val){
    return '<div class="k '+cls+'"><div class="r"><div class="ic">'+ic(icon)+'</div>'
      +'<div style="min-width:0"><div class="lb">'+lab+'</div>'
      +'<div class="vl n">'+val+'</div></div></div></div>';
  }
  return '<div class="kp">'
    +k('info','i-bld','Объектов',String(list.length))
    +k('acc','i-doc','По договорам',rub(tot)+' <small>₽</small>')
    +k(rest>0?'warn':'ok','i-rub','Остаток',rub(rest)+' <small>₽</small>')
    +'</div>';
}

function filter(){
  if(!S.all)return '';
  var seen={}, cos=[];
  S.companies.concat((S.list||[]).map(function(o){return {id:o.company_id,name:o.company};}))
    .forEach(function(c){if(!seen[c.id]){seen[c.id]=1; cos.push(c);}});
  if(cos.length<2)return '';
  return '<div class="bar" style="padding:0 0 12px"><select id="trkCo" title="Компания">'
    +'<option value="">Все компании</option>'
    +cos.map(function(c){return '<option value="'+c.id+'"'+(String(c.id)===S.co?' selected':'')+'>'
      +E(c.name||('Компания '+c.id))+'</option>';}).join('')
    +'</select></div>';
}

function list(){
  if(S.list===undefined)return UI.loading(4);
  if(S.err)return UI.error({title:'Не удалось загрузить объекты',text:S.err,
    act:'trk-reload',btn:'Повторить',primary:true});
  var l=shown();
  if(!l.length)return filter()+UI.empty({icon:'i-bld',title:'Объектов пока нет',
    act:'trk-add',btn:'Добавить объект'});
  return filter()+tiles(l)+modeBar()+(S.mode==='board'?board(l):rows(l));
}

// Вид списка запоминается в браузере: кто работает доской, тот открывает доску.
S.mode=(function(){try{return localStorage.getItem('trk_mode')||'rows'}catch(e){return 'rows'}})();
function modeBar(){
  function b(m,icon,lab){return '<button class="btn sm'+(S.mode===m?' on':'')+'" data-act="trk-mode" data-m="'+m
    +'" aria-pressed="'+(S.mode===m)+'" title="'+lab+'">'+ic(icon)+'<span class="lbl">'+lab+'</span></button>';}
  return '<div class="bar trkmode">'+b('rows','i-list','Списком')+b('board','i-tbl','По этапам')+'</div>';
}

// Доска: колонка на этап, в шапке — число объектов и сумма договоров.
// Карточку перетаскивают в другую колонку — так меняют этап.
function board(l){
  var st=((field('stage')||{}).options||[]).slice();
  if(l.some(function(o){return !o.data.stage;}))st.unshift('');
  return '<div class="trkb">'+st.map(function(s){
    var c=l.filter(function(o){return (o.data.stage||'')===s;}), tot=0;
    c.forEach(function(o){tot+=+o.data.total||0;});
    return '<div class="trkc'+(c.length?'':' empty')+'" data-stage="'+E(s)+'"><div class="trkch">'
      +'<b>'+E(s||'Без этапа')+'</b><span class="s n">'+c.length+(tot?' · '+rub(tot)+NB+'₽':'')+'</span></div>'
      +c.map(function(o){var d=o.data;
        return '<div class="trkk" draggable="true" data-act="trk-open" data-id="'+o.id+'">'
          +'<b>'+E(d.title)+'</b><div class="s">'+E([label(o)].concat(d.manager?[d.manager]:[]).join(' · '))+'</div>'
          +(d.rest!=null?'<div class="n" title="Остаток к оплате">'+rub(d.rest)+NB+'₽</div>':'')
          +(d.blocker?'<div class="sub">'+E(d.blocker)+'</div>':'')+'</div>';
      }).join('')+'</div>';
  }).join('')+'</div>';
}

function rows(l){
  return l.map(function(o){
    var d=o.data, who=[label(o)];
    if(S.all&&o.company)who.push(o.company);
    if(d.manager)who.push(d.manager);
    var paid=d.total!=null?'получено '+rub(d.paid||0)+' из '+rub(d.total):'';
    return '<div class="speccard" data-act="trk-open" data-id="'+o.id+'">'
      +'<div class="pnm"><b>'+E(d.title)+'</b><div class="s">'+E(who.join(' · '))+'</div>'
      +(d.blocker?'<div class="sub">'+E(d.blocker)+'</div>':'')+'</div>'
      +'<div class="crmr">'+stageMark(d.stage)
      +(d.rest!=null?'<b class="n" title="Остаток к оплате">'+rub(d.rest)+NB+'₽</b>':'')
      +(paid?'<div class="s n">'+paid+'</div>':'')+'</div></div>';
  }).join('');
}

/* ═══════════════════ КАРТОЧКА ═══════════════════ */
// Сводка в заголовке свёрнутого блока — то, ради чего его обычно открывают.
function summary(i,d){
  if(i===0)return E(d.manager||'');
  if(i===1)return d.rest!=null?'остаток '+rub(d.rest)+NB+'₽':'';
  if(i===2)return E(d.purchase?'закупка — '+d.purchase.toLowerCase():'');
  if(i===3)return d.mount_end?'до '+ddShort(d.mount_end):(d.mount_start?'с '+ddShort(d.mount_start):'');
  if(i===4)return E(d.pnr?'ПНР — '+d.pnr.toLowerCase():'');
  if(i===5)return d.handover_fact?'сдан '+ddShort(d.handover_fact)
    :(d.handover_plan?'план '+ddShort(d.handover_plan):'');
  return '';
}

// Цепочкой идут этапы по порядку; «Приостановлен» шагом не является —
// он встаёт меткой рядом и цепочку не сбрасывает.
function chain(stage){
  var st=(field('stage')||{}).options||[];
  var steps=st.filter(function(s){return s!=='Приостановлен';});
  var at=steps.indexOf(stage);
  return '<div class="chn" id="trkChain">'+steps.map(function(s,i){
      return '<span'+(i<at?' class="done"':(i===at?' class="on"':''))+'>'+E(s)+'</span>';
    }).join('')
    +(stage==='Приостановлен'?stageMark(stage):'')+'</div>';
}

function input(f,v){
  var a=' class="fin" data-tk="'+f.key+'" title="'+E(f.label)+'"';
  if(f.kind==='calc')
    return '<div class="vl n" data-calc="'+f.key+'">'
      +(v!=null?rub(v)+NB+'₽':'—')+'</div>';
  if(f.kind==='choice')
    return '<select'+a+'><option value="">—</option>'+f.options.map(function(o){
      return '<option'+(o===v?' selected':'')+'>'+E(o)+'</option>';}).join('')+'</select>';
  if(f.kind==='long')
    return '<textarea'+a+' rows="2" maxlength="2000" placeholder="—">'+E(v||'')+'</textarea>';
  if(f.kind==='date')
    return '<input type="date"'+a+' value="'+E(v||'')+'">';
  if(f.kind==='money')
    return '<input'+a+' inputmode="decimal" placeholder="—" value="'+(v!=null?rub(v):'')+'">';
  if(f.kind==='link')
    return '<div style="display:flex;gap:6px"><input type="url"'+a+' maxlength="500" placeholder="—" '
      +'value="'+E(v||'')+'">'+(v?'<a class="btn sm" href="'+E(v)+'" target="_blank" rel="noopener" '
      +'title="Открыть">'+ic('i-ext')+'</a>':'')+'</div>';
  return '<input'+a+' maxlength="300" placeholder="—" value="'+E(v||'')+'">';
}

// Длинные подписи таблицы партнёра сокращены до слова-двух; полностью
// подпись стоит в title поля.
var SHORT={blocker:'Что мешает',mounted:'Смонтировано',to_mount:'Осталось',
  remarks:'Замечания',folder:'Папка',act:'Акт сдачи'};

function card(){
  var o=cur();
  if(!o)return UI.error({title:'Объект не найден',text:'Его могли удалить',act:'trk-back',btn:'К объектам'});
  var d=o.data;
  var h='<div class="bar" style="padding:0 0 10px">'
    +'<button class="btn sm" data-act="trk-back" title="К списку объектов">'+ic('i-left')
    +'<span class="lbl">К объектам</span></button></div>'
    +'<div class="speccard trkh">'
    +'<span class="s">'+E(label(o))+(S.all&&o.company?' · '+E(o.company):'')+'</span>'
    +'<b>'+E(d.title)+'</b>'
    +chain(d.stage)+'</div>'+tabs(d);
  if(S.tab==='feed')return h+feed(d);
  if(S.tab==='clients')return h+clients(d);
  h+='<div class="cd">';
  (S.schema.blocks||[]).forEach(function(b,i){
    var body='<div class="fgrid">'+fields().filter(function(f){return f.block===i;}).map(function(f){
      var wide=f.kind==='long'||f.key==='title'||f.key==='address';
      return '<div class="fcell'+(wide?' wide':'')+'"><div class="flab" title="'+E(f.label)+'">'
        +E(SHORT[f.key]||f.label)+'</div>'+input(f,d[f.key])+'</div>';
    }).join('')+'</div>';
    h+='<div class="acc'+(S.open[i]?' op':'')+'" data-tb="'+i+'"><div class="acch">'
      +'<div class="nm"><b>'+E(b)+'</b></div>'
      +'<div class="rt" data-sum="'+i+'">'+summary(i,d)+'</div>'
      +'<svg class="i chv"><use href="#i-down"/></svg></div>'
      +'<div class="accb">'+body+'</div></div>';
  });
  h+='</div><div class="bar" style="padding:14px 0 0">'
    +'<button class="btn sm danger" data-act="trk-del" title="Удалить объект">'+ic('i-trash')
    +'<span class="lbl">Удалить</span></button></div>';
  return h;
}

// Три вкладки карточки: сам объект, лента примечаний, люди заказчика.
// Число на вкладке — сколько там записей, чтобы не открывать пустую.
S.tab='info';
function tabs(d){
  function t(k,icon,lab,n){return '<button class="tab'+(S.tab===k?' on':'')+'" data-act="trk-tab" data-t="'+k+'">'
    +ic(icon)+'<span class="lbl">'+lab+'</span>'+(n?' <span class="n">'+n+'</span>':'')+'</button>';}
  return '<div class="dl"><div class="tabs">'+t('info','i-bld','Объект')
    +t('feed','i-msg','Лента',(d.feed||[]).length)+t('clients','i-usrs','Клиенты',(d.clients||[]).length)+'</div></div>';
}

function when(s){var m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s||'');
  return m?m[3]+'.'+m[2]+'.'+m[1]+' '+m[4]+':'+m[5]:'';}

// Лента — новые сверху: открывают её, чтобы узнать, что случилось последним.
function feed(d){
  var l=(d.feed||[]).slice().reverse();
  return '<div class="cd trkf"><textarea class="fin" id="trkNote" rows="2" maxlength="2000" '
    +'placeholder="Примечание по объекту"></textarea><div class="bar" style="padding:8px 0 0">'
    +'<button class="btn primary sm" data-act="trk-note">'+ic('i-plus')+'<span class="lbl">Добавить</span></button></div></div>'
    +(l.length?l.map(function(e){
      return '<div class="cd trke"><div class="s">'+E(e.author||'')+' · '+when(e.at)+'</div>'
        +'<div>'+E(e.text)+'</div></div>';}).join('')
      :UI.empty({icon:'i-msg',title:'Записей пока нет'}));
}

var CF=[['name','ФИО'],['post','Должность'],['company','Юрлицо'],['phone','Телефон'],['email','Почта']];
function clients(d){
  var l=d.clients||[];
  return l.map(function(c,i){
    var acts=(c.phone?'<a class="btn sm" href="tel:'+E(c.phone.replace(/[^\d+]/g,''))+'" title="Позвонить">'
        +'<span class="lbl">Позвонить</span></a>':'')
      +(c.email?'<a class="btn sm" href="mailto:'+E(c.email)+'" title="Написать">'
        +'<span class="lbl">Написать</span></a>':'')
      +'<button class="btn sm danger" data-act="trk-cdel" data-i="'+i+'" title="Убрать клиента">'+ic('i-trash')+'</button>';
    return '<div class="cd trkcl"><div class="fgrid">'+CF.map(function(f){
        return '<div class="fcell'+(f[0]==='name'||f[0]==='company'?' wide':'')+'"><div class="flab">'+f[1]+'</div>'
          +'<input class="fin" data-cl="'+i+'" data-cf="'+f[0]+'" maxlength="300" placeholder="—"'
          +(f[0]==='phone'?' type="tel"':(f[0]==='email'?' type="email"':''))+' value="'+E(c[f[0]]||'')+'"></div>';
      }).join('')+'</div><div class="bar" style="padding:10px 0 0">'+acts+'</div></div>';
  }).join('')
    +(l.length?'':UI.empty({icon:'i-usrs',title:'Клиентов пока нет'}))
    +'<div class="bar" style="padding:4px 0 0"><button class="btn sm" data-act="trk-cadd">'+ic('i-plus')
    +'<span class="lbl">Добавить клиента</span></button></div>';
}

// Ленту и клиентов сервер хранит целым списком в том же jsonb объекта.
async function saveList(k,l,ok){
  var o=cur(); if(!o)return;
  var body={}; body[k]=l;
  try{put(await post('/track/objects/'+o.id,{data:body})); if(ok)T(ok,1500);}
  catch(e){T('Не сохранено: '+e.message,6000);}
}

function addForm(){
  var h='<div class="bar" style="padding:0 0 10px">'
    +'<button class="btn sm" data-act="trk-cancel" title="К списку объектов">'+ic('i-left')
    +'<span class="lbl">К объектам</span></button></div>'
    +'<div class="cd frm" style="padding:15px"><div class="sec">Добавить объект</div><div class="fgrid">'
    +'<div class="fcell"><div class="flab">ID</div>'
    +'<input class="fin" id="trkNewCode" maxlength="300" placeholder="ОБ-007"></div>'
    +'<div class="fcell wide"><div class="flab">Объект <i>*</i></div>'
    +'<input class="fin" id="trkNewTitle" maxlength="300"></div>';
  if(S.all)
    h+='<div class="fcell wide"><div class="flab">Компания <i>*</i></div><select class="fin" id="trkNewCo">'
      +'<option value="">—</option>'+S.companies.map(function(c){
        return '<option value="'+c.id+'"'+(String(c.id)===S.co?' selected':'')+'>'+E(c.name)+'</option>';
      }).join('')+'</select></div>';
  return h+'</div>'
    +(S.note?'<div class="fnote warn">'+E(S.note)+'</div>':'')
    +'<div class="bar" style="padding:14px 0 0">'
    +'<button class="btn primary" data-act="trk-create">'+ic('i-plus')+'<span class="lbl">Добавить</span></button>'
    +'<button class="btn" data-act="trk-cancel">Отмена</button></div></div>';
}

function render(){
  var v=view();
  var acts=(S.list&&!S.err&&!S.oid&&!S.adding)
    ?'<div class="acts"><button class="btn primary" data-act="trk-add" title="Добавить объект">'
      +ic('i-plus')+'<span class="lbl">Объект</span></button></div>':'';
  v.innerHTML='<div class="ph"><div><h1>Объекты</h1></div>'+acts+'</div>'
    +(S.adding?addForm():(S.oid?card():list()));
  // Доска открывается на первой колонке с объектами, а не на пустых этапах.
  var b=v.querySelector('.trkb'), c=b&&b.querySelector('.trkc:not(.empty)');
  if(c)b.scrollLeft=c.offsetLeft-b.offsetLeft-8;
}

async function load(){
  S.list=undefined; S.err=''; render();
  try{
    var d=await api('/track/objects');
    S.schema=d.schema; S.list=d.objects||[]; S.companies=d.companies||[]; S.all=!!d.all_companies;
  }catch(e){S.list=[]; S.err=e.message;}
  render();
}

function put(o){
  S.list=S.list.map(function(x){return x.id===o.id?o:x;});
  if(!S.list.some(function(x){return x.id===o.id;}))S.list.push(o);
}

/* Сохранение поля, из которого вышли. Карточку целиком не перерисовываем:
   человек уже перешёл к следующему полю, и перерисовка выбила бы из него
   курсор. Обновляется только то, что от поля зависит, — итоги, сводки
   блоков и цепочка этапов. */
async function save(el){
  var o=cur(); if(!o)return;
  var k=el.dataset.tk, f=field(k), old=o.data[k];
  var val=el.value.trim();
  if(k==='title'&&!val){T('Впишите объект'); el.value=old||''; return;}
  var body={}; body[k]=val||null;
  try{
    var n=await post('/track/objects/'+o.id,{data:body});
    put(n); T('Сохранено',1500);
    var d=n.data;
    if(f.kind==='money'&&document.activeElement!==el)el.value=d[k]!=null?rub(d[k]):'';
    if(f.kind==='date'||f.kind==='text')el.value=d[k]||'';
    var v=view();
    v.querySelectorAll('[data-calc]').forEach(function(c){
      var x=d[c.dataset.calc]; c.textContent=x!=null?rub(x)+NB+'₽':'—';});
    v.querySelectorAll('[data-sum]').forEach(function(s){s.innerHTML=summary(+s.dataset.sum,d);});
    if(k==='stage'){var c=document.getElementById('trkChain'); if(c)c.outerHTML=chain(d.stage);}
    if(k==='title'||k==='code'){var b=v.querySelector('.speccard b'); if(b)b.textContent=d.title;
      var s=v.querySelector('.speccard .s');
      if(s)s.textContent=label(n)+(S.all&&n.company?' · '+n.company:'');}
  }catch(e){
    // Отказ сервера возвращает поле к сохранённому: иначе на экране осталось
    // бы значение, которого в базе нет.
    T('Не сохранено: '+e.message,6000);
    el.value=f.kind==='money'?(old!=null?rub(old):''):(old||'');
  }
}

/* ═══════════════════ СОБЫТИЯ ═══════════════════ */
document.addEventListener('click',async function(ev){
  var h=ev.target.closest('#trackView .acc[data-tb] > .acch');
  // Раскрытие переключает общий обработчик kp-09; здесь — только запомнить.
  if(h){setTimeout(function(){var a=h.parentElement;
    if(a.classList.contains('op'))S.open[a.dataset.tb]=1; else delete S.open[a.dataset.tb];},0);}

  var el=ev.target.closest('#trackView [data-act]'); if(!el)return;
  var a=el.dataset.act;
  if(a==='trk-reload'){load(); return;}
  if(a==='trk-mode'){S.mode=el.dataset.m; try{localStorage.setItem('trk_mode',S.mode);}catch(e){} render(); return;}
  if(a==='trk-open'){S.oid=+el.dataset.id; S.tab='info'; render(); window.scrollTo(0,0); return;}
  if(a==='trk-tab'){S.tab=el.dataset.t; render(); return;}
  if(a==='trk-note'){
    var t=document.getElementById('trkNote'), txt=t.value.trim(); if(!txt){t.focus(); return;}
    var me=(window.ME&&ME.first_name)||'Демо', n=new Date(), p=function(x){return String(x).padStart(2,'0');};
    var at=n.getFullYear()+'-'+p(n.getMonth()+1)+'-'+p(n.getDate())+'T'+p(n.getHours())+':'+p(n.getMinutes())+':00';
    await saveList('feed',(cur().data.feed||[]).concat([{at:at,author:me,text:txt}]),'Добавлено');
    render(); return;}
  if(a==='trk-cadd'){
    await saveList('clients',(cur().data.clients||[]).concat([{}]));
    render(); var ins=view().querySelectorAll('[data-cf="name"]'); if(ins.length)ins[ins.length-1].focus(); return;}
  if(a==='trk-cdel'){
    var c=(cur().data.clients||[])[+el.dataset.i]||{};
    if(c.name&&!(await UI.confirm({title:'Убрать '+c.name+'?',text:'Контакт удалится из карточки объекта',
      ok:'Убрать',okIcon:'i-trash'})))return;
    await saveList('clients',(cur().data.clients||[]).filter(function(x,i){return i!==+el.dataset.i;}),'Убрано');
    render(); return;}
  if(a==='trk-back'){S.oid=null; render(); return;}
  if(a==='trk-add'){S.adding=true; S.note=''; render();
    var t=document.getElementById('trkNewTitle'); if(t)t.focus(); return;}
  if(a==='trk-cancel'){S.adding=false; S.note=''; render(); return;}

  if(a==='trk-create'){
    var code=document.getElementById('trkNewCode').value.trim();
    var title=document.getElementById('trkNewTitle').value.trim();
    var co=document.getElementById('trkNewCo');
    if(!title){S.note='Впишите объект'; render();
      document.getElementById('trkNewCode').value=code; return;}
    if(co&&!co.value){S.note='Выберите компанию'; render();
      document.getElementById('trkNewCode').value=code;
      document.getElementById('trkNewTitle').value=title; return;}
    el.disabled=true;
    try{
      var o=await post('/track/objects',{data:{code:code||null,title:title},
        company_id:co?+co.value:undefined});
      put(o); S.adding=false; S.note=''; S.oid=o.id; S.open={0:1,1:1};
      T('Объект добавлен'); render();
    }catch(e){
      S.note=e.message; render();
      document.getElementById('trkNewCode').value=code;
      document.getElementById('trkNewTitle').value=title;
      if(co)document.getElementById('trkNewCo').value=co.value;
    }
    return;}

  if(a==='trk-del'){
    var x=cur(); if(!x)return;
    var ok=await UI.confirm({title:'Удалить '+label(x)+'?',
      text:'Объект удаляется без истории — вернуть его нельзя',ok:'Удалить',okIcon:'i-trash'});
    if(!ok)return;
    try{await post('/track/objects/'+x.id+'/delete',{});
      S.list=S.list.filter(function(y){return y.id!==x.id;}); S.oid=null;
      T('Объект удалён'); render();}
    catch(e){T(e.message,6000);}
    return;}
});

var drag=null;
document.addEventListener('dragstart',function(ev){
  var k=ev.target.closest&&ev.target.closest('#trackView .trkk'); if(!k)return;
  drag=+k.dataset.id; ev.dataTransfer.effectAllowed='move'; ev.dataTransfer.setData('text/plain',String(drag));
});
document.addEventListener('dragover',function(ev){
  var c=drag&&ev.target.closest&&ev.target.closest('#trackView .trkc'); if(!c)return;
  ev.preventDefault();
  document.querySelectorAll('#trackView .trkc.drop').forEach(function(x){if(x!==c)x.classList.remove('drop');});
  c.classList.add('drop');
});
document.addEventListener('dragend',function(){drag=null;
  document.querySelectorAll('#trackView .trkc.drop').forEach(function(x){x.classList.remove('drop');});});
document.addEventListener('drop',async function(ev){
  var c=drag&&ev.target.closest&&ev.target.closest('#trackView .trkc'); if(!c)return;
  ev.preventDefault();
  var id=drag, s=c.dataset.stage, o=(S.list||[]).filter(function(x){return x.id===id;})[0];
  drag=null; if(!o||(o.data.stage||'')===s)return render();
  try{put(await post('/track/objects/'+id,{data:{stage:s||null}})); T('Этап: '+(s||'не задан'),1500);}
  catch(e){T('Не сохранено: '+e.message,6000);}
  render();
});

document.addEventListener('change',function(ev){
  var t=ev.target;
  if(t.id==='trkCo'){S.co=t.value; render(); return;}
  if(t.dataset&&t.dataset.cf&&t.closest('#trackView')){
    var l=(cur().data.clients||[]).map(function(x){return Object.assign({},x);});
    l[+t.dataset.cl][t.dataset.cf]=t.value.trim(); saveList('clients',l,'Сохранено'); return;}
  if(t.closest&&t.closest('#trackView [data-tk]'))save(t);
});

/* ═══════════════════ РАЗДЕЛ В МЕНЮ ═══════════════════ */
// track:use есть ещё только у администратора, и запирать его в одном разделе
// нельзя. Узнаём его по праву, а не по имени роли: переключатель «смотреть
// как» меняет роль в браузере, но не права.
function isTracker(){return can('track:use')&&!can('users:manage');}

var _sect=window.sectAllowed;
window.sectAllowed=function(v){
  if(isTracker())return v==='track';
  if(v==='track')return can('track:use');
  return typeof _sect==='function'?_sect(v):true;
};
var _rd=window.roleDefault;
window.roleDefault=function(r){
  if(isTracker())return 'track';
  return typeof _rd==='function'?_rd(r):'specs';
};
// Пункты «скоро» и заголовки пустых групп обещают партнёру разделы, которых
// у него не будет: в меню остаётся одна группа с «Объектами».
function sideForTracker(){
  var t=isTracker(), keep;
  ['soonT','soonL'].forEach(function(id){var n=document.getElementById(id);
    if(n)n.style.display=t?'none':'';});
  document.querySelectorAll('.side .dh').forEach(function(h){
    if(h.id==='soonT')return;
    for(var n=h.nextElementSibling,has=false;n&&!n.classList.contains('dh');n=n.nextElementSibling)
      if(n.dataset.go==='track')has=true;
    keep=!t||has; h.style.display=keep?'':'none';
  });
}
var _go=window.go;
window.go=function(v){
  var el=document.getElementById('trackView');
  // Логотип в шапке уводит на Обзор мимо меню — спрятать пункт мало.
  if(isTracker()&&v!=='track')v='track';
  if(v!=='track'){if(el)el.style.display='none'; return _go(v);}
  if(!can('track:use')){T('Раздел «Объекты» вам не выдан'); return;}
  sideForTracker();
  if(typeof drawer==='function'){try{drawer(false)}catch(e){}}
  if(window.fseTrack)fseTrack('view:track');
  document.querySelectorAll('.nav[data-go]').forEach(function(n){
    n.classList.toggle('act',n.dataset.go==='track');});
  view();
  hideViewsExcept('trackView');
  document.getElementById('trackView').style.display='';
  var on=document.getElementById('objname'); if(on)on.textContent='Объекты';
  render();
  if(S.list===undefined)load();
};

// ГОНКА: applyRoleNav мог отработать по ответу /auth/me ДО того, как этот
// блок подменил sectAllowed. Та же страховка, что в блоке 14.
try{if(typeof applyRoleNav==='function')applyRoleNav();}catch(e){}
setTimeout(function(){try{if(typeof applyRoleNav==='function')applyRoleNav();}catch(e){}},1500);
})();
