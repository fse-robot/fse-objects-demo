(function(){
var B=window.__kp08a;
var E=B.E,PHT=B.PHT,T=B.T,dmy=B.dmy,engView=B.engView,geo=B.geo,isCust=B.isCust,isEng=B.isEng,isMgr=B.isMgr,
  jpost=B.jpost,metIso=B.metIso,phFreeT=B.phFreeT,render=B.render,sess=B.sess,sysRu=B.sysRu,tapi=B.tapi,today=B.today,view=B.view;

/* ═══════════════════ ФОРМЫ ═══════════════════
   Одна коробка на все формы. Причина простая: семь отдельных модалок — это
   семь мест, где можно забыть про обработку отказа сервера. */
var PH={
  site:{name:'например, БЦ «Северный» или Офис на Карбышева',
        address:'например, Москва, Варшавское шоссе, 42',
        floor:'например, 3',room:'например, 301, 302',
        geofence_m:'например, 250',
        contact_name:'например, Соколов Андрей',contact_phone:'например, +7 999 000-00-00',
        note:'например, пропуск заказывать за сутки'},
  cp:{inn:'например, 7707083893',name:'например, ООО «Северный»',
      kpp:'например, 770701001',ogrn:'например, 1027700132195',
      address_legal:'подтянется по ИНН',
      signer_name:'например, Смирнов Андрей Петрович',
      signer_position:'например, генеральный директор',
      signer_basis:'например, Устава',
      email:'например, buh@severny.ru',phone:'например, +7 495 000-00-00'},
  system:{title:'например, АУПС и СОУЭ, 1–3 этаж',
          brand:'например, Болид',model:'например, С2000М',
          zones_count:'например, 24',detectors_count:'например, 180',
          modules_count:'например, 4',gotv_kind:'например, Хладон 125',
          note:'например, шкаф в электрощитовой'},
  contract:{number:'например, ТО-2026/114',price:'например, 48000',
            note:'например, оплата до 10 числа',
            notify_email:'например, dispatch@client.ru',autostart_off_minutes:'например, 30'},
  defect:{title:'например, замена 4 дымовых извещателей, 2-й этаж',
          detail:'например, сработали ложно трижды за месяц',
          fix_price:'например, 12800',
          location:'например, склад готовой продукции',floor:'например, 1 этаж',
          norm_ref:'например, п.5.21 СП 484.1311500.2020',
          remedy:'например, оборудовать дверь датчиком'},
  plink:{account:'например, 1234',silence_minutes:'например, 60'},
  actman:{year:'например, 2026',summary:'пусто — строка составится сама по договору и периоду'},
  actinitman:{site_name:'например, БЦ «Северный», серверная',
              address:'например, Москва, Варшавское шоссе, 42',
              engineer:'например, Иванов Пётр'},
  actinitpick:{site_name:'например, БЦ «Северный», серверная',
               address:'например, Москва, Варшавское шоссе, 42',
               engineer:'например, Иванов Пётр'},
  party:{},grant:{}
};

var FORMS={
  site:{title:'Адрес обслуживания',
    lead:'Объект, на который будут ездить. Заводится один раз: потом к нему привязываются юрлица, системы и договор.',
    fields:[
    ['name','Название объекта','text',1,'Как вы называете его между собой: «БЦ Северный», «Офис на Карбышева». Это название увидит заказчик в своём кабинете.'],
    ['address','Адрес','addr',1,'Начните вводить город и улицу — появятся подсказки. Выбирайте из списка: вместе с адресом подтянутся координаты, по ним потом проверяется, что инженер отметился именно на объекте.'],
    ['floor','Этаж','text',0,'Если обслуживается не всё здание. Необязательно.'],
    ['room','Помещения','text',0,'Номера помещений через запятую: 204, 205. Необязательно.'],
    ['geofence_m','Радиус отметки, м','number',0,'На сколько метров инженер может отойти от точки объекта, чтобы отметка считалась сделанной на месте. Обычно 200–300. Пусто — не проверять (для подземных паркингов, где GPS врёт).'],
    ['contact_name','Контакт на объекте','text',0,'Кому звонить перед выездом.'],
    ['contact_phone','Телефон','text'],
    ['note','Примечание','text',0,'Пропуск, ключи, часы доступа — всё, что нужно знать инженеру.']]},

  cp:{title:'Юрлицо',
    lead:'Сторона заказчика: собственник, арендатор или плательщик. Введите ИНН и нажмите «Найти» — остальное заполнится само.',
    fields:[
    ['inn','ИНН','inn',1,'10 цифр у организации, 12 у ИП. По нему подтягиваются название, ОГРН, адрес и подписант — из ЕГРЮЛ.'],
    ['name','Название','text',1],
    ['kind','Форма','select',0,[['ooo','ООО'],['ip','ИП'],['ao','АО'],['pao','ПАО'],['gbu','ГБУ'],['other','Другое']]],
    ['kpp','КПП','text'],['ogrn','ОГРН','text'],
    ['address_legal','Юридический адрес','text'],
    ['signer_name','Подписант','text',0,'Кто подписывает договор и акты со стороны заказчика. Попадёт в печатную форму акта.'],
    ['signer_position','Должность подписанта','text'],
    ['signer_basis','Действует на основании','text',0,'Обычно «Устава» или доверенности.'],
    ['email','Почта','text',0,'Куда отправлять акты.'],
    ['phone','Телефон','text']]},

  party:{title:'Привязать юрлицо к адресу',
    lead:'На одном адресе может быть несколько юрлиц — например, у каждого арендатора своя серверная и свой договор. Роль определяет, кому уйдёт акт и кто увидит кабинет.',
    fields:[
    ['counterparty_id','Юрлицо','cpsel',1,'Если нужного нет — заведите его во вкладке «Юрлица».'],
    ['party_role','Роль на объекте','select',1,
      [['owner','Собственник — видит кабинет'],['payer','Плательщик — ему уходит акт'],
       ['operator','Эксплуатирующая организация']]]]},

  system:{title:'Система на объекте',
    lead:'То, что обслуживается. Именно к системе цепляется регламент и сроки: АУПС ходят ежемесячно, ВПВ — раз в полгода.',
    fields:[
    ['kind','Вид системы','syssel',1,'От вида зависит, какие регламентные работы подтянутся автоматически.'],
    ['title','Название','text',1,'Чтобы отличать на объекте: «АУПС 1–3 этаж», «АУГПТ серверной».'],
    ['brand','Производитель','text',0,'Болид, Рубеж, Аргус-Спектр.'],
    ['model','Модель ПКП','text',0,'Прибор приёмно-контрольный: С2000М, Сириус.'],
    ['zones_count','Зон','number'],['detectors_count','Извещателей','number'],
    ['modules_count','Модулей ГОТВ','number',0,'Для газового пожаротушения.'],
    ['gotv_kind','Вид ГОТВ','text',0,'Хладон 125, Novec 1230, СО2.'],
    ['commissioned_on','Введена в эксплуатацию','date'],
    ['vessel_check_on','Освидетельствование сосудов до','date',0,'Дата, до которой действительно освидетельствование баллонов. Напомним заранее.'],
    ['counterparty_id','Чья это система','cpsel',0,'Только если на адресе несколько юрлиц (вкладка «Стороны») и системы принадлежат разным. Иначе оставьте пустым — договор определится по адресу, как обычно.'],
    ['note','Примечание','text']]},

  contract:{title:'Договор на обслуживание',
    lead:'Из договора строится план работ и выпускаются акты. Без него выезды не с чем связать.',
    fields:[
    ['number','Номер договора','text',1],
    ['counterparty_id','Заказчик','cpsel',1,'Юрлицо, с которым заключён договор.'],
    ['entity_id','Наше юрлицо','entsel',0,'От кого заключён договор с нашей стороны. Попадёт в акт.'],
    ['site_ids','Объекты по договору','sitesel',1,'Отметьте адреса, которые обслуживаются по этому договору. Можно несколько.'],
    ['signed_on','Дата подписания','date'],
    ['period_from','Обслуживание с','date',1,'От этой даты отсчитывается план: ежемесячные работы встанут на это же число каждого месяца.'],
    ['period_to','по','date',0,'Пусто — бессрочно.'],
    ['price','Стоимость периода, ₽','number',0,'Сколько стоит один период обслуживания. Эта сумма попадёт в акт.'],
    ['billing_period','Как часто выставляем акт','select',1,
      [['month','ежемесячно'],['quarter','ежеквартально'],['half','раз в полгода'],['year','ежегодно']]],
    ['status','Статус','select',1,
      [['active','действует'],['draft','черновик'],['suspended','приостановлен'],['closed','закрыт']]],
    ['monitoring','С мониторингом (договор «ТОМ»)','check',0,'Кроме выездов, ведём мониторинг прибора объекта: журнал событий и письма заказчику о сигналах по п. 3.2 договора.'],
    ['notify_email','Почта для уведомлений о сигналах','text',0,'Строка «E-mail для уведомлений о Сигналах» из раздела 13 договора — не общая почта юрлица. Несколько адресов — через запятую.'],
    ['autostart_off_minutes','Письмо об отключении автопуска через, мин','number',0,'Число из последнего пункта п. 3.2 договора. Более короткое отключение только пишется в журнал.'],
    ['note','Примечание','text']]},

  plink:{title:'Передатчик объекта',
    lead:'С2000-PGE шлёт события прибора сами — журнал пополняется без загрузки CSV.',
    fields:[
    ['account','Номер объекта','text',0,'Как в настройках передатчика, поле «Номер объекта» (в режиме «Ведомый» — номер из Сириуса или С2000М). Пусто — передатчик у объекта снимается.'],
    ['silence_minutes','«Нет связи» через, мин','number',0,'Сколько минут молчания считать потерей связи. Больше периода тестовых сообщений в передатчике; по умолчанию 60.']]},

  defect:{title:'Замечание',
    lead:'То, что нашли на объекте и что нужно устранить. Уйдёт заказчику в кабинет на согласование.',
    fields:[
    ['title','Что не так','text',1,'Коротко и по делу: «Замена 4 дымовых извещателей, 2-й этаж».'],
    ['detail','Подробности','text'],
    ['severity','Важность','select',1,
      [['critical','критическое — система не работает'],['major','существенное'],['minor','незначительное']]],
    ['fix_price','Стоимость устранения, ₽','number',0,'Заказчик увидит её при согласовании.'],
    // Колонки таблицы акта первичного обследования (#79).
    ['location','Здание или помещение','text',0,'Строка-группа в таблице акта: «Склад готовой продукции», «Новый гараж». Пусто — «Общее для объекта».'],
    ['floor','Этаж','text'],
    ['doc_match','Соответствие документации','select',0,
      [['',''],['Соответствует ИД','соответствует ИД'],['Соответствует ПД','соответствует ПД'],
       ['Не соответствует ИД','не соответствует ИД'],['Не соответствует проекту','не соответствует проекту'],
       ['Отсутствует в проекте','отсутствует в проекте']],'ИД — исполнительная документация, ПД — проектная.'],
    ['norm_ref','Пункт нормы','text',0,'Статья, часть или пункт нормативного документа.'],
    ['remedy','Предложение по устранению','text']]},

  actinit:{title:'Заключение акта обследования',
    lead:'Черновик составлен по найденным недостаткам. Поправьте до выпуска: после выпуска акт не меняется.',
    fields:[
    ['conclusion','Заключение','area',0,'Общее состояние систем и главные недостатки.'],
    ['recommendations','Рекомендации','area',0,'Каждая рекомендация — с новой строки, номера проставятся сами.']]},

  // Акты по договору, когда объектов и выездов в системе нет (#623).
  actman:{title:'Акт без выездов',
    lead:'Акт за месяц или квартал по договору: стороны и сумма — из договора, вместо таблицы работ — строка текста.',
    fields:[
    ['year','Год','number',1],
    ['month','Месяц','select',1,[['1','январь'],['2','февраль'],['3','март'],['4','апрель'],['5','май'],['6','июнь'],
      ['7','июль'],['8','август'],['9','сентябрь'],['10','октябрь'],['11','ноябрь'],['12','декабрь']],
      'Для квартала — любой месяц этого квартала.'],
    ['period_kind','Период акта','select',0,
      [['','как в договоре'],['month','месяц'],['quarter','квартал'],['half','полгода'],['year','год']],
      'Квартальный акт по месячному договору стоит три месяца.'],
    ['summary','Что сделано','area',0,'Строка в таблице «Выполненные работы». Её можно поправить до выпуска.']]},

  actinitman:{title:'Акт обследования без выезда',
    lead:'Объект и инженер — текстом. Состояние систем и недостатки опишите в заключении после создания.',
    fields:[
    ['site_name','Объект','text',1],
    ['address','Адрес','text'],
    ['day','Дата обследования','date',1],
    ['engineer','Инженер','text']]},

  // То же из вкладки «Акты» — там договор ещё не выбран (#629).
  actinitpick:{title:'Акт обследования без выезда',
    lead:'Объект и инженер — текстом. Состояние систем и недостатки опишите в заключении после создания.',
    fields:[
    ['contract_id','Договор','ksel',1],
    ['site_name','Объект','text',1],
    ['address','Адрес','text'],
    ['day','Дата обследования','date',1],
    ['engineer','Инженер','text']]},

  actsum:{title:'Текст акта',
    lead:'Строка в таблице «Выполненные работы» акта без выездов.',
    fields:[
    ['summary','Что сделано','area',1]]}
};

// Удалить можно только уже сохранённое: объект, систему или договор.
var DEL={site:['/to/sites/','объект'],system:['/to/systems/','систему'],contract:['/to/contracts/','договор']};
function formDelId(){
  var f=T.form; if(!f||!DEL[f.kind])return null;
  return f.kind==='system'?f.sysId:f.id;
}

// Форма — окно поверх экрана, а не блок, вставленный над карточкой.
// Первая редакция рисовала её врезкой в поток, и человек не понимал, где
// заканчивается форма и начинается объект: на снимке владельца форма
// «Адрес обслуживания» висела прямо над карточкой того же адреса.
function formBox(){
  var f=FORMS[T.form.kind]; if(!f)return '';
  var v=T.form.values||{};
  var body=f.fields.map(function(fd){
    var key=fd[0],lbl=fd[1],typ=fd[2],req=fd[3],x=fd[4];
    var opts=(typ==='select')?x:null;
    var hint=(typ==='select')?fd[5]:x;
    var val=v[key];
    // Незаполненное поле подсвечиваем слабым жёлтым и показываем пример.
    // Не «обязательно/необязательно», а просто «сюда ещё не вводили»:
    // на форме из двенадцати полей глазами видно, куда идти дальше.
    var isEmpty=(val==null||val==='');
    var ph=(PH[T.form.kind]||{})[key]||'';
    var ecls=isEmpty?' empty':'';
    var wide=(typ==='addr'||typ==='sitesel'||typ==='ksel'||typ==='inn'||typ==='area'||key==='note'||key==='detail'||key==='title'||key==='remedy');
    var ctl;
    if(typ==='area')
      ctl='<textarea class="tf'+ecls+'" data-fk="'+key+'" rows="6" style="resize:vertical;min-height:130px;height:auto">'+E(val==null?'':val)+'</textarea>';
    else if(typ==='select')
      ctl='<select class="tf" data-fk="'+key+'">'+opts.map(function(o){
        return '<option value="'+E(o[0])+'"'+(String(val)===String(o[0])?' selected':'')+'>'+E(o[1])+'</option>';}).join('')+'</select>';
    else if(typ==='cpsel'||typ==='sitesel1'){
      var src=(typ==='cpsel')?(T.cps||[]):(T.sites||[]);
      ctl='<select class="tf" data-fk="'+key+'"><option value="">— не выбрано —</option>'
        +src.map(function(o){return '<option value="'+o.id+'"'+(String(val)===String(o.id)?' selected':'')+'>'+E(o.name)+'</option>';}).join('')+'</select>';
      if(!src.length)ctl+='<div class="tfwarn">Список пуст — сначала заведите их во вкладке «'+(typ==='cpsel'?'Юрлица':'Объекты')+'»</div>';
    }
    else if(typ==='ksel'){
      var ks=(T.contracts||[]).filter(function(o){return o.status==='active';});
      ctl='<select class="tf" data-fk="'+key+'"><option value="">— не выбрано —</option>'
        +ks.map(function(o){return '<option value="'+o.id+'"'+(String(val)===String(o.id)?' selected':'')+'>'
          +E(o.number+' · '+(o.counterparty||''))+'</option>';}).join('')+'</select>';
      if(!ks.length)ctl+='<div class="tfwarn">Действующих договоров нет — заведите во вкладке «Договоры»</div>';
    }
    else if(typ==='entsel')
      ctl='<select class="tf" data-fk="'+key+'"><option value="">— не выбрано —</option>'
        +(T.ents||[]).map(function(o){return '<option value="'+o.id+'"'+(String(val)===String(o.id)?' selected':'')+'>'+E(o.name)+'</option>';}).join('')+'</select>';
    else if(typ==='syssel')
      ctl='<select class="tf" data-fk="'+key+'">'
        +Object.keys((T.meta&&T.meta.systems)||{}).map(function(k){
          return '<option value="'+E(k)+'"'+(val===k?' selected':'')+'>'+E(sysRu(k))+'</option>';}).join('')+'</select>';
    else if(typ==='sitesel'){
      var sel=Array.isArray(val)?val.map(String):[];
      ctl='<div class="tfmulti">'+(T.sites||[]).map(function(o){
        return '<label><input type="checkbox" data-fm="'+key+'" value="'+o.id+'"'
          +(sel.indexOf(String(o.id))>=0?' checked':'')+'><span>'+E(o.name)+'</span></label>';}).join('')
        +((T.sites||[]).length?'':'<div class="tfwarn">Адресов ещё нет — заведите их во вкладке «Объекты»</div>')+'</div>';
    }
    else if(typ==='inn')
      ctl='<div class="tfrow">'
        +'<input class="tf'+ecls+'" data-fk="'+key+'" id="toInn" inputmode="numeric" placeholder="'+E(ph||'10 или 12 цифр')+'" value="'+E(val==null?'':val)+'">'
        +'<button class="tbtn go" data-to="lookup" type="button">Найти в ЕГРЮЛ</button></div>'
        +'<div class="tfnote" id="toInnNote"></div>';
    else if(typ==='addr')
      ctl='<input class="tf'+ecls+'" data-fk="'+key+'" id="toAddr" autocomplete="off" placeholder="'+E(ph||'начните вводить город и улицу')+'" value="'+E(val==null?'':val)+'">'
        +'<div class="toaddr" id="toAddrDrop"></div>'
        +'<div class="tfnote'+(v.fias_id?' ok':'')+'" id="toAddrNote">'
        +(v.fias_id?'адрес сверен по справочнику':'')+'</div>';
    else if(typ==='check')
      ctl='<label class="tfchk"><input type="checkbox" data-fk="'+key+'"'+(val?' checked':'')+'><span>да</span></label>';
    else
      ctl='<input class="tf'+ecls+'" data-fk="'+key+'" type="'+(typ==='date'?'date':(typ==='number'?'number':'text'))
        +'" placeholder="'+E(ph)+'" value="'+E(val==null?'':val)+'"'
        +(typ==='number'?' step="any" inputmode="decimal"':'')+'>';

    return '<div class="tfield'+(wide?' wide':'')+'">'
      +'<div class="tflab">'+E(lbl)+(req?'<i>обязательно</i>':'')
      +(hint?'<button class="tfq" type="button" data-to="hint" data-h="'+E(hint)+'" title="Пояснение">?</button>':'')
      +'</div>'+ctl+'</div>';
  }).join('');

  return '<div class="tomodal" data-to="modalbg"><div class="tomwin">'
    +'<div class="tomhead"><div><b>'+E(f.title)+'</b>'
    +(f.lead?'<div class="s">'+E(f.lead)+'</div>':'')+'</div>'
    +'<button class="tbtn x" data-to="formclose" title="Закрыть">✕</button></div>'
    +'<div class="tombody"><div class="tfgrid">'+body+'</div>'
    +'<div class="tfhint"></div></div>'
    +'<div class="tomfoot">'
    +(formDelId()?'<button class="tbtn danger" data-to="formdel">Удалить</button>':'')
    +'<button class="tbtn" data-to="formclose">Отмена</button>'
    +'<button class="tbtn go" data-to="formsave">Сохранить</button></div>'
    +'</div></div>';
}

// Акт открывается отдельным окном без адреса — у него нет «назад», и на
// телефоне из него не выйти. Панель вешается отсюда, а не кнопками с
// onclick в самом документе: окно наследует CSP приложения, встроенные
// обработчики там не работают. На печать панель не попадает.
function docBar(w){
  var d=w.document, st=d.createElement('style'), bar=d.createElement('div');
  st.textContent='.docbar{position:sticky;top:0;z-index:9;display:flex;gap:8px;padding:10px 0;background:#fff}'
    +'.docbar button{font:600 14px/1 -apple-system,Segoe UI,Roboto,sans-serif;padding:11px 16px;'
    +'border:1px solid #d3d8e0;border-radius:8px;background:#fff;color:#111;cursor:pointer}'
    +'@media print{.docbar{display:none}}';
  bar.className='docbar';
  bar.innerHTML='<button type="button" data-k="back">← Назад</button>'
    +'<button type="button" data-k="print">🖨 Печать</button>';
  d.head.appendChild(st); d.body.insertBefore(bar,d.body.firstChild);
  bar.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b)return;
    if(b.dataset.k==='print')w.print(); else {w.close(); window.focus();}});
}

