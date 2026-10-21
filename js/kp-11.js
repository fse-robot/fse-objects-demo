/* ── Блок 11. Интерактивный план монтажа и «Сверх сметы» ──────────────
   Живут вкладками внутри раздела «Смена» (kp-03): исполнителю на телефоне
   нужен один раздел, а не три. kp-03 зовёт MPLAN.view()/load() и
   MEXTRA.view()/load(), перерисовка — через window.renderShift.

   План: подложка PNG из рабочки (парсер ps_plan_parser.py), приборы —
   маркеры в % кадра. Тап по прибору = та же отметка объёма, что и в
   таблице: сервер пишет ledger.montazh_fact по привязанной строке сметы,
   поэтому план и таблица не могут разойтись.

   Сверх сметы: исполнитель фиксирует факт (название, количество, фото),
   цены проставляет офис, из позиций выпускается акт допработ и
   допсоглашение — печатные формы, подписание на бумаге (решение 18.08). */
(function(){
if(window.__mplanV1)return; window.__mplanV1=true;

var API='/montazh/api';
var NB=' ';

function sess(){try{return localStorage.getItem('fse_session')||''}catch(e){return ''}}
function E(s){return (typeof esc==='function')?esc(s):String(s==null?'':s)
  .replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function money(n){return (n==null?'—':new Intl.NumberFormat('ru-RU').format(Math.round(n))
  .replace(/\s/g,NB)+NB+'₽');}
function opId(){return (typeof opKey==='function')?opKey()
  :('op'+Date.now().toString(36)+Math.random().toString(36).slice(2,10));}
function rr(){if(typeof window.renderShift==='function')window.renderShift();}
function T(m){if(typeof toast==='function')toast(m);}
function qnum(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));
  return isNaN(n)?0:n;}
function qs(n){return String(Math.round((+n||0)*1000)/1000).replace('.',',');}

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
async function apiText(path){
  var r;
  try{r=await fetch(API+path,{headers:{'X-FSE-Session':sess()}});}
  catch(e){throw new Error(window.fseFailText(0,'раздел не загрузился'));}
  if(!r.ok)throw new Error(window.fseFailText(r.status,'раздел не загрузился'));
  return r.text();
}
/* Фото — из галереи или с камеры, сразу несколько. Грузим по одному:
   пачка параллельных запросов с объекта на плохой связи гибнет вся разом. */
async function upFiles(fileList){
  var out=[];
  for(var i=0;i<(fileList?fileList.length:0);i++){
    var fd=new FormData(); fd.append('file',fileList[i]);
    var r=await api('/upload?object_uid='+encodeURIComponent(OBJ.uid),{method:'POST',body:fd});
    if(r&&r.url)out.push({url:r.url,ref:r.ref,type:r.type||'image'});
  }
  return out;
}

/* Просмотр приложенных фото (#109). Как в Смене и ТО: публичной ссылки у
   снимка нет, ручка-прокси требует заголовок сессии, а <img src> его не
   шлёт — тянем сами и показываем blob. Своя мини-галерея, а не общая с
   Табелем: список смен и список отметок плана нарочно не смешиваются. */
var PLPH={urls:[]};
function plphFree(){
  PLPH.urls.forEach(function(u){try{URL.revokeObjectURL(u)}catch(e){}});
  PLPH.urls=[];
}
// devId передаём только там, где снимок можно убрать (карточка прибора) —
// снимать доказательство вправе только тот, кто работу принимает (#106).
function plphThumbs(files,devId){
  var list=(files||[]).filter(function(f){return f&&f.url;});
  if(!list.length)return '';
  var delOk=devId!=null&&typeof can==='function'&&can('media:delete');
  return '<div class="phrow">'+list.map(function(f,i){
    var fid=String(f.url||'').split('/').pop();
    return '<div class="phi" data-act="pl-photo" data-ph="'+E(f.url)+'" title="Фото '+(i+1)+'">'
      +'<div class="phimg"><span class="phw">загрузка…</span></div>'
      +(delOk?('<button class="btn sm danger phdel" data-act="pl-phdel" data-devid="'+E(devId)
        +'" data-fid="'+E(fid)+'" title="Убрать снимок из карточки">'
        +'<svg class="i"><use href="#i-x"/></svg></button>'):'')
      +'</div>';
  }).join('')+'</div>';
}
async function plphLoad(root){
  var items=[].slice.call((root||document).querySelectorAll('.phi[data-ph]'));
  for(var i=0;i<items.length;i++){
    var el=items[i], url=el.getAttribute('data-ph'), box=el.querySelector('.phimg');
    el.removeAttribute('data-ph');           // второй раз тот же файл не тянем
    try{
      var r=await fetch(url,{headers:{'X-FSE-Session':sess()}});
      if(!r.ok)throw new Error('HTTP '+r.status);
      var u=URL.createObjectURL(await r.blob());
      PLPH.urls.push(u); el.dataset.url=u;
      if(box){box.innerHTML='';
        var img=document.createElement('img'); img.alt='Снимок отметки'; img.src=u; box.appendChild(img);}
    }catch(e){
      if(box)box.innerHTML='<span class="phw">снимок не открылся</span>';
    }
  }
}

/* Объект (смета) выбирается один раз на обе вкладки: монтажник работает
   на одном объекте, и заставлять выбирать его дважды — лишний клик. */
var OBJ={uid:'',title:'',list:null,err:''};
async function pickDefault(){
  if(OBJ.uid)return;
  try{
    var c=await api('/shift/current');
    if(c&&c.shift&&c.shift.object_uid){OBJ.uid=c.shift.object_uid;OBJ.title=c.shift.object_name||'';return;}
  }catch(e){}
  if(OBJ.list===null){
    try{OBJ.list=await api('/shift/objects');}catch(e){OBJ.list=[];OBJ.err=e.message;}
    if(OBJ.list&&OBJ.list.length===1){OBJ.uid=OBJ.list[0].uid;OBJ.title=OBJ.list[0].name||'';}
  }
}
function objPicker(act){
  var h='<div class="cd"><div class="cdh"><h2>Выберите объект</h2></div>';
  if(OBJ.list===null)return h+(window.UI?UI.loading(3):'<div class="pd sub">Загрузка…</div>')+'</div>';
  if(!OBJ.list.length)return h+(window.UI?UI.empty({icon:'i-bld',title:'Объектов нет',
    text:'Объект создаётся в разделе «Сметы».'}):'<div class="pd sub">Объектов нет</div>')+'</div>';
  h+=OBJ.list.map(function(o){
    return '<div class="it" style="align-items:center"><div class="ni info">'
      +'<svg class="i"><use href="#i-bld"/></svg></div>'
      +'<div style="min-width:0"><div class="tx" style="font-weight:600">'+E(o.name)+'</div>'
      +(o.customer?'<div class="sb">'+E(o.customer)+'</div>':'')+'</div>'
      +'<button class="btn sm" style="margin-left:auto" data-act="'+act+'" '
      +'data-uid="'+E(o.uid)+'" data-name="'+E(o.name||'')+'" '
      +'title="Открыть объект"><svg class="i"><use href="#i-right"/></svg>'
      +'<span class="lbl">Открыть</span></button></div>';
  }).join('');
  return h+'</div>';
}
function objHead(backAct){
  return '<div class="cdh"><h2 style="min-width:0;overflow:hidden;text-overflow:ellipsis">'
    +E(OBJ.title||'Объект')+'</h2>'
    +'<button class="btn sm io" style="margin-left:auto" data-act="'+backAct+'" '
    +'title="Сменить объект"><svg class="i"><use href="#i-left"/></svg></button></div>';
}

/* ════════════════════════ ПЛАН МОНТАЖА ════════════════════════ */
/* mode: '' — отметки; 'pt' — офис ставит точки; 'sg' — офис рисует участок */
var MP={data:null,sheet:0,filt:'',z:1,tx:0,ty:0,imgs:{},ops:{},busy:false,err:'',
        dragged:false,mode:'',sgPts:[],selSheets:{}};

function mpReset(){MP.data=null;MP.sheet=0;MP.filt='';MP.z=1;MP.tx=0;MP.ty=0;
  MP.mode='';MP.sgPts=[];MP.selSheets={};
  Object.keys(MP.imgs).forEach(function(k){try{URL.revokeObjectURL(MP.imgs[k])}catch(e){}});
  MP.imgs={};}

/* Готовность участка: монтаж 50 %, сварка 30 %, покраска 15 %, опрессовка 5 %.
   Веса нормируются, если стадии в участке нет (стыков ноль). */
function segPct(g){
  var parts=[[0.5,(g.done.mont||0)/Math.max(g.length_m,0.001)],
             [0.15,(g.done.paint||0)/Math.max(g.length_m,0.001)],
             [0.05,Math.min(1,g.done.press||0)]];
  if(g.joints>0)parts.push([0.3,(g.done.weld||0)/g.joints]);
  var wsum=0,acc=0;
  parts.forEach(function(x){wsum+=x[0];acc+=x[0]*Math.min(1,x[1]);});
  return wsum?Math.round(acc/wsum*100):0;
}
function segRows(g){
  return ['pipe','weld','paint','press'].map(function(k){return g.rows[k];})
    .filter(function(x){return x;});
}

async function mpLoad(){
  MP.err='';
  await pickDefault();
  if(!OBJ.uid){rr();return;}
  try{MP.data=await api('/plans?object_uid='+encodeURIComponent(OBJ.uid));}
  catch(e){MP.data={plans:[],rows:[],dtypes:{}};MP.err=e.message;}
  rr();
}

function curSheet(){
  var ps=(MP.data&&MP.data.plans)||[];
  if(!ps.length)return null;
  if(MP.sheet>=ps.length)MP.sheet=0;
  return ps[MP.sheet];
}
function rowOf(rid){
  var rows=(MP.data&&MP.data.rows)||[];
  for(var i=0;i<rows.length;i++)if(String(rows[i].row_id)===String(rid))return rows[i];
  return null;
}
function dtypeRu(t){var d=(MP.data&&MP.data.dtypes)||{};return d[t]||t||'Прочее';}
function plSelN(){return Object.keys(MP.selSheets).filter(function(k){return MP.selSheets[k];}).length;}
function plSelbar(n){
  return '<div class="pd pd0"><div class="selbar on"><b>'+n+'</b><span>выбрано листов</span>'
    +'<button class="btn sm danger" data-act="pl-delsheets" title="Удалить выбранные листы">'
    +'<svg class="i"><use href="#i-trash"/></svg><span class="lbl">Удалить</span></button>'
    +'<button class="btn sm io" data-act="pl-selno" title="Снять выбор">'
    +'<svg class="i"><use href="#i-x"/></svg></button></div></div>';
}

/* embed — план внутри вкладки «Смена». Объект там задан открытой сменой,
   поэтому ни выбора объекта, ни кнопки возврата к списку нет: уводить с
   экрана смены на чужой объект этой кнопке незачем. */
function mpView(embed){
  if(!OBJ.uid)return embed?'':objPicker('pl-obj');
  var h='<div class="cd" id="plmount">'
   +(embed?'<div class="cdh"><h2>План монтажа</h2></div>':objHead('pl-back'));
  if(MP.err)h+='<div class="erin"><svg class="i"><use href="#i-warn"/></svg><span>'+E(MP.err)+'</span></div>';
  if(MP.data===null)return h+(window.UI?UI.loading(4):'<div class="pd sub">Загрузка…</div>')+'</div>';
  var ps=MP.data.plans||[];
  var office=(typeof can==='function')&&can('spec:write');
  if(!ps.length){
    h+=(window.UI?UI.empty({icon:'i-map',title:'Планов у объекта пока нет',
      text:office?'Прогоните PDF рабочки через парсер (ps_plan_parser.py) и загрузите сюда project.json вместе с PNG листов.'
                 :'Планы загружает офис из рабочей документации. Пока их нет, отмечайте объём таблицей — кнопка «Отметить объём» в смене.'})
      :'<div class="pd sub">Планов нет</div>');
    if(office)h+='<div class="pd"><button class="btn" data-act="pl-upload" '
      +'title="Загрузить планы из парсера"><svg class="i"><use href="#i-imp"/></svg>'
      +'<span class="lbl">Загрузить планы</span></button></div>';
    return h+'</div>';
  }

  var sh=curSheet();
  var devs=sh.devices||[];
  var all=[]; ps.forEach(function(p){all=all.concat(p.devices||[]);});
  var doneAll=all.filter(function(d){return d.mark;}).length;
  var pct=all.length?Math.round(doneAll*100/all.length):0;

  /* листы: переключатель нужен только когда есть между чем переключаться,
     а выбор для удаления — всегда, иначе последний лист удалить нечем
     (поймано живьём на объекте с единственным уцелевшим листом) */
  if(ps.length>1||office){
    h+='<div class="pd pd0" style="display:flex;gap:6px;flex-wrap:wrap;padding-top:10px;align-items:center">'
      +ps.map(function(p,i){
        var dn=(p.devices||[]).filter(function(d){return d.mark;}).length;
        var chk=office?('<input type="checkbox" class="plsel" data-id="'+p.id+'"'
          +(MP.selSheets[p.id]?' checked':'')+' title="Выбрать лист «'+E(p.title)+'» для удаления">'):'';
        if(ps.length>1){
          return '<span style="display:inline-flex;align-items:center;gap:3px">'+chk
            +'<button class="btn sm'+(i===MP.sheet?' on':'')+'" data-act="pl-sheet" data-i="'+i+'" '
            +'title="'+E(p.title)+'"><svg class="i"><use href="#i-map"/></svg>'
            +'<span class="lbl">'+E(p.title)+' '+dn+'/'+(p.devices||[]).length+'</span></button></span>';
        }
        return '<span style="display:inline-flex;align-items:center;gap:3px">'+chk
          +'<span class="s">'+E(p.title)+' '+dn+'/'+(p.devices||[]).length+'</span></span>';
      }).join('')+'</div>';
    if(office&&plSelN())h+=plSelbar(plSelN());
  }

  /* прогресс */
  h+='<div class="pd pd0"><div class="s" style="display:flex;gap:8px;align-items:center">'
    +'<span>Смонтировано '+doneAll+' из '+all.length+'</span>'
    +'<span style="margin-left:auto;font-weight:600">'+pct+'%</span></div>'
    +'<div style="height:6px;border-radius:3px;background:var(--soft);overflow:hidden;margin-top:4px">'
    +'<div style="height:100%;width:'+pct+'%;background:var(--grn)"></div></div></div>';

  /* фильтр по типам */
  var types={};
  devs.forEach(function(d){var t=d.dtype||'other';
    (types[t]=types[t]||{n:0,d:0}).n++; if(d.mark)types[t].d++;});
  var chips=Object.keys(types);
  if(chips.length>1){
    h+='<div class="pd pd0" style="display:flex;gap:6px;flex-wrap:wrap">'
      +'<button class="btn sm'+(MP.filt===''?' on':'')+'" data-act="pl-filt" data-t="" '
      +'title="Все приборы"><svg class="i"><use href="#i-filt"/></svg>'
      +'<span class="lbl">Все</span></button>'
      +chips.map(function(t){
        return '<button class="btn sm'+(MP.filt===t?' on':'')+'" data-act="pl-filt" data-t="'+E(t)+'" '
          +'title="'+E(dtypeRu(t))+'"><svg class="i"><use href="#i-filt"/></svg>'
          +'<span class="lbl">'+E(dtypeRu(t))+' '+types[t].d+'/'+types[t].n+'</span></button>';
      }).join('')+'</div>';
  }

  /* сам план: подложка, приборы, участки трассы */
  var segs=sh.segments||[];
  var segSvg='';
  if(segs.length||MP.sgPts.length){
    segSvg='<svg class="plsegs" viewBox="0 0 100 100" preserveAspectRatio="none">'
      +segs.map(function(g){
        var pct=segPct(g);
        var col=pct>=100?'var(--grn)':(pct>0?'var(--amb)':'var(--mut)');
        return '<polyline points="'+E(g.pts)+'" fill="none" stroke="'+col+'" '
          +'stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"'
          +(g.done.mont>0?'':' stroke-dasharray="6 5"')+'/>'
          +'<polyline data-act="pl-segm" data-id="'+g.id+'" points="'+E(g.pts)+'" '
          +'fill="none" stroke="rgba(127,127,127,0.01)" stroke-width="16" '
          +'vector-effect="non-scaling-stroke" style="cursor:pointer"/>';
      }).join('')
      +(MP.sgPts.length?('<polyline points="'
        +MP.sgPts.map(function(pt){return pt.x+','+pt.y;}).join(' ')
        +'" fill="none" stroke="var(--blu)" stroke-width="3" stroke-dasharray="4 4" '
        +'vector-effect="non-scaling-stroke"/>'
        +MP.sgPts.map(function(pt){return '<circle cx="'+pt.x+'" cy="'+pt.y
          +'" r="1.2" fill="var(--blu)"/>';}).join('')):'')
      +'</svg>';
  }
  h+='<div class="pd pd0"><div class="plview'+(MP.mode?' addmode':'')+'" id="plview">'
    +'<div class="plcanvas" id="plcanvas">'
    +'<img id="plimg" alt="План монтажа" draggable="false">'
    +segSvg
    +devs.map(function(d){
      var hid=(MP.filt&&(d.dtype||'other')!==MP.filt);
      var r=d.row_id?rowOf(d.row_id):null;
      var tip=d.label+(d.name?(' · '+d.name):'')
        +(d.mark?(' · смонтирован: '+d.mark.by+' '+d.mark.at
          +(d.mark.photos?(' · фото: '+d.mark.photos):'')):'')
        +(r?(' · по смете '+qs(r.qty_done)+' из '+qs(r.qty_plan)):'');
      return '<span class="pmark t-'+E(d.dtype||'other')+(d.mark?' done':'')+(hid?' hid':'')+'" '
        +'style="left:'+(+d.x)+'%;top:'+(+d.y)+'%" data-act="pl-dev" data-id="'+d.id+'" '
        +'title="'+E(tip)+'"></span>';
    }).join('')
    +'</div>'
    +'<div class="plz">'
    +'<button class="btn sm io" data-act="pl-zin" title="Приблизить"><svg class="i"><use href="#i-plus"/></svg></button>'
    +'<button class="btn sm io" data-act="pl-zout" title="Отдалить"><svg class="i"><use href="#i-minus"/></svg></button>'
    +'<button class="btn sm io" data-act="pl-zfit" title="Показать целиком"><svg class="i"><use href="#i-eye"/></svg></button>'
    +'</div></div>'
    +'<div class="s" style="margin-top:6px">'
    +(MP.mode==='pt'?'Режим точек: нажмите на место на плане — точка привяжется к спецификации.'
     :MP.mode==='sg'?'Режим участка: нажимайте по трассе точку за точкой, затем «Готово». Точек: '+MP.sgPts.length
     :'Нажмите на прибор или участок трубы, чтобы отметить работу. Зелёное — сделано. '
      +'Отметка сразу попадает в объёмы и деньги.')+'</div></div>';

  /* участки списком — на телефоне попасть в линию сложнее, чем в строку */
  if(segs.length){
    h+='<div class="pd pd0"><div class="s" style="font-weight:600;margin-bottom:4px">Технологическая часть — участками</div>'
      +segs.map(function(g){
        var pct=segPct(g);
        return '<div class="segrow" data-act="pl-segm" data-id="'+g.id+'">'
          +'<span class="segdot" style="background:'
          +(pct>=100?'var(--grn)':(pct>0?'var(--amb)':'var(--mut)'))+'"></span>'
          +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'
          +E(g.label)+(g.du?(' · Ду'+E(g.du)):'')+' · '+qs(g.length_m)+' м'
          +(g.joints?(' · стыки '+qs(g.done.weld)+'/'+g.joints):'')
          +(g.photos?(' · фото '+g.photos):'')+'</span>'
          +'<b>'+pct+'%</b></div>';
      }).join('')+'</div>';
  }

  /* сверка со спецификацией: приборы + строки стадий участков */
  var bound={};
  devs.forEach(function(d){if(!d.row_id)return;
    (bound[d.row_id]=bound[d.row_id]||{n:0,d:0}).n++; if(d.mark)bound[d.row_id].d++;});
  segs.forEach(function(g){segRows(g).forEach(function(rid){
    bound[rid]=bound[rid]||{n:0,d:0,seg:true};});});
  var bk=Object.keys(bound);
  if(bk.length){
    h+='<div class="pd pd0"><div class="s" style="font-weight:600;margin-bottom:4px">Сверка со спецификацией — этот лист</div>'
      +bk.map(function(rid){
        var r=rowOf(rid), b=bound[rid];
        if(!r)return '';
        var warn=(!b.seg&&r.qty_plan&&b.n>r.qty_plan)
          ?' <span style="color:var(--amb)">на плане '+b.n+', в смете '+qs(r.qty_plan)+'</span>':'';
        return '<div class="s" style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--soft)">'
          +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+E(r.name)+warn+'</span>'
          +'<b>'+qs(r.qty_done)+' из '+qs(r.qty_plan)+'</b></div>';
      }).join('')+'</div>';
  }
  var unbound=devs.filter(function(d){return !d.row_id;}).length;
  if(unbound&&office){
    h+='<div class="callout">'+unbound+' приборов не привязаны к строкам сметы — их отметки '
      +'не попадут в объёмы и деньги. Нажмите «Привязка к смете».</div>';
  }

  /* журнал последних отметок */
  var log=all.filter(function(d){return d.mark;});
  log.sort(function(a,b){return a.mark.at<b.mark.at?1:-1;});
  if(log.length){
    h+='<div class="pd pd0"><div class="s" style="font-weight:600;margin-bottom:4px">Последние отметки</div>'
      +log.slice(0,8).map(function(d){
        return '<div class="s" style="display:flex;gap:8px;padding:2px 0">'
          +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+E(d.label)
          +(d.name?(' · '+E(d.name)):'')+'</span><span>'+E(d.mark.by)+' · '+E(d.mark.at)+'</span></div>';
      }).join('')+'</div>';
  }

  if(office){
    h+='<div class="pd" style="display:flex;gap:8px;flex-wrap:wrap">'
      +(MP.mode==='sg'
        ?('<button class="btn sm" data-act="pl-sgdone" title="Завершить участок">'
          +'<svg class="i"><use href="#i-ok"/></svg><span class="lbl">Готово ('+MP.sgPts.length+')</span></button>'
          +'<button class="btn sm io" data-act="pl-sgstop" title="Отменить рисование участка">'
          +'<svg class="i"><use href="#i-x"/></svg></button>')
        :('<button class="btn sm'+(MP.mode==='pt'?' on':'')+'" data-act="pl-ptmode" '
          +'title="Ставить точки объёма на план">'
          +'<svg class="i"><use href="#i-pin"/></svg><span class="lbl">Добавить точку</span></button>'
          +'<button class="btn sm" data-act="pl-sgmode" title="Нарисовать участок трассы">'
          +'<svg class="i"><use href="#i-wave"/></svg><span class="lbl">Добавить участок</span></button>'))
      +'<button class="btn sm" data-act="pl-bind" title="Привязать типы приборов к строкам сметы">'
      +'<svg class="i"><use href="#i-link"/></svg><span class="lbl">Привязка к смете</span></button>'
      +'<button class="btn sm" data-act="pl-upload" title="Загрузить планы из парсера">'
      +'<svg class="i"><use href="#i-imp"/></svg><span class="lbl">Загрузить планы</span></button>'
      +'</div>';
  }
  return h+'</div>';
}

/* Подложка и жесты вешаются после отрисовки: view() строит строку. */
function mpApply(){
  var cv=document.getElementById('plcanvas');
  if(!cv)return;
  cv.style.transform='translate('+MP.tx+'px,'+MP.ty+'px) scale('+MP.z+')';
  // Маркеры лежат внутри масштабируемого холста, поэтому scale растил и их:
  // на большом зуме точка прибора закрывала пол-этажа (#140). Отдаём в CSS
  // обратный множитель — сегменты давно защищены non-scaling-stroke,
  // у маркеров аналога нет.
  cv.style.setProperty('--iz', String(1/MP.z));
}
function mpZoomAt(nz,px,py){
  var vw=document.getElementById('plview'); if(!vw)return;
  nz=Math.max(0.5,Math.min(8,nz));
  var box=vw.getBoundingClientRect();
  var x=px-box.left,y=py-box.top;
  MP.tx=x-(x-MP.tx)*nz/MP.z; MP.ty=y-(y-MP.ty)*nz/MP.z; MP.z=nz; mpApply();
}
/* Подложка не пришла — площадь плана остаётся пустой, а тапать по ней
   не по чему. Поэтому причина пишется поверх пустоты словами сервера,
   и подпись одна: повторный вызов её заменяет, а не добавляет. */
function mpImgErr(msg){
  var vw=document.getElementById('plview'); if(!vw)return;
  var b=vw.querySelector('.errbox.over');
  if(!b){b=document.createElement('div'); b.className='errbox over'; vw.appendChild(b);}
  b.textContent=msg;
}
/* Картинка идёт не через api(), а своим fetch — ответ нужен блобом.
   Причину ошибки сервер называет в detail, как и везде. */
async function imgErrText(r){
  var d=null;
  try{d=JSON.parse(await r.text());}catch(e){}
  return (d&&d.detail)?'План не загрузился: '+d.detail
    :window.fseFailText(r.status,'план не загрузился');
}
function mpMount(){
  var vw=document.getElementById('plview'); if(!vw)return;
  var img=document.getElementById('plimg');
  var sh=curSheet();
  if(img&&sh){
    if(MP.imgs[sh.id]){img.src=MP.imgs[sh.id];}
    else if(!MP.imgbusy){
      MP.imgbusy=true;
      (async function(){
        try{
          var r;
          try{r=await fetch(sh.image,{headers:{'X-FSE-Session':sess()}});}
          catch(e){throw new Error(window.fseFailText(0,'план не загрузился'));}
          if(!r.ok)throw new Error(await imgErrText(r));
          var u=URL.createObjectURL(await r.blob());
          MP.imgs[sh.id]=u;
          /* Пока грузили, лист могли переключить — не подставляем чужой */
          var now=curSheet();
          var im2=document.getElementById('plimg');
          if(im2&&now&&now.id===sh.id)im2.src=u;
        }catch(e){
          mpImgErr(e.message);
        }finally{MP.imgbusy=false;}
      })();
    }
  }
  mpApply();
  /* Колёсико — на самом контейнере: нужен preventDefault (passive:false).
     Флаг на элементе, а не в модуле: после перерисовки контейнер новый. */
  if(!vw._wheel){vw._wheel=1;
    vw.addEventListener('wheel',function(e){
      e.preventDefault();
      mpZoomAt(MP.z*(e.deltaY<0?1.18:0.85),e.clientX,e.clientY);
    },{passive:false});
  }
}
/* Пан и щипок — делегированием на документ, один раз на страницу.
   Захват указателя на контейнер не делаем: он перенаправил бы pointerup
   с маркера на контейнер, и тап по прибору перестал бы быть кликом.
   На телефоне работает неявный захват тача, на мыши хватает документа. */
var G={ptrs:{},start:null,pinch:null};
function gDist(){var k=Object.keys(G.ptrs);
  var a=G.ptrs[k[0]],b=G.ptrs[k[1]];return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function gMid(){var k=Object.keys(G.ptrs);
  var a=G.ptrs[k[0]],b=G.ptrs[k[1]];return {x:(a[0]+b[0])/2,y:(a[1]+b[1])/2};}
document.addEventListener('pointerdown',function(e){
  if(!e.target.closest||!e.target.closest('#plview'))return;
  G.ptrs[e.pointerId]=[e.clientX,e.clientY];
  var n=Object.keys(G.ptrs).length;
  if(n===1){G.start={x:e.clientX,y:e.clientY,tx:MP.tx,ty:MP.ty};MP.dragged=false;}
  else if(n===2){G.pinch={d:gDist(),z:MP.z};G.start=null;}
});
document.addEventListener('pointermove',function(e){
  if(!(e.pointerId in G.ptrs))return;
  G.ptrs[e.pointerId]=[e.clientX,e.clientY];
  var n=Object.keys(G.ptrs).length;
  if(n===2&&G.pinch){var m=gMid();mpZoomAt(G.pinch.z*gDist()/G.pinch.d,m.x,m.y);MP.dragged=true;}
  else if(n===1&&G.start){
    var dx=e.clientX-G.start.x,dy=e.clientY-G.start.y;
    if(Math.abs(dx)+Math.abs(dy)>6)MP.dragged=true;
    MP.tx=G.start.tx+dx;MP.ty=G.start.ty+dy;mpApply();
  }
});
function gUp(e){
  if(!(e.pointerId in G.ptrs))return;
  delete G.ptrs[e.pointerId];
  if(Object.keys(G.ptrs).length<2)G.pinch=null;
  if(!Object.keys(G.ptrs).length)G.start=null;
}
document.addEventListener('pointerup',gUp);
document.addEventListener('pointercancel',gUp);

function mpMarkModal(d){
  var r=d.row_id?rowOf(d.row_id):null;
  var info='<div class="fcell wide"><div class="flab">Прибор</div>'
    +'<div style="font-weight:600">'+E(d.label)+(d.name?(' · '+E(d.name)):'')+'</div></div>';
  if(r){
    var left=Math.max(0,(+r.qty_plan||0)-(+r.qty_done||0));
    info+='<div class="fcell wide"><div class="flab">Позиция сметы</div>'
      +'<div>'+E(r.name)+'</div>'
      +'<div class="fnote">Сделано '+qs(r.qty_done)+' из '+qs(r.qty_plan)
      +(r.qty_plan?(' · осталось '+qs(left)+' '+E(r.unit||'')):'')+'</div></div>';
  }else{
    info+='<div class="fcell wide"><div class="fnote warn">Прибор не привязан к строке сметы: '
      +'отметка останется на плане, но не попадёт в объёмы и деньги. Привязку делает офис.</div></div>';
  }
  info+='<div class="fcell wide"><div class="flab">Фото — из галереи или с камеры, несколько</div>'
    +'<input class="fin" type="file" id="dvPhoto" accept="image/*" multiple>'
    +'<div class="fnote">Необязательно сейчас: снимок можно приложить и потом, '
    +'открыв этот же прибор.</div></div>';
  if(!window.UI||!UI.modal){mpMark(d,null);return;}
  if(d.mark){
    // «Приложить фото» и «Снять отметку» — разные действия и разные кнопки:
    // прятать снятие за пустым полем фото было бы сюрпризом.
    var thumbs=plphThumbs(d.mark.files,d.id);
    var m=UI.modal({title:'Прибор смонтирован',
      sub:E(d.mark.by)+' · '+E(d.mark.at)+(d.mark.photos?(' · фото: '+d.mark.photos):''),
      body:(thumbs?('<div class="fcell wide"><div class="flab">Фото отметки</div>'+thumbs+'</div>'):'')
        +info
        +'<div class="fcell wide"><button class="btn sm" data-act="pl-unmk" '
        +'data-id="'+d.id+'" title="Снять отметку — объём и деньги вернутся назад">'
        +'<svg class="i"><use href="#i-x"/></svg>'
        +'<span class="lbl">Снять отметку</span></button></div>',
      ok:'Приложить фото',okIcon:'i-cam',cancel:'Закрыть',
      onOk:function(w){
        var f=w.querySelector('#dvPhoto');
        if(!f||!f.files.length){T('Выберите фото из галереи или закройте окно');return false;}
        mpAddPhotos(d,f.files);
      }});
    MP.devModal=m;
    if(thumbs){
      plphLoad(m.el);
      // Модалка — отдельный узел под body: перерисовка плана её не тронет,
      // blob-ссылки освобождаем сами, когда её закрывают любым способом.
      var watch=new MutationObserver(function(){
        if(!document.body.contains(m.el)){watch.disconnect();plphFree();}
      });
      watch.observe(document.body,{childList:true});
    }
    return;
  }
  UI.modal({title:'Отметить монтаж',
    sub:'Отметка попадёт в общий прогресс и в ваш объём.',
    body:info,
    ok:'Смонтирован',okIcon:'i-ok',
    onOk:function(w){
      var f=w.querySelector('#dvPhoto');
      mpMark(d,(f&&f.files.length)?f.files:null);
    }});
}
function mpUnmarkAsk(d){
  if(!window.UI||!UI.confirm){mpUnmark(d);return;}
  UI.confirm({title:'Снять отметку?',
    text:'Прибор снова станет несмонтированным, объём и деньги по нему уйдут из начисления.',
    ok:'Снять',okIcon:'i-x'}).then(function(ok){if(ok)mpUnmark(d);});
}

async function mpMark(d,fileList){
  if(MP.busy)return; MP.busy=true;
  var op=MP.ops[d.id]||(MP.ops[d.id]=opId());
  try{
    var files=null;
    if(fileList&&fileList.length){T('Загружаю фото…');files=await upFiles(fileList);}
    var res=await api('/plans/mark',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({device_id:d.id,client_op_id:op,files:files})});
    delete MP.ops[d.id];
    T(res&&res.duplicate?'Уже отмечено — повтор не записан':'Отмечено');
    await mpLoad();
  }catch(e){MP.err=e.message;T(e.message);rr();}
  finally{MP.busy=false;}
}
async function mpAddPhotos(d,fileList){
  if(MP.busy)return; MP.busy=true;
  try{
    T('Загружаю фото…');
    var files=await upFiles(fileList);
    if(files.length){
      var r=await api('/plans/devices/'+d.id+'/files',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({files:files})});
      T('Фото приложены: всего '+r.photos);
      await mpLoad();
    }
  }catch(e){T(e.message);}
  finally{MP.busy=false;}
}
async function mpUnmark(d){
  if(MP.busy)return; MP.busy=true;
  try{
    await api('/plans/unmark',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({device_id:d.id})});
    T('Отметка снята');
    await mpLoad();
  }catch(e){MP.err=e.message;T(e.message);rr();}
  finally{MP.busy=false;}
}

