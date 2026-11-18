import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CloudSyncService } from './cloud-sync';

export type MealSchedule = 'today' | 'tomorrow' | 'weekend';

export interface FeaturedMealVariation {
  name: string;
  size?: string;
  price: number;
}

export interface FeaturedMealItem {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  stock?: number;
  image: string;
  images?: string[];
  variations?: FeaturedMealVariation[];
  sizes?: string[];
  schedule: MealSchedule;
}

const STORAGE_KEY = 'app_featured_meals';

const SEED_MEALS: FeaturedMealItem[] = [
  {
    id: 901,
    title: 'Adobo Today',
    subtitle: 'Classic Filipino Chicken Adobo',
    description: 'Slow-simmered tender chicken braised in garlic, bay leaves, soy sauce, and peppercorns.',
    price: 100,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
    images: ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600'],
    variations: [{ name: 'Regular', size: 'Regular', price: 100 }],
    sizes: ['Regular'],
    schedule: 'today'
  },
  {
    id: 904,
    title: 'Bistek Tagalog Special',
    subtitle: 'Beef Steak with Onion Rings',
    description: 'Thinly sliced tender beef marinated in calamansi and soy sauce topped with fresh onions.',
    price: 140,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600',
    images: ['https://images.unsplash.com/photo-1544025162-d76694265947?w=600'],
    variations: [{ name: 'Regular', size: 'Regular', price: 140 }],
    sizes: ['Regular'],
    schedule: 'today'
  },
  {
    id: 902,
    title: 'Chicken Sinigang Tomorrow',
    subtitle: 'Sour & Savory Tamarind Broth',
    description: 'Tangy and comforting soup with fresh kangkong, radish, tomatoes, and tender chicken.',
    price: 130,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600',
    images: ['https://images.unsplash.com/photo-1547592180-85f173990554?w=600'],
    variations: [{ name: 'Regular', size: 'Regular', price: 130 }],
    sizes: ['Regular'],
    schedule: 'tomorrow'
  },
  {
    id: 905,
    title: 'Creamy Chicken Pastel',
    subtitle: 'Rich Cream Stew with Sausage',
    description: 'Hearty chicken stew cooked in creamy white sauce with carrots, potatoes, and mushrooms.',
    price: 145,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600',
    images: ['https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600'],
    variations: [{ name: 'Regular', size: 'Regular', price: 145 }],
    sizes: ['Regular'],
    schedule: 'tomorrow'
  },
  {
    id: 907,
    title: 'Special Beef Bulalo',
    subtitle: 'Slow-Boiled Marrow & Shank',
    description: 'Rich and hearty broth simmered for hours with beef shank, sweet corn, and cabbage.',
    price: 190,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600',
    images: ['https://images.unsplash.com/photo-1547592180-85f173990554?w=600'],
    variations: [{ name: 'Regular', size: 'Regular', price: 190 }],
    sizes: ['Regular'],
    schedule: 'weekend'
  },
  {
    id: 908,
    title: 'Sizzling Pork Sisig',
    subtitle: 'Crispy Sizzling Plate',
    description: 'Savory minced pork with calamansi, chili, egg, and mayonnaise on a hot plate.',
    price: 150,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
    images: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600'],
    variations: [{ name: 'Regular', size: 'Regular', price: 150 }],
    sizes: ['Regular'],
    schedule: 'weekend'
  }
];

@Injectable({
  providedIn: 'root'
})
export class FeaturedMealService {
  private cloudSync = inject(CloudSyncService);

  private mealsSubject = new BehaviorSubject<FeaturedMealItem[]>(this.readMeals());
  public meals$: Observable<FeaturedMealItem[]> = this.mealsSubject.asObservable();

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            this.mealsSubject.next(this.sanitizeMeals(parsed));
          }
        } catch {}
      }
    });

    this.cloudSync.changes$.subscribe(({ key, data }) => {
      if (key === STORAGE_KEY && Array.isArray(data)) {
        this.mealsSubject.next(this.sanitizeMeals(data));
      }
    });
  }

  private sanitizeMeals(list: any[]): FeaturedMealItem[] {
    return list.filter(
      (m) => m && (m.schedule === 'today' || m.schedule === 'tomorrow' || m.schedule === 'weekend')
    );
  }

  private readMeals(): FeaturedMealItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const sanitized = this.sanitizeMeals(parsed);
          if (sanitized.length > 0) {
            if (sanitized.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
            }
            return sanitized;
          }
        }
      }
    } catch {}

    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_MEALS));
    return SEED_MEALS;
  }

  getMeals(): FeaturedMealItem[] {
    return this.mealsSubject.value;
  }

  addMeal(meal: Omit<FeaturedMealItem, 'id'> & { id?: number }): void {
    const created: FeaturedMealItem = { ...meal, id: meal.id || Date.now() };
    const updated = [created, ...this.mealsSubject.value];
    this.mealsSubject.next(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.cloudSync.pushKey(STORAGE_KEY, updated);
  }

  updateMeal(meal: FeaturedMealItem): void {
    const updated = this.mealsSubject.value.map(m =>
      m.id === meal.id ? { ...meal } : m
    );
    this.mealsSubject.next(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.cloudSync.pushKey(STORAGE_KEY, updated);
  }

  deleteMeal(id: number): void {
    const updated = this.mealsSubject.value.filter(m => m.id !== id);
    this.mealsSubject.next(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.cloudSync.pushKey(STORAGE_KEY, updated);
  }
}