const { MongoClient } = require("mongodb");

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function migrate() {
  try {
    await client.connect();
    const db = client.db("inventory_pharma"); // 🔥 change this

    const oldCollection = db.collection("inv");
    const productsCollection = db.collection("products");
    const batchesCollection = db.collection("batches");

    const oldDocs = await oldCollection.find().toArray();

    for (const item of oldDocs) {

  /* -------------------- PRODUCT DOCUMENT -------------------- */

  const productDoc = {
    productID: item.productID,
    pharmaID: item.pharmaID
  };

  if (item.medicineName !== undefined) productDoc.medicineName = item.medicineName;
  if (item.composition !== undefined) productDoc.composition = item.composition;
  if (item.manufacturer !== undefined) productDoc.manufacturer = item.manufacturer;
  if (item.description !== undefined) productDoc.description = item.description;
  if (item.category !== undefined) productDoc.category = item.category;
  if (item.productImageURL !== undefined) productDoc.productImageURL = item.productImageURL;
  if (item.lastUpdated !== undefined) productDoc.lastUpdated = item.lastUpdated;

  // Packaging (only if exists)
  const packaging = {};
  if (item.packaging?.quantityDescription !== undefined)
    packaging.quantityDescription = item.packaging.quantityDescription;

  if (item.stock?.baseQuantity !== undefined)
    packaging.baseQuantity = item.stock.baseQuantity;

  if (item.stock?.allowSubQuantity !== undefined)
    packaging.allowSubQuantity = item.stock.allowSubQuantity;

  if (item.stock?.threshold !== undefined)
    productDoc.threshold = item.stock.threshold;

  if (item.storageCondition !== undefined)
    productDoc.storageCondition = item.storageCondition;

  if (item.prescriptionRequired !== undefined)
    productDoc.prescriptionRequired = item.prescriptionRequired;

  if (Object.keys(packaging).length > 0)
  productDoc.packaging = packaging;

  await productsCollection.updateOne(
    { productID: item.productID },
    { $setOnInsert: productDoc },
    { upsert: true }
  );

  /* -------------------- BATCH DOCUMENT -------------------- */

  const batchDoc = {
    productID: item.productID,
    pharmaID: item.pharmaID,
    batchCode: item.batchCode
  };

  if (item.manufacturedDate !== undefined)
    batchDoc.manufacturedDate = item.manufacturedDate;

  if (item.expiryDate !== undefined)
    batchDoc.expiryDate = item.expiryDate;

  if (item.lastUpdated !== undefined)
    batchDoc.lastUpdated = item.lastUpdated;

  // Pricing (only if exists)
  const pricing = {};
  if (item.packaging?.mrp !== undefined) pricing.mrp = item.packaging.mrp;
  if (item.packaging?.discountPercent !== undefined) pricing.discountPercent = item.packaging.discountPercent;
  if (item.packaging?.price !== undefined) pricing.price = item.packaging.price;
  if (item.packaging?.pricePerUnit !== undefined) pricing.pricePerUnit = item.packaging.pricePerUnit;
  if (item.packaging?.gstRate !== undefined) pricing.gstRate = item.packaging.gstRate;
  if (item.packaging?.hsnCode !== undefined) pricing.hsnCode = item.packaging.hsnCode;
  if (Object.keys(pricing).length > 0)
    batchDoc.pricing = pricing;

  // Stock (only if exists)
  const stock = {};
  if (item.stock?.unitsAvailable !== undefined)
    stock.unitsAvailable = item.stock.unitsAvailable;

  if (item.stock?.totalSubUnits !== undefined)
    stock.totalSubUnits = item.stock.totalSubUnits;

  if (Object.keys(stock).length > 0)
    batchDoc.stock = stock;

  await batchesCollection.updateOne(
    {
      productID: item.productID,
      batchCode: item.batchCode
    },
    { $set: batchDoc },
    { upsert: true }
  );
}

    console.log("✅ Migration completed successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await client.close();
  }
}

migrate();