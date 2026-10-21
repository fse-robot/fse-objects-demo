/* «Назад» браузера и телефона внутри приложения.
   Приложение — одна страница. Пока оно не кладёт в историю своих записей,
   «Назад» уводит с неё на главную сайта, и вход приходится проходить заново.
   Здесь смена раздела или сметы кладёт запись, а окно на весь экран — свою
   поверх неё: «Назад» сначала закрывает окно, потом возвращает раздел.
   Тот же раздел стоит в адресе страницы, и загрузка начинается с него.
   Обёртка go() подключается последней и потому видит переходы всех разделов. */
(function(){
var sheets=[];        // открытые окна, верхнее — последнее: {key, onBack}
var skip=0;           // popstate, вызванные нами самими при закрытии окна кнопкой
var restoring=false;
var here=null;

function spec(){ return typeof curId!=='undefined'?curId:null; }
// Где человек сейчас: видимый раздел, а в редакторе ещё и смета. Сравниваем
// по экрану, а не по имени из go(): раздел без права отвечает подсказкой
// и остаётся на месте — запись под такой переход оставила бы «Назад» вхолостую.
function where(){
  var v=null;
  document.querySelectorAll('div[id$="View"]').forEach(function(d){
    if(!v&&d.style.display!=='none')v=d.id;});
  return v==='editorView'?v+':'+spec():v;
}

// Место пишется и в адрес: обновление страницы и ссылка коллеге открывают
// тот же раздел и ту же смету. Страница по общей ссылке адрес не трогает —
// она и так показывает одну смету.
function hash(st){
  if(typeof PUB!=='undefined'&&PUB)return undefined;
  return '#'+(st.view==='editor'?'editor/'+encodeURIComponent(st.spec):st.view);
}

var _go=window.go;
window.go=function(view){
  var r=_go.apply(this,arguments);
  var now=where();
  if(!restoring&&now!==here){
    var st={fse:1,view:view,spec:view==='editor'?spec():null};
    if(here===null)history.replaceState(st,'',hash(st));
    else history.pushState(st,'',hash(st));
  }
  here=now;
  return r;
};

// Куда просили попасть при загрузке: адрес страницы, а если сессия кончилась
// и пришлось войти заново — место, где она кончилась (его кладёт authExpired).
var asked=location.hash.slice(1);
try{
  if(!asked)asked=sessionStorage.getItem('fse_return')||'';
  sessionStorage.removeItem('fse_return');
}catch(e){}

// Первый переход после загрузки. Раздел из адреса открывается, только если
// он виден в меню этого человека; иначе — стартовый раздел роли. Раздел,
// который go() роли подменяет другим, тоже уступает стартовому.
window.fseStart=function(fallback){
  var p=asked.split('/'), view=p[0];
  asked='';
  if(view==='editor'){
    var id=decodeURIComponent(p[1]||'');
    if(typeof specs!=='undefined'&&specs.some(function(s){return s.id===id;}))return openSpec(id);
    view='specs';
  }
  var nav=/^[a-z]+$/.test(view)&&document.querySelector('.nav[data-go="'+view+'"]');
  if(nav&&nav.style.display!=='none'){
    window.go(view);
    if(where()===view+'View')return;
    here=null;          // запись с недоступным разделом заменит стартовая
  }
  window.go(fallback);
};

window.addEventListener('popstate',function(e){
  if(skip){skip--;return;}
  if(sheets.length){sheets.pop().onBack();return;}
  var st=e.state;
  if(!st||!st.fse)return;
  var view=st.view;
  // Смета из записи могла быть удалена: открыть её — значит показать пустой
  // редактор, правки в котором некуда сохранить. Такая запись ведёт к списку.
  if(view==='editor'&&!(typeof specs!=='undefined'&&specs.some(function(s){return s.id===st.spec;})))
    view='specs';
  restoring=true;
  var p=(view==='editor'&&st.spec!==spec()&&typeof openSpec==='function')
    ?openSpec(st.spec):window.go(view);
  Promise.resolve(p).catch(function(){}).then(function(){restoring=false;here=where();});
});

// Окно на весь экран сообщает о себе при открытии и при закрытии.
// onBack — то же, что делает его кнопка выхода: «Назад» ведёт себя как она.
window.fseBack={
  open:function(key,onBack){
    if(sheets.some(function(s){return s.key===key;}))return;
    sheets.push({key:key,onBack:onBack});
    history.pushState(Object.assign({},history.state,{sheet:key}),'');
  },
  closed:function(key){
    for(var i=sheets.length-1;i>=0;i--)if(sheets[i].key===key)break;
    if(i<0)return;
    sheets.splice(i,1); skip++; history.back();
  }
};
})();
