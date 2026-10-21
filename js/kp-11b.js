(function(){
var B=window.__kp11a;
var E=B.E,MP=B.MP,OBJ=B.OBJ,T=B.T,api=B.api,apiText=B.apiText,money=B.money,
  mpBindModal=B.mpBindModal,mpLoad=B.mpLoad,mpMarkModal=B.mpMarkModal,mpMount=B.mpMount,
  mpReset=B.mpReset,mpUnmarkAsk=B.mpUnmarkAsk,mpUploadModal=B.mpUploadModal,mpView=B.mpView,
  objHead=B.objHead,objPicker=B.objPicker,pickDefault=B.pickDefault,ptModal=B.ptModal,
  qnum=B.qnum,qs=B.qs,rr=B.rr,
  segModal=B.segModal,sgFinModal=B.sgFinModal,upFiles=B.upFiles;

/* ════════════════════════ СВЕРХ СМЕТЫ ════════════════════════ */
var EX={data:null,sel:{},busy:false,err:''};
var EX_ST={new:'ждёт цены',priced:'цена есть',in_act:'в акте',rejected:'отклонена'};
var ACT_ST={draft:'черновик',issued:'выпущен',signed:'подписан'};

async function exLoad(){
  EX.err='';
  await pickDefault();
  if(!OBJ.uid){rr();return;}
  try{EX.data=await api('/extra?object_uid='+encodeURIComponent(OBJ.uid));}
  catch(e){EX.data={items:[],acts:[],can_price:false};EX.err=e.message;}
  rr();
}

function exView(){
  if(!OBJ.uid)return objPicker('ex-obj');
  var h='<div class="cd" id="exmount">'+objHead('ex-back');
  if(EX.err)h+='<div class="erin"><svg class="i"><use href="#i-warn"/></svg><span>'+E(EX.err)+'</span></div>';
  if(EX.data===null)return h+(window.UI?UI.loading(3):'<div class="pd sub">Загрузка…</div>')+'</div>';
  var items=EX.data.items||[], office=!!EX.data.can_price;

  h+='<div class="pd pd0" style="padding-top:10px;display:flex;gap:8px;align-items:center">'
    +'<div class="s" style="flex:1">Материалы и работы, которых не было в смете. '
    +'Исполнитель фиксирует факт, цены ставит офис, дальше — акт и допсоглашение.</div>'
    +'<button class="btn" data-act="ex-add" title="Добавить позицию сверх сметы" style="flex:0 0 auto">'
    +'<svg class="i"><use href="#i-plus"/></svg><span class="lbl">Добавить</span></button></div>';

  if(!items.length){
    h+=(window.UI?UI.empty({icon:'i-flag',title:'Пока пусто',
      text:'Нашли на объекте работу или материал не по смете — добавьте сюда с фото, не дожидаясь офиса.'})
      :'<div class="pd sub">Пусто</div>');
  }else{
    h+=items.map(function(it){
      var stC=it.status==='in_act'?'var(--grn)':(it.status==='rejected'?'var(--red)':'var(--amb)');
      var sum=(it.price!=null)?money(it.qty*it.price):null;
      var row='<div class="it" style="align-items:flex-start">'
        +'<div class="ni '+(it.kind==='work'?'warn':'info')+'"><svg class="i"><use href="#'
        +(it.kind==='work'?'i-tool':'i-box')+'"/></svg></div>'
        +'<div style="flex:1;min-width:0">'
        +'<div class="tx" style="font-weight:600">'+E(it.name)+'</div>'
        +'<div class="sb">'+qs(it.qty)+' '+E(it.unit||'шт')+' · '+E(it.who)+' · '+E(it.at)
        +(it.note?(' · '+E(it.note)):'')+'</div>'
        +'<div class="sb"><span style="color:'+stC+'">'+E(EX_ST[it.status]||it.status)+'</span>'
        +(it.price!=null?(' · цена '+money(it.price)+' · сумма '+sum):'')+'</div>'
        +'</div>';
      if(office&&it.status!=='in_act'){
        row+='<div style="display:flex;gap:6px;align-items:center;flex:0 0 auto">'
          +(it.status!=='rejected'
            ?'<input type="checkbox" class="exsel" data-id="'+it.id+'"'
              +(EX.sel[it.id]?' checked':'')+(it.price==null?' disabled':'')
              +' title="В акт" aria-label="В акт">':'')
          +'<input class="f fmini" id="exp_'+it.id+'" inputmode="decimal" placeholder="цена"'
          +' value="'+(it.price!=null?it.price:'')+'" style="width:76px">'
          +'<button class="btn sm io" data-act="ex-priceset" data-id="'+it.id+'" '
          +'title="Сохранить цену"><svg class="i"><use href="#i-save"/></svg></button>'
          +'<button class="btn sm io" data-act="ex-del" data-id="'+it.id+'" '
          +'title="Удалить позицию"><svg class="i"><use href="#i-trash"/></svg></button>'
          +'</div>';
      }else if(it.mine&&it.status==='new'){
        row+='<button class="btn sm io" style="flex:0 0 auto" data-act="ex-del" data-id="'+it.id+'" '
          +'title="Удалить свою позицию"><svg class="i"><use href="#i-trash"/></svg></button>';
      }
      return row+'</div>';
    }).join('');
  }

  if(office){
    var selN=Object.keys(EX.sel).filter(function(k){return EX.sel[k];}).length;
    var ready=items.filter(function(it){return it.status==='priced';}).length;
    if(ready||selN){
      h+='<div class="pd" style="display:flex;gap:8px;align-items:center">'
        +'<span class="s" style="flex:1">Выбрано в акт: '+selN+'</span>'
        +'<button class="btn primary" data-act="ex-act" title="Выпустить акт допработ"'
        +(selN?'':' disabled')+'><svg class="i"><use href="#i-ok"/></svg>'
        +'<span class="lbl">Выпустить акт</span></button></div>';
    }
  }

  var acts=EX.data.acts||[];
  if(acts.length){
    h+='<div class="pd pd0"><div class="s" style="font-weight:600;margin-bottom:4px">Акты допработ</div>'
      +acts.map(function(a){
        var st=ACT_ST[a.status]||a.status;
        return '<div class="it" style="align-items:center">'
          +'<div class="ni ok"><svg class="i"><use href="#i-doc"/></svg></div>'
          +'<div style="flex:1;min-width:0"><div class="tx" style="font-weight:600">'+E(a.number)
          +' · '+money(a.total)+'</div>'
          +'<div class="sb">'+E(a.date)+' · '+E(st)
          +(a.signed_on?(' '+E(a.signed_on)):'')+'</div></div>'
          +'<div style="display:flex;gap:6px;flex:0 0 auto">'
          +'<button class="btn sm io" data-act="ex-print" data-id="'+a.id+'" data-f="act" '
          +'title="Печать акта"><svg class="i"><use href="#i-file"/></svg></button>'
          +'<button class="btn sm io" data-act="ex-print" data-id="'+a.id+'" data-f="dopsog" '
          +'title="Печать допсоглашения"><svg class="i"><use href="#i-doc"/></svg></button>'
          +(office&&a.status==='draft'
            ?'<button class="btn sm" data-act="ex-issue" data-id="'+a.id+'" title="Отметить выпущенным">'
            +'<svg class="i"><use href="#i-ok"/></svg><span class="lbl">Выпущен</span></button>':'')
          +(office&&a.status==='issued'
            ?'<button class="btn sm" data-act="ex-sign" data-id="'+a.id+'" title="Отметить подписанным">'
            +'<svg class="i"><use href="#i-ok"/></svg><span class="lbl">Подписан</span></button>':'')
          +(office&&a.status!=='signed'
            ?'<button class="btn sm io" data-act="ex-cancel" data-id="'+a.id+'" '
            +'title="Отменить акт"><svg class="i"><use href="#i-x"/></svg></button>':'')
          +'</div></div>';
      }).join('')+'</div>';
  }
  return h+'</div>';
}

/* Каталог для сверх сметы: база Дижона; Всеинструменты.ру и ЛеманаПро
   появятся в выдаче сами, когда их сборщики начнут наполнять базу. */
var EXCAT=[], EXPICK=null, _catT=null;
function exCatRender(items){
  var box=document.getElementById('exCatBox'); if(!box)return;
  EXCAT=items||[];
  box.innerHTML=EXCAT.length
    ?EXCAT.map(function(c,i){
      return '<div class="catit" data-act="ex-pick" data-i="'+i+'">'+E(c.name)
        +'<div class="s">'+E(c.source)+' · закупка '+money(c.price)
        +'/'+E(c.unit||'шт')+(c.article?(' · '+E(c.article)):'')+'</div></div>';
    }).join('')
    :'<div class="s" style="padding:6px 8px">В каталоге не нашлось — впишите название руками ниже.</div>';
}
function exAddModal(){
  if(!window.UI||!UI.modal)return;
  EXPICK=null; EXCAT=[];
  // Каталог с закупочными ценами открыт не всем ролям. Кому нельзя —
  // тому не поле, которое отвечает отказом, а сразу ввод руками.
  var withCat=(typeof can==='function')&&can('catalog:read');
  var m=UI.modal({title:'Сверх сметы',
    sub:withCat?'Начните с поиска по каталогу — так название и единица будут точными. Цену поставит офис.'
               :'Впишите, что понадобилось сверх сметы. Цену поставит офис.',
    body:(withCat?('<div class="fcell wide"><div class="flab">Поиск по каталогу</div>'
      +'<input class="fin" id="exSearch" placeholder="Кабель, гофра, электроды…" autocomplete="off">'
      +'<div id="exCatBox" class="catbox"></div></div>'):'')
      +'<div class="fcell wide"><div class="flab">Что это</div>'
      +'<select class="fin" id="exKind"><option value="material">Материал или оборудование</option>'
      +'<option value="work">Работа</option></select></div>'
      +'<div class="fcell wide"><div class="flab">Наименование</div>'
      +'<input class="fin" id="exName" placeholder="'
      +(withCat?'Или выберите из каталога выше':'Кабель ВВГнг 3х1,5')+'"></div>'
      +'<div class="fcell"><div class="flab">Количество</div>'
      +'<input class="fin" id="exQty" inputmode="decimal" placeholder="0"></div>'
      +'<div class="fcell"><div class="flab">Единица</div>'
      +'<input class="fin" id="exUnit" placeholder="шт" value="шт"></div>'
      +'<div class="fcell wide"><div class="flab">Почему понадобилось</div>'
      +'<input class="fin" id="exNote" placeholder="Необязательно, но поможет офису и заказчику"></div>'
      +'<div class="fcell wide"><div class="flab">Фото — из галереи или с камеры, несколько</div>'
      +'<input class="fin" type="file" id="exFile" accept="image/*" multiple>'
      +'<div class="fnote">Снимок — лучший аргумент в разговоре о допоплате.</div></div>',
    ok:'Добавить',okIcon:'i-plus',
    onOk:function(w){
      var name=(w.querySelector('#exName')||{}).value||'';
      var qty=qnum((w.querySelector('#exQty')||{}).value);
      if(name.trim().length<2){T('Укажите наименование');return false;}
      if(!(qty>0)){T('Укажите количество');return false;}
      var kind=(w.querySelector('#exKind')||{}).value||'material';
      var unit=((w.querySelector('#exUnit')||{}).value||'шт').trim()||'шт';
      var note=((w.querySelector('#exNote')||{}).value||'').trim();
      // Позиция из каталога несёт источник и закупку — офису это
      // готовая подсказка при назначении цены.
      if(EXPICK&&EXPICK.name===name.trim())
        note=(note?note+' · ':'')+'каталог: '+EXPICK.source+', закупка '
          +String(EXPICK.price).replace('.',',')+' ₽/'+(EXPICK.unit||'шт');
      var fEl=w.querySelector('#exFile');
      // Промис наружу: окно закроется по успеху, а на отказе останется
      // открытым вместе с набранным. Раньше отказ стирал всю форму.
      return (async function(){
        var files=null;
        if(fEl&&fEl.files.length){T('Загружаю фото…');files=await upFiles(fEl.files);}
        await api('/extra',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({object_uid:OBJ.uid,kind:kind,name:name.trim(),
            unit:unit,qty:qty,note:note||null,files:files})});
        T('Добавлено — офис увидит и оценит');
        exLoad();
      })();
    }});
  var si=m&&m.el?m.el.querySelector('#exSearch'):document.getElementById('exSearch');
  if(si)si.addEventListener('input',function(){
    var v=this.value.trim();
    clearTimeout(_catT);
    if(v.length<2){exCatRender([]);return;}
    _catT=setTimeout(async function(){
      try{
        var r=await api('/extra/catalog?q='+encodeURIComponent(v));
        exCatRender(r&&r.items);
      }catch(e){
        var box=document.getElementById('exCatBox');
        if(box)box.innerHTML='<div class="s" style="padding:6px 8px">Каталог недоступен ('
          +E(e.message)+') — впишите название руками.</div>';
      }
    },350);
  });
}

function exActModal(){
  if(!window.UI||!UI.modal)return;
  var ids=Object.keys(EX.sel).filter(function(k){return EX.sel[k];}).map(Number);
  var items=(EX.data.items||[]).filter(function(it){return ids.indexOf(it.id)>=0;});
  if(!items.length){T('Отметьте позиции с ценой');return;}
  var total=0; items.forEach(function(it){total+=it.qty*(it.price||0);});
  // Локальная дата, не UTC: иначе акт, оформленный ночью, датируется вчера.
  var _d=new Date();
  var today=_d.getFullYear()+'-'+('0'+(_d.getMonth()+1)).slice(-2)+'-'+('0'+_d.getDate()).slice(-2);
  UI.modal({title:'Акт допработ',
    sub:'Позиции зафиксируются в акте, к нему же печатается допсоглашение.',
    body:'<div class="fcell"><div class="flab">Номер</div>'
      +'<input class="fin" id="exActNum" placeholder="само, если пусто"></div>'
      +'<div class="fcell"><div class="flab">Дата</div>'
      +'<input class="fin" type="date" id="exActDate" value="'+today+'"></div>'
      +'<div class="fcell wide">'
      +items.map(function(it){return '<div class="s" style="display:flex;gap:8px;padding:2px 0">'
        +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+E(it.name)+'</span>'
        +'<span>'+qs(it.qty)+' '+E(it.unit)+' × '+money(it.price)+'</span></div>';}).join('')
      +'<div class="s" style="margin-top:6px;font-weight:600;display:flex"><span style="flex:1">Итого</span>'
      +'<span>'+money(total)+'</span></div></div>',
    ok:'Выпустить акт',okIcon:'i-ok',
    onOk:function(w){
      var num=((w.querySelector('#exActNum')||{}).value||'').trim()||null;
      var dt=(w.querySelector('#exActDate')||{}).value||null;
      (async function(){
        try{
          var r=await api('/extra/acts',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({object_uid:OBJ.uid,item_ids:ids,number:num,act_date:dt})});
          EX.sel={};
          T('Акт '+r.number+' на '+money(r.total)+' создан');
          exLoad();
        }catch(e){T(e.message);}
      })();
    }});
}

