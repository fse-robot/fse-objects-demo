(function(){

// ── состояние ──
// params — параметры компании с сервера. Пока не пришли, считаем по
// умолчанию и честно говорим «не заполнено», а не показываем ноль как
// посчитанную величину.
var D={tab:'calc',meth:false,busy:false,
       params:null,paramsLoaded:false,paramsDraft:null,
       list:null,uid:null,title:'',specUid:null,
       form:null,savedFixed:null};

function blank(){return {
  revenue:'', months:'', advancePct:'100',
  bonus:'', partner:'', cashFee:'',
  equip:[{name:'',sum:'',vat:true}],
  contract:[{name:'',sum:'',vat:true}],
  other:[{name:'',sum:'',vat:true}],
  toFilter:{stop:{},score:{}}
};}

var g=function(id){return document.getElementById(id);};
var num=function(x){var v=parseFloat(String(x==null?'':x).replace(',','.'));return isFinite(v)?v:0;};
var rub=function(n){return (Math.round((isFinite(n)?n:0)*100)/100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₽';};
var pct=function(x,d){return (Math.round((isFinite(x)?x:0)*Math.pow(10,d==null?2:d))/Math.pow(10,d==null?2:d)).toLocaleString('ru-RU')+' %';};
var esc2=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};

function P(){
  // Параметры для расчёта. Отсутствие ответа сервера — не повод считать
  // по нулям молча: флаг filled уходит в интерфейс.
  var p=D.params||{};
  return {vatPct:p.vat_pct==null?20:+p.vat_pct,
          fixedSharePct:+p.fixed_share_pct||0,
          moneyRatePct:+p.money_rate_pct||0,
          targetMarginPct:p.target_margin_pct==null?50:+p.target_margin_pct,
          filled:!!p.filled};
}

// ══ ЯДРО РАСЧЁТА ═══════════════════════════════════════════════════════
// Заявление о сверке с «Калькулятор_принятия_решений_полноценый.xlsm»
// (issue #182) подтвердить не удалось — самого файла нет ни в репозитории,
// ни на диске. tests/deal-compute.spec.js фиксирует нынешнее поведение
// функции как регрессионный контрольный пример: это защита от случайного
// изменения расчёта, а не подтверждённая сверка с xlsm.
function dealCompute(d,p){
  var vat=num(p.vatPct)/100;
  var kv=vat>0?vat/(1+vat):0;                       // 20/120 — доля НДС в сумме с НДС
  var tally=function(list){var gross=0,tax=0;
    (list||[]).forEach(function(r){var s=num(r.sum);gross+=s;if(r.vat)tax+=s*kv;});
    return {gross:gross,tax:tax,net:gross-tax};};
  var eq=tally(d.equip),co=tally(d.contract),ot=tally(d.other);
  var R=num(d.revenue);
  var extra=num(d.bonus)+num(d.partner)+num(d.cashFee);
  var vatIn=eq.tax+co.tax+ot.tax;
  var vatDue=R*kv-vatIn;                            // НДС к уплате
  var direct=eq.gross+co.gross+ot.gross+extra+vatDue;
  var margin=R-direct;
  var marginPct=R>0?margin/R:0;

  // K — часть затрат, не зависящая от цены. Отсюда margin = R/(1+НДС) − K.
  var K=eq.gross+co.gross+ot.gross+extra-vatIn;
  var base=1/(1+vat);

  var fixed=num(p.fixedSharePct)/100*R;
  var money=eq.gross*(num(d.advancePct)/100)*(num(p.moneyRatePct)/100)/12*num(d.months);
  // ТБУ по учебной формуле: постоянные ÷ коэффициент маржинального дохода.
  // Ровно как в xlsm. При неположительной марже точки безубыточности нет —
  // контракт не окупается ни при каком объёме.
  var bep=margin>0?fixed/margin*R:null;
  var profit=margin-fixed-money;

  var t=num(p.targetMarginPct)/100;
  var span=base-t;
  // Цель выше предела 1/(1+НДС) недостижима ни при какой цене: столько
  // маржи в выручке просто нет, даже при нулевых затратах.
  var reachable=span>1e-9;
  var priceForTarget=(reachable&&K>0)?K/span:null;
  var discountPct=reachable?(marginPct-t)/span*100:null;

  return {vatIn:vatIn,vatDue:vatDue,direct:direct,margin:margin,marginPct:marginPct,
          fixed:fixed,money:money,bep:bep,profit:profit,
          profitPct:R>0?profit/R:0,deviation:marginPct-t,
          discountPct:(discountPct!=null&&discountPct>0)?discountPct:null,
          priceForTarget:priceForTarget,reachable:reachable,
          K:K,base:base,equip:eq,contract:co,other:ot,extra:extra,R:R,vat:vat};
}
window.dealCompute=dealCompute; // для tests/deal-compute.spec.js

// ══ ФИЛЬТР ТО ══════════════════════════════════════════════════════════
// Брать ли объект на техобслуживание. Стоп-фактор решает сам, без баллов:
// никакая маржа не окупает неисправную систему, которую не дают чинить.
// Веса и пороги — настройка компании (deal_calc_params.to_filter); здесь
// умолчание на случай, пока сервер не ответил. Сумма весов — 100.
var TO_STOPS=[
  ['broken','Неисправна','Система неисправна или смонтирована с нарушениями, а заказчик отказывается приводить её в норму'],
  ['nodocs','Нет документации','Нет проекта и исполнительной документации, и заказчик не готов платить за обследование'],
  ['payrisk','Платёжный риск','Долги по арбитражу, признаки банкротства, оплата позже 60 дней после акта, плохая история с нами'],
  ['liability','Безлимитная ответственность','Неограниченная ответственность за ущерб от пожара или штрафы больше годовой суммы договора'],
  ['belowcost','Ниже себестоимости','Цена ниже себестоимости (типично для торгов по 44-ФЗ) без возможности пересмотра'],
  ['zone','Вне зоны','Объект вне зоны выезда, а выезды отдельно не оплачиваются']];
var TO_CRIT=[
  ['margin','Маржа','0 — около нуля, 3 — больше 40 %'],
  ['pay','Оплата','0 — постоплата, задержки, 3 — предоплата или до 10 дней'],
  ['state','Состояние','0 — старая, чужой монтаж, скоро переосвидетельствование, 3 — наш монтаж или свежая и исправная'],
  ['docs','Документация','0 — ничего нет, 3 — проект, исполнительная, паспорта, журналы'],
  ['logistics','Логистика','0 — далеко, пропуска, допуски, только ночью, 3 — близко, свободный доступ'],
  ['upsell','Допродажи','0 — только ТО, 3 — переосвидетельствование, ремонт, другие объекты'],
  ['client','Клиент','0 — нет ЛПР, контакты меняются, конфликтный, 3 — один понятный контакт, быстрые решения'],
  ['ref','Пример','0 — никакой ценности как пример, 3 — известное имя, сильная отрасль'],
  ['term','Срок','0 — разовый, 3 — от года с автопродлением']];
var TO_DEF={weights:{margin:20,pay:15,state:15,docs:10,logistics:10,upsell:10,client:10,ref:5,term:5},
            take:70,cond:50};

// Вердикта нет, пока ответ дан не на все критерии: балл по неполным данным
// читается как приговор, а он лишь недосчитан.
function toCompute(st,cfg){
  cfg=cfg||TO_DEF; st=st||{};
  var stop=st.stop||{}, sc=st.score||{};
  var stopped=TO_STOPS.filter(function(s){return !!stop[s[0]];}).map(function(s){return s[0];});
  var pts=0,left=0;
  TO_CRIT.forEach(function(c){
    var v=sc[c[0]];
    if(v==null||v===''){left++;return;}
    pts+=Math.max(0,Math.min(3,+v))/3*(+cfg.weights[c[0]]||0);
  });
  pts=Math.round(pts);
  var verdict=stopped.length?'no':left?null:pts>=cfg.take?'take':pts>=cfg.cond?'cond':'no';
  return {stopped:stopped,left:left,points:pts,verdict:verdict};
}
window.toCompute=toCompute; // для tests/deal-to-filter.spec.js
function toCfg(){var t=(D.params||{}).to_filter; return t&&t.weights?t:TO_DEF;}
// Сервер проверяет то же самое; здесь — чтобы ошибка была видна до нажатия.
function tfErr(tf){
  var sum=0; TO_CRIT.forEach(function(c){sum+=num(tf.weights[c[0]]);});
  if(sum!==100)return 'Сумма весов '+sum+', нужно 100';
  if(num(tf.cond)>=num(tf.take))return '«Условия от» должно быть меньше «Брать от»';
  return '';
}

// ── сеть ──
async function loadParams(){
  try{ D.params=await api('/deal/params'); }
  catch(e){ D.params=null; if(e&&e.status!==403)toast('Параметры не загрузились: '+e.message,3500); }
  D.paramsLoaded=true; render();
}
async function loadList(){
  try{ D.list=await api('/deals'); }
  catch(e){ D.list=[]; toast('Список не загрузился: '+e.message,3500); }
  if(D.tab==='saved')render();
}

// ══ ЭКРАН ══════════════════════════════════════════════════════════════
window.renderDeal=function(){
  var v=g('dealView'); if(!v)return;
  if(!D.form)D.form=blank();
  function tb(k,t,ic){
    return '<button class="stab'+(D.tab===k?' on':'')+'" data-dl="tab" data-t="'+k+'" title="'+t+'">'
      +'<svg class="i"><use href="#'+ic+'"/></svg><span class="lbl">'+t+'</span></button>';
  }
  var tabs='<div class="stabs">'+tb('calc','Расчёт','i-calc')+tb('to','ТО','i-tool')+tb('saved','Сохранённые','i-list')
    +(can('deal:params')?tb('params','Параметры','i-cog'):'')+'</div>';
  var body=D.tab==='calc'?viewCalc():D.tab==='to'?viewTo():D.tab==='saved'?viewSaved():viewParams();
  // Заголовок раздела. Раньше экран начинался сразу с вкладок, и человек,
  // попавший сюда по ссылке, не понимал, где он.
  var head='<div class="ph"><div><h1>Расчёт сделки</h1>'
    +'<p>Маржа и прибыль по контракту — считается на каждое нажатие клавиши</p></div></div>';
  v.innerHTML='<div class="dl">'+head+tabs+body+'</div>';
  if(D.tab==='calc')computeDeal();
};

function rowsHTML(kind,list,label){
  var rows=(list||[]).map(function(r,i){
    return '<tr data-k="'+kind+'" data-i="'+i+'">'
      +'<td data-l="'+label+'"><input data-dl="cell" data-f="name" value="'+esc2(r.name)+'" placeholder="'+label+'"></td>'
      +'<td data-l="Сумма, ₽" style="width:170px"><input class="num" data-dl="cell" data-f="sum" inputmode="decimal" value="'+esc2(r.sum)+'" placeholder="0"></td>'
      +'<td data-l="НДС" style="width:120px"><select data-dl="cell" data-f="vat">'
        +'<option value="1"'+(r.vat?' selected':'')+'>с НДС</option>'
        +'<option value="0"'+(r.vat?'':' selected')+'>без НДС</option></select></td>'
      +'<td class="xrow" data-dl="del" title="Убрать строку">×</td></tr>';}).join('');
  return '<table class="dt"><tr><th>Наименование</th><th style="text-align:right">Сумма, ₽</th><th>НДС</th><th></th></tr>'
    +rows+'</table><button class="addrow" data-dl="add" data-k="'+kind+'">＋ строка</button>';
}

function viewCalc(){
  var p=P();
  var full=can('deal:params');   // полный блок — тому же, кто задаёт параметры
  // hasR больше не нужен: блоки переключает computeDeal классом на разделе.
  var warn='';
  if(full&&D.paramsLoaded&&!p.filled)
    warn='<div class="warn">Доля постоянных затрат не заполнена — прибыль по контракту и точка безубыточности не считаются. '
        +'Заполните на вкладке «Параметры»: это доля постоянных затрат в выручке по ОПиУ за последние 6 месяцев.</div>';
  else if(full&&D.paramsLoaded&&p.filled&&!p.fixedSharePct)
    warn='<div class="warn">Доля постоянных затрат равна нулю — прибыль по контракту совпадёт с маржинальной за вычетом стоимости денег.</div>';
  // Сказано строкой над расчетом, а не гаснущим уведомлением: от доли
  // зависят все итоговые числа на экране, и человек должен успеть это прочесть.
  var drift='';
  if(full&&D.params&&D.savedFixed!=null&&Math.abs(D.savedFixed-p.fixedSharePct)>1e-9)
    drift='<div class="errbox x" id="dlDrift" style="margin:0 0 12px"><p>Расчет сохранен при доле постоянных затрат '
      +pct(D.savedFixed,3)+', сейчас она '+pct(p.fixedSharePct,3)+'. Итог по контракту пересчитан по текущей</p>'
      +'<button type="button" title="Скрыть" aria-label="Скрыть" data-dl="drifthide">'
      +'<svg class="i"><use href="#i-x"/></svg></button></div>';

  var h=drift
   +'<div class="sec">Контракт <span class="hint">суммы с НДС, как в договоре</span></div>'
   +'<div class="grid">'
   +fld('Стоимость контракта (с НДС), ₽','<input class="gi" id="dlRevenue" inputmode="decimal" value="'+esc2(D.form.revenue)+'" placeholder="0">',
        'Сумма из договора целиком, вместе с НДС. От неё считается всё остальное.')
   +fld('Длительность контракта, мес.','<input class="gi" id="dlMonths" inputmode="decimal" value="'+esc2(D.form.months)+'" placeholder="0">',
        'От аванса до последнего платежа. Нужна, чтобы оценить стоимость денег во времени.')
   +fld('Аванс за оборудование, %','<input class="gi" id="dlAdvance" inputmode="decimal" value="'+esc2(D.form.advancePct)+'" placeholder="0">',
        'Какую долю оборудования заказчик оплачивает вперёд. Остальное компания везёт на своих деньгах.')
   +'</div>'

   +'<div class="sec">Оборудование</div>'+rowsHTML('equip',D.form.equip,'Наименование позиции')
   +'<div class="sec">Подрядчики</div>'+rowsHTML('contract',D.form.contract,'Наименование отдела')
   +'<div class="sec">Прочие расходы <span class="hint">всё, что компания несёт по этому проекту сверх перечисленного</span></div>'
   +rowsHTML('other',D.form.other,'Статья затрат')

   +'<div class="sec">Выплаты по сделке</div><div class="grid">'
   +fld('Бонусы менеджеру, ₽','<input class="gi" id="dlBonus" inputmode="decimal" value="'+esc2(D.form.bonus)+'" placeholder="0">',
        'Разовая выплата по этой сделке, а не оклад.')
   +fld('Комиссия партнёру, ₽','<input class="gi" id="dlPartner" inputmode="decimal" value="'+esc2(D.form.partner)+'" placeholder="0">',
        'Вознаграждение тому, кто привёл сделку.')
   +fld('Комиссия за покупку наличности, ₽','<input class="gi" id="dlCash" inputmode="decimal" value="'+esc2(D.form.cashFee)+'" placeholder="0">',
        'Во что обходится получение наличных по этой сделке. Ноль, если наличные не нужны.')
   +'</div>'

   +'<div class="sec">Маржинальный итог '
   +'<span class="hint">только деньги самой сделки, без общих расходов компании</span></div>'
   +('<div class="res" id="dlRes">'
   +met('key','Маржинальная прибыль','dlMargin','',
        'Стоимость контракта минус прямые затраты. Столько остаётся от сделки.')
   +met('key','Маржинальная рентабельность','dlMarginPct','dlMarginSub',
        'Та же прибыль в процентах от стоимости. По ней решают, браться или нет.')
   +met('','Прямые затраты','dlDirect','dlDirectSub',
        'Оборудование, подрядчики, прочее, выплаты по сделке и НДС к уплате.')
   +met('','НДС к уплате','dlVatDue','dlVatSub',
        'НДС в стоимости контракта минус входящий по затратам с НДС.')
   +met('','Отклонение от цели','dlDev','dlDevSub',
        'Насколько рентабельность выше или ниже целевой из «Параметров».')
   +met('','Максимальная скидка','dlDisc','dlDiscSub',
        'Сколько можно уступить, не опустившись ниже целевой маржинальности.')
   +'</div>')
   +noData('dlResNo','Заполните стоимость контракта и затраты выше — здесь появятся '
          +'маржинальная прибыль, рентабельность, отклонение от цели и максимальная скидка.')

   +(full?('<div class="sec">Итог по контракту <span class="hint">с постоянными затратами и стоимостью денег</span></div>'
   +('<div class="res" id="dlRes2">'
   +met('key','Прибыль по контракту','dlProfit','dlProfitSub',
        'Маржинальная прибыль минус доля постоянных затрат и стоимость замороженных денег.')
   +met('','Рентабельность контракта','dlProfitPct','',
        'Прибыль по контракту в процентах от его стоимости.')
   +met('','Точка безубыточности','dlBep','dlBepSub',
        'Стоимость контракта, при которой прибыль обращается в ноль.')
   +met('','Сумма постоянных затрат','dlFixed','dlFixedSub',
        'Доля общих расходов компании, отнесённая на этот контракт.')
   +met('','Стоимость денег во времени','dlMoney','dlMoneySub',
        'Во что обходится аванс за оборудование, замороженный на срок контракта.')
   +met('','Цена под целевую маржу','dlTarget','dlTargetSub',
        'Стоимость контракта, дающая целевую маржинальность при этих затратах.')
   +'</div>')
   +noData('dlResNo2','Здесь появятся прибыль по контракту, точка безубыточности и цена '
          +'под целевую маржу — как только будет заполнена стоимость контракта.')):'')

   +warn
   +'<button class="tgl" data-dl="meth">'+(D.meth?'▴ Скрыть ход расчёта':'▾ Показать ход расчёта')+'</button>'
   +(D.meth?'<div class="method" id="dlMethod"></div>':'')

   +'<div class="bar">'
   +'<input class="gi" id="dlTitle" style="max-width:320px" placeholder="Название расчёта" value="'+esc2(D.title)+'">'
   +(can('deal:write')?'<button class="btn primary" data-dl="save">'+(D.uid?'Сохранить':'Сохранить как новый')+'</button>':'')
   +(D.uid&&can('deal:write')?'<button class="btn" data-dl="saveas">Сохранить копией</button>':'')
   +'<button class="btn" data-dl="reset">Очистить</button>'
   +'<span class="grow"></span>'
   +'<button class="btn" data-dl="usetarget" title="Подставить в стоимость контракта цену, дающую целевую маржинальность">Подставить целевую цену</button>'
   +'</div>'
   +'<p class="note">Раздел виден директору, администратору и менеджеру. '
   +'Кому именно выдано право на него, решает сервер, а не эта страница.</p>'
   +'<p class="note">Показатели, кроме маржинальных, оценочные: они зависят от того, как постоянные затраты отнесены на этот контракт. '
   +'При решении «браться или нет» опирайтесь на маржинальную прибыль и маржинальную рентабельность — они посчитаны только по деньгам самой сделки.</p>';
  return h;
}

function viewTo(){
  var tf=D.form.toFilter, cfg=toCfg(), r=toCompute(tf,cfg);
  var R=num(D.form.revenue), mp=R>0?dealCompute(D.form,P()).marginPct*100:null;
  // Шире полосы кнопки баллов уезжают от подписи на другой край экрана.
  // Пояснения стоят текстом, а не в title: на телефоне навести некуда.
  var h='<div style="max-width:560px"><div class="sec">Стоп-факторы</div>'
   +TO_STOPS.map(function(s){
      return '<label class="optrow"><input type="checkbox" data-dl="tostop" data-k="'+s[0]+'"'
        +(tf.stop[s[0]]?' checked':'')+'><span>'+s[1]+'<div class="note" style="margin:0">'+s[2]+'</div></span></label>';}).join('')
   +'<div class="sec">Критерии</div>'
   +TO_CRIT.map(function(c){
      var v=tf.score[c[0]];
      var hint=c[0]==='margin'&&mp!=null?'<div class="note" style="margin:0">по расчёту '+pct(mp,0)+'</div>':'';
      return '<div class="varrow"><span>'+c[1]
        +' <span class="note" style="margin:0">'+(+cfg.weights[c[0]]||0)+'</span>'+hint
        +'<div class="note" style="margin:0">'+c[2]+'</div></span><span style="white-space:nowrap">'
        +[0,1,2,3].map(function(n){
          return '<button class="btn sm'+(v!=null&&v!==''&&+v===n?' on':'')+'" data-dl="toscore" data-k="'+c[0]+'" data-n="'+n+'">'+n+'</button>';}).join(' ')
        +'</span></div>';}).join('');
  var verdict;
  if(r.stopped.length){
    var names=r.stopped.map(function(k){return TO_STOPS.filter(function(s){return s[0]===k;})[0];});
    verdict='<span class="ch bad" title="'+names.map(function(s){return s[2];}).join('; ')+'">Не брать · '+names[0][1]
      +(names.length>1?' +'+(names.length-1):'')+'</span>';
  }else if(r.verdict==null){
    verdict='<span class="secpart">осталось '+r.left+'</span>';
  }else{
    verdict='<b>'+r.points+'</b> / 100 '
      +(r.verdict==='take'?'<span class="ch ok">Брать</span>'
       :r.verdict==='cond'?'<span class="ch warn">На условиях</span>'
       :'<span class="ch bad">Не брать</span>');
    if(r.verdict==='cond')verdict+='<div class="chips"><span class="ch">Платное обследование</span>'
      +'<span class="ch">Предоплата</span><span class="ch">Повышенная цена</span></div>';
  }
  return h+'<div class="sec">Итог</div><div>'+verdict+'</div></div>'
   +'<div class="bar">'
   +'<input class="gi" id="dlTitle" style="max-width:320px" placeholder="Название расчёта" value="'+esc2(D.title)+'">'
   +(can('deal:write')?'<button class="btn primary" data-dl="save">'+(D.uid?'Сохранить':'Сохранить как новый')+'</button>':'')
   +'</div>';
}

function fld(l,inp,hint){return '<label class="fld">'+l+inp
  +(hint?'<span class="fhint">'+hint+'</span>':'')+'</label>';}
// У каждого показателя своя строка «что это». Двенадцать чисел подряд без
// объяснения читаются как стена: непонятно, на какое смотреть и откуда оно.
function met(cls,label,id,subId,exp){
  return '<div class="m'+(cls?' '+cls:'')+'" id="'+id+'Box"><div class="l">'+label+'</div>'
    +'<div class="v"><span id="'+id+'">—</span></div>'
    +(subId?'<div class="sub" id="'+subId+'"></div>':'')
    +(exp?'<div class="exp">'+exp+'</div>':'')+'</div>';
}
// Пока не заполнена стоимость контракта, считать нечего. Показывать
// «0,00 ₽» двенадцать раз — значит делать вид, что расчёт есть.
function noData(id,txt){
  return '<div class="cd est nodatabox" id="'+id+'" style="margin-bottom:4px">'
    +'<svg class="i"><use href="#i-calc"/></svg>'
    +'<b>Пока считать нечего</b><p>'+txt+'</p></div>';
}

function viewSaved(){
  if(D.list===null){loadList();return '<p class="note">Загружаю…</p>';}
  if(!D.list.length)return '<p class="note">Сохранённых расчётов пока нет. Посчитайте сделку на вкладке «Расчёт» и нажмите «Сохранить».</p>';
  return '<table class="dt"><tr><th>Название</th><th style="text-align:right">Выручка</th>'
    +'<th style="text-align:right">Маржа</th><th style="text-align:right">Марж. рент.</th>'
    +'<th style="text-align:right">Прибыль</th><th>Изменён</th><th></th></tr>'
    +D.list.map(function(d){
      var mp=(+d.margin_pct||0)*100;
      return '<tr data-uid="'+esc2(d.uid)+'">'
       +'<td><a href="#" data-dl="open" style="color:var(--red);text-decoration:none">'+esc2(d.title)+'</a></td>'
       +'<td class="tsum">'+rub(d.revenue)+'</td>'
       +'<td class="tsum">'+rub(d.margin)+'</td>'
       +'<td class="tsum">'+pct(mp,2)+'</td>'
       +'<td class="tsum">'+(d.profit==null?'<span style="color:var(--mut)">не считалась</span>':rub(d.profit))+'</td>'
       +'<td style="white-space:nowrap;color:var(--mut)">'+esc2(String(d.updated_at||'').slice(0,16).replace('T',' '))+'</td>'
       +'<td class="xrow" data-dl="drop" title="Удалить расчёт">×</td></tr>';}).join('')
    +'</table>';
}

function viewParams(){
  if(!can('deal:params'))return '<p class="note">Параметры задаёт директор.</p>';
  var p=D.paramsDraft||P();
  return '<div class="sec">Параметры расчёта <span class="hint">общие для всех сделок компании</span></div>'
   +'<div class="grid">'
   +fld('Ставка НДС, %','<input class="gi" id="dpVat" inputmode="decimal" value="'+esc2(p.vatPct)+'" placeholder="0">',
        'Ставка, по которой компания работает сейчас.')
   +fld('Доля постоянных затрат, %','<input class="gi" id="dpFixed" inputmode="decimal" value="'+esc2(p.fixedSharePct)+'" placeholder="0">',
        'Постоянные затраты за 6 месяцев ÷ выручку за те же 6 месяцев. Подробнее — внизу страницы.')
   +fld('Альтернативная доходность, % годовых','<input class="gi" id="dpRate" inputmode="decimal" value="'+esc2(p.moneyRatePct)+'" placeholder="0">',
        'Чего компания лишается, вложив деньги в проект: вклад, кредит или своя рентабельность.')
   +fld('Целевая маржинальность, %','<input class="gi" id="dpTarget" inputmode="decimal" value="'+esc2(p.targetMarginPct)+'" placeholder="0">',
        'Планка, от которой считаются отклонение и максимальная скидка.')
   +fld('Заметка (откуда цифры)','<input class="gi" id="dpNote" value="'+esc2((D.params||{}).note||'')+'" placeholder="напр.: ОПиУ Финолог, янв–июн">',
        'Чтобы через полгода было понятно, из какого отчёта взяты доли.')
   +'</div>'
   +viewToParams()
   +'<div class="bar"><button class="btn primary" data-dl="psave">Сохранить параметры</button>'
   +'<span class="grow"></span><span class="note" style="margin:0">'
   +((D.params&&D.params.updated_at)?('Последняя правка: '+esc2(String(D.params.updated_at).slice(0,16).replace('T',' '))):'Ещё не заполнялись')
   +'</span></div>'
   +'<p class="note"><b>Доля постоянных затрат</b> — сколько процентов выручки уходит на затраты, которые компания несёт независимо от этого контракта: '
   +'зарплаты административного и инженерного состава, аренда, связь, РКО, проценты по кредитам. '
   +'Считается вне системы: постоянные затраты за последние 6 месяцев ÷ выручку за те же 6 месяцев. В базе нет ни актов, ни оплат, поэтому вывести это значение изнутри система пока не может — его переносят руками. Пересматривать раз в месяц.</p>'
   +'<p class="note"><b>Альтернативная доходность</b> — ставка, по которой оценивается стоимость денег, замороженных в авансе за оборудование. '
   +'Процент по вкладу, ставка кредита или собственная рентабельность — что вернее описывает, чего компания лишается, вложив эти деньги в проект. '
   +'На движение денег не влияет: это аналитический показатель.</p>'
   +'<p class="note"><b>Целевая маржинальность</b> — планка, от которой считаются отклонение и максимальная скидка. '
   +'Выше 1/(1+НДС) — при ставке 20 % это 83,33 % — цель недостижима ни при какой цене.</p>';
}

function viewToParams(){
  var tf=(D.paramsDraft&&D.paramsDraft.tf)||toCfg(), err=tfErr(tf);
  var inp=function(id,v){return '<input class="gi" id="'+id+'" inputmode="numeric" value="'+esc2(v)+'">';};
  return '<div class="sec">Фильтр ТО <span class="hint">веса в сумме 100</span></div>'
   +'<div class="grid">'
   +TO_CRIT.map(function(c){return fld(c[1],inp('dpW_'+c[0],tf.weights[c[0]]));}).join('')
   +fld('Брать от',inp('dpTake',tf.take))
   +fld('Условия от',inp('dpCond',tf.cond))
   +'</div>'
   +'<div class="errbox" id="dpTfErr" style="margin-top:12px'+(err?'':';display:none')+'">'+esc2(err)+'</div>';
}
function readTf(){
  var w={}; TO_CRIT.forEach(function(c){w[c[0]]=num(g('dpW_'+c[0]).value);});
  return {weights:w,take:num(g('dpTake').value),cond:num(g('dpCond').value)};
}

// ══ ПЕРЕСЧЁТ ═══════════════════════════════════════════════════════════
function readForm(){
  if(g('dlTitle'))D.title=g('dlTitle').value;
  if(!g('dlRevenue'))return;
  D.form.revenue=g('dlRevenue').value;
  D.form.months=g('dlMonths').value;
  D.form.advancePct=g('dlAdvance').value;
  D.form.bonus=g('dlBonus').value;
  D.form.partner=g('dlPartner').value;
  D.form.cashFee=g('dlCash').value;
}
function set(id,txt,cls){var e=g(id);if(!e)return;e.textContent=txt;
  if(cls!==undefined){var b=g(id+'Box');if(b){b.classList.remove('good','bad');if(cls)b.classList.add(cls);}}}
function sub(id,txt){var e=g(id);if(e)e.textContent=txt||'';}

function computeDeal(){
  if(!g('dlRevenue'))return;
  var p=P(),r=dealCompute(D.form,p);
  var full=can('deal:params');
  // Пока стоимость контракта пуста, вместо двенадцати нулей стоит объяснение.
  // Переключаем классом, а не перерисовкой: перерисовка выбивала бы каретку
  // из поля после первой же введённой цифры.
  var dv=g('dealView'); if(dv)dv.classList.toggle('nodata',!(num(D.form.revenue)>0));

  set('dlMargin',rub(r.margin),r.margin>0?'good':(r.margin<0?'bad':''));
  set('dlMarginPct',pct(r.marginPct*100,2),r.marginPct>=p.targetMarginPct/100?'good':'');
  sub('dlMarginSub','цель '+pct(p.targetMarginPct,2));
  set('dlDirect',rub(r.direct));
  sub('dlDirectSub','оборудование '+rub(r.equip.gross)+' · подрядчики '+rub(r.contract.gross)+' · прочие '+rub(r.other.gross));
  set('dlVatDue',rub(r.vatDue),r.vatDue<0?'good':'');
  sub('dlVatSub',r.vatDue<0?'входящий НДС больше исходящего — НДС к возмещению'
                           :('исходящий '+rub(r.R*(r.vat/(1+r.vat)))+' − входящий '+rub(r.vatIn)));
  var dev=r.deviation*100;
  set('dlDev',(dev>0?'+':'')+pct(dev,2),dev>=0?'good':'bad');
  sub('dlDevSub',dev>=0?'выше цели':'ниже цели — скидку давать нельзя');
  if(r.discountPct!=null){
    set('dlDisc',pct(r.discountPct,2),'good');
    sub('dlDiscSub','это '+rub(r.R*r.discountPct/100)+' — цена упадёт до '+rub(r.priceForTarget));
  }else{
    set('dlDisc','не даём скидку','');
    sub('dlDiscSub',r.reachable?'маржинальность ниже целевой':'цель недостижима при этой ставке НДС');
  }

  if(full){
    var canProfit=p.fixedSharePct>0||r.money>0;
    set('dlProfit',rub(r.profit),r.profit>0?'good':'bad');
    sub('dlProfitSub',r.profit<0?'контракт не окупает даже себя'
                                :'останется после постоянных затрат и стоимости денег');
    set('dlProfitPct',pct(r.profitPct*100,2),r.profitPct>0?'good':'bad');
    set('dlFixed',rub(r.fixed));
    sub('dlFixedSub',p.fixedSharePct>0?(pct(p.fixedSharePct,3)+' от выручки'):'доля не заполнена');
    set('dlMoney',rub(r.money));
    sub('dlMoneySub',r.money>0?('аванс '+pct(num(D.form.advancePct),0)+' × '+pct(p.moneyRatePct,2)+' годовых × '+num(D.form.months)+' мес.')
                              :'аванс, срок или ставка не заданы');
    if(r.bep==null){ set('dlBep','нет','bad'); sub('dlBepSub','маржинальная прибыль не положительна — контракт не окупается ни при каком объёме'); }
    else { set('dlBep',rub(r.bep),r.bep<=r.R?'good':'bad');
           sub('dlBepSub',r.bep<=r.R?'цена выше точки безубыточности':'цена НИЖЕ точки безубыточности'); }
    if(r.priceForTarget!=null){ set('dlTarget',rub(r.priceForTarget));
      sub('dlTargetSub','даёт '+pct(p.targetMarginPct,2)+' маржинальности'); }
    else { set('dlTarget','—'); sub('dlTargetSub',r.reachable?'затраты не заданы':'цель выше предела '+pct(r.base*100,2)); }
    void canProfit;
  }

  var m=g('dlMethod');
  if(m){
    var kv=r.vat/(1+r.vat);
    m.innerHTML=''
     +'<b>1.</b> Входящий НДС (только строки «с НДС»): оборудование '+rub(r.equip.tax)+' + подрядчики '+rub(r.contract.tax)+' + прочие '+rub(r.other.tax)+' = <b>'+rub(r.vatIn)+'</b><br>'
     +'<b>2.</b> НДС к уплате: '+rub(r.R)+' × '+pct(r.vat*100,0)+'/'+pct((1+r.vat)*100,0)+' − '+rub(r.vatIn)+' = <b>'+rub(r.vatDue)+'</b><br>'
     +'<b>3.</b> Прямые затраты: '+rub(r.equip.gross+r.contract.gross+r.other.gross)+' + выплаты '+rub(r.extra)+' + НДС '+rub(r.vatDue)+' = <b>'+rub(r.direct)+'</b><br>'
     +'<b>4.</b> Маржинальная прибыль: '+rub(r.R)+' − '+rub(r.direct)+' = <b>'+rub(r.margin)+'</b><br>'
     +'<b>5.</b> Маржинальная рентабельность: '+rub(r.margin)+' ÷ '+rub(r.R)+' = <b>'+pct(r.marginPct*100,4)+'</b><br>'
     +(full?(''
     +'<b>6.</b> Постоянные затраты: '+pct(p.fixedSharePct,4)+' × '+rub(r.R)+' = <b>'+rub(r.fixed)+'</b><br>'
     +'<b>7.</b> Стоимость денег: '+rub(r.equip.gross)+' × '+pct(num(D.form.advancePct),0)+' × '+pct(p.moneyRatePct,2)+' ÷ 12 × '+num(D.form.months)+' мес. = <b>'+rub(r.money)+'</b><br>'
     +'<b>8.</b> Точка безубыточности: '+rub(r.fixed)+' ÷ '+pct(r.marginPct*100,4)+' = <b>'+(r.bep==null?'нет':rub(r.bep))+'</b><br>'
     +'<b>9.</b> Прибыль по контракту: '+rub(r.margin)+' − '+rub(r.fixed)+' − '+rub(r.money)+' = <b>'+rub(r.profit)+'</b><br>'):'')
     +'<b>'+(full?'10':'6')+'.</b> Затраты, не зависящие от цены: K = '+rub(r.equip.gross+r.contract.gross+r.other.gross+r.extra)+' − входящий НДС '+rub(r.vatIn)+' = <b>'+rub(r.K)+'</b>. '
     +'Отсюда маржа = Выручка ÷ '+((1+r.vat).toLocaleString('ru-RU'))+' − K, и цена под целевую маржинальность '+pct(p.targetMarginPct,2)+' равна '
     +'K ÷ ('+pct(r.base*100,4)+' − '+pct(p.targetMarginPct,2)+') = <b>'+(r.priceForTarget==null?'недостижима':rub(r.priceForTarget))+'</b>. '
     +'<span style="color:var(--mut)">Так же считается и максимальная скидка — подбирать перебором, как в Excel, нечего.</span>'
     +(kv?'':'<br><span style="color:var(--mut)">Ставка НДС нулевая — НДС в расчёте не участвует.</span>');
  }
}

// ══ ДЕЙСТВИЯ ═══════════════════════════════════════════════════════════
async function saveDeal(asCopy){
  if(D.busy)return;
  readForm();
  var p=P(),r=dealCompute(D.form,p);
  if(!num(D.form.revenue)){toast('Заполните стоимость контракта');return;}
  var uid=(asCopy||!D.uid)?('dl'+Date.now().toString(36)+rid()):D.uid;
  D.busy=true;
  try{
    await api('/deals/'+encodeURIComponent(uid),{method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        title:D.title||('Сделка на '+rub(r.R)),
        spec_uid:D.specUid||null,
        revenue:r.R, direct_cost:r.direct, margin:r.margin, margin_pct:r.marginPct,
        // Прибыль не считалась, если доля постоянных не заполнена. NULL, а не
        // ноль: ноль означал бы «посчитали и вышло ноль».
        profit:(p.filled&&p.fixedSharePct>0)?r.profit:null,
        // Параметры кладём в снимок: иначе прошлый расчёт перепишется задним
        // числом, когда директор в следующем месяце поменяет долю постоянных.
        data:{equip:D.form.equip,contract:D.form.contract,other:D.form.other,
              revenue:D.form.revenue,months:D.form.months,advancePct:D.form.advancePct,
              bonus:D.form.bonus,partner:D.form.partner,cashFee:D.form.cashFee,
              toFilter:D.form.toFilter,params:p}
      })});
    D.uid=uid; D.list=null; D.savedFixed=null; toast('Расчёт сохранён');
    render();
  }catch(e){ toast('Не сохранилось: '+e.message,4000); }
  finally{ D.busy=false; }
}

async function openDeal(uid){
  try{
    var d=await api('/deals/'+encodeURIComponent(uid));
    var f=d.data||{};
    D.form={revenue:f.revenue!=null?f.revenue:d.revenue,
            months:f.months||'',advancePct:f.advancePct||'100',
            bonus:f.bonus||'',partner:f.partner||'',cashFee:f.cashFee||'',
            equip:f.equip&&f.equip.length?f.equip:[{name:'',sum:'',vat:true}],
            contract:f.contract&&f.contract.length?f.contract:[{name:'',sum:'',vat:true}],
            other:f.other&&f.other.length?f.other:[{name:'',sum:'',vat:true}],
            toFilter:{stop:(f.toFilter||{}).stop||{},score:(f.toFilter||{}).score||{}}};
    D.uid=d.uid; D.title=d.title; D.specUid=d.spec_uid||null; D.tab='calc';
    // Параметры компании могли измениться с момента расчёта. Считаем по
    // текущим — иначе на экране будет цифра, которую сегодня не воспроизвести,
    // а прежнюю долю помним, чтобы viewCalc назвал расхождение.
    D.savedFixed=f.params?(+f.params.fixedSharePct||0):null;
    render();
  }catch(e){ toast('Не открылось: '+e.message,4000); }
}

async function saveParams(){
  if(D.busy)return; D.busy=true;
  try{
    var body={vat_pct:g('dpVat').value, fixed_share_pct:g('dpFixed').value,
              money_rate_pct:g('dpRate').value, target_margin_pct:g('dpTarget').value,
              note:g('dpNote').value, to_filter:readTf()};
    var err=tfErr(body.to_filter); if(err){toast(err,4000);return;}
    D.params=await api('/deal/params',{method:'PUT',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    D.paramsDraft=null; toast('Параметры сохранены'); render();
  }catch(e){ toast('Не сохранилось: '+e.message,5000); }
  finally{ D.busy=false; }
}

// Шапка показывает объект, как в смете, а не название раздела: раздел уже
// отмечен в меню. Расчет без сметы объекта не знает — шапка пустая.
function dealHeader(){
  var on=g('objname'), dv=g('dealView');
  if(!on||!dv||dv.style.display==='none')return;
  var s=D.specUid?specs.filter(function(x){return x.id===D.specUid;})[0]:null;
  on.textContent=s?s.title:'';
}
function render(){ dealHeader(); if(window.renderDeal)renderDeal(); }

// ══ СОБЫТИЯ ════════════════════════════════════════════════════════════
document.addEventListener('click',function(e){
  var t=e.target.closest&&e.target.closest('[data-dl]'); if(!t)return;
  var a=t.dataset.dl;
  if(a==='tab'){ readForm(); D.tab=t.dataset.t; if(D.tab==='saved')D.list=null; render(); return; }
  if(a==='meth'){ readForm(); D.meth=!D.meth; render(); return; }
  if(a==='drifthide'){ readForm(); D.savedFixed=null; render(); return; }
  if(a==='add'){ readForm(); D.form[t.dataset.k].push({name:'',sum:'',vat:true}); render(); return; }
  if(a==='del'){ readForm(); var tr=t.closest('tr'); var k=tr.dataset.k,i=+tr.dataset.i;
    D.form[k].splice(i,1);
    // Последнюю строку не убираем совсем — пустая таблица без единого поля
    // не даёт куда вводить, и приходится переоткрывать раздел.
    if(!D.form[k].length)D.form[k].push({name:'',sum:'',vat:true});
    render(); return; }
  if(a==='save'){ e.preventDefault(); saveDeal(false); return; }
  if(a==='saveas'){ e.preventDefault(); saveDeal(true); return; }
  if(a==='reset'){
    var wipe=function(){D.form=blank(); D.uid=null; D.title=''; D.specUid=null; D.savedFixed=null; render();
      if(typeof toast==='function')toast('Расчёт очищен');};
    if(window.UI&&UI.confirm)UI.confirm({title:'Очистить расчёт?',
      text:'Все введённые суммы и строки затрат будут стёрты.',
      warn:'Несохранённое вернуть нельзя.',ok:'Очистить',okIcon:'i-trash'})
      .then(function(y){if(y)wipe();});
    else if(confirm('Очистить расчёт? Несохранённое пропадёт.'))wipe();
    return; }
  if(a==='usetarget'){ readForm(); var r=dealCompute(D.form,P());
    if(r.priceForTarget==null){toast('Целевая маржинальность недостижима при этих затратах');return;}
    D.form.revenue=String(Math.round(r.priceForTarget*100)/100); render();
    toast('Подставил цену под целевую маржинальность'); return; }
  if(a==='open'){ e.preventDefault(); openDeal(t.closest('tr').dataset.uid); return; }
  if(a==='drop'){ var uid=t.closest('tr').dataset.uid;
    var kill=function(){
      api('/deals/'+encodeURIComponent(uid),{method:'DELETE'})
        .then(function(){ if(D.uid===uid){D.uid=null; D.savedFixed=null;} D.list=null; toast('Расчёт удалён'); render(); })
        .catch(function(err){ toast('Не удалилось: '+err.message,4000); });};
    if(window.UI&&UI.confirm)UI.confirm({title:'Удалить расчёт?',
      text:'Сохранённый расчёт пропадёт из списка.',warn:'Это не отменяется.',
      ok:'Удалить',okIcon:'i-trash'}).then(function(y){if(y)kill();});
    else if(confirm('Удалить расчёт? Это не отменяется.'))kill();
    return; }
  if(a==='psave'){ e.preventDefault(); saveParams(); return; }
  if(a==='tostop'){ readForm(); D.form.toFilter.stop[t.dataset.k]=t.checked; render(); return; }
  // Повторное нажатие на выбранный балл снимает ответ.
  if(a==='toscore'){ readForm(); var sc=D.form.toFilter.score,k=t.dataset.k,n=+t.dataset.n;
    if(sc[k]!=null&&sc[k]!==''&&+sc[k]===n)delete sc[k]; else sc[k]=n;
    render(); return; }
  if(a==='toparams'){ e.preventDefault(); D.tab='params'; go('deal'); return; }
});

// Ввод в строках таблиц пишем в состояние БЕЗ перерисовки: перерисовка на
// каждый символ уводила бы курсор из поля.
document.addEventListener('input',function(e){
  var dv=g('dealView'); if(!dv||dv.style.display==='none')return;
  if(!e.target.closest||!e.target.closest('#dealView'))return;
  var c=e.target.closest('[data-dl="cell"]');
  if(c){ var tr=c.closest('tr'); var row=D.form[tr.dataset.k][+tr.dataset.i];
    if(row){ var f=c.dataset.f; row[f]= f==='vat' ? (c.value==='1') : c.value; } }
  else if(D.tab==='params'){
    D.paramsDraft={vatPct:g('dpVat').value,fixedSharePct:g('dpFixed').value,
                   moneyRatePct:g('dpRate').value,targetMarginPct:g('dpTarget').value,tf:readTf()};
    var err=tfErr(D.paramsDraft.tf), eb=g('dpTfErr');
    if(eb){eb.textContent=err; eb.style.display=err?'':'none';}
    return;
  }
  else readForm();
  if(D.tab==='calc')computeDeal();
});
document.addEventListener('change',function(e){
  var dv=g('dealView'); if(!dv||dv.style.display==='none')return;
  if(!e.target.closest||!e.target.closest('#dealView'))return;
  var c=e.target.closest('[data-dl="cell"]');
  if(c&&c.dataset.f==='vat'){ var tr=c.closest('tr'); var row=D.form[tr.dataset.k][+tr.dataset.i];
    if(row)row.vat=(c.value==='1'); }
  if(D.tab==='calc')computeDeal();
});

// ── подключение раздела ──
// Тот же приём, что у «Закупок» и «Смены»: оборачиваем go(), свой экран
// показываем сами, всё остальное отдаём дальше по цепочке.
var _goDeal=window.go;
window.go=function(view){
  var dv=g('dealView');
  if(view!=='deal'){ if(dv)dv.style.display='none'; return _goDeal(view); }
  if(!can('deal:read')){ toast('Расчёт сделки доступен директору, администратору и менеджеру'); return; }
  drawer(false); if(window.fseTrack)fseTrack('view:deal');
  document.querySelectorAll('.nav[data-go]').forEach(function(n){
    n.classList.toggle('act',n.dataset.go==='deal');});
  if(!dv){ dv=document.createElement('div'); dv.id='dealView';
           $('#specsView').parentNode.appendChild(dv); }
  hideViewsExcept('dealView');
  dv.style.display='';
  render();
  if(!D.paramsLoaded)loadParams();
};

// ГОНКА: applyRoleNav мог отработать по ответу /auth/me ДО того, как этот
// блок добавил свой пункт в SECT_SCOPE — тогда «Сделка» осталась бы скрытой
// у тех, кому она положена. Переприменяем. Та же причина, что в «Закупках».
try{ if(typeof applyRoleNav==='function')applyRoleNav(); }catch(e){}

// Раздел выдан администратору и директору; в разделе «Настройки» (он же
// только у администратора) даём прямую ссылку на параметры — чтобы их не
// пришлось искать во вкладке калькулятора.

// Карточка в «Настройках». Оборачиваем renderUsersAdmin, а не правим её:
// свой блок дописываем после того, как она закончила рисовать пользователей.
// Так «Настройки» остаются одним экраном, а этот файл — аддитивным.
if(typeof window.renderUsersAdmin==='function'){
  var _rua=window.renderUsersAdmin;
  window.renderUsersAdmin=async function(){
    await _rua.apply(this,arguments);
    if(!can('deal:params'))return;
    var v=document.getElementById('settingsView'); if(!v)return;
    if(v.querySelector('#dealParamsCard'))return;
    var box=document.createElement('div');
    box.id='dealParamsCard';
    box.style.cssText='padding:0 16px 24px;max-width:980px';
    var p=D.params;
    var line=p&&p.filled
      ? ('Доля постоянных затрат '+pct(+p.fixed_share_pct,3)
         +' · альтернативная доходность '+pct(+p.money_rate_pct,2)
         +' · целевая маржинальность '+pct(+p.target_margin_pct,2))
      : 'Не заполнены — прибыль по контракту и точка безубыточности не считаются.';
    box.innerHTML='<h2 style="margin:18px 0 4px">Параметры расчёта сделки</h2>'
      +'<p style="color:var(--mut);margin:0 0 10px;font-size:13px">'+esc2(line)+'</p>'
      +'<button class="btn" data-dl="toparams">Открыть параметры</button>';
    v.appendChild(box);
    if(!D.paramsLoaded)loadParams();
  };
}
})();