/* ── Точка офиса: объём по спецификации или новая позиция ── */
function ptModal(x,y){
  if(!window.UI||!UI.modal)return;
  var rows=(MP.data&&MP.data.rows)||[];
  UI.modal({title:'Новая точка на плане',
    sub:'Точка определяет объём: строка спецификации или новая позиция — она добавится в смету.',
    body:'<div class="fcell wide"><div class="flab">Строка спецификации</div>'
      +'<select class="fin" id="ptRow"><option value="">— новая позиция —</option>'
      +rows.map(function(r){return '<option value="'+E(r.row_id)+'">'+E(r.name)
        +' ('+qs(r.qty_done)+' из '+qs(r.qty_plan)+' '+E(r.unit||'')+')</option>';}).join('')
      +'</select></div>'
      +'<div class="fcell wide"><div class="flab">Название новой позиции</div>'
      +'<input class="fin" id="ptName" placeholder="Если не выбрана строка выше">'
      +'<div class="fnote">Новая позиция попадёт в смету с количеством 1; ещё одна точка с тем же названием добавит ещё 1.</div></div>',
    ok:'Поставить точку',okIcon:'i-pin',
    onOk:function(w){
      var rid=(w.querySelector('#ptRow')||{}).value||'';
      var nm=((w.querySelector('#ptName')||{}).value||'').trim();
      if(!rid&&nm.length<2){T('Выберите строку или впишите название');return false;}
      (async function(){
        try{
          var r=await api('/plans/devices',{method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({plan_id:curSheet().id,x:x,y:y,
              row_id:rid||null,new_name:rid?null:nm})});
          T('Точка '+r.label+' поставлена');
          mpLoad();
        }catch(e){T(e.message);}
      })();
    }});
}

