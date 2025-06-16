// src/services/config/FileWatcher.ts

import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logging';
import { EventEmitter } from 'events';

export interface WatchedFile {
  name: string;           // Identificador (e.g., 'config', 'secrets')
  path: string;           // Ruta completa al archivo
  hash?: string;          // Hash actual
  lastChecked?: Date;     // Última vez que se verificó
  decrypt?: boolean;      // ¿Necesita desencriptación? (para futuro)
}

export interface FileWatcherConfig {
  intervalMinutes: number;
  files: WatchedFile[];
  onFileChanged?: (file: WatchedFile, oldHash: string, newHash: string) => Promise<void>;
}

export class FileWatcher extends EventEmitter {
  private config: FileWatcherConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private fileStates: Map<string, WatchedFile> = new Map();
  
  constructor(config: FileWatcherConfig) {
    super();
    this.config = config;
    
    // Inicializar el estado de cada archivo
    config.files.forEach(file => {
      this.fileStates.set(file.name, { ...file });
    });
  }
  
  /**
   * Inicia el watching de archivos
   */
  async start(): Promise<void> {
    logger.system('Starting FileWatcher', {
      interval_minutes: this.config.intervalMinutes,
      watched_files: this.config.files.map(f => f.name),
      file_count: this.config.files.length
    });
    
    // Hash inicial de todos los archivos
    await this.checkAllFiles(true);
    
    // Configurar el intervalo
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.checkAllFiles(false).catch(error => {
        logger.error('FileWatcher check failed', {
          error: error.message
        });
      });
    }, intervalMs);
    
    logger.system('FileWatcher started successfully', {
      next_check_in_minutes: this.config.intervalMinutes
    });
  }
  
  /**
   * Detiene el watching
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.system('FileWatcher stopped');
    }
  }
  
  /**
   * Verifica todos los archivos configurados
   */
  private async checkAllFiles(isInitial: boolean): Promise<void> {
    const checkTime = new Date();
    
    for (const [name, fileState] of this.fileStates) {
      try {
        const newHash = await this.calculateFileHash(fileState);
        const oldHash = fileState.hash;
        
        if (isInitial) {
          // Primera vez, solo guardamos el hash
          fileState.hash = newHash;
          fileState.lastChecked = checkTime;
          
          logger.system(`FileWatcher initial hash calculated`, {
            file: name,
            hash: newHash.substring(0, 16) + '...'
          });
          
        } else if (oldHash !== newHash) {
          // El archivo cambió!
          logger.system(`FileWatcher detected change`, {
            file: name,
            old_hash: oldHash?.substring(0, 16) + '...',
            new_hash: newHash.substring(0, 16) + '...'
          });
          
          // Actualizar el hash ANTES de notificar (evita loops)
          fileState.hash = newHash;
          fileState.lastChecked = checkTime;
          
          // Emitir evento
          this.emit('fileChanged', fileState, oldHash || '', newHash);
          
          // Callback opcional
          if (this.config.onFileChanged) {
            await this.config.onFileChanged(fileState, oldHash || '', newHash);
          }
          
        } else {
          // Sin cambios
          fileState.lastChecked = checkTime;
          
          logger.debug(`FileWatcher no changes detected`, {
            file: name,
            hash: newHash.substring(0, 16) + '...'
          });
        }
        
      } catch (error) {
        logger.error(`FileWatcher error checking file`, {
          file: name,
          error: (error as Error).message
        });
      }
    }
  }
  
  /**
   * Calcula el hash de un archivo
   * Extensible para soportar desencriptación en el futuro
   */
  private async calculateFileHash(file: WatchedFile): Promise<string> {
    let content: Buffer;
    
    if (file.decrypt) {
      // TODO: Para el futuro, aquí iría la lógica de SOPS
      // const decrypted = await decryptSops(file.path);
      // content = Buffer.from(decrypted);
      throw new Error('Decryption not implemented yet');
    } else {
      // Archivo plano, leer directamente
      content = await fs.readFile(file.path);
    }
    
    return createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Obtiene el estado actual de un archivo
   */
  getFileState(name: string): WatchedFile | undefined {
    return this.fileStates.get(name);
  }
  
  /**
   * Fuerza un check inmediato (útil para testing)
   */
  async forceCheck(): Promise<void> {
    logger.system('FileWatcher forced check triggered');
    await this.checkAllFiles(false);
  }
}