function readForm(){
  // Поля, которые заполняются выбором подсказки, а не руками: на экране их
  // нет, но потерять их при сохранении нельзя — по координатам считается
  // расхождение отметки инженера, а по ФИАС ловится дубль адреса.
  var out={};
  if(T.form&&T.form.kind==='site'){
    var v0=T.form.values||{};
    out.fias_id=v0.fias_id||null; out.verified=!!v0.verified;
    out.lat=(v0.lat==null?null:Number(v0.lat)); out.lon=(v0.lon==null?null:Number(v0.lon));
  }
  document.querySelectorAll('#toView [data-fk]').forEach(function(el){
    var k=el.dataset.fk;
    if(el.type==='checkbox')out[k]=el.checked;
    else if(el.value==='')out[k]=null;
    else if(el.type==='number')out[k]=Number(el.value);
    else out[k]=el.value;
  });
  var multi={};
  document.querySelectorAll('#toView [data-fm]').forEach(function(el){
    var k=el.dataset.fm; multi[k]=multi[k]||[];
    if(el.checked)multi[k].push(Number(el.value));
  });
  Object.keys(multi).forEach(function(k){out[k]=multi[k];});
  return out;
}

/* ═══════════════════ ЗАГРУЗКА ═══════════════════ */
async function loadMeta(){if(T.meta)return;try{T.meta=await tapi('/to/meta');}catch(e){T.meta={};}}
async function loadEnts(){if(T.ents)return;try{T.ents=await tapi('/to/entities');}catch(e){T.ents=[];}}

