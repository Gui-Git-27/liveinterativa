const express=require('express');
const T=require('tiktok-live-connector');
const Conn=T.TikTokLiveConnection||T.WebcastPushConnection;
const USER=process.env.TIKTOK_USER, KEY=process.env.EULER_KEY, ADMIN=process.env.ADMIN_KEY||'1234';
const app=express(); app.use(express.static(__dirname+'/public'));
// [categoria, afirmação, verdadeiro?, explicação]
const Q=[
["CORPO HUMANO","O cérebro usa mais energia durante o sono do que acordado.",false,"O uso de energia do cérebro cai cerca de 10 a 15 por cento durante o sono não-REM."],
["CORPO HUMANO","Usamos apenas 10% do cérebro.",false,"Usamos todas as áreas do cérebro, em momentos diferentes."],
["CORPO HUMANO","Um adulto tem 206 ossos.",true,"Já o bebê nasce com cerca de 300, que vão se fundindo."],
["CORPO HUMANO","O coração humano tem 4 câmaras.",true,"2 átrios e 2 ventrículos."],
["CORPO HUMANO","O sangue dentro das veias é azul.",false,"É sempre vermelho; as veias só parecem azuis por causa da pele."],
["ESPAÇO","A Grande Muralha da China é visível a olho nu do espaço.",false,"É longa, mas muito estreita para ser vista assim."],
["ESPAÇO","Um dia em Vênus dura mais que um ano em Vênus.",true,"Ela gira tão devagar que o dia dura ~243 dias terrestres; o ano, ~225."],
["ESPAÇO","A Lua tem luz própria.",false,"Ela só reflete a luz do Sol."],
["ESPAÇO","O Sol é uma estrela.",true,"É a estrela mais próxima da Terra."],
["ESPAÇO","O som se propaga no vácuo do espaço.",false,"O som precisa de um meio, como ar ou água."],
["ANIMAIS","Os polvos têm três corações.",true,"Dois bombeiam para as brânquias e um para o corpo."],
["ANIMAIS","Os morcegos são cegos.",false,"Eles enxergam, e ainda usam eco para se guiar."],
["ANIMAIS","Os tubarões são mamíferos.",false,"São peixes."],
["ANIMAIS","Os camaleões mudam de cor só para se camuflar.",false,"Também usam a cor para se comunicar e regular a temperatura."],
["CURIOSIDADES","Um raio nunca cai duas vezes no mesmo lugar.",false,"Cai, e várias vezes: prédios altos são atingidos todo ano."],
["CURIOSIDADES","O Brasil faz fronteira com o Chile.",false,"O Chile e o Equador são os únicos da América do Sul que não fazem fronteira com o Brasil."],
["CURIOSIDADES","O ouro é mais denso que o ferro.",true,"O ouro é cerca de 2,5 vezes mais denso."],
["CURIOSIDADES","A Terra leva cerca de 365 dias para dar uma volta no Sol.",true,"Por isso existe o ano bissexto, a cada 4 anos."],
["CURIOSIDADES","O Monte Everest é o ponto mais alto da Terra acima do nível do mar.",true,"Tem cerca de 8.849 metros."],
["CORPO HUMANO","Os humanos têm só cinco sentidos.",false,"Também há equilíbrio, temperatura, dor e outros."]];
let order=[],s={phase:'question',t:15,q:null,qn:0,votes:{},counts:{V:0,F:0},paused:false,correct:0,likes:0},scores={};
const shuffle=()=>{order=Q.map((_,i)=>i).sort(()=>Math.random()-.5)};
function next(){if(s.qn%Q.length===0)shuffle();s.q=Q[order[s.qn%Q.length]];s.qn++;s.phase='question';s.t=15;s.votes={};s.counts={V:0,F:0};s.correct=0}
function reveal(){s.phase='reveal';s.t=6;const a=s.q[2]?'V':'F';
 for(const[id,v]of Object.entries(s.votes)){const u=scores[id];if(v.c===a){u.pts+=10+v.left;u.streak++;s.correct++}else u.streak=0}}
