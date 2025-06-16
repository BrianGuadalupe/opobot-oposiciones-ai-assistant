interface SecurityEvent {
  type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'suspicious_activity' | 'rate_limit_hit';
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  details?: Record<string, any>;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 1000;

  logEvent(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Add to local storage for basic tracking
    this.events.push(securityEvent);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // In production, send to security monitoring service
    this.sendToMonitoringService(securityEvent);
  }

  private sendToMonitoringService(event: SecurityEvent) {
    // In a real implementation, send to your security monitoring service
    console.log('Security Event:', {
      type: event.type,
      timestamp: new Date(event.timestamp).toISOString(),
      userId: event.userId ? `${event.userId.substring(0, 8)}***` : undefined,
      email: event.email ? `${event.email.substring(0, 3)}***` : undefined,
    });
  }

  getRecentEvents(minutes: number = 60): SecurityEvent[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.events.filter(event => event.timestamp > cutoff);
  }

  detectSuspiciousActivity(): boolean {
    const recentEvents = this.getRecentEvents(15);
    const failedAttempts = recentEvents.filter(e => e.type === 'auth_failure').length;
    
    // Flag suspicious activity if more than 5 failed attempts in 15 minutes
    return failedAttempts > 5;
  }
}

export const securityMonitor = new SecurityMonitor();

// Helper functions for common security events
export const logAuthAttempt = (email: string) => {
  securityMonitor.logEvent({
    type: 'auth_attempt',
    email,
    userAgent: navigator.userAgent,
  });
};

export const logAuthSuccess = (userId: string, email: string) => {
  securityMonitor.logEvent({
    type: 'auth_success',
    userId,
    email,
    userAgent: navigator.userAgent,
  });
};

export const logAuthFailure = (email: string, reason: string) => {
  securityMonitor.logEvent({
    type: 'auth_failure',
    email,
    userAgent: navigator.userAgent,
    details: { reason },
  });
};

export const logRateLimitHit = (key: string) => {
  securityMonitor.logEvent({
    type: 'rate_limit_hit',
    details: { key },
    userAgent: navigator.userAgent,
  });
};
