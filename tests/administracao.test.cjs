const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');

function apiWith(supabase) {
  const source = fs.readFileSync('src/services/api.js','utf8').replace(/^import .*$/m,'').replace(/export /g,'');
  return vm.runInNewContext(source+';({funcionariosApi, administracaoApi});',{supabase,console});
}

test('management permission requires an active administrative access level, not a job title', () => {
  const source = fs.readFileSync('src/utils/permissoes.js','utf8').replace(/export /g,'');
  const allowed = vm.runInNewContext(source+';podeAdministrar;');
  assert.equal(allowed({ ativo:true,funcao:'Coordenação',nivel_acesso:'assistencial' }),false);
  assert.equal(allowed({ ativo:true,funcao:'Enfermeiro',nivel_acesso:'gerente' }),true);
  assert.equal(allowed({ ativo:false,nivel_acesso:'admin' }),false);
  assert.equal(allowed({ ativo:true,nivel_acesso:' ADMIN ' }),true);
  assert.equal(allowed(null),false);
});

test('failed user creation never falls back to inserting an accessless profile', async () => {
  const api = apiWith({ functions: { invoke: async () => ({ error:{ message:'Acesso negado' } }) }, from: () => { throw new Error('Unexpected direct database access'); } });
  await assert.rejects(api.funcionariosApi.create({nome:'Teste'}),/Acesso negado/);
});

test('catalog deactivation keeps the row, and rejects arbitrary table names', async () => {
  const operations=[];
  const query={ update(p){operations.push(p);return query},eq(){return query},select(){return query},single:async()=>({data:{ativo:false}}) };
  const api=apiWith({from:(table)=>{operations.push(table);return query}});
  await api.administracaoApi.setAtivo('setores','id',false);
  assert.equal(operations[0],'setores');
  assert.equal(operations[1].ativo,false);
  await assert.rejects(api.administracaoApi.setAtivo('profissionais','id',false),/inválido/);
});

// Execute the actual Edge handler with fake clients; no network or real users.
function edgeHandler({ active=true, level='assistencial', tokenValid=true, failProfile=false }={}) {
  let handler;let creations=0;let bans=0;const writes=[];
  const service={from:()=>({select(){return this},eq(){return this},single:async()=>({data:{ativo:active,nivel_acesso:level}})}),auth:{admin:{createUser:async()=>{creations++;return {data:{user:{id:'new'}}}},updateUserById:async()=>{bans++;return {data:{}}}}}};
  const caller={auth:{getUser:async()=>({data:{user:tokenValid?{id:'caller'}:null},error:tokenValid?null:{message:'Invalid'}})}};
  caller.from=(table)=>{
    const q={select(){return q},eq(){return q},in(){return q},single:async()=>({data:{id:'function'}}),then:(resolve)=>Promise.resolve({data:[{id:'sector'}]}).then(resolve)};
    return q;
  };
  caller.rpc=async(name,args)=>{writes.push({name,args});return failProfile?{error:{message:'Failed profile'}}:{data:{id:'profile'}}};
  let clientCount=0;
  const createClient=()=>clientCount++===0?service:caller;
  const input=fs.readFileSync('supabase/functions/gerenciar-funcionarios/index.ts','utf8').replace(/^import .*$/m,'');
  const code=babel.transformSync(input,{filename:'edge.ts',configFile:false,babelrc:false,plugins:[require.resolve('@babel/plugin-transform-typescript')]}).code;
  vm.runInNewContext(code,{createClient,Response,Request,Set,console,Deno:{env:{get:()=> 'test'},serve:(fn)=>{handler=fn}}});
  return {run:handler,creations:()=>creations,bans:()=>bans,writes};
}

test('Edge handler rejects assistential and inactive users before Auth account creation', async () => {
  for(const state of [{level:'assistencial'},{level:'admin',active:false}]) {
    const edge=edgeHandler(state);
    const response=await edge.run(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'create'})}));
    assert.equal(response.status,403);assert.equal(edge.creations(),0);
  }
});

test('Edge handler rejects missing and invalid sessions', async () => {
  const edge=edgeHandler({tokenValid:false});
  assert.equal((await edge.run(new Request('https://test',{method:'POST'}))).status,401);
  assert.equal((await edge.run(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer invalid'}}))).status,401);
});


test('manager creates a real Auth account and saves profile through the authenticated RPC', async () => {
  const edge=edgeHandler({level:'gerente'});
  const response=await edge.run(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify({action:'create',nome:'Funcionário',email:'teste@example.com',senha:'senha-temporaria-123',funcao:'Enfermeiro',nivel_acesso:'assistencial',setorIds:['sector'],auth_id:'forged'})}));
  assert.equal(response.status,200);assert.equal(edge.creations(),1);
  assert.equal(edge.writes[0].name,'pp_salvar_funcionario');
  assert.equal(edge.writes[0].args.dados.auth_id,'new');
  assert.equal(edge.writes[0].args.dados.senha,undefined);
});

test('failed profile creation preserves and blocks the new Auth account', async () => {
  const edge=edgeHandler({level:'admin',failProfile:true});
  const response=await edge.run(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify({action:'create',nome:'Funcionário',email:'teste@example.com',senha:'senha-temporaria-123',funcao:'Enfermeiro',setorIds:['sector']})}));
  assert.equal(response.status,400);assert.equal(edge.creations(),1);assert.equal(edge.bans(),1);
});


test('staff listing reads with RLS without invoking the Edge Function', async () => {
  let invoked=false;
  const query={select(){return query},order:async()=>({data:[{id:'p',profissional_setor:[{ativo:true,setor:{id:'s'}}]}]})};
  const api=apiWith({from:()=>query,functions:{invoke:async()=>{invoked=true;throw new Error('Unavailable')}}});
  const result=await api.funcionariosApi.list();
  assert.equal(invoked,false);
  assert.equal(result.funcionarios[0].setores[0].id,'s');
});

test('gateway JWT errors display their actual reason and a recovery instruction', async () => {
  const api=apiWith({functions:{invoke:async()=>({error:{message:'non-2xx',context:{status:401,json:async()=>({message:'Invalid JWT'})}}})}});
  await assert.rejects(api.funcionariosApi.create({}),/Invalid JWT.*Saia e entre novamente/);
});