async function loadTb(){
  T.tb=null;render();
  try{T.tb=await tapi('/to/import/timebot?only_new='+(T.tbNew?'true':'false')
        +(T.tbQ?('&search='+encodeURIComponent(T.tbQ)):''));T.err='';}
  catch(e){T.tb=false;T.err=e.message;}
  render();}

async function loadSites(){T.sites=null;render();
  try{T.sites=await tapi('/to/sites'+(T.q?('?search='+encodeURIComponent(T.q)):''));T.err='';}
  catch(e){T.sites=[];T.err=e.message;}render();}
async function loadSite(id){T.site=true;render();
  try{T.site=await tapi('/to/sites/'+id);T.err='';}catch(e){T.site=null;T.err=e.message;}render();
  if(T.site){loadJournal(id);if(isMgr())loadRequests(id);}}
// Журнал объекта в раскрытой строке инженера — тот же, что в карточке менеджера.
async function loadEngJournal(id){
  var row=((T.eng||{}).todo||[]).concat((T.eng||{}).done||[],(T.eng||{}).other||[])
    .filter(function(r){return String(r.id)===String(id);})[0];
  if(!row||!row.mon)return;
  T.ejr[id]={data:null,open:{}};render();
  try{T.ejr[id].data=await tapi('/to/sites/'+id+'/journal');}catch(e){T.ejr[id].data=false;}
  render();}
async function loadRequests(id){
  try{T.sreq={site:id,rows:await tapi('/to/sites/'+id+'/requests')};}catch(e){T.sreq=null;}
  render();}
function jrQuery(f){
  f=f||{};
  return '?date_from='+encodeURIComponent(f.from||'')+'&date_to='+encodeURIComponent(f.to||'')
    +'&event='+encodeURIComponent(f.ev||'');}
async function loadJournal(id,f){
  T.jr={site:id,data:null,f:f||null};render();
  try{T.jr.data=await tapi('/to/sites/'+id+'/journal'+jrQuery(f));}
  catch(e){T.jr.data=false;T.jr.err=e.message;}
  render();}
// Файл через fetch, а не ссылкой: ручка требует заголовок сессии.
async function csvDownload(path,say){
  var r=await fetch('/montazh/api'+path,{headers:{'X-FSE-Session':sess()}});
  if(!r.ok)return say('Выгрузка не получилась: ошибка '+r.status);
  var m=(r.headers.get('content-disposition')||'').match(/filename="([^"]+)"/);
  var u=URL.createObjectURL(await r.blob()), lnk=document.createElement('a');
  lnk.href=u; lnk.download=m?m[1]:'journal.csv'; document.body.appendChild(lnk); lnk.click();
  lnk.remove(); setTimeout(function(){URL.revokeObjectURL(u);},1000);
}
function jrFilter(){
  var v=function(id){var el=document.getElementById(id);return el?el.value:'';};
  return {from:v('jrFrom'),to:v('jrTo'),ev:v('jrEv')};}
async function loadCps(){try{T.cps=await tapi('/to/counterparties');}catch(e){T.cps=[];T.err=e.message;}render();}
async function loadContracts(){T.contracts=null;render();
  try{T.contracts=await tapi('/to/contracts');T.err='';}catch(e){T.contracts=[];T.err=e.message;}render();}
async function loadEngs(){
  if(T.engs)return T.engs;
  try{T.engs=await tapi('/to/engineers');}catch(e){T.engs=[];}
  return T.engs;}

async function loadPlan(){
  // Инженеру сетка не нужна: у него телефон и один вопрос — куда ехать.
  if(!isMgr()){
    T.planMode='mine';T.mine=null;render();
    try{T.mine=await tapi('/to/plan/mine?days=7');T.err='';}
    catch(e){T.mine=[];T.err=e.message;}
    return render();
  }
  T.planMode='cal';
  await loadEngs();
  T.cal=null;render();
  var n=new Date();
  if(!T.calY){T.calY=n.getFullYear();T.calM=n.getMonth()+1;}
  // Грузим ровно один месяц. Год разом — это те же шестьсот строк, только
  // разложенные по клеткам, и всё равно нечитаемые.
  try{T.cal=await tapi('/to/calendar?year='+T.calY+'&month='+T.calM
        +(T.calEng?('&engineer='+T.calEng):''));T.err='';}
  catch(e){T.cal=false;T.err=e.message;}
  render();}
async function loadMetrics(){T.met=null;render();
  try{T.met=await tapi('/to/metrics?month='+metIso());}catch(e){T.met=false;T.metErr=e.message;}render();}
async function loadActs(){T.acts=null;render();
  try{T.acts=await tapi('/to/acts?year='+T.year);T.err='';}catch(e){T.acts=[];T.err=e.message;}
  try{T.actsInit=await tapi('/to/acts/initial/pending');}catch(e){T.actsInit=[];}
  render();}
async function loadGrants(){T.grants=null;render();
  try{T.grants=await tapi('/to/portal/grants');T.err='';}catch(e){T.grants=[];T.err=e.message;}render();}

