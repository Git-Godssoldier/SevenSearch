import { Step } from '../mastra';

export interface SearchProviderFactory {
  createStep(config: Record<string, any>): Step;
  getName(): string;
  getDefaultConfig(): Record<string, any>;
}

export class ProviderRegistry {
  private providers: Map<string, SearchProviderFactory> = new Map();

  registerProvider(factory: SearchProviderFactory): void {
    this.providers.set(factory.getName(), factory);
  }

  getProvider(name: string): SearchProviderFactory | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): SearchProviderFactory[] {
    return Array.from(this.providers.values());
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();
