const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const lucideSrc = fs.readFileSync('./js/lucide.min.js', 'utf8');

const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
  <body>
    <button id="btn"><i data-lucide="eye"></i><span>Text</span></button>
    <script>${lucideSrc}</script>
    <script>
      lucide.createIcons();
      lucide.createIcons();
      lucide.createIcons();
    </script>
  </body>
  </html>
`, { runScripts: "dangerously" });

console.log(dom.window.document.getElementById('btn').innerHTML);
