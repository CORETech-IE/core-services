// src/config/browserPool.ts
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import os from 'os';
import logger from '../utils/logging';
import { BrowserPoolConfig  } from '../services/serviceContainer'; // O como obtengas el contenedor de servicios

// vars to config del container
let MAX_BROWSERS: number;
let MAX_PAGES_PER_BROWSER: number;
let PAGE_IDLE_TIMEOUT: number;

interface PageInfo {
  page: Page;
  lastUsed: number;
  browser: Browser;
}

const browsers: Browser[] = [];
const availablePages: PageInfo[] = [];
let cleanupInterval: NodeJS.Timeout | null = null;

function getExecutablePath(): string | undefined {
  const platform = os.platform();
  if (platform === 'linux') {
    const chromePath = '/usr/bin/google-chrome';
    if (fs.existsSync(chromePath)) return chromePath;
  }
  return undefined;
}

export async function initializeBrowserPool(config?: BrowserPoolConfig) {

  // Load configuration from environment variables or provided config
  MAX_BROWSERS = config?.maxBrowsers || parseInt(process.env.MAX_BROWSERS || '2');
  MAX_PAGES_PER_BROWSER = config?.maxPagesPerBrowser || parseInt(process.env.MAX_PAGES_PER_BROWSER || '3');
  PAGE_IDLE_TIMEOUT = config?.pageIdleTimeout || parseInt(process.env.PAGE_IDLE_TIMEOUT || '300000');
  
  logger.system('Initializing browser pool', {
    max_browsers: MAX_BROWSERS,
    max_pages_per_browser: MAX_PAGES_PER_BROWSER,
    page_idle_timeout_ms: PAGE_IDLE_TIMEOUT
  });

  // validate configuration
  for (let i = 0; i < MAX_BROWSERS; i++) {
    
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Evita problemas de memoria compartida
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps'
        ],
        executablePath: getExecutablePath(),
      });
      
      browsers.push(browser);
      
      logger.system(`Browser ${i + 1} initialized`, {
        browser_index: i,
        total_browsers: browsers.length
      });
    } catch (error) {
      logger.error(`Failed to initialize browser ${i + 1}`, {
        browser_index: i,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  // Cleanup idle pages periodically
  startPageCleanup();
  
  logger.system('Browser pool initialization completed', {
    browsers_created: browsers.length,
    cleanup_interval_ms: 60000
  });
}

export async function acquirePage(): Promise<Page> {
  const startTime = Date.now();
  
  //Try to acquire a page from the pool
  if (availablePages.length > 0) {
    const pageInfo = availablePages.pop()!;
    pageInfo.lastUsed = Date.now();
    
    logger.pdf('Page acquired from pool', {
      duration_ms: Date.now() - startTime,
      pages_remaining: availablePages.length,
      source: 'pool'
    });
    
    return pageInfo.page;
  }

  // Create a new page if we have not reached the maximum limit
  const totalPages = getTotalActivePages();
  const maxTotalPages = MAX_BROWSERS * MAX_PAGES_PER_BROWSER;
  
  if (totalPages < maxTotalPages) {
    const browser = getLeastLoadedBrowser();
    const page = await browser.newPage();
    
    // Setup default timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    logger.pdf('New page created', {
      duration_ms: Date.now() - startTime,
      total_active_pages: totalPages + 1,
      max_pages: maxTotalPages,
      source: 'new'
    });
    
    return page;
  }

  // if we reach here, it means we have no available pages and reached the max limit
  logger.warn('Page pool exhausted, waiting for available page', {
    total_active_pages: totalPages,
    max_pages: maxTotalPages,
    available_pages: availablePages.length
  });
  
  //wait for an available page
  const maxWaitTime = 30000;
  const pollInterval = 100;
  let waitTime = 0;
  
  while (waitTime < maxWaitTime) {
    if (availablePages.length > 0) {
      const pageInfo = availablePages.pop()!;
      pageInfo.lastUsed = Date.now();
      
      logger.pdf('Page acquired after waiting', {
        duration_ms: Date.now() - startTime,
        wait_time_ms: waitTime,
        source: 'pool_after_wait'
      });
      
      return pageInfo.page;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    waitTime += pollInterval;
  }
  
  // if there are still no available pages after waiting, create a new one
  logger.error('Page pool timeout, forcing new page creation', {
    wait_time_ms: waitTime,
    total_active_pages: getTotalActivePages()
  });
  
  const browser = getLeastLoadedBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);
  
  return page;
}