/* ── Участок трассы: рисование и карточка стадий ── */
function guessRow(rx){
  var rows=(MP.data&&MP.data.rows)||[];
  for(var i=0;i<rows.length;i++)
    if(rx.test(String(rows[i].name||'').toLowerCase()))return rows[i].row_id;
  return '';
}
function sgFinModal(){
  if(!window.UI||!UI.modal)return;
  var rows=(MP.data&&MP.data.rows)||[];
  function sel(id,val){
    return '<select class="fin" id="'+id+'"><option value="">— не считать —</option>'
      +rows.map(function(r){return '<option value="'+E(r.row_id)+'"'
        +(String(val)===String(r.row_id)?' selected':'')+'>'+E(r.name)+'</option>';}).join('')
      +'</select>';
  }
  UI.modal({title:'Участок трассы',
    sub:'Монтаж и покраска считаются метрами, сварка — стыками, опрессовка — участком.',
    body:'<div class="fcell"><div class="flab">Диаметр (Ду)</div>'
      +'<input class="fin" id="sgDu" placeholder="32"></div>'
      +'<div class="fcell"><div class="flab">Длина, м</div>'
      +'<input class="fin" id="sgLen" inputmode="decimal" placeholder="0"></div>'
      +'<div class="fcell"><div class="flab">Сварных стыков</div>'
      +'<input class="fin" id="sgJt" inputmode="numeric" placeholder="0"></div>'
      +'<div class="fcell wide"><div class="flab">Монтаж трубы — строка сметы (метры)</div>'
      +sel('sgRPipe',guessRow(/труб/))+'</div>'
      +'<div class="fcell wide"><div class="flab">Сварка — строка сметы (стыки)</div>'
      +sel('sgRWeld',guessRow(/стык|свар/))+'</div>'
      +'<div class="fcell wide"><div class="flab">Покраска — строка сметы (метры)</div>'
      +sel('sgRPaint',guessRow(/окрас|покрас|грунт/))+'</div>'
      +'<div class="fcell wide"><div class="flab">Опрессовка — строка сметы (участки)</div>'
      +sel('sgRPress',guessRow(/опресс|испытан/))+'</div>',
    ok:'Сохранить участок',okIcon:'i-save',
    onOk:function(w){
      var len=qnum((w.querySelector('#sgLen')||{}).value);
      if(!(len>0)){T('Укажите длину участка');return false;}
      var jt=parseInt((w.querySelector('#sgJt')||{}).value||'0',10)||0;
      var pts=MP.sgPts.map(function(pt){return pt.x+','+pt.y;}).join(' ');
      (async function(){
        try{
          var r=await api('/plans/segments',{method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({plan_id:curSheet().id,
              du:((w.querySelector('#sgDu')||{}).value||'').trim()||null,
              length_m:len,joints:jt,pts:pts,
              row_pipe:(w.querySelector('#sgRPipe')||{}).value||null,
              row_weld:(w.querySelector('#sgRWeld')||{}).value||null,
              row_paint:(w.querySelector('#sgRPaint')||{}).value||null,
              row_press:(w.querySelector('#sgRPress')||{}).value||null})});
          T('Участок '+r.label+' сохранён');
          MP.mode='';MP.sgPts=[];
          mpLoad();
        }catch(e){T(e.message);}
      })();
    }});
}
function segModal(g){
  if(!window.UI||!UI.modal)return;
  var canPress=(g.done.press||0)<1;
  function line(lab,id,left,unit){
    return '<div class="fcell"><div class="flab">'+lab+'</div>'
      +'<input class="fin" id="'+id+'" inputmode="decimal" placeholder="0">'
      +'<div class="fnote">осталось '+qs(left)+' '+unit+'</div></div>';
  }
  var body=line('Смонтировано, м','sgAmont',Math.max(0,g.length_m-(g.done.mont||0)),'м')
    +(g.joints>0?line('Сварено стыков','sgAweld',Math.max(0,g.joints-(g.done.weld||0)),'шт'):'')
    +line('Окрашено, м','sgApaint',Math.max(0,g.length_m-(g.done.paint||0)),'м')
    +(canPress?'<div class="fcell wide"><label class="s" style="display:flex;gap:6px;align-items:center">'
      +'<input type="checkbox" id="sgApress"> Участок опрессован</label></div>'
      :'<div class="fcell wide"><div class="fnote">Опрессован.</div></div>')
    +'<div class="fcell wide"><div class="flab">Фото стадий — несколько</div>'
    +'<input class="fin" type="file" id="sgPhoto" accept="image/*" multiple></div>';
  UI.modal({title:E(g.label)+(g.du?(' · Ду'+E(g.du)):''),
    sub:qs(g.length_m)+' м · стыков '+qs(g.done.weld||0)+' из '+g.joints
      +' · готовность '+segPct(g)+'%. Впишите, сколько добавилось.',
    body:body,
    ok:'Записать',okIcon:'i-ok',
    onOk:function(w){
      var am=qnum((w.querySelector('#sgAmont')||{}).value);
      var aw=qnum((w.querySelector('#sgAweld')||{}).value);
      var ap=qnum((w.querySelector('#sgApaint')||{}).value);
      var pr=(w.querySelector('#sgApress')||{}).checked;
      if(!(am>0)&&!(aw>0)&&!(ap>0)&&!pr){T('Впишите хотя бы одну стадию');return false;}
      var f=w.querySelector('#sgPhoto');
      if(!f||!f.files.length){T('Приложите фото выполненного объёма');return false;}
      (async function(){
        try{
          T('Загружаю фото…');
          var files=await upFiles(f.files);
          var jobs=[];
          if(am>0)jobs.push(['mont',am]);
          if(aw>0)jobs.push(['weld',aw]);
          if(ap>0)jobs.push(['paint',ap]);
          if(pr)jobs.push(['press',1]);
          for(var i=0;i<jobs.length;i++){
            await api('/plans/segments/'+g.id+'/stage',{method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({stage:jobs[i][0],qty:jobs[i][1],
                files:files,client_op_id:opId()})});
          }
          T('Записано');
          mpLoad();
        }catch(e){T(e.message);mpLoad();}
      })();
    }});
}

