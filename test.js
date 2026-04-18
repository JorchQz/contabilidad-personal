const puppeteer = require('puppeteer-core');

(async () => {
  const executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  
  const browser = await puppeteer.launch({
    executablePath,
    headless: "new"
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log("Navigating to localhost...");
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
  
  // Wait for the login screen to render
  await page.waitForSelector('#tab-registro', { visible: true, timeout: 5000 });
  
  console.log("Switching to register tab...");
  await page.click('#tab-registro');
  
  console.log("Filling form...");
  await page.type('#reg-nombre', 'Test User');
  await page.type('#reg-email', `test${Date.now()}@example.com`);
  await page.type('#reg-password', 'password123');
  await page.type('#reg-password2', 'password123');
  
  console.log("Clicking Crear cuenta...");
  await page.click('#btn-registro');
  
  // wait for step 1 of onboarding
  await page.waitForSelector('.income-option', { visible: true, timeout: 5000 });
  console.log("Step 1 loaded");
  await page.click('.income-option'); // select first option
  await page.click('.btn-primary'); // Continuar
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshot_step2.png' });
  
  console.log("Done.");
  await browser.close();
})();
