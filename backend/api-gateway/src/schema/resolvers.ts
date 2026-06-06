import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/environment';
import { AuthenticationError, ValidationError } from '../utils/errors';

export const resolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new AuthenticationError();
      }
      return context.user;
    },

    searchMedicines: async (_: any, args: any) => {
      // Mock data for now
      return [
        {
          id: '1',
          name: 'Paracetamol 500mg',
          genericName: 'Acetaminophen',
          manufacturer: 'PharmaCo',
          category: 'TABLET',
          price: 25.50,
          requiresPrescription: false,
        },
      ];
    },

    getMyOrders: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new AuthenticationError();
      }
      // Mock data
      return [];
    },
  },

  Mutation: {
    login: async (_: any, args: { email: string; password: string; role: string }) => {
      // Mock authentication for now
      const mockUser = {
        id: '1',
        email: args.email,
        role: args.role,
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        isVerified: true,
        createdAt: new Date().toISOString(),
      };

      const accessToken = jwt.sign(
        { id: mockUser.id, email: mockUser.email, role: mockUser.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry }
      );

      const refreshToken = jwt.sign(
        { id: mockUser.id },
        config.jwt.secret,
        { expiresIn: config.jwt.refreshExpiry }
      );

      return {
        user: mockUser,
        accessToken,
        refreshToken,
      };
    },

    register: async (_: any, args: any) => {
      // Mock registration
      const mockUser = {
        id: '1',
        email: args.email,
        role: args.role,
        firstName: args.firstName,
        lastName: args.lastName,
        phone: args.phone,
        isActive: true,
        isVerified: false,
        createdAt: new Date().toISOString(),
      };

      const accessToken = jwt.sign(
        { id: mockUser.id, email: mockUser.email, role: mockUser.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry }
      );

      const refreshToken = jwt.sign(
        { id: mockUser.id },
        config.jwt.secret,
        { expiresIn: config.jwt.refreshExpiry }
      );

      return {
        user: mockUser,
        accessToken,
        refreshToken,
      };
    },

    logout: async () => {
      return true;
    },

    createOrder: async (_: any, args: any, context: any) => {
      if (!context.user) {
        throw new AuthenticationError();
      }

      // Mock order creation
      return {
        id: '1',
        orderNumber: 'ORD-2024-001',
        customerId: context.user.id,
        pharmacyId: args.pharmacyId,
        status: 'PENDING',
        totalAmount: 100.0,
        createdAt: new Date().toISOString(),
      };
    },
  },
};
