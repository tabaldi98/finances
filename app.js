// Plano financeiro. Nenhum valor fica no código: os dados vivem só no localStorage do navegador.
const KEY = "plano-financeiro:v1";
const NOMES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function ym(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
function proxMes(){ const d = new Date(); d.setMonth(d.getMonth()+1, 1); return ym(d); }
function addM(k, n){ return ym(new Date(+k.slice(0,4), +k.slice(5)-1+n, 1)); }
const okM = k => /^\d{4}-\d{2}$/.test(k||"");
const lbl = k => NOMES[+k.slice(5)-1]+"/"+k.slice(2,4);
const brl = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const brl0 = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
function parseBRL(s){
  s = String(s ?? "").replace(/R\$|\s/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  const v = parseFloat(s); return isFinite(v) ? v : 0;
}
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const $ = id => document.getElementById(id);

const vazio = () => ({ renda: 0, inicio: proxMes(), rendaMes: {}, fixos: [], parcelas: [] });
function exemplo(){
  const i = proxMes();
  return { renda: 9000, inicio: i, rendaMes: { [addM(i,1)]: 10500 },
    fixos: [{nome:"Aluguel",valor:2200},{nome:"Energia",valor:220},{nome:"Internet",valor:110},{nome:"Streaming",valor:55}],
    parcelas: [
      {item:"Notebook",cartao:"Cartão A",valor:450,ini:i,fim:addM(i,5)},
      {item:"Geladeira",cartao:"Cartão B",valor:320,ini:i,fim:addM(i,8)},
      {item:"Curso",cartao:"Cartão A",valor:280,ini:i,fim:addM(i,2)}
    ], exemplo: true };
}
function normalizar(s){
  const d = Object.assign(vazio(), s);
  d.rendaMes = (d.rendaMes && typeof d.rendaMes === "object") ? d.rendaMes : {};
  d.parcelas = d.parcelas.map(p => Object.assign({ini: ""}, p));
  delete d.dia; delete d.meses; delete d.rent;
  return d;
}

let D = vazio(), temDados = false;
try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { D = normalizar(s); temDados = true; } } catch(e){}
function salvar(){ if (D.exemplo) return; try { localStorage.setItem(KEY, JSON.stringify(D)); } catch(e){} }

const totFixo = () => D.fixos.reduce((s,f)=>s+(+f.valor||0),0);
const parcValidas = () => D.parcelas.filter(p => +p.valor > 0 && okM(p.fim));
const rendaDe = m => (D.rendaMes[m] != null && D.rendaMes[m] !== "") ? +D.rendaMes[m] : D.renda;
const ativa = (p, m) => m <= p.fim && (!okM(p.ini) || m >= p.ini);

function meses(){
  const fins = parcValidas().map(p=>p.fim).concat(Object.keys(D.rendaMes)).filter(okM).sort();
  const ultimo = fins.length ? fins[fins.length-1] : D.inicio;
  const fim = addM(ultimo > D.inicio ? ultimo : D.inicio, 1);
  const out = []; let m = D.inicio;
  while (m <= fim && out.length < 72) { out.push(m); m = addM(m,1); }
  while (out.length < 12) out.push(addM(D.inicio, out.length));
  return out;
}

function simular(){
  const FIXO = totFixo(), P = parcValidas(), M = meses();
  let acum = 0;
  const rows = M.map(m => {
    const renda = rendaDe(m);
    const parc = P.filter(p=>ativa(p,m)).reduce((s,p)=>s+(+p.valor),0);
    const sobra = renda - FIXO - parc; acum += sobra;
    return {m, renda, parc, sobra, acum, extra: D.rendaMes[m] != null && D.rendaMes[m] !== ""};
  });
  return {FIXO,P,M,rows};
}

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let ch1;
const SORT_KEY = "plano-financeiro:ordem";
let ordem = { col: "fim", dir: "desc" };
try { const s = JSON.parse(localStorage.getItem(SORT_KEY) || "null"); if (s && s.col) ordem = s; } catch(e){}
const COLS_ORD = { item: "Item", cartao: "Cartão", valor: "Valor/mês", ini: "Primeira", fim: "Última", total: "Falta pagar" };
function ordenar(P, M){
  const falta = p => M.filter(m=>ativa(p,m)).length * p.valor;
  const val = (p, c) => c==="valor" ? +p.valor : c==="total" ? falta(p) : c==="ini" ? (okM(p.ini)?p.ini:"") : String(p[c]||"").toLocaleLowerCase("pt-BR");
  const d = ordem.dir === "asc" ? 1 : -1;
  return [...P].sort((a,b)=>{
    const x = val(a,ordem.col), y = val(b,ordem.col);
    const r = typeof x === "number" ? x - y : x.localeCompare(y, "pt-BR");
    return r !== 0 ? r*d : (a.fim<b.fim?1:a.fim>b.fim?-1:b.valor-a.valor);
  });
}
const thOrd = c => {
  const on = ordem.col === c;
  return `<th aria-sort="${on?(ordem.dir==="asc"?"ascending":"descending"):"none"}"><button type="button" class="sort${on?" on":""}" data-sort="${c}">${COLS_ORD[c]}<span aria-hidden="true">${on?(ordem.dir==="asc"?" ▲":" ▼"):" ↕"}</span></button></th>`;
};
function chartOpts(){
  const ink2=css("--ink-2"), line=css("--line");
  return { responsive:true, maintainAspectRatio:false, animation:false,
    interaction:{mode:"index",intersect:false},
    plugins:{ legend:{display:false}, tooltip:{ callbacks:{
      label:c=>" "+c.dataset.label+": "+brl(c.parsed.y),
      footer:items=>"Renda: "+brl(items.reduce((s,i)=>s+i.parsed.y,0)) } } },
    scales:{ x:{stacked:true, grid:{display:false}, ticks:{color:ink2, font:{family:"IBM Plex Mono"}}, border:{color:line}},
      y:{stacked:true, grid:{color:line}, border:{display:false}, ticks:{color:ink2, font:{family:"IBM Plex Mono"}, callback:v=>"R$ "+(v/1000).toLocaleString("pt-BR")+" mil"}} } };
}
const bar = (label,data,color,last) => ({label,data,backgroundColor:color,borderColor:css("--surface"),borderWidth:{top:2},borderSkipped:"bottom",borderRadius:last?{topLeft:4,topRight:4}:0,maxBarThickness:42});

function renderPlano(){
  const pronto = temDados && D.renda > 0;
  $("empty").hidden = pronto;
  $("plan").hidden = !pronto;
  if (!pronto) { if (ch1) { ch1.destroy(); ch1 = null; } return; }

  const {FIXO,P,M,rows} = simular();
  const ultimoFim = P.map(p=>p.fim).sort().pop();
  const livreDe = ultimoFim ? addM(ultimoFim,1) : M[0];
  const rLivre = rows.find(r=>r.m===livreDe) || rows[rows.length-1];
  const r0 = rows[0], last = rows[rows.length-1];
  const sobraLivre = D.renda - FIXO;

  $("eyebrow").textContent = (D.exemplo ? "Exemplo · " : "Planejamento · ") + lbl(M[0]) + " a " + lbl(last.m);
  $("lede").textContent = `Renda de ${brl0(D.renda)} por mês.` + (ultimoFim
    ? ` As parcelas terminam em ${lbl(ultimoFim)}, e a sobra mensal vai de ${brl0(r0.sobra)} para ${brl0(sobraLivre)}.`
    : ` Sobra mensal de ${brl0(sobraLivre)}.`);

  $("kpis").innerHTML = [
    ["Gastos em "+lbl(r0.m), brl0(FIXO+r0.parc), Math.round((FIXO+r0.parc)/r0.renda*100)+"% da renda"],
    ["Sobra em "+lbl(r0.m), brl0(r0.sobra), "renda menos contas e parcelas"],
    ["Sobra sem parcelas", brl0(sobraLivre), ultimoFim ? "a partir de "+lbl(livreDe) : "sem parcelas ativas"],
    ["Sobra acumulada até "+lbl(last.m), brl0(last.acum), "soma das sobras do período"]
  ].map(k=>`<div class="kpi"><span class="label">${k[0]}</span><span class="value">${k[1]}</span><span class="sub">${k[2]}</span></div>`).join("");

  if (window.Chart){
    if (ch1) ch1.destroy();
    ch1 = new Chart($("cFluxo"), {type:"bar", data:{labels:rows.map(r=>lbl(r.m)), datasets:[
      bar("Contas fixas", rows.map(()=>FIXO), css("--s1")),
      bar("Parcelas", rows.map(r=>r.parc), css("--s2")),
      bar("Sobra", rows.map(r=>Math.max(0,r.sobra)), css("--s4"), true)]}, options:chartOpts()});
  }

  // gantt
  const cols = M.filter(m => !ultimoFim || m <= ultimoFim);
  let g = `<thead><tr>${["item","cartao","valor","fim","total"].map(thOrd).join("")}${cols.map(m=>`<th style="text-align:center">${lbl(m)}</th>`).join("")}</tr></thead><tbody>`;
  let saldo = 0;
  for (const p of ordenar(P, M)){
    const falta = M.filter(m=>ativa(p,m)).length * p.valor; saldo += falta;
    g += `<tr><td class="txt">${esc(p.item)}</td><td class="txt val" style="text-align:left">${esc(p.cartao)}</td><td class="val">${brl(+p.valor)}</td><td class="val">${lbl(p.fim)}</td><td class="val">${brl(falta)}</td>${cols.map(m=>`<td class="${ativa(p,m)?"on":""}${m===p.fim?" last":""}"></td>`).join("")}</tr>`;
  }
  g += `<tr><td class="txt"><b>Total do mês</b></td><td></td><td></td><td></td><td></td>${cols.map(m=>`<td style="font-size:0.72rem">${brl(P.filter(p=>ativa(p,m)).reduce((s,p)=>s+(+p.valor),0))}</td>`).join("")}</tr></tbody>`;
  $("gantt").innerHTML = P.length ? g : `<tbody><tr><td class="txt">Nenhuma parcela cadastrada.</td></tr></tbody>`;
  $("saldoDev").textContent = brl(saldo);

  // tabela
  let h = `<thead><tr><th>Mês</th><th>Renda</th><th>Contas fixas</th><th>Parcelas</th><th>Gasto total</th><th>Sobra</th><th>Sobra acumulada</th></tr></thead><tbody>`;
  for (const r of rows) h += `<tr><td class="txt">${lbl(r.m)}</td><td><input class="renda-in${r.extra?" extra":""}" type="text" inputmode="decimal" data-rmt="${r.m}" value="${brl(r.renda)}" aria-label="Renda de ${lbl(r.m)}"></td><td>${brl(FIXO)}</td><td>${brl(r.parc)}</td><td>${brl(FIXO+r.parc)}</td><td${r.sobra<0?' style="color:var(--warn)"':""}>${brl(r.sobra)}</td><td${r.acum<0?' style="color:var(--warn)"':""}>${brl(r.acum)}</td></tr>`;
  $("tabela").innerHTML = h + "</tbody>" + "";

  // marcos
  const liber = {};
  for (const p of P) if (p.fim >= M[0]) liber[p.fim] = (liber[p.fim]||0) + (+p.valor);
  const marcos = Object.keys(liber).sort().map(m=>({m, goal:false,
    t:"Última parcela: "+P.filter(p=>p.fim===m).map(p=>esc(p.item)).join(", "),
    d:`A partir de ${lbl(addM(m,1))} sobram mais ${brl(liber[m])} por mês.`}));
  for (const p of P) if (okM(p.ini) && p.ini > M[0]) marcos.push({m:p.ini, goal:false, t:"Começa: "+esc(p.item), d:`Nova parcela de ${brl(+p.valor)} por mês até ${lbl(p.fim)}.`});
  if (ultimoFim) marcos.push({m:livreDe, goal:true, t:"Livre de parcelas", d:`Gastos caem para ${brl0(FIXO)} por mês e a sobra chega a ${brl0(sobraLivre)}.`});
  marcos.sort((a,b)=>a.m<b.m?-1:a.m>b.m?1:(a.goal?1:-1));
  $("marcos").innerHTML = marcos.length ? marcos.map(x=>`<div class="ms${x.goal?" goal":""}"><span class="when">${lbl(x.m)}</span><h3>${x.t}</h3><p class="note">${x.d}</p></div>`).join("") : `<p class="note">Nenhuma parcela cadastrada.</p>`;
}

// editor completo
function renderEditor(){
  $("inRenda").value = D.renda ? brl(D.renda) : "";
  $("inInicio").value = D.inicio;
  const rm = Object.keys(D.rendaMes).sort();
  $("edRenda").innerHTML = rm.length
    ? `<thead><tr><th>Mês</th><th>Renda (R$)</th><th></th></tr></thead><tbody>` + rm.map(m=>`<tr><td>${lbl(m)}</td><td><input class="money" type="text" inputmode="decimal" data-rm="${m}" value="${brl(+D.rendaMes[m])}" aria-label="Renda de ${lbl(m)}"></td><td class="x"><button type="button" data-delrm="${m}" aria-label="Remover">×</button></td></tr>`).join("") + `</tbody>`
    : `<tbody><tr><td class="note">Nenhum mês com renda diferente. Adicione em "Adicionar conta" escolhendo "Renda diferente em um mês".</td></tr></tbody>`;
  $("edFixos").innerHTML = `<thead><tr><th>Descrição</th><th>Valor (R$)</th><th></th></tr></thead><tbody>` +
    D.fixos.map((f,i)=>`<tr><td><input data-l="fixos" data-i="${i}" data-k="nome" value="${esc(f.nome)}" aria-label="Descrição"></td><td><input class="money" type="text" inputmode="decimal" data-l="fixos" data-i="${i}" data-k="valor" value="${brl(+f.valor)}" aria-label="Valor"></td><td class="x"><button type="button" data-del="fixos" data-i="${i}" aria-label="Remover">×</button></td></tr>`).join("") + `</tbody>`;
  $("edParc").innerHTML = `<thead><tr><th>Item</th><th>Cartão</th><th>Parcela (R$)</th><th>Primeira</th><th>Última</th><th></th></tr></thead><tbody>` +
    D.parcelas.map((p,i)=>`<tr><td><input data-l="parcelas" data-i="${i}" data-k="item" value="${esc(p.item)}" aria-label="Item"></td><td><input data-l="parcelas" data-i="${i}" data-k="cartao" value="${esc(p.cartao)}" aria-label="Cartão"></td><td><input class="money" type="text" inputmode="decimal" data-l="parcelas" data-i="${i}" data-k="valor" value="${brl(+p.valor)}" aria-label="Valor da parcela"></td><td><input type="month" data-l="parcelas" data-i="${i}" data-k="ini" value="${esc(p.ini)}" aria-label="Mês da primeira parcela"></td><td><input type="month" data-l="parcelas" data-i="${i}" data-k="fim" value="${esc(p.fim)}" aria-label="Mês da última parcela"></td><td class="x"><button type="button" data-del="parcelas" data-i="${i}" aria-label="Remover">×</button></td></tr>`).join("") + `</tbody>`;
}

function mudou(){ delete D.exemplo; temDados = true; salvar(); renderPlano(); }

document.addEventListener("input", e=>{
  const t = e.target;
  if (t.dataset.l){ D[t.dataset.l][+t.dataset.i][t.dataset.k] = t.classList.contains("money") ? parseBRL(t.value) : t.value; mudou(); }
  else if (t.dataset.rm){ D.rendaMes[t.dataset.rm] = parseBRL(t.value); mudou(); }
  else if (t.id==="inRenda"){ D.renda = parseBRL(t.value); mudou(); }
  else if (t.id==="inInicio"){ if (t.value) { D.inicio = t.value; mudou(); } }
});
document.addEventListener("focusin", e=>{ if (e.target.matches(".money, .renda-in")) e.target.select(); });
document.addEventListener("focusout", e=>{
  const t = e.target;
  if (t.matches(".money") && t.value.trim() !== "") t.value = brl(parseBRL(t.value));
});
document.addEventListener("change", e=>{
  const t = e.target;
  if (!t.dataset.rmt) return;
  const v = t.value.trim() === "" ? null : parseBRL(t.value);
  if (v === null || v === D.renda) delete D.rendaMes[t.dataset.rmt]; else D.rendaMes[t.dataset.rmt] = v;
  renderEditor(); mudou();
});
document.addEventListener("click", e=>{
  const t = e.target;
  const s = t.closest("[data-sort]");
  if (s){
    const c = s.dataset.sort;
    ordem = ordem.col === c ? {col:c, dir: ordem.dir==="asc"?"desc":"asc"} : {col:c, dir: (c==="item"||c==="cartao"||c==="fim") ? "asc" : "desc"};
    try { localStorage.setItem(SORT_KEY, JSON.stringify(ordem)); } catch(err){}
    renderPlano(); return;
  }
  if (t.dataset.del){ D[t.dataset.del].splice(+t.dataset.i,1); renderEditor(); mudou(); }
  if (t.dataset.delrm){ delete D.rendaMes[t.dataset.delrm]; renderEditor(); mudou(); }
});

// adicionar conta
function tipoQA(){
  const tipo = $("qaTipo").value;
  document.querySelectorAll("#qaForm [data-p]").forEach(el => el.hidden = tipo !== "parcela" && !(tipo === "renda" && el.hasAttribute("data-r")));
  document.querySelectorAll("#qaForm [data-np]").forEach(el => el.hidden = tipo === "renda");
  $("qaValorLbl").textContent = tipo === "renda" ? "Renda do mês (R$)" : tipo === "fixo" ? "Valor por mês (R$)" : "Valor da parcela (R$)";
  $("qaIniLbl").textContent = tipo === "renda" ? "Mês" : "Primeira parcela";
}
$("qaTipo").onchange = tipoQA;
$("qaForm").addEventListener("submit", e=>{
  e.preventDefault();
  const tipo = $("qaTipo").value, nome = $("qaNome").value.trim(), valor = parseBRL($("qaValor").value);
  const ini = $("qaIni").value, fim = $("qaFim").value, msg = $("qaMsg");
  msg.style.color = "var(--warn)";
  if (!(valor > 0)) { msg.textContent = "Informe um valor maior que zero."; return; }
  if (tipo === "renda") {
    if (!okM(ini)) { msg.textContent = "Escolha o mês da renda."; return; }
    D.rendaMes[ini] = valor; msg.textContent = `Renda de ${lbl(ini)} definida em ${brl(valor)}.`;
  } else {
    if (!nome) { msg.textContent = "Dê um nome para a conta."; return; }
    if (tipo === "fixo") { D.fixos.push({nome, valor}); msg.textContent = `Conta fixa "${nome}" adicionada.`; }
    else {
      if (!okM(fim)) { msg.textContent = "Escolha o mês da última parcela."; return; }
      if (okM(ini) && ini > fim) { msg.textContent = "A primeira parcela precisa vir antes da última."; return; }
      D.parcelas.push({item:nome, cartao:$("qaCartao").value.trim(), valor, ini: okM(ini) ? ini : "", fim});
      msg.textContent = `Parcela "${nome}" de ${brl(valor)} até ${lbl(fim)} adicionada.`;
    }
  }
  msg.style.color = "";
  ["qaNome","qaCartao","qaValor","qaFim"].forEach(id => $(id).value = "");
  $("qaIni").value = proxMes();
  renderEditor(); mudou();
});

$("btnStart").onclick = ()=>{ $("editor").open = true; $("inRenda").focus(); };
$("btnExample").onclick = ()=>{ D = exemplo(); temDados = true; renderEditor(); renderPlano(); };
$("btnClear").onclick = ()=>{
  const b = $("btnClear");
  if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confirmar: apagar tudo"; setTimeout(()=>{ delete b.dataset.ok; b.textContent = "Apagar dados"; }, 4000); return; }
  try { localStorage.removeItem(KEY); } catch(e){}
  D = vazio(); temDados = false; delete b.dataset.ok; b.textContent = "Apagar dados";
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
    D = normalizar(s); temDados = true; salvar(); renderEditor(); renderPlano();
  } catch(err) { alert("Não consegui ler esse arquivo. Use o arquivo gerado em \"Exportar dados\"."); }
  e.target.value = "";
};

const mq = matchMedia("(prefers-color-scheme: dark)");
mq.addEventListener && mq.addEventListener("change", renderPlano);
$("qaIni").value = proxMes();
tipoQA(); renderEditor(); renderPlano();
