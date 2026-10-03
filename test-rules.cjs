// Run against a local Realtime Database emulator only. No production credentials.
const assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:9000',ns='demo-gastos-auth';
function token(uid,provider='google.com'){
  const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  return enc({alg:'none',typ:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/'+ns,aud:ns,auth_time:now,user_id:uid,sub:uid,iat:now,exp:now+3600,firebase:{sign_in_provider:provider,identities:{'google.com':[uid]}}})+'.';
}
async function req(method,path,body,uid){
  const url=new URL(base+'/'+path+'.json');url.searchParams.set('ns',ns);
  const headers={'Content-Type':'application/json'};
  if(uid==='ADMIN')headers.Authorization='Bearer owner';else if(uid)url.searchParams.set('auth',token(uid));
  const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
let count=0;
async function check(name,allowed,method,path,body,uid){const r=await req(method,path,body,uid);assert.equal(r.status,allowed?200:401,name+': '+JSON.stringify(r));count++;console.log('PASS '+name);return r.body;}
const config={name1:'Ana',name2:'Luis',income1:1000,income2:1500};
const expense={name:'Compra',amount:120,date:'2026-10-03',paidBy:'p1',splitType:'equal',settled:false,ts:Date.now()};
const code='a'.repeat(32),expired='b'.repeat(32),other='c'.repeat(32);
(async()=>{
  await req('PUT','',null,'ADMIN');
  const rules=JSON.parse(fs.readFileSync(__dirname+'/database.rules.json','utf8'));
  const r=await req('PUT','.settings/rules',rules,'ADMIN');assert.equal(r.status,200,JSON.stringify(r));
  await check('signed-out reads blocked',false,'GET','users/alice/data');
  await check('signed-out writes blocked',false,'PUT','users/alice/data/config',config);
  await check('owner writes personal expense',true,'PUT','users/alice/data/expenses/e1',expense,'alice');
  await check('owner reads own expenses',true,'GET','users/alice/data',undefined,'alice');
  await check('other account cannot read',false,'GET','users/alice/data',undefined,'bob');
  await check('other account cannot write',false,'PUT','users/alice/data/expenses/e2',expense,'bob');
  await check('cannot list all users',false,'GET','users',undefined,'alice');
  await check('legacy expenses remain closed',false,'GET','expenses',undefined,'alice');
  await check('negative amounts rejected',false,'PUT','users/alice/data/expenses/e2',{...expense,amount:-10},'alice');
  await check('unknown fields rejected',false,'PUT','users/alice/data/expenses/e2',{...expense,role:'admin'},'alice');
  await check('owner creates shared space',true,'PUT','spaces/alice/data/config',config,'alice');
  await check('uninvited account blocked',false,'GET','spaces/alice',undefined,'bob');
  await check('cannot self-assign a partner',false,'PUT','spaces/alice/partner',{uid:'bob',inviteCode:code},'bob');
  await check('owner creates invitation atomically',true,'PATCH','',{['invitations/'+code]:{ownerUid:'alice',expiresAt:Date.now()+604800000},'spaces/alice/inviteCode':code},'alice');
  await check('invitations cannot be enumerated',false,'GET','invitations',undefined,'bob');
  await check('signed-in recipient reads code',true,'GET','invitations/'+code,undefined,'bob');
  await check('signed-out recipient blocked',false,'GET','invitations/'+code);
  await check('cannot forge owner on invitation',false,'PUT','invitations/'+other,{ownerUid:'alice',expiresAt:Date.now()+100000},'bob');
  await check('partner joins with valid code',true,'PUT','spaces/alice/partner',{uid:'bob',inviteCode:code},'bob');
  await check('partner retry is idempotent',true,'PUT','spaces/alice/partner',{uid:'bob',inviteCode:code},'bob');
  await check('partner stores space reference',true,'PUT','users/bob/sharedSpaces/alice',true,'bob');
  await check('partner reads shared expenses',true,'GET','spaces/alice/data',undefined,'bob');
  await check('partner adds shared expense',true,'PUT','spaces/alice/data/expenses/e1',expense,'bob');
  await check('partner cannot read owner personal data',false,'GET','users/alice/data',undefined,'bob');
  await check('third account cannot reuse code',false,'PUT','spaces/alice/partner',{uid:'carol',inviteCode:code},'carol');
  await check('third account cannot overwrite data',false,'PUT','spaces/alice/data/expenses/e2',expense,'carol');
  await check('partner cannot replace membership',false,'PUT','spaces/alice/partner',{uid:'carol',inviteCode:code},'bob');
  await check('partner cannot change invitation',false,'PUT','spaces/alice/inviteCode',other,'bob');
  await check('partner cannot delete the entire space',false,'DELETE','spaces/alice',undefined,'bob');
  await check('settlement and history commit together',true,'PATCH','spaces/alice/data',{'expenses/e1/settled':true,'history/h1':{date:'2026-10-03',ts:Date.now(),amount:60,expenseCount:1,total:120,debtorName:'Luis'}},'bob');
  const saved=await check('owner sees partner changes',true,'GET','spaces/alice/data',undefined,'alice');assert.equal(saved.expenses.e1.settled,true);assert.equal(saved.history.h1.amount,60);
  await check('owner revokes partner access',true,'DELETE','spaces/alice/partner',undefined,'alice');
  await check('removed partner loses access',false,'GET','spaces/alice/data',undefined,'bob');
  await check('owner revokes invitation',true,'DELETE','invitations/'+code,undefined,'alice');
  await check('revoked code cannot be used',false,'PUT','spaces/alice/partner',{uid:'bob',inviteCode:code},'bob');
  await req('PATCH','',{['invitations/'+expired]:{ownerUid:'alice',expiresAt:Date.now()-10000},'spaces/alice/inviteCode':expired},'ADMIN');
  await check('expired code cannot be used',false,'PUT','spaces/alice/partner',{uid:'bob',inviteCode:expired},'bob');
  console.log(`\n${count} security checks passed against Firebase emulator.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
