const puppeteer = require('puppeteer-core');

(async () => {
  const executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath, headless: "new" });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
  
  // run lucide multiple times and check if it duplicates elements or paths
  const result = await page.evaluate(() => {
    lucide.createIcons();
    lucide.createIcons();
    lucide.createIcons();
    const btn = document.querySelector('.auth-eye-btn');
    return btn.innerHTML;
  });
  
  console.log('BTN HTML AFTER MULTIPLE CALLS:', result);
  
  await browser.close();
})();
