(function(){

// pending — введённые цены, ещё НЕ записанные в смету. Раньше apply() правил
// строки сразу, и «Отмена» ничего не отменяла: автосохранение конструктора
// успевало отправить правки на сервер. Теперь до «Готово» смета не меняется.
var MP={q:'',onlyEmpty:false,groups:[],pending:{}};

function nrm(s){return String(s==null?'':s).toLowerCase().replace(/\s+/g,' ').trim();}

// Ключ позиции: артикул, если он есть — это точное совпадение товара.
// Ручные строки артикула не имеют, для них ключ — название без учёта
// регистра и лишних пробелов. Название как ключ ненадёжно, поэтому оно
// используется только там, где другого признака просто нет.
function keyOf(r){
  var code=String(r.code||'').trim();
  return code ? 'a:'+nrm(code) : 'n:'+nrm(r.name);
}

function collect(){
  var live=((typeof rows!=='undefined'?rows:[])||[]).filter(function(r){
    return r && typeof r==='object' && r.type!=='section' && r.type!=='calc';});
  var by={};
  live.forEach(function(r){
    var k=keyOf(r);
    var g=by[k]||(by[k]={key:k,name:r.name||'—',code:String(r.code||'').trim(),
                         unit:r.unit||'шт',rows:[],qty:0,vals:{}});
    g.rows.push(r);
    g.qty+=(+r.qty||0);
    var v=+r.montazh||0; g.vals[v]=(g.vals[v]||0)+1;
  });
  return Object.keys(by).map(function(k){
    var g=by[k], vs=Object.keys(g.vals).map(Number);
    g.mixed = vs.length>1;
    g.value = vs.length===1 ? vs[0] : null;
    g.min=Math.min.apply(null,vs); g.max=Math.max.apply(null,vs);
    // Введённая, но ещё не сохранённая цена перебивает то, что лежит в смете:
    // счётчик «без цены» должен уменьшаться сразу, иначе непонятно, где ты был
    if(Object.prototype.hasOwnProperty.call(MP.pending,k)){
      g.value=MP.pending[k]; g.mixed=false; g.dirty=true;
    }
    g.empty = !g.mixed && !g.value;
    return g;
  }).sort(function(a,b){
    // Сначала то, что требует внимания: без цены, потом разнобой, потом остальное
    var w=function(x){return x.empty?0:(x.mixed?1:2);};
    return w(a)-w(b) || b.rows.length-a.rows.length || a.name.localeCompare(b.name,'ru');
  });
}

function money0(n){return (Math.round(+n||0)).toLocaleString('ru-RU');}

function mpRender(){
  MP.groups=collect();
  var q=nrm(MP.q);
  var list=MP.groups.filter(function(g){
    if(MP.onlyEmpty && !g.empty && !g.mixed) return false;
    if(!q) return true;
    return nrm(g.name).indexOf(q)>=0 || nrm(g.code).indexOf(q)>=0;
  });
  var noPrice=MP.groups.filter(function(g){return g.empty;}).length;
  var mixed=MP.groups.filter(function(g){return g.mixed;}).length;
  var strok=MP.groups.reduce(function(a,g){return a+g.rows.length;},0);

  document.getElementById('mpCount').innerHTML=
    '<b>'+MP.groups.length+'</b> позиций из '+strok+' строк'
    + (noPrice?' · <span style="color:var(--red)"><b>'+noPrice+'</b> без цены</span>':' · все с ценой')
    + (mixed?' · <b>'+mixed+'</b> с разными ценами':'');

  var box=document.getElementById('mpList');
  if(!list.length){box.innerHTML='<div class="sub" style="padding:16px">Ничего не найдено.</div>';return;}
  box.innerHTML=list.map(function(g){
    var val = g.mixed ? '' : (g.value||'');
    var hint = g.rows.length+' стр. · '+ (Math.round(g.qty*1000)/1000) +' '+esc(g.unit)
             + (g.code?(' · арт. '+esc(g.code)):'')
             + (g.mixed?(' · сейчас от '+money0(g.min)+' до '+money0(g.max)):'');
    return '<div class="mpr'+(g.empty?' empty':'')+(g.dirty?' dirty':'')+'">'
      +'<div class="mpn"><div class="t">'+esc(g.name)+'</div>'
      +'<div class="s">'+hint+(g.dirty?' · <b style="color:var(--ok,var(--grn))">новая цена</b>':'')+'</div></div>'
      +'<input class="p'+(g.mixed?' mixed':'')+'" inputmode="decimal" data-k="'+esc(g.key)+'" '
      +'value="'+val+'" placeholder="'+(g.mixed?'разные':'0')+'" aria-label="Цена монтажа">'
      +'</div>';
  }).join('');
}

// Запоминаем цену, но в смету не пишем — запись происходит по «Готово».
// Возвращаем, скольких строк это коснётся, чтобы человек видел масштаб.
function apply(key,raw){
  var g=MP.groups.filter(function(x){return x.key===key;})[0];
  if(!g)return false;
  var s=String(raw).replace(/\s/g,'').replace(',','.');
  if(s===''){ delete MP.pending[key]; return false; }
  var v=Number(s);
  if(!isFinite(v)||v<0){ if(window.toast)toast('Цена — положительное число'); return false; }
  MP.pending[key]=v;
  return g.rows.length;
}

// Единственное место, где меняется смета
function commit(){
  var groups=collect(), n=0, pos=0;
  groups.forEach(function(g){
    if(!Object.prototype.hasOwnProperty.call(MP.pending,g.key))return;
    var v=MP.pending[g.key]; pos++;
    g.rows.forEach(function(r){ if((+r.montazh||0)!==v){ r.montazh=v; n++; } });
  });
  return {rows:n,positions:pos};
}

function open(){
  if(!(typeof rows!=='undefined'?rows:[])||!(typeof rows!=='undefined'?rows:[]).length){ if(window.toast)toast('В спецификации нет позиций'); return; }
  document.getElementById('mpOv').classList.add('on');
  document.getElementById('mpBox').classList.add('on');
  MP.q=''; MP.onlyEmpty=false; MP.pending={};
  var f=document.getElementById('mpFind'); if(f)f.value='';
  var t=document.getElementById('mpOnly'); if(t)t.classList.remove('primary');
  var sv=document.getElementById('mpSaved'); if(sv)sv.textContent='';
  mpRender();
  // Цена попадает в правку по уходу с поля. Нажатие кнопки уводит фокус само,
  // а «Назад» — нет: без blur только что набранная цена потерялась бы.
  if(window.fseBack)fseBack.open('mprices',function(){
    var a=document.activeElement; if(a&&a.blur)a.blur();
    document.getElementById('mpDone').click();});
}
function close(save){
  var r={rows:0,positions:0};
  if(save) r=commit();                 // смета меняется только здесь
  MP.pending={};
  document.getElementById('mpOv').classList.remove('on');
  document.getElementById('mpBox').classList.remove('on');
  if(window.fseBack)fseBack.closed('mprices');
  if(save && r.rows){
    if(typeof render==='function')render();
    if(typeof saveCur==='function')saveCur();
  }
  return r;
}

document.addEventListener('DOMContentLoaded',mount);
if(document.readyState!=='loading')mount();
function mount(){
  if(document.getElementById('mpBox'))return;
  var ov=document.createElement('div'); ov.id='mpOv';
  var b=document.createElement('div'); b.id='mpBox';
  b.innerHTML=
    '<div class="mph"><div class="shtop">'
    +'<button class="btn sm io" id="mpBack" title="Готово — к смете">'
    +'<svg class="i"><use href="#i-left"/></svg><span class="lbl">К смете</span></button>'
    +'<h3>Цены монтажа</h3></div>'
    +'<div class="sub" id="mpCount" style="margin-bottom:8px"></div>'
    +'<div class="mpbar">'
    +'<input id="mpFind" type="search" placeholder="Найти позицию по названию или артикулу">'
    +'<button class="btn sm" id="mpOnly">Только без цены</button>'
    +'</div></div>'
    +'<div class="mplist" id="mpList"></div>'
    +'<div class="mpf">'
    +'<span class="s" id="mpSaved" style="flex:1"></span>'
    +'<button class="btn sm" id="mpCancel">Отмена</button>'
    +'<button class="btn primary sm" id="mpDone">Готово</button></div>';
  document.body.appendChild(ov); document.body.appendChild(b);

  // Клик мимо = «Готово»: терять уже введённые цены молча нельзя
  ov.addEventListener('click',function(){done();});
  document.getElementById('mpCancel').addEventListener('click',function(){
    var n=Object.keys(MP.pending).length;
    var drop=function(){close(false); if(window.toast&&n)toast('Изменения отменены');};
    if(!n)return drop();
    if(window.UI&&UI.confirm)UI.confirm({title:'Закрыть без сохранения?',
      text:'Введено цен: '+n+'. Они не сохранятся.',
      ok:'Закрыть без сохранения',okIcon:'i-x'}).then(function(y){if(y)drop();});
    else if(confirm('Введено цен: '+n+'. Закрыть без сохранения?'))drop();});
  document.getElementById('mpDone').addEventListener('click',done);
  // Выход вверху — там, где его ищут на весь экран; внизу он виден не сразу
  document.getElementById('mpBack').addEventListener('click',done);
  function done(){
    var r=close(true);
    if(window.toast)toast(r.rows
      ? ('Проставлено: позиций '+r.positions+', строк '+r.rows)
      : 'Ничего не изменилось');
  }
  document.getElementById('mpFind').addEventListener('input',function(e){MP.q=e.target.value;mpRender();});
  document.getElementById('mpOnly').addEventListener('click',function(e){
    MP.onlyEmpty=!MP.onlyEmpty; e.target.classList.toggle('primary',MP.onlyEmpty); mpRender();});

  // Правку принимаем по уходу с поля и по Enter — не на каждый набранный символ,
  // иначе «12» успело бы примениться раньше, чем человек дописал «1200».
  document.getElementById('mpList').addEventListener('change',function(e){
    var i=e.target.closest('input.p'); if(!i)return;
    var n=apply(i.dataset.k,i.value);
    var cnt=Object.keys(MP.pending).length;
    document.getElementById('mpSaved').textContent = cnt
      ? ('Введено цен: '+cnt+(n?(' · последняя ляжет на '+n+' строк'):'')+'. Сохранятся по «Готово»')
      : '';
    i.classList.remove('mixed'); mpRender();
  });
  document.getElementById('mpList').addEventListener('keydown',function(e){
    if(e.key!=='Enter')return;
    var i=e.target.closest('input.p'); if(!i)return;
    e.preventDefault(); i.blur();
    var all=[].slice.call(document.querySelectorAll('#mpList input.p'));
    var nx=all[all.indexOf(i)+1]; if(nx){nx.focus();nx.select();}
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&document.getElementById('mpBox').classList.contains('on'))close(true);});
}

document.addEventListener('click',function(ev){
  var el=ev.target.closest('[data-act="mprices"]'); if(!el)return;
  ev.preventDefault();
  // Массовое проставление цен — правка сметы. Без права открывать окно
  // бессмысленно: «Готово» ничего не сохранит, а выглядеть будет как сохранение.
  if(typeof canEdit==='function'&&!canEdit()){
    if(window.toast)toast('Только просмотр — цены монтажа изменить нельзя');return;}
  mount(); open();
});
})();
