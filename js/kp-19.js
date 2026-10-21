/* ═══════════════════════════════════════════════════════════════════════════
   kp-19.js — «Переосвидетельствование» (#599).

   Калькулятор таблицы «КП Переосвид-е»: до четырёх видов ГОТВ, монтаж
   и НДС. Строки и итог считает сервер (POST /deal-docs/recert/calc) —
   формулы и цены живут в одном месте, recert_calc.py; здесь только форма.
   Из неё же создаётся КП по шаблону «КП-FSE-Переосвид».
   Закупку и маржу сервер присылает только тем, кому они положены (#661).
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
if(window.__recertV1)return; window.__recertV1=true;

// Тот же список, что GOTV в recert_calc.py; чужое имя сервер отклонит с подсказкой.
var GOTV=['Хладон 125','Хладон 227','Фторкетон','Novec1230','Syneco1230','Хладон 23',
  'СО2 Углекислота','Инерген'];
var MAX=4;
// Объёмы модулей с ценой Пожтехники — те же, что BRANDS в recert_calc.py.
var BRANDS={'Minimax':['13,4 л','67,5 л','80 л','140 л']};
var FIELDS=[['modules','Кол-во МГП',1],['recharge','Перезарядить МГП',1],
  ['kg','ГОТВ в одном МГП, кг',0.1],['weight','Вес модуля, кг',0.1],
  ['gauges','Манометры и весовые устройства',1],['directions','Направления',1]];
function blank(){return {gotv:'',brand:'',volume:'',modules:'',recharge:'',kg:'',weight:'',gauges:'',directions:''};}
var R={customer:'',object:'',kinds:[blank()],mount:false,vat:true,res:null,err:'',seq:0};

function E(v){return esc(v)}
function money(x){return Number(x||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})}

function ensureView(){
  var v=document.getElementById('recertView');
  if(!v){v=document.createElement('div');v.id='recertView';v.style.display='none';
    (document.querySelector('.main')||document.body).appendChild(v);}
  return v;
}

function opts(list,cur,none){
  return '<option value="">'+none+'</option>'
    +list.map(function(g){return '<option'+(g===cur?' selected':'')+'>'+E(g)+'</option>'}).join('');
}

function kindCard(k,i){
  return '<div class="cd" style="margin-bottom:14px"><div class="cdh"><h2>Вид ГОТВ '+(i+1)+'</h2>'
    +(R.kinds.length>1?'<button class="btn sm io" data-rc="del" data-i="'+i+'" title="Убрать вид ГОТВ" style="margin-left:auto">'
      +'<svg class="i"><use href="#i-x"/></svg><span class="lbl">Убрать</span></button>':'')
    +'</div><div class="pd pd0"><div class="fgrid">'
    +'<div class="fcell wide"><div class="flab">ГОТВ</div><select class="fin" data-k="gotv" data-i="'+i+'">'
    +opts(GOTV,k.gotv,'Выберите')+'</select></div>'
    +'<div class="fcell"><div class="flab">Производитель модулей</div><select class="fin" data-k="brand" data-i="'+i+'">'
    +opts(Object.keys(BRANDS),k.brand,'Не указан')+'</select></div>'
    +(k.brand?'<div class="fcell"><div class="flab">Объём модуля</div><select class="fin" data-k="volume" data-i="'+i+'">'
      +opts(BRANDS[k.brand],k.volume,'Выберите')+'</select></div>':'')
    +FIELDS.map(function(f){
      return '<div class="fcell"><div class="flab">'+f[1]+'</div><input class="fin n" type="number" min="0" step="'+f[2]+'"'
        +' inputmode="decimal" data-k="'+f[0]+'" data-i="'+i+'" value="'+E(k[f[0]])+'"></div>';}).join('')
    +'</div></div></div>';
}

function result(){
  if(R.err)return '<div class="errbox">'+E(R.err)+'</div>';
  if(!R.res)return '<div class="it"><span class="tx">Заполните кол-во МГП и вид ГОТВ — расчёт появится здесь</span></div>';
  var r=R.res;
  var lvl=function(p){return typeof mgLevel==='function'?' mg '+mgLevel(p):''};
  return r.lines.map(function(l){
      return '<div class="it"><div><div class="tx">'+E(l.name)+'</div>'
        +(l.margin!=null?'<div class="sb"><span class="n">закупка '+money(l.cost)+'</span> · <span class="n">маржа '+money(l.margin)
          +'</span>'+(l.sum?' · <span class="n">'+Math.round(l.margin/l.sum*1000)/10+'%</span>':'')+'</div>':'')
        +'</div><span class="wh n">'+money(l.sum)+'</span></div>';}).join('')
    +'<div class="it"><b class="tx">Итого, ₽</b><b class="wh n">'+money(r.total)+'</b></div>'
    +(r.margin!=null?'<div class="it"><div><div class="tx">Маржа</div>'
      +'<div class="sb n">закупка '+money(r.cost)+'</div></div>'
      +'<span class="wh n'+lvl(r.margin_pct)+'">'+money(r.margin)+' · '+r.margin_pct+'%</span></div>':'')
    +'<div class="it"><span class="tx">'+(r.vp?'В т.ч. НДС '+r.vp+'%':'Без НДС')+'</span>'
    +'<span class="wh n">'+(r.vp?money(r.vat):'')+'</span></div>';
}

function render(){
  var v=ensureView();
  v.innerHTML='<div class="ph"><div><h1>Переосвидетельствование</h1>'
    +'<p>Модули газового пожаротушения: расчёт и КП</p></div></div>'
    +'<div class="g2"><div>'
    +'<div class="cd" style="margin-bottom:14px"><div class="pd"><div class="fgrid">'
    +'<div class="fcell wide"><div class="flab">Заказчик</div><input class="fin" id="rcCust" maxlength="200" value="'+E(R.customer)+'"></div>'
    +'<div class="fcell wide"><div class="flab">Объект</div><input class="fin" id="rcObj" maxlength="300" value="'+E(R.object)+'"></div>'
    +'</div></div></div>'
    +R.kinds.map(kindCard).join('')
    +(R.kinds.length<MAX?'<button class="btn" data-rc="add" style="margin-bottom:14px"><svg class="i"><use href="#i-plus"/></svg><span class="lbl">Вид ГОТВ</span></button>':'')
    +'</div><div>'
    +'<div class="cd"><div class="pd">'
    +'<label class="optrow"><input type="checkbox" id="rcMount"'+(R.mount?' checked':'')+'><span>Нужен монтаж</span></label>'
    +'<label class="optrow"><input type="checkbox" id="rcVat"'+(R.vat?' checked':'')+'><span>Счёт с НДС</span></label>'
    +'</div><div id="rcRes">'+result()+'</div>'
    +'<div class="pd"><button class="btn primary" data-rc="kp"'+(R.res?'':' disabled')+'>'
    +'<svg class="i"><use href="#i-file"/></svg><span class="lbl">КП в Google</span></button> '
    +'<button class="btn" data-rc="letter"><svg class="i"><use href="#i-edit"/></svg><span class="lbl">Исх.письмо</span></button></div>'
    +'</div></div></div>';
}

// Ответ на устаревший запрос отбрасывается: пока он шёл, форму поправили.
var timer=null;
function recalc(){
  clearTimeout(timer);
  timer=setTimeout(async function(){
    var my=++R.seq;
    if(!R.kinds.some(function(k){return Number(k.modules)>0})){R.res=null;R.err='';return paint();}
    try{
      var r=await ledger('/deal-docs/recert/calc',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kinds:R.kinds,mount:R.mount,vat:R.vat})});
      if(my!==R.seq)return;
      R.res=r;R.err='';
    }catch(e){
      if(my!==R.seq)return;
      R.res=null;R.err=e.message||'Расчёт не удался';
    }
    paint();
  },350);
}
// Перерисовывается только итог: поле, в которое печатают, не теряет фокус.
function paint(){
  var b=document.getElementById('rcRes'); if(b)b.innerHTML=result();
  var k=document.querySelector('#recertView [data-rc="kp"]'); if(k)k.disabled=!R.res;
}

function kp(){
  if(typeof kpGoogle!=='function')return;
  kpGoogle({sub:'Переосвидетельствование',path:'/deal-docs/kp/recert',
    collect:function(){
      if(!R.customer.trim())return 'Укажите заказчика в форме расчёта';
      if(!R.res)return R.err||'Сначала заполните расчёт';
      return {customer:R.customer.trim(),object:R.object.trim(),kinds:R.kinds,mount:R.mount,vat:R.vat};}});
}

document.addEventListener('input',function(e){
  var t=e.target;
  if(!t.closest||!t.closest('#recertView'))return;
  if(t.id==='rcCust'){R.customer=t.value;return;}
  if(t.id==='rcObj'){R.object=t.value;return;}
  if(t.dataset.k){R.kinds[+t.dataset.i][t.dataset.k]=t.value;recalc();}
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(!t.closest||!t.closest('#recertView'))return;
  if(t.id==='rcMount'){R.mount=t.checked;recalc();}
  else if(t.id==='rcVat'){R.vat=t.checked;recalc();}
  else if(t.dataset.k==='gotv'||t.dataset.k==='volume'){R.kinds[+t.dataset.i][t.dataset.k]=t.value;recalc();}
  else if(t.dataset.k==='brand'){
    var k=R.kinds[+t.dataset.i]; k.brand=t.value; k.volume=''; render(); recalc();}
});
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('#recertView [data-rc]'); if(!b)return;
  var a=b.dataset.rc;
  if(a==='add'&&R.kinds.length<MAX){R.kinds.push(blank());render();}
  else if(a==='del'){R.kinds.splice(+b.dataset.i,1);render();recalc();}
  else if(a==='kp')kp();
  else if(a==='letter'&&typeof kpLetter==='function')
    kpLetter({sub:'Переосвидетельствование',org:R.customer.trim(),object:R.object.trim()});
});

// ── Подключение раздела ──────────────────────────────────────────────────
try{ if(typeof SECT_SCOPE!=='undefined'&&SECT_SCOPE)SECT_SCOPE.recert='spec:write'; }catch(e){}
var _goRecert=window.go;
window.go=function(v){
  if(v!=='recert'){
    var rv=document.getElementById('recertView'); if(rv)rv.style.display='none';
    return _goRecert(v);
  }
  if(typeof drawer==='function'){try{drawer(false)}catch(e){}}
  if(window.fseTrack)fseTrack('view:recert');
  ensureView();
  if(typeof hideViewsExcept==='function')hideViewsExcept('recertView');
  document.getElementById('recertView').style.display='';
  document.querySelectorAll('.nav[data-go]').forEach(function(n){
    n.classList.toggle('act',n.dataset.go==='recert');});
  var on=document.getElementById('objname'); if(on)on.textContent='';
  render();
};
try{ if(typeof applyRoleNav==='function')applyRoleNav(); }catch(e){}
})();