async function exPrint(id,form){
  try{
    var html=await apiText('/extra/acts/'+id+'/print?form='+(form||'act'));
    var w=window.open('','_blank');
    if(!w){T('Разрешите всплывающие окна, чтобы открыть документ');return;}
    w.document.write(html); w.document.close();
  }catch(e){T(e.message);}
}

/* ── Обработчики ── */
document.addEventListener('click',async function(ev){
  var el=ev.target.closest('[data-act]'); if(!el)return;
  var a=el.dataset.act;

  if(a==='pl-photo'){
    var pu=el.dataset.url; if(!pu)return;
    var pov=document.getElementById('plphOv');
    if(!pov){pov=document.createElement('div'); pov.id='plphOv';
      pov.innerHTML='<img alt="Снимок отметки"><button class="btn sm" id="plphClose">Закрыть</button>';
      document.body.appendChild(pov);
      pov.addEventListener('click',function(){pov.classList.remove('on');});}
    pov.querySelector('img').src=pu; pov.classList.add('on');
    return;}

  if(a==='pl-phdel'){
    // Файл на Яндекс.Диске остаётся — решение владельца: из приложения
    // уходит ссылка, не файл (#106).
    if(MP.busy)return;
    var okDel=(window.UI&&UI.confirm)
      ? await UI.confirm({title:'Убрать снимок из карточки?',
          text:'Снимок пропадёт с карточки прибора, кто и когда убрал — останется в журнале доступа.',
          warn:'Файл на Яндекс.Диске компании останется — приложение его не трогает.',
          ok:'Убрать',okIcon:'i-x'})
      : confirm('Убрать снимок из карточки? Файл на диске компании останется.');
    if(!okDel)return;
    MP.busy=true; el.disabled=true;
    var devIdDel=el.dataset.devid;
    try{
      await api('/media/'+el.dataset.fid,{method:'DELETE'});
      T('Снимок убран из карточки');
      if(MP.devModal){try{MP.devModal.close()}catch(e){} MP.devModal=null;}
      // Счётчик «фото: N» на карточке приходит с сервера — перечитываем план,
      // а не правим photos на клиенте вручную, иначе цифра разойдётся с
      // числом миниатюр после первого же параллельного действия.
      await mpLoad();
      var devsD=[]; ((MP.data&&MP.data.plans)||[]).forEach(function(p){devsD=devsD.concat(p.devices||[]);});
      var dD=null; for(var iD=0;iD<devsD.length;iD++)if(String(devsD[iD].id)===String(devIdDel)){dD=devsD[iD];break;}
      if(dD&&dD.mark)mpMarkModal(dD);
    }catch(e){T(e.message);}
    finally{MP.busy=false;}
    return;}

  /* план */
  if(a==='pl-obj'||a==='ex-obj'){
    OBJ.uid=el.dataset.uid; OBJ.title=el.dataset.name||'';
    mpReset(); EX.data=null; EX.sel={};
    if(a==='pl-obj'){rr(); mpLoad();} else {rr(); exLoad();}
    return;}
  if(a==='pl-back'||a==='ex-back'){
    OBJ.uid=''; OBJ.title=''; OBJ.list=null; mpReset(); EX.data=null; EX.sel={};
    rr(); pickDefault().then(rr);
    return;}
  if(a==='pl-sheet'){MP.sheet=+el.dataset.i||0; MP.z=1;MP.tx=0;MP.ty=0; rr(); return;}
  if(a==='pl-filt'){MP.filt=el.dataset.t||''; rr(); return;}
  if(a==='pl-zin'||a==='pl-zout'||a==='pl-zfit'){
    var vw=document.getElementById('plview'); if(!vw)return;
    if(a==='pl-zfit'){MP.z=1;MP.tx=0;MP.ty=0;}
    else{
      var box=vw.getBoundingClientRect();
      var nz=Math.max(0.5,Math.min(8,MP.z*(a==='pl-zin'?1.35:0.74)));
      var x=box.width/2,y=box.height/2;
      MP.tx=x-(x-MP.tx)*nz/MP.z; MP.ty=y-(y-MP.ty)*nz/MP.z; MP.z=nz;
    }
    var cv=document.getElementById('plcanvas');
    if(cv)cv.style.transform='translate('+MP.tx+'px,'+MP.ty+'px) scale('+MP.z+')';
    return;}
  if(a==='pl-dev'){
    if(MP.dragged){MP.dragged=false;return;}
    if(MP.mode)return;                     // в режимах офиса тапы ставят точки
    var devs=[]; ((MP.data&&MP.data.plans)||[]).forEach(function(p){devs=devs.concat(p.devices||[]);});
    var d=null; for(var i=0;i<devs.length;i++)if(String(devs[i].id)===String(el.dataset.id)){d=devs[i];break;}
    if(d)mpMarkModal(d);
    return;}
  if(a==='pl-segm'){
    if(MP.dragged){MP.dragged=false;return;}
    if(MP.mode)return;
    var sgs=[]; ((MP.data&&MP.data.plans)||[]).forEach(function(p){sgs=sgs.concat(p.segments||[]);});
    var g=null; for(var i2=0;i2<sgs.length;i2++)if(String(sgs[i2].id)===String(el.dataset.id)){g=sgs[i2];break;}
    if(g)segModal(g);
    return;}
  if(a==='pl-unmk'){
    if(MP.devModal){try{MP.devModal.close()}catch(e){} MP.devModal=null;}
    var devs3=[]; ((MP.data&&MP.data.plans)||[]).forEach(function(p){devs3=devs3.concat(p.devices||[]);});
    var d4=null; for(var i3=0;i3<devs3.length;i3++)if(String(devs3[i3].id)===String(el.dataset.id)){d4=devs3[i3];break;}
    if(d4)mpUnmarkAsk(d4);
    return;}
  if(a==='pl-ptmode'){MP.mode=(MP.mode==='pt'?'':'pt');MP.sgPts=[];rr();return;}
  if(a==='pl-sgmode'){MP.mode='sg';MP.sgPts=[];rr();return;}
  if(a==='pl-sgdone'){
    if(MP.sgPts.length<2){T('Нужно хотя бы две точки трассы');return;}
    sgFinModal();return;}
  if(a==='pl-sgstop'){MP.mode='';MP.sgPts=[];rr();return;}
  if(a==='pl-upload'){MP.marks=[]; mpUploadModal(); return;}
  if(a==='pl-probe'){
    var fi=document.getElementById('plUpFiles');
    var f0=fi&&fi.files&&fi.files[0];
    var pb=document.getElementById('plProbe');
    if(!f0||!/\.pdf$/i.test(f0.name||'')){T('Сначала выберите PDF плана');return;}
    if(pb)pb.innerHTML='<div class="s" style="padding:6px 0">Смотрю чертёж…</div>';
    (async function(){
      try{
        var fd=new FormData(); fd.append('project',f0);
        var r=await api('/plans/probe',{method:'POST',body:fd});
        var pb2=document.getElementById('plProbe'); if(!pb2)return;
        if(r.known_total){
          pb2.innerHTML='<div class="s" style="padding:6px 0;color:var(--grn)">'
            +'Это наша рабочка: приборов по обозначениям ССГ — '+r.known_total
            +'. Просто загружайте, метки выбирать не нужно.</div>';
          MP.marks=[]; return;
        }
        if(!r.marks||!r.marks.length){
          pb2.innerHTML='<div class="s" style="padding:6px 0">Подписей в чертеже нет '
            +'(похоже, скан или картинка). План ляжет подложкой — точки поставите вручную.</div>';
          MP.marks=[]; return;
        }
        pb2.innerHTML='<div class="s" style="padding:6px 0">Подписи с чертежа — '
          +'отметьте те, которыми обозначены приборы:</div>'
          +'<div class="catbox">'+r.marks.map(function(m){
            return '<label class="catit" style="display:flex;gap:8px;align-items:center">'
              +'<input type="checkbox" class="mkchk" value="'+E(m.prefix)+'">'
              +'<span style="flex:1;min-width:0">'+E(m.prefix)
              +' <span class="s">'+m.count+' шт · '+E((m.examples||[]).join(', '))+'</span></span>'
              +'</label>';}).join('')+'</div>';
      }catch(e){
        var pb3=document.getElementById('plProbe');
        if(pb3)pb3.innerHTML='<div class="s" style="padding:6px 0;color:var(--amb)">'+E(e.message)+'</div>';
      }
    })();
    return;}
  if(a==='pl-bind'){mpBindModal(); return;}
  if(a==='pl-selno'){MP.selSheets={}; rr(); return;}
  if(a==='pl-delsheets'){
    var delIds=Object.keys(MP.selSheets).filter(function(k){return MP.selSheets[k];});
    if(!delIds.length)return;
    var allPlans=(MP.data&&MP.data.plans)||[];
    var delSheets=allPlans.filter(function(p){return delIds.indexOf(String(p.id))>=0;});
    if(!delSheets.length)return;
    var manyD=delSheets.length>1;
    var marksN=0; delSheets.forEach(function(p){
      marksN+=(p.devices||[]).filter(function(d){return d.mark;}).length;});
    var titles=delSheets.map(function(p){return p.title;}).join(', ');
    var textD='Лист'+(manyD?'ы':'')+' «'+titles+'» и все приборы на '+(manyD?'них':'нём')+' будут удалены без возможности отменить.';
    var warnD=marksN?('Пропадёт отметок монтажа: '+marksN+'. Объём и деньги по ним уйдут из начисления.'):'';
    var okD=(window.UI&&UI.confirm)
      ?await UI.confirm({title:'Удалить лист'+(manyD?'ы':'')+' плана?',
          text:textD,warn:warnD||undefined,ok:'Удалить',okIcon:'i-trash'})
      :confirm(textD+(warnD?(' '+warnD):''));
    if(!okD)return;
    var okCnt=0,errCnt=[];
    for(var iD=0;iD<delSheets.length;iD++){
      try{await api('/plans/'+delSheets[iD].id+'/delete',{method:'POST'});okCnt++;}
      catch(e){errCnt.push(delSheets[iD].title+': '+e.message);}
    }
    MP.selSheets={};
    T(errCnt.length?('Удалено '+okCnt+' из '+delSheets.length+'; '+errCnt.join('; '))
                    :('Удалено листов: '+okCnt));
    await mpLoad();
    return;}
  if(a==='ex-pick'){
    var c=EXCAT[+el.dataset.i]; if(!c)return;
    var nEl=document.getElementById('exName'),uEl=document.getElementById('exUnit');
    if(nEl)nEl.value=c.name; if(uEl)uEl.value=c.unit||'шт';
    EXPICK=c;
    var box=document.getElementById('exCatBox');
    if(box)box.innerHTML='<div class="s" style="padding:6px 8px">Выбрано: '+E(c.name)
      +' · '+E(c.source)+' · закупка '+money(c.price)+'</div>';
    return;}

  /* сверх сметы */
  if(a==='ex-add'){exAddModal(); return;}
  if(a==='ex-del'){
    var okDel=(window.UI&&UI.confirm)
      ?await UI.confirm({title:'Удалить позицию?',
          text:'Позиция сверх сметы будет удалена. Фото останутся в облаке объекта.',
          ok:'Удалить',okIcon:'i-trash'})
      :confirm('Удалить позицию?');
    if(!okDel)return;
    try{await api('/extra/'+el.dataset.id+'/delete',{method:'POST'});T('Удалено');exLoad();}
    catch(e){T(e.message);}
    return;}
  if(a==='ex-priceset'){
    var inp=document.getElementById('exp_'+el.dataset.id);
    var pr=qnum(inp&&inp.value);
    if(!(pr>=0)||!(inp&&String(inp.value).trim())){T('Укажите цену');return;}
    el.disabled=true;
    try{
      await api('/extra/'+el.dataset.id+'/update',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({price:pr})});
      T('Цена сохранена'); exLoad();
    }catch(e){el.disabled=false;T(e.message);}
    return;}
  if(a==='ex-act'){exActModal(); return;}
  if(a==='ex-print'){exPrint(el.dataset.id,el.dataset.f); return;}
  if(a==='ex-issue'||a==='ex-sign'){
    el.disabled=true;
    try{
      await api('/extra/acts/'+el.dataset.id+'/status',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status:a==='ex-sign'?'signed':'issued'})});
      T(a==='ex-sign'?'Акт подписан':'Акт выпущен'); exLoad();
    }catch(e){el.disabled=false;T(e.message);}
    return;}
  if(a==='ex-cancel'){
    var okC=(window.UI&&UI.confirm)
      ?await UI.confirm({title:'Отменить акт?',
          text:'Позиции вернутся в список и смогут попасть в новый акт.',
          warn:'Выпущенный заказчику номер лучше не переиспользовать.',
          ok:'Отменить акт',okIcon:'i-x'})
      :confirm('Отменить акт?');
    if(!okC)return;
    try{
      await api('/extra/acts/'+el.dataset.id+'/status',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'cancelled'})});
      T('Акт отменён'); exLoad();
    }catch(e){T(e.message);}
    return;}
});

