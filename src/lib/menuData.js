export const MENU_CATEGORIES = [
  { id: "sizzlers", name: "Sizzlers", slug: "sizzlers", description: "Served with 2 rice and 1 glass of iced tea", sort_order: 0 },
  { id: "platters", name: "Platter - 2 to 3 Pax", slug: "platters", description: "Sizzling platters for sharing", sort_order: 1 },
  { id: "silog-meals", name: "Silog Meals", slug: "silog-meals", description: "Simple, filling, delicious", sort_order: 2 },
  { id: "snacks-salad", name: "Snacks & Salad", slug: "snacks-salad", description: "Fresh, flavorful, satisfying", sort_order: 3 },
  { id: "daddys-wings", name: "Daddy's Wings", slug: "daddys-wings", description: "Choose 4 or 6 pieces", sort_order: 4 },
  { id: "made-to-order", name: "Made to Order", slug: "made-to-order", description: "Fresh, hot, delicious", sort_order: 5 },
];

const categoryNames = Object.fromEntries(MENU_CATEGORIES.map(category => [category.id, category.name]));

function menuProduct(id, name, categoryId, price, description, options = {}) {
  return {
    id,
    name,
    category_id: categoryId,
    category_name: categoryNames[categoryId],
    price,
    description,
    variants: [],
    active: true,
    sort_order: 0,
    ...options,
  };
}

export const MENU_PRODUCTS = [
  menuProduct("sizzler-pork-sisig", "Pork Sisig", "sizzlers", 119, "Served with 2 rice and 1 glass of iced tea"),
  menuProduct("sizzler-pork-dinakdakan", "Pork Dinakdakan", "sizzlers", 119, "Served with 2 rice and 1 glass of iced tea"),
  menuProduct("sizzler-bangus-sisig", "Bangus Sisig", "sizzlers", 119, "Served with 2 rice and 1 glass of iced tea"),
  menuProduct("sizzler-liempo-gravy", "Liempo Gravy", "sizzlers", 145, "Served with 2 rice and 1 glass of iced tea"),
  menuProduct("sizzler-pork-chop-gravy", "Pork Chop Gravy", "sizzlers", 145, "Served with 2 rice and 1 glass of iced tea"),
  menuProduct("sizzler-chicken-gravy", "Chicken Gravy", "sizzlers", 145, "Served with 2 rice and 1 glass of iced tea"),

  menuProduct("platter-pork-sisig", "Pork Sisig Platter", "platters", 220, "Good for 2 to 3 people"),
  menuProduct("platter-pork-dinakdakan", "Pork Dinakdakan Platter", "platters", 220, "Good for 2 to 3 people"),
  menuProduct("platter-bangus-sisig", "Bangus Sisig Platter", "platters", 220, "Good for 2 to 3 people"),
  menuProduct("platter-bulaklak", "Bulaklak Platter", "platters", 220, "Good for 2 to 3 people"),
  menuProduct("platter-lechon-kawali", "Lechon Kawali Platter", "platters", 220, "Good for 2 to 3 people"),

  menuProduct("silog-liempo", "Liempo Silog", "silog-meals", 125, "Silog meal"),
  menuProduct("silog-pork", "Pork Silog", "silog-meals", 125, "Silog meal"),
  menuProduct("silog-chicken", "Chicken Silog", "silog-meals", 125, "Silog meal"),
  menuProduct("silog-bangus", "Bangus Silog", "silog-meals", 125, "Silog meal"),
  menuProduct("silog-lechon-kawali", "Lechon Kawali Silog", "silog-meals", 125, "Silog meal"),
  menuProduct("silog-bulaklak", "Bulaklak Silog", "silog-meals", 125, "Silog meal"),

  menuProduct("snack-cheeze-fries", "Cheeze Fries (150 g)", "snacks-salad", 70, "150 grams"),
  menuProduct("snack-bacon-cheeze-fries", "Bacon Cheeze Fries (150 g)", "snacks-salad", 100, "150 grams"),
  menuProduct("snack-meaty-cheeze-fries", "Meaty Cheeze Fries (150 g)", "snacks-salad", 130, "150 grams"),
  menuProduct("snack-cheeze-nachos", "Cheeze Nachos", "snacks-salad", 80, ""),
  menuProduct("snack-nacho-salad", "Nacho Salad", "snacks-salad", 110, ""),
  menuProduct("snack-mighty-meaty-nacho-salad", "Mighty Meaty Nacho Salad", "snacks-salad", 150, ""),
  menuProduct("snack-garden-salad", "Garden Salad", "snacks-salad", 120, "Choose Thousand Island, Caesar, or Ranch dressing"),

  menuProduct("wings-buffalo", "Buffalo Wings", "daddys-wings", 145, "", { variants: [{ name: "4 pcs", price: 145 }, { name: "6 pcs", price: 175 }] }),
  menuProduct("wings-honey-cured", "Honey Cured Wings", "daddys-wings", 145, "", { variants: [{ name: "4 pcs", price: 145 }, { name: "6 pcs", price: 175 }] }),
  menuProduct("wings-salted-egg", "Salted Egg Wings", "daddys-wings", 145, "", { variants: [{ name: "4 pcs", price: 145 }, { name: "6 pcs", price: 175 }] }),
  menuProduct("wings-parmesan", "Parmesan Wings", "daddys-wings", 145, "", { variants: [{ name: "4 pcs", price: 145 }, { name: "6 pcs", price: 175 }] }),
  menuProduct("wings-korean", "Korean Wings", "daddys-wings", 145, "", { variants: [{ name: "4 pcs", price: 145 }, { name: "6 pcs", price: 175 }] }),

  menuProduct("made-to-order-lechon-belly", "Lechon Belly", "made-to-order", null, "Price not listed on the menu"),
  menuProduct("made-to-order-pancit", "Pancit", "made-to-order", null, "Price not listed on the menu"),
  menuProduct("made-to-order-pasta", "Pasta", "made-to-order", null, "Price not listed on the menu"),
];