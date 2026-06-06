// Seed sample data for development

// Sample Medicines
db = db.getSiblingDB('inventory_db');
db.medicines.insertMany([
  {
    _id: 'med_1',
    name: 'Paracetamol 500mg',
    genericName: 'Acetaminophen',
    manufacturer: 'PharmaCo',
    category: 'TABLET',
    dosage: '500mg',
    requiresPrescription: false,
    createdAt: new Date()
  },
  {
    _id: 'med_2',
    name: 'Amoxicillin 250mg',
    genericName: 'Amoxicillin',
    manufacturer: 'MedSupply Ltd',
    category: 'CAPSULE',
    dosage: '250mg',
    requiresPrescription: true,
    createdAt: new Date()
  },
  {
    _id: 'med_3',
    name: 'Ibuprofen 400mg',
    genericName: 'Ibuprofen',
    manufacturer: 'HealthCare Inc',
    category: 'TABLET',
    dosage: '400mg',
    requiresPrescription: false,
    createdAt: new Date()
  }
]);

// Sample Users
db = db.getSiblingDB('user_db');
db.users.insertMany([
  {
    _id: 'user_customer_1',
    email: 'customer@example.com',
    passwordHash: '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', // password: password123
    role: 'CUSTOMER',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    isActive: true,
    isVerified: true,
    createdAt: new Date()
  },
  {
    _id: 'user_pharmacy_1',
    email: 'pharmacy@example.com',
    passwordHash: '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa',
    role: 'PHARMACY',
    firstName: 'City',
    lastName: 'Pharmacy',
    organizationName: 'City Pharmacy',
    licenseNumber: 'PH-2024-001',
    isActive: true,
    isVerified: true,
    createdAt: new Date()
  },
  {
    _id: 'user_distributor_1',
    email: 'distributor@example.com',
    passwordHash: '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa',
    role: 'distributor',
    firstName: 'Medical',
    lastName: 'Supplies',
    organizationName: 'MedSupply Co',
    licenseNumber: 'VEN-2024-001',
    isActive: true,
    isVerified: true,
    createdAt: new Date()
  },
  {
    _id: 'user_admin_1',
    email: 'admin@example.com',
    passwordHash: '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa',
    role: 'ADMIN',
    firstName: 'System',
    lastName: 'Admin',
    isActive: true,
    isVerified: true,
    createdAt: new Date()
  }
]);

print('✅ Sample data seeded successfully');
print('');
print('📝 Test Credentials:');
print('   Customer: customer@example.com / password123');
print('   Pharmacy: pharmacy@example.com / password123');
print('   distributor:   distributor@example.com / password123');
print('   Admin:    admin@example.com / password123');
