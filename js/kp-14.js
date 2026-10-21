/* ── Блок 14. Кабинет партнёра-заказчика и выдача доступа (#63) ────────
   Два экрана под одну задачу — показать представителю заказчика его
   комнаты на объекте и ничего сверх них.

   Кабинет («Объект») — раздел партнёра, единственный, который у него есть.
   Только чтение: ни одной кнопки, меняющей состояние. Приёмку выполнения
   внутри системы делает наш куратор (#58) — партнёр на начисления
   не влияет.

   Выдача доступа — блок внутри карточки объекта в «Смене» → «Объекты»,
   рядом с куратором и исполнителями: там же, где задаётся всё остальное
   про объект. Право partner:manage, то есть директор.

   Ни одного своего узла и ни одного своего цвета: карточка-запись,
   таблица со сворачиванием на телефоне и метка состояния — готовые
   (docs/guides/design-language.md). */
(function(){
if(window.__partnerV1)return; window.__partnerV1=true;

var API='/montazh/api';
var NB=' ';

function sess(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}}
function E(s){return (typeof esc==='function')?esc(s):String(s==null?'':s)
  .replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ic(n){return '<svg class="i"><use href="#'+n+'"/></svg>';}
function T(m,ms){if(typeof toast==='function')toast(m,ms);}
function qs(n){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3})
  .format(+n||0).replace(/\s/g,NB);}
function rr(){if(typeof window.renderShift==='function')window.renderShift();}

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

/* ═══════════════════ КАБИНЕТ ПАРТНЁРА ═══════════════════ */
var P={list:undefined,hint:'',uid:null,card:undefined,err:''};

function pview(){
  var v=document.getElementById('partnerView');
  if(!v){v=document.createElement('div'); v.id='partnerView'; v.style.display='none';
    (document.querySelector('.main')||document.querySelector('.wrap')||document.body).appendChild(v);}
  return v;
}

/* Состояние позиции одним словом. Три величины ради одной метки читаются
   дольше, чем метка: партнёр смотрит «готово или нет», а не арифметику.

   «На проверке» идёт первым: пока хоть часть ждёт куратора, называть
   позицию принятой рано — принимает её наш куратор, а не партнёр (#58). */
function mark(r){
  var c,t;
  if(r.qty_pending>0){c='';t='на проверке';}
  else if(r.qty_done>0&&r.qty_remaining<=0){c=' ok';t='принято';}
  else if(r.qty_done>0){c='';t='частично';}
  else {c=' off';t='не начато';}
  return '<span class="badge'+c+'">'+E(t)+'</span>';
}

function plist(){
  if(P.list===undefined)return UI.loading(3);
  if(P.err)return UI.error({title:'Не удалось загрузить объекты',text:P.err,
    act:'pa-reload',btn:'Повторить',primary:true});
  if(!P.list.length)return UI.empty({icon:'i-bld',title:'Объектов пока нет',text:P.hint});
  return P.list.map(function(o){
    return '<div class="speccard" data-act="pa-open" data-uid="'+E(o.uid)+'" style="cursor:pointer">'
      +'<div style="display:flex;gap:9px;align-items:baseline">'
      +'<b style="flex:1;min-width:0">'+E(o.name)+'</b>'
      +'<span class="s n">'+o.done+' / '+o.positions+'</span></div>'
      +'<div class="sub">'+o.sections+' '+plural(o.sections,'раздел','раздела','разделов')
      +' · принято позиций '+o.done+' из '+o.positions+'</div></div>';
  }).join('');
}
function plural(n,a,b,c){
  n=Math.abs(n)%100; var d=n%10;
  if(n>10&&n<20)return c;
  if(d>1&&d<5)return b;
  if(d===1)return a;
  return c;
}

