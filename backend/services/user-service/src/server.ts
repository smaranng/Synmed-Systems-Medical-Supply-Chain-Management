import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

// 🔐 Extend Express Request type to include JWT properties
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      role?: string;
    }
  }
}

const uploadDir = 'uploads/pharmacies';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

type MulterFiles = {
  logo?: Express.Multer.File[];
  license?: Express.Multer.File[];
};

const app = express();
const PORT = process.env.PORT || 4001;
// Add CORS middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true,
}));
app.use(express.json());

// 🔐 JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

// 🔐 Generate JWT Token
const generateToken = (userId: string, role: string) => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

// 🔐 Verify JWT Middleware
const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

let db: any;
const storage = multer.diskStorage({
  destination: 'uploads/pharmacies',
  filename: (req, file, cb) => {
    cb(null, `pharmacy-${Date.now()}${path.extname(file.originalname)}`);
  },
});
app.use('/uploads', express.static('uploads'));

const upload = multer({ storage });
async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  db = client.db('user_db');
  console.log('✅ User Service: MongoDB connected');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'user-service', status: 'ok' });
});

// ====Customer Login endpoint ====
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    const user = await db.collection('users').findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Compare password with hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 🔐 Generate JWT Token
    const token = generateToken(user._id.toString(), user.role);

    // Return user data + token (exclude password)
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        username: user.username,
        phone: user.phone,
        address: user.address,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PHARMACY LOGIN ============
