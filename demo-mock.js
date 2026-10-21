// Демо раздела «Объекты»: без сервера, данные примерные, правки живут до перезагрузки.
(function(){
  try{localStorage.setItem('fse_session','demo');}catch(e){}
  var fetch0=window.fetch.bind(window), db=null, next=100;
  function load(){return db?Promise.resolve(db):fetch0('data.json').then(function(r){return r.json();}).then(function(j){db=j;return db;});}
  function json(o,st){return new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}});}
  function clean(ch){
    var k={}, out={};
    db.schema.fields.forEach(function(f){k[f.key]=f.kind;});
    Object.keys(ch).forEach(function(key){
      var v=ch[key];
      if(v===null||String(v).trim()===''){out[key]=null;return;}
      if(k[key]==='money'){
        var n=Number(String(v).replace(/[\s ]/g,'').replace(',','.'));
        if(!isFinite(n))throw new Error(key);
        out[key]=n;
      } else out[key]=typeof v==='string'?v.trim():v;
    });
    return out;
  }
  function totals(d){
    if(d.equipment!=null||d.install!=null){d.total=(d.equipment||0)+(d.install||0);d.rest=d.total-(d.paid||0);}
    else{delete d.total;delete d.rest;}
  }
  window.fetch=function(url,opts){
    var u=new URL(typeof url==='string'?url:url.url,location.href), p=u.pathname;
    var m=((opts&&opts.method)||'GET').toUpperCase();
    if(p.indexOf('/api/auth/me')>=0)return Promise.resolve(json({role:'tracker',role_name:'Учёт объектов',
      user_id:1,company_id:1,first_name:'Демо',scopes:['track:use']}));
    var i=p.indexOf('/montazh/api/track');
    if(i<0){
      if(/\/api\/auth\/track$/.test(p))return Promise.resolve(json({ok:true}));
      if(/\/api\/specs$/.test(p))return Promise.resolve(json([]));
      if(/\/notify\/count$/.test(p))return Promise.resolve(json({count:0}));
      if(p.indexOf('/api/')>=0||p.indexOf('/montazh/')>=0)return Promise.resolve(json({detail:'демо'},404));
      return fetch0(url,opts);
    }
    var rest=p.slice(i+'/montazh/api/track'.length);
    return load().then(function(){
      if(m==='GET')return json(db);
      var body=opts&&opts.body?JSON.parse(opts.body):{};
      var mm=/\/objects\/(\d+)/.exec(rest), id=mm?+mm[1]:null;
      if(/\/delete$/.test(rest)){db.objects=db.objects.filter(function(x){return x.id!==id;});return json({ok:true});}
      var o=id?db.objects.filter(function(x){return x.id===id;})[0]:null, ch;
      try{ch=clean(body.data||{});}catch(e){return json({detail:'Не число'},400);}
      if(!o){o={id:next++,company_id:1,company:'Партнёр (демо)',data:{},updated_at:null};db.objects.unshift(o);}
      Object.keys(ch).forEach(function(k){if(ch[k]===null)delete o.data[k];else o.data[k]=ch[k];});
      totals(o.data);
      return json(o);
    });
  };
})();
