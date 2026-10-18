// Seed the real Daddy's Sizzlers menu (from src/lib/menuData.js) into data.sqlite
// Run: node server/seed.js --reset
import Database from 'better-sqlite3';

const db = new Database('data.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    data TEXT NOT NULL,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    created_by TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_records_entity ON records(entity);
`);

if (process.argv.includes('--reset')) {
  db.prepare("DELETE FROM records WHERE entity IN ('Category','Product','AppSetting')").run();
  console.log('Cleared Category, Product, AppSetting.');
}

const count = (e) => db.prepare('SELECT COUNT(*) AS n FROM records WHERE entity = ?').get(e).n;
if (count('Category') > 0 || count('Product') > 0) {
  console.log('Data already exists. Use --reset to re-seed.');
  process.exit(0);
}

let tick = 0;
function insert(entity, id, data) {
  const now = new Date(Date.now() + tick++).toISOString();
  db.prepare(
    'INSERT INTO records (id, entity, data, created_date, updated_date, created_by) VALUES (?,?,?,?,?,?)'
  ).run(id, entity, JSON.stringify(data), now, now, 'admin@local.test');
}

insert('AppSetting', 'app-setting-1', {
  restaurant_name: "Daddy's Sizzlers",
  logo_url: '',
  address: '',
  phone: '',
  email: '',
  facebook_page: '',
  business_hours: '',
  currency: 'PHP',
  timezone: 'Asia/Manila',
});

const SIZ = 'Served with 2 rice and 1 glass of iced tea';
const PLT = 'Good for 2 to 3 people';
const WINGS = [{ name: '4 pcs', price: 145 }, { name: '6 pcs', price: 175 }];

const menu = [
  { id: 'sizzlers', name: 'Sizzlers', description: SIZ, products: [
    ['sizzler-pork-sisig', 'Pork Sisig', 119, SIZ],
    ['sizzler-pork-dinakdakan', 'Pork Dinakdakan', 119, SIZ],
    ['sizzler-bangus-sisig', 'Bangus Sisig', 119, SIZ],
    ['sizzler-liempo-gravy', 'Liempo Gravy', 145, SIZ],
    ['sizzler-pork-chop-gravy', 'Pork Chop Gravy', 145, SIZ],
    ['sizzler-chicken-gravy', 'Chicken Gravy', 145, SIZ],
  ]},
  { id: 'platters', name: 'Platter - 2 to 3 Pax', description: 'Sizzling platters for sharing', products: [
    ['platter-pork-sisig', 'Pork Sisig Platter', 220, PLT],
    ['platter-pork-dinakdakan', 'Pork Dinakdakan Platter', 220, PLT],
    ['platter-bangus-sisig', 'Bangus Sisig Platter', 220, PLT],
    ['platter-bulaklak', 'Bulaklak Platter', 220, PLT],
    ['platter-lechon-kawali', 'Lechon Kawali Platter', 220, PLT],
  ]},
  { id: 'silog-meals', name: 'Silog Meals', description: 'Simple, filling, delicious', products: [
    ['silog-liempo', 'Liempo Silog', 125, 'Silog meal'],
    ['silog-pork', 'Pork Silog', 125, 'Silog meal'],
    ['silog-chicken', 'Chicken Silog', 125, 'Silog meal'],
    ['silog-bangus', 'Bangus Silog', 125, 'Silog meal'],
    ['silog-lechon-kawali', 'Lechon Kawali Silog', 125, 'Silog meal'],
    ['silog-bulaklak', 'Bulaklak Silog', 125, 'Silog meal'],
  ]},
  { id: 'snacks-salad', name: 'Snacks & Salad', description: 'Fresh, flavorful, satisfying', products: [
    ['snack-cheeze-fries', 'Cheeze Fries (150 g)', 70, '150 grams'],
    ['snack-bacon-cheeze-fries', 'Bacon Cheeze Fries (150 g)', 100, '150 grams'],
    ['snack-meaty-cheeze-fries', 'Meaty Cheeze Fries (150 g)', 130, '150 grams'],
    ['snack-cheeze-nachos', 'Cheeze Nachos', 80, ''],
    ['snack-nacho-salad', 'Nacho Salad', 110, ''],
    ['snack-mighty-meaty-nacho-salad', 'Mighty Meaty Nacho Salad', 150, ''],
    ['snack-garden-salad', 'Garden Salad', 120, 'Choose Thousand Island, Caesar, or Ranch dressing'],
  ]},
  { id: 'daddys-wings', name: "Daddy's Wings", description: 'Choose 4 or 6 pieces', products: [
    ['wings-buffalo', 'Buffalo Wings', 145, '', WINGS],
    ['wings-honey-cured', 'Honey Cured Wings', 145, '', WINGS],
    ['wings-salted-egg', 'Salted Egg Wings', 145, '', WINGS],
    ['wings-parmesan', 'Parmesan Wings', 145, '', WINGS],
    ['wings-korean', 'Korean Wings', 145, '', WINGS],
  ]},
  { id: 'made-to-order', name: 'Made to Order', description: 'Fresh, hot, delicious', products: [
    ['made-to-order-lechon-belly', 'Lechon Belly', null, 'Price not listed on the menu'],
    ['made-to-order-pancit', 'Pancit', null, 'Price not listed on the menu'],
    ['made-to-order-pasta', 'Pasta', null, 'Price not listed on the menu'],
  ]},
];

let productOrder = 0; // global order so the first products stay the Sizzlers
menu.forEach((cat, ci) => {
  insert('Category', cat.id, {
    name: cat.name,
    slug: cat.id,
    description: cat.description,
    sort_order: ci,
  });
  cat.products.forEach(([id, name, price, description, variants], pi) => {
    insert('Product', id, {
      name,
      category_id: cat.id,
      category_name: cat.name,
      description,
      price,
      variants: variants || [],
      image_url: '',
      active: true,
      sort_order: productOrder++,
      serves_with: '',
    });
  });
});

console.log(
  `Seeded: ${count('Category')} categories, ${count('Product')} products, ${count('AppSetting')} app setting.`
);