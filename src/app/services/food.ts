import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem, CategoryItem, FoodItem, FoodReview } from '../models/food.model';
import { CloudSyncService } from './cloud-sync';

@Injectable({
  providedIn: 'root'
})
export class FoodService {
  private cloudSync = inject(CloudSyncService);

  private initialFoods: FoodItem[] = [
    {
      id: 1,
      name: 'Chicken Adobo',
      category: 'Chicken',
      description: 'Slow-simmered chicken in soy sauce, vinegar, garlic, and bay leaf, served with rice.',
      price: 100,
      stock: 20,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      images: [
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=1000',
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1000'
      ],
      available: true,
      soldCount: 0,
      options: ['Regular', 'Spicy'],
      reviews: []
    },
    {
      id: 2,
      name: 'Vanilla Ice Cream',
      category: 'Desserts',
      description: 'Creamy vanilla ice cream served in a cup or a sugar cone.',
      price: 30,
      stock: 20,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500',
      images: [
        'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500',
        'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=1000'
      ],
      available: true,
      soldCount: 0,
      options: ['Regular Cup', 'Sugar Cone'],
      reviews: []
    },
    {
      id: 3,
      name: 'Iced Water',
      category: 'Drinks',
      description: 'Chilled filtered water served with ice.',
      price: 20,
      stock: 20,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500',
      images: [
        'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500'
      ],
      available: true,
      soldCount: 0,
      options: ['Normal Cold', 'With Extra Ice'],
      reviews: []
    }
  ];

  private readonly legacySeedNames: Record<string, { name: string; description: string }> = {
    'adobo': {
      name: 'Chicken Adobo',
      description: 'Slow-simmered chicken in soy sauce, vinegar, garlic, and bay leaf, served with rice.'
    },
    'ice cream ice flavor': {
      name: 'Vanilla Ice Cream',
      description: 'Creamy vanilla ice cream served in a cup or a sugar cone.'
    },
    'ice tubig': {
      name: 'Iced Water',
      description: 'Chilled filtered water served with ice.'
    }
  };

  private static readonly FALLBACK_CATEGORY_IMAGE =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=160';

  private static readonly DEFAULT_CATEGORY_ITEMS: CategoryItem[] = [
    { name: 'Burgers', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=160', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=160' },
    { name: 'Pizza', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=160', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=160' },
    { name: 'Pasta', imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=160', image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=160' },
    { name: 'Chicken', imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=160', image: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=160' },
    { name: 'Drinks', imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=160', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=160' },
    { name: 'Desserts', imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=160', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=160' },
    { name: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=160', image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=160' }
  ];

  private static readonly DEFAULT_CATEGORIES = FoodService.DEFAULT_CATEGORY_ITEMS.map(c => c.name);

  private foodsSubject: BehaviorSubject<FoodItem[]>;
  public foods$: Observable<FoodItem[]>;

  /** Editable category list (persisted in `app_categories` + `app_category_items`, cloud-synced). */
  private categoriesSubject: BehaviorSubject<string[]>;
  public categories$: Observable<string[]>;

  private categoryItemsSubject: BehaviorSubject<CategoryItem[]>;
  public categoryItems$: Observable<CategoryItem[]>;

