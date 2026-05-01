const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pages = ['/', '/dashboard', '/login', '/register', '/app/posts/feeds', '/app/keys'];
  
  const results = {
    consoleErrors: [],
    pageErrors: [],
    networkErrors: [],
    visibleErrors: []
  };

  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push({
        url: page.url(),
        message: msg.text(),
        location: msg.location()
      });
    }
  });

  page.on('pageerror', error => {
    results.pageErrors.push({
      url: page.url(),
      message: error.message,
      stack: error.stack
    });
  });

  page.on('response', response => {
    if (!response.ok() && response.status() !== 304) {
      results.networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });

  for (const path of pages) {
    console.log(`\n=== Checking ${path} ===`);
    try {
      const response = await page.goto(`http://localhost:3000${path}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      console.log(`Status: ${response.status()} ${response.statusText()}`);
      
      await page.waitForTimeout(3000);
      
      const errorSelectors = ['.error', '#error', '[class*="error"]', '[class*="Error"]', '.alert-error', '.text-red', '.bg-red', '[role="alert"]', 'pre'];
      for (const selector of errorSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const el of elements) {
            const text = await el.textContent();
            const isVisible = await el.isVisible();
            if (isVisible && text && text.trim().length > 0) {
              results.visibleErrors.push({
                page: path,
                selector,
                text: text.trim().substring(0, 500)
              });
            }
          }
        } catch (e) {}
      }
      
      const title = await page.title();
      const bodyText = await page.textContent('body').catch(() => '');
      console.log(`Title: ${title}`);
      if (bodyText.toLowerCase().includes('error')) {
        console.log(`  [WARNING] Body contains "error"`);
        results.visibleErrors.push({ page: path, selector: 'body', text: bodyText.trim().substring(0, 300) });
      }
      
    } catch (error) {
      console.log(`Failed to load ${path}: ${error.message}`);
      results.pageErrors.push({
        url: path,
        message: error.message
      });
    }
  }

  await browser.close();

  console.log('\n\n=== SUMMARY ===');
  console.log('\nConsole Errors:');
  if (results.consoleErrors.length === 0) { console.log('  None'); }
  else { results.consoleErrors.forEach((e, i) => { console.log(`  ${i+1}. [${e.url}] ${e.message}`); }); }

  console.log('\nPage Errors (Exceptions):');
  if (results.pageErrors.length === 0) { console.log('  None'); }
  else { results.pageErrors.forEach((e, i) => { console.log(`  ${i+1}. [${e.url}] ${e.message}`); }); }

  console.log('\nNetwork Errors (Failed Requests):');
  if (results.networkErrors.length === 0) { console.log('  None'); }
  else { 
    const filtered = results.networkErrors.filter(e => !e.url.includes('_nuxt') && !e.url.includes('hot') && !e.url.includes('webpack'));
    filtered.forEach((e, i) => { console.log(`  ${i+1}. [${e.status}] ${e.url}`); }); 
  }

  console.log('\nVisible Error Messages:');
  if (results.visibleErrors.length === 0) { console.log('  None'); }
  else { 
    results.visibleErrors.forEach((e, i) => { console.log(`  ${i+1}. [${e.page}] ${e.text}`); }); 
  }

  const fs = require('fs');
  fs.writeFileSync('/home/leamsigc/Documents/learn/production-example-nuxt-monorepo/error-report.json', JSON.stringify(results, null, 2));
  console.log('\nFull report saved to error-report.json');
})();
