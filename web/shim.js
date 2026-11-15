/* GitHub Pages용 런타임: claude.ai 아티팩트의 window.claude.use()를 브라우저 기능으로 대신한다.
   - sample   : 사용자가 넣은 API 키로 Anthropic API 호출 (공식 TypeScript SDK, 브라우저 모드)
   - dictation: Safari/Chrome 내장 음성 인식 (webkitSpeechRecognition)
   - downloads: iOS 공유 시트(파일에 저장·프린트) 또는 다운로드
   - 그 밖의 기능(db, user, assets, tts)은 null → 앱이 이 기기 저장소로 동작 */
(function(){
  "use strict";
  var KEY = "pencil-en-apikey";
  var SDK_URL = new URL("anthropic-sdk.js", document.currentScript.src).href; /* @anthropic-ai/sdk 1.3.0 브라우저 번들 */
  var MODEL = "claude-opus-5-5";

  function getKey(){ try{ return localStorage.getItem(KEY) || ""; }catch(e){ return ""; } }
  function setKey(k){ try{ k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY); }catch(e){} }
  function fail(code, message){ var e = new Error(message || code); e.code = code; return e; }

  var sdkPromise = null;
  function loadSdk(){
    if(!sdkPromise) sdkPromise = import(SDK_URL).then(function(m){ return m.default || m.Anthropic; });
    return sdkPromise;
  }

  async function sample(input, opts){
    opts = opts || {};
    var key = getKey();
    if(!key) throw fail("no_key", "설정에서 Claude API 키를 먼저 넣어 주세요.");
    var Anthropic;
    try{ Anthropic = await loadSdk(); }catch(e){ sdkPromise = null; throw fail("network", "Claude 연결 모듈을 불러오지 못했어요. 인터넷 연결을 확인해 주세요."); }
    var client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    var messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
    var res;
    try{
      res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: opts.modelTier === "quick" ? "low" : "medium" },
        messages: messages
      }, { signal: opts.signal });
    }catch(e){
      if(e instanceof Anthropic.APIUserAbortError) throw fail("cancelled", "취소했어요.");
      if(e instanceof Anthropic.AuthenticationError) throw fail("bad_key", "API 키가 올바르지 않아요. 설정에서 다시 확인해 주세요.");
      if(e instanceof Anthropic.PermissionDeniedError) throw fail("bad_key", "이 API 키로는 사용할 수 없어요. 키 권한을 확인해 주세요.");
      if(e instanceof Anthropic.RateLimitError) throw fail("rate_limited", "요청이 많아요. 잠시 뒤 다시 눌러 주세요.");
      if(e instanceof Anthropic.BadRequestError) throw fail("bad_request", "요청을 처리하지 못했어요. (" + (e.message || "400") + ")");
      if(e instanceof Anthropic.APIConnectionError) throw fail("network", "인터넷 연결을 확인해 주세요.");
      if(e instanceof Anthropic.APIError) throw fail("api_error", "Claude 서버 오류(" + e.status + "). 잠시 뒤 다시 시도해 주세요.");
      throw fail("unknown", "알 수 없는 오류가 났어요.");
    }
    if(res.stop_reason === "refusal") throw fail("refused", "이 요청은 처리할 수 없어요. 토픽을 바꿔 보세요.");
    var text = res.content.filter(function(b){ return b.type === "text"; }).map(function(b){ return b.text; }).join("");
    if(opts.onText) opts.onText({ text: text, delta: text });
    return { text: text, truncated: res.stop_reason === "max_tokens" };
  }
  sample.json = async function(input, opts){
    var r = await sample(input, opts), t = r.text;
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if(fence) t = fence[1];
    else{
      var a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
      if(a >= 0 && b > a) t = t.slice(a, b + 1);
    }
    try{ return JSON.parse(t); }catch(e){ var err = fail("invalid_json", "응답 형식이 어긋났어요. 한 번 더 눌러 주세요."); err.text = r.text; throw err; }
  };
  sample.limits = async function(){ return {}; };

  function makeDictation(){
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return null;
    var rec = null, onP = function(){}, onF = function(){}, onS = function(){};
    return {
      onPartial: function(fn){ onP = fn; },
      onFinal: function(fn){ onF = fn; },
      onState: function(fn){ onS = fn; },
      start: function(o){
        o = o || {};
        return new Promise(function(resolve, reject){
          try{ if(rec) rec.abort(); }catch(e){}
          rec = new SR();
          rec.lang = o.language || "en-US";
          rec.interimResults = true;
          rec.continuous = true;
          var started = false;
          onS({ state: "starting" });
          rec.onstart = function(){ started = true; onS({ state: "listening" }); resolve(); };
          rec.onresult = function(e){
            var interim = "";
            for(var i = e.resultIndex; i < e.results.length; i++){
              var r = e.results[i];
              if(r.isFinal) onF({ text: r[0].transcript.trim() });
              else interim += r[0].transcript;
            }
            onP({ text: interim.trim() });
          };
          rec.onerror = function(e){
            var code = (e.error === "not-allowed" || e.error === "service-not-allowed") ? "not_granted" : (e.error || "error");
            if(!started) reject(fail(code, "마이크를 쓸 수 없어요."));
          };
          rec.onend = function(){ onS({ state: "idle", reason: "stopped" }); };
          try{ rec.start(); }catch(e){ reject(fail("unavailable", "음성 인식을 시작하지 못했어요.")); }
        });
      },
      stop: function(){ try{ if(rec) rec.stop(); }catch(e){} return Promise.resolve(); }
    };
  }

  var downloads = {
    save: async function(req){
      var blob = req.data instanceof Blob ? req.data : new Blob([req.data]);
      var file = new File([blob], req.filename, { type: blob.type || "application/octet-stream" });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{ await navigator.share({ files: [file] }); return { status: "saved" }; }
        catch(e){ if(e && e.name === "AbortError") throw fail("cancelled", "취소했어요."); }
      }
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = req.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
      return { status: "saved" };
    }
  };

  var dictation = makeDictation();
  var table = { sample: sample, dictation: dictation, downloads: downloads };
  window.__WEB__ = { hasKey: function(){ return !!getKey(); }, setKey: setKey };
  window.claude = {
    use: function(name){ return Promise.resolve(Object.prototype.hasOwnProperty.call(table, name) ? table[name] : null); }
  };
})();
