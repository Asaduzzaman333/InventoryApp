/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- Local User Data (Replace Firebase Auth) ---
const appUsers: User[] = [
  { email: 'admin@gmail.com', password_raw: 'Armada25', role: 'admin' as UserRole, username: 'admin' },
  { email: 'user@example.com', password_raw: 'password123', role: 'user' as UserRole, username: 'testuser' },
];
// Note: Storing plain passwords is not secure for production. This is for demonstration.
// In a real app, use password hashing.
// ----------------------------------------------------

const ITEMS_STORAGE_KEY = 'inventoryApp_items';
const CATEGORIES_STORAGE_KEY = 'inventoryApp_categories';
const USERS_STORAGE_KEY = 'inventoryApp_users'; // For storing registered users locally

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;
type Size = typeof SIZES[number];
type UserRole = 'admin' | 'user' | null;

interface User {
  email: string;
  password_raw: string; // Storing raw for simplicity, hash in real app
  role: UserRole;
  username: string;
}

interface CategoryDefinition {
  id: string; // Unique ID, can be category name for simplicity if unique
  name: string;
  subcategories: string[];
}

interface InventoryItem {
  id: string; // Unique ID, e.g., SKU or generated
  name: string;
  sku: string;
  category: string;
  subcategory: string;
  sizes: Record<Size, number>;
  price: number;
  description?: string;
  imageUrl?: string; // Base64 encoded image string
}

// --- INITIAL DATA (for seeding if localStorage is empty) ---
const INITIAL_CATEGORIES_DATA: Omit<CategoryDefinition, 'id'>[] = [
  { name: "Men", subcategories: ["Men's Oxford", "Men's Cuban", "Formal Shirt", "Winter Collection", "Casual Wear", "Default"] },
  { name: "Women", subcategories: ["Formal Wear", "Casual Wear", "Default"] },
  { name: "Uncategorized", subcategories: ["Default"] }
];

const defaultSizesSeed = SIZES.reduce((acc, size) => { acc[size] = 0; return acc; }, {} as Record<Size, number>);
const INITIAL_ITEMS_DATA: Omit<InventoryItem, 'id' | 'imageUrl'>[] = [
    { name: 'Classic T-Shirt', sku: 'TS-001', category: 'Men', subcategory: 'Casual Wear', sizes: { ...defaultSizesSeed, XS: 5, S: 10, M: 15, L: 20, XL: 15, XXL: 5, '3XL': 2 }, price: 25.00, description: 'Comfortable cotton t-shirt'},
    { name: 'Denim Jeans', sku: 'JN-002', category: 'Men', subcategory: 'Casual Wear', sizes: { ...defaultSizesSeed, XS: 2, S: 5, M: 10, L: 12, XL: 8, XXL: 3, '3XL': 1 }, price: 60.00, description: 'Slim-fit denim jeans'},
    { name: 'Hoodie Pro', sku: 'HD-003', category: 'Men', subcategory: 'Winter Collection', sizes: { ...defaultSizesSeed, XS: 3, S: 8, M: 12, L: 15, XL: 10, XXL: 6, '3XL': 3 }, price: 45.00, description: 'Warm fleece hoodie'},
    { name: 'Elegant Blouse', sku: 'BL-001', category: 'Women', subcategory: 'Formal Wear', sizes: { ...defaultSizesSeed, XS: 4, S: 10, M: 15, L: 10, XL: 5, XXL: 2, '3XL': 1 }, price: 35.00, description: 'Silk formal blouse'},
    { name: 'Summer Dress', sku: 'DR-002', category: 'Women', subcategory: 'Casual Wear', sizes: { ...defaultSizesSeed, XS: 6, S: 12, M: 18, L: 15, XL: 7, XXL: 4, '3XL': 2 }, price: 50.00, description: 'Light cotton summer dress'},
];
// -------------------------------------------------------------

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const calculateTotalQuantity = (sizes: Record<Size, number>): number => {
  return SIZES.reduce((sum, size) => sum + (sizes[size] || 0), 0);
};

interface ProductStockViewProps {
  items: InventoryItem[];
  allCategories: CategoryDefinition[];
  selectedCategoryName: string | null;
  selectedSubcategoryName: string | null;
  onSelectCategory: (categoryName: string) => void;
  onSelectSubcategory: (categoryName: string, subcategoryName: string) => void;
  onNavigateBack: () => void;
  onSellItemSize: (itemId: string, size: Size) => void;
  userRole: UserRole;
  getCategoryItemCount: (categoryName: string, subcategoryName: string) => number;
}

