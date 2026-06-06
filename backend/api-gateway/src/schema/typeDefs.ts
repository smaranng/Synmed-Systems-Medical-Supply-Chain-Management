import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  # User Types
  enum UserRole {
    CUSTOMER
    PHARMACY
    distributor
    ADMIN
  }

  type User {
    id: ID!
    email: String!
    role: UserRole!
    firstName: String!
    lastName: String!
    phone: String
    isActive: Boolean!
    isVerified: Boolean!
    createdAt: String!
  }

  type AuthPayload {
    user: User!
    accessToken: String!
    refreshToken: String!
  }

  # Medicine Types
  enum MedicineCategory {
    TABLET
    CAPSULE
    SYRUP
    INJECTION
    CREAM
    DROPS
  }

  type Medicine {
    id: ID!
    name: String!
    genericName: String
    manufacturer: String!
    category: MedicineCategory!
    price: Float!
    requiresPrescription: Boolean!
  }

  # Order Types
  enum OrderStatus {
    PENDING
    CONFIRMED
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED
  }

  type Order {
    id: ID!
    orderNumber: String!
    customerId: ID
    pharmacyId: ID!
    status: OrderStatus!
    totalAmount: Float!
    createdAt: String!
  }

  # Queries
  type Query {
    # User queries
    me: User
    getUser(id: ID!): User

    # Medicine queries
    searchMedicines(keyword: String, category: MedicineCategory): [Medicine!]!
    getMedicine(id: ID!): Medicine

    # Order queries
    getMyOrders: [Order!]!
    getOrder(id: ID!): Order
  }

  # Mutations
  type Mutation {
    # Authentication
    login(email: String!, password: String!, role: UserRole!): AuthPayload!
    register(
      email: String!
      password: String!
      firstName: String!
      lastName: String!
      phone: String
      role: UserRole!
    ): AuthPayload!
    logout: Boolean!

    # Orders
    createOrder(pharmacyId: ID!, items: [OrderItemInput!]!): Order!
  }

  # Input Types
  input OrderItemInput {
    medicineId: ID!
    quantity: Int!
    unitPrice: Float!
  }

  # Subscriptions
  type Subscription {
    orderUpdated(orderId: ID!): Order!
  }
`;
