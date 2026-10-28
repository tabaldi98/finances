// Plano financeiro. Nenhum valor fica no código: os dados vivem só no localStorage do navegador.
const KEY = "plano-financeiro:v1";
const NOMES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function proxMes(){ const d = new Date(); d.setMonth(d.getMonth()+1, 1); return ym(d); }
function ym(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
function addM(k, n){ const d = new Date(+k.slice(0,4), +k.slice(5)-1+n, 1); return ym(d); }
const lbl = k => NOMES[+k.slice(5)-1]+"/"+k.slice(2,4);
const brl = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const brl0 = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const n2 = v => v.toLocaleString("pt-BR",{maximumFractionDigits:0});
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function vazio(){
  return { renda: 0, inicio: proxMes(), rent: 0.8, dia: 3000, meses: 6, fixos: [], parcelas: [] };
}
function exemplo(){
  const i = proxMes();
  return { renda: 9000, inicio: i, rent: 0.8, dia: 2500, meses: 6,
    fixos: [{nome:"Aluguel",valor:2200},{nome:"Energia",valor:220},{nome:"Internet",valor:110},{nome:"Streaming",valor:55}],
    parcelas: [
      {item:"Notebook",cartao:"Cartão A",valor:450,fim:addM(i,5)},
      {item:"Geladeira",cartao:"Cartão B",valor:320,fim:addM(i,8)},
      {item:"Curso",cartao:"Cartão A",valor:280,fim:addM(i,2)}
    ], exemplo: true };
}

let D = vazio();
let temDados = false;
function carregar(){
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { D = Object.assign(vazio(), s); temDados = true; } } catch(e){}
}
function salvar(){
  if (D.exemplo) return;
  try { localStorage.setItem(KEY, JSON.stringify(D)); } catch(e){}
}

const totFixo = () => D.fixos.reduce((s,f)=>s+(+f.valor||0),0);
const parcValidas = () => D.parcelas.filter(p => +p.valor > 0 && /^\d{4}-\d{2}$/.test(p.fim||""));

function meses(){
  const fins = parcValidas().map(p=>p.fim).sort();
  const ultimo = fins.length ? fins[fins.length-1] : D.inicio;
  const out = []; let m = D.inicio;
  const limite = addM(ultimo > D.inicio ? ultimo : D.inicio, 4);
  while (m <= limite && out.length < 60) { out.push(m); m = addM(m,1); }
  return out.length < 12 ? Array.from({length:12},(_,i)=>addM(D.inicio,i)) : out;
}

function simular(){
  const FIXO = totFixo(), RENT = (+D.rent||0)/100, P = parcValidas(), M = meses();
  const meta = D.meses * (FIXO + D.dia);
  let res=0, inv=0, met=0, rows=[], fimRes=null;
  for (const m of M){
    res*=1+RENT; inv*=1+RENT; met*=1+RENT;
    const parc = P.filter(p=>m<=p.fim).reduce((s,p)=>s+(+p.valor),0);
    const sobra = D.renda - FIXO - parc - D.dia;
    let aRes=0,aInv=0,aMet=0,livre=0;
    if (sobra>0){
      livre = sobra*0.15;
      if (res < meta){
        aRes = Math.min(sobra*0.85, meta-res);
        const resto = sobra*0.85 - aRes;
        aInv = resto*0.75; aMet = resto*0.25;
      } else { aInv = sobra*0.65; aMet = sobra*0.20; }
    }
    res+=aRes; inv+=aInv; met+=aMet;
    if (fimRes===null && meta>0 && res >= meta-0.5) fimRes = m;
    rows.push({m,parc,sobra,aRes,aInv,aMet,livre,total:res+inv+met,res,inv,met});
  }
  return {FIXO,P,M,meta,rows,fimRes};
}

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let ch1, ch2;
function chartOpts(){
  const ink2=css("--ink-2"), line=css("--line");
  return { responsive:true, maintainAspectRatio:false, animation:false,
    interaction:{mode:"index",intersect:false},
    plugins:{ legend:{display:false}, tooltip:{ callbacks:{
      label:c=>" "+c.dataset.label+": "+brl(c.parsed.y),
      footer:items=>"Total: "+brl(items.reduce((s,i)=>s+i.parsed.y,0)) } } },
    scales:{ x:{stacked:true, grid:{display:false}, ticks:{color:ink2, font:{family:"IBM Plex Mono"}}, border:{color:line}},
      y:{stacked:true, grid:{color:line}, border:{display:false}, ticks:{color:ink2, font:{family:"IBM Plex Mono"}, callback:v=>"R$ "+(v/1000).toLocaleString("pt-BR")+" mil"}} } };
}
const bar = (label,data,color,last) => ({label,data,backgroundColor:color,borderColor:css("--surface"),borderWidth:{top:2},borderSkipped:"bottom",borderRadius:last?{topLeft:4,topRight:4}:0,maxBarThickness:42});
const $ = id => document.getElementById(id);

