/* ============ 星途练习生：Stellar Drift — 引擎 ============ */
(function () {
  "use strict";

  /* ---------- 内置序章 ---------- */
  window.PROLOGUE = {
    id: "prologue", title: "序章 · 一百朗星与一次日出", phase: "选秀", week: 1,
    nodes: [
      {t:"bg", v:"night"},
      {t:"n", x:"三月的最后一夜，城市还没有睡。开往训练基地的大巴穿过高架桥，车窗上凝着薄薄的水汽，把外面的霓虹揉成一片流动的光斑。"},
      {t:"n", x:"你手里捏着那张薄薄的入选通知书，指腹已经把边角磨得发软。上面印着一行烫金的字——《星途练习生》，全国仅一百席。"},
      {t:"m", x:"一百个人，七道光。凭什么会是我？"},
      {t:"n", x:"手机在口袋里震了一下。是苏景行，从三排座位探过头来，亚麻色的头发睡翘了一撮。"},
      {t:"d", who:"苏景行", x:"睡不着？那正好，陪我猜个谜——你说，明天第一个被记住名字的，会是谁？", fx:"smile"},
      {t:"choice", prompt:"……", options:[
        {x:"\"睡你的觉，景行。\"", heart:{苏景行:1}, cb:"他笑出声，缩回座位，又留了半张脸在外面看你。"},
        {x:"\"……希望是我们七个人都记得彼此。\"", heart:{苏景行:2, 温以恒:1}, cb:"他愣了一下，随即弯起眼睛：\"行啊，队长味儿这就来了。\""}
      ]},
      {t:"n", x:"大巴驶进基地大门时，天边刚泛起蟹壳青。一百个行李箱的轮子在地面上轰鸣，像某种巨大心脏的第一声搏动。"},
      {t:"sys", x:"【星途练习生】欢迎入住训练基地。赛程共12周，最终出道位7席。祝你，被世界记住。"},
      {t:"end"}
    ]
  };

  /* ---------- 工具 ---------- */
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const fmtText = (s) => esc(s).replace(/\n/g,"<br>");
  const SAVE_KEY = "stellardrift_save_v1";

  const BG_NAME = { lobby:"训练基地大厅", dorm:"宿舍", studio:"练习室", stage:"主舞台", office:"导播室", rooftop:"天台",
    villa:"漂流屋", pool:"泳池", garden:"花园迷宫", night:"夜景", rain:"雨中", cafe:"咖啡书屋",
    greenroom:"后台休息室", corridor:"走廊" };

  /* ---------- 状态 ---------- */
  let S = null;           // 存档状态
  let chapters = [];      // 全章节（含序章）
  let cur = { ch:null, idx:0 };  // 当前章节对象与节点下标
  let typing = false;     // 打字机进行中
  let typeTimer = null;
  let fullText = "";      // 当前节点完整文本
  let busy = false;       // 系统弹层/选项等待中

  function sortedChapters() {
    const arr = (window.STORY || []).slice();
    arr.sort((a,b) => String(a.id).localeCompare(String(b.id)));
    return arr;
  }

  function defaultState(name) {
    const hearts = {};
    Object.keys(window.HEART_INIT).forEach(k => hearts[k] = window.HEART_INIT[k]);
    return { name: name || "江晚", hearts, flags: {}, chIndex: 0, nodeIndex: 0,
      unlocked: ["prologue"], endings: [], startedAt: Date.now() };
  }

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){} }
  function load() { try { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : null; } catch(e){ return null; } }

  /* ---------- 屏幕切换 ---------- */
  function show(id) {
    document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));
    $(id).classList.add("active");
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  /* ---------- 心动 ---------- */
  function addHeart(who, delta) {
    if (!S || !S.hearts.hasOwnProperty(who) || !delta) return;
    S.hearts[who] = Math.max(0, Math.min(100, S.hearts[who] + delta));
    if (delta > 0) toast("♡ " + who + " 心动 +" + delta);
    else if (delta < 0) toast(who + " 心动 " + delta);
    renderHearts();
  }
  function renderHearts() {
    const list = $("#hearts-list");
    list.innerHTML = Object.keys(S.hearts).map(k => {
      const v = S.hearts[k];
      const c = (window.CHARS[k] && window.CHARS[k].color) || "#5f74e8";
      return `<div class="heart-row">
        <div class="heart-name"><span>${esc(k)}</span><span>${v}</span></div>
        <div class="heart-bar"><div class="heart-fill" style="width:${v}%;background:${c}"></div></div>
      </div>`;
    }).join("");
  }

  /* ---------- 打字机 ---------- */
  function typeText(el, text, speed, done) {
    fullText = text; typing = true;
    el.innerHTML = "";
    let i = 0;
    const plain = text; // 带标签时一次性处理：这里文本先转义，仅保留<br>
    const html = fmtText(text);
    // 简化：按整段渐显（性能与兼容性最稳），再触发 done
    el.innerHTML = html;
    el.style.opacity = "0.01";
    const step = Math.max(12, Math.min(30, 800 / Math.max(10, text.length)));
    typeTimer = setInterval(() => {
      i += Math.max(2, Math.round(text.length / 26));
      el.style.opacity = String(Math.min(1, i / text.length * 1.4));
      if (i >= text.length) { clearInterval(typeTimer); el.style.opacity = "1"; typing = false; if (done) done(); }
    }, speed || step);
  }

  /* ---------- 节点渲染 ---------- */
  function currentChapter() { return chapters[S.chIndex]; }

  function enterChapter(i, nodeIndex) {
    S.chIndex = i; S.nodeIndex = nodeIndex || 0;
    const ch = chapters[i];
    cur.ch = ch;
    $("#tb-phase").textContent = ch.phase === "结局" ? "结局" : (ch.phase + (ch.week ? " · 第" + ch.week + "周" : ""));
    $("#tb-title").textContent = ch.title;
    renderNode();
    save();
  }

  function renderNode() {
    const ch = cur.ch;
    const node = ch.nodes[S.nodeIndex];
    if (!node) { nextChapterOrEnding(); return; }
    busy = false;
    $("#choices").hidden = true;
    $("#sys-overlay").hidden = true;

    switch (node.t) {
      case "bg": {
        $("#bg-layer").className = "bg-" + (node.v || "night");
        advance();
        break;
      }
      case "n": {
        setSpeaker("");
        showPortrait(null);
        typeText($("#text"), node.x);
        break;
      }
      case "m": {
        setSpeaker("");
        showPortrait(null);
        $("#text").innerHTML = `<span class="inner-voice">（${fmtText(node.x)}）</span>`;
        break;
      }
      case "d": {
        setSpeaker(node.who);
        showPortrait(node.who, node.fx);
        typeText($("#text"), node.x);
        break;
      }
      case "heart": {
        addHeart(node.who, node.delta);
        advance();
        break;
      }
      case "danmaku": {
        spawnDanmaku(node.items || []);
        setTimeout(advance, 2600);
        break;
      }
      case "sys": {
        setSpeaker("系统");
        showPortrait(null);
        $("#text").innerHTML = `<span style="color:#8fa0d0">${fmtText(node.x)}</span>`;
        break;
      }
      case "weibo": {
        busy = true;
        const rows = (node.items || []).map((x, i) =>
          `<div class="hot-item"><span class="no">${i+1}</span><span>${fmtText(x)}${i<3?'<span class="hot-badge">热</span>':''}</span></div>`).join("");
        $("#sys-card").innerHTML = `<h4>🌊 微博热搜 · 实时</h4>${rows}<div class="close-hint">点击任意处关闭</div>`;
        $("#sys-overlay").hidden = false;
        break;
      }
      case "phone": {
        busy = true;
        const msgs = (node.msgs || []).map(m =>
          `<div class="msg ${m.f==='me'?'me':'them'}">${fmtText(m.x)}${m.time?`<span class="t">${esc(m.time)}</span>`:""}</div>`).join("");
        $("#sys-card").innerHTML = `<div class="phone-screen"><div class="phone-head">💬 ${esc(node.who||"群聊")}</div>${msgs}</div><div class="close-hint">点击任意处关闭</div>`;
        $("#sys-overlay").hidden = false;
        break;
      }
      case "diary": {
        busy = true;
        $("#sys-card").innerHTML = `<h4>📖 ${esc(node.who)}的日记</h4><div class="diary-paper"><div class="diary-meta">${esc(node.date||"")}</div>${fmtText(node.x)}</div><div class="close-hint">点击任意处关闭</div>`;
        $("#sys-overlay").hidden = false;
        break;
      }
      case "choice": {
        busy = true;
        setSpeaker("");
        showPortrait(null);
        $("#text").innerHTML = `<span class="choice-prompt">${esc(node.prompt||"你要怎么做？")}</span>`;
        const box = $("#choices");
        box.innerHTML = "";
        (node.options || []).forEach((op) => {
          const b = document.createElement("button");
          b.className = "choice-btn";
          b.innerHTML = fmtText(op.x);
          b.onclick = () => {
            box.hidden = true;
            (Object.keys(op.heart || {})).forEach(k => addHeart(k, op.heart[k]));
            if (op.flag) S.flags[op.flag] = true;
            if (op.cb) { $("#text").innerHTML = fmtText(op.cb); setSpeaker(""); busy = false; S.nodeIndex++; save(); }
            else advance();
          };
          box.appendChild(b);
        });
        box.hidden = false;
        break;
      }
      case "verdict": {
        cur.verdict = node.x;
        advance();
        break;
      }
      case "end": {
        chapterFinished();
        break;
      }
      default: advance();
    }
    save();
  }

  function setSpeaker(name) {
    const sp = $("#speaker");
    if (name) { sp.textContent = name; sp.style.display = "block"; }
    else { sp.textContent = ""; sp.style.display = "none"; }
  }

  function showPortrait(who) {
    const img = $("#chara-img"), np = $("#chara-nameplate");
    const c = who && window.CHARS[who];
    if (c && c.hasImg && c.img) {
      img.src = c.img; img.hidden = false;
      np.textContent = who + " · " + c.en; np.hidden = false;
    } else if (who) {
      img.hidden = true;
      np.textContent = who; np.hidden = false;
    } else { img.hidden = true; np.hidden = true; }
  }

  function spawnDanmaku(items) {
    const layer = $("#danmaku-layer");
    items.forEach((raw, i) => {
      const parts = String(raw).split("|");
      const d = document.createElement("div");
      d.className = "danmaku";
      d.innerHTML = `<b style="color:#9db1ff">${esc(parts[0]||"路人")}</b>　${esc(parts[1]||"")}`;
      d.style.top = (4 + Math.random() * 80) + "%";
      d.style.animationDuration = (7 + Math.random() * 4) + "s";
      d.style.animationDelay = (i * 0.45) + "s";
      layer.appendChild(d);
      setTimeout(() => d.remove(), 13000);
    });
  }

  function advance() {
    S.nodeIndex++;
    renderNode();
  }

  function stageClick() {
    if (busy) return;
    if (typing) { clearInterval(typeTimer); $("#text").style.opacity = "1"; typing = false; return; }
    advance();
  }

  /* ---------- 章节流转 ---------- */
  function nextChapterOrEnding() {
    // 主线结束（ch34 之后）→ 决定结局线
    const ch = currentChapter();
    if (ch && ch.id === "ch34") { gotoEndingLine(); return; }
    if (S.chIndex >= chapters.length - 1) { showEndingScreen(); return; }
    enterChapter(S.chIndex + 1, 0);
  }

  function chapterFinished() {
    const ch = currentChapter();
    if (ch.id === "prologue" && !S.unlocked.includes("ch01")) S.unlocked.push("ch01");
    else if (!S.unlocked.includes(ch.id)) S.unlocked.push(ch.id);
    save();
    if (ch.id === "ch34") { gotoEndingLine(); return; }
    if (window.ENDING_IDS.includes(ch.id)) { showEndingScreen(); return; }
    nextChapterOrEnding();
  }

  function gotoEndingLine() {
    // 团队羁绊：全员心动总和 + flag stay_together
    const total = Object.values(S.hearts).reduce((a,b)=>a+b,0);
    const together = S.flags["stay_together"] && total >= 380;
    // 真结局优先条件：无单一心动值≥88 的压倒性第一时进入真结局
    const entries = Object.entries(S.hearts).sort((a,b)=>b[1]-a[1]);
    const [topName, topVal] = entries[0];
    const second = entries[1] ? entries[1][1] : 0;
    let targetId;
    if (together && topVal - second < 8) targetId = "ch42";
    else {
      const map = { "苏景行":"ch35","林墨轩":"ch36","温以恒":"ch37","顾知遥":"ch38","沈时雨":"ch39","陆清越":"ch40","江慕白":"ch41" };
      targetId = map[topName] || "ch42";
    }
    const idx = chapters.findIndex(c => c.id === targetId);
    if (idx < 0) { showEndingScreen(); return; }
    toast("命运指向了一个人……");
    enterChapter(idx, 0);
  }

  function showEndingScreen() {
    const ch = currentChapter();
    if (ch && !S.endings.includes(ch.id)) { S.endings.push(ch.id); }
    save();
    $("#ending-name").textContent = (window.ENDING_NAMES[ch.id]) || ch.title || "旅程结束";
    $("#ending-verdict").textContent = (cur.verdict) || "星光落进眼里，从此夜路有了灯。";
    $("#ending-final-hearts").innerHTML = "最终心动值<br>" +
      Object.entries(S.hearts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `${k} ${v}`).join("　·　");
    show("#screen-ending");
  }

  /* ---------- 图鉴 ---------- */
  function renderGallery() {
    const g = $("#gal-chapters");
    g.innerHTML = "";
    chapters.forEach((ch, i) => {
      const unlocked = S.unlocked.includes(ch.id);
      const d = document.createElement("div");
      d.className = "gal-item" + (unlocked ? "" : " locked");
      d.innerHTML = unlocked
        ? `${esc(ch.title)}<span class="gi-tag">${esc(ch.phase)}${ch.week ? " · 第"+ch.week+"周" : ""}</span>`
        : "？？？<span class=\"gi-tag\">未解锁</span>";
      if (unlocked) d.onclick = () => { show("#screen-game"); enterChapter(i, 0); };
      g.appendChild(d);
    });
    $("#gal-progress").textContent = `${S.unlocked.length} / ${chapters.length}`;
    const ge = $("#gal-endings");
    ge.innerHTML = "";
    window.ENDING_IDS.forEach(id => {
      const seen = S.endings.includes(id);
      const d = document.createElement("div");
      d.className = "gal-item" + (seen ? "" : " locked");
      d.innerHTML = seen ? esc(window.ENDING_NAMES[id]) : "？？？<span class=\"gi-tag\">未达成</span>";
      ge.appendChild(d);
    });
    $("#gal-endings-count").textContent = `${S.endings.length} / ${window.ENDING_IDS.length}`;
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $("#btn-new").onclick = () => { show("#screen-name"); $("#input-name").value = ""; setTimeout(()=>$("#input-name").focus(),100); };
    $("#btn-name-back").onclick = () => show("#screen-title");
    $("#btn-name-ok").onclick = () => {
      const n = $("#input-name").value.trim() || "江晚";
      S = defaultState(n);
      chapters = [window.PROLOGUE].concat(sortedChapters());
      save();
      show("#screen-game");
      renderHearts();
      enterChapter(0, 0);
    };
    $("#btn-continue").onclick = () => {
      const s = load(); if (!s) return;
      S = s;
      chapters = [window.PROLOGUE].concat(sortedChapters());
      if (S.chIndex >= chapters.length) S.chIndex = 0;
      show("#screen-game");
      renderHearts();
      enterChapter(S.chIndex, S.nodeIndex || 0);
    };
    $("#btn-gallery").onclick = () => {
      S = load() || defaultState("江晚");
      chapters = [window.PROLOGUE].concat(sortedChapters());
      renderGallery(); show("#screen-gallery");
    };
    $("#btn-gal-back").onclick = () => show("#screen-title");
    $("#btn-reset").onclick = () => {
      if (confirm("确定清除全部存档与图鉴进度？")) { localStorage.removeItem(SAVE_KEY); location.reload(); }
    };

    $("#stage").addEventListener("click", (e) => {
      if (e.target.closest("#hearts-panel")) return;
      stageClick();
    });
    $("#dialogbox").addEventListener("click", stageClick);
    $("#sys-overlay").addEventListener("click", () => { if (busy) { busy = false; advance(); } });

    $("#btn-hearts").onclick = (e) => { e.stopPropagation(); const p = $("#hearts-panel"); p.hidden = !p.hidden; };
    $("#btn-menu").onclick = (e) => { e.stopPropagation(); $("#pause-menu").hidden = false; };
    $("#pm-resume").onclick = () => $("#pause-menu").hidden = true;
    $("#pm-save").onclick = () => { save(); $("#pause-menu").hidden = true; toast("已保存"); };
    $("#pm-gallery").onclick = () => { $("#pause-menu").hidden = true; save(); renderGallery(); show("#screen-gallery"); };
    $("#pm-title").onclick = () => { $("#pause-menu").hidden = true; save(); show("#screen-title"); };

    $("#btn-end-gallery").onclick = () => { renderGallery(); show("#screen-gallery"); };
    $("#btn-end-restart").onclick = () => { show("#screen-title"); };

    document.addEventListener("keydown", (e) => {
      if (!$("#screen-game").classList.contains("active")) return;
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); if ($("#sys-overlay").hidden && !busy) stageClick(); }
      if (e.code === "Escape") $("#pause-menu").hidden = !$("#pause-menu").hidden;
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    const s = load();
    if (s && s.chIndex > 0) { $("#btn-continue").disabled = false; }
    bind();
    show("#screen-title");
  }
  document.addEventListener("DOMContentLoaded", init);
})();