async function loadVisit(){
  try{var d=await tapi('/to/visit/current');T.visit=d.visit;T.err='';}
  catch(e){T.visit=null;T.err=e.message;}
  if(T.visit){T.checklist=null;render();
    try{T.checklist=await tapi('/to/visit/checklist');}catch(e){T.checklist={due:[],checks:[],defects_open:[]};}
  }else{T.eng=null;render();
    try{T.eng=await tapi('/to/visit/month'+(T.engMonth?('?month='+T.engMonth):''));}
    catch(e){T.eng=false;T.err=e.message;}}
  render();}

async function loadPortal(){T.portal=null;render();
  try{T.portal=await tapi('/to/portal');T.err='';}catch(e){T.portal={sites:[]};T.err=e.message;}render();
  // Сводка сигналов — отдельным запросом: список объектов не ждёт журналы.
  try{T.pmon=await tapi('/to/portal/monitoring');}catch(e){T.pmon=null;}render();}
async function loadPortalCard(id){T.pcard=true;render();
  try{T.pcard=await tapi('/to/portal/site/'+id);T.err='';}catch(e){T.pcard=null;T.err=e.message;}render();
  if(T.pcard){loadPortalJournal(id);loadPortalRequest(id);}}
async function loadPortalRequest(id){
  var keep=T.preq&&String(T.preq.site)===String(id)?T.preq.form:false;
  try{var r=await tapi('/to/portal/site/'+id+'/request');T.preq={site:id,req:r.request,form:keep};}
  catch(e){T.preq=null;}
  render();}
async function loadPortalJournal(id,f){
  var keep=T.pjr&&String(T.pjr.site)===String(id)?T.pjr.flt:false;
  T.pjr={site:id,data:null,flt:keep,open:{}};
  try{T.pjr.data=await tapi('/to/portal/site/'+id+'/journal'+jrQuery(f));}
  catch(e){T.pjr.data=false;T.pjr.err=e.message;}
  render();}

async function loadSub(){
  await loadMeta();
  if(isCust())return T.pcard?null:loadPortal();
  if(engView())return loadVisit();
  if(T.sub==='metrics')return loadMetrics();
  if(T.sub==='sites')  {if(!T.cps)loadCps(); return loadSites();}
  if(T.sub==='plan')   return loadPlan();
  if(T.sub==='contracts'){await loadCps();await loadEnts();if(!T.sites)await loadSites();
                          loadGrants();return loadContracts();}
  if(T.sub==='acts')   return loadActs();
  if(T.sub==='cps')    {T.cps=null;render();return loadCps();}
  if(T.sub==='staff')  {T.staff=null;render();
                        try{T.staff=await tapi('/to/staff');T.err='';}
                        catch(e){T.staff={staff:[],presets:{}};T.err=e.message;}
                        return render();}
}

/* ═══════════════════ КП НА ТО (#599) ═══════════════════
   Системы КП — те, что в шаблоне «КП-FSE-ТО»; галочки ставятся по системам
   объекта, цена за квартал — по каждой отмеченной. */
var KP_SYS=[['aps_soue','АПС+СОУЭ',['aups','souz']],['apt','АПТ',['aupt_water','aupt_powder','aupt_aerosol']],
  ['vpv','ВПВ',['vpv']],['augpt','АУГПТ',['aupt_gas']],['os','Охранная сигнализация',[]]];
function toLetter(){
  var d=T.site; if(!d||d===true||typeof kpLetter!=='function')return;
  var s=d.site, cust=((d.parties||[])[0]||{}).name||((d.contracts||[])[0]||{}).counterparty||'';
  kpLetter({sub:s.name,org:cust,object:[s.name,s.address].filter(Boolean).join(', ')});
}
function toKp(){
  var d=T.site; if(!d||d===true)return;
  var s=d.site;
  kpTo({sub:s.name,customer:((d.parties||[])[0]||{}).name||((d.contracts||[])[0]||{}).counterparty||'',
    object:[s.name,s.address].filter(Boolean).join(', '),
    kinds:(d.systems||[]).map(function(y){return y.kind;})});
}
// Форма одна для объекта «Обслуживания» и для сделки в CRM (#664): у сделки
// сделка уже выбрана, а систем объекта нет — галочки ставит менеджер.
function kpTo(o){
  if(typeof kpGoogle!=='function')return;
  var kinds=o.kinds||[];
  kpGoogle({sub:o.sub||'',path:'/deal-docs/kp/to',deal:o.deal,after:o.after,
    body:'<div class="fcell wide"><div class="flab">Заказчик <i>обязательно</i></div>'
      +'<input class="fin" id="kgCust" maxlength="200" value="'+E(o.customer||'')+'"></div>'
      +'<div class="fcell wide"><div class="flab">Объект</div>'
      +'<input class="fin" id="kgObj" maxlength="300" value="'+E(o.object||'')+'"></div>'
      +'<div class="fcell wide"><div class="flab">Системы и цена за квартал, ₽</div>'
      +KP_SYS.map(function(x){
        var on=x[2].some(function(k){return kinds.indexOf(k)>=0;});
        return '<label class="optrow price"><input type="checkbox" data-kg="'+x[0]+'"'+(on?' checked':'')+'>'
          +'<span>'+E(x[1])+'</span>'
          +'<input class="fin" type="number" min="0" step="100" inputmode="decimal" data-kgp="'+x[0]+'"'+(on?'':' disabled')+'></label>';
      }).join('')+'</div>',
    init:function(w){
      w.addEventListener('change',function(ev){
        var c=ev.target.closest('[data-kg]'); if(!c)return;
        var pr=w.querySelector('[data-kgp="'+c.dataset.kg+'"]');
        pr.disabled=!c.checked; if(c.checked)pr.focus();});},
    collect:function(w){
      var systems=[], bad='';
      KP_SYS.forEach(function(x){
        if(!w.querySelector('[data-kg="'+x[0]+'"]').checked)return;
        var v=Number(w.querySelector('[data-kgp="'+x[0]+'"]').value);
        if(!(v>0)&&!bad)bad='Укажите цену для «'+x[1]+'»';
        systems.push({code:x[0],price:v});});
      var c=w.querySelector('#kgCust').value.trim();
      if(!c)return 'Укажите заказчика';
      if(!systems.length)return 'Отметьте хотя бы одну систему';
      return bad||{customer:c,object:w.querySelector('#kgObj').value.trim(),systems:systems};}});
}