function mpUploadModal(){
  if(!window.UI||!UI.modal)return;
  UI.modal({title:'Загрузить планы',
    sub:'Выберите файлы планов — можно сразу несколько, по одному на этаж. '
      +'Есть рабочка ССГ — приборы расставятся сами; нет — план ляжет подложкой, '
      +'а точки вы поставите кнопкой «Добавить точку».',
    body:'<div class="fcell wide"><div class="flab">Планы: PDF, PNG или JPG</div>'
      +'<input class="fin" type="file" id="plUpFiles" multiple '
      +'accept=".pdf,.json,image/png,image/jpeg,application/pdf,application/json">'
      +'<div class="fnote">Четыре этажа — выберите все четыре файла сразу. '
      +'Многостраничный PDF разложится по листам сам.</div></div>'
      +'<div class="fcell wide"><label class="s" style="display:flex;gap:6px;align-items:center">'
      +'<input type="checkbox" id="plUpRepl"> Заменить прежние планы объекта</label>'
      +'<div class="fnote">Без галочки новые листы добавляются к уже загруженным.</div></div>'
      +'<div class="fcell wide"><button class="btn sm" data-act="pl-probe" '
      +'title="Посмотреть, какие подписи есть на чертеже">'
      +'<svg class="i"><use href="#i-eye"/></svg>'
      +'<span class="lbl">Что на чертеже?</span></button>'
      +'<div class="fnote">Если извещатели подписаны не по-нашему — нажмите: '
      +'система покажет подписи с чертежа, и вы отметите, какие из них приборы.</div>'
      +'<div id="plProbe"></div></div>',
    ok:'Загрузить',okIcon:'i-imp',
    onOk:function(w){
      var fEl=w.querySelector('#plUpFiles'), rp=w.querySelector('#plUpRepl');
      var list=fEl&&fEl.files?[].slice.call(fEl.files):[];
      if(!list.length){T('Выберите хотя бы один файл плана');return false;}
      // project.json без картинок принять нельзя: подложек не будет
      var js=list.filter(function(f){return /\.json$/i.test(f.name||'');});
      var im=list.filter(function(f){return /\.(png|jpe?g)$/i.test(f.name||'');});
      if(js.length&&!im.length){T('К project.json приложите ещё и PNG листов');return false;}
      if(js.length>1){T('project.json может быть только один');return false;}
      var repl=!!(rp&&rp.checked);
      (async function(){
        try{
          var plans=0,devs=0,bound=0;
          if(js.length){
            // Классический путь парсера: json + все картинки одной посылкой
            T('Загружаю планы…');
            var fd=new FormData();
            fd.append('object_uid',OBJ.uid); fd.append('project',js[0]);
            im.forEach(function(f){fd.append('images',f);});
            if(repl)fd.append('replace','1');
            var r0=await api('/plans/upload',{method:'POST',body:fd});
            plans+=r0.plans;devs+=r0.devices;bound+=(r0.bound||0);
          }else{
            // Файлы по одному: так виден прогресс и одна плохая страница
            // не роняет остальные. «Заменить» применяется только к первому.
            var marks=(MP.marks||[]).join(',');
            for(var i=0;i<list.length;i++){
              T('Обрабатываю '+(i+1)+' из '+list.length+' — '+list[i].name);
              var fd2=new FormData();
              fd2.append('object_uid',OBJ.uid); fd2.append('project',list[i]);
              if(marks)fd2.append('marks',marks);
              if(repl&&i===0)fd2.append('replace','1');
              var r=await api('/plans/upload',{method:'POST',body:fd2});
              plans+=r.plans;devs+=r.devices;bound+=(r.bound||0);
            }
          }
          T('Готово: листов '+plans+(devs?(', приборов '+devs
            +(bound?(', привязано к смете '+bound):'')):' · приборов нет — ставьте точки вручную'));
          mpReset(); MP.data=null; rr(); mpLoad();
        }catch(e){T(e.message); mpReset(); MP.data=null; rr(); mpLoad();}
      })();
    }});
}