document.addEventListener('change',function(ev){
  var t=ev.target;
  if(t&&t.classList&&t.classList.contains('exsel')){
    EX.sel[t.dataset.id]=t.checked; rr(); return;
  }
  if(t&&t.classList&&t.classList.contains('plsel')){
    MP.selSheets[t.dataset.id]=t.checked; rr(); return;
  }
  /* Выбор меток приборов после разведки чертежа */
  if(t&&t.classList&&t.classList.contains('mkchk')){
    MP.marks=[].slice.call(document.querySelectorAll('.mkchk:checked'))
      .map(function(x){return x.value;});
    return;
  }
});

/* Режимы офиса: тап по плану вне маркеров ставит точку или узел трассы */
document.addEventListener('click',function(ev){
  if(!MP.mode)return;
  if(ev.target.closest&&ev.target.closest('[data-act],.mdl'))return;
  var vw=ev.target.closest&&ev.target.closest('#plview'); if(!vw)return;
  if(MP.dragged){MP.dragged=false;return;}
  var cv=document.getElementById('plcanvas'); if(!cv)return;
  var rc=cv.getBoundingClientRect(); if(!rc.width||!rc.height)return;
  var x=Math.round((ev.clientX-rc.left)/rc.width*1000)/10;
  var y=Math.round((ev.clientY-rc.top)/rc.height*1000)/10;
  if(x<0||x>100||y<0||y>100)return;
  if(MP.mode==='pt'){ptModal(x,y);return;}
  if(MP.mode==='sg'){MP.sgPts.push({x:x,y:y});rr();return;}
});

/* Наружу — для kp-03 */
window.MPLAN={view:function(o){var h=mpView(!!(o&&o.embed));
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(mpMount);
    else setTimeout(mpMount,0);
    return h;},
  /* Объект приезжает со сменой: на вкладке «Смена» план должен показывать
     тот объект, на котором человек стоит, а не выбранный в прошлый раз. */
  load:function(o){
    if(o&&o.object_uid&&String(o.object_uid)!==String(OBJ.uid)){
      mpReset(); OBJ.uid=o.object_uid; OBJ.title=o.title||'';
    }
    return mpLoad();}};
window.MEXTRA={view:exView,load:exLoad};
})();