/* ═══════════════════ СОБЫТИЯ ═══════════════════ */
document.addEventListener('click',async function(ev){
  var el=ev.target.closest('[data-to]'); if(!el)return;
  var a=el.dataset.to;
  var T_=function(m){if(typeof toast==='function')toast(m);};

  try{
    if(a==='tab'){T.sub=el.dataset.t;T.site=null;T.form=null;render();return loadSub();}
    if(a==='kp')return toKp();
    if(a==='letter')return toLetter();
    if(a==='crmdeal')return window.crmOpenDeal&&window.crmOpenDeal(el.dataset.id);

    // ── метрики отдела ──
    if(a==='metmove'){
      T.metM+=Number(el.dataset.d)||0;
      if(T.metM>12){T.metM=1;T.metY++;} if(T.metM<1){T.metM=12;T.metY--;}
      return loadMetrics();}
    if(a==='metreload')return loadMetrics();
    if(a==='metgo'){T.sub=el.dataset.t;T.site=null;T.form=null;render();return loadSub();}
    if(a==='metsite'){T.sub='sites';T.form=null;if(!T.sites)loadSites();return loadSite(el.dataset.id);}

    // ── календарь ──
    if(a==='calmove'){
      var dd=Number(el.dataset.d)||0;
      if(!dd){var n2=new Date();T.calY=n2.getFullYear();T.calM=n2.getMonth()+1;}
      else{T.calM+=dd; if(T.calM>12){T.calM=1;T.calY++;} if(T.calM<1){T.calM=12;T.calY--;}}
      T.calPick=null;T.calDay=null;return loadPlan();}
    if(a==='caleng'){T.calEng=el.dataset.e||'';T.calPick=null;T.calDay=null;return loadPlan();}
    if(a==='calclose'){T.calPick=null;T.calDay=null;return render();}
    if(a==='calday'){
      // Клетка открывается списком, только если работ больше, чем влезло.
      var day=el.dataset.day; if(!day)return;
      var n3=(T.cal&&T.cal.items||[]).filter(function(x){return x.planned_on===day}).length;
      if(n3>4){T.calDay=day;return render();}
      return;}
    if(a==='calitem'){
      ev.stopPropagation();
      var id=Number(el.dataset.id);
      var it=(T.cal&&T.cal.items||[]).concat(T.cal&&T.cal.tail||[],T.cal&&T.cal.unagreed||[])
             .filter(function(x){return x.id===id})[0];
      // У инженера работы лежат внутри объектов экрана «Мои объекты».
      if(!it&&T.eng)(T.eng.todo||[]).forEach(function(r){r.works.forEach(function(w){
        if(w.plan_id===id)it=Object.assign({id:id,site_name:r.name},w);});});
      if(!it)return;
      T.calPick=it;T.calDay=null;return render();}
    if(a==='calsave'){
      var dt=(document.getElementById('calDate')||{}).value||'';
      var en=(document.getElementById('calEngSel')||{}).value||'';
      var nt=(document.getElementById('calNote')||{}).value||'';
      var b2=dt?{planned_on:dt,note:nt||null}:{no_date:true,note:nt||null};
      if(isMgr()){if(en)b2.assigned_to=Number(en); else b2.unassign=true;}
      var r4=await jpost('/to/plan/'+el.dataset.id,b2,'PUT');
      T_(r4.late_plan?'Сохранено. Выезд назначен позже нормативного срока — это отмечено в журнале'
                     :(dt?'Сохранено':'Сохранено, дата не согласована'));
      T.calPick=null;return engView()?loadVisit():loadPlan();}
    if(a==='site'){return loadSite(el.dataset.id);}
    if(a==='sback'){T.site=null;return render();}
    if(a==='engopen'){
      var oid=el.dataset.id; T.engOpen[oid]=!T.engOpen[oid]; render();
      if(T.engOpen[oid])loadEngJournal(oid);
      return;}
    if(a==='engall'){T.engAll[el.dataset.g]=true;return render();}
    // Месяц экрана инженера (#527): от показанного, «Сегодня» — пустой, сервер сам берёт текущий.
    if(a==='engmonth'){
      var md=Number(el.dataset.m)||0, mp=String((T.eng&&T.eng.month)||'').split('-');
      if(!md||mp.length<2)T.engMonth='';
      else{var mt=new Date(+mp[0],+mp[1]-1+md,1);
        T.engMonth=mt.getFullYear()+'-'+String(mt.getMonth()+1).padStart(2,'0');}
      T.engOpen={};T.engAll={};return loadVisit();}
    if(a==='reqmove'){
      await jpost('/to/requests/'+el.dataset.id+'/'+el.dataset.v,{});
      T_(el.dataset.v==='accept'?'Принята':'Закрыта');
      return loadRequests(el.dataset.site);}
    if(a==='jrshow'){return loadJournal(el.dataset.id,jrFilter());}
    if(a==='jrcsv'){return csvDownload('/to/sites/'+el.dataset.id+'/journal.csv'+jrQuery(jrFilter()),T_);}

    // ── перенос из TimeBot ──
    if(a==='combine'){
      var tid=Number(el.dataset.tid);
      var u9=(T.staff&&T.staff.staff||[]).filter(function(x){return x.user_id===tid})[0];
      if(!u9)return;
      var pr=Object.assign({},u9.presets||{});
      pr[el.dataset.k]=el.checked;
      var r9=await jpost('/to/staff/combine',{user_id:tid,presets:pr});
      T_(r9.hint||'Сохранено');
      T.staff=null;render();
      try{T.staff=await tapi('/to/staff');}catch(e){T.staff={staff:[],presets:{}};}
      return render();}

    if(a==='tbopen'){T.tbOpen=true;T.tb=null;T.tbPick={};T.tbEdit={};render();return loadTb();}
    if(a==='tbclose'){T.tbOpen=false;T.tb=null;T.tbPick={};T.tbEdit={};return render();}
    if(a==='tbnew'){T.tbNew=true;return loadTb();}
    if(a==='tball'){T.tbNew=false;return loadTb();}
    if(a==='tbpick'){
      var id=el.dataset.id;
      T.tbPick[id]=el.checked;
      // Разбор копируем в правку при первом же выборе: дальше человек
      // правит свою копию, а не то, что пришло с сервера.
      if(el.checked&&!T.tbEdit[id]){
        var src=(T.tb.items||[]).filter(function(x){return String(x.id)===String(id)})[0];
        if(src)T.tbEdit[id]=Object.assign({},src.parsed);
      }
      return render();}
    if(a==='tbapply'){
      var list=[];
      (T.tb.items||[]).forEach(function(x){
        if(!T.tbPick[x.id])return;
        var p=T.tbEdit[x.id]||x.parsed||{};
        if(!p.address||p.address.trim().length<3)return;
        list.push({tb_object_id:x.id,amo_id:x.amo_id,name:x.name,
                   address:p.address.trim(),customer:p.customer||null,
                   work:p.work||null,floor:p.floor||null,room:p.room||null});
      });
      if(!list.length)return T_('У отмеченных объектов не заполнен адрес');
      var r5=await jpost('/to/import/timebot',{items:list});
      var msg='Перенесено: '+r5.created;
      if(r5.skipped&&r5.skipped.length)
        msg+='. Пропущено: '+r5.skipped.map(function(x){return x.name+' — '+x.why}).join('; ');
      T_(msg);
      T.tbPick={};T.tbEdit={};
      await loadTb();
      T.sites=null;loadSites();
      return;}
    if(a==='planm'){
      var pk={site:Number(el.dataset.id),m:el.dataset.m};
      T.planM=(T.planM&&T.planM.site===pk.site&&T.planM.m===pk.m)?null:pk;
      T.planW=null;return render();}
    if(a==='planw'){
      T.planW=(T.planW===Number(el.dataset.id))?null:Number(el.dataset.id);
      return render();}
    if(a==='tbhist'){
      var sid=Number(el.dataset.id);
      if(T.tbHist&&T.tbHist.site===sid){T.tbHist=null;return render();}
      T.tbHist={site:sid,items:null};render();
      try{var d5=await tapi('/to/sites/'+sid+'/history');
          T.tbHist={site:sid,items:d5.items||[],hint:d5.hint};}
      catch(e){T.tbHist={site:sid,items:[],hint:e.message};}
      return render();}
    if(a==='pcard'){return loadPortalCard(el.dataset.id);}
    if(a==='pback'){T.pcard=null;T.pjr=null;return render();}
    if(a==='sigq'||a==='sigsnd'){T.sigOpen[el.dataset.k]=!T.sigOpen[el.dataset.k];return render();}
    if(a==='pcontact'){T.pcontact=!T.pcontact;return render();}
    if(a==='preq'){T.preq={site:el.dataset.id,req:null,form:true};render();
      var pn=document.getElementById('preqNote');if(pn)pn.focus();return;}
    if(a==='preqsend'){
      var note=(document.getElementById('preqNote')||{}).value||'';
      var rr=await jpost('/to/portal/site/'+el.dataset.id+'/request',{note:note});
      T.preq={site:el.dataset.id,req:rr.request,form:false};
      T_(rr.created?'Отправлено':'Заявка уже есть');return render();}
    if(a==='pjrflt'){if(T.pjr){T.pjr.flt=!T.pjr.flt;render();}return;}
    if(a==='evgrp'||a==='evfold'){
      var sn=el.dataset.s, stt=sn==='p'?T.pjr:(sn==='m'?T.jr:(T.ejr||{})[sn.slice(1)]);
      if(stt){stt.open=stt.open||{};stt.open[el.dataset.g]=(a==='evgrp');render();}return;}
    if(a==='pjrshow'){return loadPortalJournal(el.dataset.id,jrFilter());}
    if(a==='pjrcsv'){
      var pd=T.pjr&&T.pjr.data;
      return csvDownload('/to/portal/site/'+el.dataset.id+'/journal.csv'
        +jrQuery(pd?{from:pd.date_from,to:pd.date_to,ev:pd.event}:null),T_);}

    if(a==='form'){
      var kind=el.dataset.f,id=el.dataset.id;
      T.form={kind:kind,values:{},id:null,site:null};
      if(kind==='site'&&id&&T.site&&T.site.site){T.form.values=Object.assign({},T.site.site);T.form.id=id;}
      if(kind==='cp'&&id){var c=(T.cps||[]).filter(function(x){return String(x.id)===String(id)})[0];
        if(c){T.form.values=Object.assign({},c);T.form.id=id;}}
      if(kind==='contract'&&id){var k=(T.contracts||[]).filter(function(x){return String(x.id)===String(id)})[0];
        // site_ids приходит с сервера массивом идентификаторов. Раньше здесь
        // стояло сопоставление по строке названий — способ однажды отвязать
        // объект, чьё имя оказалось подстрокой соседнего.
        if(k){T.form.values=Object.assign({},k,{site_ids:(k.site_ids||[])});T.form.id=id;}}
      if((kind==='party'||kind==='system'||kind==='plink')&&id)T.form.site=id;
      if(kind==='plink')T.form.values=Object.assign({silence_minutes:60},(T.jr&&T.jr.data&&T.jr.data.link)||{});
      if(kind==='system'){
        var sid=el.dataset.sys;
        if(sid&&T.site&&T.site.systems){
          var y=T.site.systems.filter(function(z){return String(z.id)===String(sid)})[0];
          if(y){T.form.values=Object.assign({},y);T.form.sysId=sid;}
        }else{
          T.form.values.kind=Object.keys((T.meta&&T.meta.systems)||{aups:1})[0];
        }
      }
      return render();
    }
    if(a==='formclose'){T.form=null;return render();}
    if(a==='modalbg'){ if(ev.target===el){T.form=null;render();} return;}
    // Пояснение по «?». Не title: на телефоне всплывающей подсказки нет,
    // а объяснение нужно именно там, где вводят с телефона.
    if(a==='hint'){
      // Два модальных окна («перенос выезда» и общая форма) могут быть
      // в DOM одновременно, у каждого своя подсказка — раньше обе
      // рендерились с одним id, и getElementById брала всегда первую.
      var win=el.closest('.tomwin');
      var box=win&&win.querySelector('.tfhint'); if(!box)return;
      var txt=el.dataset.h||'';
      if(box.dataset.cur===txt){box.textContent='';box.dataset.cur='';box.classList.remove('on');}
      else{box.textContent=txt;box.dataset.cur=txt;box.classList.add('on');}
      return;}

    // Заполнение карточки юрлица по ИНН. Всё, что ниже поля ИНН, приезжает
    // из ЕГРЮЛ — набивать это руками незачем.
    if(a==='lookup'){
      var inn=(document.getElementById('toInn')||{}).value||'';
      if(!inn.trim())return T_('Введите ИНН');
      T_('Ищу в ЕГРЮЛ…');
      var d=await tapi('/to/lookup?inn='+encodeURIComponent(inn.trim()));
      // Сохраняем то, что человек уже успел набрать: если он заполнил почту
      // и телефон, поиск не должен их стереть. ЕГРЮЛ их и не отдаёт.
      var cur=readForm();
      T.form.values=Object.assign({},cur,d,{inn:d.inn||inn.trim()});
      render();
      var note=document.getElementById('toInnNote');
      if(note)note.innerHTML='Заполнено из '+E(d.source)
        +(d.status&&d.status!=='ACTIVE'
          ? ' · <b style="color:var(--red)">статус: '+E(d.status)+'</b> — договор с таким лучше не заключать'
          : '');
      return;}

    // Доступы заказчику — раскрывающийся блок в карточке договора.
    if(a==='grants'){
      T.grantsFor=el.dataset.id?Number(el.dataset.id):null;
      if(T.grantsFor&&!T.grants)await loadGrants(); else render();
      return;}

    if(a==='grantadd'){
      var tid=(document.getElementById('grTid')||{}).value||'';
      if(!tid.trim())return T_('Введите ID заказчика в системе');
      var scope=(document.getElementById('grScope')||{}).value||'cp';
      var body3={user_id:Number(tid.trim()),
                 can_approve:!!((document.getElementById('grApprove')||{}).value)};
      if(scope==='cp')body3.counterparty_id=Number(el.dataset.cp);
      else body3.site_id=Number(scope);
      var res3=await jpost('/to/portal/grants',body3);
      T_(res3.warning||'Доступ выдан');
      T.grants=null; await loadGrants(); return;}

    if(a==='formsave'){
      var f=T.form; if(!f)return;
      var v=readForm();
      if(f.kind==='site'){
        await (f.id?jpost('/to/sites/'+f.id,v,'PUT'):jpost('/to/sites',v));
        T.form=null;T_('Адрес сохранён');await loadSites();if(f.id)await loadSite(f.id);return;}
      if(f.kind==='cp'){
        await (f.id?jpost('/to/counterparties/'+f.id,v,'PUT'):jpost('/to/counterparties',v));
        T.form=null;T_('Юрлицо сохранено');T.cps=null;return loadCps();}
      if(f.kind==='party'){
        await jpost('/to/sites/'+f.site+'/parties',v);
        T.form=null;T_('Юрлицо привязано');return loadSite(f.site);}
      if(f.kind==='plink'){
        var pl=await jpost('/to/sites/'+f.site+'/panel-link',
          {account:v.account||'',silence_minutes:v.silence_minutes||60},'PUT');
        T.form=null;T_(pl.link?'Передатчик привязан':'Передатчик снят');return loadJournal(f.site);}
      if(f.kind==='system'){
        if(f.sysId){await jpost('/to/systems/'+f.sysId,v,'PUT');T_('Система изменена');}
        else{await jpost('/to/sites/'+f.site+'/systems',v);T_('Система добавлена, регламенты подтянулись');}
        T.form=null;return loadSite(f.site);}
      if(f.kind==='contract'){
        await (f.id?jpost('/to/contracts/'+f.id,v,'PUT'):jpost('/to/contracts',v));
        T.form=null;T_('Договор сохранён. Не забудьте построить план работ.');return loadContracts();}
      if(f.kind==='grant'){
        var res=await jpost('/to/portal/grants',v);
        T.form=null;T_(res.warning||'Доступ выдан');return loadGrants();}
      if(f.kind==='defect'){
        if(f.id){
          await jpost('/to/defects/'+f.id,v,'PUT');
          T.form=null;T_('Замечание изменено');return loadSite(f.site);}
        await jpost('/to/visit/defect',v);
        T.form=null;T_('Замечание записано');return loadVisit();}
      if(f.kind==='actinit'){
        await jpost('/to/acts/'+f.id+'/initial-text',v,'PUT');
        T.form=null;T_('Заключение сохранено');return loadActs();}
      if(f.kind==='actman'){
        var am=await jpost('/to/acts/manual',Object.assign({contract_id:f.id},v));
        T.form=null;T.sub='acts';T.year=Number(v.year)||T.year;
        T.actsNoVisits=(T.actsNoVisits||[]).filter(function(s){return s.contract_id!==f.id;});
        T_('Акт '+am.number+' составлен');return loadActs();}
      if(f.kind==='actinitman'||f.kind==='actinitpick'){
        if(f.kind==='actinitpick'&&!v.contract_id)throw new Error('Выберите договор');
        var aim=await jpost('/to/acts/initial/manual',Object.assign({contract_id:f.id},v));
        T.form=null;T.sub='acts';T.year=Number(String(v.day||'').slice(0,4))||T.year;
        T_('Акт '+aim.number+' составлен — допишите заключение');return loadActs();}
      if(f.kind==='actsum'){
        await jpost('/to/acts/'+f.id+'/summary',v,'PUT');
        T.form=null;T_('Текст акта сохранён');return loadActs();}
      return;
    }

    if(a==='formdel'){
      var fd=T.form,did=formDelId(); if(!did)return;
      var nm=(fd.values&&(fd.values.name||fd.values.title||fd.values.number))||'';
      var qd='Удалить '+DEL[fd.kind][1]+(nm?' «'+nm+'»':'')+'?';
      var okDel=(window.UI&&UI.confirm)
        ?await UI.confirm({title:qd,text:'Отменить удаление будет нельзя.',ok:'Удалить',okIcon:'i-trash'})
        :confirm(qd);
      if(!okDel)return;
      await jpost(DEL[fd.kind][0]+did+'/delete',{});
      T.form=null;T_('Удалено');
      if(fd.kind==='site'){T.site=null;return loadSites();}
      if(fd.kind==='system')return loadSite(fd.site);
      return loadContracts();}

    if(a==='delparty'){
      await jpost('/to/sites/'+el.dataset.site+'/parties/'+el.dataset.id+'/delete',{});
      T_('Убрано');return loadSite(el.dataset.site);}

    if(a==='buildplan'){
      var r=await jpost('/to/contracts/'+el.dataset.id+'/plan?months=12',{});
      T_('План построен: добавлено работ '+r.created+', горизонт '+dmy(r.horizon)
        +(r.initial?'. Первым стоит первичный осмотр — назначьте его инженеру в «Календаре»':''));
      return loadContracts();}

    if(a==='genact'){
      var y=Number((document.getElementById('toActY')||{}).value)||T.year;
      var m=Number((document.getElementById('toActM')||{}).value)||T.month;
      T.year=y;T.month=m;
      var body={year:y,month:m};
      if(el.dataset.k)body.period_kind=el.dataset.k;
      var res=await jpost('/to/acts/generate',body);
      var sk=res.skipped||[];
      // Договоры без выездов уходят списком под кнопки, с «Актом без
      // выездов» на этот же период; в сообщении остаются прочие причины.
      T.actsNoVisits=sk.filter(function(s){return s.no_visits;}).map(function(s){
        return Object.assign({y:y,m:m,k:el.dataset.k||''},s);});
      var other=sk.filter(function(s){return !s.no_visits;});
      var msg='Создано '+res.created+', обновлено '+res.updated;
      if(T.actsNoVisits.length)msg+='. Без выездов: '+T.actsNoVisits.length+' — список под кнопками';
      if(other.length)
        msg+='. Пропущено: '+other.map(function(s){return s.contract+' — '+s.why}).join('; ');
      T_(msg);
      return loadActs();}

    if(a==='actman'){
      // По умолчанию — прошлый месяц: акт выставляют за закончившийся период.
      // Из списка вкладки «Акты» период приходит с кнопкой.
      var pm=new Date();pm.setDate(1);pm.setMonth(pm.getMonth()-1);
      T.form={kind:'actman',id:Number(el.dataset.id),
        values:{year:Number(el.dataset.y)||pm.getFullYear(),
                month:String(el.dataset.m||(pm.getMonth()+1)),period_kind:el.dataset.k||''}};
      return render();}

    if(a==='actinitman'){
      T.form={kind:'actinitman',id:Number(el.dataset.id),values:{day:today()}};
      return render();}

    if(a==='actinitpick'){
      if(!T.contracts)T.contracts=await tapi('/to/contracts');
      T.form={kind:'actinitpick',values:{day:today()}};
      return render();}

    if(a==='actsum'){
      var as=(T.acts||[]).filter(function(x){return String(x.id)===el.dataset.id;})[0];
      if(!as)return;
      T.form={kind:'actsum',id:as.id,values:{summary:(as.data||{}).summary||''}};
      return render();}

    if(a==='actinittext'){
      var ai=(T.acts||[]).filter(function(x){return String(x.id)===el.dataset.id;})[0];
      if(!ai)return;
      T.form={kind:'actinit',id:ai.id,values:{conclusion:(ai.data||{}).conclusion||'',
        recommendations:(ai.data||{}).recommendations||''}};
      return render();}

    if(a==='defedit'){
      var dx=((T.site&&T.site.defects)||[]).filter(function(x){return String(x.id)===el.dataset.id;})[0];
      if(!dx)return;
      T.form={kind:'defect',id:dx.id,site:T.site.site.id,values:Object.assign({},dx)};
      return render();}

    if(a==='notinit'){
      var qn='Это не первичный осмотр?';
      var okN=(window.UI&&UI.confirm)
        ?await UI.confirm({title:qn,text:'Выезд станет обычным и уйдёт из списка, его недостатки — обычными замечаниями.',ok:'Да, не осмотр'})
        :confirm(qn);
      if(!okN)return;
      await jpost('/to/visits/'+el.dataset.id+'/not-initial',{});
      T_('Выезд стал обычным');return loadActs();}

    if(a==='initact'){
      var ia=await jpost('/to/acts/initial',{visit_id:Number(el.dataset.id)});
      T_('Акт '+ia.number+' составлен: стороны, системы и недостатки подставлены');
      return loadActs();}

    if(a==='actst'){
      var body2={status:el.dataset.v};
      if(el.dataset.v==='signed')body2.signed_on=today();
      await jpost('/to/acts/'+el.dataset.id,body2,'PUT');
      T_('Статус изменён');return loadActs();}

    if(a==='printact'||a==='pprintact'){
      // Печатную форму открываем через blob: ручка требует заголовок сессии,
      // а обычный переход по ссылке его не отправит и вернёт 401.
      var html=await tapi(a==='pprintact'?('/to/portal/acts/'+el.dataset.id+'/print')
        :('/to/acts/'+el.dataset.id+'/print?form='+(el.dataset.f||'act')));
      var w=window.open('','_blank');
      if(!w)return T_('Разрешите всплывающие окна, чтобы открыть акт');
      w.document.write(html);w.document.close();docBar(w);return;}

    if(a==='defdel'){
      var dq='Удалить замечание'+(el.dataset.n?' «'+el.dataset.n+'»':'')+'?';
      var okD=(window.UI&&UI.confirm)
        ?await UI.confirm({title:dq,text:'Отменить удаление будет нельзя.',ok:'Удалить',okIcon:'i-trash'})
        :confirm(dq);
      if(!okD)return;
      await jpost('/to/defects/'+el.dataset.id+'/delete',{});
      T_('Замечание удалено');
      if(T.visit)return loadVisit();
      return T.site&&T.site.site?loadSite(T.site.site.id):null;}

    if(a==='defst'){
      await jpost('/to/defects/'+el.dataset.id+'/status',{status:el.dataset.v});
      T_('Статус замечания изменён');
      return T.site&&T.site.site?loadSite(T.site.site.id):null;}

    if(a==='revoke'){
      await jpost('/to/portal/grants/'+el.dataset.id+'/revoke',{});
      T_('Доступ отозван');T.grants=null;return loadGrants();}

    /* ── инженер ── */
    if(a==='vstart'){
      T_('Определяю геопозицию…');
      var g=await geo();
      var r2=await jpost('/to/visit/start',{site_id:Number(el.dataset.id),
        lat:g.lat,lon:g.lon,accuracy_m:g.accuracy_m,kind:el.dataset.k||'plan'});
      T_(r2.warning||'Выезд открыт');
      T.marks={};return loadVisit();}

    // Отмена и удаление выезда (#537) — без менеджера, но с вопросом:
    // нажать мимо на телефоне легко, а вернуть удалённое нельзя.
    if(a==='vcancel'||a==='vdel'){
      var vq=a==='vcancel'?'Отменить выезд?':'Удалить выезд'+(el.dataset.n?' на «'+el.dataset.n+'»':'')+'?';
      var vt=a==='vcancel'
        ?'Выезд исчезнет, будто его не открывали. Загруженные фото из него пропадут.'
        :'Выезд, его отметки и замечания удалятся, закрытые им работы снова станут «к выполнению».';
      var okV=(window.UI&&UI.confirm)
        ?await UI.confirm({title:vq,text:vt,ok:a==='vcancel'?'Отменить выезд':'Удалить',okIcon:'i-trash'})
        :confirm(vq+'\n'+vt);
      if(!okV)return;
      await jpost(a==='vcancel'?'/to/visit/cancel':('/to/visits/'+el.dataset.id+'/delete'),{});
      T.marks={};T_(a==='vcancel'?'Выезд отменён':'Выезд удалён');return loadVisit();}

    if(a==='mark'){
      var k2=el.dataset.k;
      T.marks[k2]={result:el.dataset.r,plan_id:Number(el.dataset.plan)||null,
        system_id:Number(el.dataset.sys)||null,item_code:el.dataset.code||null,
        item_text:el.dataset.text};
      return render();}

    if(a==='markall'){
      var d2=(T.checklist&&T.checklist.due||[])[Number(el.dataset.d)];
      if(!d2)return;
      (d2.items||[]).forEach(function(it,ii){
        T.marks[d2.plan_id+':'+ii]={result:'ok',plan_id:d2.plan_id,
          system_id:d2.system_id,item_code:it.code||null,item_text:it.text};});
      return render();}

    if(a==='vkind'){
      var vk=await jpost('/to/visit/kind',{initial:!!el.dataset.v});
      T_(vk.kind==='initial'?'Отмечен первичный осмотр':'Отметка первичного осмотра снята');
      return loadVisit();}

    if(a==='newdefect'){T.form={kind:'defect',values:{severity:'minor'}};return render();}

    if(a==='vstop'){
      var list=Object.keys(T.marks).map(function(k3){return T.marks[k3];});
      // Первичный осмотр подтверждается актом с недостатками, а не чек-листом,
      // повторный выезд в месяце (#537) — фото.
      var initV=T.visit&&(T.visit.kind==='initial'||T.visit.kind==='extra');
      if(!list.length&&!initV)return T_('Отметьте хотя бы один пункт — без этого выезд нечем подтвердить');
      T_('Определяю геопозицию…');
      var g2=await geo();
      // Сначала отметки, потом закрытие. Обратный порядок означал бы закрытый
      // выезд с пустым чек-листом при обрыве связи между двумя запросами.
      if(list.length)await jpost('/to/visit/check',list);
      await jpost('/to/visit/stop',{lat:g2.lat,lon:g2.lon,accuracy_m:g2.accuracy_m});
      T.marks={};T_('Выезд закрыт');return loadVisit();}

    /* ── заказчик ── */
    if(a==='decide'){
      await jpost('/to/portal/defects/'+el.dataset.id+'/decide',{decision:el.dataset.v});
      T_(el.dataset.v==='agreed'?'Согласовано':'Отказ записан');
      return loadPortalCard(T.pcard.site.id);}

    if(a==='addrpick'){
      var it=(T.addrItems||[])[Number(el.dataset.i)]; if(!it)return;
      var cur2=readForm();
      // Кладём в форму строку, а рядом — ФИАС и координаты. Человек их не
      // видит и не вводит, но именно они делают адрес сверенным, а проверку
      // геометки — живой.
      T.form.values=Object.assign({},cur2,{address:it.value,fias_id:it.fias_id,
        verified:!!it.verified,lat:it.lat,lon:it.lon});
      render();
      var n2=document.getElementById('toAddrNote');
      if(n2)n2.textContent=it.verified
        ? ('адрес сверен по ФИАС'+(it.lat?', координаты подставлены':''))
        : 'в подсказке нет дома — уточните адрес, иначе геометка не проверится';
      return;}

    if(a==='phopen'){
      var u=el.dataset.url; if(!u)return;
      var ov=document.getElementById('tphOv');
      if(!ov){ov=document.createElement('div');ov.id='tphOv';
        ov.innerHTML='<button class="tbtn" id="tphClose">Закрыть</button><img alt="">';
        document.body.appendChild(ov);
        ov.addEventListener('click',function(){ov.classList.remove('on');phFreeT();});}
      ov.querySelector('img').src=u;PHT.open=u;ov.classList.add('on');return;}

  }catch(e){
    // Причина отказа приходит с сервера — показываем её, а не «что-то пошло не так».
    T_(e.message||'Не получилось');
    T.err=e.message||'';render();
  }
},true);