function pcard(){
  if(P.card===undefined)return UI.loading(4);
  if(P.card===null)return UI.error({title:'Не удалось открыть объект',text:P.err,act:'pa-open',
    btn:'Повторить'});
  var h='<div class="bar" style="padding:0 0 10px">'
    +'<button class="btn sm" data-act="pa-back" title="К списку объектов">'+ic('i-left')
    +'<span class="lbl">К объектам</span></button></div>';
  if(!P.card.sections.length)
    return h+UI.empty({icon:'i-fold',title:'Разделов не видно',
      text:'Доступ выдан, но разделы объекта в нём не указаны — обратитесь в компанию-подрядчика'});
  h+=P.card.sections.map(function(s){
    return '<div class="k" style="margin-bottom:12px">'
      +'<div style="display:flex;gap:9px;align-items:baseline;margin-bottom:8px">'
      +'<b style="flex:1;min-width:0">'+E(s.title)+'</b>'
      +'<span class="s">'+s.positions.length+'</span></div>'
      +'<div class="xscroll"><table><thead><tr><th>Позиция</th>'
      +'<th style="text-align:right">По смете</th>'
      +'<th style="text-align:right">Принято</th><th>Состояние</th></tr></thead><tbody>'
      +s.positions.map(function(r){
          return '<tr><td data-l="Позиция">'+E(r.name)+'</td>'
            +'<td data-l="По смете" class="n" style="text-align:right">'+qs(r.qty_plan)+NB+E(r.unit)+'</td>'
            +'<td data-l="Принято" class="n" style="text-align:right">'+qs(r.qty_done)+NB+E(r.unit)+'</td>'
            +'<td data-l="Состояние">'+mark(r)+'</td></tr>';
        }).join('')
      +'</tbody></table></div></div>';
  }).join('');
  return h;
}

function prender(){
  var v=pview();
  v.innerHTML='<div class="ph"><div><h1>Ваш объект</h1>'
    +'<p>Позиции ваших разделов и что из них принято. Только просмотр: '
    +'выполнение подтверждает куратор объекта со стороны подрядчика</p></div></div>'
    +(P.uid?pcard():plist());
}

async function pload(){
  P.list=undefined; P.err=''; prender();
  try{var d=await api('/partner/objects'); P.list=d.objects||[]; P.hint=d.hint||'';}
  catch(e){P.list=[]; P.err=e.message;}
  prender();
  // Один объект — открываем сразу: список из одной записи это лишний тап
  // на телефоне, а у партнёра объект почти всегда один.
  if(P.list.length===1&&!P.uid)popen(P.list[0].uid);
}

async function popen(uid){
  P.uid=uid; P.card=undefined; P.err=''; prender();
  try{P.card=await api('/partner/objects/'+encodeURIComponent(uid));}
  catch(e){P.card=null; P.err=e.message;}
  prender();
}

/* ═══════════════════ ВЫДАЧА ДОСТУПА ═══════════════════ */
// draft — то, что человек уже вписал. Раздел перерисовывается целиком на
// каждое действие, и без черновика отказ сервера стирал бы набранное:
// тот же приём, что у разнесения по юрлицам в kp-03.
var G={uid:null,sections:null,grants:null,pick:{},draft:{tid:'',note:''},
       err:'',note:'',open:false};

