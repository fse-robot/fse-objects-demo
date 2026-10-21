/* ── Блок 17. Сварка труб (#207) ───────────────────────────────────────
   Окно расчёта поверх сметы: участки трассы вводят здесь, а результат
   ложится в смету обычными строками работ.

   Четыре методики, и выбор между ними — решение сметчика по объекту,
   а не свойство программы. Две коммерческие считают по тарифу компании
   за сантиметр шва: цена стыка — длина окружности трубы, умноженная на
   тариф. Две нормативные считают по ГЭСНм 12-01-005: трудозатраты в
   человеко-часах на 100 м, умноженные на стоимость человеко-часа.
   Нормативные нужны там, где цену требуют обосновать официальной
   методикой. Отдельной нормы «сварка труб» в сборнике нет — 12-01-005
   нормирует монтаж трубопровода вместе со сваркой, и строка, которую
   кладёт нормативный расчёт, называется монтажом (ADR-0050).

   «По тоннам» отдельной сметной нормы не имеет: тоннаж переводится в
   длину через массу погонного метра и считается той же нормой. Сумма
   поэтому совпадает с расчётом по метру — меняется только единица, в
   которой цену показывают заказчику (ADR-0050).

   Тариф, стоимость человеко-часа и средняя длина трубы — поля ввода:
   они разные на разных объектах. Хранятся в строке настроек сметы
   рядом с процентами накладных, то есть уезжают на сервер вместе со
   сметой и переживают перезагрузку.

   Участки тоже хранятся в смете: калькулятор — её часть, а не
   одноразовый счётчик. Открытое второй раз окно показывает то, что
   считали в прошлый, и «Добавить в смету» правит прежние строки, а не
   плодит новые. */