// ── Перенос работы мышью ──
// Только для менеджера и только внутри календаря. На телефоне
// перетаскивания нет вовсе — там работает та же панель по нажатию, и это
// не упущение: пальцем в клетку 40×90 не попасть.
(function drag(){
  var cur=null;
  document.addEventListener('dragstart',function(e){
    var el=e.target.closest&&e.target.closest('.ci[draggable]'); if(!el)return;
    cur=el.dataset.id; el.classList.add('dragging');
    try{e.dataTransfer.setData('text/plain',cur);e.dataTransfer.effectAllowed='move';}catch(_){}
  });
  document.addEventListener('dragend',function(){
    document.querySelectorAll('.ci.dragging').forEach(function(x){x.classList.remove('dragging')});
    document.querySelectorAll('.cd.over').forEach(function(x){x.classList.remove('over')});
    cur=null;});
  document.addEventListener('dragover',function(e){
    var cell=e.target.closest&&e.target.closest('.cd[data-day]'); if(!cell||!cur)return;
    e.preventDefault();
    document.querySelectorAll('.cd.over').forEach(function(x){if(x!==cell)x.classList.remove('over')});
    cell.classList.add('over');});
  document.addEventListener('drop',async function(e){
    var cell=e.target.closest&&e.target.closest('.cd[data-day]'); if(!cell)return;
    e.preventDefault();
    var id=cur||((e.dataTransfer&&e.dataTransfer.getData('text/plain'))||'');
    cell.classList.remove('over'); cur=null;
    if(!id)return;
    try{
      var r=await jpost('/to/plan/'+id,{planned_on:cell.dataset.day},'PUT');
      if(typeof toast==='function')
        toast(r.late_plan?'Перенесено. Выезд теперь позже нормативного срока — отмечено в журнале'
                         :'Перенесено на '+dmy(cell.dataset.day));
      loadPlan();
    }catch(err){if(typeof toast==='function')toast(err.message||'Не перенеслось');}
  });
})();

