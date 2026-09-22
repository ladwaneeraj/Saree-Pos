/** Static reference data for the demo seed. All businesses and people are fictional. */
import type { PhotoKey } from "./stock-photos";

export const CATEGORIES = [
  { key: "silk", name: "Silk Sarees" },
  { key: "bridal", name: "Bridal Sarees" },
  { key: "cotton", name: "Cotton Sarees" },
  { key: "handloom", name: "Handloom Sarees" },
  { key: "designer", name: "Designer Sarees" },
  { key: "party", name: "Party Wear" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const COLLECTIONS = [
  { key: "wedding", name: "Wedding", description: "Kanjivarams, Banarasis and heirloom silks for the big day." },
  { key: "festive", name: "Festive", description: "Rich colours and zari for Navaratri, Deepavali and family functions." },
  { key: "daily", name: "Daily Wear", description: "Breathable cottons and easy drapes you will reach for every day." },
  { key: "premium", name: "Premium Silk", description: "Pure silk, pure zari. Our most prized weaves." },
  { key: "new", name: "New Arrivals", description: "Fresh from the looms this month." },
  { key: "office", name: "Office Wear", description: "Light, crisp and easy to carry from morning to evening." },
] as const;
export type CollectionKey = (typeof COLLECTIONS)[number]["key"];

export const FABRICS: { name: string; category: CategoryKey; description: string; care: string }[] = [
  { name: "Silk", category: "silk", description: "Pure mulberry silk with a soft, fluid drape.", care: "Dry clean only. Store folded in a muslin cloth." },
  { name: "Kanchipuram", category: "silk", description: "Heavy temple-town silk woven with pure zari.", care: "Dry clean only. Refold every few months to protect the zari." },
  { name: "Banarasi", category: "silk", description: "Varanasi brocade with intricate zari and meenakari.", care: "Dry clean only. Avoid spraying perfume directly on zari." },
  { name: "Cotton", category: "cotton", description: "Handwoven cotton that breathes through the Indian summer.", care: "Gentle hand wash in cold water. Starch lightly for crispness." },
  { name: "Linen", category: "handloom", description: "Crisp linen with a natural slub texture.", care: "Hand wash cold. Iron while slightly damp." },
  { name: "Chanderi", category: "handloom", description: "Sheer silk-cotton from Chanderi with a subtle sheen.", care: "Dry clean recommended. Hand wash cold if needed." },
  { name: "Organza", category: "designer", description: "Light, structured organza with a glassy finish.", care: "Dry clean only." },
  { name: "Georgette", category: "party", description: "Flowing georgette that drapes easily and holds pleats.", care: "Dry clean or gentle hand wash." },
  { name: "Tussar", category: "silk", description: "Wild silk with a rich, textured gold tone.", care: "Dry clean only." },
  { name: "Chiffon", category: "party", description: "Featherlight chiffon for all-day comfort.", care: "Gentle hand wash in cold water." },
];

export const COLOURS: [string, string][] = [
  ["Red", "#b3261e"], ["Maroon", "#6d1a24"], ["Wine", "#6b1f3a"], ["Rani Pink", "#d6246e"], ["Pink", "#e27aa0"],
  ["Onion Pink", "#d9a1a6"], ["Peach", "#f2b48f"], ["Orange", "#e0762b"], ["Rust", "#a0461f"], ["Mustard", "#c9971c"],
  ["Yellow", "#e8c33a"], ["Gold", "#c9a24a"], ["Cream", "#efe3c8"], ["Ivory", "#f4ecd8"], ["Beige", "#d9c4a3"],
  ["Bottle Green", "#1f4d36"], ["Parrot Green", "#6bb33f"], ["Mint Green", "#a8d5ba"], ["Teal", "#1f7a78"], ["Peacock Blue", "#0f5e73"],
  ["Royal Blue", "#2446a3"], ["Navy", "#1f2a55"], ["Sky Blue", "#8cc3e8"], ["Purple", "#5e2a84"], ["Lavender", "#b8a2d8"],
  ["Magenta", "#b02a78"], ["Black", "#222222"], ["Grey", "#8b8b8b"], ["Coffee", "#5a3d2b"], ["Copper", "#b0663a"],
  ["Multicolour", "#9c4f78"],
];

export interface Look {
  colour: string;
  photos: PhotoKey[];
}

export interface DesignSeed {
  name: string;
  fabric: string;
  category: CategoryKey;
  collections: CollectionKey[];
  pattern: string;
  border: string;
  price: number;
  /** Colour variants and their photos. Stock is only created in these colours. */
  looks: Look[];
  /** Relative stock depth. */
  stock: number;
  /** Relative sales popularity. */
  pop: number;
  note?: string;
}

const look = (colour: string, ...photos: PhotoKey[]): Look => ({ colour, photos });

const d = (
  name: string, fabric: string, category: CategoryKey, collections: CollectionKey[], pattern: string, border: string,
  price: number, looks: Look[], stock: number, pop: number, note?: string,
): DesignSeed => ({ name, fabric, category, collections, pattern, border, price, looks, stock, pop, note });

export const DESIGNS: DesignSeed[] = [
  d("Kanchipuram Bridal Zari Silk", "Kanchipuram", "bridal", ["wedding", "premium"], "Zari brocade", "Big zari border", 38999, [look("Red", "bridalRed1", "bridalRed2"), look("Maroon", "heirloomSilk")], 3, 2, "An heirloom bridal Kanjivaram with a heavy pure zari body and border."),
  d("Kanchipuram Temple Border Silk", "Kanchipuram", "silk", ["wedding", "premium"], "Temple", "Temple border", 21999, [look("Purple", "tamilBridePurple"), look("Bottle Green", "greenJewellery")], 4, 3, "Classic gopuram temple border woven the traditional korvai way."),
  d("Kanjivaram Checks Silk", "Kanchipuram", "silk", ["festive", "premium"], "Checks", "Contrast zari border", 16999, [look("Purple", "purpleGold"), look("Bottle Green", "greenGold")], 4, 4),
  d("Banarasi Katan Silk Jaal", "Banarasi", "silk", ["wedding", "premium"], "Jaal", "Zari border", 17999, [look("Red", "redGold"), look("Royal Blue", "blueGold")], 5, 4),
  d("Banarasi Bridal Kadhwa", "Banarasi", "bridal", ["wedding", "premium"], "Kadhwa booti", "Heavy zari border", 27999, [look("Red", "redGoldVeil")], 2, 2),
  d("Dharmavaram Bridal Silk", "Silk", "bridal", ["wedding"], "Brocade", "Double side border", 24999, [look("Red", "red2")], 3, 2),
  d("Paithani Peacock Silk", "Silk", "silk", ["wedding", "premium"], "Peacock", "Paithani border", 18999, [look("Royal Blue", "bluePurple")], 3, 2, "Hand-woven peacock pallu in the Paithani tradition."),
  d("Kanchipuram Vaira Oosi Silk", "Kanchipuram", "silk", ["wedding", "festive"], "Vaira oosi dots", "Zari border", 17499, [look("Teal", "teal1", "teal2", "tealFabric")], 4, 3),
  d("Mysuru Crepe Silk", "Silk", "silk", ["office", "festive"], "Plain", "Thin zari border", 8999, [look("Navy", "navy")], 6, 6, "Lightweight crepe silk with a narrow zari edge. Easy to drape and carry."),
  d("Soft Silk Zari Butta", "Silk", "silk", ["festive", "daily"], "Zari butta", "Zari border", 5999, [look("Rani Pink", "pinkOrange"), look("Yellow", "yellow1")], 8, 8),
  d("Arani Silk Butta", "Silk", "silk", ["festive"], "Small butta", "Zari border", 7499, [look("Orange", "orange"), look("Peacock Blue", "greenBlue")], 6, 6),
  d("Molakalmuru Silk Rudraksha", "Silk", "silk", ["festive", "premium"], "Rudraksha butta", "Korvai border", 13999, [look("Red", "redBrown1", "redBrown2")], 3, 3, "Molakalmuru's signature rudraksha buttas on a pure silk body."),
  d("Uppada Pattu Jamdani", "Silk", "silk", ["festive", "premium"], "Jamdani", "Zari border", 10999, [look("Onion Pink", "whitePink")], 3, 3),
  d("Gadwal Silk Cotton Kuttu", "Silk", "handloom", ["festive"], "Kuttu border", "Silk kuttu border", 8499, [look("Mustard", "yellowBlue")], 4, 4),
  d("Banarasi Tanchoi Silk", "Banarasi", "silk", ["festive", "premium"], "Tanchoi", "Satin border", 11499, [look("Maroon", "maroon1")], 4, 3),
  d("Banarasi Georgette Rangkat", "Banarasi", "designer", ["festive", "new"], "Rangkat", "Zari border", 9999, [look("Pink", "pinkBlack1", "pinkBlack2")], 4, 4),
  d("Banarasi Meenakari Soft Silk", "Banarasi", "silk", ["wedding", "festive"], "Meenakari butta", "Meenakari border", 13499, [look("Red", "redGreen"), look("Bottle Green", "greenEmbroidered1", "greenEmbroidered2")], 4, 4),
  d("Kora Organza Banarasi", "Banarasi", "designer", ["festive", "new"], "Floral butta", "Zari border", 8999, [look("Cream", "cream")], 4, 4),
  d("Kanchipuram Half and Half", "Kanchipuram", "silk", ["wedding", "festive"], "Half and half", "Zari border", 19999, [look("Parrot Green", "greenOrange")], 3, 2),
  d("Kanchi Soft Silk Pastel", "Silk", "silk", ["festive", "new"], "Pastel butta", "Zari border", 6999, [look("Mint Green", "greenSmile1", "greenSmile2"), look("Lavender", "purpleFloral")], 6, 7),
  d("Pochampally Ikat Silk", "Silk", "silk", ["festive", "premium"], "Ikat", "Ikat border", 11999, [look("Peacock Blue", "blueGreen")], 4, 3),
  d("Baluchari Silk Story Pallu", "Silk", "silk", ["festive", "premium"], "Figurative", "Baluchari border", 12499, [look("Purple", "purpleWalk")], 3, 2),
  d("Patola Double Ikat Silk", "Silk", "silk", ["wedding", "premium"], "Double ikat", "Ikat border", 29999, [look("Multicolour", "colourful")], 2, 1, "Patan-style double ikat. Every thread dyed before weaving."),
  d("Kerala Kasavu Tissue", "Cotton", "handloom", ["festive"], "Plain", "Kasavu zari border", 3499, [look("Cream", "whiteGoldWide")], 6, 6, "Off-white Kerala cotton with a gleaming kasavu zari border."),
  d("Tussar Madhubani Print", "Tussar", "designer", ["festive", "office"], "Madhubani", "Printed border", 5499, [look("Coffee", "brownFloral")], 4, 4),
  d("Tussar Ghicha Silk", "Tussar", "silk", ["office", "festive"], "Plain ghicha", "Temple border", 6999, [look("Mustard", "yellowBrown")], 4, 3),
  d("Bhagalpuri Tussar Stripes", "Tussar", "handloom", ["office", "daily"], "Stripes", "Thread border", 4799, [look("Grey", "grey")], 5, 5),
  d("Chanderi Silk Cotton Butta", "Chanderi", "handloom", ["festive", "office"], "Butta", "Zari border", 2899, [look("Mint Green", "greenWhite"), look("Yellow", "yellowWhite")], 10, 12),
  d("Chanderi Tissue Zari", "Chanderi", "handloom", ["festive", "new"], "Tissue", "Zari border", 4499, [look("Parrot Green", "greenGarden")], 5, 6),
  d("Maheshwari Silk Cotton", "Chanderi", "handloom", ["office", "daily"], "Checks", "Reversible border", 2499, [look("Pink", "pinkPorch"), look("Royal Blue", "blueYellow1", "blueYellow2")], 9, 11),
  d("Linen Jamdani Weave", "Linen", "handloom", ["office", "new"], "Jamdani", "Silver zari border", 4299, [look("Sky Blue", "blueFloral")], 6, 7),
  d("Linen Silk Stripe", "Linen", "handloom", ["office"], "Stripes", "Tassel border", 3799, [look("Bottle Green", "greenStripeTextile"), look("Navy", "blueStripeTextile")], 5, 6),
  d("Cotton Ilkal Checks", "Cotton", "cotton", ["daily"], "Chikki checks", "Tope teni border", 1499, [look("Red", "cottonTextile")], 14, 16, "Ilkal from North Karnataka with the signature tope teni pallu."),
  d("Pochampally Ikat Cotton", "Cotton", "handloom", ["daily", "office"], "Ikat", "Ikat border", 2199, [look("Royal Blue", "blueRed"), look("Red", "red3")], 10, 12),
  d("Cotton Kalamkari Print", "Cotton", "cotton", ["daily", "office"], "Kalamkari", "Printed border", 1299, [look("Rust", "rustTwirl")], 12, 14),
  d("Mangalagiri Cotton Checks", "Cotton", "cotton", ["daily", "office"], "Checks", "Nizam border", 1399, [look("Yellow", "yellow2"), look("Sky Blue", "bluePink")], 12, 14),
  d("Chettinad Cotton Stripes", "Cotton", "cotton", ["daily"], "Stripes", "Contrast border", 1199, [look("Black", "blackStripes"), look("Red", "redYellow")], 14, 16),
  d("Bengal Tant Cotton", "Cotton", "cotton", ["daily"], "Butta", "Red woven border", 999, [look("Ivory", "whiteRedBorder")], 14, 17, "Light, crisp Tant cotton with the classic red border. The everyday saree of Bengal."),
  d("Venkatagiri Cotton Jamdani", "Cotton", "cotton", ["daily", "festive"], "Jamdani butta", "Zari border", 2699, [look("Yellow", "yellowPurple")], 7, 8),
  d("Narayanpet Cotton", "Cotton", "cotton", ["daily"], "Checks", "Temple border", 1599, [look("Maroon", "maroon2")], 10, 11),
  d("Kota Doria Printed", "Cotton", "cotton", ["daily", "office"], "Floral print", "Plain border", 1099, [look("Multicolour", "colourfulJewellery")], 12, 14),
  d("Sambalpuri Ikat Cotton", "Cotton", "handloom", ["daily", "festive"], "Bandha ikat", "Temple border", 2499, [look("Black", "blackRed1", "blackRed2", "blackRed3", "blackRed4")], 7, 8),
  d("Semi Silk Daily Wear", "Cotton", "cotton", ["daily"], "Small butta", "Zari border", 899, [look("Red", "red1"), look("Multicolour", "colourfulHeadpiece")], 16, 18),
  d("Cotton Rickshaw Art Print", "Cotton", "cotton", ["daily", "new"], "Rickshaw art print", "Printed border", 1799, [look("Multicolour", "rickshawPrint")], 8, 9),
  d("Organza Black and White", "Organza", "designer", ["festive", "new"], "Embroidered florals", "Scalloped border", 6499, [look("Black", "blackWhite")], 6, 6),
  d("Organza Mirror Work", "Organza", "designer", ["festive", "new"], "Mirror work", "Sequin border", 7999, [look("Red", "redWhite1")], 5, 5),
  d("Georgette Bandhani", "Georgette", "party", ["festive"], "Bandhani", "Gota border", 3499, [look("Red", "redWhite2")], 8, 9),
  d("Georgette Sequin Party Wear", "Georgette", "party", ["festive", "new"], "Sequin", "Sequin border", 5499, [look("Black", "blackGold1", "blackGold2")], 6, 6),
  d("Georgette Lucknowi Chikankari", "Georgette", "designer", ["festive", "office"], "Chikankari", "Embroidered border", 6999, [look("Ivory", "white")], 5, 5),
  d("Georgette Printed Daily", "Georgette", "party", ["daily", "office"], "Floral print", "Piping border", 1899, [look("Red", "redCopperPot")], 12, 13),
  d("Chiffon Floral Print", "Chiffon", "party", ["daily", "office"], "Floral print", "Satin border", 1799, [look("Peach", "whitePinkFloral")], 11, 12),
  d("Chiffon Leheriya", "Chiffon", "party", ["festive", "daily"], "Leheriya", "Gota border", 2299, [look("Yellow", "yellowRedWide")], 8, 9),
  d("Crepe Printed Office Saree", "Georgette", "party", ["office", "daily"], "Geometric print", "Printed border", 1599, [look("Red", "redCar")], 12, 13),
];

export const SUPPLIERS = [
  { name: "Sri Kamakshi Silk Weavers", contactName: "Venkatesan R", city: "Kanchipuram", fabrics: ["Kanchipuram", "Silk"] },
  { name: "Kashi Heritage Looms", contactName: "Irfan Ansari", city: "Varanasi", fabrics: ["Banarasi", "Organza"] },
  { name: "Molakalmuru Weavers Sangha", contactName: "Siddappa H", city: "Molakalmuru", fabrics: ["Silk", "Cotton"] },
  { name: "Shree Ganesh Textiles", contactName: "Hitesh Shah", city: "Surat", fabrics: ["Georgette", "Chiffon", "Organza"] },
  { name: "Chanderi Weavers Collective", contactName: "Rafiq Khan", city: "Chanderi", fabrics: ["Chanderi"] },
  { name: "Pochampally Ikat House", contactName: "Srinivas Goud", city: "Pochampally", fabrics: ["Cotton", "Silk"] },
  { name: "Ilkal Handloom Traders", contactName: "Basavaraj Hiremath", city: "Ilkal", fabrics: ["Cotton"] },
  { name: "Phulia Tant Emporium", contactName: "Subrata Basak", city: "Phulia", fabrics: ["Cotton", "Linen"] },
  { name: "Dharmavaram Pattu Traders", contactName: "Nagaraju P", city: "Dharmavaram", fabrics: ["Silk", "Tussar"] },
  { name: "Bhagalpur Silk & Linen Co", contactName: "Anil Mandal", city: "Bhagalpur", fabrics: ["Tussar", "Linen"] },
];

export const FIRST_NAMES_F = [
  "Lakshmi", "Deepa", "Ananya", "Shobha", "Meera", "Priya", "Kavitha", "Sunita", "Rekha", "Divya", "Pooja", "Sneha", "Asha", "Geetha",
  "Nandini", "Bhavana", "Shalini", "Vidya", "Sowmya", "Radha", "Manjula", "Pavithra", "Swathi", "Harini", "Aishwarya", "Roopa", "Latha",
  "Savitha", "Chaitra", "Sahana", "Shwetha", "Usha", "Vani", "Jyothi", "Padma", "Anitha", "Neha", "Keerthana", "Ramya", "Farzana",
  "Sushma", "Veena", "Mamatha", "Sharada", "Hema", "Nirmala", "Archana", "Varsha", "Malini", "Tejaswini",
];

export const SURNAMES = [
  "Rao", "Kulkarni", "Gowda", "Iyer", "Menon", "Reddy", "Hegde", "Shetty", "Patil", "Nair", "Joshi", "Bhat", "Desai", "Naik",
  "Murthy", "Prasad", "Sharma", "Kamath", "Pai", "Shenoy", "Kumar", "Sheikh", "Pillai", "Deshpande", "Hiremath", "Angadi", "Rajan",
];

export const CITIES = [
  { city: "Davanagere", state: "Karnataka", pins: ["577001", "577002", "577004", "577005", "577006"], weight: 30, areas: ["PJ Extension", "Vidyanagar", "MCC B Block", "Nijalingappa Layout", "SS Layout"] },
  { city: "Bengaluru", state: "Karnataka", pins: ["560004", "560011", "560041", "560076", "560085"], weight: 18, areas: ["Basavanagudi", "Jayanagar 4th Block", "Malleshwaram", "HSR Layout", "Banashankari 3rd Stage"] },
  { city: "Harihar", state: "Karnataka", pins: ["577601"], weight: 8, areas: ["Gandhi Nagar", "Station Road"] },
  { city: "Mysuru", state: "Karnataka", pins: ["570009", "570017", "570023"], weight: 7, areas: ["Kuvempunagar", "Saraswathipuram", "Vijayanagar 2nd Stage"] },
  { city: "Hubballi", state: "Karnataka", pins: ["580020", "580031"], weight: 7, areas: ["Vidyanagar", "Gokul Road"] },
  { city: "Shivamogga", state: "Karnataka", pins: ["577201", "577204"], weight: 6, areas: ["Gopala", "Vinobanagar"] },
  { city: "Chitradurga", state: "Karnataka", pins: ["577501"], weight: 5, areas: ["Jogimatti Road", "VP Extension"] },
  { city: "Mangaluru", state: "Karnataka", pins: ["575003", "575006"], weight: 4, areas: ["Kadri", "Bejai"] },
  { city: "Chennai", state: "Tamil Nadu", pins: ["600017", "600040"], weight: 4, areas: ["T Nagar", "Anna Nagar"] },
  { city: "Hyderabad", state: "Telangana", pins: ["500034", "500081"], weight: 4, areas: ["Banjara Hills", "Madhapur"] },
  { city: "Pune", state: "Maharashtra", pins: ["411004", "411038"], weight: 4, areas: ["Deccan Gymkhana", "Kothrud"] },
  { city: "Mumbai", state: "Maharashtra", pins: ["400028", "400057"], weight: 3, areas: ["Dadar West", "Vile Parle East"] },
];

export const STREETS = ["1st Main Road", "2nd Cross", "4th Main", "Temple Street", "Park Road", "8th Cross", "Church Road", "Main Road", "3rd Cross", "College Road"];

export const REVIEW_TEXTS: [number, string][] = [
  [5, "Beautiful colour, exactly as shown in the photos. The zari work is very neat."],
  [5, "Wore it for my sister's wedding and got so many compliments. Packing was lovely too."],
  [5, "Soft fabric and a rich pallu. Worth every rupee."],
  [4, "Nice saree and quick delivery. Colour is a shade darker than the photo but still lovely."],
  [5, "Very comfortable for office. I have already ordered two more colours."],
  [5, "Genuine handloom quality. The border finishing is excellent."],
  [4, "Good quality for the price. Blouse piece could have been a little longer."],
  [5, "The WhatsApp team helped me choose the colour. Very happy with the purchase."],
  [5, "Drapes beautifully and holds pleats well. Will shop again."],
  [4, "Lovely saree. Delivery took a day longer than expected."],
  [5, "My mother loved it. The Kanchipuram silk feels heavy and rich."],
  [5, "Perfect for Navaratri. Bright colours and neat weaving."],
];

export const WHATSAPP_SCRIPTS: { name: string; lines: [("IN" | "OUT"), string][] ; product?: string; intent: "pending" | "paid" | "enquiry" | "delivered" }[] = [
  { name: "Lakshmi Prasad", product: "Kanchipuram Temple Border Silk", intent: "pending", lines: [
    ["IN", "Hi, is this Kanchipuram saree available in purple?"],
    ["OUT", "Namaskara madam! Yes, it is available in Purple. Sharing the details."],
    ["IN", "Looks lovely. Please keep it for me, I will pay today evening."],
  ] },
  { name: "Ananya Rao", product: "Chanderi Silk Cotton Butta", intent: "paid", lines: [
    ["IN", "Do you have Chanderi in mint green?"],
    ["OUT", "Yes madam, one piece in Mint Green. Sharing photo."],
    ["IN", "Payment done ✅ please check"],
  ] },
  { name: "Deepa Kulkarni", product: "Cotton Ilkal Checks", intent: "enquiry", lines: [
    ["IN", "Namaskara. Do you have Ilkal sarees under 2000?"],
    ["OUT", "Yes madam, Ilkal checks start at ₹1,499. Sharing a few options."],
    ["IN", "Can you send a photo of the pallu also?"],
  ] },
  { name: "Shobha Gowda", intent: "enquiry", lines: [
    ["IN", "Is cash on delivery available for Hubballi?"],
  ] },
  { name: "Farzana Sheikh", product: "Organza Mirror Work", intent: "enquiry", lines: [
    ["IN", "Hi! Looking for an organza saree for a reception next week."],
    ["OUT", "Hello! Sharing our mirror work organza, very popular this season."],
    ["IN", "Looks nice. What is the blouse length?"],
  ] },
  { name: "Priya Menon", product: "Banarasi Katan Silk Jaal", intent: "enquiry", lines: [
    ["IN", "Hi, I saw your Banarasi saree on Instagram. What is the price?"],
  ] },
  { name: "Kavitha Reddy", intent: "delivered", lines: [
    ["IN", "Received the saree today. Very nice quality, thank you 🙏"],
    ["OUT", "Thank you madam! Happy to hear that. Do share a photo when you wear it."],
  ] },
  { name: "Meera Iyer", intent: "enquiry", lines: [
    ["IN", "When will my order reach Chennai?"],
    ["OUT", "It is in transit madam, expected in 2 days. Tracking link was sent on SMS."],
    ["IN", "Okay thanks"],
  ] },
];