(function(){
if(window.__weldV1)return; window.__weldV1=true;

/* ГЭСНм 12-01-005 «Трубопроводы в помещениях или на открытых площадках
   в пределах цехов», ФСНБ-2022: наружный диаметр (мм) и затраты труда
   рабочих (чел.-ч на 100 м). Позиции 01…17 идут в порядке диаметров. */
var GESN=[[14,131],[18,131],[25,141],[32,147],[38,174],[45,179],[57,190],
          [76,218],[89,221],[108,239],[133,300],[159,326],[219,354],
          [273,418],[325,457],[377,487],[426,530]];

/* Сортамент труб АУГПТ — то же, что в рабочем файле компании. Это ряд
   наружных диаметров, по которым собирают трассы, а не произвольная
   шкала: подсказка при вводе, а не ограничение. */
var DN=[21.3,22,25,26.9,28,30,31.8,32,33.7,35,38,40,42.4,44.5,45,48.3,50,51,
        54,57,60,60.3,63.5,68,70,73,76,82.5,83,89,95,102,104,108,114];

/* Плотность стали 7,85 г/см³ в формуле массы погонного метра трубы
   (ГОСТ 8732, ГОСТ 10704): m = π·(D−s)·s·ρ. */
var STEEL=0.02466;

var MODES={
  seam:{name:'По сварному шву',short:'По шву',norm:false,
        hint:'Тариф компании за сантиметр шва. Цена элемента — длина окружности трубы на число его стыков.'},
  meter:{name:'По метру и диаметру — коммерческий',short:'Метр · коммерч.',norm:false,
         hint:'Тот же тариф, пересчитанный на метр трассы через среднюю длину трубы.'},
  gesn:{name:'По метру и диаметру — нормативный',short:'Метр · норматив',norm:true,
        hint:'ГЭСНм 12-01-005, ФСНБ-2022. Норма покрывает монтаж трубопровода целиком, включая сварку: отдельной строкой монтаж труб после неё не ставят.'},
  ton:{name:'По тоннам',short:'Тонны',norm:true,
       hint:'Та же норма, показанная через массу труб. Производная величина, не самостоятельная расценка.'}};

/* Виды элементов режима «по шву» и число стыков у каждого. Второй
   диаметр есть там, где элемент соединяет разные трубы. */
var KINDS={
  joint:{name:'Стык',j1:1,j2:0},
  elbow:{name:'Отвод',j1:2,j2:0},
  tee:{name:'Тройник равнопроходной',j1:3,j2:0},
  teered:{name:'Тройник неравнопроходной',j1:2,j2:1},
  redu:{name:'Переход',j1:1,j2:1}};

var DEF={mode:'seam',seamPrice:300,pipeLen:2.5,manHour:600};
/* Условный проход → наружный диаметр, ГОСТ 3262 и ISO 4200. В спецификациях
   трубу называют и так и так: «Ду 50» и «Dn 57» — это разные величины при
   одинаковом виде записи. Сварка считается по наружному. */
var DU2DN={15:21.3,20:26.9,25:33.7,32:42.4,40:48.3,50:60.3,65:76,80:88.9,
           100:114,125:140,150:168.3,200:219,250:273,300:325};

/* Вид элемента по названию позиции. Порядок важен: «тройник переходной» —
   тройник, а не переход. */
var NAME_KINDS=[[/тройник/i,'tee'],[/переход|конус/i,'redu'],
                [/отвод|колено/i,'elbow'],[/муфт|стык(?!овоч)|сгон/i,'joint'],
                [/труб/i,'pipe']];
/* Крепёж называет трубу, для которой он, — «держатель для труб D110»,
   — но сам не варится. */
var NOT_WELDED=/держател|кронштейн|подвес|крепл|крепёж|крепеж/i;


function num(v){var n=Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.'));
  return isFinite(n)?n:0;}
function r2(n){return Math.round((+n||0)*100)/100;}
function r3(n){return Math.round((+n||0)*1000)/1000;}

/* ── настройки и участки живут в строке настроек сметы ── */

function cfg(){
  var c=(typeof calcRow==='function')?calcRow():null;
  var w=(c&&c.weld)||{};
  return {row:c,
    mode:MODES[w.mode]?w.mode:DEF.mode,
    seamPrice:w.seamPrice==null?DEF.seamPrice:num(w.seamPrice),
    pipeLen:w.pipeLen==null?DEF.pipeLen:num(w.pipeLen),
    manHour:w.manHour==null?DEF.manHour:num(w.manHour),
    split:!!w.split,
    tab:w.tab==='segs'?'segs':'spec',
    picks:w.picks&&typeof w.picks==='object'?w.picks:{},
    segs:Array.isArray(w.segs)?w.segs:[]};
}

function write(patch){
  if(typeof canEdit==='function'&&!canEdit())return false;
  var c=(typeof calcRow==='function')?calcRow():null;
  if(!c)return false;
  c.weld=Object.assign({},c.weld||{},patch);
  if(typeof saveCur==='function')saveCur();
  return true;
}

function mkSeg(){
  return {id:(typeof rid==='function'?rid():'w'+Math.random().toString(36).slice(2,9)),
          name:'',kind:'joint',d:57,d2:32,wall:3.5,len:10,qty:1};
}

/* ── расчёт ── */

/* Цена одного стыка: длина окружности трубы в сантиметрах на тариф. */
function jointPrice(d,seamPrice){return Math.PI*num(d)/10*num(seamPrice);}

/* Норма ГЭСНм по диаметру: ближайшая позиция не меньше фактического
   диаметра — труба 21,3 мм сваривается по позиции «25 мм». */
function gesnHours(d){
  var v=num(d);
  for(var i=0;i<GESN.length;i++)if(v<=GESN[i][0])
    return {d:GESN[i][0],hours:GESN[i][1],
            code:'12-01-005-'+(i+1<10?'0':'')+(i+1)};
  return null;
}

function massPerM(d,wall){
  var D=num(d),s=num(wall);
  if(s<=0||D<=0||s>=D/2)return 0;
  return STEEL*s*(D-s);
}

/* Итог по участку: количество и цена единицы для строки сметы. */
function calcSeg(seg,c){
  var d=num(seg.d);
  if(d<=0)return {err:'Диаметр не задан'};
  if(c.mode==='seam'){
    var k=KINDS[seg.kind]||KINDS.joint,q=num(seg.qty);
    if(q<=0)return {err:'Количество не задано'};
    if(k.j2&&num(seg.d2)<=0)return {err:'Второй диаметр не задан'};
    var price=k.j1*jointPrice(d,c.seamPrice)+k.j2*jointPrice(seg.d2,c.seamPrice);
    return {units:r3(q),unit:'шт',price:r2(price),sum:r2(r2(price)*r3(q)),
            what:k.name+' Ду'+d,joints:k.j1+k.j2};
  }
  var len=num(seg.len);
  if(len<=0)return {err:'Длина не задана'};
  if(c.mode==='meter'){
    if(num(c.pipeLen)<=0)return {err:'Средняя длина трубы не задана'};
    var pm=jointPrice(d,c.seamPrice)/num(c.pipeLen);
    return {units:r3(len),unit:'м',price:r2(pm),sum:r2(r2(pm)*r3(len)),what:'Сварка трубы Ду'+d};
  }
  var g=gesnHours(d);
  if(!g)return {err:'Диаметр больше 426 мм — вне сборника ГЭСНм-12'};
  var perM=g.hours/100*num(c.manHour);
  // Норма — на монтаж трубопровода, сварка входит в неё. Название строки
  // говорит об этом прямо, иначе смета получит монтаж дважды.
  var normName='Монтаж трубопровода Ду'+d+' (ГЭСНм '+g.code+')';
  if(c.mode==='gesn')
    return {units:r3(len),unit:'м',price:r2(perM),sum:r2(r2(perM)*r3(len)),
            what:normName,gesn:g};
  var m=massPerM(d,seg.wall);
  if(m<=0)return {err:'Толщина стенки задана неверно'};
  var tons=m*len/1000,perTon=perM/(m/1000);
  return {units:r3(tons),unit:'т',price:r2(perTon),sum:r2(r2(perTon)*r3(tons)),
          what:'Монтаж трубопровода Ду'+d+'×'+num(seg.wall)+' (ГЭСНм '+g.code+')',
          gesn:g,mass:r3(m)};
}

function calcAll(c){
  c=c||cfg();
  var out=c.segs.map(function(s){var r=calcSeg(s,c);r.seg=s;return r;});
  return {rows:out,total:r2(out.reduce(function(a,r){return a+(r.sum||0);},0)),
          errors:out.filter(function(r){return r.err;}).length};
}

/* ── разбор позиций спецификации ── */

/* Наружный диаметр из числа в названии. Число из сортамента берётся как
   есть; «Ду 50» переводится таблицей; всё прочее остаётся как написано —
   человек видит распознанное и правит, если мы ошиблись. */
function toOuter(v,marked){
  var n=num(v);
  if(!n)return 0;
  // «Ду» названо прямо — значит это условный проход, и таблица важнее
  // сходства с сортаментом: у Ду 50 наружный диаметр 60,3, а не 50.
  if(marked&&DU2DN[Math.round(n)])return DU2DN[Math.round(n)];
  var best=0;
  for(var i=0;i<DN.length;i++){
    var dv=Math.abs(DN[i]-n);
    if(dv<0.001)return DN[i];
    if(dv<0.35&&(!best||dv<Math.abs(best-n)))best=DN[i];
  }
  return best||n;
}

/* Что это за позиция и какого она диаметра. Возвращает null, когда строка
   к трубопроводу не относится: прибор, кабель, крепёж. */
function parseRow(name){
  var t=String(name||'');
  var kind=null;
  for(var i=0;i<NAME_KINDS.length;i++)if(NAME_KINDS[i][0].test(t)){kind=NAME_KINDS[i][1];break;}
  if(!kind||NOT_WELDED.test(t))return null;
  var d=0,d2=0,du=0;
  // Пара чисел через «х»: у трубы это диаметр и стенка, у перехода и
  // переходного тройника — два диаметра. Различает их вторая величина:
  // стенка тоньше двенадцати миллиметров.
  var pair=t.match(/(\d+[.,]?\d*)\s*(?:мм)?\s*[xх]\s*(\d+[.,]?\d*)/i);
  if(pair){
    // «Ду 50х3» — условный проход со стенкой, его переводим таблицей.
    var duPair=/[дd][уy]\s*[№=]?\s*$/i.test(t.slice(0,pair.index));
    d=toOuter(pair[1],duPair);
    if(duPair&&d!==num(pair[1]))du=num(pair[1]);
    var second=num(pair[2]);
    if(second>=12)d2=toOuter(pair[2],false);
  }
  if(!d){
    // «Ду» — условный проход, его переводим; буквы в нём бывают из разных
    // алфавитов. Латинское Dn и «Дн» сметчики пишут про наружный диаметр:
    // «труба Dn 57» — это 57 мм снаружи, условного прохода 57 нет вовсе.
    var marked=t.match(/(?:[дd][уy]|[дd][нn]|ø|d)\s*[№=]?\s*(\d+[.,]?\d*)/i);
    if(marked){
      var isDu=/^[дd][уy]/i.test(marked[0].trim());
      d=toOuter(marked[1],isDu);
      if(isDu&&d!==num(marked[1]))du=num(marked[1]);
    }
  }
  if(!d){
    var any=t.match(/(?:^|\s)(\d{2,3}[.,]?\d*)(?:\s|$|\))/);
    if(any)d=toOuter(any[1],false);
  }
  if(!d)return null;
  if(kind==='tee'&&d2)kind='teered';
  return {kind:kind,d:d,d2:d2,du:du};
}

/* Цена монтажа позиции спецификации. Труба считается по метру, фасонная
   часть — по своим стыкам. У нормативного обоснования фасонные части уже
   учтены нормой трубопровода, и второй раз их не считают. */
function rowPriceOf(p,c){
  if(p.kind==='pipe'){
    var seg={d:p.d,len:1,wall:3.5};
    var mode=c.mode==='seam'?'meter':c.mode;
    var r=calcSeg(seg,Object.assign({},c,{mode:mode}));
    return r.err?{err:r.err}:{price:r.price,unit:'м',note:mode==='meter'?'':r.gesn.code};
  }
  if(MODES[c.mode].norm)
    return {price:0,unit:'шт',note:'входит в норму трубопровода'};
  var k=KINDS[p.kind]||KINDS.joint;
  if(k.j2&&!p.d2)return {err:'Не виден второй диаметр'};
  return {price:r2(k.j1*jointPrice(p.d,c.seamPrice)
                  +k.j2*jointPrice(p.d2||p.d,c.seamPrice)),unit:'шт'};
}

/* Позиции сметы, которые калькулятор берётся считать. Строки, созданные
   им самим, сюда не попадают: цена работы не считается от работы. Убранные
   «−» разбор распознал, а сметчик знает, что они не варятся, — их тоже нет;
   с off функция отдаёт только убранные. */
function specRows(off){
  if(typeof rows==='undefined')return [];
  var c=cfg(),out=[];
  rows.forEach(function(r){
    if(!r||r.type==='section'||r.type==='calc'||r.weldSeg||r.work)return;
    var p=parseRow(r.name);
    if(!p)return;
    var over=(c.picks||{})[r.id]||{};
    if(!!over.off!==!!off)return;
    var use={kind:over.kind||p.kind,d:num(over.d)||p.d,d2:num(over.d2)||p.d2};
    var res=rowPriceOf(use,c);
    out.push({row:r,parsed:p,use:use,res:res,
              sum:res.err?0:r2((res.price||0)*(num(r.qty)||0))});
  });
  return out;
}

/* ── перенос в смету ── */

/* Строки калькулятора помечены участком, поэтому повторное «Добавить в
   смету» правит прежние, а не кладёт рядом вторые. В КП по умолчанию идёт
   одна строка: заказчику нужна цена работы, а не разбор трассы. */
function place(){
  var c=cfg(),res=calcAll(c);
  if(typeof rows==='undefined')return {added:0,updated:0};
  var added=0,updated=0,removed=0,live={};
  var put=function(key,name,unit,qty,price){
    live[key]=1;
    var old=rows.filter(function(x){return x.weldSeg===key;})[0];
    if(old){
      old.name=name;old.unit=unit;old.qty=qty;old.montazh=price;
      old.weldMode=c.mode;updated++;return;}
    var row=(typeof manualRow==='function')?manualRow(name):{name:name};
    row.unit=unit;row.qty=qty;row.montazh=price;row.work=true;
    row.weldSeg=key;row.weldMode=c.mode;row.nameEdited=true;
    rows.push(row);added++;};

  if(c.split){
    res.rows.forEach(function(r){
      if(r.err)return;
      put(r.seg.id,(r.seg.name?r.seg.name+' · ':'')+r.what,r.unit,r.units,r.price);
    });
  }else if(res.total>0){
    var norm=MODES[c.mode].norm;
    put('all',norm?'Монтаж трубопровода с учётом сварки':'Сварочные работы',
        'компл.',1,res.total);
  }
  for(var i=rows.length-1;i>=0;i--)
    if(rows[i].weldSeg&&!live[rows[i].weldSeg]){rows.splice(i,1);removed++;}
  if(typeof render==='function')render();
  if(typeof saveCur==='function')saveCur();
  return {added:added,updated:updated,removed:removed,total:res.total};
}

/* ── окно ── */

function esc2(s){return (typeof esc==='function')?esc(s)
  :String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function m2(n){return (typeof money==='function')?money(n)
  :(+n||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});}
function q3(n){return (+n||0).toLocaleString('ru-RU',{maximumFractionDigits:3});}

var BOX=null;

/* Два уровня выбора вместо четырёх кнопок в ряд. Первым стоит то, что
   решает судьбу цифры в КП: коммерческая цена или нормативное обоснование.
   Способ расчёта — второй, и «по метру» есть у обоих: смена обоснования
   не заставляет вводить участки заново. */
var LEVELS={com:{name:'Коммерческая',by:['seam','meter']},
            norm:{name:'Нормативная',by:['meter','ton']}};
var BY={seam:'По сварному шву',meter:'По метру и диаметру',ton:'По тоннам'};
var MODE_OF={'com|seam':'seam','com|meter':'meter','norm|meter':'gesn','norm|ton':'ton'};

function levelOf(mode){return MODES[mode].norm?'norm':'com';}
function byOf(mode){return mode==='gesn'?'meter':(mode==='ton'?'ton':mode);}

function modesHTML(c){
  var lev=levelOf(c.mode),by=byOf(c.mode);
  var row=function(label,items,cur,attr){
    return '<div class="weldrow"><span class="weldlbl">'+esc2(label)+'</span>'
      +items.map(function(it){
        return '<button class="btn sm'+(cur===it.k?' on':'')+'" data-'+attr+'="'+it.k+'" '
          +'title="'+esc2(it.t)+'">'+esc2(it.t)+'</button>';}).join('')
      +'</div>';};
  return row('Цена',Object.keys(LEVELS).map(function(k){
      return {k:k,t:LEVELS[k].name};}),lev,'wlevel')
    +row('Считаем',LEVELS[lev].by.map(function(k){
      return {k:k,t:BY[k]};}),by,'wby');
}

/* Тариф за шов и стоимость человеко-часа подменяют друг друга: у методики
   всегда ровно одна цена, и вторая рядом сбивала бы с толку. */
function parHTML(c){
  var f=function(k,label,val,note){
    return '<label class="weldpar"><span>'+esc2(label)+'</span>'
      +'<input class="fmini" data-wpar="'+k+'" inputmode="decimal" value="'+esc2(val)+'">'
      +'<span class="hint">'+esc2(note)+'</span></label>';};
  return '<div class="weldrow weldpars">'
    +(MODES[c.mode].norm
      ? f('manHour','Человеко-час',c.manHour,'₽')
      : f('seamPrice','Цена шва',c.seamPrice,'₽/см')
        +(c.mode==='meter'?f('pipeLen','Средняя длина трубы',c.pipeLen,'м'):''))
    +'</div>';
}

function headCells(mode){
  if(mode==='seam')return ['Участок','Элемент','Ду, мм','Ду 2, мм','Кол-во','Цена ₽','Сумма ₽'];
  if(mode==='ton')return ['Участок','Ду, мм','Стенка, мм','Длина, м','Тонн','Цена ₽/т','Сумма ₽'];
  return ['Участок','Ду, мм','Длина, м','Цена ₽/м','Сумма ₽'];
}

function fld(seg,k,w){
  return '<input class="fmini'+(w?' w':'')+'" data-wseg="'+seg.id+'" data-wf="'+k+'" '
    +'inputmode="decimal" value="'+esc2(seg[k]==null?'':seg[k])+'">';
}

function segHTML(seg,res,mode){
  var cells=headCells(mode);
  var name='<td data-l="'+cells[0]+'"><input class="f" data-wseg="'+seg.id+'" data-wf="name" '
    +'placeholder="Трасса до модуля" value="'+esc2(seg.name||'')+'"></td>';
  var mid;
  if(mode==='seam'){
    var k=KINDS[seg.kind]||KINDS.joint;
    mid='<td data-l="'+cells[1]+'"><select data-wseg="'+seg.id+'" data-wf="kind">'
      +Object.keys(KINDS).map(function(x){return '<option value="'+x+'"'
        +(seg.kind===x?' selected':'')+'>'+esc2(KINDS[x].name)+'</option>';}).join('')
      +'</select></td>'
      +'<td data-l="'+cells[2]+'" class="n">'+fld(seg,'d')+'</td>'
      +'<td data-l="'+cells[3]+'" class="n">'+(k.j2?fld(seg,'d2'):'<span class="sub">—</span>')+'</td>'
      +'<td data-l="'+cells[4]+'" class="n">'+fld(seg,'qty')+'</td>';
  }else if(mode==='ton'){
    mid='<td data-l="'+cells[1]+'" class="n">'+fld(seg,'d')+'</td>'
      +'<td data-l="'+cells[2]+'" class="n">'+fld(seg,'wall')+'</td>'
      +'<td data-l="'+cells[3]+'" class="n">'+fld(seg,'len')+'</td>'
      +'<td data-l="'+cells[4]+'" class="n"><b class="wtons">'+(res.err?'—':q3(res.units))+'</b></td>';
  }else{
    mid='<td data-l="'+cells[1]+'" class="n">'+fld(seg,'d')+'</td>'
      +'<td data-l="'+cells[2]+'" class="n">'+fld(seg,'len')+'</td>';
  }
  var price='<td data-l="'+cells[cells.length-2]+'" class="n"><span class="wprice">'
    +(res.err?'—':m2(res.price))+'</span></td>';
  var sum='<td data-l="'+cells[cells.length-1]+'" class="n">'
    +(res.err?'<span class="gap">'+esc2(res.err)+'</span>'
             :'<b class="wsum">'+m2(res.sum)+'</b>')+'</td>';
  return '<tr data-wrow="'+seg.id+'">'+name+mid+price+sum
    +'<td class="inc"><button class="btn sm io" data-wdel="'+seg.id+'" '
    +'title="Убрать участок"><svg class="i"><use href="#i-trash"/></svg></button></td></tr>';
}

/* Итог показывает не только сумму: чем посчитано и что именно ляжет
   в смету. Метка методики серая — она сообщает, а не выносит вердикт. */
function totalHTML(c,res){
  var one=!c.split;
  var preview=one
    ? 'Сварочные работы · 1 компл. · '+m2(res.total)+' ₽'
    : 'строк работ: '+res.rows.filter(function(r){return !r.err;}).length;
  return '<div class="weldtotal">'
    +'<div class="wtline"><span class="wtotal">Итого <b>'+m2(res.total)+'</b> ₽</span></div>'
    +'<div class="sub">'+esc2(MODES[c.mode].short+' · '+preview)
    +(res.errors?' · не заполнено участков: '+res.errors:'')+'</div></div>';
}

/* Две вкладки окна: считать по позициям, которые уже лежат в смете, или
   по участкам трассы, которых в ней нет. Первое — обычный случай: смету
   присылает проектировщик, и в ней уже есть «Труба б/ш Dn 57 — 23,4 м». */
function tabsHTML(c){
  var n=specRows().length;
  var b=function(k,t){
    return '<button class="btn sm'+(c.tab===k?' on':'')+'" data-wtab="'+k+'" '
      +'title="'+esc2(t)+'">'+esc2(t)+'</button>';};
  return '<div class="weldrow weldtabs">'+b('spec','Позиции сметы'+(n?' · '+n:''))
    +b('segs','Свои участки')+'</div>';
}

/* Строка спецификации: что распознали и во что это обошлось. Вид и диаметр
   правятся здесь же — проектировщик пишет название как хочет, и разбор
   ошибается на редких формах. */
function specHTML(it,c){
  var r=it.row,p=it.use,res=it.res;
  var sel='<select data-wpick="'+esc2(r.id)+'" data-wf="kind">'
    +Object.keys(KINDS).concat(['pipe']).map(function(k){
      var nm=k==='pipe'?'Труба':KINDS[k].name;
      return '<option value="'+k+'"'+(p.kind===k?' selected':'')+'>'+esc2(nm)+'</option>';
    }).join('')+'</select>';
  var dfld=function(f,v){
    return '<input class="fmini" data-wpick="'+esc2(r.id)+'" data-wf="'+f+'" '
      +'inputmode="decimal" value="'+esc2(v||'')+'">';};
  var qty=q3(num(r.qty))+' '+esc2(r.unit||'');
  // Условный проход переведён в наружный — человек должен это видеть:
  // расхождение между «Ду 50» и 60,3 мм стоит трети цены шва.
  var note=it.parsed.du?'<div class="sub">Ду '+q3(it.parsed.du)
    +' — наружный '+q3(it.parsed.d)+' мм</div>':'';
  return '<tr data-wsrow="'+esc2(r.id)+'"><td data-l="Позиция сметы">'
    +'<div class="nm">'+esc2(r.name)+'</div>'+note+'</td>'
    +'<td data-l="Что это">'+sel+'</td>'
    +'<td data-l="Ду, мм" class="n">'+dfld('d',p.d)+'</td>'
    +'<td data-l="Ду 2, мм" class="n">'
      +((KINDS[p.kind]||{}).j2?dfld('d2',p.d2):'<span class="sub">—</span>')+'</td>'
    +'<td data-l="Кол-во" class="n">'+qty+'</td>'
    +'<td data-l="Цена монт. ₽" class="n">'
      +(res.err?'<span class="gap">'+esc2(res.err)+'</span>'
        :m2(res.price)+(res.note?' <span class="sub">'+esc2(res.note)+'</span>':''))+'</td>'
    +'<td data-l="Монтаж ₽" class="n"><b class="wsum">'+m2(it.sum)+'</b></td>'
    +'<td class="inc"><button class="btn sm io" data-woff="'+esc2(r.id)+'" '
    +'title="Убрать из расчёта"><svg class="i"><use href="#i-minus"/></svg></button></td></tr>';
}

function specBody(c){
  var list=specRows();
  if(!list.length&&specRows(true).length)
    return '<div class="sub">Все позиции убраны из расчёта</div>';
  if(!list.length)
    return (typeof UI!=='undefined'&&UI.empty
      ? UI.empty({icon:'i-calc',title:'Труб в смете не нашлось',
          text:'Калькулятор берёт позиции, в названии которых есть труба, отвод, тройник, переход или муфта с диаметром. Электрику и приборы он не считает.'})
      : '<div class="sub">Труб в смете не нашлось</div>');
  var head='<tr><th>Позиция сметы</th><th>Что это</th><th>Ду, мм</th><th>Ду 2, мм</th>'
    +'<th>Кол-во</th><th>Цена монт. ₽</th><th>Монтаж ₽</th><th></th></tr>';
  return '<div class="xscroll"><table class="purtbl weldtbl weldspec">'+head
    +list.map(function(it){return specHTML(it,c);}).join('')+'</table></div>';
}

function bodyHTML(){
  var c=cfg(),spec=c.tab==='spec';
  var body,foot;
  if(spec){
    var list=specRows(),sum=list.reduce(function(a,it){return a+it.sum;},0);
    var bad=list.filter(function(it){return it.res.err;}).length;
    var off=specRows(true).length;
    body=specBody(c);
    foot='<div class="weldfoot">'
      +'<span class="hint">Цена ляжет в колонку «Цена монт.» самих позиций</span>'
      +(off?'<button class="btn sm" data-won="1" title="Вернуть убранные позиции в расчёт">'
        +'Вернуть убранные · '+off+'</button>':'')
      +'<div class="weldtotal"><div class="wtline"><span class="wtotal">Монтаж '
      +'<b>'+m2(sum)+'</b> ₽</span></div>'
      +'<div class="sub">'+esc2(MODES[c.mode].short+' · позиций: '+list.length)
      +(bad?' · не распознано: '+bad:'')+'</div></div></div>';
  }else{
    var res=calcAll(c),cells=headCells(c.mode);
    var head='<tr>'+cells.map(function(t){return '<th>'+esc2(t)+'</th>';}).join('')+'<th></th></tr>';
    body=c.segs.length
      ? '<div class="xscroll"><table class="purtbl weldtbl">'+head
          +res.rows.map(function(r){return segHTML(r.seg,r,c.mode);}).join('')+'</table></div>'
      : (typeof UI!=='undefined'&&UI.empty
          ? UI.empty({icon:'i-calc',title:'Участков пока нет',
              text:'Добавьте участок трассы — диаметр и длину или число стыков.'})
          : '<div class="sub">Участков пока нет</div>');
    foot='<div class="weldfoot">'
      +'<button class="btn sm" data-wadd="1" title="Добавить участок">＋ участок</button>'
      +'<button class="btn sm'+(c.split?' on':'')+'" data-wsplit="1" '
      +'title="Класть в смету отдельную строку на каждый участок">По участкам</button>'
      +totalHTML(c,res)+'</div>';
  }
  return '<div class="weldhead">'+tabsHTML(c)+modesHTML(c)+parHTML(c)+'</div>'
    +'<p class="hint weldnote">'+esc2(MODES[c.mode].hint)+'</p>'+body+foot;
}

/* Числа правятся на каждый набранный знак, поэтому обновляются точечно:
   перерисовка таблицы целиком уводила бы фокус из поля. */
function paint(){
  if(!BOX)return;
  var c=cfg();
  if(c.tab==='spec'){
    var list=specRows(),sum=0,bad=0;
    list.forEach(function(it){
      sum+=it.sum; if(it.res.err)bad++;
      var tr=BOX.el.querySelector('[data-wsrow="'+it.row.id+'"]');
      if(!tr)return;
      var cells=tr.children;
      cells[5].innerHTML=it.res.err?'<span class="gap">'+esc2(it.res.err)+'</span>'
        :m2(it.res.price)+(it.res.note?' <span class="sub">'+esc2(it.res.note)+'</span>':'');
      cells[6].innerHTML='<b class="wsum">'+m2(it.sum)+'</b>';
    });
    var st=BOX.el.querySelector('.wtotal b');
    if(st)st.textContent=m2(sum);
    var ss=BOX.el.querySelector('.weldtotal .sub');
    if(ss)ss.textContent=MODES[c.mode].short+' · позиций: '+list.length
      +(bad?' · не распознано: '+bad:'');
    return;
  }
  var res=calcAll(c);
  res.rows.forEach(function(r){
    var tr=BOX.el.querySelector('[data-wrow="'+r.seg.id+'"]');
    if(!tr)return;
    var set=function(sel,v){var el=tr.querySelector(sel);if(el)el.textContent=v;};
    set('.wprice',r.err?'—':m2(r.price));
    set('.wtons',r.err?'—':q3(r.units));
    var last=tr.children[tr.children.length-2];
    if(last)last.innerHTML=r.err?'<span class="gap">'+esc2(r.err)+'</span>'
                                :'<b class="wsum">'+m2(r.sum)+'</b>';
  });
  var tot=BOX.el.querySelector('.weldtotal');
  if(tot)tot.outerHTML=totalHTML(c,res);
}

function redraw(){
  if(!BOX)return;
  var body=BOX.el.querySelector('.mbody');
  if(body)body.innerHTML=bodyHTML();
}

function segById(id){
  var c=cfg();
  return c.segs.filter(function(s){return s.id===id;})[0];
}

function onInput(e){
  var pk=e.target.closest('[data-wpick]');
  if(pk){
    var picks=Object.assign({},cfg().picks);
    var cur=Object.assign({},picks[pk.dataset.wpick]||{});
    cur[pk.dataset.wf]=pk.value;
    picks[pk.dataset.wpick]=cur;
    write({picks:picks});
    // Смена вида меняет состав колонок строки, диаметр — только числа.
    if(pk.dataset.wf==='kind')redraw(); else paint();
    return;
  }
  var el=e.target.closest('[data-wf]');
  if(el){
    var seg=segById(el.dataset.wseg);
    if(!seg)return;
    seg[el.dataset.wf]=el.value;
    write({segs:cfg().segs});
    if(el.dataset.wf==='kind')redraw(); else paint();
    return;
  }
  var p=e.target.closest('[data-wpar]');
  if(!p)return;
  var patch={};patch[p.dataset.wpar]=num(p.value);write(patch);paint();
  // Правка тарифа переписывает все участки разом, а видно это только по
  // итогу: пересчитанные строки могут быть за краем окна.
  if(e.type==='change'&&window.toast){
    var n=cfg().segs.length;
    if(n)toast('Пересчитано участков: '+n);
  }
}

function onClick(e){
  var c=cfg();
  var tb=e.target.closest('[data-wtab]');
  if(tb){
    var patch={tab:tb.dataset.wtab};
    // На пустой вкладке участков первую строку заводим сами: начинать
    // работу с поиска кнопки «＋ участок» незачем.
    if(tb.dataset.wtab==='segs'&&!c.segs.length)patch.segs=[mkSeg()];
    write(patch);redraw();return;}
  var lv=e.target.closest('[data-wlevel]');
  if(lv){
    var by=byOf(c.mode),lev=lv.dataset.wlevel;
    // Способ, которого у этого обоснования нет, заменяется первым его
    // способом: «по шву» нормативной цены не существует.
    if(LEVELS[lev].by.indexOf(by)<0)by=LEVELS[lev].by[0];
    write({mode:MODE_OF[lev+'|'+by]});redraw();return;}
  var b=e.target.closest('[data-wby]');
  if(b){write({mode:MODE_OF[levelOf(c.mode)+'|'+b.dataset.wby]});redraw();return;}
  if(e.target.closest('[data-wsplit]')){write({split:!c.split});redraw();return;}
  if(e.target.closest('[data-wadd]')){
    var segs=cfg().segs.slice();segs.push(mkSeg());
    write({segs:segs});redraw();
    var rows2=BOX.el.querySelectorAll('.weldtbl input.f');
    if(rows2.length)rows2[rows2.length-1].focus();
    return;
  }
  var of=e.target.closest('[data-woff]');
  if(of){
    var picks=Object.assign({},c.picks);
    picks[of.dataset.woff]=Object.assign({},picks[of.dataset.woff]||{},{off:true});
    write({picks:picks});redraw();return;}
  if(e.target.closest('[data-won]')){
    var back={};
    Object.keys(c.picks).forEach(function(id){
      back[id]=Object.assign({},c.picks[id]);delete back[id].off;});
    write({picks:back});redraw();return;}
  var d=e.target.closest('[data-wdel]');
  if(d){
    write({segs:cfg().segs.filter(function(s){return s.id!==d.dataset.wdel;})});
    redraw();
  }
}

function open(){
  if(typeof UI==='undefined'||!UI.modal)return;
  var c=cfg();
  if(c.tab==='segs'&&!c.segs.length)write({segs:[mkSeg()]});
  BOX=UI.modal({title:'Сварка труб',wide:true,
    sub:'Цена монтажа по сварке: для позиций сметы или для своих участков трассы',
    body:bodyHTML(),ok:'Посчитать',okIcon:'i-ok',
    onOk:function(){
      var cc=cfg();
      if(cc.tab==='spec'){
        var r=applySpec();
        if(window.toast)toast(r.rows
          ? 'Цена монтажа проставлена в строках: '+r.rows
          : 'Нечего проставлять — цены уже стоят');
        return true;
      }
      var p=place();
      if(window.toast)toast(p.added+p.updated
        ? 'В смете: добавлено '+p.added+', обновлено '+p.updated
          +(p.removed?', убрано '+p.removed:'')
        : 'Нечего добавить — участки не заполнены');
      return true;}});
  BOX.el.addEventListener('input',onInput);
  BOX.el.addEventListener('change',onInput);
  BOX.el.addEventListener('click',onClick);
}

document.addEventListener('click',function(ev){
  var el=ev.target.closest('[data-act="weld"]');
  if(!el)return;
  ev.preventDefault();
  if(typeof canEdit==='function'&&!canEdit()){
    if(window.toast)toast('Только просмотр — расчёт в смету не добавить');return;}
  open();
});

/* Проставить посчитанное в сами позиции спецификации. Новых строк здесь не
   заводится: у позиции уже есть количество и единица, ей не хватает только
   цены монтажа. */
function applySpec(){
  var list=specRows(),n=0;
  list.forEach(function(it){
    if(it.res.err)return;
    if((num(it.row.montazh)||0)===(it.res.price||0))return;
    it.row.montazh=it.res.price||0;n++;
  });
  if(n){
    if(typeof render==='function')render();
    if(typeof saveCur==='function')saveCur();
  }
  return {rows:n,total:list.reduce(function(a,it){return a+it.sum;},0)};
}

window.WELD={MODES:MODES,KINDS:KINDS,DN:DN,GESN:GESN,DU2DN:DU2DN,
  parseRow:parseRow,specRows:specRows,applySpec:applySpec,rowPriceOf:rowPriceOf,
  cfg:cfg,write:write,mkSeg:mkSeg,jointPrice:jointPrice,gesnHours:gesnHours,
  massPerM:massPerM,calcSeg:calcSeg,calcAll:calcAll,place:place,num:num,open:open};
})();
