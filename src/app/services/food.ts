import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { FoodItem, FoodReview } from '../models/food.model';

@Injectable({
  providedIn: 'root'
})
export class FoodService {
  private initialFoods: FoodItem[] = [
    {
      id: 1,
      name: 'Chicken Adobo',
      category: 'Chicken',
      description: 'Slow-simmered chicken in soy sauce, vinegar, garlic, and bay leaf, served with rice.',
      price: 100,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      images: [
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=1000',
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1000'
      ],
      available: true,
      soldCount: '120+ sold',
      options: ['Regular', 'Spicy'],
      reviews: []
    },
    {
      id: 2,
      name: 'Vanilla Ice Cream',
      category: 'Desserts',
      description: 'Creamy vanilla ice cream served in a cup or a sugar cone.',
      price: 30,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500',
      images: [
        'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500',
        'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=1000'
      ],
      available: true,
      soldCount: '80+ sold',
      options: ['Regular Cup', 'Sugar Cone'],
      reviews: []
    },
    {
      id: 3,
      name: 'Iced Water',
      category: 'Drinks',
      description: 'Chilled filtered water served with ice.',
      price: 20,
      rating: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500',
      images: [
        'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500'
      ],
      available: true,
      soldCount: '200+ sold',
      options: ['Normal Cold', 'With Extra Ice'],
      reviews: []
    }
  ];

  /** Placeholder names/descriptions written by earlier versions of the app. */
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

  private foodsSubject: BehaviorSubject<FoodItem[]>;
  public foods$: Observable<FoodItem[]>;

  constructor() {
    this.foodsSubject = new BehaviorSubject<FoodItem[]>(this.getStoredFoods());
    this.foods$ = this.foodsSubject.asObservable();

    window.addEventListener('storage', (e) => {
      if (e.key === 'app_foods' && e.newValue) {
        try {
          this.foodsSubject.next(JSON.parse(e.newValue));
        } catch {}
      }
    });
  }

  getStoredFoods(): FoodItem[] {
    try {
      const data = localStorage.getItem('app_foods');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = this.migrateLegacySeeds(parsed);
          if (migrated !== parsed) {
            localStorage.setItem('app_foods', JSON.stringify(migrated));
          }
          return migrated;
        }
      }
    } catch {}

    localStorage.setItem('app_foods', JSON.stringify(this.initialFoods));
    return this.initialFoods;
  }

  /** Renames placeholder seed items left over from earlier versions. */
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

  async addFood(newFood: Omit<FoodItem, 'id'> | FoodItem): Promise<void> {
    const current = this.getFoods();
    const nextId = current.length > 0 ? Math.max(...current.map(f => f.id)) + 1 : 1;

    const customOptions = (newFood as any)['options'];
    const resolvedOptions = Array.isArray(customOptions) && customOptions.length > 0
      ? customOptions
      : ['Regular', 'Spicy'];

    const createdItem: FoodItem = {
      ...newFood,
      id: (newFood as any).id || nextId,
      available: true,
      rating: 5.0,
      soldCount: '0 sold',
      options: resolvedOptions,
      images: (newFood as any).images || [(newFood as any).imageUrl],
      reviews: []
    };

    const updated = [createdItem, ...current];
    this.foodsSubject.next(updated);
    localStorage.setItem('app_foods', JSON.stringify(updated));
  }

  async deleteFood(id: number): Promise<void> {
    const current = this.getFoods();
    const updated = current.filter(item => item.id !== id);
    this.foodsSubject.next(updated);
    localStorage.setItem('app_foods', JSON.stringify(updated));
  }

  async updatePrice(id: number, newPrice: number): Promise<void> {
    const current = this.getFoods();
    const updated = current.map(item => item.id === id ? { ...item, price: newPrice } : item);
    this.foodsSubject.next(updated);
    localStorage.setItem('app_foods', JSON.stringify(updated));
  }

  async toggleAvailability(id: number): Promise<void> {
    const current = this.getFoods();
    const updated = current.map(item => item.id === id ? { ...item, available: !item.available } : item);
    this.foodsSubject.next(updated);
    localStorage.setItem('app_foods', JSON.stringify(updated));
  }

  async updateFoodItem(updatedFood: FoodItem): Promise<void> {
    const current = this.getFoods();
    const updated = current.map(item => item.id === updatedFood.id ? { ...updatedFood } : item);
    this.foodsSubject.next(updated);
    localStorage.setItem('app_foods', JSON.stringify(updated));
  }

  updateFood(food: FoodItem): void {
    this.updateFoodItem(food);
  }

  // --- ADD REVIEW METHOD (Resolves TS2305 & TS2571 in order.ts) ---
  async addReviewToFood(foodId: number, review: FoodReview): Promise<void> {
    const current = this.getFoods();
    const updated = current.map(item => {
      if (item.id === foodId) {
        const revs = item.reviews || [];
        const newRevs = [review, ...revs];
        const avg = Number((newRevs.reduce((sum, r) => sum + r.rating, 0) / newRevs.length).toFixed(1));
        return { ...item, rating: avg, reviews: newRevs };
      }
      return item;
    });

    this.foodsSubject.next(updated);
    localStorage.setItem('app_foods', JSON.stringify(updated));
  }
}