import { createClient, RedisClientType } from 'redis';

class RedisClient {
  private client: RedisClientType | null = null;

  async connect(host: string, port: number, password?: string): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host,
          port,
        },
        password,
      });

      this.client.on('error', (err) => console.error('Redis Client Error:', err));
      this.client.on('connect', () => console.log('✅ Redis connected'));
      this.client.on('disconnect', () => console.log('Redis disconnected'));

      await this.client.connect();
    } catch (error) {
      console.error('❌ Redis connection error:', error);
      throw error;
    }
  }

  getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis not initialized. Call connect() first.');
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    const client = this.getClient();
    if (expirySeconds) {
      await client.setEx(key, expirySeconds, value);
    } else {
      await client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return await client.get(key);
  }

  async del(key: string): Promise<void> {
    const client = this.getClient();
    await client.del(key);
  }
}

export default new RedisClient();
