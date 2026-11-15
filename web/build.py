"""index.html(claude.ai 아티팩트 버전) → docs/ (GitHub Pages 버전) 생성.
사용: python3 web/build.py"""
import pathlib, re, shutil

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "index.html").read_text(encoding="utf-8")
out = root / "docs"
out.mkdir(exist_ok=True)

title = re.search(r"<title>.*?</title>", src).group(0)
links = re.findall(r'<link [^>]*>\n?', src)
body = src.replace(title, "").replace('<meta name="claude:viewport-fit-sides" content="cover">', "")
for l in links:
    body = body.replace(l, "", 1)

head = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{title}
<meta name="theme-color" content="#E9EDF0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="영어노트">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-192.png">
{''.join(links).strip()}
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
<script src="shim.js"></script>
</head>
<body>
"""
(out / "index.html").write_text(head + body.strip() + "\n</body>\n</html>\n", encoding="utf-8")
for f in ["shim.js", "anthropic-sdk.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"]:
    shutil.copy(root / "web" / f, out / f)
(out / ".nojekyll").write_text("")
print("built", out / "index.html")
