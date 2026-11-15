/* GitHub Pages용 런타임: claude.ai 아티팩트의 window.claude.use()를 브라우저 기능으로 대신한다.
   - 노트 생성(sample) 없음: 노트는 Claude 대화에서 만들어 lessons.js로 내장 (API 요금 없음)
   - dictation: Safari/Chrome 내장 음성 인식 (webkitSpeechRecognition)
   - downloads: iOS 공유 시트(파일에 저장·프린트) 또는 다운로드
   - 그 밖의 기능(db, user, assets, tts)은 null → 앱이 이 기기 저장소로 동작 */
(function(){
  "use strict";
  function fail(code, message){ var e = new Error(message || code); e.code = code; return e; }

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
  var table = { dictation: dictation, downloads: downloads };
  window.__WEB__ = {};
  window.claude = {
    use: function(name){ return Promise.resolve(Object.prototype.hasOwnProperty.call(table, name) ? table[name] : null); }
  };
})();
