export type SizeOptionGroup = {
  label: string;
  options: string[];
};

function numbered(prefix: string, values: Array<string | number>): string[] {
  return values.map((value) => `${prefix} ${value}`);
}

const KIDS_NUMBERS = [4, 5, 6, 7, 8, 10, 12, 14, 16];
const KIDS_LETTERS = ["XS", "S", "M", "L", "XL"];
const WOMEN_NUMBERS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
const ADULT_LETTERS = ["XS", "S", "M", "L", "XL", "XXL"];

export const CLOTHING_SIZE_GROUPS: SizeOptionGroup[] = [
  {
    label: "Toddlers",
    options: ["12 months", "18 months", "24 months", "2T", "3T", "4T", "5T"],
  },
  {
    label: "Kids, girls",
    options: [...numbered("Girls", KIDS_NUMBERS), ...numbered("Girls", ["6X", ...KIDS_LETTERS])],
  },
  {
    label: "Kids, boys",
    options: [...numbered("Boys", [...KIDS_NUMBERS, 18, 20]), ...numbered("Boys", KIDS_LETTERS)],
  },
  {
    label: "Adults, women",
    options: [...numbered("Women's", ADULT_LETTERS), ...numbered("Women's", WOMEN_NUMBERS)],
  },
  {
    label: "Adults, men",
    options: numbered("Men's", [...ADULT_LETTERS, "3XL", "4XL", "5XL"]),
  },
];

const TODDLER_SHOES = [3, 4, 5, 6, 7, 8, 9, 10];
const KID_SHOES = ["10.5", 11, 12, 13, 1, 2, 3, 4, 5, 6, 7];
const WOMEN_SHOES = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12];
const MEN_SHOES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12, 13, 14, 15];

export const SHOE_SIZE_GROUPS: SizeOptionGroup[] = [
  { label: "Toddlers", options: numbered("Toddler shoe", TODDLER_SHOES) },
  { label: "Kids, girls", options: numbered("Girls shoe", KID_SHOES) },
  { label: "Kids, boys", options: numbered("Boys shoe", KID_SHOES) },
  { label: "Adults, women", options: numbered("Women's shoe", WOMEN_SHOES) },
  { label: "Adults, men", options: numbered("Men's shoe", MEN_SHOES) },
];

export const ELECTRONICS_TYPE_GROUPS: SizeOptionGroup[] = [
  {
    label: "Electronics & tech",
    options: [
      "Headphones",
      "Bluetooth earbuds",
      "Phone charger",
      "Phone case",
      "Tablet",
      "Laptop",
      "Smart watch",
      "Speaker",
      "Television",
      "Camera",
      "Gaming headset",
    ],
  },
];

export const HOUSEHOLD_TYPE_GROUPS: SizeOptionGroup[] = [
  {
    label: "Household & kitchen",
    options: [
      "Laundry detergent",
      "Dish soap",
      "Paper towels",
      "Trash bags",
      "Bath towels",
      "Bed sheets",
      "Pots and pans",
      "Food storage containers",
      "Cleaning supplies",
    ],
  },
];

export const BEAUTY_TYPE_GROUPS: SizeOptionGroup[] = [
  {
    label: "Beauty & wellness",
    options: [
      "Body lotion",
      "Shampoo",
      "Conditioner",
      "Body wash",
      "Deodorant",
      "Sunscreen",
      "Face moisturizer",
      "Lip balm",
      "Makeup",
    ],
  },
];