  private loadCategories(): string[] {
    try {
      const raw = localStorage.getItem('app_categories');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [...FoodService.DEFAULT_CATEGORIES];
  }

  private loadCategoryItems(): CategoryItem[] {
    try {
      const raw = localStorage.getItem('app_category_items');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: CategoryItem) => ({
            name: c.name,
            imageUrl: c.imageUrl || c.image || FoodService.FALLBACK_CATEGORY_IMAGE,
            image: c.image || c.imageUrl || FoodService.FALLBACK_CATEGORY_IMAGE
          }));
        }
      }
    } catch {}

    // Migrate any custom category names from app_categories
    const names = this.loadCategories();
    const defaultsMap = new Map(
      FoodService.DEFAULT_CATEGORY_ITEMS.map(item => [item.name.toLowerCase(), item])
    );
    return names.map(name => {
      const found = defaultsMap.get(name.toLowerCase());
      if (found) return { ...found };
      return {
        name,
        imageUrl: FoodService.FALLBACK_CATEGORY_IMAGE,
        image: FoodService.FALLBACK_CATEGORY_IMAGE
      };
    });
  }

  private saveCategories(items: CategoryItem[]) {
    const normalized = items.map(c => {
      const img = c.imageUrl || c.image || FoodService.FALLBACK_CATEGORY_IMAGE;
      return { name: c.name.trim(), imageUrl: img, image: img };
    });
    const names = normalized.map(c => c.name);
    localStorage.setItem('app_category_items', JSON.stringify(normalized));
    localStorage.setItem('app_categories', JSON.stringify(names));
    this.categoryItemsSubject.next(normalized);
    this.categoriesSubject.next(names);
    this.cloudSync.pushKey('app_category_items', normalized);
    this.cloudSync.pushKey('app_categories', names);
  }

  getCategoryItems(): CategoryItem[] {
    return this.categoryItemsSubject.value;
  }

  getCategories(): string[] {
    return this.categoriesSubject.value;
  }

  addCategory(name: string, imageUrl?: string): string {
    const clean = (name || '').trim();
    if (!clean) return '';
    const items = [...this.loadCategoryItems()];
    const idx = items.findIndex((c) => c.name.toLowerCase() === clean.toLowerCase());
    const cleanImg = (imageUrl || '').trim();

    if (idx > -1) {
      if (cleanImg) {
        items[idx] = { ...items[idx], imageUrl: cleanImg, image: cleanImg };
        this.saveCategories(items);
      }
      return items[idx].name;
    }

    const finalImg = cleanImg || FoodService.FALLBACK_CATEGORY_IMAGE;
    items.push({ name: clean, imageUrl: finalImg, image: finalImg });
    this.saveCategories(items);
    return clean;
  }

  updateCategory(oldName: string, newName: string, imageUrl?: string): void {
    const cleanNew = (newName || '').trim();
    if (!cleanNew) return;
    const items = this.loadCategoryItems().map((c) => {
      if (c.name.toLowerCase() !== oldName.toLowerCase()) return c;
      const img = (imageUrl || '').trim() || c.imageUrl || FoodService.FALLBACK_CATEGORY_IMAGE;
      return { name: cleanNew, imageUrl: img, image: img };
    });
    this.saveCategories(items);
  }

  deleteCategory(name: string): void {
    const items = this.loadCategoryItems().filter(
      (c) => c.name.toLowerCase() !== name.toLowerCase()
    );
    this.saveCategories(items);
  }

  constructor() {
    this.foodsSubject = new BehaviorSubject<FoodItem[]>(this.getStoredFoods());
    this.foods$ = this.foodsSubject.asObservable();
    const initialCategoryItems = this.loadCategoryItems();
    this.categoryItemsSubject = new BehaviorSubject<CategoryItem[]>(initialCategoryItems);
    this.categoryItems$ = this.categoryItemsSubject.asObservable();
    this.categoriesSubject = new BehaviorSubject<string[]>(initialCategoryItems.map(c => c.name));
    this.categories$ = this.categoriesSubject.asObservable();

    window.addEventListener('storage', (e) => {
      if (e.key === 'app_foods' && e.newValue) {
        try {
          this.foodsSubject.next(this.ensureStockDefaults(JSON.parse(e.newValue)).foods);
        } catch {}
      }
      if (e.key === 'app_category_items' && e.newValue) {
        try {
          const parsed: CategoryItem[] = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            this.categoryItemsSubject.next(parsed);
            this.categoriesSubject.next(parsed.map(c => c.name));
          }
        } catch {}
      } else if (e.key === 'app_categories' && e.newValue) {
        try {
          this.categoriesSubject.next(JSON.parse(e.newValue));
        } catch {}
      }
    });

    this.cloudSync.changes$.subscribe(({ key, data }) => {
      if (key === 'app_foods' && Array.isArray(data)) {
        this.foodsSubject.next(this.ensureStockDefaults(data).foods);
      }
      if (key === 'app_category_items' && Array.isArray(data)) {
        this.categoryItemsSubject.next(data);
        this.categoriesSubject.next(data.map((c: CategoryItem) => c.name));
      } else if (key === 'app_categories' && Array.isArray(data)) {
        this.categoriesSubject.next(data);
      }
    });
  }

  private ensureStockDefaults(foods: FoodItem[]): { foods: FoodItem[]; changed: boolean } {
    let changed = false;
    const normalized = (foods || []).map((food) => {
      if (typeof food.stock !== 'number' || isNaN(food.stock)) {
        changed = true;
        return {
          ...food,
          stock: food.available === false ? 0 : 20
        };
      }
      return food;
    });
    return { foods: normalized, changed };
  }

  getStoredFoods(): FoodItem[] {
    try {
      const data = localStorage.getItem('app_foods');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = this.migrateLegacySeeds(parsed);
          const { foods: withStock, changed: stockChanged } = this.ensureStockDefaults(migrated);
          if (migrated !== parsed || stockChanged) {
            localStorage.setItem('app_foods', JSON.stringify(withStock));
          }
          return withStock;
        }
      }
    } catch {}

    localStorage.setItem('app_foods', JSON.stringify(this.initialFoods));
    return this.initialFoods;
  }

  private migrateLegacySeeds(foods: FoodItem[]): FoodItem[] {
    let changed = false;
    const migrated = foods.map((food) => {
      const fix = food && food.name ? this.legacySeedNames[food.name.toLowerCase()] : undefined;
      if (fix) {
        changed = true;
        return { ...food, name: fix.name, description: fix.description };
      }
      return food;
    });
    return changed ? migrated : foods;
  }

  getFoods(): FoodItem[] {
    return this.foodsSubject.value.length > 0 ? this.foodsSubject.value : this.getStoredFoods();
  }

  private saveAndSync(updated: FoodItem[]): Promise<void> {
    this.foodsSubject.next(updated);
    localStorage.setItem('app_foods', JSON.stringify(updated));
    return this.cloudSync.pushKey('app_foods', updated);
  }

  async addFood(newFood: Omit<FoodItem, 'id'> | FoodItem): Promise<void> {
    const current = this.getFoods();
    const nextId = current.length > 0 ? Math.max(...current.map(f => Number(f.id) || 0)) + 1 : 1;

    const customOptions = (newFood as any)['options'];
    const resolvedOptions = Array.isArray(customOptions) && customOptions.length > 0
      ? customOptions
      : ['Regular', 'Spicy'];

    const resolvedStock =
      typeof newFood.stock === 'number' && !isNaN(newFood.stock)
        ? Math.max(0, Math.floor(newFood.stock))
        : 20;

    const createdItem: FoodItem = {
      ...newFood,
      id: (newFood as any).id || nextId,
      stock: resolvedStock,
      available: newFood.available !== undefined ? newFood.available : resolvedStock > 0,
      rating: newFood.rating ?? 5.0,
      soldCount: newFood.soldCount !== undefined ? newFood.soldCount : 0,
      options: resolvedOptions,
      images: (newFood as any).images || [(newFood as any).imageUrl],
      reviews: newFood.reviews || []
    };

    await this.saveAndSync([createdItem, ...current]);
  }

  async deleteFood(id: number): Promise<void> {
    const updated = this.getFoods().filter(item => item.id !== id);
    await this.saveAndSync(updated);
  }

  async updatePrice(id: number, newPrice: number): Promise<void> {
    const updated = this.getFoods().map(item => item.id === id ? { ...item, price: newPrice } : item);
    await this.saveAndSync(updated);
  }

  async toggleAvailability(id: number): Promise<void> {
    const updated = this.getFoods().map(item => {
      if (item.id !== id) return item;
      const nextAvailable = !item.available;
      const currentStock = typeof item.stock === 'number' ? item.stock : 0;
      return {
        ...item,
        available: nextAvailable,
        stock: nextAvailable && currentStock <= 0 ? 20 : item.stock
      };
    });
    await this.saveAndSync(updated);
  }

  async updateFoodItem(updatedFood: FoodItem): Promise<void> {
    const updated = this.getFoods().map(item => item.id === updatedFood.id ? { ...updatedFood } : item);
    await this.saveAndSync(updated);
  }

  updateFood(food: FoodItem): void {
    this.updateFoodItem(food);
  }

  /** Deducts ordered quantities from `stock` and increments `soldCount` ("sold today"). */
  async recordOrderItems(items: CartItem[]): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) return;

    const qtyMap = new Map<string, number>();
    for (const cartItem of items) {
      const id = cartItem?.food?.id;
      if (id === undefined || id === null) continue;
      const key = String(id);
      const qty = Math.max(1, Number(cartItem.quantity) || 1);
      qtyMap.set(key, (qtyMap.get(key) || 0) + qty);
    }

    if (qtyMap.size === 0) return;

    let changed = false;
    const updated = this.getFoods().map((food) => {
      const orderedQty = qtyMap.get(String(food.id));
      if (!orderedQty) return food;

      changed = true;
      const currentStock =
        typeof food.stock === 'number' && !isNaN(food.stock)
          ? Math.max(0, Math.floor(food.stock))
          : (food.available === false ? 0 : 20);
      const nextStock = Math.max(0, currentStock - orderedQty);

      const currentSold =
        typeof food.soldCount === 'number' && !isNaN(food.soldCount)
          ? Math.max(0, Math.floor(food.soldCount))
          : (parseInt(String(food.soldCount || '0').replace(/[^0-9]/g, ''), 10) || 0);
      const nextSold = currentSold + orderedQty;

      return {
        ...food,
        stock: nextStock,
        available: nextStock > 0,
        soldCount: nextSold
      };
    });

    if (changed) {
      await this.saveAndSync(updated);
    }
  }

  async addReviewToFood(foodId: any, review: FoodReview): Promise<void> {
    const updated = this.getFoods().map(item => {
      if (String(item.id) === String(foodId)) {
        const revs = item.reviews || [];
        const newRevs = [review, ...revs];
        const avg = Number((newRevs.reduce((sum, r) => sum + r.rating, 0) / newRevs.length).toFixed(1));
        return { ...item, rating: avg, reviews: newRevs };
      }
      return item;
    });

    await this.saveAndSync(updated);
  }
}