function renderPlano(){
  const pronto = temDados && D.renda > 0;
  $("empty").hidden = pronto;
  $("plan").hidden = !pronto;
  if (!pronto) { if (ch1) ch1.destroy(); if (ch2) ch2.destroy(); ch1 = ch2 = null; return; }

  const {FIXO,P,M,meta,rows,fimRes} = simular();
  const ultimoFim = P.map(p=>p.fim).sort().pop();
  const livreDe = ultimoFim ? addM(ultimoFim,1) : M[0];
  const rLivre = rows.find(r=>r.m===livreDe) || rows[rows.length-1];
  const r0 = rows[0], last = rows[rows.length-1];

  $("eyebrow").textContent = (D.exemplo ? "Exemplo · " : "Planejamento · ") + lbl(M[0]) + " a " + lbl(last.m);
  $("lede").textContent = `Renda de ${brl0(D.renda)} por mês.` + (ultimoFim
    ? ` As parcelas dos cartões terminam em ${lbl(ultimoFim)}, e a sobra vai de ${brl0(r0.sobra)} para ${brl0(rLivre.sobra)}.`
    : ``) + ` O plano usa essa folga em três fases: montar a reserva de emergência, investir para o longo prazo e financiar metas.`;

  $("dia").value = D.dia; $("diaOut").textContent = brl0(D.dia);
  document.querySelectorAll("#mesesSeg button").forEach(b=>b.setAttribute("aria-pressed", +b.dataset.m===D.meses));

  $("kpis").innerHTML = [
    ["Sobra em "+lbl(r0.m), brl0(r0.sobra), Math.round(r0.sobra/D.renda*100)+"% da renda"],
    ["Sobra a partir de "+lbl(rLivre.m), brl0(rLivre.sobra), "sem nenhuma parcela"],
    ["Reserva completa em", fimRes?lbl(fimRes):"depois de "+lbl(last.m), "meta de "+brl0(meta)],
    ["Patrimônio em "+lbl(last.m), brl0(last.total), "reserva + investimentos + metas"]
  ].map(k=>`<div class="kpi"><span class="label">${k[0]}</span><span class="value">${k[1]}</span><span class="sub">${k[2]}</span></div>`).join("");

  $("metaRes").textContent = brl0(meta);
  $("metaResTxt").textContent = D.meses+" meses";
  $("f1when").textContent = lbl(M[0]) + " até " + (fimRes?lbl(fimRes):lbl(last.m)+"+");
  $("f2when").textContent = "Depois de " + (fimRes?lbl(fimRes):lbl(last.m));
  $("metaMes").textContent = "20% ≈ " + brl0(Math.max(0,rLivre.sobra)*0.2) + "/mês";
  $("patNote").textContent = `Reserva e investimentos somados, com rendimento estimado de ${String(D.rent).replace(".",",")}% ao mês líquido. Ajuste a expectativa conforme a Selic.`;

  const L = rows.map(r=>lbl(r.m));
  if (window.Chart){
    if (ch1) ch1.destroy(); if (ch2) ch2.destroy();
    ch1 = new Chart($("cFluxo"), {type:"bar", data:{labels:L, datasets:[
      bar("Fixos", rows.map(()=>FIXO), css("--s1")),
      bar("Parcelas", rows.map(r=>r.parc), css("--s2")),
      bar("Dia a dia", rows.map(()=>D.dia), css("--s3")),
      bar("Sobra", rows.map(r=>Math.max(0,r.sobra)), css("--s4"), true)]}, options:chartOpts()});
    ch2 = new Chart($("cPat"), {type:"bar", data:{labels:L, datasets:[
      bar("Reserva", rows.map(r=>r.res), css("--s1")),
      bar("Investimentos", rows.map(r=>r.inv), css("--s2")),
      bar("Metas", rows.map(r=>r.met), css("--s3"), true)]}, options:chartOpts()});
  }

  // gantt
  const cols = M.filter(m => !ultimoFim || m <= ultimoFim);
  let g = `<thead><tr><th>Item</th><th>Cartão</th><th>Valor/mês</th>${cols.map(m=>`<th style="text-align:center">${lbl(m)}</th>`).join("")}</tr></thead><tbody>`;
  let saldo = 0;
  for (const p of [...P].sort((a,b)=>b.valor-a.valor)){
    saldo += Math.max(0, M.indexOf(p.fim)+1) * p.valor;
    g += `<tr><td class="txt">${esc(p.item)}</td><td class="txt val" style="text-align:left">${esc(p.cartao)}</td><td class="val">${brl(+p.valor)}</td>${cols.map(m=>`<td class="${m<=p.fim?"on":""}${m===p.fim?" last":""}"></td>`).join("")}</tr>`;
  }
  g += `<tr><td class="txt"><b>Total do mês</b></td><td></td><td></td>${cols.map(m=>`<td style="font-size:0.72rem">${n2(P.filter(p=>m<=p.fim).reduce((s,p)=>s+(+p.valor),0))}</td>`).join("")}</tr></tbody>`;
  $("gantt").innerHTML = P.length ? g : `<tbody><tr><td class="txt">Nenhuma parcela cadastrada.</td></tr></tbody>`;
  $("saldoDev").textContent = brl(saldo);

  // tabela
  let h = `<thead><tr><th>Mês</th><th>Parcelas</th><th>Gasto total</th><th>Sobra</th><th>→ Reserva</th><th>→ Investir</th><th>→ Metas</th><th>Livre</th><th>Patrimônio</th></tr></thead><tbody>`;
  for (const r of rows) h += `<tr><td class="txt">${lbl(r.m)}</td><td>${n2(r.parc)}</td><td>${n2(FIXO+r.parc+D.dia)}</td><td>${n2(r.sobra)}</td><td>${n2(r.aRes)}</td><td>${n2(r.aInv)}</td><td>${n2(r.aMet)}</td><td>${n2(r.livre)}</td><td>${n2(r.total)}</td></tr>`;
  $("tabela").innerHTML = h + "</tbody>";

  // marcos
  const liber = {};
  for (const p of P) if (p.fim >= M[0]) liber[p.fim] = (liber[p.fim]||0) + (+p.valor);
  const marcos = Object.keys(liber).sort().map(m=>({m, goal:false,
    t:"Última parcela: "+P.filter(p=>p.fim===m).map(p=>esc(p.item)).join(", "),
    d:`A partir de ${lbl(addM(m,1))} sobram mais ${brl(liber[m])} por mês.`}));
  if (fimRes) marcos.push({m:fimRes, goal:true, t:"Reserva de emergência completa", d:`${brl0(meta)} guardados. A sobra passa a ir para investimentos e metas.`});
  if (ultimoFim) marcos.push({m:livreDe, goal:true, t:"Livre de parcelas", d:`Gastos caem para ${brl0(FIXO+D.dia)} por mês e a sobra chega a ${brl0(rLivre.sobra)}.`});
  marcos.sort((a,b)=>a.m<b.m?-1:a.m>b.m?1:(a.goal?1:-1));
  $("marcos").innerHTML = marcos.map(x=>`<div class="ms${x.goal?" goal":""}"><span class="when">${lbl(x.m)}</span><h3>${x.t}</h3><p class="note">${x.d}</p></div>`).join("");

  const prim = Object.keys(liber).sort()[0];
  $("recRedir").textContent = prim
    ? `Quando as parcelas de ${lbl(prim)} terminam, os ${brl(liber[prim])} liberados vão direto para a reserva, sem passar pelo consumo.`
    : "Quando uma parcela termina, o valor liberado vai direto para a reserva, sem passar pelo consumo.";
}