const rank=()=>Object.values(scores).sort((a,b)=>b.pts-a.pts).slice(0,5).map(u=>({nick:u.nick,pts:u.pts,streak:u.streak}));
const clients=[];
const send=(ev,d)=>clients.forEach(r=>r.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`));
function push(){const r=s.phase==='reveal';send('state',{phase:s.phase,t:s.t,paused:s.paused,n:s.qn,cat:s.q[0],text:s.q[1],counts:s.counts,rank:rank(),correct:s.correct,likes:s.likes,
 answer:r?(s.q[2]?'V':'F'):null,expl:r?s.q[3]:null})}
function vote(id,nick,txt){if(s.phase!=='question'||s.votes[id])return;
 const x=String(txt).trim().toUpperCase().replace(/[^A-Z]/g,'');const c=(x==='V'||x==='VERDADEIRO')?'V':(x==='F'||x==='FALSO')?'F':null;if(!c)return;
 s.votes[id]={c,left:s.t};s.counts[c]++;scores[id]=scores[id]||{nick,pts:0,streak:0}}
function gift(nick,name,dia){const rose=/rose|rosa/i.test(name);
 if(dia>=5){send('fx',{type:'gift',nick,msg:'pulou a afirmação!'});next()}
 else if(rose&&s.phase==='question'){s.t=Math.min(s.t+5,30);send('fx',{type:'gift',nick,msg:'+5 segundos!'})}
 else send('fx',{type:'gift',nick,msg:'mandou '+name})}
const like=(n,nick)=>{s.likes+=n;send('fx',{type:'like',n:Math.min(n,5)})};
const follow=nick=>send('fx',{type:'follow',nick,msg:'seguiu a live!'});
shuffle();next();
setInterval(()=>{if(!s.paused){if(--s.t<=0)s.phase==='question'?reveal():next()}push()},1000);
app.get('/events',(q,r)=>{r.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});r.flushHeaders();clients.push(r);push();q.on('close',()=>clients.splice(clients.indexOf(r),1))});
// painel de controle: /painel?key=SUACHAVE
app.get('/admin/:a',(q,r)=>{if(q.query.key!==ADMIN)return r.sendStatus(403);const a=q.params.a;
 if(a==='skip')next();if(a==='pause')s.paused=!s.paused;if(a==='add')s.t+=5;if(a==='reset'){scores={};s.likes=0}r.send('ok')});
app.get('/painel',(q,r)=>r.send(`<meta name=viewport content="width=device-width"><body style="font:20px sans-serif;background:#111;color:#fff;padding:20px"><h2>Painel</h2>${['skip:Pular pergunta','pause:Pausar/Retomar','add:+5 segundos','reset:Zerar ranking'].map(x=>{const[a,l]=x.split(':');return`<p><button style="font-size:20px;padding:14px;width:100%" onclick="fetch('/admin/${a}?key='+new URLSearchParams(location.search).get('key'))">${l}</button></p>`}).join('')}`));
// testes sem live: /teste?v=V&nick=ana | ?gift=rosa | ?gift=galaxia&d=10 | ?like=3 | ?follow=1
app.get('/teste',(q,r)=>{const n=q.query.nick||'teste'+Math.floor(Math.random()*99);
 if(q.query.v)vote(n,n,q.query.v);if(q.query.gift)gift(n,q.query.gift,+q.query.d||1);if(q.query.like)like(+q.query.like,n);if(q.query.follow)follow(n);r.send('ok')});
function connect(){if(!USER)return console.log('Defina TIKTOK_USER para conectar. Modo teste ativo.');
 const c=new Conn(USER,KEY?{signApiKey:KEY}:{});
 c.connect().then(()=>console.log('Conectado em @'+USER)).catch(e=>{console.log('Falha:',e.message||e);setTimeout(connect,15000)});
 c.on('chat',d=>vote(d.uniqueId,d.nickname||d.uniqueId,d.comment));
 c.on('gift',d=>{if(d.giftType===1&&!d.repeatEnd)return;gift(d.nickname||d.uniqueId,d.giftName||'presente',(d.diamondCount||1)*(d.repeatCount||1))});
 c.on('like',d=>like(d.likeCount||1,d.nickname));
 c.on('follow',d=>follow(d.nickname||d.uniqueId));
 c.on('disconnected',()=>setTimeout(connect,10000))}
connect();app.listen(process.env.PORT||3000,()=>console.log('Quiz no ar'));