const ProductStockView: React.FC<ProductStockViewProps> = ({
  items,
  allCategories,
  selectedCategoryName,
  selectedSubcategoryName,
  onSelectCategory,
  onSelectSubcategory,
  onNavigateBack,
  onSellItemSize,
  userRole,
  getCategoryItemCount,
}) => {
  if (!selectedCategoryName) {
    return (
      <div className="category-selection-container">
        <h2>Shop by Category</h2>
        {allCategories.filter(cat => cat.name !== 'Uncategorized' || cat.subcategories.some(subcat => getCategoryItemCount(cat.name, subcat) > 0)).length === 0 && (
           <p className="empty-state-text">No categories with products available.</p>
        )}
        <div className="category-grid">
          {allCategories.map(category => {
             const totalItemsInCategory = category.subcategories.reduce((sum, subcat) => sum + getCategoryItemCount(category.name, subcat), 0);
             if (category.name === 'Uncategorized' && totalItemsInCategory === 0 && !category.subcategories.includes('Default')) { 
                 return null;
             }
             if (category.name === 'Uncategorized' && totalItemsInCategory === 0 && !(category.subcategories.length === 1 && category.subcategories[0] === 'Default')) {
                return null;
             }
            return (
              <button
                key={category.id || category.name}
                onClick={() => onSelectCategory(category.name)}
                className="category-card btn"
                aria-label={`View products in ${category.name}`}
              >
                {category.name}
                <span className="item-count-badge">{totalItemsInCategory} items</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!selectedSubcategoryName) {
    const category = allCategories.find(cat => cat.name === selectedCategoryName);
    if (!category) return <p className="empty-state-text">Category not found.</p>;
    const visibleSubcategories = category.subcategories.filter(subcat => getCategoryItemCount(category.name, subcat) > 0 || subcat === 'Default');
    return (
      <div className="category-selection-container">
        <div className="navigation-header">
          <button onClick={onNavigateBack} className="btn btn-secondary btn-sm btn-back-nav">
            &larr; Back to Categories
          </button>
          <h2>{selectedCategoryName} &gt; Select Subcategory</h2>
        </div>
         {visibleSubcategories.length === 0 && (
           <p className="empty-state-text">No subcategories with products available in {category.name}.</p>
        )}
        <div className="category-grid">
          {category.subcategories.map(subcategory => { 
            const itemCount = getCategoryItemCount(category.name, subcategory);
            if (itemCount === 0 && subcategory !== 'Default') return null;
            if (category.name === 'Uncategorized' && subcategory === 'Default' && itemCount === 0 && category.subcategories.length > 1) {
              // Hide if Uncategorized/Default is empty but other Uncategorized subcats exist
            }
            return (
              <button
                key={subcategory}
                onClick={() => onSelectSubcategory(category.name, subcategory)}
                className="category-card btn"
                aria-label={`View products in ${subcategory}`}
              >
                {subcategory}
                <span className="item-count-badge">{itemCount} items</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="product-stock-view-container">
      <div className="navigation-header full-width-header">
        <button onClick={onNavigateBack} className="btn btn-secondary btn-sm btn-back-nav">
          &larr; Back to Subcategories
        </button>
        <h2>{selectedCategoryName} &gt; {selectedSubcategoryName}</h2>
      </div>
      {items.length === 0 && (
        <div className="product-stock-view-container empty-state full-span-empty">
          <h2>No products found in this subcategory.</h2>
          <p>Admins can add products in the admin panel.</p>
        </div>
      )}
      {items.map(item => (
        <div key={item.id} className="product-stock-card">
          {item.imageUrl && ( // imageUrl is now Base64
            <div className="product-image-container">
              <img src={item.imageUrl} alt={item.name} className="product-image" />
            </div>
          )}
          <h3>{item.name}</h3>
          <p className="sku">SKU: {item.sku}</p>
           <p className="price">Price: ${item.price.toFixed(2)}</p>
          {item.description && <p className="description">{item.description}</p>}
          <div className="sizes-overview">
            <h4>Available Stock by Size:</h4>
            <ul>
              {SIZES.map(size => (
                <li key={size}>
                  <span className="size-label">{size}:</span>
                  <span className="size-quantity">{item.sizes[size] || 0}</span>
                  {userRole === 'admin' && (
                    <button
                      onClick={() => onSellItemSize(item.id!, size)}
                      disabled={(item.sizes[size] || 0) === 0}
                      className="btn btn-sell-size"
                      aria-label={`Sell one ${size} of ${item.name}`}
                    >
                      Sell 1
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
};

interface LoginViewProps {
  onLogin: (email: string, password_raw: string) => Promise<void>;
  loginError: string | null;
  onSwitchToRegister: () => void;
  isLoggingIn: boolean;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, loginError, onSwitchToRegister, isLoggingIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onLogin(email, password);
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Login</h2>
        {loginError && <p className="login-error-message">{loginError}</p>}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-required="true"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-required="true"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-login" disabled={isLoggingIn}>
          {isLoggingIn ? 'Logging in...' : 'Login'}
        </button>
        <p className="auth-switch-message">
          Don't have an account?{' '}
          <button type="button" onClick={onSwitchToRegister} className="btn-link" disabled={isLoggingIn}>
            Register here
          </button>
        </p>
      </form>
    </div>
  );
};

interface RegistrationViewProps {
  onRegister: (email: string, username: string, password_raw: string, confirmPassword_raw: string) => Promise<void>;
  registrationMessage: { type: 'success' | 'error'; text: string } | null;
  onSwitchToLogin: () => void;
  isRegistering: boolean;
}

const RegistrationView: React.FC<RegistrationViewProps> = ({ onRegister, registrationMessage, onSwitchToLogin, isRegistering }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onRegister(email, username, password, confirmPassword);
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Register</h2>
        {registrationMessage && (
          <p className={registrationMessage.type === 'success' ? 'registration-success-message' : 'login-error-message'}>
            {registrationMessage.text}
          </p>
        )}
        <div className="form-group">
          <label htmlFor="reg-email">Email</label>
          <input
            type="email"
            id="reg-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-required="true"
          />
        </div>
         <div className="form-group">
          <label htmlFor="reg-username">Username</label>
          <input
            type="text"
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            aria-required="true"
          />
        </div>
        <div className="form-group">
          <label htmlFor="reg-password">Password</label>
          <input
            type="password"
            id="reg-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-required="true"
            minLength={6}
          />
        </div>
        <div className="form-group">
          <label htmlFor="reg-confirm-password">Confirm Password</label>
          <input
            type="password"
            id="reg-confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            aria-required="true"
            minLength={6}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-login" disabled={isRegistering}>
          {isRegistering ? 'Registering...' : 'Register'}
        </button>
         <p className="auth-switch-message">
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin} className="btn-link" disabled={isRegistering}>
            Login here
          </button>
        </p>
      </form>
    </div>
  );
};

interface AdminCategoryManagerProps {
  categories: CategoryDefinition[];
  onAddCategory: (categoryName: string) => Promise<void>;
  onDeleteCategory: (categoryId: string, categoryName: string) => Promise<void>;
  onAddSubcategory: (categoryId: string, categoryName: string, subcategoryName: string) => Promise<void>;
  onDeleteSubcategory: (categoryId: string, categoryName: string, subcategoryName: string) => Promise<void>;
  items: InventoryItem[];
}

const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({
  categories,
  onAddCategory,
  onDeleteCategory,
  onAddSubcategory,
  onDeleteSubcategory,
  items
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [selectedCategoryForNewSub, setSelectedCategoryForNewSub] = useState<string>(categories[0]?.id || '');

  useEffect(() => {
    if (categories.length > 0 && !categories.find(c => c.id === selectedCategoryForNewSub)) {
      setSelectedCategoryForNewSub(categories[0].id!);
    } else if (categories.length === 0) {
      setSelectedCategoryForNewSub('');
    }
  }, [categories, selectedCategoryForNewSub]);

  const handleAddCategory = async () => {
    if (newCategoryName.trim() && !categories.find(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      await onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
    } else {
      alert("Category name cannot be empty or already exists.");
    }
  };

  const handleAddSubcategory = async () => {
    const category = categories.find(cat => cat.id === selectedCategoryForNewSub);
    if (category && newSubcategoryName.trim() && !category.subcategories.find(sub => sub.toLowerCase() === newSubcategoryName.trim().toLowerCase())) {
      await onAddSubcategory(category.id!, category.name, newSubcategoryName.trim());
      setNewSubcategoryName('');
    } else {
       alert("Subcategory name cannot be empty, already exists in this category, or no category is selected.");
    }
  };
  
  const isCategoryInUse = (categoryName: string): boolean => {
    return items.some(item => item.category === categoryName);
  };

  const isSubcategoryInUse = (categoryName: string, subcategoryName: string): boolean => {
    return items.some(item => item.category === categoryName && item.subcategory === subcategoryName);
  };

  return (
    <div className="admin-category-manager">
      <h3>Manage Categories & Subcategories</h3>
      <div className="category-forms-grid">
        <div className="form-section">
          <h4>Add New Category</h4>
          <div className="form-group inline-form-group">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category Name"
              aria-label="New category name"
            />
            <button onClick={handleAddCategory} className="btn btn-success btn-sm">Add Category</button>
          </div>
        </div>

        <div className="form-section">
          <h4>Add New Subcategory</h4>
          {categories.filter(c => c.name !== 'Uncategorized').length > 0 ? (
            <>
              <div className="form-group">
                <select
                  value={selectedCategoryForNewSub}
                  onChange={(e) => setSelectedCategoryForNewSub(e.target.value)}
                  aria-label="Select category to add subcategory to"
                >
                  {categories.filter(c => c.name !== 'Uncategorized').map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="form-group inline-form-group">
                <input
                  type="text"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  placeholder="Subcategory Name"
                  aria-label="New subcategory name"
                />
                <button onClick={handleAddSubcategory} className="btn btn-success btn-sm" disabled={!selectedCategoryForNewSub}>Add Subcategory</button>
              </div>
            </>
          ) : <p>Create a non-'Uncategorized' category first to add subcategories.</p>}
        </div>
      </div>

      <h4>Existing Categories</h4>
      {categories.length === 0 && <p>No categories defined yet.</p>}
      <ul className="category-list">
        {categories.map(category => (
          <li key={category.id} className="category-list-item">
            <div className="category-header">
              <strong>{category.name}</strong>
              <button
                onClick={async () => {
                  if (category.name === 'Uncategorized') {
                    alert('The "Uncategorized" category cannot be deleted.');
                    return;
                  }
                  const inUse = isCategoryInUse(category.name);
                  let confirmMessage = `Are you sure you want to delete category "${category.name}" and all its subcategories?`;
                  if (inUse) {
                    confirmMessage += `\n\nProducts currently in this category will be moved to "Uncategorized / Default".`;
                  }
                  if (window.confirm(confirmMessage)) {
                    await onDeleteCategory(category.id!, category.name);
                  }
                }}
                className="btn btn-danger btn-xs"
                disabled={category.name === 'Uncategorized'}
                aria-label={`Delete category ${category.name}`}
              >
                Delete Category
              </button>
            </div>
            {category.subcategories.length > 0 ? (
              <ul className="subcategory-list">
                {category.subcategories.map(subcategory => (
                  <li key={subcategory} className="subcategory-list-item">
                    <span>{subcategory}</span>
                    <button
                      onClick={async () => {
                        if (category.name === 'Uncategorized' && subcategory === 'Default') {
                          alert('The "Default" subcategory within "Uncategorized" cannot be deleted.');
                          return;
                        }
                         if (subcategory === 'Default' && category.name !== 'Uncategorized' && category.subcategories.length === 1) {
                            alert(`The "Default" subcategory cannot be deleted from "${category.name}" if it's the only subcategory. Add another subcategory first or delete the parent category.`);
                            return;
                         }
                        const inUse = isSubcategoryInUse(category.name, subcategory);
                        let confirmMessage = `Are you sure you want to delete subcategory "${subcategory}" from "${category.name}"?`;
                        if (inUse) {
                           confirmMessage += `\n\nProducts currently in this subcategory will be moved to the "Default" subcategory of "${category.name}".`;
                        }
                        if (window.confirm(confirmMessage)) {
                          await onDeleteSubcategory(category.id!, category.name, subcategory);
                        }
                      }}
                      className="btn btn-danger btn-xs"
                      disabled={(category.name === 'Uncategorized' && subcategory === 'Default') || (subcategory === 'Default' && category.subcategories.length === 1 && category.name !== 'Uncategorized')}
                      aria-label={`Delete subcategory ${subcategory} from ${category.name}`}
                    >
                      Delete Sub
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="no-subcategories-text">No subcategories defined for {category.name}. Add one above.</p>}
             {category.name !== 'Uncategorized' && !category.subcategories.includes('Default') && (
                <p className="no-subcategories-text" style={{marginTop: '0.5em', fontSize: '0.8em'}}>
                    Note: A "Default" subcategory will be automatically created if needed for product reassignment.
                </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};


const App: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(appUsers); // Initialize with default users
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registrationMessage, setRegistrationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [authViewMode, setAuthViewMode] = useState<'login' | 'register'>('login');
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  
  const [viewMode, setViewMode] = useState<'admin' | 'stock'>('stock');
  const [selectedCategoryForView, setSelectedCategoryForView] = useState<string | null>(null);
  const [selectedSubcategoryForView, setSelectedSubcategoryForView] = useState<string | null>(null);

  // Load data from localStorage on initial mount
  useEffect(() => {
    setAuthLoading(true);
    // Load users
    const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (storedUsers) {
      setRegisteredUsers(JSON.parse(storedUsers));
    } else {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(appUsers)); // Seed initial users if none stored
    }

    // Load items
    const storedItems = localStorage.getItem(ITEMS_STORAGE_KEY);
    if (storedItems) {
      setItems(JSON.parse(storedItems));
    } else {
      const initialItemsWithIds = INITIAL_ITEMS_DATA.map(item => ({...item, id: generateId() }));
      setItems(initialItemsWithIds);
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(initialItemsWithIds));
    }

    // Load categories
    const storedCategories = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (storedCategories) {
      setCategories(JSON.parse(storedCategories));
    } else {
      const initialCategoriesWithIds = INITIAL_CATEGORIES_DATA.map(cat => ({...cat, id: cat.name })); // Use name as ID for simplicity
      setCategories(initialCategoriesWithIds);
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(initialCategoriesWithIds));
    }
    
    // Check session storage for logged-in user
    const sessionUserEmail = sessionStorage.getItem('currentUserEmail');
    const sessionUserRole = sessionStorage.getItem('currentUserRole') as UserRole;
    const sessionUsername = sessionStorage.getItem('currentUsername');

    if (sessionUserEmail && sessionUserRole) {
      setCurrentUserEmail(sessionUserEmail);
      setCurrentUserRole(sessionUserRole);
      setCurrentUsername(sessionUsername);
      setViewMode(sessionUserRole === 'admin' ? 'admin' : 'stock');
    }
    setAuthLoading(false);
  }, []);

  // Persist items and categories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(registeredUsers));
  }, [registeredUsers]);
  
  // Update view mode based on role
   useEffect(() => {
     if (currentUserRole === 'user' && currentUserEmail) {
        setViewMode('stock');
     } else if (currentUserRole === 'admin' && currentUserEmail && viewMode !== 'admin' && viewMode !== 'stock') { 
        setViewMode('admin');
     }
  }, [currentUserRole, viewMode, currentUserEmail]);


  const handleLogin = async (email: string, password_raw: string) => {
    setIsProcessingAuth(true);
    setLoginError(null);
    
    const user = registeredUsers.find(u => u.email === email && u.password_raw === password_raw);

    if (user) {
      setCurrentUserEmail(user.email);
      setCurrentUserRole(user.role);
      setCurrentUsername(user.username);
      sessionStorage.setItem('currentUserEmail', user.email);
      sessionStorage.setItem('currentUserRole', user.role || '');
      sessionStorage.setItem('currentUsername', user.username);
      setViewMode(user.role === 'admin' ? 'admin' : 'stock');
      setRegistrationMessage(null);
      setSelectedCategoryForView(null);
      setSelectedSubcategoryForView(null);
    } else {
      setLoginError("Invalid email or password.");
    }
    setIsProcessingAuth(false);
  };

  const handleRegister = async (email: string, username: string, password_raw: string, confirmPassword_raw: string) => {
    setIsProcessingAuth(true);
    setRegistrationMessage(null);

    if (password_raw !== confirmPassword_raw) {
      setRegistrationMessage({ type: 'error', text: "Passwords do not match." });
      setIsProcessingAuth(false);
      return;
    }
    if (password_raw.length < 6) {
      setRegistrationMessage({ type: 'error', text: "Password should be at least 6 characters." });
      setIsProcessingAuth(false);
      return;
    }
    if (registeredUsers.find(u => u.email === email)) {
      setRegistrationMessage({ type: 'error', text: "Email already registered." });
      setIsProcessingAuth(false);
      return;
    }
    if (registeredUsers.find(u => u.username === username)) {
      setRegistrationMessage({ type: 'error', text: "Username already taken." });
      setIsProcessingAuth(false);
      return;
    }

    let role: UserRole = 'user';
    const designatedAdminEmail = "admin@gmail.com";

    if (email === designatedAdminEmail) {
        role = 'admin';
    } else {
        // First non-designated admin becomes admin if no other admin exists
        const adminExists = registeredUsers.some(u => u.role === 'admin');
        if (!adminExists) {
            role = 'admin';
        }
    }
    
    const newUser: User = { email, username, password_raw, role };
    setRegisteredUsers(prevUsers => [...prevUsers, newUser]);
    
    setRegistrationMessage({ type: 'success', text: "Registration successful! Please login." });
    setAuthViewMode('login');
    setIsProcessingAuth(false);
  };

  const handleLogout = async () => {
    setCurrentUserEmail(null);
    setCurrentUserRole(null);
    setCurrentUsername(null);
    sessionStorage.removeItem('currentUserEmail');
    sessionStorage.removeItem('currentUserRole');
    sessionStorage.removeItem('currentUsername');
    setViewMode('stock'); 
    setLoginError(null);
    setRegistrationMessage(null);
    setAuthViewMode('login');
    setSelectedCategoryForView(null);
    setSelectedSubcategoryForView(null);
  };

  const openModal = (item: InventoryItem | null = null) => {
    if (currentUserRole !== 'admin') return;
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingItem(null);
  }, []);

  const handleSaveItem = useCallback(async (itemToSave: InventoryItem) => {
    if (currentUserRole !== 'admin' || !itemToSave) return;

    let validatedCategory = itemToSave.category;
    let validatedSubcategory = itemToSave.subcategory;

    const categoryExists = categories.some(c => c.name === validatedCategory);
    if (!categoryExists) {
        validatedCategory = 'Uncategorized';
        validatedSubcategory = 'Default';
    } else {
        const subcategoryExists = categories.find(c => c.name === validatedCategory)?.subcategories.includes(validatedSubcategory);
        if (!subcategoryExists) {
            validatedSubcategory = 'Default';
            const parentCatDef = categories.find(c => c.name === validatedCategory);
            if (parentCatDef && !parentCatDef.subcategories.includes('Default')) {
                setCategories(prevCats => prevCats.map(cat => 
                    cat.id === parentCatDef.id 
                    ? { ...cat, subcategories: [...new Set([...cat.subcategories, 'Default'])].sort() } 
                    : cat
                ));
            }
        }
    }
    
    const finalItemData: InventoryItem = { // Ensure ID is handled
        ...itemToSave,
        id: itemToSave.id || generateId(), // Generate ID if new, use existing if editing
        category: validatedCategory,
        subcategory: validatedSubcategory,
    };
    
    if (editingItem && editingItem.id) { // Editing existing item
      setItems(prevItems => prevItems.map(i => i.id === editingItem.id ? finalItemData : i));
    } else { // Adding new item
      setItems(prevItems => [...prevItems, finalItemData]);
    }
    closeModal();
  }, [editingItem, closeModal, currentUserRole, categories]);

  const handleDeleteItem = async (itemId: string) => {
    if (currentUserRole !== 'admin' || !itemId) return; 
    if (window.confirm('Are you sure you want to delete this item?')) {
      setItems(prevItems => prevItems.filter(i => i.id !== itemId));
    }
  };

  const handleSellItemSize = useCallback(async (itemId: string, sizeToSell: Size) => {
    if (viewMode !== 'stock' && currentUserRole !== 'admin') return; 
    if (!itemId) return;

    setItems(prevItems => prevItems.map(item => {
      if (item.id === itemId) {
        const currentQuantity = item.sizes[sizeToSell] || 0;
        if (currentQuantity > 0) {
          return { ...item, sizes: { ...item.sizes, [sizeToSell]: currentQuantity - 1 } };
        }
      }
      return item;
    }));
  }, [currentUserRole, viewMode]); 

  const filteredItemsForAdminTable = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const itemsForProductStockView = items.filter(item => 
    item.category === selectedCategoryForView && item.subcategory === selectedSubcategoryForView
  );

  const toggleViewMode = () => {
    if (currentUserRole !== 'admin') return;
    setViewMode(prevMode => {
        const newMode = prevMode === 'admin' ? 'stock' : 'admin';
        if (newMode === 'stock') { 
            setSelectedCategoryForView(null);
            setSelectedSubcategoryForView(null);
        }
        return newMode;
    });
  };

  const handleAddCategory = async (categoryName: string) => {
    const newCategory: CategoryDefinition = { id: categoryName, name: categoryName, subcategories: ['Default'] };
    setCategories(prev => [...prev, newCategory]);
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (categoryName === 'Uncategorized' || !categoryId) return; 
    
    // Reassign items
    setItems(prevItems => prevItems.map(item => {
      if (item.category === categoryName) {
        return { ...item, category: 'Uncategorized', subcategory: 'Default' };
      }
      return item;
    }));
      
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));

    if (selectedCategoryForView === categoryName) {
        setSelectedCategoryForView(null);
        setSelectedSubcategoryForView(null);
    }
  };

  const handleAddSubcategory = async (categoryId: string, categoryName: string, subcategoryName: string) => {
    if (!categoryId) return;
    setCategories(prevCats => prevCats.map(cat => {
      if (cat.id === categoryId) {
        const newSubcategories = [...new Set([...cat.subcategories, subcategoryName])].sort();
        return { ...cat, subcategories: newSubcategories };
      }
      return cat;
    }));
  };

const handleDeleteSubcategory = async (categoryId: string, categoryName: string, subcategoryName: string) => {
    if ((categoryName === 'Uncategorized' && subcategoryName === 'Default') || !categoryId) {
        return;
    }
    const parentCatDef = categories.find(c => c.id === categoryId);
    if (parentCatDef && subcategoryName === 'Default' && parentCatDef.subcategories.length === 1 && categoryName !== 'Uncategorized') {
        alert("Cannot delete the only 'Default' subcategory if it's not Uncategorized.");
        return;
    }

    const itemsWillBeReassigned = items.some(item => item.category === categoryName && item.subcategory === subcategoryName);

    setCategories(prevCats => prevCats.map(cat => {
      if (cat.id === categoryId) {
        let updatedSubcategories = cat.subcategories.filter(sub => sub !== subcategoryName);
        if (itemsWillBeReassigned && subcategoryName !== 'Default' && !updatedSubcategories.includes('Default')) {
          updatedSubcategories.push('Default');
          updatedSubcategories.sort();
        }
        if (categoryName !== 'Uncategorized' && updatedSubcategories.length === 0) {
          updatedSubcategories.push('Default');
        }
        return { ...cat, subcategories: updatedSubcategories };
      }
      return cat;
    }));

    if (itemsWillBeReassigned) {
      setItems(prevItems => prevItems.map(item => {
        if (item.category === categoryName && item.subcategory === subcategoryName) {
          return { ...item, subcategory: 'Default' };
        }
        return item;
      }));
    }

    if (selectedCategoryForView === categoryName && selectedSubcategoryForView === subcategoryName) {
        setSelectedSubcategoryForView(null); 
    }
  };

  const handleSelectCategoryForView = (categoryName: string) => {
    setSelectedCategoryForView(categoryName);
    setSelectedSubcategoryForView(null);
  };
  
  const handleSelectSubcategoryForView = (categoryName: string, subcategoryName: string) => {
    setSelectedCategoryForView(categoryName); 
    setSelectedSubcategoryForView(subcategoryName);
  };

  const handleNavigateBackFromStockView = () => {
    if (selectedSubcategoryForView) {
      setSelectedSubcategoryForView(null); 
    } else if (selectedCategoryForView) {
      setSelectedCategoryForView(null); 
    }
  };

  const getCategoryItemCount = useCallback((categoryName: string, subcategoryName: string): number => {
    return items.filter(item => item.category === categoryName && item.subcategory === subcategoryName).length;
  }, [items]);

  if (authLoading) {
    return <div className="loading-container"><p>Loading application...</p></div>; 
  }

  if (!currentUserEmail) { // Use currentUserEmail to check for logged-in user
    if (authViewMode === 'register') {
      return <RegistrationView 
                onRegister={handleRegister} 
                registrationMessage={registrationMessage} 
                onSwitchToLogin={() => { setAuthViewMode('login'); setRegistrationMessage(null); }}
                isRegistering={isProcessingAuth} 
             />;
    }
    return <LoginView 
              onLogin={handleLogin} 
              loginError={loginError} 
              onSwitchToRegister={() => { setAuthViewMode('register'); setLoginError(null); }}
              isLoggingIn={isProcessingAuth} 
           />;
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>Inventory Management {currentUserRole === 'admin' && <span className="admin-badge">(Admin)</span>}</h1>
        <div className="header-controls">
          {currentUserRole === 'admin' && viewMode === 'admin' && (
            <input
              type="text"
              placeholder="Search by name or SKU (in table)..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search inventory items"
            />
          )}
          {currentUserRole === 'admin' && (
            <button 
              onClick={toggleViewMode} 
              className="btn btn-info" 
              aria-label={viewMode === 'admin' ? "Switch to Product Stock View" : "Switch to Admin Panel View"}
            >
              {viewMode === 'admin' ? 'View Product Stock' : 'View Admin Panel'}
            </button>
          )}
          {currentUserRole === 'admin' && viewMode === 'admin' && (
            <button onClick={() => openModal()} className="btn btn-primary" aria-label="Add new item">
              Add New Item
            </button>
          )}
           <button onClick={handleLogout} className="btn btn-danger" aria-label="Logout">
            Logout ({currentUsername || currentUserEmail})
          </button>
        </div>
      </header>

      {currentUserRole === 'admin' && viewMode === 'admin' && isModalOpen && (
        <ItemModal
          item={editingItem}
          onClose={closeModal}
          onSave={handleSaveItem}
          categories={categories}
        />
      )}
      
      {currentUserRole === 'admin' && viewMode === 'admin' ? (
        <>
          <AdminCategoryManager
            categories={categories}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onAddSubcategory={handleAddSubcategory}
            onDeleteSubcategory={handleDeleteSubcategory}
            items={items}
          />
          <main className="inventory-table-container">
            {filteredItemsForAdminTable.length === 0 && !searchTerm && (
               <div className="empty-state">
                 <h2>No items in inventory.</h2>
                 <p>Click "Add New Item" to get started.</p>
               </div>
            )}
            {filteredItemsForAdminTable.length === 0 && searchTerm && (
                <div className="empty-state">
                  <h2>No items match your search "{searchTerm}".</h2>
                  <p>Try a different search term or clear the search.</p>
                </div>
            )}
            {filteredItemsForAdminTable.length > 0 && (
              <table className="inventory-table" aria-label="Inventory Items">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Subcategory</th>
                    <th>Total Quantity</th>
                    <th>Price</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItemsForAdminTable.map(item => {
                    const totalQuantity = calculateTotalQuantity(item.sizes);
                    return (
                      <tr key={item.id}>
                        <td data-label="Image" className="cell-image">
                          {item.imageUrl ? ( // imageUrl is Base64
                            <img src={item.imageUrl} alt={item.name} className="table-item-image" />
                          ) : (
                            <span className="no-image-text">No Image</span>
                          )}
                        </td>
                        <td data-label="Name">{item.name}</td>
                        <td data-label="SKU">{item.sku}</td>
                        <td data-label="Category">{item.category}</td>
                        <td data-label="Subcategory">{item.subcategory}</td>
                        <td data-label="Total Quantity">{totalQuantity}</td>
                        <td data-label="Price">${item.price.toFixed(2)}</td>
                        <td data-label="Description">{item.description || '-'}</td>
                        <td data-label="Actions" className="actions-cell">
                          <button onClick={() => openModal(item)} className="btn btn-secondary btn-sm" aria-label={`Edit ${item.name}`}>Edit</button>
                          <button onClick={() => handleDeleteItem(item.id!)} className="btn btn-danger btn-sm" aria-label={`Delete ${item.name}`}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </main>
        </>
      ) : ( 
        <ProductStockView
          items={itemsForProductStockView}
          allCategories={categories}
          selectedCategoryName={selectedCategoryForView}
          selectedSubcategoryName={selectedSubcategoryForView}
          onSelectCategory={handleSelectCategoryForView}
          onSelectSubcategory={handleSelectSubcategoryForView}
          onNavigateBack={handleNavigateBackFromStockView}
          onSellItemSize={handleSellItemSize}
          userRole={currentUserRole}
          getCategoryItemCount={getCategoryItemCount}
        />
      )}
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Inventory App. All rights reserved.</p>
      </footer>
    </div>
  );
};

interface ItemModalFormData {
  name: string;
  sku: string;
  category: string;
  subcategory: string;
  sizes: Record<Size, number>;
  price: number;
  description?: string;
  imageUrl?: string; // Base64 string
}

interface ItemModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (item: InventoryItem) => Promise<void>;
  categories: CategoryDefinition[];
}

const ItemModal: React.FC<ItemModalProps> = ({ item, onClose, onSave, categories }) => {
  
  const getInitialFormData = useCallback((): ItemModalFormData => {
    const defaultSizes = SIZES.reduce((acc, size) => { acc[size] = 0; return acc; }, {} as Record<Size, number>);
    
    let initialCategory = categories.find(c => c.name === 'Uncategorized')?.name || (categories.length > 0 ? categories[0].name : '');
    let initialSubcategory = categories.find(c => c.name === initialCategory)?.subcategories.includes('Default') 
        ? 'Default' 
        : (categories.find(c => c.name === initialCategory)?.subcategories[0] || '');

    if (item) {
       const currentItemSizes = SIZES.reduce((acc, size) => {
        acc[size] = Number(item.sizes?.[size]) || 0;
        return acc;
      }, {} as Record<Size, number>);

      const itemCategoryInState = categories.find(c => c.name === item.category);
      if (itemCategoryInState) {
        initialCategory = itemCategoryInState.name;
        const itemSubcategoryInState = itemCategoryInState.subcategories.includes(item.subcategory) 
            ? item.subcategory 
            : (itemCategoryInState.subcategories.includes('Default') ? 'Default' : itemCategoryInState.subcategories[0]);
        initialSubcategory = itemSubcategoryInState || 'Default'; 
      }
      
      return {
        name: item.name,
        sku: item.sku,
        category: initialCategory,
        subcategory: initialSubcategory,
        sizes: currentItemSizes,
        price: item.price,
        description: item.description || '',
        imageUrl: item.imageUrl || '', // Base64 string
      };
    }
    
    const uncategorizedCat = categories.find(c => c.name === 'Uncategorized');
    if (uncategorizedCat) {
        initialCategory = 'Uncategorized';
        initialSubcategory = uncategorizedCat.subcategories.includes('Default') ? 'Default' : (uncategorizedCat.subcategories[0] || '');
    } else if (categories.length > 0) { 
        initialCategory = categories[0].name;
        initialSubcategory = categories[0].subcategories[0] || '';
    }

    return {
      name: '',
      sku: '',
      category: initialCategory,
      subcategory: initialSubcategory,
      sizes: defaultSizes,
      price: 0,
      description: '',
      imageUrl: '', // Base64 string
    };
  }, [item, categories]);
  
  const [formData, setFormData] = useState<ItemModalFormData>(getInitialFormData());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false); // General processing state
  
  const availableSubcategories = categories.find(c => c.name === formData.category)?.subcategories || [];

  useEffect(() => {
    setFormData(getInitialFormData());
    setErrors({});
  }, [item, getInitialFormData]);

  useEffect(() => {
    const currentCategoryDef = categories.find(c => c.name === formData.category);
    if (currentCategoryDef && !currentCategoryDef.subcategories.includes(formData.subcategory)) {
      setFormData(prev => ({
        ...prev,
        subcategory: currentCategoryDef.subcategories.includes('Default') ? 'Default' : (currentCategoryDef.subcategories[0] || '')
      }));
    } else if (!currentCategoryDef && formData.category) { 
        const uncategorizedOpt = categories.find(c => c.name === 'Uncategorized');
        if (uncategorizedOpt) {
            setFormData(prev => ({
                ...prev,
                category: 'Uncategorized',
                subcategory: uncategorizedOpt.subcategories.includes('Default') ? 'Default' : (uncategorizedOpt.subcategories[0] || '')
            }));
        } else if (categories.length > 0) {
            setFormData(prev => ({
                ...prev,
                category: categories[0].name,
                subcategory: categories[0].subcategories[0] || ''
            }));
        } else { 
             setFormData(prev => ({ ...prev, category: '', subcategory: ''}));
        }
    }
  }, [formData.category, categories, formData.subcategory]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let newErrors = { ...errors };

    if (name.startsWith('size_')) {
      const sizeKey = name.split('_')[1] as Size;
      setFormData(prev => ({
        ...prev,
        sizes: { ...prev.sizes, [sizeKey]: parseInt(value) || 0 }
      }));
      delete newErrors[name];
    } else if (name === 'category') {
      const newCategoryName = value;
      const categoryObj = categories.find(c => c.name === newCategoryName);
      const newSubcategory = categoryObj 
        ? (categoryObj.subcategories.includes('Default') ? 'Default' : (categoryObj.subcategories[0] || ''))
        : '';
      setFormData(prev => ({ ...prev, category: newCategoryName, subcategory: newSubcategory }));
      delete newErrors.category;
      delete newErrors.subcategory;
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' && name === 'price' ? parseFloat(value) || 0 : value,
      }));
      delete newErrors[name];
    }
    setErrors(newErrors);
  };
  
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrors(prev => ({ ...prev, imageUrl: "Image size should not exceed 5MB."}));
        event.target.value = ''; 
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string })); // Store Base64 string
         setErrors(prev => ({ ...prev, imageUrl: undefined }));
      };
      reader.onerror = () => {
        console.error("Error reading file");
        setErrors(prev => ({ ...prev, imageUrl: "Failed to read image file."}));
      }
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = async () => {
    setFormData(prev => ({ ...prev, imageUrl: '' })); // Clear Base64 string
    const fileInput = document.getElementById('imageUrlFile') as HTMLInputElement | null;
    if (fileInput) fileInput.value = ''; 
    setErrors(prev => ({ ...prev, imageUrl: undefined }));
  };


  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required.';
    if (!formData.category) newErrors.category = 'Category is required.';
    else {
        const catDef = categories.find(c => c.name === formData.category);
        if (!catDef) {
            newErrors.category = 'Selected category does not exist.';
        } else if (!formData.subcategory) {
            newErrors.subcategory = 'Subcategory is required.';
        } else if (!catDef.subcategories.includes(formData.subcategory)) {
            newErrors.subcategory = 'Selected subcategory is not valid for the chosen category. Please re-select.';
        }
    }

    if (formData.price < 0) newErrors.price = 'Price cannot be negative.';
    else if (isNaN(formData.price)) newErrors.price = 'Price must be a number.';
    
    SIZES.forEach(size => {
      const sizeQuantity = formData.sizes[size];
      if (sizeQuantity < 0) newErrors[`size_${size}`] = `Qty for ${size} cannot be negative.`;
      else if (isNaN(sizeQuantity)) newErrors[`size_${size}`] = `Qty for ${size} must be a number.`;
    });
    if (errors.imageUrl) newErrors.imageUrl = errors.imageUrl; 

    setErrors(newErrors);
    return Object.keys(newErrors).filter(key => key !== 'imageUrl' || newErrors.imageUrl).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsProcessing(true);

    const itemDataForSave: InventoryItem = {
      ...formData,
      id: item?.id || generateId(), // Ensure ID is present
    };
    
    try {
        await onSave(itemDataForSave);
        // onClose will be called by App component after successful save
    } catch (error) {
        console.error("Error during onSave callback in ItemModal:", error);
    } finally {
        setIsProcessing(false);
    }
  };
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape' && !isProcessing) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, isProcessing]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content">
        <header className="modal-header">
          <h2 id="modal-title">{item ? 'Edit Item' : 'Add New Item'}</h2>
          <button onClick={onClose} className="btn-close" aria-label="Close modal" disabled={isProcessing}>&times;</button>
        </header>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} disabled={isProcessing} />
            {errors.name && <p id="name-error" className="error-message">{errors.name}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="sku">SKU</label>
            <input type="text" id="sku" name="sku" value={formData.sku} onChange={handleChange} required aria-invalid={!!errors.sku} aria-describedby={errors.sku ? "sku-error" : undefined} disabled={isProcessing} />
            {errors.sku && <p id="sku-error" className="error-message">{errors.sku}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" value={formData.category} onChange={handleChange} required aria-invalid={!!errors.category} aria-describedby={errors.category ? "category-error" : undefined} disabled={isProcessing}>
              {categories.length === 0 && <option value="">No categories available</option>}
              {categories.map(cat => <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>)}
            </select>
            {errors.category && <p id="category-error" className="error-message">{errors.category}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="subcategory">Subcategory</label>
            <select 
                id="subcategory" 
                name="subcategory" 
                value={formData.subcategory} 
                onChange={handleChange} 
                required 
                disabled={isProcessing || availableSubcategories.length === 0 && !formData.category}
                aria-invalid={!!errors.subcategory} 
                aria-describedby={errors.subcategory ? "subcategory-error" : undefined}
            >
              {!formData.category && <option value="">Select a category first</option>}
              {formData.category && availableSubcategories.length === 0 && <option value="">No subcategories. 'Default' may be used.</option>}
              {availableSubcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
            {errors.subcategory && <p id="subcategory-error" className="error-message">{errors.subcategory}</p>}
          </div>
          
          <div className="form-group">
            <label htmlFor="imageUrlFile">Product Image</label>
            <input type="file" id="imageUrlFile" name="imageUrlFile" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleImageFileChange} aria-describedby={errors.imageUrl ? "imageUrl-error" : undefined} disabled={isProcessing}/>
            {errors.imageUrl && <p id="imageUrl-error" className="error-message">{errors.imageUrl}</p>}
            {formData.imageUrl && ( 
              <div className="image-preview-container">
                <img src={formData.imageUrl} alt="Preview" className="image-preview" />
                <button type="button" onClick={handleRemoveImage} className="btn btn-danger btn-xs btn-remove-image" aria-label="Remove current image" disabled={isProcessing}>Remove Image</button>
              </div>
            )}
          </div>

          <fieldset className="form-group">
            <legend>Quantities by Size</legend>
            <div className="sizes-grid">
              {SIZES.map(size => (
                <div key={size} className="form-group-size">
                  <label htmlFor={`size_${size}`}>{size}</label>
                  <input type="number" id={`size_${size}`} name={`size_${size}`} value={formData.sizes[size]} onChange={handleChange} min="0" required aria-invalid={!!errors[`size_${size}`]} aria-describedby={errors[`size_${size}`] ? `size_${size}-error` : undefined} disabled={isProcessing}/>
                  {errors[`size_${size}`] && <p id={`size_${size}-error`} className="error-message error-message-size">{errors[`size_${size}`]}</p>}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="form-group">
            <label htmlFor="price">Price</label>
            <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} min="0" step="0.01" required aria-invalid={!!errors.price} aria-describedby={errors.price ? "price-error" : undefined} disabled={isProcessing}/>
            {errors.price && <p id="price-error" className="error-message">{errors.price}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={3} disabled={isProcessing}/>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isProcessing}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isProcessing}>
              {isProcessing ? 'Saving...' : (item ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
  console.error('Failed to find the root element');
}