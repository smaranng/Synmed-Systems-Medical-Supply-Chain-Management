import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/environment';
import { typeDefs } from './schema/typeDefs';
import { resolvers } from './schema/resolvers';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import database from './config/database';
import redisClient from './config/redis';
import logger from './utils/logger';

async function startServer() {
  const app = express();

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(apiLimiter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Initialize Apollo Server
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      // Extract user from JWT token if present
      const token = req.headers.authorization?.split(' ')[1];
      let user = null;

      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          user = jwt.verify(token, config.jwt.secret);
        } catch (error) {
          // Token invalid or expired
        }
      }

      return { user };
    },
    formatError: (error) => {
      logger.error('GraphQL Error:', error);
      return error;
    },
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({ app, path: '/graphql' });

  // Error handling
  app.use(errorHandler);

  // Initialize connections
  try {
    await database.connect(config.mongodb.uri, config.mongodb.userDb);
    await redisClient.connect(config.redis.host, config.redis.port, config.redis.password);
  } catch (error) {
    logger.error('Failed to initialize connections:', error);
    process.exit(1);
  }

  // Start server
  app.listen(config.port, () => {
    logger.info(`🚀 API Gateway running on http://localhost:${config.port}`);
    logger.info(`📊 GraphQL endpoint: http://localhost:${config.port}/graphql`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await database.disconnect();
    await redisClient.disconnect();
    process.exit(0);
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
