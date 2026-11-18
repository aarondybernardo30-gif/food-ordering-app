export interface User {
  fullName: string;
  email?: string;
  phone: string;
  password?: string;
}

export interface Rider {
  id: string;
  fullName: string;
  phone: string;
  username?: string;
  password?: string;
  vehicleType?: string;
  plateNumber?: string;
  /** Job-application details (rider sign-up form) */
  age?: number;
  email?: string;
  address?: string;
  licenseNumber?: string;
}

/** Admin-managed voucher; auto-distributed to all customers. */
export interface Voucher {
  id: string;
  code: string;
  headline: string;
  title: string;
  description: string;
  category: 'shipping' | 'discount' | 'cashback';
  /** freeship = waive delivery fee; fixed = ₱ off; percent = % off */
  discountType: 'freeship' | 'fixed' | 'percent';
  discountValue: number;
  minSpend: number;
  expiry: string;
  tag: string;
  /** Customer keys (phone) that have used this voucher — it disappears for them. */
  usedBy: string[];
}

export interface CategoryItem {
  name: string;
  imageUrl: string;
  image?: string;
}

export interface FoodReview {
  id: string;
  foodId: number | string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: Date | string;
}

export interface FoodVariation {
  name: string;
  /** Food portion or cup size (e.g., "Solo", "Regular", "Medium", "Large", "Family") */
  size?: string;
  price?: number;
  [key: string]: any;
}

export interface FoodItem {
  id: any;
  name: string;
  category: string;
  description: string;
  price: number;
  rating?: number;
  imageUrl: string;
  image?: string;
  images?: string[];
  available?: boolean;
  /** Number of orders/servings remaining for this food item */
  stock?: number;
  isMall?: boolean;
  freeShipping?: boolean;
  discount?: string;
  soldCount?: number | string;
  reviews?: FoodReview[] | any[];
  options?: string[];
  variations?: FoodVariation[];
  /** Predefined available sizes for this food item (e.g., ["Solo", "Medium", "Large"]) */
  sizes?: string[];
}

export interface CartItem {
  food: FoodItem;
  quantity: number;
  selectedOption?: string;
  /** Selected size for this order item (e.g., "Regular", "Large", "Solo") */
  selectedSize?: string;
  /** Effective unit price for the chosen variation; falls back to the food's base price. */
  unitPrice?: number;
  /** Optional schedule/notes label (e.g. "Scheduled for Today" for daily featured meals). */
  note?: string;
  /** Whether this item is checked for checkout. Missing = checked (back-compat). */
  selected?: boolean;
}

export interface Order {
  id: string;
  createdAt: Date | string;
  customerPhone?: string;
  customerName?: string;
  items: CartItem[];
  orderType: 'delivery' | 'dine-in' | 'pickup';
  deliveryAddress?: string;
  tableNumber?: string;
  pickupTime?: string;
  latitude?: number;
  longitude?: number;

  /** Distance in kilometers from the shop (e.g., 1.0 km) */
  distance?: number;

  /** Subtotal of all ordered food items before fees and discounts */
  subtotal?: number;

  /** Distance-based delivery fee (₱15.00 per km) */
  shippingFee?: number;

  /** Total discount from applied vouchers */
  discountAmount?: number;

  /** Discount from customer membership tier */
  membershipDiscount?: number;
  membershipTier?: string;

  /** Final amount payable: subtotal + shippingFee - discountAmount */
  totalAmount: number;

  paymentMethod?: 'cod' | 'online' | 'shopeepay' | 'counter';
  paymentProof?: string;
  notes?: string;
  status: 'Pending' | 'Preparing' | 'Out for Delivery' | 'Ready for Pickup' | 'Completed' | 'Cancelled';
  rating?: number;
  feedback?: string;
  reviewedAt?: Date | string;
  assignedRiderName?: string;
  assignedRiderPhone?: string;
  /** Proof of Delivery — photo (data URL) the rider attaches when completing the delivery */
  deliveryProof?: string;
  deliveredAt?: Date | string;
}