function grantBlock(uid){
  if(String(G.uid)!==String(uid))
    return '<div class="s" style="margin:14px 0 5px">Доступ партнёра</div>'
      +'<div class="sub" style="padding:4px 0">Загрузка доступов…</div>';
  var h='<div class="s" style="margin:14px 0 5px">Доступ партнёра — просмотр своих разделов</div>'
    +(G.err?'<div class="fnote warn" data-note="pa">'+E(G.err)+'</div>':'');
  if(G.grants===null)return h+'<div class="sub" style="padding:4px 0">Не удалось загрузить.</div>';
  var live=G.grants.filter(function(x){return !x.revoked_at;});
  h+=live.length?live.map(function(g){
      return '<div class="speccard" style="display:block;margin:0 0 8px">'
        +'<div style="display:flex;gap:8px;align-items:baseline">'
        +'<b style="flex:1;min-width:0">'+E(g.person)+'</b>'
        +'<span class="s">'+g.sections.length+' '
        +plural(g.sections.length,'раздел','раздела','разделов')+'</span></div>'
        +(g.note?'<div class="s">'+E(g.note)+'</div>':'')
        +'<div class="s" style="margin-top:4px">'+E((g.section_titles||[]).join(' · '))+'</div>'
        +'<div class="bar" style="margin-top:8px">'
        +'<button class="btn sm danger" data-act="pa-revoke" data-id="'+g.id+'" '
        +'data-uid="'+E(uid)+'">Отозвать</button></div></div>';
    }).join('')
    :'<div class="sub" style="padding:4px 0">Доступ никому не выдан.</div>';

  if(!G.open)
    return h+'<div class="bar" style="margin:0 0 14px">'
      +'<button class="btn sm" data-act="pa-form" data-uid="'+E(uid)+'">Выдать доступ</button></div>';

  var secs=G.sections||[];
  h+='<div class="empbox" style="margin:8px 0 14px;background:var(--card)">';
  if(!secs.length){
    h+='<div class="s">Смета объекта не разбита на разделы, и выдавать нечего. '
      +'Разделы — это комнаты: заведите их в смете, тогда партнёру можно будет '
      +'открыть его часть, а не объект целиком.</div>';
  }else{
    h+='<div class="s" style="margin-bottom:5px">Телеграм-идентификатор партнёра</div>'
      +'<div class="bar" style="margin:0 0 8px">'
      +'<input class="inp" id="pa_tid" inputmode="numeric" placeholder="например, 123456789" '
      +'value="'+E(G.draft.tid)+'" style="flex:1;min-width:150px"></div>'
      +'<div class="s" style="margin-bottom:5px">Кто это — компания и должность</div>'
      +'<div class="bar" style="margin:0 0 8px">'
      +'<input class="inp" id="pa_note" maxlength="200" value="'+E(G.draft.note)+'" '
      +'placeholder="например, Нонфаир, руководитель проекта" style="flex:1;min-width:180px"></div>'
      +'<div class="s" style="margin-bottom:5px">Его разделы</div>'
      +secs.map(function(s){
          return '<label class="bar" style="margin:0 0 4px;gap:8px;cursor:pointer">'
            +'<input type="checkbox" class="pick" data-sec="'+E(s.id)+'"'
            +(G.pick[s.id]?' checked':'')+'>'
            +'<span class="s" style="flex:1">'+E(s.title)+'</span>'
            +'<span class="s">'+s.positions+'</span></label>';
        }).join('')
      +(G.note?('<div class="fnote warn" data-note="pa-form" style="margin:10px 0 0">'
        +E(G.note)+'</div>'):'')
      +'<div class="bar" style="margin:10px 0 0">'
      +'<button class="btn sm primary" data-act="pa-grant" data-uid="'+E(uid)+'">Выдать</button>'
      +'<button class="btn sm" data-act="pa-cancel">Отмена</button></div>';
  }
  return h+'</div>';
}

async function grantLoad(uid){
  G.uid=uid; G.sections=null; G.grants=null; G.pick={};
  G.draft={tid:'',note:''}; G.err=''; G.note=''; G.open=false;
  rr();
  try{
    var qp='?spec_uid='+encodeURIComponent(uid);
    G.sections=await api('/partner/sections'+qp);
    G.grants=await api('/partner/grants'+qp);
  }catch(e){G.err=e.message; if(G.grants===null)G.grants=[];}
  rr();
}

