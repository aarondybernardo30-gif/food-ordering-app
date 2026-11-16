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
  yearsExperience?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
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
  isMall?: boolean;
  discount?: string;
  soldCount?: number | string;
  reviews?: FoodReview[] | any[];
  options?: string[];
  variations?: FoodVariation[];
}

export interface CartItem {
  food: FoodItem;
  quantity: number;
  selectedOption?: string;
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
}