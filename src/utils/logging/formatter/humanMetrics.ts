/**
 * 🧠 CORE-SERVICES: Human-Friendly Metrics Formatter
 * 
 * Makes system metrics readable for humans instead of machines
 * Because nobody wants to calculate 296488960 bytes in their head
 */

import { SystemMetrics } from '../core/types';

/**
 * Convert bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Convert microseconds to milliseconds with proper formatting
 */
function formatCpuTime(microseconds: number): string {
  const milliseconds = microseconds / 1000;
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(1)}ms`;
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

/**
 * Format CPU percentage with proper rounding
 */
function formatCpuPercent(percent?: number): string {
  if (percent === undefined) return 'N/A';
  if (percent < 0.01) return '<0.01%';
  if (percent > 99.99) return '>99.99%';
  return `${percent.toFixed(2)}%`;
}

/**
 * Create human-readable metrics summary
 */
export function createHumanMetricsSummary(metrics: SystemMetrics): string {
  const memUsed = formatBytes(metrics.memory.heapUsed);
  const memTotal = formatBytes(metrics.memory.heapTotal);
  const memRss = formatBytes(metrics.memory.rss);
  const cpuPercent = formatCpuPercent(metrics.cpu.cpuUsagePercent);
  const uptime = metrics.process.uptimeFormatted;
  
  let summary = `🖥️  Memory: ${memUsed}/${memTotal} (RSS: ${memRss}) | ⚡ CPU: ${cpuPercent} | ⏱️  Uptime: ${uptime}`;
  
  if (metrics.system) {
    const totalSysMem = formatBytes(metrics.system.totalMemory || 0);
    const freeSysMem = formatBytes(metrics.system.freeMemory || 0);
    const usedSysMem = formatBytes((metrics.system.totalMemory || 0) - (metrics.system.freeMemory || 0));
    summary += ` | 🏠 System: ${usedSysMem}/${totalSysMem} (${freeSysMem} free)`;
  }
  
  return summary;
}

/**
 * Create detailed human-readable metrics
 */
export function createDetailedHumanMetrics(metrics: SystemMetrics): any {
  return {
    timestamp: metrics.timestamp,
    memory: {
      heap_used: formatBytes(metrics.memory.heapUsed),
      heap_total: formatBytes(metrics.memory.heapTotal),
      rss: formatBytes(metrics.memory.rss),
      external: formatBytes(metrics.memory.external),
      array_buffers: formatBytes(metrics.memory.arrayBuffers)
    },
    cpu: {
      usage_percent: formatCpuPercent(metrics.cpu.cpuUsagePercent),
      user_time: formatCpuTime(metrics.cpu.userCPUTime),
      system_time: formatCpuTime(metrics.cpu.systemCPUTime)
    },
    process: {
      pid: metrics.process.pid,
      uptime: metrics.process.uptimeFormatted,
      platform: metrics.process.platform,
      node_version: metrics.process.nodeVersion
    },
    ...(metrics.system && {
      system: {
        total_memory: formatBytes(metrics.system.totalMemory || 0),
        free_memory: formatBytes(metrics.system.freeMemory || 0),
        used_memory: formatBytes((metrics.system.totalMemory || 0) - (metrics.system.freeMemory || 0)),
        cpu_cores: metrics.system.cpuCount || 'N/A'
      }
    })
  };
}

/**
 * Create ultra-compact metrics for logs
 */
export function createCompactMetrics(metrics: SystemMetrics): string {
  const memMB = Math.round(metrics.memory.heapUsed / 1024 / 1024);
  const cpuPercent = metrics.cpu.cpuUsagePercent?.toFixed(1) || 'N/A';
  const uptime = metrics.process.uptimeFormatted;
  
  return `${memMB}MB | ${cpuPercent}% | ${uptime}`;
}

/**
 * Format for console output with emojis and colors
 */
export function createConsoleMetrics(metrics: SystemMetrics): string {
  const memUsed = formatBytes(metrics.memory.heapUsed);
  const memTotal = formatBytes(metrics.memory.heapTotal);
  const cpuPercent = metrics.cpu.cpuUsagePercent || 0;
  const uptime = metrics.process.uptimeFormatted;
  
  // Add emoji indicators based on usage
  let memEmoji = '💚'; // Green
  const memUsage = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
  if (memUsage > 80) memEmoji = '🔴'; // Red
  else if (memUsage > 60) memEmoji = '🟡'; // Yellow
  
  let cpuEmoji = '💚'; // Green  
  if (cpuPercent > 80) cpuEmoji = '🔴'; // Red
  else if (cpuPercent > 50) cpuEmoji = '🟡'; // Yellow
  
  return `${memEmoji} Memory: ${memUsed}/${memTotal} (${memUsage.toFixed(1)}%) | ${cpuEmoji} CPU: ${formatCpuPercent(cpuPercent)} | ⏰ Uptime: ${uptime}`;
}