// editor
function renderEditor(){
  $("inRenda").value = D.renda || "";
  $("inInicio").value = D.inicio;
  $("inRent").value = D.rent;
  $("edFixos").innerHTML = `<thead><tr><th>Descrição</th><th>Valor (R$)</th><th></th></tr></thead><tbody>` +
    D.fixos.map((f,i)=>`<tr><td><input data-l="fixos" data-i="${i}" data-k="nome" value="${esc(f.nome)}" aria-label="Descrição"></td><td><input type="number" step="0.01" data-l="fixos" data-i="${i}" data-k="valor" value="${f.valor}" aria-label="Valor"></td><td class="x"><button type="button" data-del="fixos" data-i="${i}" aria-label="Remover">×</button></td></tr>`).join("") + `</tbody>`;
  $("edParc").innerHTML = `<thead><tr><th>Item</th><th>Cartão</th><th>Parcela (R$)</th><th>Última parcela</th><th></th></tr></thead><tbody>` +
    D.parcelas.map((p,i)=>`<tr><td><input data-l="parcelas" data-i="${i}" data-k="item" value="${esc(p.item)}" aria-label="Item"></td><td><input data-l="parcelas" data-i="${i}" data-k="cartao" value="${esc(p.cartao)}" aria-label="Cartão"></td><td><input type="number" step="0.01" data-l="parcelas" data-i="${i}" data-k="valor" value="${p.valor}" aria-label="Valor da parcela"></td><td><input type="month" data-l="parcelas" data-i="${i}" data-k="fim" value="${esc(p.fim)}" aria-label="Mês da última parcela"></td><td class="x"><button type="button" data-del="parcelas" data-i="${i}" aria-label="Remover">×</button></td></tr>`).join("") + `</tbody>`;
}

