import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import os from 'os';

const MAX_BROWSERS = 4;
const browsers: Browser[] = [];
const availablePages: Page[] = [];

function getExecutablePath(): string | undefined {
  const platform = os.platform();
  if (platform === 'linux') {
    const chromePath = '/usr/bin/google-chrome';
    if (fs.existsSync(chromePath)) return chromePath;
  }
  return undefined;
}

export async function initializeBrowserPool() {
  for (let i = 0; i < MAX_BROWSERS; i++) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: getExecutablePath(),
    });
    browsers.push(browser);
    // No creamos páginas aún. Las pediremos dinámicamente.
  }
  console.log(`[core-services] Browser pool initialized with ${MAX_BROWSERS} browsers.`);
}

export async function acquirePage(): Promise<Page> {
  if (availablePages.length > 0) {
    return availablePages.pop()!;
  }

  // Si no hay páginas, crea una nueva en el primer browser disponible
  const browser = browsers[Math.floor(Math.random() * browsers.length)];
  return await browser.newPage();
}

export async function releasePage(page: Page) {
  try {
    await page.goto('about:blank'); // Limpia el contenido
    availablePages.push(page);
  } catch {
    // Si falla, se destruye y no se guarda
    await page.close();
  }
}

export async function closeAllBrowsers() {
  for (const browser of browsers) {
    await browser.close();
  }
}