export async function releasePage(page: Page) {
  const startTime = Date.now();
  
  try {
    // Clean up the page before releasing it
    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 });
    
    // CLean up cookies
    await page.evaluate(() => {
      // Clean up session storage
      if (typeof Storage !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
    });
    
    // Find the browser instance for this page
    const browser = page.browser();
    
    // Add a new entry to the available pages pool
    if (availablePages.length < MAX_PAGES_PER_BROWSER * MAX_BROWSERS) {
      availablePages.push({
        page,
        lastUsed: Date.now(),
        browser
      });
      
      logger.pdf('Page released to pool', {
        duration_ms: Date.now() - startTime,
        available_pages: availablePages.length,
        status: 'pooled'
      });
    } else {
      // If we have reached the maximum number of pages, close the page
      await page.close();
      
      logger.pdf('Page closed (pool full)', {
        duration_ms: Date.now() - startTime,
        available_pages: availablePages.length,
        status: 'closed'
      });
    }
    
  } catch (error) {
    // if cleanup fails, log the error and close the page
    try {
      await page.close();
      logger.warn('Page cleanup failed, page closed', {
        duration_ms: Date.now() - startTime,
        error: (error as Error).message,
        status: 'closed_after_error'
      });
    } catch (closeError) {
      logger.error('Failed to close page after cleanup error', {
        duration_ms: Date.now() - startTime,
        cleanup_error: (error as Error).message,
        close_error: (closeError as Error).message
      });
    }
  }
}

/**
 * Get the least loaded browser from the pool
 * This is a simple round-robin selection for now.
 * In the future, we could implement a more sophisticated load balancing strategy.
 */
function getLeastLoadedBrowser(): Browser {
  if (browsers.length === 0) {
    throw new Error('No browsers available in pool');
  }
  
  // rotate through browsers to balance load
  return browsers[Math.floor(Math.random() * browsers.length)];
}

/**
 * Count total active pages in the pool
 */
function getTotalActivePages(): number {
  // this is a simple count of all pages in the availablePages array
  return availablePages.length;
}

/**
 * Cleanup idle pages periodically
 */
function startPageCleanup() {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(async () => {
    const now = Date.now();
    const pagesToClose: PageInfo[] = [];
    const pagesToKeep: PageInfo[] = [];
    
    // Separate pages into those to close and those to keep
    for (const pageInfo of availablePages) {
      if (now - pageInfo.lastUsed > PAGE_IDLE_TIMEOUT) {
        pagesToClose.push(pageInfo);
      } else {
        pagesToKeep.push(pageInfo);
      }
    }
    
    // Cerrar páginas idle
    if (pagesToClose.length > 0) {
      logger.system('Cleaning up idle pages', {
        pages_to_close: pagesToClose.length,
        pages_to_keep: pagesToKeep.length,
        idle_timeout_ms: PAGE_IDLE_TIMEOUT
      });
      
      for (const pageInfo of pagesToClose) {
        try {
          await pageInfo.page.close();
        } catch (error) {
          logger.warn('Failed to close idle page', {
            error: (error as Error).message
          });
        }
      }
      
      // Update availablePages array
      availablePages.length = 0;
      availablePages.push(...pagesToKeep);
    }
    
  }, 60000); // Cleanup every 60 seconds
}

export async function closeAllBrowsers() {
  logger.system('Closing all browsers', {
    browsers_count: browsers.length,
    available_pages: availablePages.length
  });
  
  // Stop the cleanup interval if it's running
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  
  // CLose all available pages
  for (const pageInfo of availablePages) {
    try {
      await pageInfo.page.close();
    } catch (error) {
      logger.warn('Failed to close page during shutdown', {
        error: (error as Error).message
      });
    }
  }
  availablePages.length = 0;
  
  // CLose all browsers
  for (const browser of browsers) {
    try {
      await browser.close();
    } catch (error) {
      logger.warn('Failed to close browser during shutdown', {
        error: (error as Error).message
      });
    }
  }
  browsers.length = 0;
  
  logger.system('All browsers closed successfully');
}

/**
 * Get statistics about the browser pool
 */
export function getBrowserPoolStats() {
  return {
    browsers: browsers.length,
    availablePages: availablePages.length,
    maxBrowsers: MAX_BROWSERS,
    maxPagesPerBrowser: MAX_PAGES_PER_BROWSER,
    pageIdleTimeout: PAGE_IDLE_TIMEOUT
  };
}