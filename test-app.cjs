const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const source=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>!m[1].includes('module'))[2];
const elements=new Map(),subscriptions=[],writes=[];
function element(id){if(!elements.has(id))elements.set(id,{style:{},value:'',textContent:'',innerHTML:'',className:'',disabled:false,hidden:false,children:[],classList:{add(){},remove(){},contains(){return false;}},addEventListener(){},replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);},select(){}});return elements.get(id);}
const ctx={console,Date,Number,String,Object,Array,Math,Promise,Error,RegExp,JSON,crypto:require('node:crypto').webcrypto,Event:class{},location:{protocol:'https:'},navigator:{clipboard:{writeText:async()=>{}}},setTimeout:()=>1,clearTimeout(){},confirm:()=>true,
  document:{getElementById:element,createElement:()=>({}),querySelectorAll:()=>[]},addEventListener(){},dispatchEvent(){},_firebaseReady:true,
  _db:{},_auth:{currentUser:null},_ref:(_,path='')=>path,
  _onValue(path,callback,error){const s={path,callback,error,active:true};subscriptions.push(s);return()=>{s.active=false;};},
  _observeAuth(callback){ctx.authCallback=callback;},_get:async()=>({exists:()=>false,val:()=>null}),
  _set:async(path,value)=>{writes.push({path,value});},_remove:async path=>writes.push({path,remove:true}),
  _update:async(path,value)=>writes.push({path,value}),_push(path,value){if(value===undefined)return{key:'history-1'};writes.push({path,value});return Promise.resolve({key:'expense-1'});},
  _signOut:async()=>{ctx._auth.currentUser=null;ctx.authCallback(null);},_signIn:async()=>{}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
function run(source){return vm.runInContext(source,ctx);}
function emit(path,val){subscriptions.filter(s=>s.active&&s.path===path).forEach(s=>s.callback({val:()=>val}));}
function login(uid){ctx._auth.currentUser={uid,email:uid+'@example.test'};ctx.authCallback(ctx._auth.currentUser);emit('.info/connected',true);emit('users/'+uid+'/data',null);}
let count=0;function check(name,condition){assert.ok(condition,name);count++;console.log('PASS '+name);}
(async()=>{
  ctx.authCallback(null);check('signed-out screen has no data subscriptions',subscriptions.length===0&&element('login-screen').style.display==='flex');
  login('alice');check('first login starts empty',run('Object.keys(state.expenses).length')===0);
  await run("dbPush('expenses',{name:'Almuerzo',amount:100})");check('personal writes belong to account',writes.at(-1).path==='users/alice/data/expenses');
  emit('users/alice/data',{expenses:{e1:{name:'Privado',amount:100,date:'2026-10-03',paidBy:'p1',splitType:'equal'}}});
  check('personal data is rendered',element('tab-list').innerHTML.includes('Privado'));
  const stale=subscriptions.find(s=>s.path==='users/alice/data');
  await ctx.logout();check('logout hides data',element('app').style.display==='none'&&run('Object.keys(state.expenses).length')===0);
  check('logout stops old subscriptions',subscriptions.every(s=>!s.active));
  login('bob');stale.callback({val:()=>({expenses:{leak:{name:'Alice secret'}}})});check('late callbacks cannot leak previous account',run('Object.keys(state.expenses).length')===0);
  emit('users/bob/sharedSpaces',{alice:true});ctx.changeSpace('alice');emit('spaces/alice/data',null);
  await run("dbPush('expenses',{name:'Compartido',amount:50})");check('shared writes use the selected space',writes.at(-1).path==='spaces/alice/data/expenses');
  ctx.changeSpace('personal');emit('users/bob/data',null);await run("dbSet('config',{name1:'Bob'})");check('switching back restores personal path',writes.at(-1).path==='users/bob/data/config');
  emit('.info/connected',false);await assert.rejects(run("dbPush('expenses',{})"),/Sin conexión/);check('offline save is rejected, never reported saved',true);
  emit('.info/connected',true);
  let release;ctx._set=(path,value)=>new Promise(resolve=>{writes.push({path,value});release=resolve;});
  const pending=run("dbSet('config',{name1:'Bob'})");await ctx.logout();check('logout waits for a pending save',ctx._auth.currentUser.uid==='bob');
  ctx.changeSpace('alice');check('space cannot switch during a save',run('activeSpace')==='personal');release();await pending;
  check('pending count clears after server acknowledgement',run('pendingWrites')===0);
  check('untrusted names are escaped',run("escapeHtml('<img onerror=alert(1)>')")==='&lt;img onerror=alert(1)&gt;');
  const before=writes.length;await ctx.logout();await assert.rejects(run("dbPush('expenses',{})"));check('signed-out writes cannot reach the database',writes.length===before);
  console.log(`\n${count} app lifecycle checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
