
import { createClient } from '@supabase/supabase-js';
import './style.css';

const $ = id => document.getElementById(id);
const env = import.meta.env;
const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY) : null;
const DB='cronosport-offline-v1';
let db, state, ticker;
const SPORTS=['Corrida','Natação'];
const uid=()=>crypto.randomUUID();
const nowISO=()=>new Date().toISOString();
const fmt=ms=>{const n=Math.max(0,Math.floor(ms));return `${String(Math.floor(n/60000)).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}.${String(Math.floor(n%1000/10)).padStart(2,'0')}`};
const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('queue',{keyPath:'localId',autoIncrement:true})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const get=(s,k)=>new Promise((res,rej)=>{const r=db.transaction(s).objectStore(s).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const put=(s,k,v)=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite');t.objectStore(s).put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)});
const queue=event=>new Promise((res,rej)=>{const t=db.transaction('queue','readwrite');t.objectStore('queue').add({...event,client_event_id:uid(),queued_at:nowISO()});t.oncomplete=res;t.onerror=()=>rej(t.error)});
const allQueue=()=>new Promise((res,rej)=>{const r=db.transaction('queue').objectStore('queue').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const comp=()=>state.competitions[state.activeSport];
function normalizeState(old){
 if(old?.competitions)return {...old,history:Array.isArray(old.history)?old.history:[]};
 const legacy=old?.competition||{};
 return {activeSport:legacy.modality==='Natação'?'Natação':'Corrida',sequence:old?.sequence||0,history:[],
 competitions:{Corrida:{title:legacy.modality==='Corrida'?legacy.title||'':'',participants:legacy.modality==='Corrida'?legacy.participants||[]:[],started:!!(legacy.modality==='Corrida'&&legacy.started),locked:!!(legacy.modality==='Corrida'&&legacy.locked),started_mono:null,started_wall:legacy.started_wall||null},
 Natação:{title:legacy.modality==='Natação'?legacy.title||'':'',participants:legacy.modality==='Natação'?legacy.participants||[]:[],started:!!(legacy.modality==='Natação'&&legacy.started),locked:!!(legacy.modality==='Natação'&&legacy.locked),started_mono:null,started_wall:legacy.started_wall||null}}};
}
function view(){
 $('app').innerHTML=`<header><div class="brand">⏱ Crono<b>Sport</b></div><span id="net" class="badge">Verificando…</span></header><main>
 <section class="hero"><div class="eyebrow">CRONOMETRAGEM ESPORTIVA</div><h1>Tempo preciso.<br><span>Resultado protegido.</span></h1><p class="muted">Uma prova, um aparelho responsável, vários espectadores.</p></section>
 <div class="tabs"><button id="operatorTab" class="active">Operador</button><button id="viewerTab">Espectador</button></div>
 <section id="operator">
 <div class="sport-tabs"><button id="runTab" class="active">🏃 Corrida</button><button id="swimTab">🏊 Natação</button></div>
 <div class="panel competition-panel"><div class="head"><div><span class="section-kicker">01 · PREPARAÇÃO</span><h2 id="sportTitle">Configurar corrida</h2></div><span class="badge">Offline-first</span></div>
 <div class="race-clock"><span class="race-clock-caption">TEMPO DA PROVA</span><strong id="raceClock">00:00.00</strong><span id="raceStatus">Aguardando início</span></div>
 <div class="setup-block"><label>Nome da competição<input id="title" placeholder="Ex.: Festival esportivo"></label></div>
 <div class="participant-block"><div class="subsection-heading"><div><span class="section-kicker">02 · PARTICIPANTES</span><strong>Adicionar participantes</strong></div><span class="muted helper-text">Cadastre antes de iniciar</span></div><div class="add"><input id="bib" type="number" min="1" placeholder="Número"><input id="name" placeholder="Nome (opcional)"><button id="add" class="orange">+ Adicionar</button></div>
 <div id="athletes"></div></div><div class="control-block"><div class="subsection-heading"><div><span class="section-kicker">03 · CONTROLE</span><strong>Controle da prova</strong></div></div><div class="actions"><button id="start" class="orange primary">▶ INICIAR TODOS</button><button id="close" class="danger">Encerrar e bloquear</button><button id="restart" class="secondary hidden" disabled>↻ Reiniciar</button></div></div>
 </div>
 <div class="panel results-panel"><div class="head"><div><span class="section-kicker">04 · RESULTADOS</span><h2>Classificação</h2></div><span class="muted">Chegadas registradas</span></div><div id="ranking"></div><button id="saveResults" class="secondary" style="margin-top:12px;width:100%">Salvar resultados em texto (.txt)</button></div>
 <div class="panel history-panel"><div class="head"><div><span class="section-kicker">05 · ARQUIVO</span><h2>Histórico de competições</h2></div><span id="historyCount" class="badge">0 provas</span></div><p class="muted history-intro">Competições encerradas e resultados salvos neste aparelho.</p><div id="historyList"></div></div>
 <div class="panel sync-panel"><div class="head"><div><span class="section-kicker">06 · DADOS</span><h2>Sincronização</h2></div><span id="queueCount" class="badge">0 pendentes</span></div><p class="notice">Os eventos são salvos neste aparelho. Configure o Supabase para sincronização online. Não feche o aplicativo durante uma prova até a recuperação nativa ser validada.</p><button id="sync" class="secondary">Sincronizar agora</button><button id="export" class="secondary">Exportar backup</button></div>
 </section>
 <section id="viewer" class="hidden"><div class="panel"><h2>Acompanhar competição</h2><label>Código exclusivo<input id="code" placeholder="Digite o código"></label><button id="lookup" class="orange" style="margin-top:12px;width:100%">Consultar prova</button><div id="publicResult"></div></div></section>
 </main><footer>CronoSport · Aplicativo em desenvolvimento</footer>`;
 $('operatorTab').onclick=()=>tabs(true);$('viewerTab').onclick=()=>tabs(false);
 $('runTab').onclick=()=>switchSport('Corrida');$('swimTab').onclick=()=>switchSport('Natação');
 $('title').onchange=async e=>{comp().title=e.target.value;await save()};
 $('add').onclick=addParticipant;$('start').onclick=startAll;$('close').onclick=closeCompetition;
 $('restart').onclick=restartCompetition;$('sync').onclick=syncQueue;$('export').onclick=exportBackup;$('saveResults').onclick=saveResultsText;$('lookup').onclick=lookupPublic;
 render();ensureTicker();network();
}
function tabs(op){$('operator').classList.toggle('hidden',!op);$('viewer').classList.toggle('hidden',op);$('operatorTab').classList.toggle('active',op);$('viewerTab').classList.toggle('active',!op)}
async function switchSport(sport){state.activeSport=sport;await put('state','main',state);$('runTab').classList.toggle('active',sport==='Corrida');$('swimTab').classList.toggle('active',sport==='Natação');render()}
function elapsed(p,c){
 if(p.finished_ms!=null)return p.finished_ms;
 if(!c.started||!c.started_wall)return 0;
 if(c.locked&&c.race_elapsed_ms!=null)return c.race_elapsed_ms;
 return Math.max(0,Date.now()-new Date(c.started_wall).getTime());
}
function render(){
 const c=comp(),sport=state.activeSport,host=$('athletes');if(c.archived==null)c.archived=false;
 $('sportTitle').textContent='Configurar '+sport.toLowerCase();$('title').value=c.title||'';
 $('runTab').classList.toggle('active',sport==='Corrida');$('swimTab').classList.toggle('active',sport==='Natação');
 host.innerHTML='';
 c.participants.forEach(p=>{const el=document.createElement('div');el.className='athlete';el.innerHTML=`<div class="number">${String(p.number).padStart(2,'0')}</div><div><b>${p.name?esc(p.name):'Participante'}</b><small>${p.finished_ms==null?(c.started?'Em prova':'Aguardando'):'Chegada registrada'}</small><small class="time live-time" data-number="${p.number}">${fmt(elapsed(p,c))}</small></div><button ${!c.started||p.finished_ms!=null||c.locked?'disabled':''} data-number="${p.number}">${p.finished_ms==null?'CHEGOU':'REGISTRADO'}</button>`;el.querySelector('button').onclick=()=>finish(p.number);host.append(el)});
 $('start').disabled=c.started||c.locked||!c.participants.length;$('close').disabled=!c.started||c.locked;$('restart').classList.toggle('hidden',!(c.locked&&c.archived));$('restart').disabled=!(c.locked&&c.archived);
 const done=c.participants.filter(p=>p.finished_ms!=null).sort((a,b)=>a.finished_ms-b.finished_ms||(a.arrival_order||0)-(b.arrival_order||0));
 $('ranking').innerHTML=done.length?`<div class="results-summary"><strong>${done.length} chegada${done.length===1?'':'s'} registrada${done.length===1?'':'s'}</strong><span>${c.locked?'Resultado final da competição':'Classificação parcial — por ordem de chegada'}</span></div>`+done.map((p,i)=>`<div class="rankrow ${i===0?'winner':''}"><div class="rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'º'}</div><div class="rank-person"><b>${esc(p.name||'Participante')}</b><small>Número ${p.number}${p.arrival_order?` · ${p.arrival_order}ª chegada`:''}</small></div><div class="time">${fmt(p.finished_ms)}</div></div>`).join(''):'<p class="muted empty-results">As chegadas aparecerão aqui assim que cada participante concluir a prova.</p>';
 renderHistory();updateLiveDisplay();
}

function renderHistory(){
 const host=$('historyList');if(!host)return;
 const list=[...(state.history||[])].sort((a,b)=>new Date(b.saved_at||b.finished_wall||0)-new Date(a.saved_at||a.finished_wall||0));
 $('historyCount').textContent=`${list.length} ${list.length===1?'prova':'provas'}`;
 if(!list.length){host.innerHTML='<p class="muted empty-results">Nenhuma competição encerrada ainda. As provas aparecerão aqui após serem finalizadas.</p>';return}
 host.innerHTML=list.map(item=>{
  const arrived=(item.participants||[]).filter(p=>p.finished_ms!=null).sort((a,b)=>a.finished_ms-b.finished_ms||(a.arrival_order||0)-(b.arrival_order||0));
  const pending=(item.participants||[]).filter(p=>p.finished_ms==null), winner=arrived[0];
  return `<article class="history-card"><div class="history-top"><div><b>${esc(item.title||'Competição sem título')}</b><small>${esc(item.modality||'Modalidade')} · ${item.finished_wall?new Date(item.finished_wall).toLocaleString('pt-BR'):'Data não informada'}</small></div><span class="history-pill">Encerrada</span></div>
  <div class="history-meta"><span>${item.participants.length} participantes</span><span>${arrived.length} chegadas</span><span>Tempo total: ${fmt(item.race_elapsed_ms||0)}</span></div>
  <div class="history-winner">${winner?`🏆 1º ${esc(winner.name||'Participante')} · Nº ${winner.number} · ${fmt(winner.finished_ms)}`:'Nenhuma chegada registrada'}</div>
  <button class="secondary history-toggle" data-id="${esc(item.id)}">Ver classificação completa</button>
  <div class="history-detail hidden" id="history-${esc(item.id)}">${arrived.map((p,i)=>`<div class="history-rank"><b>${i+1}º lugar</b><span>${esc(p.name||'Participante')} · Nº ${p.number}</span><strong>${fmt(p.finished_ms)}</strong></div>`).join('')||'<p class="muted">Sem chegadas registradas.</p>'}
  ${pending.length?`<p class="history-pending">Não finalizaram: ${pending.map(p=>`${esc(p.name||'Participante')} (Nº ${p.number})`).join(', ')}</p>`:''}</div></article>`;
 }).join('');
 host.querySelectorAll('.history-toggle').forEach(btn=>btn.onclick=()=>{const el=$(`history-${btn.dataset.id}`);el.classList.toggle('hidden');btn.textContent=el.classList.contains('hidden')?'Ver classificação completa':'Ocultar classificação'});
}
async function archiveCompetition(c){
 state.history=Array.isArray(state.history)?state.history:[];
 if(!state.history.some(h=>h.sport_key===state.activeSport&&h.finished_wall===c.finished_wall)){
  state.history.push({id:uid(),sport_key:state.activeSport,modality:state.activeSport,title:c.title||'Competição sem título',
   participants:c.participants.map(p=>({...p})),started_wall:c.started_wall||null,finished_wall:c.finished_wall||nowISO(),
   race_elapsed_ms:c.race_elapsed_ms||0,status:'Encerrada',saved_at:nowISO()});
 }
 c.archived=true;
 await put('state','main',state);
}
async function restartCompetition(){
 const c=comp();
 if(!c.locked||!c.archived)return alert('A competição precisa estar encerrada e salva no histórico antes de reiniciar.');
 if(!confirm('Os resultados estão salvos no histórico. Deseja iniciar uma nova competição?'))return;
 state.competitions[state.activeSport]={title:'',participants:[],started:false,locked:false,started_mono:null,started_wall:null,race_elapsed_ms:null,finished_wall:null,archived:false};
 await put('state','main',state);render();ensureTicker();
}

async function save(){await put('state','main',state);render()}
async function record(type,extra={}){await queue({competition_id:null,modality:state.activeSport,event_type:type,device_sequence:++state.sequence,device_recorded_at:nowISO(),payload:extra});await put('state','main',state);await render();await updateQueue()}
async function addParticipant(){const c=comp(),n=Number($('bib').value),name=$('name').value.trim();if(c.started||c.locked)return alert('Cadastro fechado nesta modalidade.');if(!Number.isInteger(n)||n<1)return alert('Informe um número válido.');if(c.participants.some(p=>p.number===n))return alert('Número já cadastrado nesta modalidade.');c.participants.push({number:n,name,finished_ms:null});c.participants.sort((a,b)=>a.number-b.number);
 // Mostra na tela imediatamente; a gravação local acontece em seguida.
 $('bib').value='';$('name').value='';render();
 await record('participant_added',{number:n,display_name:name})}
function updateLiveDisplay(){
 const c=comp();
 const clock=$('raceClock');
 if(clock)clock.textContent=fmt(c.started?(c.locked&&c.race_elapsed_ms!=null?c.race_elapsed_ms:Math.max(0,Date.now()-new Date(c.started_wall).getTime())):0);
 const status=$('raceStatus');
 if(status){
  const arrived=c.participants.filter(p=>p.finished_ms!=null).length;
  if(c.locked)status.textContent=`Prova encerrada · ${arrived}/${c.participants.length} chegaram`;
  else if(!c.started)status.textContent='Aguardando início';
  else status.textContent=`PROVA EM ANDAMENTO · ${arrived}/${c.participants.length} chegaram`;
 }
 c.participants.forEach(p=>{
  const node=document.querySelector(`.live-time[data-number="${p.number}"]`);
  if(node)node.textContent=fmt(elapsed(p,c));
 });
}
function ensureTicker(){
 const running=Object.values(state.competitions).some(c=>c.started&&!c.locked&&c.participants.some(p=>p.finished_ms==null));
 if(running&&!ticker) ticker=setInterval(updateLiveDisplay,50);
 if(!running&&ticker){clearInterval(ticker);ticker=null}
 updateLiveDisplay();
}
async function startAll(){
 const c=comp();
 if(c.started||c.locked||!c.participants.length)return;
 c.started=true;c.started_wall=nowISO();
 // Atualiza o estado visual imediatamente, sem aguardar o armazenamento local.
 render();ensureTicker();
 await record('start_all',{participant_numbers:c.participants.map(p=>p.number)});
}
async function finish(number){const c=comp(),p=c.participants.find(x=>x.number===number);if(!p||!c.started||c.locked||p.finished_ms!=null)return;p.finished_ms=elapsed(p,c);p.arrival_order=c.participants.filter(x=>x.finished_ms!=null).length;await record('participant_finished',{number,elapsed_ms:Math.round(p.finished_ms),display_name:p.name||null});ensureTicker()}
async function closeCompetition(){const c=comp();if(!c.started||c.locked)return;c.race_elapsed_ms=Math.max(0,Date.now()-new Date(c.started_wall).getTime());c.locked=true;c.finished_wall=nowISO();render();ensureTicker();await record('competition_finished',{finished_at:c.finished_wall});await archiveCompetition(c);render();ensureTicker()}
async function updateQueue(){const q=await allQueue();$('queueCount').textContent=q.length+' pendentes'}
async function saveResultsText(){
 const c=comp();
 if(!c.participants.length)return alert('Ainda não há participantes cadastrados.');
 const arrived=c.participants.filter(p=>p.finished_ms!=null).sort((a,b)=>a.finished_ms-b.finished_ms||(a.arrival_order||0)-(b.arrival_order||0));
 const pending=c.participants.filter(p=>p.finished_ms==null).sort((a,b)=>a.number-b.number);
 const lines=[
  'CRONOSPORT — RESULTADO DA COMPETIÇÃO',
  '====================================',
  `Modalidade: ${state.activeSport}`,
  `Competição: ${c.title||'Sem título'}`,
  `Data: ${c.started_wall?new Date(c.started_wall).toLocaleString('pt-BR'):'Não iniciada'}`,
  `Status: ${c.locked?'Encerrada':c.started?'Em andamento':'Não iniciada'}`,`Tempo total da prova: ${fmt(c.locked&&c.race_elapsed_ms!=null?c.race_elapsed_ms:(c.started?Date.now()-new Date(c.started_wall).getTime():0))}`,
  '',
  'CLASSIFICAÇÃO FINAL',
  '-------------------'
 ];
 if(arrived.length){
  arrived.forEach((p,i)=>lines.push(`${i+1}º lugar — ${p.name||'Participante'} (Nº ${p.number}) — Tempo: ${fmt(p.finished_ms)}`));
  lines.push('',`VENCEDOR(A): ${arrived[0].name||'Participante'} — Nº ${arrived[0].number} — ${fmt(arrived[0].finished_ms)}`);
  if(arrived[1])lines.push(`2º COLOCADO(A): ${arrived[1].name||'Participante'} — Nº ${arrived[1].number} — ${fmt(arrived[1].finished_ms)}`);
 }else lines.push('Nenhuma chegada registrada.');
 if(pending.length){
  lines.push('', 'PARTICIPANTES SEM CHEGADA', '-------------------------');
  pending.forEach(p=>lines.push(`Nº ${p.number}${p.name?' — '+p.name:''} — Ainda não finalizou`));
 }
 lines.push('',`Total de participantes: ${c.participants.length}`,`Chegadas registradas: ${arrived.length}`,`Pendentes: ${pending.length}`,'','Gerado pelo CronoSport.');
 const blob=new Blob([lines.join('\r\n')],{type:'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`resultado-${state.activeSport.toLowerCase().replace('ã','a')}-${new Date().toISOString().slice(0,10)}.txt`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportBackup(){const data={state,events:await allQueue(),exported_at:nowISO()};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='cronosport-backup.json';a.click();URL.revokeObjectURL(a.href)}
function network(){$('net').textContent=navigator.onLine?'Online':'Offline · salvando localmente';$('net').style.background=navigator.onLine?'#e7f8ed':'#fff0e5';$('net').style.color=navigator.onLine?'#18733b':'#a94c08'}
async function syncQueue(){if(!supabase)return alert('Servidor ainda não configurado. Configure as chaves Supabase no arquivo .env.');const {data:{session}}=await supabase.auth.getSession();if(!session)return alert('É necessário autenticar o operador no servidor antes de sincronizar.');alert('Supabase detectado. A integração de sincronização ainda precisa ser concluída.')}
async function lookupPublic(){if(!supabase)return $('publicResult').textContent='Servidor ainda não configurado.';const code=$('code').value.trim().toUpperCase();if(!code)return;const {data,error}=await supabase.rpc('get_public_competition',{p_access_code:code});$('publicResult').innerHTML=error?`<p class="muted">${esc(error.message)}</p>`:data?`<h3>${esc(data.title)}</h3><p>${esc(data.modality)} · ${esc(data.status)}</p>`:'<p>Competição não encontrada.</p>'}
async function init(){db=await openDB();const old=await get('state','main');state=normalizeState(old)||{activeSport:'Corrida',sequence:0,history:[],competitions:{Corrida:{title:'',participants:[],started:false,locked:false},Natação:{title:'',participants:[],started:false,locked:false}}};await put('state','main',state);view();await updateQueue();window.addEventListener('online',network);window.addEventListener('offline',network);if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})}
init().catch(e=>{document.getElementById('app').textContent='Erro ao iniciar CronoSport: '+e.message});