/* ═══════════════════ СОБЫТИЯ ═══════════════════ */
document.addEventListener('click',async function(ev){
  var el=ev.target.closest('[data-act]'); if(!el)return;
  var a=el.dataset.act;

  if(a==='pa-open'){popen(el.dataset.uid||P.uid); return;}
  if(a==='pa-reload'){pload(); return;}
  if(a==='pa-back'){P.uid=null; P.card=undefined; prender(); return;}

  if(a==='pa-form'){G.open=true; G.note=''; rr(); return;}
  if(a==='pa-cancel'){G.open=false; G.pick={}; G.draft={tid:'',note:''};
    G.err=''; G.note=''; rr(); return;}

  if(a==='pa-grant'){
    var tid=document.getElementById('pa_tid'), note=document.getElementById('pa_note');
    G.draft={tid:tid?tid.value.trim():'', note:note?note.value.trim():''};
    var picked=Object.keys(G.pick).filter(function(k){return G.pick[k];});
    if(!/^\d{5,}$/.test(G.draft.tid)){
      G.note='Впишите телеграм-идентификатор партнёра — только цифры'; rr(); return;}
    if(!picked.length){G.note='Отметьте разделы, которые ведёт партнёр'; rr(); return;}
    G.note=''; el.disabled=true;
    try{
      var res=await post('/partner/grants',{user_id:+G.draft.tid,
        spec_uid:el.dataset.uid, sections:picked, note:G.draft.note});
      T(res&&res.warning?res.warning:'Доступ выдан',res&&res.warning?9000:2500);
      grantLoad(el.dataset.uid);
    }catch(e){G.note=e.message; el.disabled=false; rr();}
    return;}

  if(a==='pa-revoke'){
    el.disabled=true;
    try{await post('/partner/grants/'+encodeURIComponent(el.dataset.id)+'/revoke',{});
      T('Доступ отозван'); grantLoad(el.dataset.uid);}
    catch(e){G.err=e.message; el.disabled=false; rr();}
    return;}
});

// Галочка раздела живёт в состоянии, а не в DOM: карточка объекта
// перерисовывается целиком на каждое действие, и отметки терялись бы.
document.addEventListener('change',function(ev){
  var cb=ev.target.closest('input[data-sec]'); if(!cb)return;
  G.pick[cb.dataset.sec]=cb.checked;
});

/* ═══════════════════ РАЗДЕЛ В МЕНЮ ═══════════════════ */
function isPartner(){return can('partner:portal');}

// Партнёр — человек со стороны, а не сотрудник с урезанными правами.
// «Обзор» и «Задачи» объявлены в SECT_SCOPE пустой строкой, то есть открыты
// любому вошедшему, — и партнёр видел бы их. Данных там нет, но и делать
// ему во внутреннем меню компании нечего. Так же закрыт кабинет заказчика ТО.
var _sect=window.sectAllowed;
window.sectAllowed=function(v){
  if(isPartner())return v==='partner';
  if(v==='partner')return false;
  return typeof _sect==='function'?_sect(v):true;
};
var _rd=window.roleDefault;
window.roleDefault=function(r){
  if(isPartner())return 'partner';
  return typeof _rd==='function'?_rd(r):'specs';
};
var _go=window.go;
window.go=function(v){
  var el=document.getElementById('partnerView');
  // Логотип в шапке уводит на Обзор мимо меню — спрятать пункт мало.
  if(isPartner()&&v!=='partner')v='partner';
  if(v!=='partner'){if(el)el.style.display='none'; return _go(v);}
  if(!isPartner()){T('Раздел «Объект» вам не выдан'); return;}
  if(typeof drawer==='function'){try{drawer(false)}catch(e){}}
  if(window.fseTrack)fseTrack('view:partner');
  document.querySelectorAll('.nav[data-go]').forEach(function(n){
    n.classList.toggle('act',n.dataset.go==='partner');});
  pview();
  hideViewsExcept('partnerView');
  document.getElementById('partnerView').style.display='';
  var on=document.getElementById('objname'); if(on)on.textContent='Ваш объект';
  prender();
  if(P.list===undefined)pload();
};

// ГОНКА: applyRoleNav мог отработать по ответу /auth/me ДО того, как этот
// блок подменил sectAllowed. Та же страховка, что в «Обслуживании».
try{if(typeof applyRoleNav==='function')applyRoleNav();}catch(e){}
setTimeout(function(){try{if(typeof applyRoleNav==='function')applyRoleNav();}catch(e){}},1500);

window.PARTNER={grantBlock:grantBlock,load:grantLoad};
})();
