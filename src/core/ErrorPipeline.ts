import { EventBus } from './EventBus';

export interface GameError {
  id: string;
  code: string;
  message: string;
  timestamp: number;
  details?: any;
}

export class ErrorPipeline {
  private static instance: ErrorPipeline;
  private errorLog: GameError[] = [];
  private eventBus = EventBus.getInstance();

  public static getInstance(): ErrorPipeline {
    if (!ErrorPipeline.instance) {
      ErrorPipeline.instance = new ErrorPipeline();
    }
    return ErrorPipeline.instance;
  }

  public handleError(code: string, message: string, details?: any): GameError {
    const error: GameError = {
      id: Math.random().toString(36).substring(2, 9),
      code,
      message,
      timestamp: Date.now(),
      details
    };

    this.errorLog.push(error);
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    console.error(`[GameError] ${code}: ${message}`, details || '');
    this.eventBus.emit('error:occurred', error);
    return error;
  }

  public getErrors(): GameError[] {
    return [...this.errorLog];
  }

  public clearErrors(): void {
    this.errorLog = [];
    this.eventBus.emit('error:cleared');
  }
}
