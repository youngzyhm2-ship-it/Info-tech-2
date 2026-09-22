require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const CATEGORIES = [
  { id: 'laptops', name: 'Laptops', icon: 'laptop' },
  { id: 'phones', name: 'Phones', icon: 'phone' },
  { id: 'desktops', name: 'Desktops', icon: 'desktop' },
  { id: 'monitors', name: 'Monitors', icon: 'monitor' },
  { id: 'networking', name: 'Networking', icon: 'network' },
  { id: 'printers', name: 'Printers', icon: 'printer' },
  { id: 'storage', name: 'Storage', icon: 'storage' },
  { id: 'accessories', name: 'Accessories', icon: 'accessory' },
];

const PRODUCTS = [
  { id: 'ITZ-HP-840-G8', name: 'HP EliteBook 840 G8', brand: 'HP', categoryId: 'laptops', icon: 'laptop', condition: 'Refurbished', availability: 'In Stock', price: 850000, warranty: '6 months Infotechzone warranty',
    specs: [['Processor', 'Intel Core i5-1135G7'], ['RAM', '16GB DDR4'], ['Storage', '512GB SSD'], ['Display', '14" FHD'], ['Battery', 'Up to 8 hrs']],
    description: 'A dependable business laptop, professionally inspected and reset to factory condition. Ideal for office work, spreadsheets and everyday multitasking.' },
  { id: 'ITZ-DELL-5480', name: 'Dell Precision 5480', brand: 'Dell', categoryId: 'laptops', icon: 'laptop', condition: 'New', availability: 'Limited Stock', price: 1450000, warranty: '1 year manufacturer warranty',
    specs: [['Processor', 'Intel Core i7-13800H'], ['RAM', '32GB DDR5'], ['Storage', '1TB SSD'], ['Graphics', 'NVIDIA RTX 2000 Ada'], ['Display', '14" 2.8K OLED']],
    description: 'A mobile workstation built for engineers and creators who need serious graphics performance without giving up portability.' },
  { id: 'ITZ-IPH-13P', name: 'iPhone 13 Pro 256GB', brand: 'Apple', categoryId: 'phones', icon: 'phone', condition: 'Refurbished', availability: 'In Stock', price: 620000, warranty: '3 months Infotechzone warranty',
    specs: [['Storage', '256GB'], ['Display', '6.1" Super Retina XDR'], ['Camera', 'Triple 12MP system'], ['Battery Health', '92%+ certified'], ['Colour', 'Graphite']],
    description: 'Grade-A refurbished unit, fully tested with certified battery health. Comes with a fresh screen protector fitted.' },
  { id: 'ITZ-SAM-A54', name: 'Samsung Galaxy A54', brand: 'Samsung', categoryId: 'phones', icon: 'phone', condition: 'New', availability: 'In Stock', price: 285000, warranty: '1 year manufacturer warranty',
    specs: [['Storage', '128GB'], ['RAM', '8GB'], ['Display', '6.4" Super AMOLED'], ['Camera', '50MP triple camera'], ['Battery', '5000mAh']],
    description: 'A reliable mid-range smartphone with strong battery life and a smooth AMOLED display, sealed in original packaging.' },
  { id: 'ITZ-LG-27UF', name: 'LG 27" UltraFine Monitor', brand: 'LG', categoryId: 'monitors', icon: 'monitor', condition: 'New', availability: 'In Stock', price: 210000, warranty: '1 year manufacturer warranty',
    specs: [['Panel', '27" IPS 4K'], ['Ports', '2x Thunderbolt, HDMI'], ['Refresh Rate', '60Hz'], ['Colour Accuracy', '99% sRGB']],
    description: 'A crisp, colour-accurate display suited to design work and everyday productivity, with slim bezels for multi-monitor setups.' },
  { id: 'ITZ-TPL-AX55', name: 'TP-Link Archer AX55 Router', brand: 'TP-Link', categoryId: 'networking', icon: 'network', condition: 'New', availability: 'In Stock', price: 48000, warranty: '2 years manufacturer warranty',
    specs: [['Standard', 'Wi-Fi 6 (802.11ax)'], ['Speed', 'Up to 3000Mbps'], ['Ports', '4x Gigabit LAN'], ['Coverage', 'Up to 200 sqm']],
    description: 'A fast, reliable Wi-Fi 6 router for homes and small offices, with strong coverage and simple app-based setup.' },
  { id: 'ITZ-HP-M404', name: 'HP LaserJet Pro M404', brand: 'HP', categoryId: 'printers', icon: 'printer', condition: 'New', availability: 'Available on Request', price: 165000, warranty: '1 year manufacturer warranty',
    specs: [['Type', 'Monochrome laser'], ['Speed', '40 ppm'], ['Connectivity', 'USB, Ethernet'], ['Monthly Duty', '80,000 pages']],
    description: 'A fast monochrome laser printer built for busy offices that print in volume without sacrificing quality.' },
  { id: 'ITZ-DELL-7090', name: 'Dell OptiPlex 7090 Desktop', brand: 'Dell', categoryId: 'desktops', icon: 'desktop', condition: 'New', availability: 'In Stock', price: 780000, warranty: '1 year manufacturer warranty',
    specs: [['Processor', 'Intel Core i7-11700'], ['RAM', '16GB DDR4'], ['Storage', '512GB SSD'], ['Form Factor', 'Small Form Factor']],
    description: 'A compact, powerful desktop for office and hybrid setups, built to run demanding business applications smoothly.' },
  { id: 'ITZ-SAN-1TB', name: 'SanDisk 1TB External SSD', brand: 'SanDisk', categoryId: 'storage', icon: 'storage', condition: 'New', availability: 'Out of Stock', price: 95000, warranty: '3 years manufacturer warranty',
    specs: [['Capacity', '1TB'], ['Interface', 'USB-C 3.2'], ['Speed', 'Up to 1050MB/s'], ['Build', 'Shock-resistant']],
    description: 'A pocket-sized, high-speed external drive for backups and large media files, built to survive daily commuting.' },
  { id: 'ITZ-LOG-MX3S', name: 'Logitech MX Master 3S', brand: 'Logitech', categoryId: 'accessories', icon: 'accessory', condition: 'New', availability: 'In Stock', price: 58000, warranty: '1 year manufacturer warranty',
    specs: [['Connectivity', 'Bluetooth + USB receiver'], ['Battery', 'Up to 70 days'], ['Sensor', '8K DPI'], ['Compatibility', 'Windows, macOS, Linux']],
    description: 'A precision wireless mouse designed for long work sessions, with a quiet click and app-specific customisation.' },
];

async function seed() {
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name, icon) VALUES (?, ?, ?)');
  for (const c of CATEGORIES) insertCategory.run(c.id, c.name, c.icon);

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (id, name, brand, category_id, icon, condition, availability, price, warranty, description, specs_json)
    VALUES (@id, @name, @brand, @categoryId, @icon, @condition, @availability, @price, @warranty, @description, @specs)
  `);
  for (const p of PRODUCTS) insertProduct.run({ ...p, specs: JSON.stringify(p.specs) });

  const existingSuper = db.prepare(`SELECT id FROM admins WHERE role = 'super' LIMIT 1`).get();
  if (!existingSuper) {
    const passwordHash = await bcrypt.hash('changeme123', 10);
    db.prepare('INSERT INTO admins (id, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run('adm_founder', 'Amaka Obi', 'amaka@infotechzone.ng', passwordHash, 'super');
    console.log('Created first Super Admin: amaka@infotechzone.ng / changeme123 — change this password immediately.');
  }

  console.log(`Seeded ${CATEGORIES.length} categories and ${PRODUCTS.length} products.`);
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