app.post('/auth/pharmacy/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const pharmacy = await db
      .collection('pharmacy_users')
      .findOne({ username });

    if (!pharmacy) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, pharmacy.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 🔐 Generate JWT Token
    const token = generateToken(pharmacy._id.toString(), pharmacy.role);

    res.json({
      token,
      user: {
        id: pharmacy._id.toString(),
        name: pharmacy.name,
        email: pharmacy.email,
        username: pharmacy.username,
        role: pharmacy.role,
        phone: pharmacy.phone,
        address: pharmacy.address,
        licenseNumber: pharmacy.licenseNumber,
        logo: pharmacy.logo || null,
      }
    });
  } catch (error: any) {
    console.error('Pharmacy login error:', error);
    res.status(500).json({ error: error.message });
  }
});
// ============ PHARMACY SETTINGS UPDATE ============
app.put(
  '/pharmacy/:id/settings',
  verifyToken,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'license', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // 🔐 Verify pharmacy can only update their own profile
      if (req.userId !== id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Destructure everything you need from body
      const { username, email, name, address } = req.body; 

      const updates: any = {
        updatedAt: new Date(),
      };

      if (name) updates.name = name;
      if (username) updates.username = username;
      if (email) updates.email = email.toLowerCase();
      if (address) updates.address = address;

      const files = req.files as MulterFiles;
      if (files?.logo?.[0]) {
        updates.logo = `/uploads/pharmacies/${files.logo[0].filename}`;
      }
      if (files?.license?.[0]) {
        updates.licenseCertificate = `/uploads/pharmacies/${files.license[0].filename}`;
      }

      const result = await db
        .collection('pharmacy_users')
        .findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updates },
          { returnDocument: 'after' }
        );

      // FIX: Handle both driver versions (result.value vs result)
      const updatedPharmacy = result.value || result;

      if (!updatedPharmacy || updatedPharmacy.ok === 0) {
        return res.status(404).json({ error: 'Pharmacy not found' });
      }

      // Ensure we send back a clean object with an ID string
      res.json({
        id: updatedPharmacy._id.toString(),
        name: updatedPharmacy.name,
        email: updatedPharmacy.email,
        username: updatedPharmacy.username,
        role: updatedPharmacy.role,
        phone: updatedPharmacy.phone || '',
        address: updatedPharmacy.address || '',
        logo: updatedPharmacy.logo || null,
        licenseCertificate: updatedPharmacy.licenseCertificate || null,
      });

    } catch (err: any) {
      console.error('Settings update error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// === Change Pharmacy Password ===
app.put('/pharmacy/:id/password', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // 🔐 Verify pharmacy can only change their own password
  if (req.userId !== id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const pharmacy = await db.collection('pharmacy_users').findOne({
    _id: new ObjectId(id),
  });

  if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

  const match = await bcrypt.compare(currentPassword, pharmacy.password);
  if (!match) return res.status(401).json({ error: 'Incorrect password' });

  const hashed = await bcrypt.hash(newPassword, 12);

  await db.collection('pharmacy_users').updateOne(
    { _id: new ObjectId(id) },
    { $set: { password: hashed, updatedAt: new Date() } }
  );

  res.json({ success: true });
});


// Get user by ID
app.get('/users/:id', async (req, res) => {
  const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password: _, ...safe } = user;

  res.json({
    id: user._id.toString(), // ✅ THIS FIXES EVERYTHING
    ...safe,
  });
});


// Create Customer user
app.post('/users', async (req, res) => {
  try {
    const { name, email, phone, username, password, role } = req.body;

    // 🔒 Mandatory validation
    if (!name || !email || !username || !phone || !password || !role) {
      return res.status(400).json({
        error: 'name, email, username, phone, role and password are required',
      });
    }

    // 🔁 Check email
    const emailExists = await db.collection('users').findOne({
      email: email.toLowerCase(),
    });
    if (emailExists) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // 🔁 Check username
    const usernameExists = await db.collection('users').findOne({ username });
    if (usernameExists) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    const userData = {
      name,
      email: email.toLowerCase(),
      username,
      phone,
      role: role.toLowerCase(),
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('users').insertOne(userData);
    const { password: _, ...userWithoutPassword } = userData;

    res.status(201).json({
      id: result.insertedId.toString(),
      ...userWithoutPassword,
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message });
  }
});
// ==== CUSTOMER UPDATE PROFILE ====
app.put('/users/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    // 🔐 Verify user can only update their own profile
    if (req.userId !== id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          name: req.body.name,
          username: req.body.username,
          email: req.body.email,
          phone: req.body.phone,
          address: req.body.address,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' } // This ensures you get the NEW data back
    );

    // FIX: Check both result.value (older driver) and result directly (newer driver)
    const updatedUser = result.value || result;

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return the safe data
    res.json({
      id: updatedUser._id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      username: updatedUser.username,
      phone: updatedUser.phone,
      address: updatedUser.address,
      role: updatedUser.role,
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


//== Customer Change Password Section ==
app.put('/users/:id/password', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // 🔐 Verify user can only change their own password
    if (req.userId !== id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Passwords required' });
    }

    const user = await db.collection('users').findOne({
      _id: new ObjectId(id),
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          password: hashed,
          updatedAt: new Date(),
        },
      }
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==== PHARMACY REGISTER ====
app.post(
  '/auth/pharmacy/register',
  upload.single('logo'), // ❗ REQUIRED
  async (req, res) => {

    try {
      const {
        name,
        email,
        username,
        password,
        phone,
        address,
        licenseNumber,
        //latitude,
        //longitude,
        logo,
      } = req.body;
      const logoPath = req.file ? `/uploads/pharmacies/${req.file.filename}` : '';
      // 🔒 Mandatory validation
      if (
        !name ||
        !email ||
        !username ||
        !password ||
        !phone ||
        !address ||
        !licenseNumber
        //isNaN(Number(latitude)) ||
        //isNaN(Number(longitude))
      ) {
        return res.status(400).json({
          error:
            'All fields except logo are required (name, email, username, password, phone, address, licenseNumber)',
        });
      }

      // 🔁 Check email
      const emailExists = await db
        .collection('pharmacy_users')
        .findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      // 🔁 Check username
      const usernameExists = await db
        .collection('pharmacy_users')
        .findOne({ username });
      if (usernameExists) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // 🔁 Check license
      const licenseExists = await db
        .collection('pharmacy_users')
        .findOne({ licenseNumber });
      if (licenseExists) {
        return res.status(409).json({ error: 'License number already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const now = new Date();

      const pharmacyData = {
        name,
        email: email.toLowerCase(),
        username,
        phone,
        address,
        licenseNumber,
        logo: logoPath,
        role: 'pharmacy',
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      };
      // ✅ OPTIONAL location
      //if (latitude && longitude) {
      //pharmacyData.location = {
      //type: 'Point',
      //coordinates: [Number(longitude), Number(latitude)],
      //};
      // }
      const result = await db
        .collection('pharmacy_users')
        .insertOne(pharmacyData);

      const { password: _, ...safeData } = pharmacyData;

      res.status(201).json({
        id: result.insertedId.toString(),
        ...safeData,
      });
    } catch (error: any) {
      console.error('Pharmacy register error:', error);
      res.status(500).json({ error: error.message });
    }
  });


// ==== ADMIN LOGIN ====
app.post('/auth/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await db.collection('admin_users').findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 🔐 Generate JWT Token
    const token = generateToken(admin._id.toString(), admin.role);

    res.json({
      token,
      user: {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        role: admin.role,
        username: admin.username,
        phone: admin.phone || '',
        address: admin.address || '',
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
// ==== ADMIN REGISTER ====
app.post('/auth/admin/register', async (req, res) => {
  try {
    const { name, email, username, phone, password } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({
        error: 'name, email, username and password are required',
      });
    }

    const emailExists = await db
      .collection('admin_users')
      .findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const usernameExists = await db
      .collection('admin_users')
      .findOne({ username });
    if (usernameExists) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    const adminData = {
      name,
      email: email.toLowerCase(),
      username,
      phone: phone || '',
      role: 'admin',
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('admin_users').insertOne(adminData);
    const { password: _, ...adminWithoutPassword } = adminData;

    res.status(201).json({
      id: result.insertedId.toString(),
      ...adminWithoutPassword,
    });
  } catch (error: any) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: error.message });
  }
});
// ==== ADMIN UPDATE PROFILE ====
app.put('/admin/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, username, phone, address } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }

    // 🔐 Verify admin can only update their own profile
    if (req.userId !== id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await db.collection('admin_users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          name,
          email: email?.toLowerCase(),
          username,
          phone: phone || '',
          address: address || '',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    const admin = result.value || result;
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      username: admin.username,
      phone: admin.phone || '',
      address: admin.address || '',
      role: admin.role,
    });
  } catch (err: any) {
    console.error('Admin update error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ==== ADMIN CHANGE PASSWORD ====
app.put('/admin/:id/password', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Passwords required' });
    }

    // 🔐 Verify admin can only change their own password
    if (req.userId !== id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const admin = await db.collection('admin_users').findOne({
      _id: new ObjectId(id),
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const match = await bcrypt.compare(currentPassword, admin.password);
    if (!match) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await db.collection('admin_users').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          password: hashed,
          updatedAt: new Date(),
        },
      }
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Admin password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==== distributor REGISTER ====
app.post('/auth/distributor/register', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      username,
      password,
      companyName,
      licenseNumber,
    } = req.body;

    // ✅ Validation
    if (
      !name ||
      !email ||
      !phone ||
      !address ||
      !username ||
      !password ||
      !companyName ||
      !licenseNumber
    ) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const distributorCollection = db.collection('distributor_users');

    // 🔁 Uniqueness checks
    if (await distributorCollection.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    if (await distributorCollection.findOne({ username })) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    if (await distributorCollection.findOne({ licenseNumber })) {
      return res.status(409).json({ error: 'License number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const distributor = {
      name,
      email: email.toLowerCase(),
      phone,
      address,
      username,
      password: hashedPassword,
      companyName,
      licenseNumber,
      role: 'distributor',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await distributorCollection.insertOne(distributor);

    const { password: _, ...safedistributor } = distributor;

    res.status(201).json({
      id: result.insertedId.toString(),
      ...safedistributor,
    });
  } catch (err: any) {
    console.error('distributor register error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ==== distributor LOGIN ====
app.post('/auth/distributor/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const distributor = await db.collection('distributor_users').findOne({ username });

    if (!distributor) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, distributor.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 🔐 Generate JWT Token
    const token = generateToken(distributor._id.toString(), distributor.role);

    res.json({
      token,
      user: {
        id: distributor._id.toString(),
        name: distributor.name,
        email: distributor.email,
        username: distributor.username,
        role: distributor.role,
        phone: distributor.phone || '',
        address: distributor.address || '',
        companyName: distributor.companyName || '',
        licenseNumber: distributor.licenseNumber || '',
      }
    });
  } catch (err: any) {
    console.error('distributor login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==== distributor UPDATE PROFILE ====
app.put('/distributor/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, username, phone, address } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid distributor id' });
    }

    // 🔐 Verify distributor can only update their own profile
    if (req.userId !== id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await db.collection('distributor_users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          name,
          email: email?.toLowerCase(),
          username,
          phone: phone || '',
          address: address || '',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    const distributor = result.value || result;
    if (!distributor) {
      return res.status(404).json({ error: 'distributor not found' });
    }

    res.json({
      id: distributor._id.toString(),
      name: distributor.name,
      email: distributor.email,
      username: distributor.username,
      phone: distributor.phone || '',
      address: distributor.address || '',
      licenseNumber: distributor.licenseNumber || '',
      companyName: distributor.companyName || '',
      role: distributor.role,
    });
  } catch (err: any) {
    console.error('distributor update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==== distributor CHANGE PASSWORD ====
app.put('/distributor/:id/password', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Passwords required' });
    }

    // 🔐 Verify distributor can only change their own password
    if (req.userId !== id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const distributor = await db.collection('distributor_users').findOne({
      _id: new ObjectId(id),
    });

    if (!distributor) {
      return res.status(404).json({ error: 'distributor not found' });
    }

    const match = await bcrypt.compare(currentPassword, distributor.password);
    if (!match) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await db.collection('distributor_users').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          password: hashed,
          updatedAt: new Date(),
        },
      }
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('distributor password error:', err);
    res.status(500).json({ error: err.message });
  }
});
function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

// 📊 Get weekly registrations for recent activity
function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7); // 7 days ago
  return { start, end: now };
}

app.get('/admin/stats/registrations/weekly', async (req, res) => {
  try {
    const { start, end } = getWeekRange();

    const usersCol = db.collection('users');
    const distributorsCol = db.collection('distributor_users');
    const adminsCol = db.collection('admin_users');
    const pharmaciesCol = db.collection('pharmacy_users');

    // Fetch new registrations for each type from the past week
    const query = { createdAt: { $gte: start, $lte: end } };

    const newUsers = await usersCol.find(query).toArray();
    const newdistributors = await distributorsCol.find(query).toArray();
    const newAdmins = await adminsCol.find(query).toArray();
    const newPharmacies = await pharmaciesCol.find(query).toArray();

    // Combine and format results
    const registrations = [
      ...newUsers.map((u: any) => ({
        id: u._id.toString(),
        type: 'customer',
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
      })),
      ...newdistributors.map((v: any) => ({
        id: v._id.toString(),
        type: 'distributor',
        name: v.name,
        email: v.email,
        createdAt: v.createdAt,
      })),
      ...newAdmins.map((a: any) => ({
        id: a._id.toString(),
        type: 'admin',
        name: a.name,
        email: a.email,
        createdAt: a.createdAt,
      })),
      ...newPharmacies.map((p: any) => ({
        id: p._id.toString(),
        type: 'pharmacy',
        name: p.name,
        email: p.email,
        createdAt: p.createdAt,
      })),
    ];

    // Sort by createdAt descending (newest first)
    registrations.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({ registrations });
  } catch (err) {
    console.error('Weekly registrations error:', err);
    res.status(500).json({ error: 'Failed to fetch weekly registrations' });
  }
});

app.get('/admin/stats/users', async (req, res) => {
  try {
    const { start: thisStart, end: thisEnd } = getMonthRange(0);
    const { start: lastStart, end: lastEnd } = getMonthRange(-1);

    const usersCol = db.collection('users');
    const distributorsCol = db.collection('distributor_users');
    const pharmaciesCol = db.collection('pharmacy_users');

    const users = await usersCol.countDocuments();
    const distributors = await distributorsCol.countDocuments();
    const pharmacies = await pharmaciesCol.countDocuments();
    const total = users + distributors + pharmacies;

    const thisMonth =
      (await usersCol.countDocuments({ createdAt: { $gte: thisStart, $lt: thisEnd } })) +
      (await distributorsCol.countDocuments({ createdAt: { $gte: thisStart, $lt: thisEnd } })) +
      (await pharmaciesCol.countDocuments({ createdAt: { $gte: thisStart, $lt: thisEnd } }));

    const lastMonth =
      (await usersCol.countDocuments({ createdAt: { $gte: lastStart, $lt: lastEnd } })) +
      (await distributorsCol.countDocuments({ createdAt: { $gte: lastStart, $lt: lastEnd } })) +
      (await pharmaciesCol.countDocuments({ createdAt: { $gte: lastStart, $lt: lastEnd } }));

    let growth = 0;
    if (lastMonth === 0 && thisMonth > 0) growth = 100;
    else if (lastMonth > 0)
      growth = ((thisMonth - lastMonth) / lastMonth) * 100;

    res.json({
      total,
      users,
      distributors,
      pharmacies,
      thisMonth,
      lastMonth,
      growth: Number(growth.toFixed(1)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// ==================== ADMIN PHARMACY ENDPOINTS ====================

// Get all pharmacies
app.get('/admin/pharmacies', async (req, res) => {
  try {
    const pharmacies = await db
      .collection('pharmacy_users')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    console.log('📋 Fetched pharmacies from DB:', pharmacies.length);

    // Map MongoDB format to frontend format
    const formattedPharmacies = pharmacies.map((pharmacy: any) => {
      const formatted = {
        _id: pharmacy._id.toString(),
        name: pharmacy.name,
        email: pharmacy.email,
        username: pharmacy.username,
        phone: pharmacy.phone,
        address: pharmacy.address,
        licenseNumber: pharmacy.licenseNumber,
        logo: pharmacy.logo || null,
        licenseCertificate: pharmacy.licenseCertificate || null,
        role: pharmacy.role,
        createdAt: pharmacy.createdAt,
      };
      console.log(`🏥 ${pharmacy.name} - Logo: ${formatted.logo}, License: ${formatted.licenseCertificate}`);
      return formatted;
    });

    res.json(formattedPharmacies);
  } catch (err: any) {
    console.error('Get pharmacies error:', err);
    res.status(500).json({ error: 'Failed to fetch pharmacies' });
  }
});

// Get pharmacy stats (total orders and total revenue)
app.get('/admin/pharmacies/stats', async (req, res) => {
  try {
    // Get total orders from order_db
    const orderClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    await orderClient.connect();
    const orderDb = orderClient.db('order_db');
    
    const totalOrders = await orderDb
      .collection('customer_to_pharma_orders')
      .countDocuments({});

    // Get total revenue from all pharmacies in inventory_pharma database
    const inventoryClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    await inventoryClient.connect();
    const inventoryDb = inventoryClient.db('inventory_pharma');

    // Fetch all inventory items from all collections and sum revenue
    const collections = ['inventory', 'emergency', 'general'];
    let totalRevenue = 0;

    for (const collectionName of collections) {
      const items = await inventoryDb.collection(collectionName).find({}).toArray();
      items.forEach((item: any) => {
        const stock = Number(item.stock || 0);
        const price = Number(item.price || 0);
        totalRevenue += stock * price;
      });
    }

    await orderClient.close();
    await inventoryClient.close();

    res.json({
      totalOrders,
      totalRevenue: Number(totalRevenue.toFixed(2)),
    });
  } catch (err: any) {
    console.error('Get pharmacy stats error:', err);
    res.status(500).json({ error: 'Failed to fetch pharmacy stats' });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 User Service running on port ${PORT}`);
  });
});