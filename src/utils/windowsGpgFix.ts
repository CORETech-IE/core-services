// utils/windowsGpgFix.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Fix GPG-agent issues on Windows for SOPS
 * This addresses the common gpg-agent connection problems on Windows
 */
export class WindowsGpgFix {
  
  // Updated fingerprint for new GPG key
  private static readonly REQUIRED_GPG_KEY = 'EC5A8F24358F986C983BA5F384F09B1D810A6590';
  
  /**
   * Setup GPG environment for Windows
   */
  static setupGpgEnvironment(): { gnupgHome: string; env: Record<string, string> } {
    const gnupgHome = process.env.GNUPGHOME || path.join(os.homedir(), '.gnupg');
    
    console.log(`🔧 Setting up GPG environment for Windows...`);
    console.log(`📁 GNUPG Home: ${gnupgHome}`);
    
    // Kill any existing gpg-agent processes
    try {
      execSync('taskkill /f /im gpg-agent.exe 2>nul', { stdio: 'pipe' });
      console.log('🔪 Killed existing gpg-agent processes');
    } catch {
      // No existing processes, continue
    }
    
    // Set up Windows-specific environment
    const env = {
      ...process.env,
      GNUPGHOME: gnupgHome,
      GPG_TTY: 'CON',
      // Disable problematic keyboxd
      GPG_AGENT_INFO: '',
      // Force use of Windows paths
      PATH: process.env.PATH || ''
    };
    
    return { gnupgHome, env };
  }
  
  /**
   * Test GPG functionality
   */
  static testGpg(): boolean {
    try {
      console.log('🧪 Testing GPG functionality...');
      
      const { env } = this.setupGpgEnvironment();
      
      // Test 1: List secret keys
      const secretKeys = execSync('gpg --list-secret-keys --with-colons', { 
        encoding: 'utf8',
        env,
        stdio: 'pipe'
      });
      
      // Updated to use new GPG key fingerprint
      if (!secretKeys.includes(this.REQUIRED_GPG_KEY)) {
        console.error(`❌ Required GPG key not found: ${this.REQUIRED_GPG_KEY}`);
        console.log('Available keys:');
        console.log(secretKeys);
        return false;
      }
      
      console.log(`✅ GPG key found: ${this.REQUIRED_GPG_KEY}`);
      
      // Test 2: Test gpg-agent
      try {
        execSync('gpg-connect-agent "GET_VERSION" /bye', { 
          env,
          stdio: 'pipe',
          timeout: 5000
        });
        console.log('✅ gpg-agent is working');
      } catch {
        console.log('⚠️ gpg-agent connection issue, will try to fix');
        this.fixGpgAgent(env);
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ GPG test failed:', (error as Error).message);
      return false;
    }
  }
  
  /**
   * Fix gpg-agent issues
   */
  private static fixGpgAgent(env: Record<string, string>): void {
    try {
      console.log('🔧 Attempting to fix gpg-agent...');
      
      // Kill any hanging agents
      execSync('taskkill /f /im gpg-agent.exe 2>nul', { stdio: 'pipe' });
      
      // Start fresh gpg-agent
      execSync('gpg-agent --daemon --use-standard-socket', { 
        env,
        stdio: 'pipe',
        timeout: 5000
      });
      
      console.log('✅ gpg-agent restarted');
      
    } catch (error) {
      console.warn('⚠️ Could not fix gpg-agent:', (error as Error).message);
    }
  }
  
  /**
   * Decrypt SOPS file with Windows-specific approach
   */
  static decryptSopsFile(sopsPath: string, secretsPath: string, passphrase: string): string {
    const { gnupgHome, env } = this.setupGpgEnvironment();
    
    console.log('🔐 Attempting SOPS decryption with Windows-optimized approach...');
    
    // Method 1: Direct passphrase via stdin
    try {
      console.log('🔐 Method 1: Direct passphrase input');
      
      const result = execSync(`echo ${passphrase}| "${sopsPath}" -d --output-type json "${secretsPath}"`, {
        encoding: 'utf8',
        env: {
          ...env,
          GPG_BATCH: '1',
          GPG_USE_AGENT: '0' // Disable agent for this operation
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
        shell: 'cmd.exe'
      });
      
      console.log('✅ SOPS decryption successful (Method 1)');
      return result;
      
    } catch (error1) {
      console.log('⚠️ Method 1 failed, trying Method 2...');
      
      // Method 2: Use pinentry-mode loopback
      try {
        console.log('🔐 Method 2: Pinentry loopback mode');
        
        const result = execSync(`"${sopsPath}" -d --output-type json "${secretsPath}"`, {
          encoding: 'utf8',
          env: {
            ...env,
            GPG_PASSPHRASE: passphrase,
            GPG_BATCH: '1'
          },
          input: passphrase,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000
        });
        
        console.log('✅ SOPS decryption successful (Method 2)');
        return result;
        
      } catch (error2) {
        console.log('⚠️ Method 2 failed, trying Method 3...');
        
        // Method 3: Temporary script with passphrase
        try {
          console.log('🔐 Method 3: Temporary script approach');
          
          const tempScript = path.join(os.tmpdir(), `decrypt-${Date.now()}.cmd`);
          const scriptContent = `@echo off
set GNUPGHOME=${gnupgHome}
set GPG_BATCH=1
set GPG_USE_AGENT=0
echo ${passphrase}| "${sopsPath}" -d --output-type json "${secretsPath}"`;
          
          fs.writeFileSync(tempScript, scriptContent);
          
          const result = execSync(`"${tempScript}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000
          });
          
          // Clean up immediately
          fs.unlinkSync(tempScript);
          
          console.log('✅ SOPS decryption successful (Method 3)');
          return result;
          
        } catch (error3) {
          // Clean up script if it exists
          const tempScript = path.join(os.tmpdir(), `decrypt-${Date.now()}.cmd`);
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript);
          }
          
          console.error('❌ All SOPS decryption methods failed:');
          console.error('   Method 1 (stdin):', (error1 as Error).message.substring(0, 200));
          console.error('   Method 2 (loopback):', (error2 as Error).message.substring(0, 200));
          console.error('   Method 3 (script):', (error3 as Error).message.substring(0, 200));
          
          throw new Error('SOPS decryption failed with all methods. Check GPG setup and passphrase.');
        }
      }
    }
  }
}

// Export helper function for envConfig.ts
export function decryptSopsWithWindowsFix(sopsPath: string, secretsPath: string, passphrase: string): string {
  // Setup GPG environment first
  if (!WindowsGpgFix.testGpg()) {
    throw new Error('GPG environment is not properly set up');
  }
  
  // Decrypt using Windows-optimized methods
  return WindowsGpgFix.decryptSopsFile(sopsPath, secretsPath, passphrase);
}