function mudou(){ if (D.exemplo) { delete D.exemplo; } temDados = true; salvar(); renderPlano(); }

document.addEventListener("input", e=>{
  const t = e.target;
  if (t.dataset.l){ const row = D[t.dataset.l][+t.dataset.i]; row[t.dataset.k] = t.type==="number" ? (+t.value||0) : t.value; mudou(); }
  else if (t.id==="inRenda"){ D.renda = +t.value||0; mudou(); }
  else if (t.id==="inInicio"){ if (t.value) { D.inicio = t.value; mudou(); } }
  else if (t.id==="inRent"){ D.rent = +t.value||0; mudou(); }
  else if (t.id==="dia"){ D.dia = +t.value; mudou(); }
});
document.addEventListener("click", e=>{
  const t = e.target;
  if (t.dataset.del){ D[t.dataset.del].splice(+t.dataset.i,1); renderEditor(); mudou(); }
  if (t.closest("#mesesSeg button")){ D.meses = +t.closest("button").dataset.m; mudou(); }
});
$("addFixo").onclick = ()=>{ D.fixos.push({nome:"",valor:0}); renderEditor(); };
$("addParc").onclick = ()=>{ D.parcelas.push({item:"",cartao:"",valor:0,fim:addM(D.inicio,5)}); renderEditor(); };
$("btnStart").onclick = ()=>{ $("editor").open = true; $("inRenda").focus(); };
$("btnExample").onclick = ()=>{ D = exemplo(); temDados = true; renderEditor(); renderPlano(); };
$("btnClear").onclick = ()=>{
  if (!$("btnClear").dataset.ok){ $("btnClear").dataset.ok = "1"; $("btnClear").textContent = "Confirmar: apagar tudo"; setTimeout(()=>{ delete $("btnClear").dataset.ok; $("btnClear").textContent = "Apagar dados"; }, 4000); return; }
  try { localStorage.removeItem(KEY); } catch(e){}
  D = vazio(); temDados = false; delete $("btnClear").dataset.ok; $("btnClear").textContent = "Apagar dados";
  renderEditor(); renderPlano();
};
$("btnExport").onclick = ()=>{
  const dados = Object.assign({}, D); delete dados.exemplo;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dados,null,2)],{type:"application/json"}));
  a.download = "plano-financeiro-dados.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
};
$("fileImport").onchange = async e=>{
  const f = e.target.files[0]; if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (typeof s !== "object" || !Array.isArray(s.fixos) || !Array.isArray(s.parcelas)) throw new Error("formato");
    D = Object.assign(vazio(), s); delete D.exemplo; temDados = true; salvar(); renderEditor(); renderPlano();
  } catch(err) { alert("Não consegui ler esse arquivo. Use o arquivo gerado em \"Exportar dados\"."); }
  e.target.value = "";
};

const mq = matchMedia("(prefers-color-scheme: dark)");
mq.addEventListener && mq.addEventListener("change", renderPlano);
carregar(); renderEditor(); renderPlano();
if (!temDados) $("editor").open = false;