document.addEventListener('input',async function(e){
  // Подсветка «ещё не заполнено» гаснет на первом же символе. Ждать
  // сохранения нельзя: человек набрал, а поле по-прежнему жёлтое — значит
  // подсказка врёт, и он перестаёт ей верить.
  if(e.target&&e.target.classList&&e.target.classList.contains('tf'))
    e.target.classList.toggle('empty',!e.target.value);

  // Подсказки адреса. Пауза 250 мс: без неё запрос уходит на каждую букву,
  // а справочник платный и считает обращения.
  if(e.target&&e.target.id==='toAddr'){
    var q=e.target.value;
    clearTimeout(window.__toaddr);
    window.__toaddr=setTimeout(async function(){
      var box=document.getElementById('toAddrDrop'); if(!box)return;
      if(q.trim().length<3){box.innerHTML='';return;}
      try{
        var d=await tapi('/to/address?q='+encodeURIComponent(q));
        var note=document.getElementById('toAddrNote');
        if(d.hint){box.innerHTML='';if(note)note.textContent=d.hint;return;}
        box.innerHTML=(d.items||[]).map(function(it,i){
          return '<div class="toaddri" data-to="addrpick" data-i="'+i+'">'+E(it.value)
            +(it.verified?'':'<span class="s"> · без дома</span>')+'</div>';}).join('');
        T.addrItems=d.items||[];
      }catch(err){box.innerHTML='';}
    },250);
    return;
  }
  if(e.target&&e.target.dataset&&e.target.dataset.tbf){
    var id=e.target.dataset.id, f=e.target.dataset.tbf;
    T.tbEdit[id]=T.tbEdit[id]||{};
    T.tbEdit[id][f]=e.target.value;
    e.target.classList.toggle('empty',!e.target.value);
    return;
  }
  if(e.target&&e.target.id==='tbq'){
    clearTimeout(window.__tbq);
    var v5=e.target.value;
    window.__tbq=setTimeout(function(){T.tbQ=v5;loadTb();},350);
    return;
  }
  if(e.target&&e.target.id==='toq'){
    clearTimeout(window.__toq);
    window.__toq=setTimeout(function(){T.q=e.target.value;loadSites();},350);
  }
});
document.addEventListener('change',async function(e){
  if(e.target&&e.target.id==='toJournal'&&e.target.files&&e.target.files[0]){
    var jf=e.target.files[0], sid=e.target.dataset.site;
    e.target.value='';
    try{
      if(typeof toast==='function')toast('Загружаю журнал…');
      var jd=new FormData(); jd.append('file',jf);
      var jr=await tapi('/to/sites/'+sid+'/journal/import',{method:'POST',body:jd});
      var sg=jr.signals&&jr.signals.notices;
      if(typeof toast==='function')toast('Новых '+jr.new+' из '+jr.rows
        +(sg?(' · писем '+sg+(jr.signals.sent?'':', не ушли')):''));
      // Инженер грузит выгрузку из своего списка — обновляем его, а не карточку.
      // Неисправность в выгрузке заводит вызов, поэтому карточке нужны и вызовы.
      if(engView())loadVisit(); else{loadJournal(sid);loadRequests(sid);}
    }catch(err){if(typeof toast==='function')toast(err.message||'Журнал не загрузился');}
    return;
  }
  if(e.target&&e.target.classList&&e.target.classList.contains('toPhoto')
     &&e.target.files&&e.target.files.length){
    // Из галереи выбирают сразу несколько снимков. Грузим по одному: ручка
    // принимает один файл, а неудавшийся снимок не должен ронять остальные.
    var fs=Array.prototype.slice.call(e.target.files), ok=0, last=null, r=null;
    e.target.value='';
    var g=null; try{g=await geo();}catch(_){}
    for(var i=0;i<fs.length;i++){
      try{
        if(typeof toast==='function')
          toast(fs.length>1?('Загружаю снимок '+(i+1)+' из '+fs.length+'…'):'Загружаю снимок…');
        var fd=new FormData(); fd.append('file',fs[i]);
        if(g){fd.append('lat',g.lat);fd.append('lon',g.lon);}
        r=await tapi('/to/visit/photo',{method:'POST',body:fd});
        ok++;
      }catch(err){last=err;}
    }
    if(typeof toast==='function'){
      if(ok===fs.length)toast((ok>1?'Добавлено снимков: '+ok:'Снимок добавлен')+', всего '+r.photos);
      else if(ok)toast('Добавлено '+ok+' из '+fs.length+'. '+((last&&last.message)||'Остальные не загрузились'));
      else toast((last&&last.message)||'Снимок не загрузился');
    }
    if(ok)loadVisit();
  }
});

