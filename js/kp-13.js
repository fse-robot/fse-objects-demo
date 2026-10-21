/* ── Блок 13. Инженерные расчёты по СП 485.1311500.2020 ────────────────
   MCALC — вкладка «Расчёты» внутри раздела «Смена» (kp-03). Два счёта,
   которые на объекте нужны чаще всего: масса ГОТВ (Прил. Д) и площадь
   проёма сброса избыточного давления, КСИД (Прил. Ж, формула Ж.1).

   Считается на устройстве, без сервера: исполнителю нужен ответ там, где
   связи может не быть.

   Показываются промежуточные величины и «Ход расчёта» с подстановкой
   чисел — результат должен проверяться, а не приниматься на веру. Точную
   массу, число модулей и форму проёмов определяет проект. */
(function(){
if(window.__calcV1)return; window.__calcV1=true;

/* ГОТВ: плотность при 20 °C и нормативная объёмная концентрация, Прил. Г.
   liq — сжиженное газовое ОТВ; у сжатых и инертных концентрация входит
   в массу логарифмом, а не отношением. */
var GAS=[
  {k:'125',n:'Хладон-125ХП',   r0:5.208, cn:9.8,  liq:1},
  {k:'227',n:'Хладон-227еа',   r0:7.28,  cn:7.2,  liq:1},
  {k:'fk', n:'ФК-5-1-12',      r0:13.6,  cn:4.2,  liq:1},
  {k:'co2',n:'СО₂ (углекислота)', r0:1.83, cn:34.9, liq:1},
  {k:'n2', n:'Азот',           r0:1.17,  cn:34.6, liq:0}
];
/* K₃ — коэффициент типа ГОТВ в формуле Ж.1 */
var K3=[['1','Сжиженное ГОТВ (1)'],['2.4','Азот (2,4)'],
        ['2.66','Аргон (2,66)'],['2.44','Инерген (2,44)']];

/* Поля хранятся строками: пустая строка в расширенных параметрах ГОТВ
   означает «взять из таблицы по выбранному ГОТВ», и выбор газа её
   возвращает в это состояние. */
var C={mode:'gotv',adv:false,meth:false,
  g:{gas:'125',L:'6',B:'8.4',H:'3.4',Tm:'18',Fn:'0',r0:'',cn:'',liq:'',K1:'1.05'},
  s:{Mr:'88.5',rho1:'5.24',Ppr:'0.003',K3:'1',
     Pa:'0.1013',rhoa:'1.2',tau:'10',K1:'1.05',K2:'1.2'}};

function ic(n){return '<svg class="i"><use href="#'+n+'"/></svg>';}
function num(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return isNaN(n)?0:n;}
function gasOf(k){for(var i=0;i<GAS.length;i++)if(GAS[i].k===k)return GAS[i];return GAS[0];}
function ru(x,d){var p=Math.pow(10,d);
  return (Math.round((isFinite(x)?x:0)*p)/p).toLocaleString('ru-RU',
    {minimumFractionDigits:d,maximumFractionDigits:d});}

/* ══ ЯДРО РАСЧЁТА ═══════════════════════════════════════════════════════
   Формулы и коэффициенты — из закрытого PR #1 (задача #47), методика та же,
   что на gasbase.ru/kalkulyatory. Контрольные значения закреплены
   в tests/sp485-compute.spec.js. */

/* Прил. Д: масса ГОТВ для объёмного тушения.
   Вход: L, B, H, Tm, Fn, r0, cn, liq, K1. */
function gotvCompute(f){
  var Vr=num(f.L)*num(f.B)*num(f.H);
  var H=num(f.H), cn=num(f.cn), r0=num(f.r0);
  var rho1=r0*293/(273+num(f.Tm));
  var sigma=Vr>0?num(f.Fn)/Vr:0;
  var K2=0.4*sigma*10*Math.sqrt(H>0?H:0);
  var conc=cn>0&&cn<100?(f.liq?cn/(100-cn):Math.log(100/(100-cn))):0;
  var Mr=Vr>0?Vr*rho1*(1+K2)*conc:0;
  return {Vr:Vr,rho1:rho1,sigma:sigma,K2:K2,conc:conc,Mr:Mr,Mg:num(f.K1)*Mr};
}

/* Прил. Ж, формула Ж.1: площадь проёма сброса избыточного давления.
   Вход: Mr, rho1, Ppr, K3, Pa, rhoa, tau, K1, K2. Fc ≤ 0 — проём не нужен. */
function ksidCompute(f){
  var Pa=num(f.Pa), rho1=num(f.rho1), tau=num(f.tau);
  var inner=7e6*Pa*(Math.pow((num(f.Ppr)+Pa)/Pa,0.2857)-1);
  var Fc=(inner>0&&rho1>0&&tau>0&&Pa>0)
    ?(num(f.K2)*num(f.K3)*num(f.Mr))/(0.7*num(f.K1)*tau*rho1)*Math.sqrt(num(f.rhoa)/inner)
    :0;
  return {inner:inner,Fc:Fc,D:Fc>0?Math.sqrt(Fc*4/Math.PI)*1000:0};
}
window.gotvCompute=gotvCompute; window.ksidCompute=ksidCompute;

/* Расширенные параметры ГОТВ пусты, пока их не трогали, — подставляем таблицу */
function gotvFields(){
  var g=gasOf(C.g.gas), f={}, k;
  for(k in C.g)if(Object.prototype.hasOwnProperty.call(C.g,k))f[k]=C.g[k];
  f.r0=C.g.r0===''?g.r0:C.g.r0;
  f.cn=C.g.cn===''?g.cn:C.g.cn;
  f.liq=C.g.liq===''?!!g.liq:C.g.liq==='1';
  return f;
}

/* ══ РАЗМЕТКА ══════════════════════════════════════════════════════════ */

function fld(id,lab,val,wide){
  return '<div class="fcell'+(wide?' wide':'')+'"><div class="flab">'+lab+'</div>'
    +'<input class="fin n mcin" id="'+id+'" inputmode="decimal" value="'+val+'"></div>';
}
function sel(id,lab,opts){
  return '<div class="fcell"><div class="flab">'+lab+'</div>'
    +'<select class="fin mcsel" id="'+id+'">'+opts+'</select></div>';
}
function card(cls,icon,lab,val,unit,det){
  return '<div class="k '+cls+'"><div class="r"><div class="ic">'+ic(icon)+'</div>'
    +'<div style="min-width:0"><div class="lb">'+lab+'</div>'
    +'<div class="vl n">'+val+(unit?' <small>'+unit+'</small>':'')+'</div>'
    +(det?'<div class="dl" style="color:var(--mut)">'+det+'</div>':'')
    +'</div></div></div>';
}
/* Раскрытие переключает общий узел из kp-09 по классу .acch — свой обработчик
   для этого не нужен, нужно только запомнить состояние (см. ниже). */
function acc(key,open,title,right,body){
  return '<div class="acc'+(open?' op':'')+'"><div class="acch" data-mc="'+key+'">'
    +'<div class="nm"><b>'+title+'</b></div>'
    +(right?'<div class="rt">'+right+'</div>':'')
    +'<svg class="i chv"><use href="#i-down"/></svg></div>'
    +'<div class="accb">'+body+'</div></div>';
}

function gotvForm(){
  var f=gotvFields();
  var opts=GAS.map(function(x){
    return '<option value="'+x.k+'"'+(x.k===C.g.gas?' selected':'')+'>'+x.n+'</option>';}).join('');
  return '<div class="sec">Защищаемое помещение</div>'
    +'<div class="fgrid">'
    +fld('mcL','Длина L, м',C.g.L)
    +fld('mcB','Ширина B, м',C.g.B)
    +fld('mcH','Высота H, м',C.g.H)
    +fld('mcTm','Температура Тм, °C',C.g.Tm)
    +fld('mcFn','Открытые проёмы Fн, м²',C.g.Fn)
    +sel('mcGas','ГОТВ',opts)
    +'</div>';
}
function gotvAdv(){
  var f=gotvFields();
  return '<div class="fgrid">'
    +fld('mcR0','ρ₀, кг/м³ при 20 °C',f.r0)
    +fld('mcCn','Нормативная концентрация Cн, %',f.cn)
    +sel('mcLiq','Тип ГОТВ',
       '<option value="1"'+(f.liq?' selected':'')+'>Сжиженное — Cн/(100−Cн)</option>'
      +'<option value="0"'+(f.liq?'':' selected')+'>Сжатое или инертное — ln[100/(100−Cн)]</option>')
    +fld('mcK1','Коэффициент запаса K₁',C.g.K1)
    +'</div>'
    +'<p class="note" style="margin-top:10px">ρ₀ и Cн подставлены по выбранному ГОТВ '
    +'(Прил. Г СП 485) — уточните по паспорту модуля. K₁ — запас массы, п. 9.6.3.</p>';
}
function ksidForm(){
  var opts=K3.map(function(x){
    return '<option value="'+x[0]+'"'+(x[0]===C.s.K3?' selected':'')+'>'+x[1]+'</option>';}).join('');
  return '<div class="sec">Проём сброса избыточного давления</div>'
    +'<div class="fgrid">'
    +fld('mcSMr','Масса ГОТВ Мр, кг',C.s.Mr)
    +fld('mcSRho','Плотность ρ₁, кг/м³',C.s.rho1)
    +fld('mcSPpr','Допустимое давление Pпр, МПа',C.s.Ppr)
    +sel('mcSK3','Тип ГОТВ (K₃)',opts)
    +'</div>';
}
function ksidAdv(){
  return '<div class="fgrid">'
    +fld('mcSPa','Атмосферное давление Pа, МПа',C.s.Pa)
    +fld('mcSRhoa','Плотность воздуха ρа, кг/м³',C.s.rhoa)
    +fld('mcSTau','Время подачи τ, с',C.s.tau)
    +fld('mcSK1','Коэффициент K₁',C.s.K1)
    +fld('mcSK2','Коэффициент K₂',C.s.K2)
    +'</div>'
    +'<p class="note" style="margin-top:10px">Значения по умолчанию из Прил. Ж СП 485. '
    +'Pпр — давление, которое выдерживают конструкции помещения, обычно 0,003 МПа.</p>';
}

/* Результаты и «Ход расчёта» перерисовываются отдельно от формы: полная
   перерисовка раздела на каждую цифру уводила бы курсор из поля. */
/* Итог и промежуточные величины — двумя рядами, а не одним: в общем ряду
   карточка показателя сжимается до ширины, на которой число обрезается. */
function gotvOut(){
  var f=gotvFields(), r=gotvCompute(f), on=r.Vr>0;
  return '<div id="mcOut"><div class="kp">'
    +card('acc','i-cyl','Расчётная масса Мр',on?ru(r.Mr,1):'—','кг',
        'по объёму и концентрации')
    +card('ok','i-cyl','Масса в установке Мг',on?ru(r.Mg,1):'—','кг',
        'с коэффициентом запаса K₁')
    +'</div><div class="kp">'
    +card('info','i-bld','Объём Vр',on?ru(r.Vr,1):'—','м³','L · B · H')
    +card('info','i-gauge','Плотность паров ρ₁',on?ru(r.rho1,2):'—','кг/м³','при Тм')
    +card('info','i-wave','Проёмность δ',on?ru(r.sigma,4):'—','м²/м³','Fн / Vр')
    +card('info','i-wave','Коэффициент утечки K₂',on?ru(r.K2,3):'—','','0,4 · δ · 10 · √H')
    +'</div></div>';
}
/* У КСИД промежуточная величина одна — подкоренной множитель, и она стоит
   первым шагом хода расчёта. Отдельной карточкой во всю ширину не выносим. */
function ksidOut(){
  var r=ksidCompute(C.s), on=r.Fc>0;
  return '<div id="mcOut"><div class="kp">'
    +card('acc','i-exp','Площадь проёма Fc',on?ru(r.Fc,3):'не требуется',on?'м²':'',
        'по формуле Ж.1')
    +card('ok','i-gauge','Диаметр проёма',on?ru(r.D,0):'—',on?'мм':'',
        'эквивалентный круглый')
    +'</div></div>';
}
function gotvMeth(){
  var f=gotvFields(), r=gotvCompute(f);
  return '<div class="note" id="mcMeth" style="line-height:1.8">'
    +'<b>1.</b> Объём: Vр = L · B · H = <span class="n">'+ru(num(f.L),2)+' · '+ru(num(f.B),2)
      +' · '+ru(num(f.H),2)+'</span> = <b class="n">'+ru(r.Vr,2)+' м³</b><br>'
    +'<b>2.</b> Плотность паров: ρ₁ = ρ₀ · 293 / (273 + Тм) = <span class="n">'
      +ru(num(f.r0),3)+' · 293 / (273 + '+ru(num(f.Tm),1)+')</span> = <b class="n">'
      +ru(r.rho1,3)+' кг/м³</b><br>'
    +'<b>3.</b> Проёмность: δ = Fн / Vр = <span class="n">'+ru(num(f.Fn),2)+' / '+ru(r.Vr,2)
      +'</span> = <span class="n">'+ru(r.sigma,4)+'</span>; K₂ = 0,4 · δ · 10 · √H = <b class="n">'
      +ru(r.K2,3)+'</b><br>'
    +'<b>4.</b> Масса: Мр = Vр · ρ₁ · (1 + K₂) · '
      +(f.liq?'[Cн/(100−Cн)]':'ln[100/(100−Cн)]')+' = <span class="n">'
      +ru(r.Vr,2)+' · '+ru(r.rho1,3)+' · '+ru(1+r.K2,3)+' · '+ru(r.conc,4)
      +'</span> = <b class="n">'+ru(r.Mr,1)+' кг</b><br>'
    +'<b>5.</b> С запасом: Мг = K₁ · Мр = <span class="n">'+ru(num(f.K1),2)+' · '+ru(r.Mr,1)
      +'</span> = <b class="n">'+ru(r.Mg,1)+' кг</b>'
    +'</div>';
}
function ksidMeth(){
  var f=C.s, r=ksidCompute(f);
  return '<div class="note" id="mcMeth" style="line-height:1.8">'
    +'<b>1.</b> Подкоренной множитель: 7·10⁶ · Pа · [((Pпр + Pа)/Pа)<sup>0,2857</sup> − 1] = '
      +'<span class="n">7·10⁶ · '+ru(num(f.Pa),4)+' · [('+ru((num(f.Ppr)+num(f.Pa))/(num(f.Pa)||1),4)
      +')<sup>0,2857</sup> − 1]</span> = <b class="n">'+ru(r.inner,0)+' Па</b><br>'
    +'<b>2.</b> Площадь: Fc = (K₂ · K₃ · Мр) / (0,7 · K₁ · τ · ρ₁) · √(ρа / …) = '
      +'<span class="n">('+ru(num(f.K2),2)+' · '+ru(num(f.K3),2)+' · '+ru(num(f.Mr),1)+') / (0,7 · '
      +ru(num(f.K1),2)+' · '+ru(num(f.tau),0)+' · '+ru(num(f.rho1),3)+') · √('+ru(num(f.rhoa),2)
      +' / '+ru(r.inner,0)+')</span> = <b class="n">'
      +(r.Fc>0?ru(r.Fc,3)+' м²':'не требуется')+'</b><br>'
    +(r.Fc>0
      ?'<b>3.</b> Диаметр: Ø = √(4 · Fc / π) = <b class="n">'+ru(r.D,0)+' мм</b>'
      :'Fc ≤ 0 — конструкции выдерживают давление, отдельный проём не нужен.')
    +'</div>';
}

function view(){
  var gotv=C.mode==='gotv';
  var tab=function(m,t,i){return '<button class="tb'+(C.mode===m?' on':'')+'" data-act="mc-mode"'
    +' data-m="'+m+'">'+ic(i)+t+'</button>';};
  return '<div class="cd" id="mcBox">'
    +'<div class="pd" style="padding-bottom:0"><div class="tabs">'
      +tab('gotv','Масса ГОТВ','i-cyl')+tab('ksid','Проём КСИД','i-exp')
    +'</div></div>'
    +'<div class="pd" style="padding-bottom:0">'+(gotv?gotvForm():ksidForm())+'</div>'
    +acc('adv',C.adv,'Расширенные параметры',
        gotv?'свойства ГОТВ и запас массы':'условия подачи и коэффициенты',
        gotv?gotvAdv():ksidAdv())
    +'<div class="pd" style="padding-bottom:0">'+(gotv?gotvOut():ksidOut())+'</div>'
    +acc('meth',C.meth,'Ход расчёта','по шагам, с подстановкой чисел',
        gotv?gotvMeth():ksidMeth())
    +'<div class="pd"><p class="note">'
    +(gotv
      ?'Прил. Д СП 485.1311500.2020. Объёмное тушение — классы А, В, С и электрооборудование, '
        +'п. 9.1.2. Точную массу и число модулей определяет проект.'
      :'Прил. Ж СП 485.1311500.2020, формула Ж.1. Форму и число проёмов определяет проект.')
    +'</p></div></div>';
}

/* ══ СОБЫТИЯ ═══════════════════════════════════════════════════════════ */

var IN={mcL:['g','L'],mcB:['g','B'],mcH:['g','H'],mcTm:['g','Tm'],mcFn:['g','Fn'],
  mcR0:['g','r0'],mcCn:['g','cn'],mcK1:['g','K1'],
  mcSMr:['s','Mr'],mcSRho:['s','rho1'],mcSPpr:['s','Ppr'],mcSPa:['s','Pa'],
  mcSRhoa:['s','rhoa'],mcSTau:['s','tau'],mcSK1:['s','K1'],mcSK2:['s','K2']};

function rr(){if(typeof window.renderShift==='function')window.renderShift();}
/* Пересчёт без перерисовки формы: меняются только карточки и ход расчёта */
function repaint(){
  var gotv=C.mode==='gotv';
  var o=document.getElementById('mcOut'); if(o)o.outerHTML=gotv?gotvOut():ksidOut();
  var m=document.getElementById('mcMeth'); if(m)m.outerHTML=gotv?gotvMeth():ksidMeth();
}

document.addEventListener('click',function(ev){
  var el=ev.target.closest&&ev.target.closest('[data-act="mc-mode"]');
  if(el){C.mode=el.dataset.m;rr();return;}
  // kp-09 подключён раньше и к этому моменту уже переключил .op — остаётся
  // снять состояние, иначе переключение калькулятора закрывало бы раскрытое.
  var h=ev.target.closest&&ev.target.closest('.acch[data-mc]');
  if(h)C[h.dataset.mc]=h.parentElement.classList.contains('op');
});
document.addEventListener('input',function(ev){
  var m=IN[ev.target.id]; if(!m)return;
  C[m[0]][m[1]]=ev.target.value; repaint();
});
document.addEventListener('change',function(ev){
  var id=ev.target.id;
  /* Смена ГОТВ возвращает расширенные параметры к табличным */
  if(id==='mcGas'){C.g.gas=ev.target.value;C.g.r0='';C.g.cn='';C.g.liq='';rr();return;}
  if(id==='mcLiq'){C.g.liq=ev.target.value;repaint();return;}
  if(id==='mcSK3'){C.s.K3=ev.target.value;repaint();return;}
});

window.MCALC={view:view};
})();
