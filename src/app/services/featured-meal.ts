import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type MealSchedule = 'today' | 'tomorrow' | 'friday' | 'weekend';

/**
 * A meal in the customer's "Daily Featured Meals" slider.
 * The admin manages these via the FEATURED MEALS dashboard tab;
 * `schedule` decides which day group the meal appears in.
 */
export interface FeaturedMealItem {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  image: string;
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
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
    schedule: 'today'
  },
  {
    id: 904,
    title: 'Bistek Tagalog Special',
    subtitle: 'Beef Steak with Onion Rings',
    description: 'Thinly sliced tender beef marinated in calamansi and soy sauce topped with fresh onions.',
    price: 140,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600',
    schedule: 'today'
  },
  {
    id: 902,
    title: 'Chicken Sinigang Tomorrow',
    subtitle: 'Sour & Savory Tamarind Broth',
    description: 'Tangy and comforting soup with fresh kangkong, radish, tomatoes, and tender chicken.',
    price: 130,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600',
    schedule: 'tomorrow'
  },
  {
    id: 905,
    title: 'Creamy Chicken Pastel',
    subtitle: 'Rich Cream Stew with Sausage',
    description: 'Hearty chicken stew cooked in creamy white sauce with carrots, potatoes, and mushrooms.',
    price: 145,
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600',
    schedule: 'tomorrow'
  },
  {
    id: 903,
    title: 'Crispy Lechon Kawali',
    subtitle: 'Golden Crisp Pork Belly',
    description: 'Deep-fried pork belly with super crunchy skin and juicy meat served with liver sauce.',
    price: 160,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600',
    schedule: 'friday'
  },
  {
    id: 906,
    title: 'Inihaw na Bangus Feast',
    subtitle: 'Stuffed Grilled Milkfish',
    description: 'Boneless grilled milkfish stuffed with fresh tomatoes, onions, ginger, and spices.',
    price: 155,
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600',
    schedule: 'friday'
  },
  {
    id: 907,
    title: 'Special Beef Bulalo',
    subtitle: 'Slow-Boiled Marrow & Shank',
    description: 'Rich and hearty broth simmered for hours with beef shank, sweet corn, and cabbage.',
    price: 190,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600',
    schedule: 'weekend'
  },
  {
    id: 908,
    title: 'Sizzling Pork Sisig',
    subtitle: 'Crispy Sizzling Plate',
    description: 'Savory minced pork with calamansi, chili, egg, and mayonnaise on a hot plate.',
    price: 150,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
    schedule: 'weekend'
  }
];

@Injectable({
  providedIn: 'root'
})
export class FeaturedMealService {
  private mealsSubject = new BehaviorSubject<FeaturedMealItem[]>(this.readMeals());
  public meals$: Observable<FeaturedMealItem[]> = this.mealsSubject.asObservable();

  constructor() {
    // Sync when meals are edited in another tab (admin <-> customer).
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            this.mealsSubject.next(parsed);
          }
        } catch {}
      }
    });
  }

  private readMeals(): FeaturedMealItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
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
  }

  updateMeal(meal: FeaturedMealItem): void {
    const updated = this.mealsSubject.value.map(m =>
      m.id === meal.id ? { ...meal } : m
    );
    this.mealsSubject.next(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  deleteMeal(id: number): void {
    const updated = this.mealsSubject.value.filter(m => m.id !== id);
    this.mealsSubject.next(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}