/* ═══════════════════ ПОДКЛЮЧЕНИЕ РАЗДЕЛА ═══════════════════ */
(function nav(){
  var d=document.querySelector('.drawer'); if(!d)return;
  if(document.querySelector('.nav[data-go="to"]'))return;
  var ref=document.querySelector('.nav[data-go="deal"]')||document.querySelector('.nav[data-go="reports"]');
  var el=document.createElement('div'); el.className='nav'; el.setAttribute('data-go','to');
  el.innerHTML='<span class="ic">🛠</span>Обслуживание';
  if(ref&&ref.parentNode)ref.parentNode.insertBefore(el,ref); else d.appendChild(el);
})();

// Раздел виден и сотруднику, и заказчику — но по разным разрешениям.
// Через SECT_SCOPE это не выражается: там одно право на раздел. Поэтому
// оборачиваем sectAllowed, а не дописываем карту.
var _sect=window.sectAllowed;
window.sectAllowed=function(v){
  // Заказчик — внешний человек, а не сотрудник с урезанными правами.
  // Ему открыт ровно один экран. Проверка меню показала, что «Главная» и
  // «Задачи» объявлены в SECT_SCOPE пустой строкой, то есть открыты любому
  // вошедшему, — и заказчик их видел. Данных там нет, но человеку со
  // стороны нечего делать во внутреннем меню компании.
  if(isCust())return v==='to';
  if(v==='to')return can('to:read')||can('to:portal');
  return typeof _sect==='function'?_sect(v):true;
};
// Заказчику кабинет — единственный экран, который у него есть. Без этого
// он входит и видит пустое приложение: roleDefault выбирает 'home' по
// отсутствию spec:read, а Главная у него тоже ничего не показывает.
var _rd=window.roleDefault;
window.roleDefault=function(r){
  if(can('to:portal')&&!can('spec:read'))return 'to';
  return typeof _rd==='function'?_rd(r):'specs';
};

var _goTo=window.go;
window.go=function(v){
  var el=document.getElementById('toView');
  // Логотип в шапке уводит на Главную мимо меню — спрятать пункт мало.
  // Для заказчика любой переход, кроме его кабинета, возвращает в кабинет.
  if(isCust()&&v!=='to')v='to';
  if(v!=='to'){if(el)el.style.display='none';return _goTo(v);}
  if(!(can('to:read')||can('to:portal'))){
    if(typeof toast==='function')toast('Раздел «Обслуживание» вам не выдан');return;}
  if(typeof drawer==='function'){try{drawer(false)}catch(e){}}
  if(window.fseTrack)fseTrack('view:to');
  document.querySelectorAll('.nav[data-go]').forEach(function(n){
    n.classList.toggle('act',n.dataset.go==='to');});
  view();
  hideViewsExcept('toView');
  document.getElementById('toView').style.display='';
  var on=document.getElementById('objname');
  if(on)on.textContent=isCust()?'Ваши объекты':'Техническое обслуживание';
  render(); loadSub();
};

// ГОНКА: applyRoleNav мог отработать по ответу /auth/me ДО того, как этот
// блок подменил sectAllowed — тогда пункт остался бы скрытым у того, кому
// он положен. Та же страховка, что в «Сделке».
try{if(typeof applyRoleNav==='function')applyRoleNav();}catch(e){}
setTimeout(function(){
  try{if(typeof applyRoleNav==='function')applyRoleNav();}catch(e){}
  // Подстраховки «через 1,5 с увести заказчика в кабинет» здесь больше нет:
  // стартовый переход в kp-01 дожидается разбора всех kp-*, и roleDefault()
  // к тому моменту уже отдаёт заказчику 'to'.
},1500);

/* ═══════════════════ СТИЛИ ═══════════════════ */
/* Стили раздела перенесены в css/kp.css. Вставленные скриптом они
   не знали про вечернюю тему: в них жёстко стояли белый и светло-серый,
   и половина раздела оставалась белой при тёмном фоне. */

// Объект, перенесённый из сделки в «CRM» (#662), открывается сразу карточкой.
function openSite(id){
  T.sub='sites';T.form=null;T.sites=null;
  window.go('to');
  loadSite(id);
}

window.__kp08b={formBox:formBox,openSite:openSite,kpTo:kpTo};
})();