function mpBindModal(){
  if(!window.UI||!UI.modal)return;
  var devs=[]; ((MP.data&&MP.data.plans)||[]).forEach(function(p){devs=devs.concat(p.devices||[]);});
  var types={};
  devs.forEach(function(d){var t=d.dtype||'other';
    types[t]=types[t]||{n:0,rid:d.row_id}; types[t].n++;
    if(d.row_id)types[t].rid=d.row_id;});
  var rows=(MP.data&&MP.data.rows)||[];
  var body=Object.keys(types).map(function(t){
    return '<div class="fcell wide"><div class="flab">'+E(dtypeRu(t))+' — '+types[t].n+' шт</div>'
      +'<select class="fin" id="plb_'+E(t)+'"><option value="">— не привязывать —</option>'
      +rows.map(function(r){
        return '<option value="'+E(r.row_id)+'"'
          +(String(types[t].rid)===String(r.row_id)?' selected':'')+'>'
          +E(r.name)+' ('+qs(r.qty_plan)+' '+E(r.unit||'')+')</option>';
      }).join('')+'</select></div>';
  }).join('');
  UI.modal({title:'Привязка приборов к смете',
    sub:'Каждый тип прибора — к своей строке. Отметка на плане станет отметкой объёма по этой строке.',
    body:body||'<div class="s">Приборов нет</div>',
    ok:'Сохранить',okIcon:'i-save',
    onOk:function(w){
      var map={};
      Object.keys(types).forEach(function(t){
        var s=w.querySelector('#plb_'+CSS.escape(t)); if(s)map[t]=s.value||'';
      });
      (async function(){
        try{
          var r=await api('/plans/bind',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({object_uid:OBJ.uid,map:map})});
          T('Привязка сохранена: '+r.updated+' приборов'); mpLoad();
        }catch(e){T(e.message);}
      })();
    }});
}

// Мост для второй половины файла (kp-11b.js, «Сверх сметы») — общий
// IIFE разрезан на два <script>, поэтому то, что раньше бралось из
// замыкания, отдаётся явно. Ссылки на MP/OBJ — тот же объект, не копия:
// изменения видны с обеих сторон, как и было в одном файле.
window.__kp11a={E:E,MP:MP,OBJ:OBJ,T:T,api:api,apiText:apiText,money:money,
  mpBindModal:mpBindModal,mpLoad:mpLoad,mpMarkModal:mpMarkModal,mpMount:mpMount,
  mpReset:mpReset,mpUnmarkAsk:mpUnmarkAsk,mpUploadModal:mpUploadModal,mpView:mpView,
  objHead:objHead,objPicker:objPicker,pickDefault:pickDefault,ptModal:ptModal,
  qnum:qnum,qs:qs,rr:rr,
  segModal:segModal,sgFinModal:sgFinModal,upFiles:upFiles};
})();
